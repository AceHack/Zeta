/**
 * b-ref-resolve.ts — resolve a legacy `B-NNNN` reference to something that
 * actually exists in the tree.
 *
 * ## Why this module replaced a ban
 *
 * The predecessor gate (`lint-no-b-refs.ts`) forbade *writing* a hyphenated
 * legacy id on any authored surface. That is the vacuity class: if no legacy
 * ref may exist in tree, then no *stale* legacy ref can exist either, so the
 * check could never fire on the thing it nominally guarded. It bought
 * compliance by eliminating its own subject — and its observable cost was
 * authors bending prose (`B0747` written hyphenless) to route around a gate
 * that had nothing left to catch.
 *
 * Aaron 2026-08-15: *"if the gate is too restrictive I'd rather change it and
 * do better drift checks."*
 *
 * So the gate now **permits the reference and checks that it resolves**. That
 * is strictly stronger: it catches a fabricated id, a typo'd id, and a real id
 * whose target was deleted — none of which the ban could see — while letting
 * lineage prose name the thing it is talking about.
 *
 * ## What "resolves" means (the ladder)
 *
 * A legacy ref resolves when a reader can open something real:
 *
 * 1. **`live`** — the alias maps carry the id, and the ZetaId they name has a
 *    row file under `docs/backlog/P0..P3`, `workitems`, or `workitems/done`.
 *    This is the migrated case (B-0732 → `081KSE6WT0008QG0R002YBWBB1`).
 * 2. **`archive`** — no live row, but the id names a surviving artifact under
 *    the recovered-orphan-branch archive. The row never landed on `main`; the
 *    reference still points at a file a reader can open (B-0747).
 * 3. **unresolved** — neither. The reference points at nothing. FAIL.
 *
 * ## The fourth rung: a document whose SUBJECT is the dangling id
 *
 * The ladder above has a blind spot, and it went red on `main` (2026-08-16):
 * `docs/research/2026-08-15-the-archive-tag-corpus-characterized-…md` is an
 * **audit of ids that resolve to nothing**. Its table's whole content is
 * *"B-0282 landed as code · B-0080 was correctly abandoned · B-0094's escrow was
 * discharged"*. The gate's advertised remedy — *"cite the ZetaId of the row that
 * carries the work, or drop the id"* — is unsatisfiable there by construction:
 * there is no row to cite (that is the finding), and dropping the ids would
 * delete the audit's subject matter to turn a linter green.
 *
 * The check's FACT was correct in every one of those four cases; only its
 * VERDICT was misapplied. So the fix is not an exclusion — an exclusion is the
 * vacuity class and this gate's own docstring exists to condemn it — but a way
 * for a mention to **carry its own disposition**, machine-checked:
 *
 *   `<!-- b-ref-adjudicated: B-0282 landed-as-code src/…/autonomous-pickup.ts -->`
 *
 * `checkAdjudication` accepts one only when **all five** hold, so the escape
 * cannot be used to smuggle a genuinely dangling reference through:
 *
 * 1. **Same line.** The annotation sits on the line where the id is mentioned,
 *    with the id present outside the comment. A reader meets the disposition
 *    where they meet the id; a blanket footer cannot cover a whole file.
 * 2. **Closed vocabulary.** The disposition is one of {`landed-as-code`,
 *    `superseded`, `abandoned`, `never-a-row`}. Free prose would let "reasons"
 *    be typed that nothing can check.
 * 3. **Evidence exists on disk.** The cited path is read from the filesystem.
 *    An adjudication citing a path that is not there is itself a violation.
 * 4. **No self-citation.** The evidence may not be the annotated file. A
 *    document may not be its own proof.
 * 5. **STALE fails.** If the id *does* resolve — a row landed later — the
 *    adjudication is now false and goes red. The escape cannot rot into a
 *    permanent exemption, which is the failure mode of every allowlist.
 *
 * Derived, not listed: the exempt set is computed from what each document
 * declares and each declaration is independently checked, exactly as
 * `hygiene/audit-proof-lineage-binaries.ts` derives its exempt binaries from the
 * byte-lock runner's own roster instead of a hand-written list.
 *
 * Presence in `b-to-zetaid-map.json` is deliberately **not** sufficient. That
 * map was rebuilt by mining git history for `B-NNNN` tokens, so it contains
 * ids in the B-2xxx / B-8xxx / B-9xxx bands that were never rows at all.
 * Requiring the target to exist on disk is what makes the check a drift check
 * rather than a second spelling of the map. Measured on the tree that
 * introduced this module: 1160 of 1251 mapped ids resolve `live`, 14 resolve
 * `archive`, and 77 resolve to nothing — so the predicate discriminates.
 *
 * ## What this module does NOT do
 *
 * It does not re-open `B-NNNN` minting. Referencing an existing legacy id in
 * prose is now allowed and checked; *creating* B-numbered work stays forbidden
 * by `lint-no-new-bnnnn.ts` (B-named FILES) and by the frontmatter guard built
 * from `isRowFile` + `frontmatterOf` below (a legacy id used as a row KEY, not
 * named as a reference). See `.claude/rules/workitems-mint-with-zetaid.md`.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** The legacy id shape, including dotted sub-items (`B-0090.12`). */
export const B_ID_RE = /\bB-[0-9]{4}(?:\.[0-9]+)*\b/g;

/** Canonical ZetaId: 26 Crockford-base32 characters. */
const ZETA_ID_PREFIX_RE = /^([0-9A-HJKMNP-TV-Z]{26})-/;

/** Repo-relative root of the recovered orphan-branch archive (rung 2). */
export const ARCHIVE_PREFIX = "docs/recovered-orphan-branches-2026-05";

/** Directories holding live work-item rows, keyed by ZetaId filename prefix. */
const LIVE_ROW_DIRS = [
  "docs/backlog/P0",
  "docs/backlog/P1",
  "docs/backlog/P2",
  "docs/backlog/P3",
  "workitems",
  "workitems/done",
] as const;

/** Directories under LIVE_ROW_DIRS that are walked recursively. */
const RECURSIVE_LIVE_DIRS: ReadonlySet<string> = new Set(["workitems/done"]);

export type BRefResolution =
  | { readonly kind: "live"; readonly zetaId: string; readonly path: string }
  | { readonly kind: "archive"; readonly path: string }
  | { readonly kind: "unresolved"; readonly zetaId: string | null };

export interface BRefIndex {
  /** B-id (upper-case) → ZetaId, from both frozen alias maps. */
  readonly aliases: ReadonlyMap<string, string>;
  /** ZetaId → repo-relative row path. */
  readonly liveRows: ReadonlyMap<string, string>;
  /** B-id (upper-case) → repo-relative archive path. */
  readonly archived: ReadonlyMap<string, string>;
}

/**
 * Read an alias map, treating an absent file as an empty map.
 *
 * The read IS the existence check. `existsSync` followed by `readFileSync` is
 * check-then-act on the filesystem (`js/file-system-race`): the file can vanish
 * between the two calls, so the guard proves nothing and the read throws anyway.
 * Catching ENOENT from the read is both correct and one syscall cheaper.
 */
function readJsonMap(path: string): Record<string, string> {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return {};
  }
  return JSON.parse(text) as Record<string, string>;
}

/**
 * Recursive file walk.
 *
 * Entry kind comes from `readdirSync(..., { withFileTypes: true })` — the
 * directory read itself reports it, so there is no per-entry `statSync` to race
 * against and no second syscall per entry. Symlinks are neither `isDirectory()`
 * nor `isFile()` and are therefore skipped, which is what we want here: this
 * repo carries `universal/*.md → db/shapes/*.md` (a second view of a file the
 * walk already visits directly) and `tests/…/link_to_parent → ..` (a cycle that
 * a symlink-following `statSync` walk recursed into until PATH_MAX stopped it).
 */
function walkFiles(dir: string, out: string[], root: string): void {
  let entries: readonly import("node:fs").Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const dirent of entries) {
    const entry = dirent.name;
    if (entry === ".git" || entry === "node_modules") continue;
    const full = join(dir, entry);
    if (dirent.isDirectory()) walkFiles(full, out, root);
    else if (dirent.isFile()) out.push(full.slice(root.length + 1));
  }
}

/** Parent of a dotted sub-item id (`B-0090.12` → `B-0090`); null for a plain id. */
export function parentOf(bId: string): string | null {
  const m = /^(B-\d{4})(?:\.\d+)+$/.exec(bId);
  return m ? m[1]! : null;
}

/** Build the resolution index once per run (walks a few hundred files). */
export function buildIndex(root: string): BRefIndex {
  const aliases = new Map<string, string>();
  for (const file of ["b-to-zetaid-map.json", "b-id-renumber-aliases.json"]) {
    const m = readJsonMap(join(root, "src", "Core.TypeScript", "backlog", file));
    for (const [b, z] of Object.entries(m)) aliases.set(b.toUpperCase(), z);
  }

  const liveRows = new Map<string, string>();
  for (const rel of LIVE_ROW_DIRS) {
    const dir = join(root, rel);
    const files: string[] = [];
    if (RECURSIVE_LIVE_DIRS.has(rel)) {
      walkFiles(dir, files, root);
    } else {
      let entries: string[] = [];
      try {
        entries = readdirSync(dir);
      } catch {
        continue;
      }
      for (const e of entries) files.push(`${rel}/${e}`);
    }
    for (const f of files) {
      const base = f.slice(f.lastIndexOf("/") + 1);
      const m = ZETA_ID_PREFIX_RE.exec(base);
      if (m && base.endsWith(".md")) liveRows.set(m[1]!, f);
    }
  }

  const archived = new Map<string, string>();
  const archiveFiles: string[] = [];
  walkFiles(join(root, ARCHIVE_PREFIX), archiveFiles, root);
  for (const f of archiveFiles) {
    // Match the id in the PATH, not only the basename: recovered branch
    // directories are named after the row they carried, and some carry the id
    // on the directory while the file inside was renamed.
    for (const hit of f.toUpperCase().matchAll(/\bB-[0-9]{4}(?:\.[0-9]+)*\b/g)) {
      if (!archived.has(hit[0])) archived.set(hit[0], f);
    }
  }

  return { aliases, liveRows, archived };
}

/**
 * Resolve one legacy ref against the index.
 *
 * A dotted sub-item falls back to its parent row: `B-0090.12` is a slice of
 * `B-0090`, so a reader following it lands somewhere real either way.
 */
export function resolveBRef(ref: string, index: BRefIndex): BRefResolution {
  const id = ref.toUpperCase();
  const candidates = [id, parentOf(id)].filter((x): x is string => x !== null);

  for (const c of candidates) {
    const zetaId = index.aliases.get(c);
    if (zetaId !== undefined) {
      const path = index.liveRows.get(zetaId);
      if (path !== undefined) return { kind: "live", zetaId, path };
    }
  }
  for (const c of candidates) {
    const path = index.archived.get(c);
    if (path !== undefined) return { kind: "archive", path };
  }
  return { kind: "unresolved", zetaId: index.aliases.get(id) ?? null };
}

/**
 * True when `relPath` is a work-item row whose FRONTMATTER may not carry a
 * legacy id.
 *
 * The reference/key distinction is the whole guard against this change being
 * read as re-opening B-NNNN minting: naming `B-0747` in prose is lineage;
 * putting it in a row's `id:` / `depends_on:` / `superseded_by:` is using the
 * closed series as a live key. The first is now checked, the second stays
 * forbidden.
 */
export function isRowFile(relPath: string): boolean {
  return (
    relPath.endsWith(".md") &&
    (/^docs\/backlog\/P[0-3]\//.test(relPath) || relPath.startsWith("workitems/"))
  );
}

/** The leading `---`-delimited YAML block, or "" when the file has none. */
export function frontmatterOf(text: string): string {
  if (!text.startsWith("---\n")) return "";
  const end = text.indexOf("\n---", 4);
  return end === -1 ? "" : text.slice(4, end);
}

// ── Adjudication: a mention that carries its own disposition ───────────────
// See the module docstring, "The fourth rung". Everything below exists so that
// a document REPORTING an id as dangling is distinguishable from a document
// merely CONTAINING a dangling id — mechanically, not by an author's say-so.

/**
 * The closed disposition vocabulary. Free prose here would be unfalsifiable:
 * any sentence would "explain" any id. These four are the dispositions the
 * audit that forced this mechanism actually reached, and adding a fifth is a
 * deliberate edit to a vocabulary — not a per-id exemption that drifts.
 */
export const ADJUDICATION_DISPOSITIONS: ReadonlySet<string> = new Set([
  /** The work shipped, as code rather than as a row. Evidence: the code. */
  "landed-as-code",
  /** A successor carries it. Evidence: the successor. */
  "superseded",
  /** Dropped on purpose; the need is gone. Evidence: what makes it moot. */
  "abandoned",
  /** An alias-map entry whose row never landed. Evidence: the map. */
  "never-a-row",
]);

/**
 * Ordinal (codepoint) comparison — never `localeCompare`, which is
 * culture-sensitive and orders differently per machine. See
 * `.claude/rules/culture-invariant-by-default.md`.
 */
function ordinal(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

/** `<!-- b-ref-adjudicated: <B-id> <disposition> <evidence-path> -->` */
const ADJUDICATION_RE = /<!--\s*b-ref-adjudicated:\s*(B-\d{4}(?:\.\d+)*)\s+(\S+)\s+(\S+)\s*-->/g;

export interface Adjudication {
  readonly bId: string;
  readonly disposition: string;
  /** Repo-relative path offered as evidence for the disposition. */
  readonly evidence: string;
  /** 0-based index of the line the annotation sits on. */
  readonly line: number;
  /** That line with every annotation stripped — where the id must still appear. */
  readonly lineWithoutAnnotations: string;
}

/** Every adjudication annotation in `text`, in document order. */
export function parseAdjudications(text: string): readonly Adjudication[] {
  const out: Adjudication[] = [];
  const lines = text.split("\n");
  for (const [i, line] of lines.entries()) {
    const stripped = line.replace(ADJUDICATION_RE, " ");
    if (stripped === line) continue;
    for (const [, bId, disposition, evidence] of line.matchAll(ADJUDICATION_RE)) {
      if (bId === undefined || disposition === undefined || evidence === undefined) continue;
      out.push({
        bId: bId.toUpperCase(),
        disposition,
        evidence,
        line: i,
        lineWithoutAnnotations: stripped,
      });
    }
  }
  return out;
}

export type AdjudicationCheck =
  | { readonly ok: true; readonly disposition: string; readonly evidence: string }
  | { readonly ok: false; readonly reason: string };

/**
 * Decide whether `adj` earns the escape for `ref` in `relFile`.
 *
 * `resolution` is what the ordinary ladder said. A resolving id with an
 * adjudication is STALE and refused: the point of the annotation is to record
 * that the id names nothing, so the moment it names something the record is a
 * false claim sitting in a document. That is the clause that stops this from
 * becoming a permanent, rotting allowlist.
 *
 * `evidenceExists` is injected rather than read here so the predicate stays
 * pure and testable; the linter passes a filesystem probe.
 */
export function checkAdjudication(
  ref: string,
  relFile: string,
  adj: Adjudication,
  resolution: BRefResolution,
  evidenceExists: (relPath: string) => boolean,
): AdjudicationCheck {
  if (adj.bId !== ref.toUpperCase()) {
    return { ok: false, reason: `adjudication names ${adj.bId}, not ${ref}` };
  }
  if (!adj.lineWithoutAnnotations.includes(ref)) {
    return {
      ok: false,
      reason:
        "ADJUDICATION MISPLACED — the annotation must sit on a line that also mentions " +
        `${ref} outside the comment; a reader must meet the disposition where they meet the id`,
    };
  }
  if (!ADJUDICATION_DISPOSITIONS.has(adj.disposition)) {
    const known = [...ADJUDICATION_DISPOSITIONS].sort(ordinal);
    return {
      ok: false,
      reason: `ADJUDICATION DISPOSITION UNKNOWN — "${adj.disposition}" is not one of ${known.join(", ")}`,
    };
  }
  if (adj.evidence === relFile) {
    return {
      ok: false,
      reason: "ADJUDICATION SELF-CITED — a document may not be its own evidence",
    };
  }
  if (!evidenceExists(adj.evidence)) {
    return {
      ok: false,
      reason: `ADJUDICATION EVIDENCE MISSING — "${adj.evidence}" is not a file in this tree`,
    };
  }
  if (resolution.kind !== "unresolved") {
    return {
      ok: false,
      reason:
        `ADJUDICATION STALE — ${ref} now resolves (${resolution.kind}); ` +
        "the annotation records that it names nothing, and that is no longer true",
    };
  }
  return { ok: true, disposition: adj.disposition, evidence: adj.evidence };
}
