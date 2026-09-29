const core = require("./_lib/puzzle-core");
const { readFiles } = require("./_lib/github");
const { protect } = require("./_lib/auth");

// Current puzzle count/latest, read from GitHub (the deployed copy can lag by a few seconds).
module.exports = protect(async (req, res) => {
  const files = await readFiles(["puzzles.js"]);
  const P = core.parsePuzzles(files["puzzles.js"]);
  res.status(200).json({ ok: true, today: core.today(), total: core.totalCount(P), latest: P.DATED[0] });
});
