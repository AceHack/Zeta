#!/usr/bin/env bun
// The falsifier for `tools/setup/manifests/from-url-rolling-exceptions`.
//
// An exception with no enforcement is a licence, so this is the enforcement.
// The maintainer authorised auto-accept on a rolling `from-url` row as a
// TEMPORARY concession (2026-09-09: "this is not a permanent fix, it just until
// we don't need the new features anymore"). A concession whose temporariness
// lives in a comment is permanent — somebody has to notice a comment, and
// nobody does. So the expiry is a DATE THIS LINT ENFORCES, and the gate goes
// red on the day it passes.
//
// WHAT IT REFUSES, and each one is a hole somebody could otherwise widen:
//
//   1. an exception for a dest that is not a `rolling=` row in
//      `tools/setup/manifests/from-url`. On an IMMUTABLE upstream, changed
//      bytes are a supply-chain event, and auto-accepting one is the worst
//      thing this feature could ever be used for.
//   2. `accept=` anything but `auto`. A closed set of one. A typo must be a
//      refusal, never a fall-through to permissive.
//   3. a missing, malformed, or PAST `expires=`. Past ⇒ red gate.
//   4. `expires=` more than MAX_EXCEPTION_DAYS past `declared=`. Without this,
//      `expires=2099-01-01` is a permanent exception wearing a date.
//   5. a `declared=` in the future, or after `expires=`. A row that has not
//      started yet, or that expires before it begins, is a defect.
//   6. a missing `tradeoff=` doc, one that is not in the tree, one that does
//      not name the dest, or one that never states what an ATTACKER gains.
//      The maintainer made this call knowingly; the cost has to be written
//      down where the next reader finds it, or the knowledge dies with the
//      session that made it.
//   7. a missing `exitcheck=`, or one whose script is not in the tree. The
//      row's PREMISE must have a falsifier, not a paragraph.
//   8. `verify=` naming a script that is not in the tree. `deferred` is
//      allowed and is an honest answer; a path that does not resolve is not.
//   9. two rows for the same dest. Ambiguity is not a licence.
//
// WHAT IT DELIBERATELY DOES NOT DO: run anything, or reach the network. It is
// an offline gate step. `exitcheck=` is RUN as its own gate step beside this
// one — a declared-but-never-executed check would be precisely the defect this
// file exists to prevent, one level up.
//
// 081M24396B2087G0R000MDMDEA

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ACCEPTS_LEDGER,
  EXCEPTIONS_MANIFEST,
  MAX_EXCEPTION_DAYS,
  daysBetween,
  isCalendarDate,
  parseRollingExceptions,
  readAcceptanceLedger,
  verifyArgv,
  type RollingException,
} from "../ace/setup-realizers/rolling-exception.ts";
import { parseFromUrlPins } from "./lint-verifier-jar-provenance.ts";

const FROM_URL_MANIFEST = "tools/setup/manifests/from-url";

export interface ExceptionInputs {
  readonly exceptionsText: string;
  readonly fromUrlText: string;
  readonly today: string;
  /**
   * Does this SCRIPT path exist? A bare stat with nothing read behind it -- the
   * row declares an argv, and what is checked is that the command names
   * something in the tree, never what is inside it.
   */
  readonly present: (rel: string) => boolean;
  /**
   * The doc's text, or null when it is simply not there.
   *
   * ONE SYSCALL, ONE ANSWER. This was an `existsSync` gate followed by a
   * `readFileSync`, which is the check-then-use race (CWE-367) this repo's own
   * lint refuses -- and which two other files in this same change already state
   * out loud is wrong. Between the check and the use the path can be created,
   * deleted or replaced, so the check reads as defensive and prevents nothing.
   */
  readonly readDoc: (rel: string) => string | null;
}

/** The first token of a colon-encoded argv — the script path. */
export function argvScript(argv: readonly string[]): string {
  return argv[0] ?? "";
}

function checkTradeoffDoc(row: RollingException, inputs: ExceptionInputs, failures: string[]): void {
  const doc = row.tradeoff;
  if (doc === null || doc === "") {
    failures.push(
      `${EXCEPTIONS_MANIFEST}:${String(row.line)} ${row.dest} has no tradeoff= doc.` +
        " An exception whose cost is unwritten is one the next reader cannot weigh.",
    );
    return;
  }
  let text: string | null;
  try {
    text = inputs.readDoc(doc);
  } catch {
    failures.push(`${EXCEPTIONS_MANIFEST}:${String(row.line)} tradeoff=${doc} is unreadable`);
    return;
  }
  if (text === null) {
    failures.push(
      `${EXCEPTIONS_MANIFEST}:${String(row.line)} ${row.dest} cites tradeoff=${doc}, which is not in the tree`,
    );
    return;
  }
  if (!text.includes(row.dest)) {
    failures.push(
      `${EXCEPTIONS_MANIFEST}:${String(row.line)} tradeoff=${doc} never names ${row.dest}` +
        " -- a doc that does not name the ref it excuses is not that ref's tradeoff",
    );
  }
  // The requirement the maintainer's own framing implies: say what someone who
  // controls that URL could DO while this is live. Checking for the word is
  // crude and it is not a proof that the paragraph is good -- what it buys is
  // that the section cannot be quietly dropped, which is the failure that
  // actually happens.
  if (!/attacker/i.test(text)) {
    failures.push(
      `${EXCEPTIONS_MANIFEST}:${String(row.line)} tradeoff=${doc} never says what an ATTACKER` +
        " gains while this exception is live -- state the cost, do not soften it",
    );
  }
}

export function checkRollingExceptions(inputs: ExceptionInputs): string[] {
  const failures: string[] = [];
  const rows = parseRollingExceptions(inputs.exceptionsText);
  const pins = parseFromUrlPins(inputs.fromUrlText);
  const seen = new Map<string, number>();

  for (const row of rows) {
    const at = `${EXCEPTIONS_MANIFEST}:${String(row.line)}`;
    const previous = seen.get(row.dest);
    if (previous !== undefined) {
      failures.push(
        `${at} is a SECOND exception row for ${row.dest} (first at line ${String(previous)}).` +
          " Two rows for one ref is an ambiguous declaration, and the realizer refuses both.",
      );
    }
    seen.set(row.dest, row.line);

    const pin = pins.find((candidate) => candidate.dest === row.dest);
    if (pin === undefined) {
      failures.push(`${at} names ${row.dest}, which has no row in ${FROM_URL_MANIFEST}`);
    } else if (pin.rolling === null) {
      failures.push(
        `${at} names ${row.dest}, which is NOT a rolling= row. On an immutable upstream a` +
          " byte change is a supply-chain event, never a rebuild, and must never auto-accept.",
      );
    }

    if (row.accept !== "auto") {
      failures.push(`${at} has accept=${String(row.accept)}; the only permitted mode is accept=auto`);
    }

    if (row.expires === null || !isCalendarDate(row.expires)) {
      failures.push(`${at} has expires=${String(row.expires)}, which is not a calendar date (YYYY-MM-DD)`);
    } else if (daysBetween(inputs.today, row.expires) < 0) {
      failures.push(
        `${at} EXPIRED on ${row.expires} (today is ${inputs.today}). The exception is already` +
          " inert at install time; retire the row, or re-declare it with a fresh reason and date.",
      );
    }

    if (row.declared === null || !isCalendarDate(row.declared)) {
      failures.push(`${at} has declared=${String(row.declared)}, which is not a calendar date`);
    } else if (daysBetween(inputs.today, row.declared) > 0) {
      failures.push(`${at} has declared=${row.declared}, which is in the future (today is ${inputs.today})`);
    } else if (row.expires !== null && isCalendarDate(row.expires)) {
      const span = daysBetween(row.declared, row.expires);
      if (span < 0) {
        failures.push(`${at} expires=${row.expires} precedes declared=${row.declared}`);
      } else if (span > MAX_EXCEPTION_DAYS) {
        failures.push(
          `${at} runs ${String(span)} days (declared=${row.declared} expires=${row.expires}), over the` +
            ` ${String(MAX_EXCEPTION_DAYS)}-day ceiling. A longer window is a permanent exception with a date on it.`,
        );
      }
    }

    checkTradeoffDoc(row, inputs, failures);

    const exitArgv = verifyArgv(row.exitcheck);
    if (row.exitcheck === null || row.exitcheck === "" || exitArgv === null) {
      failures.push(
        `${at} declares no exitcheck= argv. The row's PREMISE needs a falsifier: when the` +
          " reason for the exception stops being true, something has to go red.",
      );
    } else if (!inputs.present(argvScript(exitArgv))) {
      failures.push(`${at} has exitcheck=${row.exitcheck}, whose script ${argvScript(exitArgv)} is not in the tree`);
    }

    const verifyArgvParsed = verifyArgv(row.verify);
    if (row.verify === null || row.verify === "") {
      failures.push(`${at} declares no verify=. Use verify=deferred to say so honestly, or name an argv.`);
    } else if (verifyArgvParsed !== null && !inputs.present(argvScript(verifyArgvParsed))) {
      failures.push(`${at} has verify=${row.verify}, whose script ${argvScript(verifyArgvParsed)} is not in the tree`);
    }
  }
  return failures;
}

/** The file's text, or null when it is simply not there. Never a throw for absence. */
export function readTextOrNull(absPath: string): string | null {
  try {
    return readFileSync(absPath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException | undefined)?.code === "ENOENT") return null;
    throw err;
  }
}

function realInputs(repoRoot: string): ExceptionInputs {
  let exceptionsText = "";
  try {
    exceptionsText = readFileSync(join(repoRoot, EXCEPTIONS_MANIFEST), "utf8");
  } catch (err) {
    // No manifest means no exceptions, which is the STRICT state: every rolling
    // row then fails closed. Nothing to lint, and saying "0 findings" about it
    // is honest rather than vacuous.
    if ((err as NodeJS.ErrnoException | undefined)?.code !== "ENOENT") throw err;
  }
  return {
    exceptionsText,
    fromUrlText: readFileSync(join(repoRoot, FROM_URL_MANIFEST), "utf8"),
    today: new Date().toISOString().slice(0, 10),
    present: (rel) => existsSync(join(repoRoot, rel)),
    readDoc: (rel) => readTextOrNull(join(repoRoot, rel)),
  };
}

if (import.meta.main) {
  const repoRoot = join(import.meta.dir, "..", "..", "..");
  const inputs = realInputs(repoRoot);
  const failures = checkRollingExceptions(inputs);
  for (const failure of failures) process.stderr.write("FAIL " + failure + "\n");
  if (failures.length > 0) process.exit(1);
  const rows = parseRollingExceptions(inputs.exceptionsText);
  process.stdout.write(
    rows.length === 0
      ? "OK no rolling auto-accept exceptions are declared (every rolling row fails closed)\n"
      : rows.map((row) => `OK ${row.dest} accept=${String(row.accept)} expires=${String(row.expires)}\n`).join(""),
  );

  // THE READ BOUNDARY, and the fold's consumer. Reading through
  // `readAcceptanceLedger` rather than the file is the whole point: duplicate
  // lines written by racing installs fold to one fact here, which is what lets
  // the writers stay lock-free. `occurrences > 1` is reported rather than hidden
  // -- it is the only evidence the ledger keeps that two installs raced.
  //
  // In CI the ledger is normally ABSENT (it is untracked and per-machine), so
  // this prints one honest line and claims nothing. A fold nothing ever read
  // would be a golden vector nobody opens.
  const accepted = readAcceptanceLedger(repoRoot);
  if (accepted.length === 0) {
    process.stdout.write(`-- no local acceptances recorded in ${ACCEPTS_LEDGER}\n`);
  } else {
    for (const record of accepted) {
      const raced = record.occurrences > 1 ? `  (folded ${String(record.occurrences)} racing writes)` : "";
      process.stdout.write(
        `-- accepted ${record.dest} ${String(record.from).slice(0, 8)} -> ${String(record.to).slice(0, 8)}` +
          ` verdict=${String(record.verdict)} first-seen=${String(record.when)}${raced}\n`,
      );
    }
  }
}
