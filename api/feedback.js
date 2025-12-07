module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { conversationHistory, caseId } = req.body;

    if (!conversationHistory || conversationHistory.length === 0) {
      return res.status(400).json({ error: 'No conversation history' });
    }

    // 대화 내용을 정리 - 최근 10개 의사 발언만 추출 (용량 줄이기)
    let userMessages = [];
    conversationHistory.forEach((msg) => {
      if (msg.role === 'user') {
        userMessages.push(msg.text);
      }
    });
    
    // 최근 10개만 사용 (너무 많으면 API 부하 증가)
    const recentMessages = userMessages.slice(-10);
    const conversationText = recentMessages.map((text, idx) => `${idx + 1}. ${text}`).join('\n');
    
    console.log(`[feedback.js] Sending ${recentMessages.length} recent doctor messages for feedback`);
    console.log(`[feedback.js] Message text length: ${conversationText.length} chars`);

    // Gemini에 피드백 요청 (5단계 루브릭 기반) - 더 간단하게
    const prompt = `치과 진료 5단계로 평가:
1. 인사 및 환자 확인
2. 방문 이유 확인
3. 정보 수집 및 공감
4. 치료 계획 설명
5. 진료 마무리

의사 발언:
${conversationText}

JSON으로 응답:
{"feedbacks": [{"stage": "1단계", "done": true, "text": "한 줄 평가"}]}
최대 5개 항목만.`;

    // 두 개의 API 키로 로드 밸런싱
    const apiKey1 = process.env.GENAI_API_KEY;
    const apiKey2 = process.env.GENAI_API_KEY_2;
    
    if (!apiKey1) {
      return res.status(500).json({ error: 'GENAI_API_KEY not configured' });
    }

    // prompt의 길이를 기반으로 API 키 선택
    const useKey2 = prompt.length % 2 === 1 && apiKey2;
    const selectedKey = useKey2 ? apiKey2 : apiKey1;
    const keyLabel = useKey2 ? 'GENAI_API_KEY_2' : 'GENAI_API_KEY';
    
    console.log(`[feedback.js] Using ${keyLabel} for feedback generation`);

    // Google Generative AI REST API direct call
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${selectedKey}`;
    
    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 180,
      }
    };
    
    console.log(`[feedback.js] Request body size: ${JSON.stringify(requestBody).length} bytes`);
    const requestStartTime = Date.now();
    
    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        timeout: 8000  // 8초 타임아웃 (Vercel 10초 제한 고려)
      });
    } catch (fetchErr) {
      console.error('[ALERT] Fetch error (network/timeout):', fetchErr.message);
      return res.status(503).json({ error: 'Network error', detail: fetchErr.message });
    }

    const requestDuration = Date.now() - requestStartTime;
    console.log(`[feedback.js] API response status: ${response.status} (took ${requestDuration}ms)`);
    console.log(`[feedback.js] Response headers: content-type=${response.headers.get('content-type')}`);

    if (!response.ok) {
      console.error(`Feedback API error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error(`[DEBUG] Error response (first 500 chars): ${errorText.substring(0, 500)}`);
      
      // 특정 에러 상황 감지
      if (response.status === 429) {
        console.error('[ALERT] Rate limit exceeded (429) on feedback endpoint - Queuing for retry');
        // Retry-After 헤더 설정 (클라이언트가 재시도 시간 알 수 있음)
        const retryAfter = response.headers.get('retry-after') || '5';
        res.setHeader('Retry-After', retryAfter);
        return res.status(429).json({ 
          error: 'Rate limit exceeded', 
          detail: 'API 사용량 제한 도달 - 잠시 후 다시 시도해주세요',
          retryAfter: parseInt(retryAfter)
        });
      } else if (response.status === 403) {
        console.error('[ALERT] Forbidden (403) - API key might be invalid or quota exceeded');
        return res.status(403).json({ error: 'Access forbidden', detail: errorText });
      } else if (response.status === 500 || response.status === 502 || response.status === 503) {
        console.error('[ALERT] Server error from Google API');
        return res.status(response.status).json({ error: 'Google API server error', detail: errorText });
      }
      
      return res.status(response.status).json({ error: 'LLM API error', detail: errorText });
    }

    let data;
    try {
      data = await response.json();
    } catch (parseErr) {
      console.error('[ALERT] Failed to parse JSON response:', parseErr.message);
      const rawText = await response.text();
      console.error(`[DEBUG] Raw response: ${rawText.substring(0, 500)}`);
      return res.status(502).json({ error: 'Invalid JSON from API', detail: parseErr.message });
    }
    
    // 사용량 정보 확인
    if (data?.usageMetadata) {
      console.log(`[feedback.js] Token usage - input: ${data.usageMetadata.inputTokenCount}, output: ${data.usageMetadata.outputTokenCount}`);
    }

    // 응답 구조 검증
    if (!data?.candidates) {
      console.error('[ALERT] Response missing "candidates" field');
      console.error(`[DEBUG] Response keys: ${Object.keys(data).join(', ')}`);
      return res.status(200).json({ feedbacks: [] });
    }

    if (data.candidates.length === 0) {
      console.warn('[ALERT] Candidates array is empty');
      if (data?.promptFeedback) {
        console.warn('[DEBUG] Prompt feedback:', JSON.stringify(data.promptFeedback));
      }
      return res.status(200).json({ feedbacks: [] });
    }

    const candidate = data.candidates[0];
    if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
      console.warn(`[WARNING] Finish reason: ${candidate.finishReason}`);
    }

    // 응답에서 텍스트 추출
    let responseText = '';
    if (candidate?.content?.parts && candidate.content.parts.length > 0) {
      responseText = candidate.content.parts[0].text || '';
    }

    if (!responseText) {
      console.warn('[ALERT] No response text extracted from LLM');
      console.warn(`[DEBUG] Candidate structure: ${JSON.stringify(candidate).substring(0, 500)}`);
      return res.status(200).json({ feedbacks: [] });
    }

    // JSON 파싱
    let feedbackData;
    try {
      feedbackData = JSON.parse(responseText);
    } catch (e) {
      // JSON 블록만 추출 시도
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        feedbackData = JSON.parse(jsonMatch[0]);
      } else {
        console.error('Failed to parse feedback response:', responseText);
        return res.status(200).json({ feedbacks: [] });
      }
    }

    return res.status(200).json(feedbackData);
  } catch (error) {
    console.error('Feedback error:', error);
    return res.status(500).json({ error: 'server error', detail: error.message });
  }
};
