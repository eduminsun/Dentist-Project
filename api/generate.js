// Vercel Serverless function to proxy requests to Google Generative AI (Gemini) REST API
// Expects environment variable: GENAI_API_KEY

const fetch = require('node-fetch');
const crypto = require('crypto');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const body = req.body || {};
  const { caseId, userMessage, recent = [] } = body;
  if (!userMessage) return res.status(400).json({ error: 'userMessage required' });

  // simple normalization and key generation for caching (optional later)
  const norm = (s) => (s || '').toString().trim().toLowerCase();
  const keySource = `${caseId}|${recent.slice(-3).map(r => norm(r.text)).join('|')}|${norm(userMessage)}`;
  const cacheKey = 'reply:' + crypto.createHash('sha256').update(keySource).digest('hex');

  try {
    // Build prompts: small system instruction + conversation
    const systemPrompt = `You are a simulated dental patient. Keep replies short (1-2 sentences) in Korean and follow the persona for case: ${caseId}.`;
    const historyText = recent.map(r => `${r.role === 'user' ? '의사' : '환자'}: ${r.text}`).join('\n');
    const prompt = `${systemPrompt}\n${historyText}\n의사: ${userMessage}\n환자:`;

    // Call Google Generative API (Generative Language) - text generation
    // This example uses the text-bison-001 model endpoint
    const apiKey = process.env.GENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'GENAI_API_KEY not configured' });

    // --- Upstash cache check (exact-match)
    const upstashUrl = process.env.UPSTASH_REST_URL;
    const upstashToken = process.env.UPSTASH_REST_TOKEN;
    if (upstashUrl && upstashToken) {
      try {
        const getUrl = `${upstashUrl}/get/${cacheKey}`;
        const getResp = await fetch(getUrl, { headers: { Authorization: `Bearer ${upstashToken}` } });
        if (getResp.ok) {
          const getJson = await getResp.json();
          if (getJson?.result) {
            // cached value found
            return res.json({ text: getJson.result, cached: true });
          }
        }
      } catch (e) {
        console.warn('upstash get failed', e.message);
      }
    }

    const genResp = await fetch('https://us-central1-aiplatform.googleapis.com/v1/models/text-bison-001:generateText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        "prompt": {
          "text": prompt
        },
        "temperature": 0.6,
        "maxOutputTokens": 256
      })
    });

    if (!genResp.ok) {
      const text = await genResp.text();
      console.error('LLM error', genResp.status, text);
      return res.status(502).json({ error: 'LLM provider error', detail: text });
    }

    const genJson = await genResp.json();
    // Google Gen API response shape: { candidates: [{ content: '...' }], ... }
    const reply = (genJson?.candidates?.[0]?.content || '').trim();

    // store in Upstash (best-effort)
    if (upstashUrl && upstashToken && reply) {
      try {
        // set key
        const setUrl = `${upstashUrl}/set/${cacheKey}/${encodeURIComponent(reply)}`;
        await fetch(setUrl, { method: 'POST', headers: { Authorization: `Bearer ${upstashToken}` } });
        // set TTL (1 hour)
        const ttlUrl = `${upstashUrl}/expire/${cacheKey}/3600`;
        await fetch(ttlUrl, { method: 'POST', headers: { Authorization: `Bearer ${upstashToken}` } });
      } catch (e) {
        console.warn('upstash set failed', e.message);
      }
    }

    return res.json({ text: reply, cached: false });
  } catch (err) {
    console.error('server error', err);
    return res.status(500).json({ error: 'server error', detail: err.message });
  }
};
