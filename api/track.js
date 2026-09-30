// Public endpoint: the game reports anonymous play events here.
// A player is only a random id kept in their browser; nothing personal is sent or stored.
const redis = require("./_lib/redis");

const KEEP = 60 * 60 * 24 * 400; // daily keys expire after ~13 months
const EVENTS = new Set(["start", "group", "wrong", "won", "revealed"]);

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).end();
  if (!redis.configured()) return res.status(204).end();

  const b = req.body || {};
  const pid = String(b.pid || "");
  const n = Number(b.n);
  const e = String(b.e || "");
  if (!/^[a-z0-9-]{8,40}$/.test(pid) || !Number.isInteger(n) || n < 1 || n > 100000 || !EVENTS.has(e)) {
    return res.status(400).end();
  }
  const d = b.d || {};
  const day = redis.dayKey();
  const cmds = [
    ["SADD", `d:${day}:players`, pid], ["EXPIRE", `d:${day}:players`, KEEP],
    ["SADD", "puzzles", String(n)],
  ];

  try {
    if (e === "start") {
      cmds.push(["SADD", `p:${n}:tried`, pid], ["SADD", `d:${day}:starts`, `${n}:${pid}`], ["EXPIRE", `d:${day}:starts`, KEEP]);
    } else if (e === "group") {
      const lvl = Number(d.lvl);
      if (![0, 1, 2, 3].includes(lvl)) return res.status(400).end();
      cmds.push(["SADD", `p:${n}:g${lvl}`, pid]);
    } else if (e === "wrong") {
      const key = String(d.key || "");
      if (!/^\d{1,2}(,\d{1,2}){3}$/.test(key)) return res.status(400).end();
      cmds.push(["ZINCRBY", `p:${n}:wrong`, 1, key]);
    } else if (e === "won" || e === "revealed") {
      // Count each player's result once; mistakes are added only the first time.
      const set = e === "won" ? `p:${n}:won` : `p:${n}:rev`;
      const [isNew] = await redis.pipeline([["SADD", set, pid]]);
      if (isNew) {
        const mistakes = Math.max(0, Math.min(99, Number(d.mistakes) || 0));
        if (e === "won") {
          cmds.push(["HINCRBY", `p:${n}:m`, "mistakes", mistakes], ["SADD", `d:${day}:wins`, `${n}:${pid}`], ["EXPIRE", `d:${day}:wins`, KEEP]);
          if (mistakes === 0) cmds.push(["HINCRBY", `p:${n}:m`, "perfect", 1]);
        } else {
          cmds.push(["SADD", `d:${day}:reveals`, `${n}:${pid}`], ["EXPIRE", `d:${day}:reveals`, KEEP]);
        }
      }
    }
    await redis.pipeline(cmds);
    res.status(204).end();
  } catch (err) {
    res.status(500).end();
  }
};
