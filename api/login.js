const { checkPassword, sessionCookie } = require("../lib/auth");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });
  if (!process.env.STUDIO_PASSWORD) return res.status(500).json({ ok: false, error: "studio is not configured" });
  const password = (req.body && req.body.password) || "";
  if (!checkPassword(password)) {
    await new Promise((r) => setTimeout(r, 1000)); // slow down guessing
    return res.status(401).json({ ok: false, error: "wrong password" });
  }
  res.setHeader("Set-Cookie", sessionCookie());
  res.status(200).json({ ok: true });
};
