// Feedback API with Redis caching (permanent storage)

const feedbackCache = new Map();

// Redis 설정
const UPSTASH_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

function getCacheKey(doctorStatements) {
  const normalized = (doctorStatements || '').trim().replace(/\s+/g, ' ');
  return `feedback:${normalized.substring(0, 100)}`;
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
      console.log('[REDIS_HIT] Found cached feedback');
      return JSON.parse(data.result);
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
        value: JSON.stringify(value),
        ex: -1 // 영구 저장
      })
    });
    console.log('[REDIS_SET] Cached feedback (permanent)');
  } catch (err) {
    console.error('[REDIS_SET_ERROR]', err.message);
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { conversationHistory } = req.body;

    if (!conversationHistory || conversationHistory.length === 0) {
      return res.status(400).json({ error: 'No conversation history' });
    }

    // 의사 발언만 추출 (최근 10개)
    const userMessages = conversationHistory
      .filter(msg => msg.role === 'user')
      .slice(-10)
      .map((msg, idx) => `${idx + 1}. ${msg.text}`)
      .join('\n');
    
    const cacheKey = getCacheKey(userMessages);
    
    console.log(`[feedback.js] Feedback request with ${userMessages.split('\n').length} messages`);

    // 1단계: 메모리 캐시 확인
    if (feedbackCache.has(cacheKey)) {
      console.log('[CACHE_HIT_MEMORY] Returning cached feedback');
      return res.json({ 
        feedbacks: feedbackCache.get(cacheKey), 
        cached: true,
        cacheType: 'memory'
      });
    }

    // 2단계: Redis 캐시 확인
    const redisFeedback = await getFromRedis(cacheKey);
    if (redisFeedback) {
      feedbackCache.set(cacheKey, redisFeedback);
      return res.json({ 
        feedbacks: redisFeedback, 
        cached: true,
        cacheType: 'redis'
      });
    }

    // 3단계: API 호출
    console.log('[API_CALL] Generating feedback...');
    
  const selectedKey = process.env.GENAI_API_KEY; // always use paid primary key
    
    if (!selectedKey) {
      return res.status(500).json({ error: 'API key not configured' });
    }

  const prompt = `다음 의사 발언을 바탕으로 치과 진료 5단계를 평가하세요.
반드시 JSON만 출력하고, 추가 텍스트/설명은 금지합니다.
출력 스키마:
{"feedbacks": [{"stage": "1단계", "done": true, "text": "한 줄 평가"}]}
규칙:
- 5개 항목만 포함(1~5단계)
- "stage"는 "1단계", "2단계", ... 형식
- "done"은 true/false
- "text"는 한 줄 설명

의사 발언:
${userMessages}`;

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + selectedKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 256 }
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
  const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  console.log('[FEEDBACK_RAW_TEXT]', (responseText || '').slice(0, 300));
    
    // JSON 추출 (보호)
    let feedbacks = [];
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed.feedbacks)) feedbacks = parsed.feedbacks;
      }
    } catch (e) {
      console.error('[FEEDBACK_PARSE_ERROR]', e.message);
      feedbacks = [];
    }

    // Fallback: ensure 5 stages exist if empty
    if (!Array.isArray(feedbacks) || feedbacks.length === 0) {
      feedbacks = [1,2,3,4,5].map(n => ({ stage: `${n}단계`, done: false, text: '' }));
    }

    // 4단계: 캐시에 저장
    feedbackCache.set(cacheKey, feedbacks);
    await setToRedis(cacheKey, feedbacks);

    return res.json({ 
      feedbacks, 
      cached: false
    });

  } catch (err) {
    console.error('[ERROR]', err.message);
    return res.status(500).json({ error: 'Server error', detail: err.message });
  }
};
