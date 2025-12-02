// Vercel Serverless function to proxy requests to Google Generative AI (Gemini) REST API
// Expects environment variable: GENAI_API_KEY

const crypto = require('crypto');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const body = req.body || {};
  const { caseId, userMessage, recent = [], currentStep = 0 } = body;
  if (!userMessage) return res.status(400).json({ error: 'userMessage required' });

  // simple normalization and key generation for caching (optional later)
  const norm = (s) => (s || '').toString().trim().toLowerCase();
  const keySource = `${caseId}|${recent.slice(-3).map(r => norm(r.text)).join('|')}|${norm(userMessage)}`;
  const cacheKey = 'reply:' + crypto.createHash('sha256').update(keySource).digest('hex');

  try {
    // Build persona-specific and step-specific prompts
    let personaDetail = '';
    
    if (caseId === 'jo-minseon') {
      personaDetail = `\n특별 지시: 당신은 민감한 환자 조민선입니다. 발치를 하고 싶지 않아 합니다. 응답은 1-2 문장, 한국어로 유지하세요.`;
    } else if (caseId === 'oh-owan') {
      personaDetail = `\n특별 지시: 당신은 환자 오완의 어머니(보호자)입니다. 아이의 건강을 걱정하면서 질문합니다. 응답은 1-2 문장, 한국어로 유지하세요.`;
    } else if (caseId === 'lee-jiwon') {
      personaDetail = `\n특별 지시: 당신은 불안한 환자 이지원입니다. 증상에 대해 자세히 설명하고 의사의 설명을 신뢰하려 합니다. 응답은 1-2 문장, 한국어로 유지하세요.`;
    }

    // Step-specific guidance
    let stepGuide = '';
    const steps = ['인사 및 환자 확인', '방문 이유 확인', '정보 수집 및 공감', '치료 계획 설명', '진료 마무리'];
    if (currentStep === 4) {
      // 진료 마무리 단계: 감사 인사 추가
      stepGuide = '\n진료 마무리 단계입니다. 의사의 설명에 감사하며 안도하는 느낌으로 "감사합니다"나 "도움이 됐습니다"라는 식의 긍정적인 반응을 보여주세요.';
    }

    const systemPrompt = `You are a simulated dental patient in case: ${caseId}. Keep replies short (1-2 sentences) in Korean.${personaDetail}${stepGuide}`;
    const historyText = recent.map(r => `${r.role === 'user' ? '의사' : '환자'}: ${r.text}`).join('\n');
    const prompt = `${systemPrompt}\n${historyText}\n의사: ${userMessage}\n환자:`;

    // Call Google Generative API (Generative Language) - text generation
    const apiKey = process.env.GENAI_API_KEY;
    if (!apiKey) {
      console.error('GENAI_API_KEY not configured');
      return res.status(500).json({ error: 'GENAI_API_KEY not configured' });
    }

    // Google Generative AI REST API direct call (using global fetch available in Node.js 18+)
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
    
    console.log(`[generate.js] Calling Google API for case: ${caseId}`);
    
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    
    console.log(`[generate.js] API response status: ${resp.status}`);
    
    if (!resp.ok) {
      console.error(`API error: ${resp.status} ${resp.statusText}`);
      const errorText = await resp.text();
      console.error('Error response:', errorText);
      return res.status(resp.status).json({ error: 'LLM API error', detail: errorText });
    }
    
    const data = await resp.json();
    console.log('[generate.js] API response received, parsing...');
    
    // Extract text from response
    // Response shape: { candidates: [{ content: { parts: [{ text: '...' }] } }] }
    let reply = '';
    if (data?.candidates && data.candidates.length > 0) {
      const candidate = data.candidates[0];
      if (candidate?.content?.parts && candidate.content.parts.length > 0) {
        reply = candidate.content.parts[0].text || '';
      }
    }
    
    if (!reply) {
      console.warn('No reply text extracted from LLM response');
      console.warn('Full response:', JSON.stringify(data));
      return res.status(500).json({ error: 'No response from LLM', detail: JSON.stringify(data) });
    }
    
    console.log(`[generate.js] Successfully generated reply: ${reply.substring(0, 50)}...`);
    return res.json({ text: reply, cached: false });
    
  } catch (err) {
    console.error('server error', err.message);
    console.error('Full error:', err);
    return res.status(500).json({ error: 'server error', detail: err.message });
  }
};
