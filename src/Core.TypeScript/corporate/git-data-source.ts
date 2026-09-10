/**
 * git-data-source.ts — a git repository as something agents READ from.
 *
 * ── THE ARCHITECTURE THIS PLUGS INTO ─────────────────────────────────────────
 * Zeta already treats git as a database rather than as a place code happens to live:
 *
 *   `docs/DECISIONS/2026-05-29-git-native-event-store-spec.md`
 *       flat append-only files addressed by self-describing 128-bit ZetaIDs; the repository IS the
 *       event store
 *   `docs/research/2026-06-07-db-saves-git-native-DUs-mapped-over-git-as-the-db-control-plane.md`
 *       *"the database IS the git history, folded"* — git owns the SUBSTRATE (commit = event,
 *       history = log, merge = reconcile), the domain layer owns the SEMANTICS
 *   `src/Core.TypeScript/agent-bus/`
 *       the best worked example of the TECHNIQUE — `ls-tree` + `show` at a REF, unioned across
 *       clones as a G-Set (`g-set-view.ts`).
 *
 *       WHAT THE BUS IS, STATED SO THIS IS NOT MISREAD: it is COMMUNICATION — addressed messages
 *       between a fixed roster of fleet personas (`SENDER_IDS`) over nine fixed topics. A closed
 *       command set, deliberately. This module is not built on the bus and does not extend it; it
 *       reuses the git-as-database mechanism the bus demonstrates, for a different purpose
 *       (reading documents). Saying "the architecture this plugs into" about the bus itself would
 *       overstate the relationship — the architecture is git-as-database, and the bus is one
 *       consumer of it.
 *
 * The corporate register used git for CHANGE CONTROL — `gitChangeControl`, `gitWorktreeChangeControl`
 * — which is the WRITE half. There was no read half at all: no way to point the organization at a
 * repository and have an agent learn anything from it. So `business_context_grooming`, the first
 * gate in the pipeline, groomed a title.
 *
 * ── WHAT IS BORROWED, AND THE ONE THING DELIBERATELY NOT ─────────────────────
 * Borrowed from `agent-bus/subscribe.ts`, because it is right:
 *
 *   READ AT A REF, NOT THE WORKING TREE. Its own reason, and it is the correct one: *"the working
 *   tree may be on a feature branch / stale"*. An agent reading a checkout reads whatever someone
 *   left there; an agent reading `origin/main` reads what the organization agreed on. The revision
 *   is then a fact, so every document is CITABLE — `<source>:<sha>:<path>` points at bytes that
 *   still exist when a reviewer checks.
 *
 * NOT borrowed — `readEnvelopesFromGitRef` ends its git call with
 *
 *     } catch {
 *       return []; // ref or path absent (e.g. no bus folder yet)
 *     }
 *
 * That line conflates two cases: a bus folder that does not exist yet (empty IS the right answer)
 * and a git invocation that FAILED (empty is a lie). An earlier draft of this comment called it
 * "defensible", which was too generous — an agent that cannot reach the bus and reads the result as
 * silence concludes nobody is talking to it, and for a communication channel that is arguably the
 * worse place for the conflation, not the better one. It is noted, not changed: the bus is not this
 * module's to fix.
 *
 * Here the same conflation is refused outright. A repository that could not be read must not be
 * indistinguishable from one holding nothing, or an agent grooms against silence while reporting
 * that it consulted the source. So a MISSING REF IS A REFUSAL, and only an empty-but-readable tree
 * is an empty answer. `directoryIntake` already made this exact call — "a broken mount looks like a
 * quiet morning" — and this is that rule one substrate over.
 */

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { Fidelity, Port, type DataSourcePort, type PortResult, type SourceDocument } from "./providers";

/** How much of a file is worth reading. A source document is context, not a payload. */
export const MAX_DOCUMENT_BYTES = 64 * 1024;

export interface GitSourceInput {
  /** The repository to read. */
  readonly repoDir: string;
  /**
   * The revision to read AT — a branch, a tag, a sha. Defaults to `origin/main`.
   *
   * `origin/main` and not `HEAD`: HEAD is whatever the local checkout is on, which is a property of
   * one machine rather than of the organization.
   */
  readonly ref?: string;
  /** Restrict to a subtree. Absent reads the whole tree at that ref. */
  readonly subdir?: string;
  /** Which extensions count as readable text. Anything else is skipped, not decoded. */
  readonly extensions?: readonly string[];
  readonly name?: string;
}

/**
 * TEXT ONLY, and the list is explicit.
 *
 * `no-binary-in-proof-lineage` says verification artifacts are text so a reviewer can read them and
 * a diff can merge them. A grooming artifact citing a `.png` cites something nobody can check, and
 * decoding a binary into a string would put replacement characters into an agent's context and call
 * it business context.
 */
export const DEFAULT_TEXT_EXTENSIONS: readonly string[] = [
  ".md",
  ".txt",
  ".json",
  ".yml",
  ".yaml",
  ".toml",
  ".csv",
];

/**
 * Read a git repository at a ref as a set of documents.
 *
 * Every document carries the resolved COMMIT SHA rather than the ref it was asked for. A ref is a
 * moving name — `origin/main` means something different tomorrow — so recording it would produce
 * citations that rot. Resolving once, up front, also makes the whole read consistent: every
 * document in one call comes from the same commit, which a per-file `git show <ref>:<path>` cannot
 * promise if the ref moves mid-read.
 */
export function gitDataSource(input: GitSourceInput): DataSourcePort {
  const ref = input.ref ?? "origin/main";
  const name = input.name ?? "git";
  const extensions = input.extensions ?? DEFAULT_TEXT_EXTENSIONS;
  const subtree = input.subdir === undefined ? "." : input.subdir;

  const meta = {
    port: Port.DataSource,
    name,
    fidelity: Fidelity.Real,
    describes: `reads ${subtree} from ${input.repoDir} at ${ref}`,
  };

  /**
   * The documents of one commit, remembered.
   *
   * NOT an optimisation bolted on: `query` folds over `read`, and grooming queries once per term,
   * so an uncached source re-ran `git show` for every file for every term — measured at O(terms x
   * files) subprocesses per work item, which took a five-second test past its timeout against 69
   * files. Caching is also SOUND rather than a shortcut: a commit is immutable, so the documents at
   * a resolved sha cannot change.
   *
   * Keyed by the RESOLVED REVISION, and the ref is re-resolved on every call. A moving ref
   * therefore misses the cache and re-reads, which is the behaviour a caller pointing at
   * `origin/main` needs — the cache never pins a source to a commit it has moved off.
   */
  let cache: { readonly revision: string; readonly documents: readonly SourceDocument[] } | undefined;

  const readAll = async (): Promise<PortResult<readonly SourceDocument[]>> => {
    // ── RESOLVE THE REF FIRST ────────────────────────────────────────────
    // A refusal here is a refusal, never an empty tree. See the header: a repository that could
    // not be read must not be indistinguishable from one holding nothing.
    let revision: string;
    try {
      revision = git(input.repoDir, ["rev-parse", ref]).trim();
    } catch (err) {
      return {
        ok: false,
        reason: `could not resolve '${ref}' in ${input.repoDir}: ${message(err)}`,
      };
    }
    if (revision === "") {
      return { ok: false, reason: `'${ref}' in ${input.repoDir} resolved to nothing` };
    }

    if (cache !== undefined && cache.revision === revision) {
      return {
        ok: true,
        value: cache.documents,
        evidence: [{ kind: "document" as const, ref: `${name}:${revision}:${subtree}` }],
      };
    }

    let listing: string;
    try {
      // `-l` for the LONG format, which carries each blob's SIZE. Sizes come from the tree rather
      // than from reading: the first draft truncated only AFTER `git show` returned, so one huge
      // blob blew past the subprocess buffer and failed the entire read. Measured against this
      // repository — a single `docs/amara-full-conversation/*.md` took the whole source down.
      listing = git(input.repoDir, ["ls-tree", "-r", "-l", revision, "--", subtree]);
    } catch (err) {
      // UNCOVERED, and named rather than left looking tested. `rev-parse` has already succeeded by
      // here, so `ls-tree` at that same sha effectively cannot fail in a healthy repository — a
      // nonexistent subtree lists EMPTY rather than erroring, which the "empty but readable"
      // falsifier pins. This guards a repository that becomes unreadable BETWEEN the two calls;
      // its mutant survives the matrix, and pretending otherwise would be worse than saying so.
      return { ok: false, reason: `could not list ${subtree} at ${revision}: ${message(err)}` };
    }

    // ORDINAL, never `localeCompare`: the order two machines read a repository in must not depend
    // on either machine's locale, or a fold over the same commit yields different results.
    const entries = listing
      .split("\n")
      .map(parseTreeEntry)
      .filter((e): e is TreeEntry => e !== undefined && extensions.some((x) => e.path.endsWith(x)))
      .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

    // TOO LARGE TO INLINE IS ITS OWN ANSWER — a third state beside read and unreadable. The
    // citation still points at real bytes a reviewer can open, and the content says why they are
    // not here. Omitting the file silently would make the source claim a completeness it lacks;
    // failing the read would let one oversized document deny an agent the other four hundred.
    const inlinable = entries.filter((e) => e.size <= MAX_DOCUMENT_BYTES);

    // ── ONE SUBPROCESS, NOT ONE PER FILE ──────────────────────────────────
    // This was `git show <rev>:<path>` per document — ~70 subprocesses per read of one directory,
    // and the idempotence falsifier builds two sources, so ~140. Under the process pressure of a
    // full test run one failed to spawn and the whole read was refused: deterministically red in
    // the suite, green in isolation. `cat-file --batch` reads every blob in one call.
    let blobs: ReadonlyMap<string, string>;
    try {
      blobs = readBlobs(input.repoDir, revision, inlinable.map((e) => e.path));
    } catch (err) {
      // AN UNREADABLE READ FAILS THE READ. A partial document set that says nothing about what it
      // dropped is a source an agent would groom against believing it saw everything.
      return { ok: false, reason: `could not read ${subtree} at ${revision}: ${message(err)}` };
    }

    const documents: SourceDocument[] = [];
    for (const entry of entries) {
      const path = entry.path;
      if (entry.size > MAX_DOCUMENT_BYTES) {
        documents.push({
          path,
          revision,
          content: `[not inlined: ${String(entry.size)} bytes exceeds the ${String(MAX_DOCUMENT_BYTES)}-byte limit]`,
          ref: `${name}:${revision}:${path}`,
        });
        continue;
      }
      const content = blobs.get(path);
      if (content === undefined) {
        // A blob `ls-tree` named and `cat-file` did not return.
        //
        // UNREACHABLE IN A HEALTHY REPOSITORY, and its mutant survives the matrix — both commands
        // read the same object database at the same revision, so a path in the listing is a path
        // the batch answers. Said carefully, because the code this replaced made the SAME claim
        // about `git show` and was WRONG: that branch was reached constantly, by failed process
        // spawns rather than by anything about the object. The difference is that spawning is no
        // longer per file — there is one subprocess, and if it fails the catch above refuses the
        // whole read. What is left here is genuinely about the object.
        return { ok: false, reason: `could not read ${path} at ${revision}: not in the batch` };
      }
      documents.push({ path, revision, content, ref: `${name}:${revision}:${path}` });
    }
    cache = { revision, documents };
    return {
      ok: true,
      value: documents,
      evidence: [{ kind: "document" as const, ref: `${name}:${revision}:${subtree}` }],
    };
  };

  return {
    meta,
    read: readAll,
    query: async (term) => {
      const all = await readAll();
      if (!all.ok) return all;
      // ORDINAL substring, case-sensitive. A case-insensitive match needs a locale to define what
      // "insensitive" means, and two machines disagreeing about that is the same divergence the
      // ordering rule prevents.
      const hits = all.value.filter((d) => d.path.includes(term) || d.content.includes(term));
      return {
        ok: true,
        value: hits,
        evidence: [{ kind: "document" as const, ref: `${name}:query:${term}:${String(hits.length)} hit(s)` }],
      };
    },
  };
}

interface TreeEntry {
  readonly path: string;
  readonly size: number;
}

/**
 * One `git ls-tree -l` line: `<mode> <type> <sha> <size>\t<path>`.
 *
 * Anything that is not a sized blob yields `undefined` — a submodule reports `-` for its size, and
 * a tree entry is not a document. Returning `undefined` rather than guessing a size means an entry
 * this parser does not understand is skipped visibly instead of being read as an empty file.
 */
function parseTreeEntry(line: string): TreeEntry | undefined {
  const tab = line.indexOf("\t");
  if (tab < 0) return undefined;
  const path = line.slice(tab + 1).trim();
  const size = Number.parseInt(line.slice(0, tab).trim().split(/\s+/)[3] ?? "", 10);
  if (path === "" || Number.isNaN(size)) return undefined;
  return { path, size };
}
/** One git invocation. Never a shell string — arguments are passed as an array, so a path cannot become a flag. */
function git(cwd: string, args: readonly string[]): string {
  return execFileSync("git", [...args], { cwd, encoding: "utf-8", maxBuffer: 32 * 1024 * 1024 });
}

/**
 * Every named blob at one revision, in ONE subprocess.
 *
 * ── WHY BYTES AND NOT A STRING ───────────────────────────────────────────────
 * `cat-file --batch` answers `<sha> <type> <size>` then a newline, the contents, and a newline —
 * and `<size>` counts BYTES. Decoding the stream as UTF-8 first would make every offset after the
 * first non-ASCII character wrong, and these documents are full of em-dashes. So the stream is
 * parsed as a Buffer and each blob is decoded on its own.
 *
 * A missing object answers `<name> missing` and is simply absent from the map; the caller turns
 * that into a refusal rather than a silently shorter document set.
 */
export function readBlobs(cwd: string, revision: string, paths: readonly string[]): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  if (paths.length === 0) return out;

  const stdout: Buffer = execFileSync("git", ["cat-file", "--batch"], {
    cwd,
    input: `${paths.map((p) => `${revision}:${p}`).join("\n")}\n`,
    maxBuffer: 512 * 1024 * 1024,
  });

  const NEWLINE = 0x0a;
  let at = 0;
  for (const path of paths) {
    const headerEnd = stdout.indexOf(NEWLINE, at);
    if (headerEnd < 0) break;
    const header = stdout.subarray(at, headerEnd).toString("utf-8");
    at = headerEnd + 1;
    // `<sha> <type> <size>`; anything else (`missing`, `ambiguous`) leaves the path unmapped.
    const parts = header.split(" ");
    const size = parts.length === 3 ? Number.parseInt(parts[2] ?? "", 10) : Number.NaN;
    if (!Number.isFinite(size)) continue;
    out.set(path, stdout.subarray(at, at + size).toString("utf-8"));
    at += size + 1; // the newline git writes after the contents
  }
  return out;
}

function message(err: unknown): string {
  return err instanceof Error ? err.message.split("\n")[0] ?? err.message : String(err);
}

/**
 * A data source with no repository behind it — for tests and for a run that declares none.
 *
 * LABELLED SIMULATED, so a run's fidelity report shows that its grooming read nothing real. That
 * label is the entire reason this exists rather than callers passing `undefined`: absence of a
 * source would be invisible, and a simulated one is not.
 */
export function simulatedDataSource(
  documents: readonly SourceDocument[],
  name = "fixture",
): DataSourcePort {
  const read = async (): Promise<PortResult<readonly SourceDocument[]>> => ({
    ok: true,
    value: documents,
    evidence: [{ kind: "document" as const, ref: `${name}:${String(documents.length)} document(s)` }],
  });
  return {
    meta: {
      port: Port.DataSource,
      name,
      fidelity: Fidelity.Simulated,
      describes: `${String(documents.length)} fixture document(s); no repository is read`,
    },
    read,
    query: async (term) => {
      const all = await read();
      if (!all.ok) return all;
      return {
        ok: true,
        value: all.value.filter((d) => d.path.includes(term) || d.content.includes(term)),
        evidence: [{ kind: "document" as const, ref: `${name}:query:${term}` }],
      };
    },
  };
}

/**
 * Read several sources as one — the G-Set union the agent-bus already models.
 *
 * `agent-bus/g-set-view.ts` states the property this relies on: the union of documents from
 * disjoint sources is grow-only, commutative and idempotent, so no coordinator is needed and merge
 * order does not matter. Documents are keyed by `ref`, which contains the revision — so the same
 * file at two revisions is two documents, and the same file read twice is one.
 *
 * A refusal from ANY source refuses the whole union. Silently unioning the sources that answered
 * would produce a context that looks complete and is missing a repository, which is the failure
 * mode a merged view is most likely to hide.
 */
/**
 * The organization's OWN documents — what it has written, not what it was given.
 *
 * ── WHY THIS IS A SEPARATE SOURCE ───────────────────────────────────────────
 * The register reads a wiki, a repository, a specification folder. It must never write back to
 * them: `DataSourcePort` has `read` and `query` and nothing else, so an adapter physically cannot
 * edit the corpus it reads. That is deliberate. An organization that rewrites the company wiki as
 * a side effect of grooming a defect is not doing governance, it is doing damage, and "we will be
 * careful" is not a control.
 *
 * So the org accumulates its own business record HERE instead — the BRDs, architecture notes and
 * cost rulings its phases produced. Unioned with the read-only corpus, each new work item is
 * written against both what the company documented and what the organization itself concluded last
 * time. That is how it builds an internal view over many tickets without touching a wiki page.
 *
 * Publishing any of it outward stays a separate, deliberate act by something that is not this port.
 */
export function directoryDataSource(input: {
  readonly dir: string;
  readonly name?: string;
  /** Extensions to read. Absent means markdown, which is what the phases write. */
  readonly extensions?: readonly string[];
}): DataSourcePort {
  const name = input.name ?? "org-record";
  const exts = input.extensions ?? [".md"];
  const collect = (): readonly SourceDocument[] => {
    const out: SourceDocument[] = [];
    const walk = (at: string, rel: string): void => {
      let entries: readonly string[];
      try {
        entries = readdirSync(at);
      } catch {
        // A record that does not exist yet is EMPTY, not an error: the first run has written
        // nothing, and refusing there would make the union refuse and take the real corpus with it.
        return;
      }
      // ORDINAL, not whatever the filesystem returns. Directory order is not stable across
      // machines, and a context whose document order changes between runs is a context that cannot
      // be replayed or compared.
      for (const entry of [...entries].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
        const full = join(at, entry);
        const next = rel === "" ? entry : `${rel}/${entry}`;
        let stat;
        try {
          stat = statSync(full);
        } catch {
          continue;
        }
        if (stat.isDirectory()) {
          walk(full, next);
          continue;
        }
        if (!exts.some((e) => entry.endsWith(e))) continue;
        let content = "";
        try {
          content = readFileSync(full, "utf-8");
        } catch {
          continue;
        }
        // The REVISION is the file's own mtime. A wiki page has a version; a written record has the
        // moment it was written, and a citation with no revision is not a citation.
        const revision = String(Math.floor(stat.mtimeMs));
        out.push({ path: next, revision, content, ref: `${name}:${revision}:${next}` });
      }
    };
    walk(input.dir, "");
    return out;
  };
  const answer = async (
    docs: readonly SourceDocument[],
  ): Promise<PortResult<readonly SourceDocument[]>> => ({
    ok: true,
    value: docs,
    evidence: [{ kind: "document" as const, ref: `${name}:${String(docs.length)} document(s)` }],
  });
  return {
    meta: {
      port: Port.DataSource,
      name,
      fidelity: Fidelity.Real,
      describes: `reads the organization's own written record under ${input.dir}`,
    },
    read: async () => answer(collect()),
    query: async (term) => {
      const needle = term.toLowerCase();
      return answer(
        collect().filter(
          (d) => d.path.toLowerCase().includes(needle) || d.content.toLowerCase().includes(needle),
        ),
      );
    },
  };
}

export function unionOf(sources: readonly DataSourcePort[], name = "union"): DataSourcePort {
  const gather = async (
    take: (s: DataSourcePort) => Promise<PortResult<readonly SourceDocument[]>>,
  ): Promise<PortResult<readonly SourceDocument[]>> => {
    const byRef = new Map<string, SourceDocument>();
    const evidence: { kind: "document"; ref: string }[] = [];
    for (const source of sources) {
      const r = await take(source);
      if (!r.ok) {
        return { ok: false, reason: `source '${source.meta.name}' refused: ${r.reason}` };
      }
      // Idempotent by ref — the G-Set property. First write wins, and because the key contains the
      // revision, two sources holding the same file at the same commit hold the same document.
      for (const d of r.value) if (!byRef.has(d.ref)) byRef.set(d.ref, d);
      evidence.push(...r.evidence.map((e) => ({ kind: "document" as const, ref: e.ref })));
    }
    return {
      ok: true,
      // Sorted ORDINALLY so the union is a deterministic value rather than an artifact of the order
      // the sources were listed in — commutativity has to be visible in the output to be worth
      // anything.
      value: [...byRef.values()].sort((a, b) => (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0)),
      evidence,
    };
  };

  return {
    meta: {
      port: Port.DataSource,
      name,
      // The union is exactly as real as its least-real member. A union containing one fixture is
      // not a real reading of the world, and reporting it as one is how a fidelity report starts
      // lying about what a run touched.
      fidelity: sources.every((s) => s.meta.fidelity === Fidelity.Real) ? Fidelity.Real : Fidelity.Simulated,
      describes: `the union of ${String(sources.length)} source(s): ${sources.map((s) => s.meta.name).join(", ")}`,
    },
    read: async () => gather((s) => s.read()),
    query: async (term) => gather((s) => s.query(term)),
  };
}
