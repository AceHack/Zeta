// rolling-exception.ts — the DECLARED, RECORDED exception that lets one rolling
// `from-url` row auto-accept rebuilt bytes instead of wedging `install.sh`.
//
// THE MAINTAINER'S RULING, 2026-09-09, verbatim:
//
//   "okay i think we can just allow for the roll and update for now, i know
//    that is not great from a security point of view but this is not a
//    permanent fix, it just until we don't need the new features anymore, we
//    are going to need this exception path we can just save the exceptions
//    somewhere and let it not break install.sh."
//
// Three things in that sentence shape every decision in this file, and none of
// them is "turn the check off":
//
//   1. "we can just save the exceptions SOMEWHERE" — the exception is DATA, in
//      a committed, reviewable, per-ref manifest. Not a flag, not an env var,
//      not a `--force`. A blanket "ignore mismatches" switch does not exist
//      here and must never be added: `activeExceptionFor` matches ONE dest
//      exactly, and everything without a row keeps failing closed.
//   2. "not a permanent fix" — every row carries `expires=`, and an expired row
//      does not auto-accept AND turns the gate red
//      (`hygiene/lint-rolling-exceptions.ts`). The expiry is mechanical, not a
//      comment somebody is supposed to notice.
//   3. "let it not break install.sh" — the scope is PROVISIONING. This buys a
//      machine that finishes installing. It does not, and must not, buy a green
//      verifier claim: see THE SECURITY TRADEOFF below.
//
// ── WHAT AUTO-ACCEPT ACTUALLY COSTS ──────────────────────────────────────────
//
// Stated plainly because the maintainer made this call knowingly and it is not
// the reader's job to reconstruct it. While an exception is live, WHOEVER CAN
// CHOOSE THE BYTES BEHIND THAT URL CHOOSES THE VERIFIER THIS REPO RUNS. For
// `src/Core.TLA/tla2tools.jar` that is anyone who can publish to the tlaplus
// release tag, plus anyone who can forge the TLS-terminated response to it. A
// hostile build could report every model as passing, and the digest — which is
// the only thing that ever said which bytes arrived — would no longer refuse
// it. That is the price of the row, it is real, and it is bounded only by the
// expiry date and by the fact that exactly one row exists.
//
// WHAT IS NOT GIVEN UP, and this is why the trade is takeable:
//
//   * The record. Every acceptance appends a line to the local ledger naming
//     both digests, the clock, and whether a verification ran and what it said.
//     An auto-accept with no record would convert a LOUD failure into a SILENT
//     one, which is strictly worse than the thing it replaces.
//   * The pin. The manifest still pins the old digest, and every downstream
//     restatement of it (`registry/tlc-models.json` versionBanner, the docs)
//     still disagrees with the accepted bytes and still says so. The verifier
//     lane stays red until somebody runs `repin-rolling.ts`, which re-measures.
//     So provisioning is unblocked and NO CLAIM IS LAUNDERED.
//   * Fail-closed everywhere else. No exception row, an expired one, a
//     malformed digest, a non-rolling row, or a transport failure: all still
//     throw. The hole is exactly one declared ref wide.
//
// 081M24396B2087G0R000MDMDEA

import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** The committed, reviewed declaration. One row per ref, never a wildcard. */
export const EXCEPTIONS_MANIFEST = "tools/setup/manifests/from-url-rolling-exceptions";

/**
 * The acceptance ledger. UNTRACKED (`.zeta/` is gitignored) and deliberately so:
 * install.sh runs on dev laptops, CI runners and devcontainer layers, and a
 * ledger inside the committed tree would dirty every one of them and collide on
 * merge. What is committed is the DECLARATION; what is local is the RECORD of
 * this machine's acceptances.
 *
 * It is emphatically NOT `from-url-rolling-receipts`. That ledger means "this
 * digest was JUDGED by a re-measure that passed" and is what buys a moved pin.
 * Writing an auto-accept into it would be the exact laundering the whole regime
 * exists to stop — accepting is not measuring, and the two ledgers are kept
 * apart so nothing can confuse them.
 */
export const ACCEPTS_LEDGER = ".zeta/from-url-rolling-accepts";

export interface RollingException {
  readonly dest: string;
  /** `accept=` — a closed set of one: `auto`. Anything else is refused. */
  readonly accept: string | null;
  /** `verify=` — colon-encoded argv run BEFORE accepting, or `deferred`. */
  readonly verify: string | null;
  /** `expires=` — the day the exception stops working. Past ⇒ inert AND gate-red. */
  readonly expires: string | null;
  /** `declared=` — when the row was written; bounds how far `expires` may reach. */
  readonly declared: string | null;
  /** `exitcheck=` — colon-encoded argv falsifying the row's stated PREMISE. */
  readonly exitcheck: string | null;
  /** `tradeoff=` — the doc stating what an attacker gains while this is live. */
  readonly tradeoff: string | null;
  /** 1-based line in the manifest, for findings that must name a place. */
  readonly line: number;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A real calendar day, not merely a well-shaped string. `2026-02-31` matches the
 * regex and is not a date; a row expiring on a day that does not exist would sit
 * in the tree looking checked.
 */
export function isCalendarDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(value + "T00:00:00Z");
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}

/** Whole days from `from` to `to`, negative when `to` precedes `from`. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(from + "T00:00:00Z");
  const b = Date.parse(to + "T00:00:00Z");
  return Math.round((b - a) / 86_400_000);
}

/**
 * The longest an exception may be declared for. A POLICY number and named as
 * one: 90 days is a judgement about how long a temporary security concession may
 * sit unrevisited, not a measurement of anything. Its job is to make `expires=`
 * unable to become `expires=2099-01-01`, which is a permanent exception wearing
 * a temporary one's clothes.
 */
export const MAX_EXCEPTION_DAYS = 90;

export function parseRollingExceptions(text: string): readonly RollingException[] {
  const rows: RollingException[] = [];
  const lines = text.split("\n");
  for (let index = 0; index < lines.length; index++) {
    const line = (lines[index] ?? "").trim();
    if (line === "" || line.startsWith("#")) continue;
    const tokens = line.split(/\s+/);
    const dest = tokens[0];
    if (dest === undefined) continue;
    let accept: string | null = null;
    let verify: string | null = null;
    let expires: string | null = null;
    let declared: string | null = null;
    let exitcheck: string | null = null;
    let tradeoff: string | null = null;
    for (const token of tokens.slice(1)) {
      if (token.startsWith("accept=")) accept = token.slice("accept=".length);
      else if (token.startsWith("verify=")) verify = token.slice("verify=".length);
      else if (token.startsWith("expires=")) expires = token.slice("expires=".length);
      else if (token.startsWith("declared=")) declared = token.slice("declared=".length);
      else if (token.startsWith("exitcheck=")) exitcheck = token.slice("exitcheck=".length);
      else if (token.startsWith("tradeoff=")) tradeoff = token.slice("tradeoff=".length);
    }
    rows.push({ dest, accept, verify, expires, declared, exitcheck, tradeoff, line: index + 1 });
  }
  return rows;
}

/**
 * The one function that decides whether bytes may be auto-accepted, and the one
 * place that could ever widen the hole. It is deliberately joyless:
 *
 *   * `dest` is compared with `===`. No prefix, no glob, no `*` row. A manifest
 *     line reading `*  accept=auto` matches the literal dest `*` and nothing
 *     else, which is the design: THERE IS NO GLOBAL SWITCH TO FIND.
 *   * `accept` must be exactly `auto`. An unknown mode is refused, so a typo or
 *     a future mode nobody implemented cannot fall through to permissive.
 *   * `expires` must be a real day and must not be in the past. An expired
 *     exception is INERT — the caller fails closed exactly as if no row existed.
 *   * two rows for one dest refuse BOTH. An ambiguous declaration is not a
 *     licence; it is a defect, and picking the first would let a permissive
 *     duplicate hide under a strict one.
 *
 * `today` is passed in rather than read from a clock: the decision has to be
 * reachable from a test, and a policy that consults an ambient clock is one that
 * cannot be replayed (§13 noninterference).
 */
export function activeExceptionFor(
  rows: readonly RollingException[],
  dest: string,
  today: string,
): RollingException | null {
  const matches = rows.filter((row) => row.dest === dest);
  if (matches.length !== 1) return null;
  const row = matches[0] as RollingException;
  if (row.accept !== "auto") return null;
  if (row.expires === null || !isCalendarDate(row.expires)) return null;
  if (!isCalendarDate(today)) return null;
  if (daysBetween(today, row.expires) < 0) return null;
  return row;
}

export function loadRollingExceptions(repoRoot: string): readonly RollingException[] {
  let text: string;
  try {
    text = readFileSync(join(repoRoot, EXCEPTIONS_MANIFEST), "utf8");
  } catch (err) {
    // ABSENT MEANS NO EXCEPTIONS, which is the strict answer, not the lenient
    // one: with no rows every mismatch fails closed. Any other read error is a
    // question that could not be answered and must not be reported as "none".
    if ((err as NodeJS.ErrnoException | undefined)?.code === "ENOENT") return [];
    throw err;
  }
  return parseRollingExceptions(text);
}

/**
 * The message printed when NO exception applies — unchanged in substance from
 * the regime that shipped before exceptions existed, because that is still the
 * default and still what almost every row gets.
 */
export function rollingRemedy(destRel: string, expected: string, actual: string, rolling: string): string {
  return (
    `from-url ${destRel}: upstream REBUILT this asset in place (rolling=${rolling}).\n` +
    `  pinned  sha256=${expected}\n` +
    `  fetched sha256=${actual}\n` +
    "  This is expected for a rolling upstream and is NOT corruption. It fails\n" +
    "  closed on purpose: the new bytes are a different verifier, so every claim\n" +
    "  the old one established has to be re-measured before the pin moves.\n" +
    `  Re-measure AND re-pin in one step:  bun tools/setup/repin-rolling.ts ${destRel}\n` +
    "  Do NOT hand-edit the sha256= in tools/setup/manifests/from-url. A digest\n" +
    "  bumped without a re-measure is the exact failure this regime exists to stop."
  );
}

export type Verdict = "not-run" | "pass" | "fail";
export type Outcome = "accepted" | "refused";

/**
 * One ledger row. Same whitespace-token grammar as every other manifest here so
 * one reader habit works across all of them.
 *
 * `verdict` is the field the requirement turns on: an acceptance that cannot say
 * whether anything judged the bytes is a silence. `not-run` is a first-class,
 * honest value — it is what a `verify=deferred` row records, and it is never
 * spelled `pass`.
 */
export function acceptanceRecordLine(fields: {
  readonly dest: string;
  readonly from: string;
  readonly to: string;
  readonly when: string;
  readonly verify: string;
  readonly verdict: Verdict;
  readonly outcome: Outcome;
  readonly expires: string;
}): string {
  return [
    fields.dest,
    "from=" + fields.from,
    "to=" + fields.to,
    "when=" + fields.when,
    "verify=" + fields.verify,
    "verdict=" + fields.verdict,
    "outcome=" + fields.outcome,
    "expires=" + fields.expires,
  ].join("  ");
}

const LEDGER_HEADER =
  "# Local record of ROLLING from-url auto-acceptances. UNTRACKED and per-machine.\n" +
  "# Written by src/Core.TypeScript/ace/setup-realizers/from-url.ts under a row in\n" +
  "# tools/setup/manifests/from-url-rolling-exceptions.\n" +
  "#\n" +
  "# THIS IS NOT A RE-MEASURE RECEIPT. `verdict=` says whether anything judged the\n" +
  "# accepted bytes; `not-run` means nothing did. Only\n" +
  "# tools/setup/manifests/from-url-rolling-receipts, written by\n" +
  "# tools/setup/repin-rolling.ts after a re-measure exits 0, can move a pin.\n" +
  "#\n" +
  "# Format: <dest>  from=  to=  when=  verify=  verdict=  outcome=  expires=\n";

/** The ledger row with its timestamp removed — the identity for dedup. */
function withoutClock(line: string): string {
  return line
    .split(/\s+/)
    .filter((token) => !token.startsWith("when="))
    .join(" ");
}

/** One folded row of the acceptance ledger. */
export interface AcceptanceRecord {
  readonly dest: string;
  readonly from: string | null;
  readonly to: string | null;
  /** The EARLIEST clock among the folded copies -- when this fact first happened. */
  readonly when: string | null;
  readonly verify: string | null;
  readonly verdict: string | null;
  readonly outcome: string | null;
  readonly expires: string | null;
  /**
   * How many raw lines folded into this record. `1` is the ordinary case; `>1`
   * means writers raced, which is INFORMATION rather than corruption -- it is
   * the only evidence the ledger keeps that two installs ran concurrently.
   */
  readonly occurrences: number;
}

function fieldOf(tokens: readonly string[], prefix: string): string | null {
  for (const token of tokens) {
    if (token.startsWith(prefix)) return token.slice(prefix.length);
  }
  return null;
}

/** Raw rows, one per non-comment line, in file order. */
export function parseAcceptanceLedger(text: string): readonly AcceptanceRecord[] {
  const rows: AcceptanceRecord[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const tokens = line.split(/\s+/);
    const dest = tokens[0];
    if (dest === undefined) continue;
    rows.push({
      dest,
      from: fieldOf(tokens, "from="),
      to: fieldOf(tokens, "to="),
      when: fieldOf(tokens, "when="),
      verify: fieldOf(tokens, "verify="),
      verdict: fieldOf(tokens, "verdict="),
      outcome: fieldOf(tokens, "outcome="),
      expires: fieldOf(tokens, "expires="),
      occurrences: 1,
    });
  }
  return rows;
}

/**
 * THE IDEMPOTENT FOLD. Collapses rows that describe the same fact -- same dest,
 * digests, verify, verdict, outcome and expiry -- keeping the EARLIEST clock and
 * counting how many copies there were.
 *
 * `fold(fold(x)) == fold(x)`: folding an already-folded list is the identity on
 * its records, because each is already the unique representative of its class.
 * That is what makes duplicate lines harmless and lets the writers stay
 * lock-free. Order is preserved by first appearance, so the ledger still reads
 * chronologically.
 */
export function foldAcceptanceRecords(rows: readonly AcceptanceRecord[]): readonly AcceptanceRecord[] {
  const byIdentity = new Map<string, AcceptanceRecord>();
  const order: string[] = [];
  for (const row of rows) {
    const identity = [row.dest, row.from, row.to, row.verify, row.verdict, row.outcome, row.expires].join("\u0000");
    const seen = byIdentity.get(identity);
    if (seen === undefined) {
      byIdentity.set(identity, row);
      order.push(identity);
      continue;
    }
    // Earliest clock wins: the fact happened when it FIRST happened, and a
    // later duplicate is a re-observation, not a new event. String compare is
    // correct for ISO-8601 UTC, which is what `nowIso` emits.
    const when =
      seen.when === null ? row.when
      : row.when === null ? seen.when
      : row.when < seen.when ? row.when : seen.when;
    byIdentity.set(identity, { ...seen, when, occurrences: seen.occurrences + row.occurrences });
  }
  return order.map((identity) => byIdentity.get(identity) as AcceptanceRecord);
}

/**
 * The ledger as FACTS, duplicates folded. This is the read boundary every
 * consumer should use; reading the file directly re-exposes the duplicates the
 * fold exists to absorb.
 */
export function readAcceptanceLedger(repoRoot: string): readonly AcceptanceRecord[] {
  let text: string;
  try {
    text = readFileSync(join(repoRoot, ACCEPTS_LEDGER), "utf8");
  } catch (err) {
    // Absent means no acceptances on this machine -- the ordinary state, and the
    // strict one. Any other error is a question that could not be answered.
    if ((err as NodeJS.ErrnoException | undefined)?.code === "ENOENT") return [];
    throw err;
  }
  return foldAcceptanceRecords(parseAcceptanceLedger(text));
}

/**
 * Append one acceptance. Append-only, and correct under concurrent writers
 * WITHOUT A LOCK.
 *
 * ── WHERE THE IDEMPOTENCY ACTUALLY LIVES: THE READ, NOT THE WRITE ────────────
 *
 * An earlier draft made the write-side scan load-bearing and then had to admit
 * it was only "advisory", because a read followed by a write is a window: two
 * installs can both see "absent" and both append. The reflex at that point is a
 * lock file. That reflex is wrong here, and the repo's own disciplines say why.
 *
 * **The fix is to make duplicates HARMLESS instead of preventing them.** The
 * ledger is an append-only log; `foldAcceptanceRecords` collapses identical rows
 * at READ time, so N copies of one fact fold to one record and the reader cannot
 * tell how many writers raced. That is discipline #6 in its proper form --
 * apply-N-times equals apply-once in EFFECT, achieved by an idempotent fold
 * rather than by serialising the writers -- and it is the same G-Set/Z-set merge
 * shape the substrate already leans on. No lock, no CAS, no window, and the
 * concurrency question stops being a caveat.
 *
 * Reach for a lock only after saying why a read-side fold could not work.
 *
 * ── WHAT EACH PIECE IS FOR, so nothing is mistaken for a guarantee it is not ─
 *
 *   * THE WRITE IS ATOMIC. `appendFileSync` opens `O_APPEND` and issues one
 *     `write(2)`, so the kernel places it at the end atomically. Two concurrent
 *     writers produce two whole lines, never one interleaved line. A torn record
 *     would be genuinely bad; a repeated one is not.
 *   * THE WRITE-SIDE SCAN IS A NOISE REDUCER, NOT A CORRECTNESS MECHANISM. It
 *     keeps the common single-writer case from appending one line per install
 *     while a pin and its accepted bytes disagree. If it loses a race the fold
 *     absorbs the result. Nothing depends on it, and its return value says only
 *     whether THIS call wrote a line.
 *   * THE HEADER IS CREATED WITH `wx` -- an atomic create-if-absent, the one
 *     place a real race is closed, and closed by the filesystem rather than by a
 *     lock. An existence check followed by a write would be both a check-then-use
 *     race (CWE-367) and a way for two starters to each stamp a header.
 */
export function appendAcceptanceRecord(repoRoot: string, line: string): boolean {
  const path = join(repoRoot, ACCEPTS_LEDGER);
  mkdirSync(dirname(path), { recursive: true });
  try {
    writeFileSync(path, LEDGER_HEADER, { flag: "wx" });
  } catch (err) {
    // EEXIST is the normal case after the first ever acceptance on this machine.
    if ((err as NodeJS.ErrnoException | undefined)?.code !== "EEXIST") throw err;
  }
  // Read to interpret, never to gate: absence here is answered by the read
  // itself, so there is no window between a question and its use.
  let existing: string;
  try {
    existing = readFileSync(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException | undefined)?.code !== "ENOENT") throw err;
    existing = "";
  }
  const identity = withoutClock(line);
  for (const existingLine of existing.split("\n")) {
    if (existingLine.trim() === "" || existingLine.startsWith("#")) continue;
    if (withoutClock(existingLine.trim()) === identity) return false;
  }
  appendFileSync(path, line + "\n");
  return true;
}

export interface AcceptEffects {
  /** Runs the row's `verify=` argv. `ok` is "exited 0", never "probably fine". */
  readonly runVerify: (argv: readonly string[]) => { readonly ok: boolean; readonly transcript: string };
  readonly appendRecord: (line: string) => void;
  readonly nowIso: () => string;
}

export interface AcceptDecision {
  readonly accepted: boolean;
  /** The banner to print on acceptance, or the refusal to throw. */
  readonly message: string;
}

/** `verify=a:b:c` → `["a","b","c"]`; `deferred` and empty → null (nothing to run). */
export function verifyArgv(verify: string | null): readonly string[] | null {
  if (verify === null || verify === "" || verify === "deferred") return null;
  const argv = verify.split(":").filter((part) => part !== "");
  return argv.length === 0 ? null : argv;
}

/**
 * Decide, record, and report. The ORDER matters and is the requirement:
 *
 *   verify (if declared) → RECORD (whatever it said) → accept or refuse.
 *
 * The record is written on BOTH paths, including the refusal. A failed
 * verification is the most informative thing this mechanism can ever produce and
 * throwing it away would leave the loudest event unrecorded — and it is also
 * what keeps `verdict=fail` reachable, so the field is not decorative.
 */
export function decideRollingAccept(
  params: {
    readonly dest: string;
    readonly rolling: string;
    readonly pinned: string;
    readonly fetched: string;
    readonly exception: RollingException | null;
  },
  effects: AcceptEffects,
): AcceptDecision {
  const { dest, rolling, pinned, fetched, exception } = params;
  if (exception === null) {
    return { accepted: false, message: rollingRemedy(dest, pinned, fetched, rolling) };
  }
  const argv = verifyArgv(exception.verify);
  let verdict: Verdict = "not-run";
  let transcript = "";
  if (argv !== null) {
    const run = effects.runVerify(argv);
    verdict = run.ok ? "pass" : "fail";
    transcript = run.transcript;
  }
  const outcome: Outcome = verdict === "fail" ? "refused" : "accepted";
  effects.appendRecord(
    acceptanceRecordLine({
      dest,
      from: pinned,
      to: fetched,
      when: effects.nowIso(),
      verify: exception.verify ?? "deferred",
      verdict,
      outcome,
      expires: exception.expires ?? "",
    }),
  );
  if (outcome === "refused") {
    return {
      accepted: false,
      message:
        `from-url ${dest}: upstream rebuilt this asset (rolling=${rolling}) and an\n` +
        `  exception permits auto-accept — but the declared verify=${String(exception.verify)}\n` +
        "  FAILED on the new bytes, so they were refused and nothing was installed.\n" +
        `  pinned  sha256=${pinned}\n  fetched sha256=${fetched}\n` +
        "  This is a FINDING about the new build, not a registry to edit.\n" +
        (transcript === "" ? "" : "  --- verify transcript (tail) ---\n" + tail(transcript)),
    };
  }
  return { accepted: true, message: acceptBanner({ dest, rolling, pinned, fetched, exception, verdict }) };
}

function tail(text: string, lines = 20): string {
  return text.trimEnd().split("\n").slice(-lines).map((line) => "  " + line).join("\n") + "\n";
}

/**
 * The banner. It is long on purpose: this is the moment a security check was
 * declined, and the whole justification for declining it is that the decline is
 * LOUD and RECORDED. A one-line "accepted new bytes" would be the silent failure
 * this design exists to avoid.
 */
export function acceptBanner(params: {
  readonly dest: string;
  readonly rolling: string;
  readonly pinned: string;
  readonly fetched: string;
  readonly exception: RollingException;
  readonly verdict: Verdict;
}): string {
  const { dest, rolling, pinned, fetched, exception, verdict } = params;
  return (
    `!! from-url ${dest}: ACCEPTED REBUILT BYTES UNDER A DECLARED EXCEPTION\n` +
    `   upstream rolling=${rolling} replaced this asset in place.\n` +
    `   pinned   sha256=${pinned}\n` +
    `   accepted sha256=${fetched}\n` +
    `   verify=${String(exception.verify)}  verdict=${verdict}\n` +
    `   exception declared=${String(exception.declared)} expires=${String(exception.expires)}\n` +
    `   tradeoff: ${String(exception.tradeoff)}\n` +
    `   recorded in ${ACCEPTS_LEDGER}\n` +
    "   THE PIN HAS NOT MOVED. These bytes are installed but not judged: the\n" +
    "   manifest, the docs and every declared pin surface still name the old\n" +
    "   digest, and they still disagree with what is now on disk. Provisioning\n" +
    "   continues; the verifier claim does not. Re-measure and re-pin with:\n" +
    `     bun tools/setup/repin-rolling.ts ${dest}\n`
  );
}
