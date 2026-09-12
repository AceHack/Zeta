// refutation-ledger.ts -- what was TRIED and DISPROVEN, so a fresh context is told what not
// to propose. The first consumer of `dual-score.ts`.
//
// ============================================================================================
// WHAT THIS IS FOR
// ============================================================================================
// A context that wakes with no memory re-proposes the hypothesis the last context spent an
// hour disproving. The expensive artefact of that hour is not the fix -- the fix is in the
// diff. It is the NEGATIVE result, which lands nowhere by default and is therefore rediscovered
// at full price, repeatedly.
//
// Three rows seeded on 2026-09-11, all refuted the same day, all of them things a plausible
// agent would propose again tomorrow:
//
//   - `process.stdin.resume()` cannot keep a child alive under `stdio: "ignore"` -- stdin is
//     /dev/null, so the read hits EOF immediately and the process exits anyway.
//   - reading through a file handle does NOT close the `js/file-system-race` window on a
//     lock's contended path.
//   - `fromJSON(...).leg != false` skips instead of running -- GitHub casts both `null` and
//     `false` to 0, so the comparison is false when the leg is absent.
//
// ============================================================================================
// WHY THE SCORE IS TWO NUMBERS AND NOT A BOOLEAN
// ============================================================================================
// Aaron 2026-09-11: "refutations should also have a numerical score not just true false."
// A refutation is not a bit. "This cannot work, I read the docs" and "this did not work when I
// ran it twice" are different evidentiary states, and a boolean renders them identically.
//
// So every row carries a `DualScore`: `trueChance` that the hypothesis still holds, and
// `falseChance` that it fails -- INDEPENDENT legs. A strong refutation is roughly `{0, 0.95}`.
// A row whose legs sum BELOW 1 says the ledger looked and found little either way; a row whose
// legs sum ABOVE 1 says two witnesses disagree, and that row is the most interesting one in the
// file. Neither state survives a single probability, which is the argument for the primitive.
//
// The derived quantities (`mass`, `ignorance`, `contradiction`, `massShape`) are NOT stored.
// They are a pure function of the two legs, and storing a derivable value is how a stale copy
// of it gets believed. `.claude/rules/dv2-data-split-discipline-activated.md` STEP 2: keep the
// generator, not the output.
//
// NO COMBINATION RULE. `dual-score.ts` deliberately ships none while the algebra is under
// review by the math team (Dempster-Shafer, Josang, Belnap's FOUR, Walley, quasi-probability;
// see that file's header). Where this ledger must show several rows about one hypothesis on one
// line it uses `toyJoin` -- componentwise max, named `toy` for exactly this reason -- and it
// always prints the individual rows beside it, so nothing a reader acts on depends on the
// placeholder.
//
// ============================================================================================
// STORAGE: ONE FILE PER ROW, IN DATE-PARTITIONED FOLDERS. NEVER A SINGLE FILE.
// ============================================================================================
// Aaron 2026-09-11:
//
//   "any ledger that's stored in git should not be a single file, it should use partitioning
//    and date based folders like we already described and can also take advantage of our
//    zetaid if needed."
//
// and, on the symptom that commissioned the growth register:
//
//   "any time a single file is getting written over and over and over on some cadence that's a
//    huge smell on github where history is forever ... one per event would be best, and they
//    can be in dated folders so we don't end up with too many files in one folder."
//
//   db/refutations/<YYYY>/<MM>/<DD>/<32-hex ZetaId>.json
//
// which is the shape `workitems/events/<YYYY>/<MM>/<DD>/<id>.json` already uses. An appended
// row touches ONE new blob and rewrites nothing, so the history cost is the row itself rather
// than a fresh copy of the whole ledger per append. This path is registered in
// `registry/unbounded-growth-register.json` with a measured rate and cost; the register is the
// thing that makes "unbounded but priced" different from "unbounded and unnoticed".
//
// ============================================================================================
// THE ID IS A CONTENT ADDRESS, WHICH IS WHERE IDEMPOTENCY COMES FROM
// ============================================================================================
// `id` is a Category-9 (ContentAddress) ZetaId over the canonical body, so re-recording an
// identical row produces an identical path AND identical bytes -- a true no-op, not a second
// entry (DV2.0 #6). A row that differs by one character is a different id and a different
// file, so nothing is ever silently overwritten.
//
// `claim` is a SECOND content address, over `surface` and `hypothesis` only. That is the DV2.0
// hub key: every row about the same hypothesis shares it, whoever wrote them and whenever. It
// lets a reader GROUP two witnesses of the same claim without the writer having to pick which
// one is right -- raw vault, a single version of the facts and never of the truth. Where two
// rows on one `claim` disagree, `byClaim` reports the contradiction rather than resolving
// it.

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { canonicalBytes, canonicalJson, compareCodePoints } from "../federated-identity/ports";
import { hasher } from "../blake3/blake3";
import { toHex } from "../zeta-id/encoding";
import { isCanonicalZetaIdHex } from "../zeta-id/canonical-hex";
import { packPayload, DETERMINISTIC_ENV } from "../zeta-id/zeta-id";
import { IdVersion } from "../zeta-id/types";
import {
  type DualScore,
  type DualScoreRefusal,
  contradiction,
  ignorance,
  massShape,
  parseDualScore,
  toyJoin,
} from "./dual-score";

/** Repository-relative root of the ledger. Never a file -- always this directory. */
export const LEDGER_ROOT = "db/refutations";

/** ContentAddress payloads are 119 bits; BLAKE3 gives 128, so the top 9 are dropped. */
const CONTENT_ADDRESS_BITS = 119n;

/** A row as it lives on disk. Derived quantities are deliberately absent. */
export interface RefutationRow {
  /** 32-hex ZetaId, ContentAddress over the canonical body. The satellite key. */
  readonly id: string;
  /** 32-hex ZetaId, ContentAddress over `surface` + `hypothesis`. The hub key. */
  readonly claim: string;
  /** ISO-8601 UTC instant. Supplies the date partition -- see `rowPath`. */
  readonly at: string;
  /** Who recorded it. A name, not a credential. */
  readonly by: string;
  /** Where the hypothesis would bite: a file, a subsystem, a tool. */
  readonly surface: string;
  /** The thing that was proposed, stated so it is recognisable when proposed again. */
  readonly hypothesis: string;
  /** What disproved it -- the mechanism, not the feeling. */
  readonly refutedBy: string;
  /** The observation or test that would have to be wrong for this row to be wrong. */
  readonly witness: string;
  /** Two independent chances. NOT a boolean, NOT complementary. */
  readonly score: DualScore;
}

/** Everything a caller supplies; the two ids are minted from it. */
export type RefutationDraft = Omit<RefutationRow, "id" | "claim">;

export type LedgerRefusal =
  | { readonly reason: "empty-field"; readonly field: string; readonly detail: string }
  | { readonly reason: "bad-instant"; readonly field: "at"; readonly detail: string }
  | { readonly reason: "bad-score"; readonly field: "score"; readonly detail: string; readonly inner: DualScoreRefusal }
  | { readonly reason: "bad-shape"; readonly field: string; readonly detail: string }
  | { readonly reason: "bad-id"; readonly field: "id" | "claim"; readonly detail: string };

export type RowResult =
  { readonly ok: true; readonly row: RefutationRow } | { readonly ok: false; readonly refusal: LedgerRefusal };

// -- ids ---------------------------------------------------------------------------------

/** A Category-9 ContentAddress ZetaId over `bytes`, rendered as 32 lowercase hex. */
export function contentAddress(bytes: Uint8Array): string {
  const { hi, lo } = hasher.hash(bytes);
  const full = (BigInt(hi) << 64n) | BigInt(lo);
  const payload = full & ((1n << CONTENT_ADDRESS_BITS) - 1n);
  return toHex(packPayload({ type: "ContentAddress", version: IdVersion.V1, payload }, DETERMINISTIC_ENV));
}

/**
 * The hub key: every row about the same hypothesis on the same surface shares it.
 *
 * LENGTH-PREFIXED, not delimiter-joined. A separator only works if the fields cannot contain
 * it, and these are free text, so `("ab", "c")` and `("a", "bc")` would collide under any
 * joiner a caller can type. Code-unit lengths make the encoding injective with NO reserved
 * byte at all -- and therefore no escape, which is the class of defect that ends with a
 * separator written into the data it was meant to separate.
 */
export function claimId(surface: string, hypothesis: string): string {
  return contentAddress(new TextEncoder().encode(`${surface.length}:${surface}${hypothesis.length}:${hypothesis}`));
}

/** The satellite key: the canonical body, including `at` and `by`, digested. */
export function bodyId(draft: RefutationDraft): string {
  return contentAddress(canonicalBytes(draft as unknown));
}

// -- validation --------------------------------------------------------------------------

const TEXT_FIELDS = ["by", "surface", "hypothesis", "refutedBy", "witness"] as const;

/** Strict ISO-8601 UTC with milliseconds. A local-offset instant would partition by the */
/** writer's timezone, which would put one instant in two different day folders. */
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function refuseDraft(draft: RefutationDraft): LedgerRefusal | null {
  for (const field of TEXT_FIELDS) {
    const v = draft[field];
    if (typeof v !== "string" || v.trim().length === 0) {
      return {
        reason: "empty-field",
        field,
        detail:
          `'${field}' must be non-empty. A refutation row with a blank ${field} is a row a ` +
          `future reader cannot act on, which is the only thing this ledger is for.`,
      };
    }
  }
  if (typeof draft.at !== "string" || !INSTANT.test(draft.at) || Number.isNaN(Date.parse(draft.at))) {
    return {
      reason: "bad-instant",
      field: "at",
      detail:
        `'at' must be an ISO-8601 UTC instant with milliseconds (YYYY-MM-DDTHH:MM:SS.sssZ), got ` +
        `${JSON.stringify(draft.at)}. A local-offset instant would partition by the writer's ` +
        `timezone, putting one moment in two day folders.`,
    };
  }
  const score = parseDualScore(draft.score as unknown);
  if (!score.ok) {
    return {
      reason: "bad-score",
      field: "score",
      detail: `'score' is not a dual score: ${score.refusal.detail}`,
      inner: score.refusal,
    };
  }
  return null;
}

/** Validate a draft and mint both ids. The only way to build a row. */
export function buildRow(draft: RefutationDraft): RowResult {
  const bad = refuseDraft(draft);
  if (bad !== null) return { ok: false, refusal: bad };
  const normalised: RefutationDraft = {
    at: draft.at,
    by: draft.by,
    surface: draft.surface,
    hypothesis: draft.hypothesis,
    refutedBy: draft.refutedBy,
    witness: draft.witness,
    score: { trueChance: draft.score.trueChance, falseChance: draft.score.falseChance },
  };
  return {
    ok: true,
    row: { id: bodyId(normalised), claim: claimId(normalised.surface, normalised.hypothesis), ...normalised },
  };
}

/** Parse an untrusted JSON value into a row, checking that BOTH ids actually address it. */
export function validateRow(value: unknown): RowResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {
      ok: false,
      refusal: { reason: "bad-shape", field: "<row>", detail: `expected a JSON object, got ${typeof value}` },
    };
  }
  const r = value as Record<string, unknown>;
  for (const field of ["id", "claim"] as const) {
    if (!isCanonicalZetaIdHex(r[field])) {
      return {
        ok: false,
        refusal: {
          reason: "bad-id",
          field,
          detail:
            `'${field}' must be a canonical 32-hex ZetaId that DECODES (not merely 32 hex ` +
            `characters), got ${JSON.stringify(r[field])}.`,
        },
      };
    }
  }
  const built = buildRow({
    at: r["at"] as string,
    by: r["by"] as string,
    surface: r["surface"] as string,
    hypothesis: r["hypothesis"] as string,
    refutedBy: r["refutedBy"] as string,
    witness: r["witness"] as string,
    score: r["score"] as DualScore,
  });
  if (!built.ok) return built;
  if (built.row.id !== r["id"] || built.row.claim !== r["claim"]) {
    return {
      ok: false,
      refusal: {
        reason: "bad-id",
        field: built.row.id !== r["id"] ? "id" : "claim",
        detail:
          `the stored id does not address the stored body: recomputing gives id=${built.row.id} ` +
          `claim=${built.row.claim}. Either the body was edited after minting or the id was ` +
          `invented. A content address nobody recomputes is a check that did not run.`,
      },
    };
  }
  return built;
}

// -- paths -------------------------------------------------------------------------------

/**
 * `db/refutations/YYYY/MM/DD/<id>.json`, derived from `at`. Pure: testable with no filesystem,
 * which is what lets the partitioning itself be a falsifier rather than a convention.
 */
export function rowPath(row: RefutationRow): string {
  const [date] = row.at.split("T");
  const [year, month, day] = (date ?? "").split("-");
  return join(LEDGER_ROOT, year ?? "", month ?? "", day ?? "", `${row.id}.json`);
}

/**
 * The bytes a row is stored as: keys in canonical (code-point) order, two-space indent, one
 * trailing newline -- i.e. readable and `prettier`-stable.
 *
 * Note what is NOT claimed here: these bytes are not the digest preimage. The content address
 * is taken over `canonicalJson` of the BODY (`bodyId`), so a reformat of the file changes its
 * bytes and not its identity. That is why `writeRow`'s idempotency check compares the DECODED
 * row rather than the raw bytes -- coupling identity to whitespace would mean a formatter run
 * could make a row fail to match itself.
 */
export function rowBytes(row: RefutationRow): string {
  const ordered = JSON.parse(canonicalJson(row as unknown)) as unknown;
  return `${JSON.stringify(ordered, null, 2)}\n`;
}

// -- io ----------------------------------------------------------------------------------

export type WriteOutcome =
  | { readonly ok: true; readonly path: string; readonly state: "written" | "already-identical" }
  | { readonly ok: false; readonly path: string; readonly detail: string };

/**
 * Append one row. Idempotent by content address: writing the same row twice leaves one file and
 * reports `already-identical` the second time.
 *
 * The write is `wx` (exclusive create) rather than a check-then-write, so two concurrent
 * writers cannot both observe absence and race. EEXIST is then INTERPRETED -- read the file
 * back and compare. Identical is the idempotent no-op; different bytes under a content address
 * is a digest collision or a hand-edited file, and both are refused rather than overwritten.
 */
export function writeRow(root: string, row: RefutationRow): WriteOutcome {
  const rel = rowPath(row);
  const abs = join(root, rel);
  const bytes = rowBytes(row);
  mkdirSync(dirname(abs), { recursive: true });
  try {
    writeFileSync(abs, bytes, { encoding: "utf8", flag: "wx" });
    return { ok: true, path: rel, state: "written" };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
    // Compare the DECODED row, not the raw bytes: identity is the content address over the
    // body, and a reformat must not make a row stop matching itself.
    let existing: unknown;
    try {
      existing = JSON.parse(readFileSync(abs, "utf8")) as unknown;
    } catch {
      return { ok: false, path: rel, detail: `a file already occupies this path and is not valid JSON.` };
    }
    const decoded = validateRow(existing);
    if (decoded.ok && decoded.row.id === row.id && rowBytes(decoded.row) === bytes) {
      return { ok: true, path: rel, state: "already-identical" };
    }
    return {
      ok: false,
      path: rel,
      detail:
        `a DIFFERENT body already occupies this content address. The id is a digest of the ` +
        `body, so this is either a hand-edited file or a collision; overwriting would destroy ` +
        `whichever of the two is right.`,
    };
  }
}

/**
 * Every directory entry under `dir`, or `[]` when `dir` is absent OR is not a directory.
 *
 * READ, THEN INTERPRET ENOENT. `existsSync` before `readdirSync` leaves a window in which the
 * answer is already stale, and the read reports absence itself one syscall earlier.
 *
 * ENOTDIR is tolerated for the same reason and is not hypothetical: a `README.md` sitting
 * beside the year folders is an ordinary thing for a ledger directory to contain, and a walk
 * that throws on it would take the whole briefing down over a documentation file.
 */
function childrenOf(dir: string): string[] {
  try {
    return readdirSync(dir).sort(compareCodePoints);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") return [];
    throw err;
  }
}

export interface LoadResult {
  readonly rows: readonly RefutationRow[];
  /** Files that would not validate, with the reason. Reported, never silently dropped. */
  readonly rejected: readonly { readonly path: string; readonly detail: string }[];
}

/**
 * Walk `<root>/db/refutations/YYYY/MM/DD/*.json`. An absent ledger is an empty ledger, not an
 * error -- a fresh clone before the first refutation is a legitimate state. A file that fails
 * validation is REPORTED, because a ledger that silently skips its unreadable rows is a ledger
 * that under-reports exactly when something is wrong with it.
 */
export function loadLedger(root: string): LoadResult {
  const base = join(root, LEDGER_ROOT);
  const rows: RefutationRow[] = [];
  const rejected: { path: string; detail: string }[] = [];
  for (const year of childrenOf(base)) {
    for (const month of childrenOf(join(base, year))) {
      for (const day of childrenOf(join(base, year, month))) {
        for (const file of childrenOf(join(base, year, month, day))) {
          if (!file.endsWith(".json")) continue;
          const rel = join(LEDGER_ROOT, year, month, day, file);
          let parsed: unknown;
          try {
            parsed = JSON.parse(readFileSync(join(base, year, month, day, file), "utf8")) as unknown;
          } catch (err) {
            rejected.push({ path: rel, detail: `unreadable or not JSON: ${String(err)}` });
            continue;
          }
          const row = validateRow(parsed);
          if (row.ok) rows.push(row.row);
          else rejected.push({ path: rel, detail: row.refusal.detail });
        }
      }
    }
  }
  rows.sort((a, b) => compareCodePoints(a.at, b.at) || compareCodePoints(a.id, b.id));
  return { rows, rejected };
}

// -- reading the ledger ------------------------------------------------------------------

export interface ClaimView {
  readonly claim: string;
  readonly surface: string;
  readonly hypothesis: string;
  /** Every row, always. The group's rows are the facts; the join below is a display aid. */
  readonly rows: readonly RefutationRow[];
  /**
   * `toyJoin` over the group -- componentwise max, NOT a belief-combination rule. Named `toy`
   * in `dual-score.ts` because the algebra is under math-team review; see that header. It is a
   * one-line summary for the briefing and nothing else reads it.
   */
  readonly toyJoined: DualScore;
}

/**
 * Group rows by their hub key. Every row is kept, with its own `by` and `witness` -- raw vault,
 * a single version of the facts and never of the truth.
 *
 * Two witnesses who disagree produce a `toyJoined` score whose legs sum ABOVE 1, and
 * `contradiction` on it is the disagreement's size. That is a REPORT, not a resolution, and it
 * is deliberately the regime in which a fusion rule would be least trustworthy.
 */
export function byClaim(rows: readonly RefutationRow[]): ClaimView[] {
  const groups = new Map<string, RefutationRow[]>();
  for (const row of rows) {
    const existing = groups.get(row.claim);
    if (existing === undefined) groups.set(row.claim, [row]);
    else existing.push(row);
  }
  const out: ClaimView[] = [];
  for (const [claim, group] of groups) {
    const first = group[0] as RefutationRow;
    let toyJoined: DualScore = { trueChance: 0, falseChance: 0 };
    for (const row of group) toyJoined = toyJoin(toyJoined, row.score);
    out.push({ claim, surface: first.surface, hypothesis: first.hypothesis, rows: group, toyJoined });
  }
  out.sort((a, b) => compareCodePoints(a.surface, b.surface) || compareCodePoints(a.claim, b.claim));
  return out;
}

/**
 * The briefing a fresh context reads: what NOT to propose, with the evidence and its shape.
 *
 * Every line states the two legs SEPARATELY and names the shape, so a reader can see the
 * difference between "strongly refuted", "barely looked at" and "two people disagree" without
 * a threshold being applied on their behalf. Each row is printed individually as well, so the
 * `toyJoin` summary never has to be trusted.
 */
export function renderBriefing(views: readonly ClaimView[]): string {
  if (views.length === 0) return "No refutations recorded.\n";
  const lines: string[] = [
    `${views.length} refuted hypothes${views.length === 1 ? "is" : "es"} -- do not re-propose these.`,
    "",
  ];
  for (const view of views) {
    const s = view.toyJoined;
    lines.push(`${view.surface}`);
    lines.push(`  hypothesis: ${view.hypothesis}`);
    for (const row of view.rows) {
      lines.push(`  refuted by: ${row.refutedBy}  [${row.by}, ${row.at}]`);
      lines.push(`  witness:    ${row.witness}`);
    }
    lines.push(
      `  score:      trueChance ${s.trueChance} / falseChance ${s.falseChance} -- ${massShape(s)}` +
        (ignorance(s) > 0 ? ` (ignorance ${ignorance(s).toFixed(2)})` : "") +
        (contradiction(s) > 0 ? ` (CONTRADICTION ${contradiction(s).toFixed(2)} -- witnesses disagree)` : "") +
        ` [toyJoin over ${view.rows.length} row(s); not a fusion rule]`,
    );
    lines.push("");
  }
  return lines.join("\n");
}
