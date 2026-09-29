const { clearCookie } = require("../lib/auth");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Set-Cookie", clearCookie());
  res.status(200).json({ ok: true });
};
