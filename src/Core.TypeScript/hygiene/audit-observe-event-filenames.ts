#!/usr/bin/env bun
/**
 * audit-observe-event-filenames.ts — keep `docs/observe-events/` readable by shape.
 *
 * The folder deliberately holds THREE naming schemes, and every one of them is
 * distinguishable without decoding anything — which is the property being defended:
 *
 *   1. `<32-lowercase-hex>.json`  — a ZetaId (`observe/event-sink-folder.ts`
 *      `mintObserveEventIdHex`, and `observe/emit-attestation.ts`
 *      `deriveAttestationId`).
 *   2. `society-<base36-ms>.json` — the society evolution runner
 *      (`planning/society-evolution-runner.ts`), read back by prefix in
 *      `planning/society-event-index-rebuild.ts`. Load-bearing: do not rename.
 *   3. `.rs-buffer-<agent>.json`  — per-agent replay-state buffers
 *      (`observe/run-loop-real.ts`). Not events; the leading dot is the marker.
 *
 * Plus `society-index.json`, the index that scheme 2 maintains.
 *
 * Schemes 2 and 3 are exactly right: a prefix announces what a name IS before anyone
 * parses it. Scheme 1 is the one carrying no marker, which is why it is the one that
 * got forged.
 *
 * WHAT THIS CATCHES. On 2026-08-14 the folder also held three names like
 * `7b226174746573746f72223a22616c65.json`. `7b22` is `{"` — those filenames were the
 * event's own JSON, hex-encoded and truncated, produced by an id "mint" that did no
 * hashing. They are 32 lowercase hex characters, so every shape check in the repo
 * (`isCanonicalEventId`, a bare `/^[0-9a-f]{32}$/`) accepted them and readers such as
 * `observe/load-world.ts` let them through — a value that decodes to something
 * structurally valid and semantically meaningless. That is the failure this audit
 * exists to make loud: a hex-looking filename here is assumed to be a ZetaId, so one
 * that is not must not be able to arrive quietly.
 *
 * The producer defect is fixed (`emit-attestation.ts`); this guard is what stops it,
 * or anything shaped like it, from coming back.
 *
 * Usage: bun src/Core.TypeScript/hygiene/audit-observe-event-filenames.ts [--dir <path>]
 * Exit 0 = clean; exit 1 = an unclassifiable name, a bad decode, or a scan-floor breach.
 */

import { readdirSync } from "node:fs";
import { unpackGeneric } from "../zeta-id/zeta-id";
import { IdVersion, type ZetaId } from "../zeta-id/types";

export const EVENT_DIR = "docs/observe-events";

/**
 * Scan floor. A check that inspects nothing passes trivially, so this audit refuses to
 * report success on a corpus smaller than the one that existed when it was written
 * (1,431 files on 2026-08-14, floored well below that to leave room for pruning). If
 * the folder is legitimately emptied, lower this deliberately — the point is that the
 * number is a decision someone made, not a silence.
 */
export const SCAN_FLOOR = 500;

/**
 * The three malformed names that already exist. They are real recorded attestation
 * facts, so they are preserved rather than deleted (Memory Preservation, manifesto §5)
 * and frozen rather than renamed — nothing in the repo references them by id, so a
 * rename would buy nothing and rewrite history. This list is CLOSED: it is not a
 * category, it is three dated files. The audit fails if an entry goes missing, so the
 * allowlist cannot quietly become a licence for new ones.
 */
export const FROZEN_LEGACY_NAMES: readonly string[] = [
  "7b226174746573746f72223a22616c65.json", // {"attestor":"ale — alexa → society, 2026-08-09
  "7b226174746573746f72223a226f7474.json", // {"attestor":"ott — otto  → society, 2026-08-09
  "7b226174746573746f72223a22736f72.json", // {"attestor":"sor — soraya→ society, 2026-08-09
];

const ZETA_ID_NAME = /^[0-9a-f]{32}\.json$/;
const SOCIETY_NAME = /^society-[0-9a-z]+\.json$/;
const RS_BUFFER_NAME = /^\.rs-buffer-[A-Za-z0-9_-]+\.json$/;
/**
 * Named non-event companions of the society runner. NOT a scheme and not a pattern: a
 * CLOSED list of specific filenames, each of which must name its producer here.
 *
 * `bnn-state.json` was added 2026-08-17 after it reached main via #10708 and turned
 * `lint (structural hygiene)` red for every open PR. It is not an event — it is the
 * dimensional-BNN rollup written by `planning/society-bnn.ts`
 * (`SOCIETY_BNN_FILENAME`, path built in `bnnStatePath`) — so it belongs in exactly the
 * category `society-index.json` already occupies rather than in a widened event regex.
 *
 * Two things this does NOT do, deliberately:
 *   - It does not relax `ZETA_ID_NAME` or invent a `*-state.json` pattern. Widening a
 *     shape is how this audit would stop catching the hex-JSON class it exists for.
 *   - It does not settle whether a state rollup should live in an EVENTS folder at all.
 *     Relocating it changes the producer's write path and every reader, which is a
 *     larger call than unblocking main; this keeps the audit honest until that is made.
 *
 * `audit-observe-event-filenames.test.ts` asserts this set against the producers' own
 * exported constants, so a rename on either side fails there instead of drifting.
 */
export const COMPANION_NAMES = new Set([
  "society-index.json", // planning/society-event-index-rebuild.ts — the index scheme 2 maintains
  "bnn-state.json", // planning/society-bnn.ts — SOCIETY_BNN_FILENAME
]);
/** Folder documentation, not an event — `README.md` explains the schemes above. */
const DOC_NAMES = new Set(["README.md"]);

export interface AuditFinding {
  readonly file: string;
  readonly problem: string;
}

/**
 * Classify one filename. Returns null when the name is fine.
 *
 * The ZetaId branch does NOT stop at the regex — that regex is exactly what let the
 * hex-JSON names through. It decodes and checks the version field, which is what
 * actually distinguishes an id from arbitrary hex.
 */
export function auditFilename(file: string): AuditFinding | null {
  if (COMPANION_NAMES.has(file) || DOC_NAMES.has(file)) return null;
  if (SOCIETY_NAME.test(file) || RS_BUFFER_NAME.test(file)) return null;
  if (FROZEN_LEGACY_NAMES.includes(file)) return null;

  if (!file.endsWith(".json")) {
    return { file, problem: "not a .json file — this folder holds only events" };
  }

  if (!ZETA_ID_NAME.test(file)) {
    return {
      file,
      problem:
        "matches no known scheme (expected 32-hex ZetaId or `society-<base36>`); " +
        "a new scheme needs a distinguishing prefix, not a new hex shape",
    };
  }

  // It looks like a ZetaId. Confirm it actually is one.
  let version: number;
  try {
    version = unpackGeneric(BigInt(`0x${file.slice(0, 32)}`) as ZetaId).version;
  } catch (err) {
    return { file, problem: `32-hex but does not decode as a ZetaId: ${(err as Error).message}` };
  }

  if (version !== IdVersion.V1) {
    const decoded = Buffer.from(file.slice(0, 32), "hex").toString("utf8");
    const printable = /^[\x20-\x7e]+$/.test(decoded) ? ` — decodes to ASCII ${JSON.stringify(decoded)}` : "";
    return {
      file,
      problem:
        `32-hex but ZetaId version is ${version}, not ${IdVersion.V1}${printable}. ` +
        "This is hex that is not an id: it will pass `isCanonicalEventId` and be read as an event id anyway",
    };
  }

  return null;
}

export interface AuditResult {
  readonly scanned: number;
  readonly findings: readonly AuditFinding[];
  readonly missingFrozen: readonly string[];
}

export function auditFilenames(files: readonly string[]): AuditResult {
  const findings: AuditFinding[] = [];
  for (const f of files) {
    const finding = auditFilename(f);
    if (finding) findings.push(finding);
  }
  const present = new Set(files);
  const missingFrozen = FROZEN_LEGACY_NAMES.filter((n) => !present.has(n));
  return { scanned: files.length, findings, missingFrozen };
}

function main(): void {
  const argv = process.argv.slice(2);
  const dirIdx = argv.indexOf("--dir");
  const dir = dirIdx >= 0 && argv[dirIdx + 1] ? argv[dirIdx + 1]! : EVENT_DIR;
  // A caller-supplied `--dir` is a test fixture, not the corpus, so the two
  // corpus-shaped assertions (scan floor, frozen-file presence) do not apply to it.
  // Name-classification always applies — that is the part a fixture is testing.
  const isCorpus = dirIdx < 0;

  let files: string[];
  try {
    files = readdirSync(dir);
  } catch (err) {
    console.error(`[observe-event-filenames] cannot read ${dir}: ${(err as Error).message}`);
    process.exit(1);
  }

  const { scanned, findings, missingFrozen } = auditFilenames(files);
  let failed = false;

  if (isCorpus && scanned < SCAN_FLOOR) {
    console.error(
      `[observe-event-filenames] SCAN FLOOR BREACH: inspected ${scanned} files, floor is ${SCAN_FLOOR}.\n` +
        "  A check that inspects almost nothing is not a passing check. Either the path is wrong\n" +
        `  or the corpus shrank; if the shrink is real, lower SCAN_FLOOR deliberately.`,
    );
    failed = true;
  }

  for (const n of isCorpus ? missingFrozen : []) {
    console.error(`[observe-event-filenames] frozen legacy file is missing: ${n}`);
    failed = true;
  }

  for (const f of findings) {
    console.error(`[observe-event-filenames] ${f.file}\n    ${f.problem}`);
    failed = true;
  }

  if (failed) {
    console.error(`\n[observe-event-filenames] FAIL — ${findings.length} bad name(s) of ${scanned} scanned.`);
    process.exit(1);
  }

  console.log(`[observe-event-filenames] OK — ${scanned} files, all names classifiable by shape.`);
}

if (import.meta.main) main();
