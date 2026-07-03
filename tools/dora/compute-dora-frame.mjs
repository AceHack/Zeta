// compute-dora-frame — the DORA metrics writer for the org root site's dora.html.
//
// Computes ONE real frame from the Zeta repo's own git + GitHub PR data and prints it as
// JSON. This is the core the scheduled CI job runs (.github/workflows/dora-frame.yml); the
// job appends the frame to the pages repo's data/metrics-history.json and refreshes
// data/metrics.json, then commits. Same-origin static contract: the browser never calls the
// GitHub API — this CI step does, and Pages serves the resulting file (no tokens, no limits).
//
// Deterministic given the repo state + `now`: no rng, no ambient clock beyond the injected
// `--now` (defaults to the latest merge time so a scheduled run and a manual run agree).
//
// Usage:
//   node tools/dora/compute-dora-frame.mjs [--repo <owner/name>] [--now <iso>] [--window-hours 24]
//
// Requires: `gh` authenticated (repo read) and a git checkout with origin/main fetched.

import { execFileSync } from "node:child_process";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const repo = arg("repo", "Lucent-Financial-Group/Zeta");
const windowHours = Number(arg("window-hours", "24"));

function sh(cmd, args) {
  return execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

const parse = (s) => new Date(s.replace("Z", "+00:00"));

// Merged PRs (enough history to cover the window + lead-time context).
const mergedRaw = JSON.parse(
  sh("gh", ["pr", "list", "--repo", repo, "--state", "merged", "--limit", "400", "--json", "number,createdAt,mergedAt"]),
);
const openCount = JSON.parse(
  sh("gh", ["pr", "list", "--repo", repo, "--state", "open", "--limit", "400", "--json", "number"]),
).length;

// `now` defaults to the latest merge so scheduled + manual runs agree on the window.
const latestMerge = mergedRaw
  .map((p) => p.mergedAt)
  .filter(Boolean)
  .sort()
  .at(-1);
const now = parse(arg("now", latestMerge ?? new Date(0).toISOString()));
const within = (iso, hours) => iso && (now - parse(iso)) / 3.6e6 <= hours && parse(iso) <= now;

const merged24 = mergedRaw.filter((p) => within(p.mergedAt, windowHours));
const merged1 = mergedRaw.filter((p) => within(p.mergedAt, 1));
const leads = merged24
  .filter((p) => p.createdAt && p.mergedAt)
  .map((p) => (parse(p.mergedAt) - parse(p.createdAt)) / 6e4);
const avgLead = leads.length ? Math.round(leads.reduce((a, b) => a + b, 0) / leads.length) : 0;

// Commits on main within the window, and active agents from AgencySignature `persona:` trailers
// (the git author is uniform in this repo; the persona trailer is the real attribution).
const since = new Date(now.getTime() - windowHours * 3.6e6).toISOString();
const bodies = sh("git", ["log", "origin/main", `--since=${since}`, `--until=${now.toISOString()}`, "--format=%H%x00%b%x1e"]);
const commits = bodies.split("\x1e").filter((c) => c.trim());
const commits1 = sh("git", ["log", "origin/main", `--since=${new Date(now.getTime() - 3.6e6).toISOString()}`, "--oneline"])
  .split("\n")
  .filter(Boolean).length;
const personas = new Set();
for (const c of commits) {
  const m = c.match(/^\s*persona:\s*(\S+)/im);
  if (m) personas.add(m[1].toLowerCase());
}

const dateStr = now.toISOString().slice(0, 10);
const frame = {
  t: dateStr,
  prs_merged_24h: merged24.length,
  avg_lead_time_minutes: avgLead,
  commits_24h: commits.length,
  active_agents: personas.size,
  open_prs: openCount,
};
const snapshot = {
  prs_merged_24h: merged24.length,
  prs_merged_1h: merged1.length,
  avg_lead_time_minutes: avgLead,
  open_prs: openCount,
  last_merge: latestMerge ?? null,
  commits_24h: commits.length,
  commits_1h: commits1,
  active_agents: personas.size,
};

// eslint-disable-next-line no-console
console.log(JSON.stringify({ frame, snapshot, personas: [...personas].sort() }, null, 2));
