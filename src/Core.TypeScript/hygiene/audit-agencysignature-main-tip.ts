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
//   bun tools/hygiene/audit-agencysignature-main-tip.ts --fail-closed-cutover <DATE>
//
// Exit codes:
//   0 — no regressions found (LEGACY / CORRECT / *-EXEMPT only)
//   1 — at least one REGRESSION found
//   2 — tooling / input error
//
// ---------------------------------------------------------------------------
// FAIL-CLOSED (2026-08-14, work-item 081M003VH9B087G0R002WXK2HD / PR #10564)
// ---------------------------------------------------------------------------
// This auditor used to recognise an agent commit by an ALLOWLIST of vendor
// co-author trailers (Claude|Codex|Grok|Gemini|Kiro + five noreply domains) and
// exempt everything else as "assuming human-authored". That is fail-OPEN, and
// the actors it exempted were precisely the ones it exists to attribute:
// measured over the last 300 commits of origin/main on 2026-08-14, 39
// github-actions[bot] commits and 8 commits trailed with the fleet's own
// personas (Dejan / Soraya / Otto / the shadow) were HUMAN-AUTHORED-EXEMPT.
//
// The default is now inverted. On and after the fail-closed cutover a commit is
// exempt only on a POSITIVE identity match in
// `agency-signature-identity-roster.json`; everything else — unknown persona,
// unlisted bot, no Co-authored-by at all — is agent-or-unknown and must carry
// the trailer. Adding a persona to the fleet no longer buys silent exemption.
//
// GRANDFATHER, stated the way the v1 ship date already is: commits BEFORE the
// cutover keep their legacy (fail-open) classification exactly, so the fix adds
// no retroactive red to `main` — and removes none of the red already there.
// ---------------------------------------------------------------------------

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join as joinPath } from "node:path";

type ExitCode = 0 | 1 | 2;
type Mode = "head" | "commit" | "max" | "since";
type Status =
  | "CORRECT"
  | "LEGACY"
  | "HUMAN-AUTHORED-EXEMPT"
  | "HUMAN-ROSTER-EXEMPT"
  | "MACHINE-LANE-EXEMPT"
  | "REGRESSION";

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;

const SPEC_DOC =
  "docs/research/2026-04-26-gemini-deep-think-agencysignature-commit-attribution-convention-validation-and-refinement.md";

/**
 * The date the fail-closed default takes effect. Commits with a committer
 * timestamp BEFORE this instant are classified under the legacy fail-open rule
 * (grandfathered — see the header block); commits at or after it must carry a
 * signature unless an identity on the roster exempts them.
 */
export const FAIL_CLOSED_CUTOVER_DEFAULT = "2026-08-15T00:00:00Z";

const POSITIVE_INT_RE = /^[1-9]\d*$/;
const V1_TRAILER_RE = /^(?:Agency-Signature-Version:\s*1\b|AgencySignature-v1:)/im;
// v2 adds the Cell trailer (ADR docs/DECISIONS/2026-07-03-persona-cell-identity-unification.md
// phase 4). Dual-accept until phase-8 contract; version share reported in the summary.
const V2_TRAILER_RE = /^Agency-Signature-Version:\s*2\b/im;
const AGENT_COAUTHOR_RE =
  /^Co-authored-by:\s*(?:(?:Claude|Codex|Grok|Gemini|Kiro)\b|.*<noreply@(?:anthropic\.com|openai\.com|x\.ai|google\.com|kiro\.dev)>)/im;

// `Agency-Signature-Version` is CANONICAL. Checked 2026-08-14 against every
// surface that names the key: the spec doc (SPEC_DOC §7.5/§10), the pre-merge
// validator's REQUIRED_KEYS (validate-agencysignature-pr-body.ts:47), the
// persona-cell ADR, samples/canonical-observation-2-hop-chain.txt, and the four
// cadence workflows that `echo` the trailer (budget-snapshot, zetadb-scheduled-node,
// context-cost-trend, manifesto-citation-snapshot). NO file in the repo emits
// `Agent-Signature-Version` — so there is no wrong generator to fix; the three
// commits carrying it on main (174bcd0891, 1930217660, 90e1d6a8c5, all
// 2026-08-13/14) were hand-composed by agents. A commit carrying ONLY the
// misspelling used to be exempt AND unsigned at once; it is now named and loud.
const MISSPELLED_VERSION_RE = /^Agent-Signature-Version:\s*\d/im;
export const CANONICAL_VERSION_KEY = "Agency-Signature-Version";
export const MISSPELLED_VERSION_KEY = "Agent-Signature-Version";

// No `[\t ]*(.*)` prefix: two adjacent quantifiers over overlapping character
// classes is the super-linear-backtracking shape. Capture the rest of the line
// and trim in code instead.
const COAUTHOR_LINE_RE = /^Co-authored-by:(.*)$/gim;
const EMAIL_RE = /<([^<>]+)>/;

export function hasAgentCoauthorTrailer(trailers: string): boolean {
  return AGENT_COAUTHOR_RE.test(trailers);
}

/** True when the misspelled `Agent-Signature-Version` key appears. */
export function hasMisspelledVersionTrailer(text: string): boolean {
  return MISSPELLED_VERSION_RE.test(text);
}

/**
 * Every `Co-authored-by` e-mail in a commit message, lowercased.
 * A trailer with no `<...>` yields the whole raw value, which can never match a
 * roster e-mail — deliberately, so a malformed trailer fails closed.
 */
export function coauthorEmails(message: string): readonly string[] {
  const out: string[] = [];
  for (const m of message.matchAll(COAUTHOR_LINE_RE)) {
    const raw = (m[1] ?? "").trim();
    if (raw === "") continue;
    const email = EMAIL_RE.exec(raw);
    out.push((email?.[1] ?? raw).trim().toLowerCase());
  }
  return out;
}

interface RosterEntry {
  readonly email: string;
  readonly name?: string;
  readonly why?: string;
}

export interface IdentityRoster {
  readonly humans: ReadonlySet<string>;
  readonly machineLanes: ReadonlySet<string>;
}

const ROSTER_FILENAME = "agency-signature-identity-roster.json";

function emailSet(rows: readonly RosterEntry[] | undefined, label: string): ReadonlySet<string> {
  if (rows === undefined || !Array.isArray(rows)) {
    throw new TypeError(`${ROSTER_FILENAME}: '${label}' must be an array`);
  }
  const set = new Set<string>();
  for (const row of rows as readonly RosterEntry[]) {
    const email: unknown = row.email;
    if (typeof email !== "string" || email.trim() === "") {
      throw new TypeError(`${ROSTER_FILENAME}: every '${label}' row needs a non-empty email`);
    }
    set.add(email.trim().toLowerCase());
  }
  return set;
}

/**
 * Parse the roster. Throws on anything malformed — a roster that cannot be read
 * is a tooling error (exit 2), never an empty roster that quietly exempts
 * nobody or, worse, a default that quietly exempts everybody.
 */
export function parseIdentityRoster(json: string): IdentityRoster {
  const raw = JSON.parse(json) as {
    humans?: readonly RosterEntry[];
    machineLanes?: readonly RosterEntry[];
  };
  return {
    humans: emailSet(raw.humans, "humans"),
    machineLanes: emailSet(raw.machineLanes, "machineLanes"),
  };
}

let cachedRoster: IdentityRoster | null = null;

export function loadIdentityRoster(): IdentityRoster {
  if (cachedRoster !== null) return cachedRoster;
  // Module-relative, so the auditor works from any cwd (tests chdir into a
  // temporary repository to plant falsifier commits).
  const path = joinPath(import.meta.dir, ROSTER_FILENAME);
  cachedRoster = parseIdentityRoster(readFileSync(path, "utf8"));
  return cachedRoster;
}

export function hasAgencySignatureV1(text: string): boolean {
  return V1_TRAILER_RE.test(text);
}

export function hasAgencySignatureV2(text: string): boolean {
  return V2_TRAILER_RE.test(text);
}

/** Any accepted signature version (v1 | v2) — the dual-accept window. */
export function hasAgencySignature(text: string): boolean {
  return hasAgencySignatureV1(text) || hasAgencySignatureV2(text);
}

export function hasAgentCoauthorSignal(trailers: string, message: string): boolean {
  return hasAgentCoauthorTrailer(trailers) || hasAgentCoauthorTrailer(message);
}

interface ParsedArgs {
  readonly mode: Mode;
  readonly commitSha: string;
  readonly maxN: string;
  readonly sinceDate: string;
  readonly branch: string;
  readonly v1ShipDate: string;
  readonly failClosedCutover: string;
  /** `"1"` when --require-shipped was passed; empty otherwise. */
  readonly requireShipped: string;
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
  failClosedCutover: string;
  requireShipped: string;
}

// Derived from MutableArgs so adding/removing string fields cannot drift
// from the ArgStep narrowing. `mode` is set via the parallel `setMode`
// channel, never via key/value.
type StringArgKey = Exclude<keyof MutableArgs, "mode">;

type ArgStep =
  | { readonly kind: "ok"; readonly key: StringArgKey; readonly value: string; readonly setMode: Mode | null; readonly skip: 0 | 1 }
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "help" };

// Flags that take no operand. `--require-shipped` is the CI guard: without it,
// a shallow clone (`fetch-depth: 1`) cannot reach the v1 anchor, every commit
// classifies LEGACY, and the audit reports PASS having checked nothing. That is
// the exact failure this whole work-item is about, so the enforcement path
// refuses to run without a ship anchor rather than passing.
const BOOLEAN_ARGS: Readonly<Record<string, StringArgKey>> = {
  "--require-shipped": "requireShipped",
};

function classifyArg(arg: string, next: string | undefined): ArgStep {
  const boolKey = BOOLEAN_ARGS[arg];
  if (boolKey !== undefined) {
    return { kind: "ok", key: boolKey, value: "1", setMode: null, skip: 0 };
  }
  const requiresNext: Record<string, { key: StringArgKey; setMode: Mode | null; missing: string }> = {
    "--commit": { key: "commitSha", setMode: "commit", missing: "error: --commit requires SHA" },
    "--max": { key: "maxN", setMode: "max", missing: "error: --max requires N" },
    "--since": { key: "sinceDate", setMode: "since", missing: "error: --since requires DATE (YYYY-MM-DD)" },
    "--branch": { key: "branch", setMode: null, missing: "error: --branch requires NAME" },
    "--v1-ship-date": { key: "v1ShipDate", setMode: null, missing: "error: --v1-ship-date requires DATE" },
    "--fail-closed-cutover": {
      key: "failClosedCutover",
      setMode: null,
      missing: "error: --fail-closed-cutover requires DATE",
    },
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
    failClosedCutover: FAIL_CLOSED_CUTOVER_DEFAULT,
    requireShipped: "",
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

/**
 * The v1 ship date is a HISTORICAL FACT and is therefore pinned, not re-derived.
 *
 * It used to be detected by walking `--reverse --max-count=5000`. git applies
 * max-count BEFORE reversing, so that walk only ever saw the newest 5000
 * commits — and `main` passed 5000 some time ago (6772 as of 2026-08-14). The
 * consequence, measured: the true first v1-signed commit is `a4bdce83da81`
 * (2026-05-28T20:22:11Z, PR #5928), but detection reported 2026-06-10 — 13 days
 * later — so every commit in that gap was classified LEGACY and auto-passed.
 *
 * Worse, it DRIFTS: the window slides forward as history grows, so the reported
 * ship date advances and the auditor quietly audits less of `main` every day.
 * A check whose coverage erodes on a timer is the same failure class as a check
 * that cannot fail. Pinning it removes the timer.
 */
export const V1_SHIP_DATE_DEFAULT = "2026-05-28T20:22:11Z";
export const V1_SHIP_SHA_DEFAULT = "a4bdce83da81966361599f59128b461aabcacf2a";

/**
 * Fallback only — used when the pinned anchor commit is not reachable (a fork,
 * a shallow clone, a rewritten history). Still window-limited, and now says so
 * out loud in the reason it returns rather than passing for a silent LEGACY.
 */
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
    if (hasAgencySignatureV1(commitTrailers(sha))) {
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

function commitSubject(sha: string): string {
  return gitOutput(["log", "-1", "--pretty=%s", sha]).stdout.trim();
}

/**
 * One `git log` for the whole record. `%B` is last because it is the only field
 * that may contain newlines.
 */
function commitRecord(sha: string): CommitRecord {
  const out = gitOutput(["log", "-1", "--pretty=format:%ae%n%ce%n%ct%n%cI%n%B", sha]).stdout;
  const nl = (n: number): number => {
    let i = -1;
    for (let k = 0; k < n; k++) {
      i = out.indexOf("\n", i + 1);
      if (i < 0) return out.length;
    }
    return i;
  };
  const cut = (a: number, b: number): string => out.slice(a === 0 ? 0 : a + 1, b);
  const b1 = nl(1);
  const b2 = nl(2);
  const b3 = nl(3);
  const b4 = nl(4);
  return {
    trailers: commitTrailers(sha),
    message: out.slice(Math.min(b4 + 1, out.length)),
    authorEmail: cut(0, b1),
    committerEmail: cut(b1, b2),
    timestamp: Number.parseInt(cut(b2, b3).trim(), 10),
    isoDate: cut(b3, b4).trim(),
  };
}

/**
 * Everything the classification depends on, with git already read. Kept pure so
 * the falsifier tests can plant an arbitrary commit shape without a repository.
 */
export interface CommitRecord {
  readonly trailers: string;
  readonly message: string;
  /** Committer timestamp, Unix seconds. */
  readonly timestamp: number;
  readonly isoDate: string;
  /** Author e-mail (`%ae`). NEVER a human-authorship signal — see the roster. */
  readonly authorEmail: string;
  /** Committer e-mail (`%ce`). Same caveat. */
  readonly committerEmail: string;
}

export interface Classification {
  readonly status: Status;
  readonly reason: string;
}

function classifySigned(record: CommitRecord): Classification | null {
  const hasV2 =
    hasAgencySignatureV2(record.trailers) || hasAgencySignatureV2(record.message);
  if (hasAgencySignature(record.trailers)) {
    return { status: "CORRECT", reason: hasV2 ? "trailer present (v2)" : "trailer present (v1)" };
  }
  if (hasAgencySignature(record.message)) {
    return {
      status: "CORRECT",
      reason: hasV2
        ? "AgencySignature v2 block present in commit message"
        : "AgencySignature block present in commit message",
    };
  }
  return null;
}

/**
 * The FAIL-OPEN rule as it stood before 2026-08-14. Retained verbatim in
 * behaviour so grandfathered (pre-cutover) commits keep the classification they
 * already had — the fix must not repaint history in either direction.
 */
function classifyLegacyFailOpen(record: CommitRecord): Classification {
  const signed = classifySigned(record);
  if (signed !== null) return signed;
  if (hasAgentCoauthorSignal(record.trailers, record.message)) {
    return {
      status: "REGRESSION",
      reason: "agent commit (Co-authored-by present) missing AgencySignature",
    };
  }
  return {
    status: "HUMAN-AUTHORED-EXEMPT",
    reason: "pre-cutover legacy rule: no vendor Co-authored-by; assumed human-authored",
  };
}

/**
 * The FAIL-CLOSED rule. Exemption requires a POSITIVE roster match; absence of
 * evidence is treated as agent-or-unknown, which is the whole inversion.
 *
 * Order is load-bearing:
 *  1. the misspelled version key, before anything can exempt it;
 *  2. a real signature — always CORRECT, whoever committed it;
 *  3. Co-authored-by present  → every co-author must be on a roster, and which
 *     roster decides the exemption. One unlisted co-author kills it, so a
 *     `Co-authored-by: github-actions[bot]` cannot be bolted onto an agent
 *     commit to buy the machine-lane exemption;
 *  4. Co-authored-by absent   → only the AUTHOR/COMMITTER being a machine lane
 *     exempts. Absence of a co-author trailer is NOT a human signal: 7 of the
 *     last 300 commits on main have none and are plainly agent squash-merges
 *     (#10368, #10410, #10544, #10561, …), and 51 more are bot telemetry ticks.
 */
function classifyFailClosed(record: CommitRecord, roster: IdentityRoster): Classification {
  if (
    hasMisspelledVersionTrailer(record.message) &&
    !hasAgencySignature(record.message) &&
    !hasAgencySignature(record.trailers)
  ) {
    return {
      status: "REGRESSION",
      reason: `misspelled trailer key '${MISSPELLED_VERSION_KEY}' — canonical key is '${CANONICAL_VERSION_KEY}' (the commit is unsigned)`,
    };
  }

  const signed = classifySigned(record);
  if (signed !== null) return signed;

  const coauthors = coauthorEmails(record.message);
  if (coauthors.length > 0) {
    const unlisted = coauthors.filter(
      (e) => !roster.humans.has(e) && !roster.machineLanes.has(e),
    );
    if (unlisted.length > 0) {
      return {
        status: "REGRESSION",
        reason: `unsigned, and Co-authored-by is not on the identity roster: ${unlisted.join(", ")} — agent-or-unknown must carry ${CANONICAL_VERSION_KEY}`,
      };
    }
    if (coauthors.some((e) => roster.machineLanes.has(e))) {
      return {
        status: "MACHINE-LANE-EXEMPT",
        reason: `explicit machine-lane exemption (${coauthors.join(", ")}); provenance is the in-repo workflow + run, not a trailer`,
      };
    }
    return {
      status: "HUMAN-ROSTER-EXEMPT",
      reason: `positive human signal: every Co-authored-by is on the human roster (${coauthors.join(", ")})`,
    };
  }

  const author = record.authorEmail.trim().toLowerCase();
  const committer = record.committerEmail.trim().toLowerCase();
  if (roster.machineLanes.has(author) || roster.machineLanes.has(committer)) {
    return {
      status: "MACHINE-LANE-EXEMPT",
      reason: `explicit machine-lane exemption (author ${author}); provenance is the in-repo workflow + run, not a trailer`,
    };
  }
  return {
    status: "REGRESSION",
    reason: `unsigned, and no Co-authored-by at all — absence is not a human signal; must carry ${CANONICAL_VERSION_KEY}`,
  };
}

export function classifyCommitRecord(
  record: CommitRecord,
  shipTs: number | null,
  shipDate: string,
  cutoverTs: number,
  roster: IdentityRoster,
): Classification {
  if (shipTs === null) {
    return { status: "LEGACY", reason: "v1 not yet shipped on this branch" };
  }
  if (record.timestamp < shipTs) {
    return {
      status: "LEGACY",
      reason: `pre-v1-ship-date (${record.isoDate} < ${shipDate})`,
    };
  }
  if (record.timestamp < cutoverTs) return classifyLegacyFailOpen(record);
  return classifyFailClosed(record, roster);
}

function classifyCommit(
  sha: string,
  ship: ShipState | null,
  cutoverTs: number,
  roster: IdentityRoster,
): Classification | null {
  const record = commitRecord(sha);

  if (ship === null) {
    return classifyCommitRecord(record, null, "", cutoverTs, roster);
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

  return classifyCommitRecord(record, shipTs, ship.date, cutoverTs, roster);
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
  process.stdout.write("  bun tools/hygiene/audit-agencysignature-main-tip.ts --fail-closed-cutover DATE\n");
  process.stdout.write("  bun tools/hygiene/audit-agencysignature-main-tip.ts --require-shipped     # CI: refuse to pass without a v1 anchor\n");
  return 0;
}

interface AuditCounts {
  correct: number;
  correctV2: number;
  legacy: number;
  human: number;
  humanRoster: number;
  machineLane: number;
  regression: number;
  regressions: string[];
}

function emitHeader(
  args: ParsedArgs,
  targetRev: string,
  ship: ShipState | null,
  roster: IdentityRoster,
): void {
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
  process.stdout.write(`  fail-closed:   ${args.failClosedCutover} — commits at or after this instant are\n`);
  process.stdout.write("                 exempt only on a POSITIVE roster match; earlier commits keep\n");
  process.stdout.write("                 the legacy fail-open classification (grandfathered, stated).\n");
  process.stdout.write(
    `  roster:        ${ROSTER_FILENAME} — ${String(roster.humans.size)} human, ${String(roster.machineLanes.size)} machine-lane identities\n`,
  );
  process.stdout.write(`  mode:          ${args.mode}\n`);
  process.stdout.write("\n");
}

function tallyCommit(status: Status, short: string, counts: AuditCounts, isV2 = false): void {
  if (status === "CORRECT") {
    counts.correct++;
    if (isV2) counts.correctV2++;
  }
  else if (status === "LEGACY") counts.legacy++;
  else if (status === "HUMAN-AUTHORED-EXEMPT") counts.human++;
  else if (status === "HUMAN-ROSTER-EXEMPT") counts.humanRoster++;
  else if (status === "MACHINE-LANE-EXEMPT") counts.machineLane++;
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
  cutoverTs: number,
  roster: IdentityRoster,
): { counts: AuditCounts; toolingError: boolean } {
  const counts: AuditCounts = {
    correct: 0,
    correctV2: 0,
    legacy: 0,
    human: 0,
    humanRoster: 0,
    machineLane: 0,
    regression: 0,
    regressions: [],
  };
  let cachedShipTs: number | null = ship?.tsCache ?? null;
  for (const sha of commits) {
    if (sha === "") continue;
    const shipState = ship === null ? null : { ...ship, tsCache: cachedShipTs };
    const result = classifyCommit(sha, shipState, cutoverTs, roster);
    if (result === null) return { counts, toolingError: true };
    if (ship !== null && cachedShipTs === null) {
      cachedShipTs = parseShipDate(ship.date);
    }
    const short = sha.slice(0, 12);
    emitCommitRow(result.status, short, commitSubject(sha), result.reason);
    tallyCommit(result.status, short, counts, result.reason.includes("(v2)") || result.reason.includes("v2 block"));
  }
  return { counts, toolingError: false };
}

function emitSummary(counts: AuditCounts): ExitCode {
  process.stdout.write("\nSummary:\n");
  process.stdout.write(`  CORRECT:                ${String(counts.correct)}\n`);
  process.stdout.write(`  LEGACY:                 ${String(counts.legacy)}\n`);
  process.stdout.write(`  HUMAN-AUTHORED-EXEMPT:  ${String(counts.human)}   (pre-cutover legacy rule)\n`);
  process.stdout.write(`  HUMAN-ROSTER-EXEMPT:    ${String(counts.humanRoster)}\n`);
  process.stdout.write(`  MACHINE-LANE-EXEMPT:    ${String(counts.machineLane)}\n`);
  process.stdout.write(`  REGRESSION:             ${String(counts.regression)}\n`);
  if (counts.correct > 0) {
    const v1 = counts.correct - counts.correctV2;
    process.stdout.write(
      `  version share:          v1: ${String(v1)}  v2: ${String(counts.correctV2)}  (phase-8 contract wants v1 -> 0)\n`,
    );
  }
  if (counts.regression === 0) {
    process.stdout.write("\nPASS: no regressions detected\n");
    return 0;
  }
  const regressionList = counts.regressions.map((s) => ` ${s}`).join("");
  process.stdout.write(
    `\nFAIL: ${String(counts.regression)} regression(s) found:${regressionList}\n`,
  );
  process.stdout.write(
    "  Cause: a commit that is agent-or-unknown is missing the\n",
  );
  process.stdout.write(
    `         ${CANONICAL_VERSION_KEY}: 1 trailer block — squash-merge stripped\n`,
  );
  process.stdout.write(
    "         the trailers, the PR body did not carry the block at its bottom,\n",
  );
  process.stdout.write(
    `         or the block used the WRONG KEY '${MISSPELLED_VERSION_KEY}'\n`,
  );
  process.stdout.write(
    "         (read the per-commit reason above; it says which).\n",
  );
  process.stdout.write(
    "         Since 2026-08-14 exemption is FAIL-CLOSED: it requires a positive\n",
  );
  process.stdout.write(
    `         identity match in ${ROSTER_FILENAME}. An unlisted\n`,
  );
  process.stdout.write(
    "         persona or bot is agent-or-unknown by construction, not exempt.\n",
  );
  process.stdout.write(
    "  Fix:   re-attach AgencySignature trailers to the next commit; ensure\n",
  );
  process.stdout.write(
    "         future PR bodies include the trailer block at the body bottom\n",
  );
  process.stdout.write(
    "         per the Squash-Merge Invariant rule (ferry-6/7). If the identity\n",
  );
  process.stdout.write(
    "         genuinely belongs to a human or a machine lane, add it to the\n",
  );
  process.stdout.write(
    "         roster — a reviewed one-line diff, which is the point.\n",
  );
  process.stdout.write(`  Spec:  ${SPEC_DOC} Section 7.5 + Section 10\n`);
  return 1;
}

/**
 * Resolution order: explicit `--v1-ship-date` → the PINNED anchor (when its
 * commit is reachable) → the window-limited fallback scan. The pinned anchor is
 * what stops the auditor's coverage from eroding as history grows; the scan
 * remains for repositories where the anchor commit does not exist.
 */
function determineShip(args: ParsedArgs, targetRev: string): ShipState | null {
  if (args.v1ShipDate !== "") {
    return { date: args.v1ShipDate, sha: "", tsCache: null };
  }
  if (gitOutput(["cat-file", "-e", `${V1_SHIP_SHA_DEFAULT}^{commit}`]).status === 0) {
    return { date: V1_SHIP_DATE_DEFAULT, sha: V1_SHIP_SHA_DEFAULT, tsCache: null };
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

  const cutoverTs = parseShipDate(args.failClosedCutover);
  if (cutoverTs === null) {
    process.stderr.write(
      `error: --fail-closed-cutover value is not a valid date: ${args.failClosedCutover}\n`,
    );
    return 2;
  }

  // A roster that cannot be read is a TOOLING ERROR, never an empty roster.
  // An empty roster would exempt nobody (noisy but safe); a *default* roster
  // would exempt somebody nobody reviewed, which is the defect being fixed.
  let roster: IdentityRoster;
  try {
    roster = loadIdentityRoster();
  } catch (err) {
    process.stderr.write(`error: cannot load identity roster: ${String(err)}\n`);
    return 2;
  }

  const ship = determineShip(args, targetRev);
  if (args.requireShipped !== "" && ship === null) {
    // Without this, a shallow CI clone reaches no v1 anchor, EVERY commit
    // classifies LEGACY, and the audit reports PASS having verified nothing —
    // a green check that checked zero commits. Refuse instead.
    process.stderr.write(
      "error: --require-shipped was passed but no v1 ship anchor is reachable.\n",
    );
    process.stderr.write(
      `       Expected commit ${V1_SHIP_SHA_DEFAULT.slice(0, 12)} (${V1_SHIP_DATE_DEFAULT}).\n`,
    );
    process.stderr.write(
      "       A shallow clone cannot see it; deepen the fetch or pass --v1-ship-date.\n",
    );
    process.stderr.write(
      "       Every commit would otherwise classify LEGACY and the audit would\n",
    );
    process.stderr.write("       PASS having verified nothing.\n");
    return 2;
  }
  const commits = buildCommitList(args, targetRev);
  if (commits === null) return 2;
  if (commits.length === 0 && args.mode === "since") {
    process.stdout.write(
      `no commits since ${args.sinceDate} on ${targetRev} — nothing to audit\n`,
    );
    return 0;
  }

  emitHeader(args, targetRev, ship, roster);
  const { counts, toolingError } = auditCommits(commits, ship, cutoverTs, roster);
  if (toolingError) return 2;
  return emitSummary(counts);
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
