// Minimal Upstash Redis client over its REST API (the Vercel Marketplace integration sets these env vars).
const url = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const configured = () => !!(url() && token());

// The database may be shared with other projects, so every key gets this prefix.
// All commands used here take the key as their first argument.
const PREFIX = process.env.STATS_KEY_PREFIX || "4x4:";

// Runs several commands in one request; returns their results in order.
async function pipeline(commands) {
  const prefixed = commands.map(([cmd, key, ...rest]) => [cmd, PREFIX + key, ...rest]);
  const r = await fetch(`${url()}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: JSON.stringify(prefixed),
  });
  if (!r.ok) throw new Error(`redis ${r.status}`);
  const out = await r.json();
  return out.map((x) => {
    if (x.error) throw new Error("redis: " + x.error);
    return x.result;
  });
}

// Calendar day in Israel, as YYYY-MM-DD (servers run in UTC).
function dayKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(date);
}

module.exports = { configured, pipeline, dayKey };
