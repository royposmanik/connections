// Reads and commits the site's data files through the GitHub API.
// Every commit to main triggers a Vercel redeploy, which is how the online studio publishes.
const REPO = process.env.GITHUB_REPO || "royposmanik/connections";
const BRANCH = process.env.GITHUB_BRANCH || "main";

async function gh(path, { method = "GET", body, raw = false } = {}) {
  const r = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: raw ? "application/vnd.github.raw+json" : "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "4x4-studio",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    const err = new Error(`GitHub ${method} ${path}: ${r.status}`);
    err.status = r.status;
    throw err;
  }
  return raw ? r.text() : r.json();
}

const headSha = async () => (await gh(`/git/ref/heads/${BRANCH}`)).object.sha;

// Reads several files at one commit, so they are consistent with each other.
async function readFiles(paths) {
  const sha = await headSha();
  const out = { sha };
  for (const p of paths) out[p] = await gh(`/contents/${p}?ref=${sha}`, { raw: true });
  return out;
}

// Commits several files as a single commit on top of `parentSha`.
async function commitFiles(parentSha, files, message) {
  const parent = await gh(`/git/commits/${parentSha}`);
  const tree = await gh(`/git/trees`, {
    method: "POST",
    body: {
      base_tree: parent.tree.sha,
      tree: Object.entries(files).map(([path, content]) => ({ path, mode: "100644", type: "blob", content })),
    },
  });
  const commit = await gh(`/git/commits`, { method: "POST", body: { message, tree: tree.sha, parents: [parentSha] } });
  // Fast-forward only: if someone pushed in between, this fails and the caller retries on the new head.
  await gh(`/git/refs/heads/${BRANCH}`, { method: "PATCH", body: { sha: commit.sha, force: false } });
  return commit.sha;
}

// Read-modify-commit with one retry if main moved meanwhile.
async function updateFiles(paths, modify, message) {
  for (let attempt = 0; ; attempt++) {
    const files = await readFiles(paths);
    const { changes, result } = await modify(files);
    try {
      await commitFiles(files.sha, changes, typeof message === "function" ? message(result) : message);
      return result;
    } catch (e) {
      if (attempt >= 1 || e.status !== 422) throw e;
    }
  }
}

module.exports = { readFiles, updateFiles, REPO, BRANCH };
