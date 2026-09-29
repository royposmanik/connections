// One-time setup for the online studio: asks for a password and a GitHub token,
// stores them as Vercel environment variables, and redeploys. Secrets are only typed
// here and sent to Vercel; they are never printed or written to disk.
const { execSync, exec } = require("child_process");
const readline = require("readline");

const REPO = "royposmanik/connections";
const SITE = "https://connections-roy.vercel.app";
const TOKEN_URL = "https://github.com/settings/personal-access-tokens/new"
  + "?name=4x4+studio&description=Lets+the+4x4+online+studio+add+puzzles"
  + "&target_name=royposmanik&expires_in=365&contents=write";

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s); else rl.output.write("*".repeat(s.length ? 1 : 0)); };
    }
    rl.question(question, (answer) => { rl.close(); if (hidden) process.stdout.write("\n"); resolve(answer.trim()); });
  });
}

// The Vercel CLI isn't always on PATH (e.g. in PowerShell), so use its install location when present.
// Some terminals also point APPDATA elsewhere, which hides the saved Vercel login; check the usual
// Roaming folder too and pass the login folder explicitly.
const path = require("path");
const fs = require("fs");
const os = require("os");
const roamingDirs = [...new Set([process.env.APPDATA, path.join(os.homedir(), "AppData", "Roaming")].filter(Boolean))];
const find = (sub) => roamingDirs.map((d) => path.join(d, sub)).find((p) => fs.existsSync(p));
const VERCEL_CMD = find(path.join("npm", "vercel.cmd"));
const VERCEL_CONFIG = find(path.join("com.vercel.cli", "Data", "auth.json"));
const VERCEL = (VERCEL_CMD ? `"${VERCEL_CMD}"` : "npx -y vercel")
  + (VERCEL_CONFIG ? ` --global-config "${path.dirname(VERCEL_CONFIG)}"` : "");

// args are fixed strings from this file, never user input.
const vercel = (args, input) =>
  execSync(`${VERCEL} ${args.join(" ")}`, { input, encoding: "utf8", stdio: [input == null ? "ignore" : "pipe", "pipe", "pipe"] });

function setEnv(name, value) {
  try { vercel(["env", "rm", name, "production", "--yes"]); } catch (e) { /* not set yet */ }
  vercel(["env", "add", name, "production"], value);
}

async function checkToken(token) {
  const h = { Authorization: `Bearer ${token}`, "User-Agent": "4x4-setup", Accept: "application/vnd.github+json" };
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/puzzles.js`, { headers: h });
  return r.ok;
}

(async () => {
  console.log("=== 4x4 online studio: one-time setup ===\n");

  // 1. Password
  let pw;
  for (;;) {
    pw = await ask("Choose a studio password (at least 10 characters): ", { hidden: true });
    if (pw.length < 10) { console.log("  Too short, try again.\n"); continue; }
    const again = await ask("Type it again: ", { hidden: true });
    if (again !== pw) { console.log("  The two didn't match, try again.\n"); continue; }
    break;
  }

  // 2. GitHub token
  console.log("\nNow a GitHub key. A browser page is opening with most fields filled in.");
  console.log("On that page:");
  console.log("  - Repository access: choose 'Only select repositories' -> royposmanik/connections");
  console.log("  - Permissions: make sure 'Contents' is 'Read and write'");
  console.log("  - Click 'Generate token' at the bottom, then copy the key (starts with github_pat_)\n");
  exec(`start "" "${TOKEN_URL}"`);
  let token;
  for (;;) {
    token = await ask("Paste the key here (right-click to paste): ", { hidden: true });
    if (!token) continue;
    process.stdout.write("  Checking the key... ");
    if (await checkToken(token)) { console.log("OK"); break; }
    console.log("it can't read the connections repository. Check 'Repository access' and try again.\n");
  }

  // 3. Save to Vercel and redeploy
  try {
    process.stdout.write("\nSaving to Vercel... ");
    setEnv("STUDIO_PASSWORD", pw);
    setEnv("GITHUB_TOKEN", token);
    console.log("OK");
    process.stdout.write("Republishing the site (about a minute)... ");
    vercel(["deploy", "--prod", "--yes"]);
    console.log("OK");
  } catch (e) {
    console.log("\n\nSomething went wrong talking to Vercel:\n" + String(e.stderr || e.message).split("\n").slice(-5).join("\n"));
    console.log("Nothing secret was saved to disk. You can run this setup again.");
    return;
  }

  const s = await (await fetch(`${SITE}/api/session`)).json().catch(() => ({}));
  console.log(s.configured ? "\nAll set! Opening the studio. Log in with your new password." : "\nSaved, but the site doesn't see it yet. Wait a minute and open " + SITE + "/studio");
  exec(`start "" "${SITE}/studio"`);
})();
