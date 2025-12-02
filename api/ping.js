// Simple health endpoint to verify serverless routing
module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({ ok: true, path: '/api/ping' });
};
