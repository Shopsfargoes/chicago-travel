// In-memory limiter: fine for a demo. Serverless instances don't share memory,
// so swap for Upstash/Vercel KV before real traffic.
const hits = new Map();
export function rateLimit(req, max = 20, windowMs = 60_000) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'local';
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length <= max;
}
