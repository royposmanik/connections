// Shared handler for api/create and api/link: add a puzzle by committing both data files to GitHub.
const core = require("./puzzle-core");
const { updateFiles } = require("./github");
const { protect } = require("./auth");

module.exports = (kind) => protect(async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });
  const body = req.body || {};
  const result = await updateFiles(
    ["puzzles.js", "games.js"],
    async (files) => {
      const { id, game } = await core.resolveRequest(kind, body, core.allIds(core.parsePuzzles(files["puzzles.js"])));
      const out = core.addPuzzle(files["puzzles.js"], files["games.js"], body.date, id, game);
      return { changes: { "puzzles.js": out.puzzlesSrc, "games.js": out.gamesSrc }, result: { n: out.n, id, title: game.title } };
    },
    (r) => `Add puzzle #${r.n} (${body.date}) from the online studio`
  );
  res.status(200).json({ ok: true, ...result });
});
