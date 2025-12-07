// api/sync.js - 모든 사용자 간 상태 동기화
// GET /api/sync?sessionId=xxx - 현재 공유 상태 조회
// POST /api/sync - 상태 업데이트

const kvUrl = process.env.KV_REST_API_URL;
const kvToken = process.env.KV_REST_API_TOKEN;

module.exports = async (req, res) => {
  if (!kvUrl || !kvToken) {
    return res.status(500).json({ error: 'KV store not configured' });
  }

  // GET: 현재 상태 조회 (모든 사용자가 공유)
  if (req.method === 'GET') {
    try {
      const sessionId = req.query.sessionId || 'default';
      const url = `${kvUrl}/get/sync:${sessionId}`;
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${kvToken}` }
      });
      
      if (!response.ok) {
        console.warn(`KV GET failed: ${response.status}`);
        return res.json({ data: null, timestamp: Date.now() });
      }
      
      const data = await response.json();
      console.log(`[sync.js] Retrieved shared state for ${sessionId}`);
      return res.json({ 
        data: data.result, 
        timestamp: Date.now() 
      });
    } catch (err) {
      console.error('[sync.js] GET error:', err.message);
      return res.status(500).json({ error: 'Sync failed', detail: err.message });
    }
  }

  // POST: 상태 업데이트 (모든 사용자에게 공유됨)
  if (req.method === 'POST') {
    try {
      const { sessionId = 'default', data, ttl = 3600 } = req.body;
      
      if (!data) {
        return res.status(400).json({ error: 'data required' });
      }

      // KV에 저장 (TTL: 1시간)
      const url = `${kvUrl}/set/sync:${sessionId}`;
      const setResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${kvToken}` },
        body: JSON.stringify({ 
          value: JSON.stringify(data),
          ex: ttl  // TTL in seconds
        })
      });

      if (!setResponse.ok) {
        const errorText = await setResponse.text();
        console.error(`[sync.js] KV SET failed: ${errorText}`);
        return res.status(500).json({ error: 'Failed to save state' });
      }

      console.log(`[sync.js] Updated shared state for ${sessionId}`);
      return res.json({ 
        success: true, 
        sessionId,
        timestamp: Date.now()
      });
    } catch (err) {
      console.error('[sync.js] POST error:', err.message);
      return res.status(500).json({ error: 'Sync failed', detail: err.message });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
};
