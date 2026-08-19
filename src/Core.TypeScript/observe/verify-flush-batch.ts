#!/usr/bin/env bun
/**
 * verify-flush-batch.ts — check a heartbeat flush batch. Reports; never approves.
 *
 * Work-item 081M0BTTM85087G0R003X6TWCD. Called by `.github/workflows/agent-reviewer.yml`.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS IS FOR, AND WHAT IT DELIBERATELY IS NOT
 * ---------------------------------------------------------------------------
 * `agent-reviewer.yml` used to end in `gh pr review --approve` plus a commit
 * pushed back onto the flush branch. It never ran — its trigger matched
 * `flush/` and the fleet produces `heartbeat/<agent>-flush-<sha>` — so 300
 * consecutive runs were skips. Arming it as written was measured and refused;
 * the reasons are recorded in the workflow header. What survives the refusal is
 * the part that was always worth doing: READ the batch and say what is true
 * about it. So this program has no forge write authority of any kind. It takes
 * a branch name, a changed-file list and a repo root, and prints findings.
 *
 * NO PRIVATE KEY, no signing, no network, no forge API. Checkable:
 *   rg 'fetch\(|https://|gh api|spawnSync|execSync' verify-flush-batch.ts
 * returns nothing. Signature VERIFICATION is delegated to
 * `attestation-record.ts`, which is pure and holds no key either.
 *
 * ---------------------------------------------------------------------------
 * THE TWO CHECKS, AND WHY ONLY THESE TWO
 * ---------------------------------------------------------------------------
 * Everything else the old workflow did is done elsewhere, better, and
 * duplicating it here would create a second opinion about one rule — the defect
 * `hygiene/agencysignature-block.ts` was written to end.
 *
 *   * FILENAME SHAPE is `hygiene/audit-observe-event-filenames.ts`, and it runs
 *     inside `gate (required)` on every PR. It also knows the folder holds THREE
 *     naming schemes; the old inline `^[0-9a-f]{32}\.json$` knew one, and would
 *     have failed any batch carrying a legitimate `society-<base36>.json`.
 *   * SIGNATURE / DIGEST / DERIVED-ID validity is `attestation-record.ts`,
 *     called through here rather than reimplemented.
 *
 * 1. PRODUCER BINDING. Every event file the batch adds must carry `by` equal to
 *    the agent named by the branch. Nothing else in the repository compares
 *    those two facts, and they sat one step apart for the life of the feature:
 *    a `heartbeat/alexa-flush-*` branch could carry events authored `by: otto`.
 *
 *    ITS LIMIT, stated so nobody upgrades it later: `by` and the branch name are
 *    written by the same producer, so their agreement is a CONSISTENCY property
 *    and not proof of authorship. It convicts a batch whose contents contradict
 *    the branch that carried them; it acquits nobody. This is the one-way
 *    inference shape — sound as a refusal, worthless as a certificate.
 *
 * 2. ATTESTATION RECORD VALIDITY. Every record the batch adds that parses as
 *    `kind: "attestation"` is run through `verifyAttestationRecord`. This is the
 *    half that #12256 built and stopped short of wiring: the verifier exists, is
 *    tested, is host-independent — and no workflow in the repository calls it,
 *    so 380 records reached `main` with nothing ever checking one.
 *
 *    REFUSED is a failure. UNBOUND is REPORTED AND NOT A FAILURE, because
 *    unbound is the honest state of the entire corpus (measured on `main`
 *    2026-08-19: 0 bound, 3 unbound, 377 refused) and no key holder has signed
 *    anything yet. Failing on unbound would fail every batch forever, which is
 *    a check nobody can act on. `--require-bound` exists for the day that
 *    changes and is deliberately not the default.
 *
 * ---------------------------------------------------------------------------
 * WHY IT REPORTS RATHER THAN GATES
 * ---------------------------------------------------------------------------
 * `main` requires exactly one status check (`gate (required)`, ruleset
 * 16134995) and NO approving review — verified against the live rules API, not
 * inferred. So an approval here would unlock nothing, and a hard failure here
 * would not block a merge either. What it can do honestly is make a false batch
 * visible. Promoting this context to a required check is a maintainer decision
 * and a one-line ruleset change; it is not this program's to assume.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { verifyAttestationRecord, type AttestationRecord, type PersonaKeyRoster } from "./attestation-record.ts";

/** The folder a flush batch's events live in. */
export const EVENT_DIR = "docs/observe-events";

// ═══ producer derivation ═══════════════════════════════════════════════════

/**
 * Branch forms that name a producer. ANCHORED, both of them.
 *
 * The old inline `sed -n 's|flush/heartbeat-\([a-z]*\)-.*|\1|p'` was unanchored
 * on the left, so it matched a `flush/heartbeat-...` substring anywhere in the
 * name, and `[a-z]*` matches the EMPTY string — `flush/heartbeat--x` parsed to
 * an empty producer that then compared unequal to every `by` and produced a
 * confusing failure rather than an honest "this branch does not name a
 * producer". Both patterns below require at least one character and consume the
 * whole string.
 *
 *   live  — `heartbeat/<agent>-flush-<40 hex>`, minted by `agent-heartbeat.yml`
 *           from `git rev-parse`, which is where the 40 hex comes from.
 *   legacy — `flush/heartbeat-<agent>-<timestamp>`, three of which still exist
 *           on the remote from 2026-08-01. Accepted so a replay of one is
 *           parsed rather than silently treated as unnamed.
 *
 * The agent character class excludes `-` deliberately: `heartbeat/a-b-flush-<sha>`
 * would otherwise be ambiguous between agent `a` and agent `a-b`, and an
 * identity field with two readings is not an identity field. Every live lane
 * (`otto`, `alexa`, `soraya`) is a single lowercase word.
 */
const BRANCH_PATTERNS: readonly RegExp[] = [
  /^heartbeat\/([a-z0-9]+)-flush-[0-9a-f]{40}$/,
  /^flush\/heartbeat-([a-z0-9]+)-[A-Za-z0-9]+$/,
];

/**
 * The agent a branch names, or `null` when the branch does not name one.
 *
 * `null` IS THE POINT. The predecessor emitted the string `"unknown"` here and
 * carried it forward into an approval whose body read "Producer: unknown" —
 * there is no batch for which that sentence is true. A missing producer is a
 * refusal to verify, never a producer named "unknown".
 */
export function deriveProducer(branch: string): string | null {
  for (const re of BRANCH_PATTERNS) {
    const m = re.exec(branch);
    if (m?.[1] !== undefined) return m[1];
  }
  return null;
}

// ═══ findings ══════════════════════════════════════════════════════════════

/** How seriously a finding is taken. `info` never changes the exit code. */
export type Severity = "fail" | "info";

export interface Finding {
  readonly severity: Severity;
  /** A stable machine-readable discriminator, so callers match rather than grep prose. */
  readonly code:
    | "no-producer"
    | "unreadable"
    | "not-an-object"
    | "missing-field"
    | "producer-mismatch"
    | "attestation-refused"
    | "attestation-unbound"
    | "attestation-bound"
    | "nothing-inspected";
  readonly file: string;
  readonly detail: string;
}

export interface BatchReport {
  readonly producer: string | null;
  /** Files under `EVENT_DIR` that were opened and parsed. */
  readonly eventsInspected: number;
  /** Of those, the ones carrying `kind: "attestation"`. */
  readonly attestationsInspected: number;
  readonly findings: readonly Finding[];
}

/** True when the report contains something that should take the job red. */
export function hasFailure(report: BatchReport): boolean {
  return report.findings.some((f) => f.severity === "fail");
}

// ═══ the batch check ═══════════════════════════════════════════════════════

/** What a caller must supply. Pure: the file bodies are handed in, never read here. */
export interface BatchInput {
  readonly branch: string;
  /** Paths changed by the proposal, repo-relative, as the forge reports them. */
  readonly changedPaths: readonly string[];
  /**
   * Reads a repo-relative path, or returns `null` when it does not exist.
   *
   * `null` is NOT a failure: a flush PR's file list includes REMOVED paths, and
   * a removed file has no content to bind to a producer. Treating absence as a
   * failure would fail every batch that ever deletes an event.
   */
  readonly readFile: (path: string) => string | null;
  /** Persona -> authorized keys. An empty roster makes every signed record refuse. */
  readonly roster: PersonaKeyRoster;
  /** When true, an UNBOUND record is a failure rather than a report. */
  readonly requireBound?: boolean;
}

/**
 * Names in `docs/observe-events/` that are NOT events.
 *
 * The folder deliberately holds several kinds of file, enumerated in
 * `hygiene/audit-observe-event-filenames.ts` — that audit is the source of this
 * list, which is why this module does not restate its filename grammar. Two
 * kinds are not events at all:
 *
 *   * `.rs-buffer-<agent>.json` — a per-agent replay-state buffer written by
 *     `observe/run-loop-real.ts`. The audit's own words: "Not events; the
 *     leading dot is the marker." Its content is `{buffer, seq}` with no `id`,
 *     `at`, `action` or `by`.
 *   * `society-index.json` — the index scheme 2 maintains, not a member of it.
 *
 * THIS EXCLUSION IS NOT COSMETIC AND IT IS NOT GUESSED. Without it the first
 * dry run of this checker against live PR #12346 emitted four FAILs against
 * `.rs-buffer-otto.json` — missing `id`, `at`, `action`, and no `by` to bind —
 * which would have taken every flush batch red on a file that is behaving
 * exactly as designed. A check that fires on the honest case is worse than no
 * check: it teaches the fleet to ignore the signal.
 */
function isNotAnEventFile(base: string): boolean {
  return base.startsWith(".") || !base.endsWith(".json") || base === "society-index.json";
}

/**
 * A path this program will open. EXACT, not a prefix test.
 *
 * `startsWith("docs/observe-events/")` is true of
 * `docs/observe-events/../../.github/workflows/gate.yml`, so the comparison is
 * against a RECONSTRUCTED path instead: split off the last component and
 * require the whole string to equal `EVENT_DIR + "/" + that`. Anything carrying
 * an extra directory component, a `..`, a backslash or a newline cannot equal
 * it. Total by construction rather than by enumerating the bad cases.
 *
 * Note what the exclusion above can and cannot cost. A file this returns
 * `false` for is not judged HERE; it is still judged by `gate (required)`,
 * which owns filename shape. The only way to use the exclusion offensively is
 * to write a dot-prefixed or non-`.json` file — and such a file is not loaded
 * by `loadAttestationRecords`, which selects on `kind`, nor by anything that
 * folds trust. It buys an attacker no reading they did not already have.
 */
export function isDirectEventChild(path: string): boolean {
  const idx = path.lastIndexOf("/");
  if (idx < 0) return false;
  const base = path.slice(idx + 1);
  if (base === "" || base === "." || base === "..") return false;
  if (isNotAnEventFile(base)) return false;
  return path === `${EVENT_DIR}/${base}`;
}

/**
 * Check one flush batch.
 *
 * Deliberately does NOT judge non-event paths. Live flush batches carry
 * `db/mutation-findings/<agent>.jsonl`, `data/*`, `docs/history/pr-reviews/**`
 * and `docs/github/prs/shards/**` — measured on PRs #12344/#12345/#12346 — and
 * the predecessor's "sovereign path" allowlist named none of them. Had it been
 * armed unchanged it would have concluded `sovereign=false` on every real batch
 * and skipped every downstream step: a check that runs, inspects a real input,
 * and can never reach a verdict. Judging those paths is `gate (required)`'s job
 * and it actually does it.
 */
export function checkBatch(input: BatchInput): BatchReport {
  const producer = deriveProducer(input.branch);
  const findings: Finding[] = [];

  if (producer === null) {
    findings.push({
      severity: "fail",
      code: "no-producer",
      file: input.branch,
      detail:
        "the branch name does not name a producing agent, so there is nothing to bind this " +
        "batch to and nothing that could be said truthfully about who produced it",
    });
    return { producer: null, eventsInspected: 0, attestationsInspected: 0, findings };
  }

  let eventsInspected = 0;
  let attestationsInspected = 0;

  for (const path of input.changedPaths) {
    if (!isDirectEventChild(path)) continue;
    const body = input.readFile(path);
    if (body === null) continue; // removed by this batch — nothing to read

    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch (err) {
      findings.push({
        severity: "fail",
        code: "unreadable",
        file: path,
        detail: `not parseable as JSON: ${(err as Error).message}`,
      });
      continue;
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      findings.push({ severity: "fail", code: "not-an-object", file: path, detail: "event is not a JSON object" });
      continue;
    }
    eventsInspected++;
    const rec = parsed as Record<string, unknown>;

    for (const key of ["id", "at", "action"]) {
      if (!(key in rec)) {
        findings.push({ severity: "fail", code: "missing-field", file: path, detail: `missing required field: ${key}` });
      }
    }

    // CHECK 1 — the binding.
    const by = rec["by"];
    if (typeof by !== "string" || by.length === 0) {
      findings.push({
        severity: "fail",
        code: "producer-mismatch",
        file: path,
        detail: "no 'by' field — nothing binds this event to the producer the branch names",
      });
    } else if (by !== producer) {
      findings.push({
        severity: "fail",
        code: "producer-mismatch",
        file: path,
        detail: `branch names '${producer}', event says by: '${by}'`,
      });
    }

    // CHECK 2 — the record verifier #12256 built and nothing called.
    if (rec["kind"] !== "attestation") continue;
    const att = rec["attestation"];
    if (typeof att !== "object" || att === null) {
      findings.push({
        severity: "fail",
        code: "attestation-refused",
        file: path,
        detail: "kind is 'attestation' but the record carries no attestation object",
      });
      continue;
    }
    attestationsInspected++;
    const verdict = verifyAttestationRecord(parsed as AttestationRecord, { roster: input.roster });
    if (verdict.status === "refused") {
      findings.push({
        severity: "fail",
        code: "attestation-refused",
        file: path,
        detail: `${verdict.reason}: ${verdict.detail}`,
      });
    } else if (verdict.status === "unbound") {
      findings.push({
        severity: input.requireBound === true ? "fail" : "info",
        code: "attestation-unbound",
        file: path,
        detail: "no signature — `by` is a self-claim, not an attribution",
      });
    } else {
      findings.push({
        severity: "info",
        code: "attestation-bound",
        file: path,
        detail: `signer=${verdict.signer} (${verdict.signerSource})`,
      });
    }
  }

  // "Nothing failed" and "nothing was looked at" must not print the same sentence.
  // This is `info`, not `fail`: a flush batch legitimately carries no event files
  // when the tick produced only archives or repairs, and a lane going red for
  // being quiet is a check that punishes the honest case.
  if (eventsInspected === 0) {
    findings.push({
      severity: "info",
      code: "nothing-inspected",
      file: EVENT_DIR,
      detail: "this batch adds no readable event file, so the producer binding was not exercised",
    });
  }

  return { producer, eventsInspected, attestationsInspected, findings };
}

// ═══ rendering ═════════════════════════════════════════════════════════════

/**
 * A report as lines. Says what WAS checked and what was NOT — the second half is
 * the part the predecessor's approval body got wrong for the life of the file.
 */
export function renderReport(report: BatchReport, branch: string): readonly string[] {
  const out: string[] = [];
  out.push(`branch:   ${branch}`);
  out.push(`producer: ${report.producer ?? "(not derivable — refusing to verify)"}`);
  out.push(`inspected: ${report.eventsInspected} event file(s), ${report.attestationsInspected} attestation record(s)`);
  out.push("");
  for (const f of report.findings) {
    out.push(`${f.severity === "fail" ? "FAIL" : "info"}  ${f.file}  ${f.detail}`);
  }
  out.push("");
  out.push("NOT CHECKED, and deliberately not claimed:");
  out.push("  * WHO produced these events. `by` and the branch name are written by the same");
  out.push("    producer, so their agreement is a consistency property, not proof of authorship.");
  out.push("  * that any event is 'genuine' beyond the shape above. Nothing here re-derives or");
  out.push("    re-executes an event.");
  out.push("  * there is no second identity and no second key behind this run, so nothing it");
  out.push("    prints is a peer attestation.");
  return out;
}

// ═══ CLI ═══════════════════════════════════════════════════════════════════
//
// Usage:
//   bun src/Core.TypeScript/observe/verify-flush-batch.ts \
//     --branch heartbeat/otto-flush-<40hex> \
//     --files changed-paths.txt        # one repo-relative path per line; `-` = stdin
//     [--repo <path>] [--require-bound]
//
// Exit codes:
//   0  no failing finding
//   1  usage / environment error
//   2  at least one failing finding

import { buildPersonaRoster, discoverPersonaRosterPaths } from "./verify-attestation-events.ts";

function flagValue(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const branch = flagValue(argv, "--branch");
  const filesArg = flagValue(argv, "--files");
  const repo = flagValue(argv, "--repo") ?? process.cwd();

  if (branch === undefined || filesArg === undefined) {
    console.error("usage: verify-flush-batch.ts --branch <ref> --files <path|-> [--repo <path>] [--require-bound]");
    process.exit(1);
  }

  let listing: string;
  try {
    listing = filesArg === "-" ? await Bun.stdin.text() : readFileSync(filesArg, "utf8");
  } catch (err) {
    console.error(`[flush-batch] cannot read the changed-file list: ${(err as Error).message}`);
    process.exit(1);
  }
  const changedPaths = listing
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let roster: PersonaKeyRoster;
  try {
    roster = buildPersonaRoster(discoverPersonaRosterPaths(repo));
  } catch (err) {
    // An ambiguous persona roster is fatal, never a downgrade to "no roster":
    // verifying against an empty roster would REFUSE every signed record and
    // read as a batch defect rather than as the environment defect it is.
    console.error(`[flush-batch] ${(err as Error).message}`);
    process.exit(1);
  }

  const report = checkBatch({
    branch,
    changedPaths,
    roster,
    requireBound: argv.includes("--require-bound"),
    readFile: (p) => {
      const abs = join(repo, p);
      if (!existsSync(abs)) return null;
      try {
        return readFileSync(abs, "utf8");
      } catch {
        return null;
      }
    },
  });

  for (const line of renderReport(report, branch)) console.log(line);
  console.log(`[flush-batch] roster covers ${roster.size} persona(s)`);
  process.exit(hasFailure(report) ? 2 : 0);
}

if (import.meta.main) await main();
