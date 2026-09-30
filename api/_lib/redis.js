// Minimal Upstash Redis client over its REST API (the Vercel Marketplace integration sets these env vars).
const url = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const configured = () => !!(url() && token());

// Runs several commands in one request; returns their results in order.
async function pipeline(commands) {
  const r = await fetch(`${url()}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
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
