// Public: aggregate results for one puzzle (no per-player data), shown on the home page.
// Cached at the edge for a minute so page views don't each hit the database.
const redis = require("./_lib/redis");

module.exports = async (req, res) => {
  const n = Number((req.query && req.query.n) || new URL(req.url, "http://x").searchParams.get("n"));
  if (!Number.isInteger(n) || n < 1 || n > 100000) return res.status(400).json({ ok: false });
  if (!redis.configured()) return res.status(200).json({ ok: true, configured: false });

  try {
    const r = await redis.pipeline([
      ["SCARD", `p:${n}:tried`], ["SCARD", `p:${n}:won`], ["SCARD", `p:${n}:rev`],
      ["SCARD", `p:${n}:g0`], ["SCARD", `p:${n}:g1`], ["SCARD", `p:${n}:g2`], ["SCARD", `p:${n}:g3`],
      ["HGETALL", `p:${n}:m`],
    ]);
    const m = {};
    for (let i = 0; i < (r[7] || []).length; i += 2) m[r[7][i]] = Number(r[7][i + 1]);
    const tried = Math.max(r[0], r[1] + r[2]);
    const groups = [r[3], r[4], r[5], r[6]];
    // Hardest = the group the fewest players found (only meaningful once someone played).
    const hardest = tried ? [0, 1, 2, 3].reduce((a, b) => (groups[b] < groups[a] ? b : a), 3) : null;
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    res.status(200).json({
      ok: true, configured: true, n, tried, won: r[1],
      avgMistakes: r[1] ? (m.mistakes || 0) / r[1] : null, hardest,
    });
  } catch (e) {
    res.status(500).json({ ok: false });
  }
};
