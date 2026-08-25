#!/usr/bin/env bun
/**
 * 081KRA5AR0008QG0R0021SSM9R: Generate demo/metrics.json from GitHub API.
 *
 * Called by the autonomous loop on each tick. Produces a static
 * JSON file that both the HTML dashboard and agents can read
 * without hitting the GitHub API directly.
 *
 * Usage:
 *   bun src/Core.TypeScript/dashboard/generate-metrics.ts
 *
 * Output:
 *   demo/metrics.json (overwritten each run)
 */

import { loadWorkItemDoraMetrics } from "./work-item-metrics.ts";

const OWNER = "Lucent-Financial-Group";
const REPO = "Zeta";
const API = `https://api.github.com/repos/${OWNER}/${REPO}`;
// The GitHub Pages deploy refreshes this snapshot every 15 minutes. The browser
// must not present an older file as current operational telemetry: after this
// horizon it falls back to the live public GitHub API and labels the snapshot
// historical if that fallback is unavailable.
const METRICS_FRESHNESS_MAX_AGE_MINUTES = 30;

type GitHubCommit = {
  sha: string;
  commit: {
    message: string;
    author: {
      name?: string;
      date: string;
    };
  };
};

type GitHubPullRequest = {
  number: number;
  title: string;
  created_at: string;
  merged_at: string | null;
  // iter-5+ per-agent attribution: PRs land from branches with agent-prefixed
  // names per `.claude/rules/agent-roster-reference-card.md` lane discipline
  // (otto-cli/, otto-desktop/, otto-vscode/, lior/, alexa/, riven/, vera/).
  head?: { ref?: string };
};

type MergedPullRequest = GitHubPullRequest & { merged_at: string };

const AGENT_MAP: Record<string, { harness: string; patterns: string[] }> = {
  Otto: { harness: "Claude Code", patterns: ["Co-Authored-By: Claude"] },
  Alexa: { harness: "Kiro/Qwen", patterns: ["kiro", "alexa", "qwen"] },
  Lior: { harness: "Gemini/Antigravity", patterns: ["lior", "gemini"] },
  Vera: { harness: "Codex IDE", patterns: ["codex", "vera"] },
  Riven: { harness: "Cursor/Grok", patterns: ["riven", "grok"] },
  Aaron: { harness: "Human", patterns: ["Aaron Stainback", "AceHack"] },
};

// Per-agent branch prefix → agent name (Aaron 2026-05-26 framing:
// "i want that per agent so we can see helath like per trajectory").
// Maps PR branch refs to attributed agent. Surface-tagged prefixes
// (otto-cli/, otto-desktop/, otto-vscode/) all attribute to Otto agent
// identity per agent-roster-reference-card.md.
const BRANCH_PREFIX_TO_AGENT: Array<{ prefix: string; agent: string }> = [
  { prefix: "otto-cli/", agent: "Otto" },
  { prefix: "otto-desktop/", agent: "Otto" },
  { prefix: "otto-vscode/", agent: "Otto" },
  { prefix: "otto/", agent: "Otto" },
  { prefix: "alexa-kiro/", agent: "Alexa" },
  { prefix: "alexa/", agent: "Alexa" },
  { prefix: "riven-cursor/", agent: "Riven" },
  { prefix: "riven/", agent: "Riven" },
  { prefix: "vera-codex/", agent: "Vera" },
  { prefix: "vera/", agent: "Vera" },
  { prefix: "lior-antigravity/", agent: "Lior" },
  { prefix: "lior-gemini/", agent: "Lior" },
  { prefix: "lior/", agent: "Lior" },
];

function detectAgentFromPR(pr: GitHubPullRequest): string {
  const ref = pr.head?.ref ?? "";
  for (const { prefix, agent } of BRANCH_PREFIX_TO_AGENT) {
    if (ref.startsWith(prefix)) return agent;
  }
  return "Unknown";
}

// Identify a PR as "row-filing" work for the decompose-to-action ratio.
// A PR is row-filing if its title matches `backlog(B-NNNN`. The
// decompose-to-action ratio per agent surfaces the
// "infinite backlog = infinite debt" failure mode the maintainer
// 2026-05-26 surfaced: filing rows without shipping them produces
// debt. High ratio (many impl-PRs per row-filing-PR) = strong
// decompose-to-action discipline; low ratio = debt accumulation.
function isRowFilingPR(pr: GitHubPullRequest): boolean {
  return /^backlog\(B-\d+/i.test(pr.title);
}

async function apiFetch<T>(url: string): Promise<T> {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const resp = await fetch(url, { headers });
  if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}: ${url}`);
  return (await resp.json()) as T;
}

function detectAgent(commit: GitHubCommit): string {
  const msg = commit.commit?.message ?? "";
  const author = commit.commit?.author?.name ?? "";
  for (const [name, info] of Object.entries(AGENT_MAP)) {
    if (info.patterns.some((p) => msg.includes(p) || author.includes(p))) {
      return name;
    }
  }
  return author.split(" ")[0] || "Unknown";
}

function timeAgo(date: string): string {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function mergedWithin(dateNow: number, windowMs: number) {
  return (pr: GitHubPullRequest): pr is MergedPullRequest =>
    pr.merged_at !== null && dateNow - new Date(pr.merged_at).getTime() < windowMs;
}

// maxPages is a safety cap bounding worst-case GitHub API request
// volume per tick. Default 10 = up to 1000 closed PRs. Typical-case
// is 1-2 requests because early-stop fires when (a) batch is empty,
// (b) batch < 100 items (no more pages), or (c) oldest item in batch
// predates the window cutoff. Cap protects pathological cases (e.g.
// high-churn period where every PR stays "recently updated") without
// leaving the loop unbounded. Per Copilot P1 on PR #2766.
async function fetchClosedPRsUntilWindow(
  windowMs: number,
  maxPages = 10,
): Promise<GitHubPullRequest[]> {
  const all: GitHubPullRequest[] = [];
  const cutoff = Date.now() - windowMs;
  for (let page = 1; page <= maxPages; page++) {
    const batch = await apiFetch<Array<GitHubPullRequest & { updated_at?: string }>>(
      `${API}/pulls?state=closed&sort=updated&direction=desc&per_page=100&page=${page}`,
    );
    if (batch.length === 0) break;
    all.push(...batch);
    if (batch.length < 100) break;
    const lastUpdated = batch[batch.length - 1]!;
    const lastUpdatedAt = new Date(lastUpdated.updated_at ?? lastUpdated.merged_at ?? 0).getTime();
    if (lastUpdatedAt < cutoff) break;
  }
  return all;
}

async function main() {
  const [commits, openPRs, closedPRs] = await Promise.all([
    apiFetch<GitHubCommit[]>(`${API}/commits?per_page=100`),
    apiFetch<GitHubPullRequest[]>(`${API}/pulls?state=open&per_page=100`),
    fetchClosedPRsUntilWindow(24 * 60 * 60 * 1000),
  ]);

  const now = Date.now();
  const h24 = 24 * 60 * 60 * 1000;
  const h1 = 60 * 60 * 1000;
  const commits24h = commits.filter((c) => now - new Date(c.commit.author.date).getTime() < h24);
  const commits1h = commits.filter((c) => now - new Date(c.commit.author.date).getTime() < h1);
  // Sort merged-in-window by merged_at desc once — downstream consumers
  // (last_merge, recent_merged) all read from the sorted view. GitHub
  // /pulls?sort=updated does NOT guarantee merged_at order (label/comment
  // updates can leapfrog older-but-more-recently-merged PRs). Copilot P0
  // on PR #2766 + P1 follow-up that recent_merged still used unsorted.
  const mergedToday = (closedPRs.filter(mergedWithin(now, h24)) as MergedPullRequest[])
    .sort((a, b) => new Date(b.merged_at).getTime() - new Date(a.merged_at).getTime());
  const mergedLastHour = mergedToday.filter(mergedWithin(now, h1));
  const lastMerged = mergedToday[0] ?? null;

  let avgLeadTimeMinutes: number | null = null;
  if (mergedToday.length > 0) {
    const totalMins = mergedToday.reduce((sum, pr) => {
      return sum + (new Date(pr.merged_at).getTime() - new Date(pr.created_at).getTime()) / 60000;
    }, 0);
    avgLeadTimeMinutes = Math.round(totalMins / mergedToday.length);
  }

  const agentActivity: Record<string, { lastCommit: string; count: number; harness: string }> = {};
  for (const c of commits) {
    const agent = detectAgent(c);
    if (!agentActivity[agent]) {
      agentActivity[agent] = {
        lastCommit: c.commit.author.date,
        count: 0,
        harness: AGENT_MAP[agent]?.harness || "Unknown",
      };
    }
    agentActivity[agent].count++;
  }

  // Per-agent PR shipping rate (Aaron 2026-05-26: per-agent health
  // visibility for decompose-to-action discipline). Attribution via
  // branch prefix per BRANCH_PREFIX_TO_AGENT. Two counts per agent:
  // - prs_merged_24h: total PRs this agent merged in window (shipping rate)
  // - rows_filed_24h: PRs whose title matches `backlog(B-NNNN` (decompose rate)
  // - decompose_to_action_ratio: (prs_merged - rows_filed) / max(rows_filed, 1)
  //   → impl-PRs per row-filing-PR; >=1 = action-on-rows >= filing-rate
  //   → <1 = filing rows faster than shipping them = debt-accumulation signal
  const agentPRStats: Record<string, { prs_merged_24h: number; rows_filed_24h: number }> = {};
  for (const pr of mergedToday) {
    const agent = detectAgentFromPR(pr);
    if (!agentPRStats[agent]) {
      agentPRStats[agent] = { prs_merged_24h: 0, rows_filed_24h: 0 };
    }
    agentPRStats[agent].prs_merged_24h++;
    if (isRowFilingPR(pr)) {
      agentPRStats[agent].rows_filed_24h++;
    }
  }
  function decomposeToActionRatio(prsM: number, rowsF: number): number {
    // Action-PRs = PRs minus row-filing PRs (everything that's NOT just
    // adding a B-NNNN row). Ratio = action / rows. When rowsF == 0,
    // return prsM directly (all PRs were action; no debt accumulated).
    const actionPRs = prsM - rowsF;
    if (rowsF === 0) return prsM;
    return Math.round((actionPRs / rowsF) * 100) / 100;
  }

  const activeAgents = Object.values(agentActivity).filter((a) => now - new Date(a.lastCommit).getTime() < h24).length;

  const agents = Object.entries(agentActivity)
    .sort((a, b) => new Date(b[1].lastCommit).getTime() - new Date(a[1].lastCommit).getTime())
    .map(([name, info]) => {
      const prStats = agentPRStats[name] ?? { prs_merged_24h: 0, rows_filed_24h: 0 };
      return {
        name,
        harness: info.harness,
        commits: info.count,
        lastCommit: info.lastCommit,
        lastCommitAgo: timeAgo(info.lastCommit),
        status:
          now - new Date(info.lastCommit).getTime() < 30 * 60000
            ? "active"
            : now - new Date(info.lastCommit).getTime() < 6 * 60 * 60000
              ? "recent"
              : "stale",
        // Aaron 2026-05-26 per-agent decompose-to-action stats:
        prs_merged_24h: prStats.prs_merged_24h,
        rows_filed_24h: prStats.rows_filed_24h,
        decompose_to_action_ratio: decomposeToActionRatio(
          prStats.prs_merged_24h,
          prStats.rows_filed_24h,
        ),
      };
    });

  const prQueue = openPRs.slice(0, 10).map((pr) => ({
    number: pr.number,
    title: pr.title,
    createdAgo: timeAgo(pr.created_at),
    state: "open",
  }));

  const recentMerged = mergedToday.slice(0, 5).map((pr) => ({
    number: pr.number,
    title: pr.title,
    mergedAgo: timeAgo(pr.merged_at),
    state: "merged",
  }));

  const recentCommits = commits.slice(0, 20).map((c) => ({
    sha: c.sha.substring(0, 7),
    message: c.commit.message.split("\n")[0],
    agent: detectAgent(c),
    date: c.commit.author.date,
    dateAgo: timeAgo(c.commit.author.date),
  }));

  const workItemsDora = loadWorkItemDoraMetrics("workitems");

  const metrics = {
    generated: new Date().toISOString(),
    schema_version: "0.3.0",
    freshness: {
      mode: "github-api-snapshot",
      max_age_minutes: METRICS_FRESHNESS_MAX_AGE_MINUTES,
    },
    metrics: {
      prs_merged_24h: mergedToday.length,
      prs_merged_1h: mergedLastHour.length,
      avg_lead_time_minutes: avgLeadTimeMinutes,
      open_prs: openPRs.length,
      last_merge: lastMerged?.merged_at ?? null,
      last_merge_ago: lastMerged ? timeAgo(lastMerged.merged_at) : "none",
      commits_24h: commits24h.length,
      commits_1h: commits1h.length,
      active_agents: activeAgents,
      consecutive_days_operational: null,
      verification_gate_pass_rate: null,
      promotion_rate_mirror_to_beacon: null,
    },
    agents,
    pr_queue: [...prQueue, ...recentMerged],
    recent_commits: recentCommits,
    ...(workItemsDora ? { work_items_dora: workItemsDora } : {}),
  };

  const outPath = "demo/metrics.json";
  await Bun.write(outPath, JSON.stringify(metrics, null, 2));
  console.log(
    `Wrote ${outPath}: ${mergedToday.length} PRs merged, ${commits24h.length} commits, ${activeAgents} active agents`,
  );
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

export { main };
