const { isAuthed } = require("../lib/auth");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const configured = !!(process.env.STUDIO_PASSWORD && process.env.GITHUB_TOKEN);
  res.status(200).json({ ok: true, configured, authed: configured && isAuthed(req) });
};
