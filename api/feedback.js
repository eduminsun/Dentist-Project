module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { conversationHistory, caseId } = req.body;

    if (!conversationHistory || conversationHistory.length === 0) {
      return res.status(400).json({ error: 'No conversation history' });
    }

    // 대화 내용을 정리 (의사의 발언만 평가)
    let conversationText = '';
    conversationHistory.forEach((msg, idx) => {
      if (msg.role === 'user') {
        conversationText += `[${idx}] 의사: ${msg.text}\n`;
      }
    });

    // Gemini에 피드백 요청 (5단계 루브릭 기반)
    const prompt = `치과 진료 5단계 체크리스트로 평가하세요:
1. 인사 및 환자 확인 (환자 이름 확인, 편한 인사)
2. 방문 이유 확인 (주요 증상/불편 확인)
3. 정보 수집 및 공감 (추가 질문, 환자 말 경청)
4. 치료 계획 설명 (명확한 설명, 옵션 제시)
5. 진료 마무리 (다음 단계 안내, 안심 제공)

의사 발언:
${conversationText}

잘 이루어진 단계와 개선 필요 단계를 JSON으로 응답:
{"feedbacks": [{"stage": "5단계 이름", "done": true/false, "text": "한 줄 피드백"}]}`;

    const apiKey = process.env.GENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GENAI_API_KEY not configured' });
    }

    // Google Generative AI REST API direct call
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    
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
    
    console.log('[feedback.js] Calling Google API for feedback generation');
    const requestStartTime = Date.now();
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const requestDuration = Date.now() - requestStartTime;
    console.log(`[feedback.js] API response status: ${response.status} (took ${requestDuration}ms)`);

    if (!response.ok) {
      console.error(`Feedback API error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      
      // 특정 에러 상황 감지
      if (response.status === 429) {
        console.error('[ALERT] Rate limit exceeded (429) on feedback endpoint');
        return res.status(429).json({ error: 'Rate limit exceeded', detail: 'API 사용량 제한 도달' });
      } else if (response.status === 403) {
        console.error('[ALERT] Forbidden (403) - API key might be invalid or quota exceeded');
        return res.status(403).json({ error: 'Access forbidden', detail: errorText });
      } else if (response.status === 500 || response.status === 502 || response.status === 503) {
        console.error('[ALERT] Server error from Google API');
        return res.status(response.status).json({ error: 'Google API server error', detail: errorText });
      }
      
      return res.status(response.status).json({ error: 'LLM API error', detail: errorText });
    }

    const data = await response.json();
    
    // 사용량 정보 확인
    if (data?.usageMetadata) {
      console.log(`[feedback.js] Token usage - input: ${data.usageMetadata.inputTokenCount}, output: ${data.usageMetadata.outputTokenCount}`);
    }

    // 응답에서 텍스트 추출
    let responseText = '';
    if (data?.candidates && data.candidates.length > 0) {
      const candidate = data.candidates[0];
      if (candidate?.content?.parts && candidate.content.parts.length > 0) {
        responseText = candidate.content.parts[0].text || '';
      }
    }

    if (!responseText) {
      console.warn('No response text from LLM');
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
