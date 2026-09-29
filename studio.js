// Puzzle Studio: a small local web app for adding puzzles to the site.
// Run: double-click puzzle-studio.cmd (or `node studio.js`), then use the page that opens.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const T = require("./puzzle-tools");

const PORT = 5178;
const dir = __dirname;
const SITE_FILES = { "index.html": "text/html", "puzzles.js": "text/javascript", "games.js": "text/javascript" };

function send(res, status, body, type = "application/json") {
  res.writeHead(status, { "Content-Type": type + "; charset=utf-8", "Cache-Control": "no-store" });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on("end", () => { try { resolve(JSON.parse(data || "{}")); } catch (e) { reject(new Error("bad request")); } });
  });
}

function info() {
  const P = T.loadPuzzles();
  return { today: T.today(), total: P.ARCHIVE.length + P.DATED.length, latest: P.DATED[0] };
}

async function handleApi(req, res, route) {
  try {
    const body = await readBody(req);
    let id, game;
    if (route === "link") {
      id = T.extractSwellgarfoId(body.link);
      if (!id) throw new Error("that doesn't look like a swellgarfo link");
      if (T.allIds(T.loadPuzzles()).includes(id)) throw new Error("this puzzle is already on the site");
      game = await T.fetchSwellgarfo(id);
    } else {
      game = T.buildOwnGame(body);
      id = T.newOwnId();
    }
    const n = T.insertDated(body.date, id);
    const games = T.loadGames();
    games[id] = game;
    T.writeGames(games);
    console.log(`Added puzzle #${n} (${body.date})`);
    send(res, 200, { ok: true, n, id, groups: game.groups });
  } catch (e) {
    send(res, 400, { ok: false, error: e.message });
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (req.method === "POST" && url.pathname === "/api/link") return handleApi(req, res, "link");
  if (req.method === "POST" && url.pathname === "/api/create") return handleApi(req, res, "create");
  if (url.pathname === "/api/info") return send(res, 200, info());
  if (url.pathname === "/") return send(res, 200, fs.readFileSync(path.join(dir, "studio.html"), "utf8"), "text/html");
  const m = url.pathname.match(/^\/site\/(.*)$/);
  if (m) {
    const file = m[1] || "index.html";
    if (SITE_FILES[file]) return send(res, 200, fs.readFileSync(path.join(dir, file), "utf8"), SITE_FILES[file]);
  }
  send(res, 404, "not found", "text/plain");
});

server.listen(PORT, "127.0.0.1", () => {
  const url = `http://localhost:${PORT}/`;
  console.log(`Puzzle Studio is running at ${url}`);
  console.log("Keep this window open while you work. Close it when you're done.");
  if (!process.argv.includes("--no-open")) exec(`start "" "${url}"`);
});
server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.log("Puzzle Studio is already running; opening it.");
    exec(`start "" "http://localhost:${PORT}/"`);
  } else throw e;
});
