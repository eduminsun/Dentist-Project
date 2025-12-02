// Vercel Serverless function to proxy requests to Google Generative AI (Gemini) REST API
// Expects environment variable: GENAI_API_KEY

const fetch = require('node-fetch');
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
    // This example uses the text-bison-001 model endpoint
    const apiKey = process.env.GENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'GENAI_API_KEY not configured' });

  // Upstash caching disabled for now. To re-enable, uncomment the block below
  // and set UPSTASH_REST_URL and UPSTASH_REST_TOKEN in your environment.
  //
  // const upstashUrl = process.env.UPSTASH_REST_URL;
  // const upstashToken = process.env.UPSTASH_REST_TOKEN;
  // if (upstashUrl && upstashToken) {
  //   try {
  //     const getUrl = `${upstashUrl}/get/${cacheKey}`;
  //     const getResp = await fetch(getUrl, { headers: { Authorization: `Bearer ${upstashToken}` } });
  //     if (getResp.ok) {
  //       const getJson = await getResp.json();
  //       if (getJson?.result) {
  //         return res.json({ text: getJson.result, cached: true });
  //       }
  //     }
  //   } catch (e) {
  //     console.warn('upstash get failed', e.message);
  //   }
  // }

    // Use official @google/genai client if available (preferred)
    let reply = '';
    try {
      // Lazy-require so local dev without package doesn't crash immediately
      const { GoogleGenAI } = require('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      
      // Use the correct generateContent API
      const resp = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
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
      });
      
      // Extract text from response
      // Response shape: { candidates: [{ content: { parts: [{ text: '...' }] } }] }
      if (resp?.candidates && resp.candidates.length > 0) {
        const candidate = resp.candidates[0];
        if (candidate?.content?.parts && candidate.content.parts.length > 0) {
          reply = candidate.content.parts[0].text || '';
        }
      }
      
      // Fallback: if response structure is different, try common patterns
      if (!reply && resp?.text) reply = resp.text;
      if (!reply && resp?.content) reply = resp.content.toString();
      
    } catch (e) {
      console.error('genai client error', e);
      return res.status(502).json({ error: 'LLM provider error', detail: e.message });
    }

  // Upstash store disabled. Re-enable by uncommenting and ensuring
  // UPSTASH_REST_URL and UPSTASH_REST_TOKEN are set in environment.
  // if (upstashUrl && upstashToken && reply) {
  //   try {
  //     const setUrl = `${upstashUrl}/set/${cacheKey}/${encodeURIComponent(reply)}`;
  //     await fetch(setUrl, { method: 'POST', headers: { Authorization: `Bearer ${upstashToken}` } });
  //     const ttlUrl = `${upstashUrl}/expire/${cacheKey}/3600`;
  //     await fetch(ttlUrl, { method: 'POST', headers: { Authorization: `Bearer ${upstashToken}` } });
  //   } catch (e) {
  //     console.warn('upstash set failed', e.message);
  //   }
  // }

    return res.json({ text: reply, cached: false });
  } catch (err) {
    console.error('server error', err);
    return res.status(500).json({ error: 'server error', detail: err.message });
  }
};
