#!/usr/bin/env bun
// lint-local-clock-fields-never-read.ts — the mechanical guard behind
// `.claude/rules/local-time-never-enters-the-shared-fold.md` (§13 noninterference, on time).
//
// THE RULE, in one line: a node's local wall-clock / receive-order may steer LOCAL actions
// (timeouts, retransmit, UI, "stale to me"); it must NEVER filter, weight, reorder, or
// de-duplicate the evidence entering a shared commutative fold — because every node's local
// stamp differs, so nodes would fold different evidence and DIVERGE.
//
// WHY A "NEVER READ" CHECK RATHER THAN A "NEVER SORT" CHECK:
//   Pattern-matching every way a field could reach a fold (sortBy, sortWith, groupBy, distinctBy,
//   filter, maxBy, a let-bound projection, a helper three calls away, ...) is a losing game and the
//   kind of fuzzy regex lint that quietly stops matching. The declared local-clock fields registered
//   below are instead **write-only by design**: they are stamped and never consulted. That makes the
//   check total and sharp — ANY read is a violation, and the tempting `sortBy (fun v -> v.LocalObservedAt)`
//   is a read, so it is caught by construction rather than by enumeration.
//
//   A legitimate LOCAL reader (a retransmit timer, a UI freshness badge) is not forbidden by the rule
//   — but it must be added to READ_ALLOWLIST deliberately, which is exactly the "without anyone
//   noticing" that the rule exists to prevent.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/lint-local-clock-fields-never-read.ts
//
// Exit codes:
//   0   clean — every registered field is declared exactly where the registry says, and has no readers
//   1   a registered field was READ (a local clock can reach a shared fold)
//   2   the guard could not do its job: a registered field's declaration is missing/moved, or the
//       scan floor was not met. A check that inspected nothing must not report success.

import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/** A field that carries a node's LOCAL wall-clock and therefore must never be consulted. */
interface LocalClockField {
  /** Record field name as it appears in source. Must be distinctive enough to grep. */
  readonly field: string;
  /** File that declares it, repo-relative. The declaration must still be there — see EXIT 2. */
  readonly declaredIn: string;
  /** The shared fold this field is reachable from — what would diverge if it were read. */
  readonly foldAtRisk: string;
}

/**
 * THE REGISTRY. Add a row when a type that is reachable from a shared fold gains a wall-clock field.
 *
 * Deliberately NOT auto-discovered: "find every DateTimeOffset field" would sweep in genuinely-local
 * structures (Limit grant evidence, ZetaId's 48-bit encoded field) and the noise would get the lint
 * disabled. The registry is the claim; the scan floor below is what stops the claim going stale.
 */
const REGISTRY: readonly LocalClockField[] = [
  {
    field: "LocalObservedAt",
    declaredIn: "src/Core/Consensus.fs",
    foldAtRisk: "Consensus.decide — the BFT quorum fold over the vote evidence set",
  },
];

/**
 * Sites permitted to READ a registered field, with the local action that justifies it.
 * Empty today: no local consumer exists yet. Adding a row here is a deliberate, reviewable act and
 * must name the LOCAL action (never a fold input).
 */
const READ_ALLOWLIST: readonly { readonly field: string; readonly file: string; readonly why: string }[] = [];

/** Directories the reader-scan covers. A field read anywhere in here is a violation. */
const SCAN_ROOTS: readonly string[] = ["src", "tests"];

/**
 * SCAN FLOOR — the anti-no-op clause.
 *
 * A grep-based guard fails open in the ugliest way: the pattern stops matching (field renamed, file
 * moved, ripgrep absent, roots emptied) and the lint reports GREEN while checking nothing. So the
 * guard asserts on its own work before it reports: the registry must be non-empty, every declaration
 * must still be found, and the scan must have actually walked a plausible number of files.
 *
 * 200 is far below the real count (the F#/C#/TS tree is thousands of files) and far above anything a
 * broken invocation would produce, so it discriminates a no-op without being brittle.
 */
const MIN_FILES_SCANNED = 200;
const MIN_REGISTRY_ROWS = 1;

const SELF_PATH = "src/Core.TypeScript/hygiene/lint-local-clock-fields-never-read.ts";

interface Read {
  readonly field: string;
  readonly file: string;
  readonly line: number;
  readonly text: string;
}

/** Source extensions worth scanning. A local clock can only be read from code. */
const SOURCE_EXTENSIONS: readonly string[] = [".fs", ".fsi", ".fsx", ".cs", ".ts", ".tsx", ".rs", ".go", ".py"];

/**
 * The files this guard inspects: tracked source files under the scan roots.
 *
 * Uses `git ls-files` rather than ripgrep. The first version shelled out to `rg`, which is NOT
 * installed on the CI runner — so `countScannedFiles()` returned 0, the scan floor tripped, and the
 * job exited 2. That was the floor working exactly as designed (it refused to report success while
 * blind) but a guard that cannot run is still a guard that does not guard, so the dependency is gone.
 * `git` is guaranteed present wherever this repo is checked out.
 */
export function listScannedFiles(): string[] {
  const r = spawnSync("git", ["ls-files", "-z", "--", ...SCAN_ROOTS], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  if (r.status !== 0 || !r.stdout) return [];
  return r.stdout
    .split("\0")
    .filter((f) => f.length > 0 && SOURCE_EXTENSIONS.some((e) => f.endsWith(e)));
}

/**
 * Blank out spans that MENTION a field without USING it, so they cannot register as reads: comment
 * tails (`//`, `///`, `(*`) and F# backtick-quoted identifiers — which is how a test NAME containing
 * the field name would otherwise trip the guard. Replaced with spaces, not removed, so offsets hold.
 */
export function blankNonCode(line: string): string {
  let out = line.replace(/``[^`]*``/g, (m) => " ".repeat(m.length));
  const comment = out.search(/\/\/|\(\*/);
  if (comment >= 0) out = out.slice(0, comment) + " ".repeat(out.length - comment);
  return out;
}

/**
 * True when `line` READS `field`. Classifies EACH OCCURRENCE, not each line — a line-level verdict
 * would let a mutant hide beside a construction on the same line. An occurrence is NOT a read when
 * it is a declaration (`Field : Type`) or a record label being set (`Field = expr`, including the
 * module-qualified `C.Field = expr` that cross-verify tests use). Everything else is a read:
 * `v.Field`, `a.Field > b.Field`, a bare `Field` in an expression.
 *
 * Erring toward "call it a read" is correct for a guard — a false alarm costs one allowlist row, a
 * false silence costs a divergence bug that only shows up under partition and skew.
 */
export function readsField(field: string, line: string): boolean {
  const code = blankNonCode(line);
  const re = new RegExp("\\b" + field + "\\b", "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    const after = code.slice(m.index + field.length);
    if (/^\s*:/.test(after)) continue; // declaration `Field: Type`
    if (/^\s*=(?!=)/.test(after)) continue; // record label set `Field = expr`
    return true; // a genuine read
  }
  return false;
}

/** Scan the given files in-process for reads of `field`. No external tool, no shell, no PATH. */
function findReads(field: string, files: readonly string[]): Read[] {
  const reads: Read[] = [];
  for (const file of files) {
    if (file === SELF_PATH) continue; // the registry naming the field is not a read
    if (file.endsWith(".test.ts")) continue; // the guard's own mutant fixtures

    let content: string;
    try {
      content = readFileSync(resolve(REPO_ROOT, file), "utf8");
    } catch {
      continue; // unreadable/binary — cannot contain a source read
    }
    if (!content.includes(field)) continue; // cheap reject before line splitting

    let lineNo = 0;
    for (const text of content.split("\n")) {
      lineNo += 1;
      const stripped = text.trim();
      // whole-line doc/comment forms `blankNonCode` does not catch at column 0
      if (stripped.startsWith("*")) continue;
      if (!readsField(field, text)) continue;
      reads.push({ field, file, line: lineNo, text: stripped });
    }
  }
  return reads;
}

function main(): number {
  const problems: string[] = [];

  // ---- floor 1: the registry must make a claim at all -------------------------------------
  if (REGISTRY.length < MIN_REGISTRY_ROWS) {
    console.error(`SCAN FLOOR: registry has ${REGISTRY.length} rows, minimum ${MIN_REGISTRY_ROWS}.`);
    console.error("An empty registry makes this lint a no-op that reports success. Refusing.");
    return 2;
  }

  // ---- floor 2: every declaration must still exist where the registry says -----------------
  // This is what catches the field being renamed or deleted out from under the guard.
  for (const row of REGISTRY) {
    const abs = resolve(REPO_ROOT, row.declaredIn);
    if (!existsSync(abs)) {
      console.error(`SCAN FLOOR: ${row.declaredIn} does not exist (registry row '${row.field}').`);
      return 2;
    }
    const src = readFileSync(abs, "utf8");
    if (!new RegExp("(^|[^.\\w])" + row.field + "\\s*:").test(src)) {
      console.error(`SCAN FLOOR: field '${row.field}' is no longer declared in ${row.declaredIn}.`);
      console.error("Renamed or removed? Update REGISTRY in this file — a guard that cannot find its");
      console.error("subject must fail, not pass.");
      return 2;
    }
  }

  // ---- floor 3: the scan must have actually walked the tree --------------------------------
  const files = listScannedFiles();
  const scanned = files.length;
  if (scanned < MIN_FILES_SCANNED) {
    console.error(`SCAN FLOOR: inspected ${scanned} files, minimum ${MIN_FILES_SCANNED}.`);
    console.error("A check that did not run must not look like a check that passed.");
    return 2;
  }

  // ---- the actual check --------------------------------------------------------------------
  for (const row of REGISTRY) {
    for (const read of findReads(row.field, files)) {
      const allowed = READ_ALLOWLIST.some((a) => a.field === read.field && a.file === read.file);
      if (allowed) continue;
      problems.push(
        `${read.file}:${read.line}  reads '${read.field}'\n` +
          `    ${read.text}\n` +
          `    '${row.field}' is a LOCAL wall-clock stamp, reachable from ${row.foldAtRisk}.\n` +
          `    Reading it risks steering the shared fold by local receive-time ⇒ nodes diverge.`,
      );
    }
  }

  if (problems.length > 0) {
    console.error("local-time-never-enters-the-shared-fold: local clock field(s) READ\n");
    for (const p of problems) console.error(p + "\n");
    console.error(`${problems.length} violation(s).`);
    console.error("If this is a genuinely LOCAL use (retransmit timer, timeout, UI freshness) it is");
    console.error("permitted by the rule — add it to READ_ALLOWLIST with the local action named.");
    console.error("If it feeds a fold input, it is the divergence bug the rule was carved to prevent.");
    return 1;
  }

  console.log(
    `local-clock fields never read: OK — ${REGISTRY.length} registered field(s), ` +
      `${scanned} files scanned, ${READ_ALLOWLIST.length} allow-listed reader(s).`,
  );
  for (const row of REGISTRY) {
    console.log(`  ${row.field}  (${row.declaredIn})  guards: ${row.foldAtRisk}`);
  }
  return 0;
}

// Run ONLY when invoked directly. Without this guard, importing the module for unit tests executes
// the lint and calls `process.exit` mid-import — which killed the test process with status 0 and made
// a suite that had run ZERO tests report success. Caught 2026-08-14 while proving this very guard
// could fail; a check whose own test harness cannot fail is the failure mode it was written against.
if (import.meta.main) {
  process.exit(main());
}
