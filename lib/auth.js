// Password login for the online studio. The session is a signed, expiring cookie;
// changing STUDIO_PASSWORD in Vercel logs out every existing session.
const crypto = require("crypto");

const COOKIE = "studio_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const secret = () => process.env.STUDIO_PASSWORD || "";
const sign = (v) => crypto.createHmac("sha256", "studio:" + secret()).update(v).digest("base64url");
const sha = (v) => crypto.createHash("sha256").update(String(v)).digest();

function checkPassword(password) {
  if (!secret()) return false;
  return crypto.timingSafeEqual(sha(password), sha(secret()));
}

function sessionCookie() {
  const exp = String(Date.now() + MAX_AGE * 1000);
  return `${COOKIE}=${exp}.${sign(exp)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${MAX_AGE}`;
}
const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

function isAuthed(req) {
  if (!secret()) return false;
  const raw = (req.headers.cookie || "").split(/;\s*/).find((c) => c.startsWith(COOKIE + "="));
  if (!raw) return false;
  const [exp, sig] = raw.slice(COOKIE.length + 1).split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const good = Buffer.from(sign(exp));
  const got = Buffer.from(sig);
  return good.length === got.length && crypto.timingSafeEqual(good, got);
}

// Wraps an API handler: JSON only, configured, logged in.
function protect(handler) {
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!process.env.STUDIO_PASSWORD || !process.env.GITHUB_TOKEN) {
      return res.status(500).json({ ok: false, error: "studio is not configured" });
    }
    if (!isAuthed(req)) return res.status(401).json({ ok: false, error: "not logged in" });
    try {
      await handler(req, res);
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  };
}

module.exports = { checkPassword, sessionCookie, clearCookie, isAuthed, protect };
