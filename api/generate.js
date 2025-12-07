// Vercel Serverless function to proxy requests to Google Generative AI (Gemini) REST API
// Expects environment variables: GENAI_API_KEY, GENAI_API_KEY_2, UPSTASH_REST_URL, UPSTASH_REST_TOKEN

const responseCache = new Map();

// Redis 설정
const UPSTASH_REST_URL = process.env.UPSTASH_REST_URL;
const UPSTASH_REST_TOKEN = process.env.UPSTASH_REST_TOKEN;

function getCacheKey(caseId, userMessage) {
  const normalized = (userMessage || '').trim().replace(/\s+/g, ' ');
  return `generate:${caseId}|${normalized}`;
}

// Redis에서 캐시 조회
async function getFromRedis(key) {
  if (!UPSTASH_REST_URL || !UPSTASH_REST_TOKEN) return null;
  
  try {
    const response = await fetch(`${UPSTASH_REST_URL}/get/${encodeURIComponent(key)}`, {
      headers: { 'Authorization': `Bearer ${UPSTASH_REST_TOKEN}` }
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data.result) {
      console.log('[REDIS_HIT] Found cached response');
      return data.result;
    }
    return null;
  } catch (err) {
    console.error('[REDIS_GET_ERROR]', err.message);
    return null;
  }
}

// Redis에 캐시 저장 (영구 저장)
async function setToRedis(key, value) {
  if (!UPSTASH_REST_URL || !UPSTASH_REST_TOKEN) return;
  
  try {
    await fetch(`${UPSTASH_REST_URL}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${UPSTASH_REST_TOKEN}` },
      body: JSON.stringify({
        value: value,
        ex: -1 // 영구 저장
      })
    });
    console.log('[REDIS_SET] Cached response (permanent)');
  } catch (err) {
    console.error('[REDIS_SET_ERROR]', err.message);
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const { caseId, userMessage } = body;

  if (!userMessage) {
    return res.status(400).json({ error: 'userMessage required' });
  }

  const cacheKey = getCacheKey(caseId, userMessage);
  const startTime = Date.now();

  try {
    // 1단계: 메모리 캐시 확인 (가장 빠름)
    if (responseCache.has(cacheKey)) {
      console.log('[CACHE_HIT_MEMORY] Returning cached response');
      return res.json({ 
        text: responseCache.get(cacheKey), 
        cached: true,
        cacheType: 'memory',
        responseTime: Date.now() - startTime
      });
    }

    // 2단계: Redis 캐시 확인 (빠름)
    const redisCache = await getFromRedis(cacheKey);
    if (redisCache) {
      responseCache.set(cacheKey, redisCache); // 메모리에도 저장
      return res.json({ 
        text: redisCache, 
        cached: true,
        cacheType: 'redis',
        responseTime: Date.now() - startTime
      });
    }

    // 3단계: API 호출 (시간 소요)
    console.log('[API_CALL] Generating patient response...');
    
    // API 키 로드 밸런싱
    const apiKey1 = process.env.GENAI_API_KEY;
    const apiKey2 = process.env.GENAI_API_KEY_2 || apiKey1;
    const selectedKey = userMessage.length % 2 === 0 ? apiKey1 : apiKey2;
    
    if (!selectedKey) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    // 프롬프트: 의사의 발언에 대해 환자가 응답
    let patientPersona = '';
    
    if (caseId === 'jo-minseon') {
      patientPersona = '당신은 민감한 환자 조민선입니다. 초반에는 발치를 하고 싶지 않아 합니다.';
    } else if (caseId === 'oh-owan') {
      patientPersona = '당신은 환자 오완의 어머니(보호자)입니다. 아이의 건강을 걱정하고 있습니다.';
    } else if (caseId === 'lee-jiwon') {
      patientPersona = '당신은 불안한 환자 이지원입니다. 증상에 대해 자세히 설명하는 편입니다.';
    }

    // 진료 마무리 단계 가이드 추가
    let stepGuide = '';
    if (body.currentStep === 4) {
      stepGuide = ' 진료 마무리 단계입니다. 의사의 설명에 감사하며 안도하는 느낌으로 "감사합니다"나 "도움이 됐습니다"라는 식의 긍정적인 반응을 보여주세요.';
    }

    const prompt = `당신은 치과 환자입니다. ${patientPersona}${stepGuide}

의사의 발언: "${userMessage}"

환자의 응답만 한 문장으로 자연스럽게 제시하세요.`;

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + selectedKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 180 }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || response.statusText;
      
      if (response.status === 429) {
        console.error('[ALERT] Rate limit exceeded (429)');
        return res.status(429).json({ error: 'Rate limit exceeded', detail: errorMsg });
      }
      
      if (response.status === 403) {
        console.error('[ALERT] Forbidden (403)', errorMsg);
        return res.status(403).json({ error: 'Forbidden', detail: errorMsg });
      }
      
      console.error(`[ALERT] API error (${response.status}):`, errorMsg);
      return res.status(response.status).json({ error: 'API error', detail: errorMsg });
    }

    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
    
    const usageData = data.usageMetadata || {};
    console.log(`[API_SUCCESS] Tokens - Input: ${usageData.inputTokens}, Output: ${usageData.outputTokens}`);

    // 4단계: 캐시에 저장 (메모리 + Redis)
    responseCache.set(cacheKey, reply);
    await setToRedis(cacheKey, reply);

    return res.json({ 
      text: reply, 
      cached: false,
      responseTime: Date.now() - startTime,
      tokensUsed: {
        input: usageData.inputTokens || 0,
        output: usageData.outputTokens || 0
      }
    });

  } catch (err) {
    console.error('[ERROR]', err.message);
    return res.status(500).json({ error: 'Server error', detail: err.message });
  }
};
