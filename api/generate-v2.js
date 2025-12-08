// api/generate-v2.js - 두 번째 배포용 (API KEY 2 사용)
// 내용은 generate.js와 동일하지만 GENAI_API_KEY_2 환경변수 사용

const crypto = require('crypto');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const body = req.body || {};
  const { caseId, userMessage, recent = [], currentStep = 0 } = body;
  if (!userMessage) return res.status(400).json({ error: 'userMessage required' });

  const norm = (s) => (s || '').toString().trim().toLowerCase();
  const keySource = `${caseId}|${recent.slice(-3).map(r => norm(r.text)).join('|')}|${norm(userMessage)}`;
  const cacheKey = 'reply:' + crypto.createHash('sha256').update(keySource).digest('hex');

  try {
    let personaDetail = '';
    
    if (caseId === 'jo-minseon') {
      personaDetail = `\n특별 지시: 당신은 민감한 환자 조민선입니다. 초반에는 발치에 대한 거부감을 드러냅니다. 응답은 1-2 문장, 한국어로 유지하세요.`;
    } else if (caseId === 'oh-owan') {
      personaDetail = `\n특별 지시: 당신은 환자 오완의 어머니(보호자)입니다. 아이의 건강을 걱정하면서 질문합니다. 응답은 1-2 문장, 한국어로 유지하세요.`;
    } else if (caseId === 'lee-jiwon') {
      personaDetail = `\n특별 지시: 당신은 불안한 환자 이지원입니다. 증상에 대해 자세히 설명하고 의사의 설명을 신뢰하려 합니다. 응답은 1-2 문장, 한국어로 유지하세요.`;
    }

    let stepGuide = '';
    const steps = ['인사 및 환자 확인', '방문 이유 확인', '정보 수집 및 공감', '치료 계획 설명', '진료 마무리'];
    if (currentStep === 4) {
      stepGuide = '\n진료 마무리 단계입니다. 의사의 설명에 감사하며 안도하는 느낌으로 "감사합니다"나 "도움이 됐습니다"라는 식의 긍정적인 반응을 보여주세요.';
    }

    const systemPrompt = `You are a simulated dental patient in case: ${caseId}. Keep replies short (1-2 sentences) in Korean.${personaDetail}${stepGuide}`;
    const historyText = recent.map(r => `${r.role === 'user' ? '의사' : '환자'}: ${r.text}`).join('\n');
    const prompt = `${systemPrompt}\n${historyText}\n의사: ${userMessage}\n환자:`;

    // API KEY 2 사용 (첫 번째 배포와 다른 키)
    const apiKey = process.env.GENAI_API_KEY_2;
    if (!apiKey) {
      console.error('GENAI_API_KEY_2 not configured');
      return res.status(500).json({ error: 'GENAI_API_KEY_2 not configured' });
    }

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
        maxOutputTokens: 256
      }
    };
    
    console.log(`[generate-v2.js] Calling Google API with KEY_2 for case: ${caseId}`);
    console.log(`[generate-v2.js] Request body size: ${JSON.stringify(requestBody).length} bytes`);
    const requestStartTime = Date.now();
    
    let resp;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        timeout: 8000
      });
    } catch (fetchErr) {
      console.error('[ALERT] Fetch error (network/timeout):', fetchErr.message);
      return res.status(503).json({ error: 'Network error', detail: fetchErr.message });
    }
    
    const requestDuration = Date.now() - requestStartTime;
    console.log(`[generate-v2.js] API response status: ${resp.status} (took ${requestDuration}ms)`);
    console.log(`[generate-v2.js] Response headers: content-type=${resp.headers.get('content-type')}`);
    
    if (!resp.ok) {
      console.error(`API error: ${resp.status} ${resp.statusText}`);
      const errorText = await resp.text();
      console.error(`[DEBUG] Error response (first 500 chars): ${errorText.substring(0, 500)}`);
      
      if (resp.status === 429) {
        console.error('[ALERT] Rate limit exceeded (429)');
        return res.status(429).json({ error: 'Rate limit exceeded', detail: 'API 사용량 제한 도달' });
      } else if (resp.status === 403) {
        console.error('[ALERT] Forbidden (403) - API key might be invalid or quota exceeded');
        return res.status(403).json({ error: 'Access forbidden', detail: errorText });
      } else if (resp.status === 500 || resp.status === 502 || resp.status === 503) {
        console.error('[ALERT] Server error from Google API');
        return res.status(resp.status).json({ error: 'Google API server error', detail: errorText });
      }
      
      return res.status(resp.status).json({ error: 'LLM API error', detail: errorText });
    }
    
    let data;
    try {
      data = await resp.json();
    } catch (parseErr) {
      console.error('[ALERT] Failed to parse JSON response:', parseErr.message);
      const rawText = await resp.text();
      console.error(`[DEBUG] Raw response: ${rawText.substring(0, 500)}`);
      return res.status(502).json({ error: 'Invalid JSON from API', detail: parseErr.message });
    }
    
    console.log('[generate-v2.js] API response received, parsing...');
    
    if (data?.usageMetadata) {
      console.log(`[generate-v2.js] Token usage - input: ${data.usageMetadata.inputTokenCount}, output: ${data.usageMetadata.outputTokenCount}`);
    }
    
    if (!data?.candidates) {
      console.error('[ALERT] Response missing "candidates" field');
      console.error(`[DEBUG] Response keys: ${Object.keys(data).join(', ')}`);
      return res.status(502).json({ error: 'Invalid API response structure', detail: 'Missing candidates' });
    }
    
    if (data.candidates.length === 0) {
      console.warn('[ALERT] Candidates array is empty');
      if (data?.promptFeedback) {
        console.warn('[DEBUG] Prompt feedback:', JSON.stringify(data.promptFeedback));
      }
      return res.status(502).json({ error: 'No candidates in response', detail: 'API returned empty candidates' });
    }
    
    const candidate = data.candidates[0];
    if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
      console.warn(`[WARNING] Finish reason: ${candidate.finishReason}`);
    }
    
    let reply = '';
    if (candidate?.content?.parts && candidate.content.parts.length > 0) {
      reply = candidate.content.parts[0].text || '';
    }
    
    if (!reply) {
      console.warn('[ALERT] No reply text extracted from LLM response');
      console.warn(`[DEBUG] Candidate structure: ${JSON.stringify(candidate).substring(0, 500)}`);
      return res.status(502).json({ error: 'No response from LLM', detail: JSON.stringify(data) });
    }
    
    console.log(`[generate-v2.js] Successfully generated reply: ${reply.substring(0, 50)}...`);
    return res.json({ text: reply, cached: false });
    
  } catch (err) {
    console.error('server error', err.message);
    console.error('Full error:', err);
    return res.status(500).json({ error: 'server error', detail: err.message });
  }
};
