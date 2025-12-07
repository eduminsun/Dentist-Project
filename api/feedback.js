// Feedback API with Redis caching (permanent storage)

const feedbackCache = new Map();

// Redis 설정
const UPSTASH_REST_URL = process.env.UPSTASH_REST_URL;
const UPSTASH_REST_TOKEN = process.env.UPSTASH_REST_TOKEN;

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
    
    const apiKey1 = process.env.GENAI_API_KEY;
    const apiKey2 = process.env.GENAI_API_KEY_2 || apiKey1;
    const selectedKey = userMessages.length % 2 === 0 ? apiKey1 : apiKey2;
    
    if (!selectedKey) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    const prompt = `치과 진료 5단계로 평가:
1. 인사 및 환자 확인
2. 방문 이유 확인
3. 정보 수집 및 공감
4. 치료 계획 설명
5. 진료 마무리

의사 발언:
${userMessages}

JSON으로 응답 (5개 항목만):
{"feedbacks": [{"stage": "1단계", "done": true, "text": "한 줄 평가"}]}`;

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
    
    // JSON 추출
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const feedbackData = jsonMatch ? JSON.parse(jsonMatch[0]) : { feedbacks: [] };

    // 4단계: 캐시에 저장
    feedbackCache.set(cacheKey, feedbackData.feedbacks);
    await setToRedis(cacheKey, feedbackData.feedbacks);

    return res.json({ 
      feedbacks: feedbackData.feedbacks, 
      cached: false
    });

  } catch (err) {
    console.error('[ERROR]', err.message);
    return res.status(500).json({ error: 'Server error', detail: err.message });
  }
};
