// Studio-only: daily totals and per-puzzle results (who tried, solved, revealed, hardest group, common mistakes).
const redis = require("./_lib/redis");
const { isAuthed } = require("./_lib/auth");

const DAYS = 30;

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!isAuthed(req)) return res.status(401).json({ ok: false, error: "not logged in" });
  if (!redis.configured()) return res.status(200).json({ ok: true, configured: false });

  try {
    // Daily totals for the last DAYS days.
    const days = [...Array(DAYS)].map((_, i) => redis.dayKey(new Date(Date.now() - i * 864e5)));
    const dayRes = await redis.pipeline(days.flatMap((d) => [
      ["SCARD", `d:${d}:players`], ["SCARD", `d:${d}:starts`], ["SCARD", `d:${d}:wins`], ["SCARD", `d:${d}:reveals`],
    ]));
    const daily = days.map((day, i) => ({
      day, players: dayRes[i * 4], starts: dayRes[i * 4 + 1], wins: dayRes[i * 4 + 2], reveals: dayRes[i * 4 + 3],
    }));

    // Per-puzzle results for every puzzle that has any data.
    const nums = ((await redis.pipeline([["SMEMBERS", "puzzles"]]))[0] || []).map(Number).sort((a, b) => b - a);
    const PER = 9;
    const pRes = nums.length ? await redis.pipeline(nums.flatMap((n) => [
      ["SCARD", `p:${n}:tried`], ["SCARD", `p:${n}:won`], ["SCARD", `p:${n}:rev`],
      ["SCARD", `p:${n}:g0`], ["SCARD", `p:${n}:g1`], ["SCARD", `p:${n}:g2`], ["SCARD", `p:${n}:g3`],
      ["HGETALL", `p:${n}:m`], ["ZREVRANGE", `p:${n}:wrong`, 0, 2, "WITHSCORES"],
    ])) : [];
    const puzzles = nums.map((n, i) => {
      const r = pRes.slice(i * PER, i * PER + PER);
      const m = {};
      for (let j = 0; j < (r[7] || []).length; j += 2) m[r[7][j]] = Number(r[7][j + 1]);
      const wrong = [];
      for (let j = 0; j < (r[8] || []).length; j += 2) wrong.push({ key: r[8][j], count: Number(r[8][j + 1]) });
      return {
        n, tried: r[0], won: r[1], revealed: r[2], groups: [r[3], r[4], r[5], r[6]],
        mistakesSum: m.mistakes || 0, perfect: m.perfect || 0, wrong,
      };
    });

    res.status(200).json({ ok: true, configured: true, daily, puzzles });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
