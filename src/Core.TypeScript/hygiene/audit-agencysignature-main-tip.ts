#!/usr/bin/env bun
// audit-agencysignature-main-tip.ts — post-merge auditor for the
// AgencySignature Convention v1 trailer block.
//
// TypeScript+Bun port of audit-agencysignature-main-tip.sh, slice 9
// of the TS+Bun migration. See docs/best-practices/repo-scripting.md.
//
// Pairs with validate-agencysignature-pr-body.{sh,ts} (pre-merge
// validator) as the ferry-7 enforcement-instrument set.
//
// Usage:
//   bun tools/hygiene/audit-agencysignature-main-tip.ts                   # audit HEAD
//   bun tools/hygiene/audit-agencysignature-main-tip.ts --commit <SHA>    # audit specific
//   bun tools/hygiene/audit-agencysignature-main-tip.ts --max 10          # last N
//   bun tools/hygiene/audit-agencysignature-main-tip.ts --since YYYY-MM-DD
//   bun tools/hygiene/audit-agencysignature-main-tip.ts --branch main
//   bun tools/hygiene/audit-agencysignature-main-tip.ts --v1-ship-date <DATE>
//
// Exit codes:
//   0 — no regressions found (LEGACY / CORRECT / HUMAN-AUTHORED-EXEMPT only)
//   1 — at least one REGRESSION found
//   2 — tooling / input error

import { spawnSync } from "node:child_process";

type ExitCode = 0 | 1 | 2;
type Mode = "head" | "commit" | "max" | "since";
type Status = "CORRECT" | "LEGACY" | "HUMAN-AUTHORED-EXEMPT" | "REGRESSION";

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;

const SPEC_DOC =
  "docs/research/2026-04-26-gemini-deep-think-agencysignature-commit-attribution-convention-validation-and-refinement.md";

const POSITIVE_INT_RE = /^[1-9]\d*$/;
const V1_TRAILER_RE = /^Agency-Signature-Version:\s*1/im;
const COAUTHOR_RE = /^Co-authored-by:\s*Claude/im;

interface ParsedArgs {
  readonly mode: Mode;
  readonly commitSha: string;
  readonly maxN: string;
  readonly sinceDate: string;
  readonly branch: string;
  readonly v1ShipDate: string;
}

function gitOutput(args: readonly string[]): {
  status: number;
  stdout: string;
  stderr: string;
} {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("git", args, {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function gitAvailable(): boolean {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("git", ["--version"], {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  return result.status === 0;
}

interface ArgParseResult {
  readonly ok: ParsedArgs | null;
  readonly errorMessage: string;
}

interface MutableArgs {
  mode: Mode;
  commitSha: string;
  maxN: string;
  sinceDate: string;
  branch: string;
  v1ShipDate: string;
}

// Derived from MutableArgs so adding/removing string fields cannot drift
// from the ArgStep narrowing. `mode` is set via the parallel `setMode`
// channel, never via key/value.
type StringArgKey = Exclude<keyof MutableArgs, "mode">;

type ArgStep =
  | { readonly kind: "ok"; readonly key: StringArgKey; readonly value: string; readonly setMode: Mode | null; readonly skip: 1 }
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "help" };

function classifyArg(arg: string, next: string | undefined): ArgStep {
  const requiresNext: Record<string, { key: StringArgKey; setMode: Mode | null; missing: string }> = {
    "--commit": { key: "commitSha", setMode: "commit", missing: "error: --commit requires SHA" },
    "--max": { key: "maxN", setMode: "max", missing: "error: --max requires N" },
    "--since": { key: "sinceDate", setMode: "since", missing: "error: --since requires DATE (YYYY-MM-DD)" },
    "--branch": { key: "branch", setMode: null, missing: "error: --branch requires NAME" },
    "--v1-ship-date": { key: "v1ShipDate", setMode: null, missing: "error: --v1-ship-date requires DATE" },
  };
  const spec = requiresNext[arg];
  if (spec !== undefined) {
    if (next === undefined) return { kind: "error", message: spec.missing };
    return { kind: "ok", key: spec.key, value: next, setMode: spec.setMode, skip: 1 };
  }
  if (arg === "-h" || arg === "--help") return { kind: "help" };
  return { kind: "error", message: `error: unknown arg: ${arg}` };
}

function parseArgs(argv: readonly string[]): ArgParseResult {
  const args: MutableArgs = {
    mode: "head",
    commitSha: "",
    maxN: "",
    sinceDate: "",
    branch: "",
    v1ShipDate: "",
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? "";
    const step = classifyArg(arg, argv[i + 1]);
    if (step.kind === "help") return { ok: null, errorMessage: "__HELP__" };
    if (step.kind === "error") return { ok: null, errorMessage: step.message };
    args[step.key] = step.value;
    if (step.setMode !== null) args.mode = step.setMode;
    i += step.skip;
  }
  return { ok: { ...args }, errorMessage: "" };
}

function commitTrailers(sha: string): string {
  return gitOutput(["log", "-1", "--pretty=%(trailers)", sha]).stdout;
}

interface V1Ship {
  readonly sha: string;
  readonly date: string;
}

function detectV1Ship(targetRev: string): V1Ship | null {
  // Iterate commits oldest-first; return first one whose parsed
  // trailers contain Agency-Signature-Version: 1.
  const out = gitOutput([
    "log",
    "--reverse",
    "--max-count=5000",
    "--pretty=%H %cI",
    targetRev,
  ]);
  const lines = out.stdout.split("\n").filter((s) => s.length > 0);
  for (const line of lines) {
    const sp = line.indexOf(" ");
    if (sp < 0) continue;
    const sha = line.slice(0, sp);
    const cdate = line.slice(sp + 1);
    if (V1_TRAILER_RE.test(commitTrailers(sha))) {
      return { sha, date: cdate };
    }
  }
  return null;
}

function parseShipDate(date: string): number | null {
  // Try Date.parse — handles ISO-8601 with TZ, plain YYYY-MM-DD,
  // and YYYY-MM-DDTHH:MM:SSZ. Returns Unix timestamp seconds, or null.
  const ms = Date.parse(date);
  if (!Number.isNaN(ms)) return Math.floor(ms / 1000);
  return null;
}

interface ShipState {
  readonly date: string;
  readonly sha: string;
  readonly tsCache: number | null;
}

function commitTimestamp(sha: string): number {
  const out = gitOutput(["log", "-1", "--pretty=%ct", sha]);
  return Number.parseInt(out.stdout.trim(), 10);
}

function commitIsoDate(sha: string): string {
  return gitOutput(["log", "-1", "--pretty=%cI", sha]).stdout.trim();
}

function commitSubject(sha: string): string {
  return gitOutput(["log", "-1", "--pretty=%s", sha]).stdout.trim();
}

function classifyCommit(
  sha: string,
  ship: ShipState | null,
): { status: Status; reason: string } | null {
  const trailers = commitTrailers(sha);
  const hasV1 = V1_TRAILER_RE.test(trailers);
  const hasCoauthor = COAUTHOR_RE.test(trailers);

  if (ship === null) {
    return { status: "LEGACY", reason: "v1 not yet shipped on this branch" };
  }

  let shipTs: number;
  if (ship.tsCache !== null) {
    shipTs = ship.tsCache;
  } else {
    const parsed = parseShipDate(ship.date);
    if (parsed === null) {
      process.stderr.write(
        `error: cannot parse v1-ship-date as timestamp: ${ship.date}\n`,
      );
      return null;
    }
    shipTs = parsed;
  }

  const commitTs = commitTimestamp(sha);
  if (commitTs < shipTs) {
    return {
      status: "LEGACY",
      reason: `pre-v1-ship-date (${commitIsoDate(sha)} < ${ship.date})`,
    };
  }
  if (hasV1) return { status: "CORRECT", reason: "trailer present" };
  if (hasCoauthor) {
    return {
      status: "REGRESSION",
      reason: "agent commit (Co-authored-by present) missing AgencySignature",
    };
  }
  return {
    status: "HUMAN-AUTHORED-EXEMPT",
    reason: "no Co-authored-by signal; assuming human-authored",
  };
}

function buildCommitList(args: ParsedArgs, targetRev: string): readonly string[] | null {
  if (args.mode === "head" || args.mode === "commit") {
    const ref = args.mode === "head" ? targetRev : args.commitSha;
    const out = gitOutput(["rev-parse", ref]);
    if (out.status !== 0) return null;
    return [out.stdout.trim()];
  }
  if (args.mode === "max") {
    if (!POSITIVE_INT_RE.test(args.maxN)) {
      process.stderr.write("error: --max value must be a positive integer\n");
      return null;
    }
    const out = gitOutput([
      "log",
      `--max-count=${args.maxN}`,
      "--pretty=%H",
      targetRev,
    ]);
    return out.stdout.split("\n").filter((s) => s.length > 0);
  }
  // since
  if (parseShipDate(args.sinceDate) === null) {
    process.stderr.write(`error: --since value is not a valid date: ${args.sinceDate}\n`);
    return null;
  }
  const out = gitOutput([
    "log",
    `--since=${args.sinceDate}`,
    "--pretty=%H",
    targetRev,
  ]);
  return out.stdout.split("\n").filter((s) => s.length > 0);
}

function emitHelp(): ExitCode {
  process.stdout.write("audit-agencysignature-main-tip.ts — post-merge AgencySignature auditor.\n");
  process.stdout.write("\nUsage:\n");
  process.stdout.write("  bun tools/hygiene/audit-agencysignature-main-tip.ts                   # audit HEAD\n");
  process.stdout.write("  bun tools/hygiene/audit-agencysignature-main-tip.ts --commit <SHA>    # audit specific\n");
  process.stdout.write("  bun tools/hygiene/audit-agencysignature-main-tip.ts --max 10          # last N\n");
  process.stdout.write("  bun tools/hygiene/audit-agencysignature-main-tip.ts --since DATE      # since DATE\n");
  process.stdout.write("  bun tools/hygiene/audit-agencysignature-main-tip.ts --branch NAME     # branch tip\n");
  process.stdout.write("  bun tools/hygiene/audit-agencysignature-main-tip.ts --v1-ship-date DATE\n");
  return 0;
}

interface AuditCounts {
  correct: number;
  legacy: number;
  human: number;
  regression: number;
  regressions: string[];
}

function emitHeader(args: ParsedArgs, targetRev: string, ship: ShipState | null): void {
  const sha = gitOutput(["rev-parse", targetRev]).stdout.trim();
  process.stdout.write("AgencySignature v1 main-tip audit\n");
  process.stdout.write(`  target_rev:    ${targetRev} (${sha})\n`);
  if (ship !== null) {
    process.stdout.write(`  v1-ship-date:  ${ship.date}`);
    if (ship.sha !== "") {
      process.stdout.write(` (commit ${ship.sha.slice(0, 12)})`);
    }
    process.stdout.write("\n");
  } else {
    process.stdout.write(
      "  v1-ship-date:  not yet shipped on this branch (all commits LEGACY)\n",
    );
  }
  process.stdout.write(`  mode:          ${args.mode}\n`);
  process.stdout.write("\n");
}

function tallyCommit(status: Status, short: string, counts: AuditCounts): void {
  if (status === "CORRECT") counts.correct++;
  else if (status === "LEGACY") counts.legacy++;
  else if (status === "HUMAN-AUTHORED-EXEMPT") counts.human++;
  else {
    counts.regression++;
    counts.regressions.push(short);
  }
}

function emitCommitRow(status: Status, short: string, subject: string, reason: string): void {
  process.stdout.write(`  [${status.padEnd(22, " ")}] ${short} — ${subject}\n`);
  process.stdout.write(`    ${reason}\n`);
}

function auditCommits(
  commits: readonly string[],
  ship: ShipState | null,
): { counts: AuditCounts; toolingError: boolean } {
  const counts: AuditCounts = {
    correct: 0,
    legacy: 0,
    human: 0,
    regression: 0,
    regressions: [],
  };
  let cachedShipTs: number | null = ship?.tsCache ?? null;
  for (const sha of commits) {
    if (sha === "") continue;
    const shipState = ship === null ? null : { ...ship, tsCache: cachedShipTs };
    const result = classifyCommit(sha, shipState);
    if (result === null) return { counts, toolingError: true };
    if (ship !== null && cachedShipTs === null) {
      cachedShipTs = parseShipDate(ship.date);
    }
    const short = sha.slice(0, 12);
    emitCommitRow(result.status, short, commitSubject(sha), result.reason);
    tallyCommit(result.status, short, counts);
  }
  return { counts, toolingError: false };
}

function emitSummary(counts: AuditCounts): ExitCode {
  process.stdout.write("\nSummary:\n");
  process.stdout.write(`  CORRECT:                ${String(counts.correct)}\n`);
  process.stdout.write(`  LEGACY:                 ${String(counts.legacy)}\n`);
  process.stdout.write(`  HUMAN-AUTHORED-EXEMPT:  ${String(counts.human)}\n`);
  process.stdout.write(`  REGRESSION:             ${String(counts.regression)}\n`);
  if (counts.regression === 0) {
    process.stdout.write("\nPASS: no regressions detected\n");
    return 0;
  }
  const regressionList = counts.regressions.map((s) => ` ${s}`).join("");
  process.stdout.write(
    `\nFAIL: ${String(counts.regression)} regression(s) found:${regressionList}\n`,
  );
  process.stdout.write(
    "  Cause: agent-authored commits (Co-authored-by present) on or after v1\n",
  );
  process.stdout.write(
    "         ship date are missing the Agency-Signature-Version: 1 trailer\n",
  );
  process.stdout.write(
    "         block, indicating squash-merge stripped the trailers OR the PR\n",
  );
  process.stdout.write(
    "         body did not carry the trailer block at the bottom.\n",
  );
  process.stdout.write(
    "  Fix:   re-attach AgencySignature trailers to the next commit; ensure\n",
  );
  process.stdout.write(
    "         future PR bodies include the trailer block at the body bottom\n",
  );
  process.stdout.write(
    "         per the Squash-Merge Invariant rule (ferry-6/7).\n",
  );
  process.stdout.write(`  Spec:  ${SPEC_DOC} Section 7.5 + Section 10\n`);
  return 1;
}

function determineShip(args: ParsedArgs, targetRev: string): ShipState | null {
  if (args.v1ShipDate !== "") {
    return { date: args.v1ShipDate, sha: "", tsCache: null };
  }
  const detected = detectV1Ship(targetRev);
  if (detected === null) return null;
  return { date: detected.date, sha: detected.sha, tsCache: null };
}

export function main(argv: readonly string[]): ExitCode {
  if (!gitAvailable()) {
    process.stderr.write("error: git not found on PATH\n");
    return 2;
  }
  const parsed = parseArgs(argv);
  if (parsed.ok === null) {
    if (parsed.errorMessage === "__HELP__") return emitHelp();
    process.stderr.write(`${parsed.errorMessage}\n`);
    return 2;
  }
  const args = parsed.ok;
  const targetRev = args.branch !== "" ? args.branch : "HEAD";

  if (gitOutput(["rev-parse", "--verify", targetRev]).status !== 0) {
    process.stderr.write(`error: cannot resolve target rev: ${targetRev}\n`);
    return 2;
  }

  const ship = determineShip(args, targetRev);
  const commits = buildCommitList(args, targetRev);
  if (commits === null) return 2;
  if (commits.length === 0 && args.mode === "since") {
    process.stdout.write(
      `no commits since ${args.sinceDate} on ${targetRev} — nothing to audit\n`,
    );
    return 0;
  }

  emitHeader(args, targetRev, ship);
  const { counts, toolingError } = auditCommits(commits, ship);
  if (toolingError) return 2;
  return emitSummary(counts);
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
