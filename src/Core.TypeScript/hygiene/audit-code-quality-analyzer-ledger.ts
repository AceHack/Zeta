#!/usr/bin/env bun
// audit-code-quality-analyzer-ledger.ts — a METER for the `github-code-quality` analyzer.
//
// What this is, and what it deliberately is NOT
// --------------------------------------------
// The maintainer's disposition on the analyzer (2026-08-24): *"if it's helping maybe we
// should keep track of the metrics and then decided what to do."* Measure first,
// adjudicate second. So this file does not argue for keeping or disabling the analyzer,
// and it **never gates anything**. It records findings and reports a running
// true-positive / false-positive split so the decision becomes answerable with data
// instead of with the last argument anyone happened to make.
//
// It cannot exit 1. A meter that can fail a build is a gate wearing a meter's clothes,
// and the policy it would be enforcing has not been decided.
//
// The trap this file exists to avoid
// ----------------------------------
// The tempting metric is **thread resolution** — it is free, it is already in the API,
// and it is worthless. Measured over the repo's whole review-comment history
// (269 analyzer threads, 2026-04-29 -> 2026-08-24): **141 of 269 threads were resolved by
// `github-code-quality[bot]` itself**, and that set is exactly the 141 threads marked
// `isOutdated`. The analyzer closes its own thread when the flagged code moves. So
// "resolved" means *the diff changed under it*, not *the finding was real* — and a
// resolution-derived rate would have reported ~86% resolved and called it success.
//
// Hence the central invariant, enforced by `summarize` and pinned by its tests:
//
//   > **Resolution is never an input to the split.** A disposition is written by an
//   > adjudicator with a named evidence pointer, or the entry stays `unadjudicated`.
//
// `threadResolved` / `resolvedBy` / `botAutoResolved` are still *recorded* — they are the
// evidence that the shortcut is a shortcut — but `summarize` never reads them to decide
// a disposition.
//
// Measured vs inferred
// --------------------
// `evidenceKind: "measured"` means somebody ran an experiment: the defect was planted and
// the analyzer's behaviour observed, or the code was read against the claim. `"inferred"`
// means the disposition was read off a later commit (the flagged code changed, so the
// finding was *probably* real) and is explicitly weaker. They are counted separately and
// never pooled into one headline number, because an inference from "the code changed" is
// exactly the resolution shortcut wearing a second disguise.
//
// Rule 0: TypeScript (no .sh) per `.claude/rules/rule-0-no-sh-files.md`.
// Ledger is JSON text per `.claude/rules/no-binary-in-proof-lineage.md`.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/audit-code-quality-analyzer-ledger.ts
//   bun src/Core.TypeScript/hygiene/audit-code-quality-analyzer-ledger.ts --json
//   bun src/Core.TypeScript/hygiene/audit-code-quality-analyzer-ledger.ts --fetch --pr 14750
//   bun src/Core.TypeScript/hygiene/audit-code-quality-analyzer-ledger.ts --fetch --pr 14750 --write
//
// Exit codes:
//   0   report produced (whatever the split says — this is a meter, not a gate)
//   2   configuration error: ledger missing, unparseable, or internally inconsistent

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export const ANALYZER_LOGIN = "github-code-quality";
/** GraphQL reports the author as `github-code-quality`; REST and `resolvedBy` append `[bot]`. */
export const ANALYZER_LOGIN_BOT = `${ANALYZER_LOGIN}[bot]`;
export const LEDGER_PATH = "src/Core.TypeScript/hygiene/code-quality-analyzer-ledger.json";
export const SCHEMA_VERSION = 1;

export type Disposition = "true-positive" | "false-positive" | "unadjudicated";
export type EvidenceKind = "measured" | "inferred" | "none";
/**
 * WHY the finding entered the adjudicated set. This is the sampling frame, and it is a
 * required field because leaving it out is how a biased draw gets reported as a rate.
 */
export type DrawReason = "blocked-a-merge" | "systematic-sweep" | "spot-check" | "other";

export interface LedgerEntry {
  /** Stable natural key — pr:path:line:rule. Makes re-recording an upsert (DV2.0 #6). */
  key: string;
  pr: number;
  path: string;
  line: number | null;
  rule: string;
  firstSeen: string;
  /** RECORDED, never an input to the split. See the header. */
  threadResolved: boolean;
  resolvedBy: string | null;
  botAutoResolved: boolean;
  disposition: Disposition;
  evidenceKind: EvidenceKind;
  evidence: string | null;
  evidenceNote: string | null;
  drawReason: DrawReason;
  adjudicatedBy: string | null;
  adjudicatedAt: string | null;
}

export interface CensusRecord {
  method: string;
  completeAsOf: string;
  windowStart: string;
  windowEnd: string;
  threadsEnumerated: number;
  prsCovered: number;
  /** Honest statement of what the enumeration could not reach. */
  knownGaps: string[];
}

export interface Ledger {
  schemaVersion: number;
  analyzer: string;
  note: string;
  census: CensusRecord;
  entries: LedgerEntry[];
}

export interface FetchedFinding {
  pr: number;
  path: string;
  line: number | null;
  rule: string;
  firstSeen: string;
  threadResolved: boolean;
  resolvedBy: string | null;
  url: string;
}

// ---------------------------------------------------------------------------
// Pure core
// ---------------------------------------------------------------------------

/**
 * The analyzer's body is Markdown whose first line is `## <Rule title>`. Everything after
 * is prose and links that change between runs, so only the title is keyed on.
 */
export function parseRuleTitle(body: string): string {
  const first = body.trim().split("\n")[0] ?? "";
  const m = /^##\s*(.+?)\s*$/.exec(first);
  return m?.[1] ?? "(untitled)";
}

/**
 * The natural key. Deliberately excludes the body: the analyzer rewrites its prose (and
 * its permalinks) between runs, so keying on the body would make every re-record a new
 * entry and double-count the denominator.
 */
export function findingKey(f: {
  pr: number;
  path: string;
  line: number | null;
  rule: string;
}): string {
  return `${f.pr}:${f.path}:${f.line ?? "null"}:${f.rule}`;
}

/**
 * Parse one PR's GraphQL `reviewThreads` payload down to analyzer findings.
 *
 * `line` goes null once a thread is outdated, so `originalLine` is the fallback — without
 * it every stale finding collapses onto the key `pr:path:null:rule` and distinct findings
 * in one file merge into one ledger row.
 */
export function parseGraphQlThreads(payload: unknown): FetchedFinding[] {
  const pr = (payload as { data?: { repository?: { pullRequest?: unknown } } })?.data
    ?.repository?.pullRequest as
    | {
        number?: number;
        reviewThreads?: {
          nodes?: {
            isResolved?: boolean;
            resolvedBy?: { login?: string } | null;
            comments?: {
              nodes?: {
                author?: { login?: string } | null;
                path?: string;
                line?: number | null;
                originalLine?: number | null;
                body?: string;
                createdAt?: string;
                url?: string;
              }[];
            };
          }[];
        };
      }
    | null
    | undefined;
  if (!pr || typeof pr.number !== "number") return [];
  const out: FetchedFinding[] = [];
  for (const t of pr.reviewThreads?.nodes ?? []) {
    const c = t.comments?.nodes?.[0];
    if (!c) continue;
    const login = c.author?.login ?? "";
    if (login !== ANALYZER_LOGIN && login !== ANALYZER_LOGIN_BOT) continue;
    out.push({
      pr: pr.number,
      path: c.path ?? "",
      line: c.line ?? c.originalLine ?? null,
      rule: parseRuleTitle(c.body ?? ""),
      firstSeen: c.createdAt ?? "",
      threadResolved: t.isResolved === true,
      resolvedBy: t.resolvedBy?.login ?? null,
      url: c.url ?? "",
    });
  }
  return out;
}

export interface MergeResult {
  ledger: Ledger;
  added: number;
  refreshed: number;
}

/**
 * Idempotent upsert (DV2.0 #6): re-running the fetch must not move the denominator.
 *
 * A finding already in the ledger has only its *observed* fields refreshed —
 * resolution state and the permalink. Its **adjudication is never overwritten**: a
 * human's verdict outranks anything a later fetch has to say, and silently resetting a
 * disposition to `unadjudicated` because a thread got auto-resolved would delete exactly
 * the measurement this ledger exists to keep.
 */
export function mergeIntoLedger(ledger: Ledger, fetched: FetchedFinding[]): MergeResult {
  const byKey = new Map(ledger.entries.map((e) => [e.key, e]));
  let added = 0;
  let refreshed = 0;
  for (const f of fetched) {
    const key = findingKey(f);
    const existing = byKey.get(key);
    if (existing) {
      existing.threadResolved = f.threadResolved;
      existing.resolvedBy = f.resolvedBy;
      existing.botAutoResolved = f.resolvedBy === ANALYZER_LOGIN_BOT;
      refreshed++;
      continue;
    }
    const entry: LedgerEntry = {
      key,
      pr: f.pr,
      path: f.path,
      line: f.line,
      rule: f.rule,
      firstSeen: f.firstSeen,
      threadResolved: f.threadResolved,
      resolvedBy: f.resolvedBy,
      botAutoResolved: f.resolvedBy === ANALYZER_LOGIN_BOT,
      disposition: "unadjudicated",
      evidenceKind: "none",
      evidence: f.url === "" ? null : f.url,
      evidenceNote: null,
      drawReason: "systematic-sweep",
      adjudicatedBy: null,
      adjudicatedAt: null,
    };
    byKey.set(key, entry);
    ledger.entries.push(entry);
    added++;
  }
  ledger.entries.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return { ledger, added, refreshed };
}

/**
 * The refusals. Modelled on `ledger/measure.ts`: an unwitnessed price is refused rather
 * than recorded, because a number nobody can check is worse than no number.
 */
export function validateLedger(ledger: Ledger): string[] {
  const problems: string[] = [];
  if (ledger.schemaVersion !== SCHEMA_VERSION) {
    problems.push(`schemaVersion ${ledger.schemaVersion} != ${SCHEMA_VERSION}`);
  }
  const seen = new Set<string>();
  for (const e of ledger.entries) {
    if (seen.has(e.key)) problems.push(`duplicate key: ${e.key}`);
    seen.add(e.key);
    if (e.key !== findingKey(e)) {
      problems.push(`key does not match its own fields: ${e.key} (fields say ${findingKey(e)})`);
    }
    const adjudicated = e.disposition !== "unadjudicated";
    if (adjudicated && e.evidenceKind === "none") {
      problems.push(`${e.key}: disposition "${e.disposition}" with no evidence — refused`);
    }
    if (adjudicated && (e.evidence === null || e.evidence === "")) {
      problems.push(`${e.key}: disposition "${e.disposition}" with no evidence pointer — refused`);
    }
    if (adjudicated && (e.adjudicatedBy === null || e.adjudicatedBy === "")) {
      problems.push(`${e.key}: adjudicated but nobody is named as the adjudicator — refused`);
    }
    if (!adjudicated && e.evidenceKind !== "none") {
      problems.push(`${e.key}: unadjudicated but claims evidenceKind "${e.evidenceKind}"`);
    }
  }
  return problems;
}

export interface RuleSplit {
  truePositive: number;
  falsePositive: number;
  unadjudicated: number;
}

export interface Split {
  entries: number;
  adjudicated: number;
  truePositive: number;
  falsePositive: number;
  unadjudicated: number;
  measuredAdjudications: number;
  inferredAdjudications: number;
  /** null when nothing has been adjudicated — never 0, which would read as "no false positives". */
  falsePositiveRate: number | null;
  /** Recorded to show the shortcut is a shortcut; NOT an input to the numbers above. */
  botAutoResolved: number;
  humanResolved: number;
  /** The sampling frames the adjudicated entries were drawn from. */
  drawReasons: Record<string, number>;
  /** True when every adjudication came from one frame — i.e. the rate is not a population rate. */
  singleFrameDraw: boolean;
  byRule: Record<string, RuleSplit>;
}

/**
 * Compute the split.
 *
 * Reads `disposition` and nothing else to classify. It does not read `threadResolved`,
 * `resolvedBy`, or `botAutoResolved` — see the header for why that would be a fiction.
 */
export function summarize(ledger: Ledger): Split {
  const byRule: Record<string, RuleSplit> = {};
  const drawReasons: Record<string, number> = {};
  let tp = 0;
  let fp = 0;
  let un = 0;
  let measured = 0;
  let inferred = 0;
  let bot = 0;
  let human = 0;

  for (const e of ledger.entries) {
    const r = (byRule[e.rule] ??= { truePositive: 0, falsePositive: 0, unadjudicated: 0 });
    if (e.disposition === "true-positive") {
      tp++;
      r.truePositive++;
    } else if (e.disposition === "false-positive") {
      fp++;
      r.falsePositive++;
    } else {
      un++;
      r.unadjudicated++;
    }
    if (e.disposition !== "unadjudicated") {
      drawReasons[e.drawReason] = (drawReasons[e.drawReason] ?? 0) + 1;
      if (e.evidenceKind === "measured") measured++;
      if (e.evidenceKind === "inferred") inferred++;
    }
    if (e.botAutoResolved) bot++;
    else if (e.threadResolved) human++;
  }

  const adjudicated = tp + fp;
  return {
    entries: ledger.entries.length,
    adjudicated,
    truePositive: tp,
    falsePositive: fp,
    unadjudicated: un,
    measuredAdjudications: measured,
    inferredAdjudications: inferred,
    falsePositiveRate: adjudicated === 0 ? null : fp / adjudicated,
    botAutoResolved: bot,
    humanResolved: human,
    drawReasons,
    singleFrameDraw: adjudicated > 0 && Object.keys(drawReasons).length === 1,
    byRule,
  };
}

export const BIAS_CAVEAT =
  "SAMPLING CAVEAT: every adjudication so far was drawn from ONE frame, so this is not the analyzer's rate.";

export function renderHuman(split: Split, ledger: Ledger, problems: string[]): string {
  const lines: string[] = [];
  lines.push(`code-quality analyzer meter — ${ledger.analyzer} (this is a METER, it gates nothing)`);
  lines.push("");
  lines.push(
    `census: ${ledger.census.threadsEnumerated} thread(s) over ${ledger.census.prsCovered} PR(s), ` +
      `${ledger.census.windowStart} -> ${ledger.census.windowEnd} (${ledger.census.method})`,
  );
  lines.push(`ledger: ${split.entries} entry(ies) recorded`);
  lines.push("");
  if (split.falsePositiveRate === null) {
    lines.push("split: NOTHING ADJUDICATED YET — no rate is defined.");
  } else {
    const pct = (split.falsePositiveRate * 100).toFixed(1);
    lines.push(
      `split: ${split.truePositive} true-positive / ${split.falsePositive} false-positive ` +
        `of ${split.adjudicated} adjudicated  (FP rate ${pct}%)`,
    );
    lines.push(
      `       ${split.measuredAdjudications} measured, ${split.inferredAdjudications} inferred; ` +
        `${split.unadjudicated} still unadjudicated`,
    );
  }
  lines.push("");
  lines.push(
    `resolution (recorded, NOT used in the split above): ${split.botAutoResolved} auto-resolved by the ` +
      `analyzer itself, ${split.humanResolved} resolved by a named account.`,
  );
  if (split.singleFrameDraw) {
    const frame = Object.keys(split.drawReasons)[0] ?? "unknown";
    lines.push("");
    lines.push(`${BIAS_CAVEAT} Frame: "${frame}".`);
    lines.push(
      "  A rate over a biased draw estimates that frame, not the population. Adjudicate a",
      "  systematic sample before quoting this number as the analyzer's precision.",
    );
  }
  const ranked = Object.entries(split.byRule)
    .filter(([, r]) => r.truePositive + r.falsePositive > 0)
    .sort((a, b) => b[1].falsePositive - a[1].falsePositive);
  if (ranked.length > 0) {
    lines.push("");
    lines.push("by rule (adjudicated only):");
    for (const [rule, r] of ranked) {
      lines.push(`  ${r.truePositive} TP / ${r.falsePositive} FP  ${rule}`);
    }
  }
  if (problems.length > 0) {
    lines.push("");
    lines.push(`LEDGER REFUSED — ${problems.length} problem(s):`);
    for (const p of problems) lines.push(`  ${p}`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// IO edge
// ---------------------------------------------------------------------------

export function repoRoot(): string {
  return resolve(process.env["REPO_ROOT"] ?? process.cwd());
}

export function loadLedger(path: string): Ledger {
  return JSON.parse(readFileSync(path, "utf8")) as Ledger;
}

/** Injected so tests never reach the network. */
export type GraphQlRunner = (prNumber: number) => unknown;

export const THREADS_QUERY = `query($n:Int!){ repository(owner:"Lucent-Financial-Group",name:"Zeta"){ pullRequest(number:$n){
 number
 reviewThreads(first:100){ nodes{ isResolved isOutdated resolvedBy{login}
   comments(first:1){ nodes{ author{login} path line originalLine body createdAt url } } } } } } }`;

export const ghGraphQlRunner: GraphQlRunner = (prNumber) => {
  const r = spawnSync("gh", ["api", "graphql", "-f", `query=${THREADS_QUERY}`, "-F", `n=${prNumber}`], {
    encoding: "utf8",
  });
  if (r.status !== 0) throw new Error(`gh api graphql failed for PR ${prNumber}: ${r.stderr ?? ""}`);
  return JSON.parse(r.stdout) as unknown;
};

export function fetchFindings(prNumbers: number[], run: GraphQlRunner): FetchedFinding[] {
  const out: FetchedFinding[] = [];
  for (const n of prNumbers) out.push(...parseGraphQlThreads(run(n)));
  return out;
}

export function parsePrArgs(argv: string[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] !== "--pr") continue;
    const raw = argv[i + 1];
    if (raw === undefined) continue;
    for (const part of raw.split(",")) {
      const n = Number.parseInt(part.trim(), 10);
      if (Number.isFinite(n) && n > 0) out.push(n);
    }
  }
  return out;
}

export function main(argv: string[], run: GraphQlRunner = ghGraphQlRunner): number {
  const path = resolve(repoRoot(), process.env["ANALYZER_LEDGER_PATH"] ?? LEDGER_PATH);
  let ledger: Ledger;
  try {
    ledger = loadLedger(path);
  } catch (err) {
    process.stderr.write(`error: cannot read ledger at ${path}: ${String(err)}\n`);
    return 2;
  }

  if (argv.includes("--fetch")) {
    const prs = parsePrArgs(argv);
    if (prs.length === 0) {
      process.stderr.write("error: --fetch requires at least one --pr <number[,number...]>\n");
      return 2;
    }
    let fetched: FetchedFinding[];
    try {
      fetched = fetchFindings(prs, run);
    } catch (err) {
      process.stderr.write(`error: fetch failed: ${String(err)}\n`);
      return 2;
    }
    const m = mergeIntoLedger(ledger, fetched);
    process.stderr.write(
      `fetched ${fetched.length} finding(s) from ${prs.length} PR(s): ${m.added} new, ${m.refreshed} refreshed\n`,
    );
    if (argv.includes("--write")) {
      writeFileSync(path, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
      process.stderr.write(`wrote ${path}\n`);
    } else {
      process.stderr.write("(dry run — pass --write to persist)\n");
    }
  }

  const problems = validateLedger(ledger);
  const split = summarize(ledger);
  process.stdout.write(
    `${argv.includes("--json") ? JSON.stringify({ split, problems }, null, 2) : renderHuman(split, ledger, problems)}\n`,
  );
  // A malformed ledger is a CONFIG error (exit 2), never a finding-driven failure.
  // Nothing about the split can make this program exit non-zero — it is a meter.
  return problems.length > 0 ? 2 : 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
