#!/usr/bin/env bun
// check-github-status.ts — query the public GitHub status API for the
// autonomous loop's pre-flight gate.
//
// Companion to poll-pr-gate.ts. Where poll-pr-gate.ts asks "is this PR
// ready to merge?", check-github-status.ts asks "is GitHub itself
// healthy enough that the answer can be trusted?"
//
// Origin: B-0109 (dependency status tracking surface, 2026-04-30) and
// peer-review feedback that the GitHub-status check should be a tested
// executable, not a behavioral habit. Mirrors poll-pr-gate.ts's
// "promote prose probes to executable substrate" pattern.
//
// Usage:
//   bun tools/github/check-github-status.ts
//   bun tools/github/check-github-status.ts --component "Pull Requests"
//   bun tools/github/check-github-status.ts --fixture path/to/summary.json
//   bun tools/github/check-github-status.ts --quiet     # exit-code-only
//
// Output (default): one JSON object on stdout, shape:
//   {
//     "overall":  "operational" | "degraded" | "outage" | "maintenance",
//     "fetchedAt":      "2026-04-30T15:00:00Z",  // local fetch time
//     "statusUpdatedAt":"2026-04-30T15:00:00Z",  // status-page update time
//     "degradedComponents": [{ "name": "...", "status": "..." }, ...],
//     "factoryRelevant": {
//       "Pull Requests": "operational" | "...",
//       "Actions": "...",
//       "API Requests": "...",
//       "Webhooks": "...",
//       "Git Operations": "...",
//       "Issues": "..."
//     },
//     "decision": "proceed" | "proceed-with-verify" | "halt"
//   }
//
// Exit codes (default — friendly for `set -e` shells):
//   0 — fetch + parse succeeded; decision is in JSON
//   1 — invocation / dependency error
//   2 — fetch failed (network / DNS / cloudflare)
//   3 — JSON parse failed
//
// Exit codes with `--strict` (opt-in enforcement):
//   0 — decision: proceed
//   8 — decision: proceed-with-verify (degraded; per proceed-but-verify
//       rule from poll-the-gate memory)
//   9 — decision: halt (outage / major)
//   1, 2, 3 — same as default
//
// The `factoryRelevant` allowlist mirrors the GitHub-status reference
// memory file (memory/reference_github_status_first_class_aaron_2026_04_30.md)
// so this tool reports exactly the surfaces the factory depends on.

import { readFileSync } from "node:fs";

const SUMMARY_URL = "https://www.githubstatus.com/api/v2/summary.json";

const FACTORY_RELEVANT_COMPONENTS = [
  "Pull Requests",
  "Actions",
  "API Requests",
  "Webhooks",
  "Git Operations",
  "Issues",
] as const;

type ComponentStatus =
  | "operational"
  | "degraded_performance"
  | "partial_outage"
  | "major_outage"
  | "under_maintenance";

type OverallStatus = "operational" | "degraded" | "outage" | "maintenance";

type Decision = "proceed" | "proceed-with-verify" | "halt";

interface ApiComponent {
  name: string;
  status: ComponentStatus;
}

interface ApiSummary {
  page?: { updated_at?: string };
  status: { description: string; indicator: string };
  components: ApiComponent[];
}

interface StatusReport {
  overall: OverallStatus;
  /** Local wall-clock time the tool fetched/loaded the status (ISO 8601).
   *  Distinct from `statusUpdatedAt` which is the status page's own
   *  last-updated time (per Copilot v0 review — field-name semantics). */
  fetchedAt: string;
  /** GitHub status page's `updated_at` — when the status itself last
   *  changed, NOT when the tool ran. May be older than `fetchedAt`. */
  statusUpdatedAt: string;
  degradedComponents: Array<{ name: string; status: ComponentStatus }>;
  factoryRelevant: Record<string, ComponentStatus | "unknown">;
  decision: Decision;
  description: string;
}

function classifyOverall(indicator: string): OverallStatus {
  // GitHub status indicator values: none | minor | major | critical |
  // maintenance. See the public schema at githubstatus.com.
  if (indicator === "none") return "operational";
  if (indicator === "maintenance") return "maintenance";
  if (indicator === "minor") return "degraded";
  if (indicator === "major" || indicator === "critical") return "outage";
  return "degraded"; // conservative: unknown indicator → degraded
}

function classifyDecision(
  overall: OverallStatus,
  factoryRelevant: Record<string, ComponentStatus | "unknown">,
): Decision {
  if (overall === "outage") return "halt";
  if (overall === "operational" && Object.values(factoryRelevant).every(
    (s) => s === "operational",
  )) {
    return "proceed";
  }
  // Either overall is degraded/maintenance, OR a factory-relevant component
  // is degraded — proceed-but-verify per the rule from PR #911.
  return "proceed-with-verify";
}

function buildReport(summary: ApiSummary): StatusReport {
  const overall = classifyOverall(summary.status.indicator);
  const fetchedAt = new Date().toISOString();
  const statusUpdatedAt = summary.page?.updated_at ?? fetchedAt;
  const factoryNameSet = new Set<string>(FACTORY_RELEVANT_COMPONENTS);
  const factoryRelevant: Record<string, ComponentStatus | "unknown"> = {};
  for (const name of FACTORY_RELEVANT_COMPONENTS) {
    factoryRelevant[name] = "unknown";
  }
  const degradedComponents: Array<{ name: string; status: ComponentStatus }> = [];
  for (const c of summary.components) {
    if (factoryNameSet.has(c.name)) {
      factoryRelevant[c.name] = c.status;
    }
    if (c.status !== "operational") {
      degradedComponents.push({ name: c.name, status: c.status });
    }
  }
  const decision = classifyDecision(overall, factoryRelevant);
  return {
    overall,
    fetchedAt,
    statusUpdatedAt,
    degradedComponents,
    factoryRelevant,
    decision,
    description: summary.status.description,
  };
}

async function fetchSummary(): Promise<ApiSummary> {
  let resp: Response;
  try {
    resp = await fetch(SUMMARY_URL, {
      headers: { accept: "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`fetch failed: ${msg}\n`);
    process.exit(2);
  }
  if (!resp.ok) {
    process.stderr.write(`fetch returned HTTP ${resp.status}: ${resp.statusText}\n`);
    process.exit(2);
  }
  const text = await resp.text();
  try {
    return JSON.parse(text) as ApiSummary;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`JSON parse error: ${msg}\n`);
    process.stderr.write(`first 200 bytes: ${text.slice(0, 200)}\n`);
    process.exit(3);
  }
}

function loadFixture(path: string): ApiSummary {
  let raw: ApiSummary;
  try {
    raw = JSON.parse(readFileSync(path, "utf8")) as ApiSummary;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`failed to load fixture ${path}: ${msg}\n`);
    process.exit(1);
  }
  return raw;
}

interface ParsedArgs {
  fixture?: string;
  component?: string;
  quiet: boolean;
  /** When true, non-`proceed` decisions exit non-zero (8/9). When false
   *  (default), exit 0 on successful fetch/parse — decision is in JSON.
   *  Per Copilot v0 review: `set -e` shells abort on any non-zero, so
   *  default-to-zero is friendlier; opt-in to strict via `--strict`. */
  strict: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = { quiet: false, strict: false };
  const requireValue = (flag: string, v: string | undefined): string => {
    // Reject any value that looks like a flag (starts with `-`), per
    // Copilot v0 review — `--component -q` was silently accepting `-q`
    // as a component name. Allow values that are pure numbers (covered
    // separately) or non-flag strings only.
    if (v === undefined || v.startsWith("-")) {
      process.stderr.write(`${flag} requires a value\n`);
      process.exit(1);
    }
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;
    if (arg === "--fixture") {
      out.fixture = requireValue("--fixture", argv[++i]);
    } else if (arg === "--component") {
      out.component = requireValue("--component", argv[++i]);
    } else if (arg === "--quiet" || arg === "-q") {
      out.quiet = true;
    } else if (arg === "--strict") {
      out.strict = true;
    } else if (arg === "--help" || arg === "-h") {
      process.stdout.write(
        "Usage: check-github-status.ts [--component <name>] [--quiet] [--strict]\n" +
          "       check-github-status.ts --fixture path/to/summary.json\n" +
          "\n" +
          "  --strict   non-`proceed` decisions exit non-zero (8 degraded, 9 outage).\n" +
          "             Default: exit 0 on successful fetch/parse; decision is\n" +
          "             encoded in the JSON `decision` field. Friendlier for\n" +
          "             `set -e` shells; opt-in to enforcement via --strict.\n",
      );
      process.exit(0);
    } else {
      process.stderr.write(`unknown arg: ${arg}\n`);
      process.exit(1);
    }
  }
  return out;
}

function decisionExitCode(decision: Decision): number {
  if (decision === "halt") return 9;
  if (decision === "proceed-with-verify") return 8;
  return 0;
}

export async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  const summary = args.fixture
    ? loadFixture(args.fixture)
    : await fetchSummary();
  const report = buildReport(summary);
  if (args.component) {
    const status = report.factoryRelevant[args.component] ?? "unknown";
    // Component decision incorporates the overall status (per Copilot v0
    // review): if overall is halt, the component decision is halt
    // regardless; otherwise use the stricter of the component's status
    // and the overall decision.
    let decision: Decision;
    if (report.decision === "halt") {
      decision = "halt";
    } else if (status === "operational" && report.decision === "proceed") {
      decision = "proceed";
    } else {
      decision = "proceed-with-verify";
    }
    const filtered = {
      component: args.component,
      status,
      overall: report.overall,
      overallDecision: report.decision,
      decision,
    };
    if (!args.quiet) {
      process.stdout.write(`${JSON.stringify(filtered, null, 2)}\n`);
    }
    return args.strict ? decisionExitCode(decision) : 0;
  }
  if (!args.quiet) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  }
  return args.strict ? decisionExitCode(report.decision) : 0;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
