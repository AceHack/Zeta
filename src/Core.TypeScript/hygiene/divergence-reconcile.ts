#!/usr/bin/env bun
// divergence-reconcile.ts — reader for the morning-reconciliation half of the
// dual-loop disagreement-preservation protocol (081KR7JY10008QG0R000MH7PJT, AC #4).
//
// The WRITER half (divergence-shard.ts) files a shard whenever two loops reach
// different conclusions on the same substrate-class commitment (AC #2). This is
// the complementary READER half: it scans the divergence directory and surfaces
// every shard whose `## Reconciliation` section is still empty — the exact set
// the README says "morning reconciliation reads ... with empty Reconciliation
// sections." That list IS the "one read" of AC #4 ("the morning reconciliation
// can resolve the thread in one read + one action"): the reader produces the
// read; the maintainer fills the section + resolves the thread (the action).
//
// This is the UNBLOCKED slice of 081KR7JY10008QG0R000MH7PJT: parsing existing shard files needs no
// concurrent-loop harness, so it is fully testable in isolation against shards
// the writer emits. The end-to-end protocol (two loops reviewing the same thread
// live) remains the blocked impl child pending 081KQJZR90008QG0R000FTJ1TC.
//
// Pure functions (no I/O): reconciliationBody, isReconciliationPending,
//   isReconciliationDecision, fillReconciliation, parseShardMeta,
//   findPendingShards.
// I/O functions: scanDivergenceDir (reader — delegates classification to the
//   pure layer) + reconcileDivergenceShard (writer — lands fillReconciliation's
//   output back in place).
//
// The reader surfaces the "one read" of AC #4; fillReconciliation produces the
// shard-side of the "one action" (the in-place `## Reconciliation` edit) and
// reconcileDivergenceShard is the I/O glue that LANDS that edit — reading the
// shard, applying fillReconciliation, and writing the reconciled markdown back
// in place. Together they are the full "one action" of AC #4, mirroring how
// fileReviewThreadDisagreement (divergence-shard.ts, AC #2) composes the pure
// detector with the writer. It stays below the blocked end-to-end boundary: it
// never touches GitHub, never resolves the live PR thread.
//
// Schema source of truth: docs/hygiene-history/divergences/README.md
// Writer companion:        src/Core.TypeScript/hygiene/divergence-shard.ts

import { execFileSync } from "node:child_process";
import { Buffer } from "node:buffer";
import {
  closeSync,
  constants,
  fstatSync,
  ftruncateSync,
  lstatSync,
  openSync,
  readFileSync,
  readdirSync,
  writeSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

// Mirrors DIVERGENCE_ROOT in divergence-shard.ts. Both files reflect the path
// the README fixes as the source of truth; a comment-cited copy keeps the
// reader's blast radius to this one file (no writer edit needed).
const DIVERGENCE_ROOT = "docs/hygiene-history/divergences";

/** Frontmatter fields the reconciliation reader surfaces for "one read". */
export interface ShardMeta {
  /** ISO 8601 UTC, seconds precision, e.g. "2026-05-10T11:48:00Z". */
  readonly tick: string;
  /** The substrate path or topic in conflict. */
  readonly topic: string;
  /** Loop A's named agent identifier (e.g. "otto"). */
  readonly loopAAgent: string;
  /** Loop B's named agent identifier (e.g. "codex-loop"). */
  readonly loopBAgent: string;
}

/** A shard awaiting morning reconciliation, with its repo-relative path. */
export interface PendingShard extends ShardMeta {
  readonly relPath: string;
}

/** A YAML double-quoted scalar is a JSON string; unquote leniently. */
function unquote(value: string): string {
  const t = value.trim();
  if (t.startsWith('"')) {
    try {
      return JSON.parse(t) as string;
    } catch {
      return t;
    }
  }
  return t;
}

/**
 * The text of the `## Reconciliation` section (everything from after its heading
 * to the next `## ` heading, or EOF — the schema places it last). Returns null
 * when the file has no such section.
 */
export function reconciliationBody(markdown: string): string | null {
  const heading = /^## Reconciliation[ \t]*$/m.exec(markdown);
  if (!heading) return null;
  let rest = markdown.slice(heading.index + heading[0].length);
  // Defensive: cut at the next `## ` heading if the schema ever grows a section
  // after Reconciliation. Per the current README it is the final section.
  const next = rest.search(/\n## /);
  if (next !== -1) rest = rest.slice(0, next);
  return rest;
}

/**
 * True when a shard's `## Reconciliation` section carries only the maintainer-
 * fills-in placeholder (HTML comments + whitespace) — i.e. it is still awaiting
 * morning reconciliation. A shard with no Reconciliation section is treated as
 * not-pending (it is malformed, not a reconciliation to-do).
 */
export function isReconciliationPending(markdown: string): boolean {
  const body = reconciliationBody(markdown);
  if (body === null) return false;
  return stripHtmlComments(body).trim().length === 0;
}

/**
 * Remove HTML comment blocks (`<!-- … -->`) to a fixpoint. A single `/g` pass is
 * incomplete sanitization: removing one match can splice the surrounding text
 * into a fresh `<!-- … -->` (e.g. `<!--<!---->-->` leaves a residual `<!--`),
 * so we re-run until the string stops shrinking. Termination is guaranteed —
 * each changing pass strictly deletes characters. (CodeQL js/incomplete-multi-
 * character-sanitization.)
 *
 * Exported as the single source of HTML-comment sanitization for the divergence
 * protocol: divergence-shard.ts's read half (parseReconciliationStatus) reuses
 * this exact fixpoint impl rather than carrying its own pass (Copilot PR #6130).
 */
export function stripHtmlComments(text: string): string {
  let out = text;
  let prev: string;
  do {
    prev = out;
    out = out.replace(/<!--[\s\S]*?-->/g, "");
  } while (out !== prev);
  return out;
}

/**
 * The four canonical reconciliation decisions the README fixes
 * (docs/hygiene-history/divergences/README.md "Reconciliation outcomes").
 * Machine-comparable values — the gloss "(explicit divergence)" the README
 * shows beside accept-both is documentation, not part of the value.
 */
export const RECONCILIATION_DECISIONS = ["accept-loop-a", "accept-loop-b", "accept-both", "escalate"] as const;

/** A morning-reconciliation decision per the README's outcome vocabulary. */
export type ReconciliationDecision = (typeof RECONCILIATION_DECISIONS)[number];

/** True when `value` is one of the four canonical reconciliation decisions. */
export function isReconciliationDecision(value: string): value is ReconciliationDecision {
  return (RECONCILIATION_DECISIONS as readonly string[]).includes(value);
}

/**
 * Fill a PENDING shard's `## Reconciliation` section with a decision (and an
 * optional free-text note), returning the reconciled markdown. This is the
 * shard-side of AC #4's "one action" ("resolve the thread in one read + one
 * action"): the reader (scanDivergenceDir) produces the read; this turns the
 * maintainer's decision into the in-place section edit the README prescribes —
 * validated and deterministic, instead of a hand-edit.
 *
 * Pure: returns the new markdown; never writes, never touches GitHub, never
 * resolves the live thread (that half stays in the blocked impl child pending
 * 081KQJZR90008QG0R000FTJ1TC). Composes with the reader's section logic (reconciliationBody /
 * isReconciliationPending).
 *
 * Fail-closed and history-preserving (per the README "the shard is updated in
 * place (not deleted) so the divergence history is preserved permanently", and
 * the writer's never-overwrite-differing-content rule):
 *   - invalid `decision` → throw, even though the type guards it, because
 *     runtime callers (CLI args) pass raw strings. EAGER validation matches the
 *     detector in divergence-shard.ts.
 *   - no `## Reconciliation` section (malformed shard) → throw.
 *   - already-reconciled shard (section is not the placeholder) → throw, rather
 *     than silently overwriting a prior human decision.
 *
 * Everything up to and including the `## Reconciliation` heading is preserved
 * byte-for-byte. A `## ` section after Reconciliation (should the schema ever
 * grow one) is preserved too, mirroring reconciliationBody's defensive bounding.
 * A blank/whitespace-only note is treated as no note (the note is optional).
 */
export function fillReconciliation(markdown: string, decision: ReconciliationDecision, note?: string): string {
  if (!isReconciliationDecision(decision)) {
    throw new Error(
      `invalid reconciliation decision "${decision}": expected one of ${RECONCILIATION_DECISIONS.join(" | ")}`,
    );
  }
  const heading = /^## Reconciliation[ \t]*$/m.exec(markdown);
  if (!heading) {
    throw new Error("cannot fill reconciliation: shard has no `## Reconciliation` section");
  }
  if (!isReconciliationPending(markdown)) {
    throw new Error(
      "refusing to fill reconciliation: section is already reconciled (overwriting would erase a prior decision)",
    );
  }
  const afterHeading = heading.index + heading[0].length;
  const rest = markdown.slice(afterHeading);
  const nextIdx = rest.search(/\n## /);
  const tail = nextIdx === -1 ? "" : rest.slice(nextIdx);
  const trimmedNote = note?.trim() ?? "";
  const body = trimmedNote.length === 0 ? decision : `${decision}\n\n${trimmedNote}`;
  return `${markdown.slice(0, afterHeading)}\n\n${body}\n${tail}`;
}

/** Value of an `agent:` line nested under `parentKey:` in a frontmatter block. */
function nestedAgent(frontmatter: string, parentKey: string): string | null {
  const lines = frontmatter.split("\n");
  const start = lines.findIndex((l) => new RegExp(`^${parentKey}:`).test(l));
  if (start === -1) return null;
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i]!;
    if (/^[A-Za-z_]/.test(l)) break; // next unindented top-level key ends the block
    const am = /^\s+agent:[ \t]*(.+)$/.exec(l);
    if (am) return unquote(am[1]!);
  }
  return null;
}

/**
 * Parse a divergence shard's frontmatter into the reconciliation-relevant
 * fields. Returns null when the text is not a divergence shard (no frontmatter,
 * or `type:` is not `divergence`) — so non-shard files (README, stray docs) are
 * filtered out by construction.
 */
export function parseShardMeta(markdown: string): ShardMeta | null {
  const fm = /^---\n([\s\S]*?)\n---/.exec(markdown);
  if (!fm) return null;
  const block = fm[1]!;
  const typeM = /^type:[ \t]*(\S+)/m.exec(block);
  if (!typeM || typeM[1] !== "divergence") return null;
  const tickM = /^tick:[ \t]*(.+)$/m.exec(block);
  const topicM = /^topic:[ \t]*(.+)$/m.exec(block);
  return {
    tick: tickM ? unquote(tickM[1]!) : "",
    topic: topicM ? unquote(topicM[1]!) : "",
    loopAAgent: nestedAgent(block, "loop-a") ?? "?",
    loopBAgent: nestedAgent(block, "loop-b") ?? "?",
  };
}

/**
 * Pure classification: from a set of files, return the divergence shards whose
 * Reconciliation section is still empty, oldest-first (ISO 8601 ticks sort
 * lexicographically == chronologically; ties break on path for determinism).
 * Non-shard files and already-reconciled shards are excluded.
 */
export function findPendingShards(files: ReadonlyArray<{ relPath: string; content: string }>): PendingShard[] {
  const pending: PendingShard[] = [];
  for (const { relPath, content } of files) {
    const meta = parseShardMeta(content);
    if (meta === null) continue; // not a divergence shard
    if (!isReconciliationPending(content)) continue; // already reconciled
    pending.push({ relPath, ...meta });
  }
  pending.sort((a, b) =>
    a.tick < b.tick ? -1 : a.tick > b.tick ? 1 : a.relPath < b.relPath ? -1 : a.relPath > b.relPath ? 1 : 0,
  );
  return pending;
}

/**
 * Walk `<repoRoot>/<divergenceRel>` for `.md` shards (excluding README.md) and
 * return those awaiting reconciliation. Filesystem-reading; delegates all
 * classification to the pure layer. Returns [] when the directory is absent.
 */
export function scanDivergenceDir(repoRoot: string, divergenceRel: string = DIVERGENCE_ROOT): PendingShard[] {
  const root = join(repoRoot, divergenceRel);
  if (!assertRealDivergenceRoot(root, divergenceRel, "scan divergences")) return [];
  const files: { relPath: string; content: string }[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
        continue;
      }
      if (entry.isSymbolicLink()) continue;
      if (!entry.name.endsWith(".md")) continue;
      if (entry.name === "README.md") continue;
      files.push({ relPath: relative(repoRoot, abs), content: readFileSync(abs, "utf8") });
    }
  };
  walk(root);
  return findPendingShards(files);
}

/** Outcome of landing a reconciliation decision on a shard file. */
export interface ReconcileResult {
  /** Repo-relative path of the shard that was reconciled. */
  readonly relPath: string;
  /** The decision that was written into the `## Reconciliation` section. */
  readonly decision: ReconciliationDecision;
}

export type ListOutputFormat = "text" | "json";

/** Stable machine-readable payload for pending divergence reconciliation reads. */
export interface PendingShardListJson {
  readonly schemaVersion: 1;
  readonly pending: readonly PendingShard[];
}

/** CLI action parsed from argv. */
export type CliCommand =
  | { readonly kind: "list"; readonly format: ListOutputFormat }
  | { readonly kind: "help" }
  | {
      readonly kind: "reconcile";
      readonly relPath: string;
      readonly decision: ReconciliationDecision;
      readonly note?: string;
    };

export type ParseArgsResult =
  | { readonly kind: "ok"; readonly command: CliCommand }
  | { readonly kind: "error"; readonly message: string };

export function usage(): string {
  return [
    "Usage:",
    "  bun src/Core.TypeScript/hygiene/divergence-reconcile.ts",
    "  bun src/Core.TypeScript/hygiene/divergence-reconcile.ts --list [--json]",
    "  bun src/Core.TypeScript/hygiene/divergence-reconcile.ts --json",
    "  bun src/Core.TypeScript/hygiene/divergence-reconcile.ts --reconcile <relPath> --decision <decision> [--note <text>]",
    "",
    `Decisions: ${RECONCILIATION_DECISIONS.join(" | ")}`,
  ].join("\n");
}

export function parseArgs(argv: readonly string[]): ParseArgsResult {
  if (argv.length === 0) return { kind: "ok", command: { kind: "list", format: "text" } };

  let relPath: string | undefined;
  let decision: string | undefined;
  let note: string | undefined;
  let sawList = false;
  let sawJson = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--help" || arg === "-h") {
      return { kind: "ok", command: { kind: "help" } };
    }
    if (arg === "--list") {
      sawList = true;
      continue;
    }
    if (arg === "--json") {
      sawJson = true;
      continue;
    }
    if (arg === "--reconcile") {
      relPath = argv[++i];
      if (!relPath || relPath.startsWith("--")) {
        return { kind: "error", message: "--reconcile requires a shard path" };
      }
      continue;
    }
    if (arg === "--decision") {
      decision = argv[++i];
      if (!decision || decision.startsWith("--")) {
        return { kind: "error", message: "--decision requires a value" };
      }
      continue;
    }
    if (arg === "--note") {
      note = argv[++i];
      if (note === undefined || note.startsWith("--")) {
        return { kind: "error", message: "--note requires a value" };
      }
      continue;
    }
    return { kind: "error", message: `unknown argument: ${arg}` };
  }

  if (sawList && (relPath !== undefined || decision !== undefined || note !== undefined)) {
    return { kind: "error", message: "--list cannot be combined with reconciliation arguments" };
  }
  if (sawJson && (relPath !== undefined || decision !== undefined || note !== undefined)) {
    return { kind: "error", message: "--json can only be used with list mode" };
  }
  if (sawList || sawJson) {
    return { kind: "ok", command: { kind: "list", format: sawJson ? "json" : "text" } };
  }
  if (relPath === undefined) {
    return { kind: "error", message: "--reconcile is required when passing reconciliation arguments" };
  }
  if (decision === undefined) {
    return { kind: "error", message: "--decision is required with --reconcile" };
  }
  if (!isReconciliationDecision(decision)) {
    return {
      kind: "error",
      message: `invalid reconciliation decision "${decision}": expected one of ${RECONCILIATION_DECISIONS.join(" | ")}`,
    };
  }
  const command: CliCommand =
    note === undefined ? { kind: "reconcile", relPath, decision } : { kind: "reconcile", relPath, decision, note };
  return { kind: "ok", command };
}

export function regularShardOpenFlags(noFollowFlag: unknown): number {
  if (typeof noFollowFlag !== "number" || noFollowFlag === 0) {
    throw new Error(
      "cannot reconcile: O_NOFOLLOW is unavailable on this platform; refusing write-back without symlink protection",
    );
  }
  return constants.O_RDWR | noFollowFlag;
}

function openRegularShardForReadWrite(abs: string, relPath: string): number {
  try {
    return openSync(abs, regularShardOpenFlags(constants.O_NOFOLLOW));
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new Error(`cannot reconcile: no divergence shard at ${relPath}`);
    }
    if (code === "ELOOP") {
      throw new Error(`cannot reconcile: ${relPath} is a symbolic link; divergence shards must be regular files`);
    }
    if (code === "EISDIR") {
      throw new Error(`cannot reconcile: ${relPath} is not a regular file`);
    }
    throw err;
  }
}

function assertRealDivergenceRoot(absRoot: string, divergenceRel: string, action: string): boolean {
  // Walk every component from the repo root through DIVERGENCE_ROOT, lstat-ing
  // each one. lstat only refuses to follow the FINAL path component, so a bare
  // lstat(absRoot) still follows symlinked ancestors above the root (docs/,
  // docs/hygiene-history/) — symlinking one of those would silently redirect
  // write-back outside the tree (CWE-59 link following). Reconstruct the repo
  // base lexically (resolve up one level per relative component) and lstat
  // forward so a symlink at ANY component in the chain fails closed.
  const relParts = divergenceRel.split("/").filter(Boolean);
  let cursor = resolve(absRoot, ...relParts.map(() => ".."));
  for (const part of relParts) {
    cursor = join(cursor, part);
    try {
      const stat = lstatSync(cursor);
      if (stat.isSymbolicLink()) {
        throw new Error(
          `cannot ${action}: ${divergenceRel} is a symbolic link; divergence root must be a real directory`,
        );
      }
      if (!stat.isDirectory()) {
        throw new Error(`cannot ${action}: ${divergenceRel} is not a directory`);
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return false;
      }
      throw err;
    }
  }
  return true;
}

function rejectSymlinkedAncestors(divergenceRoot: string, abs: string, relPath: string): void {
  if (!assertRealDivergenceRoot(divergenceRoot, DIVERGENCE_ROOT, "reconcile")) return;

  const within = relative(divergenceRoot, abs);
  const parts = within.split(sep).filter(Boolean);
  let cursor = divergenceRoot;
  for (const part of parts.slice(0, -1)) {
    cursor = join(cursor, part);
    try {
      const stat = lstatSync(cursor);
      if (stat.isSymbolicLink()) {
        throw new Error(
          `cannot reconcile: ${relPath} contains a symbolic link; shard ancestors must be real directories`,
        );
      }
      if (!stat.isDirectory()) {
        throw new Error(`cannot reconcile: ${relPath} is not a regular file`);
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`cannot reconcile: no divergence shard at ${relPath}`);
      }
      throw err;
    }
  }
}

function writeAllUtf8Sync(fd: number, content: string): void {
  const bytes = Buffer.from(content, "utf8");
  let offset = 0;
  while (offset < bytes.length) {
    const written = writeSync(fd, bytes, offset, bytes.length - offset, offset);
    if (written <= 0) {
      throw new Error("cannot reconcile: write made no progress");
    }
    offset += written;
  }
}

/**
 * Apply a morning-reconciliation decision to a PENDING divergence shard and
 * write the reconciled markdown back IN PLACE — the I/O "one action" of AC #4
 * ("the morning reconciliation can resolve the thread in one read + one
 * action"). scanDivergenceDir produces the read; this lands the maintainer's
 * decision, composing the pure shard-side transform (fillReconciliation) with a
 * single in-place write. It mirrors fileReviewThreadDisagreement
 * (divergence-shard.ts, AC #2), which composes the pure detector with the writer.
 *
 * The in-place overwrite IS the README-prescribed update
 * (docs/hygiene-history/divergences/README.md "Reconciliation outcomes": "the
 * shard is updated in place (not deleted) so the divergence history is preserved
 * permanently"). This is the deliberate OPPOSITE of the divergence WRITER's
 * never-overwrite-differing-content rule: the writer guards uncommitted
 * divergence evidence, whereas reconciliation transforms a pending placeholder
 * into a decided section. fillReconciliation preserves every byte up to and
 * including the `## Reconciliation` heading — both loop perspectives and the
 * disagreement summary survive verbatim — and git preserves the
 * pre-reconciliation revision, so no divergence evidence is erased.
 *
 * Fail-closed, all validation surfaced BEFORE the write so a rejected call never
 * mutates the file:
 *   - no shard at <repoRoot>/<relPath> → throw (clear message), no write.
 *   - not a divergence shard (parseShardMeta returns null: missing frontmatter
 *     or type != divergence) → throw, no write. Guards against a mistyped
 *     relPath pointing at some other markdown that happens to carry a
 *     `## Reconciliation` heading.
 *   - invalid decision / no `## Reconciliation` section / already-reconciled
 *     shard → fillReconciliation throws, no write (a prior human decision is
 *     never silently erased; a second reconcile run on the same shard fails
 *     closed rather than re-deciding).
 *
 * Stays below the blocked end-to-end boundary: never touches GitHub, never
 * resolves the live PR thread (that half remains the blocked impl child pending
 * 081KQJZR90008QG0R000FTJ1TC).
 */
export function reconcileDivergenceShard(
  repoRoot: string,
  relPath: string,
  decision: ReconciliationDecision,
  note?: string,
): ReconcileResult {
  // Constrain relPath to the divergence root before any I/O. A write-back
  // helper that does join(repoRoot, relPath) blindly can be steered to clobber
  // unrelated files via an absolute path or "../" traversal; bound it to
  // docs/hygiene-history/divergences/ (the only place shards live).
  const divergenceRoot = resolve(repoRoot, DIVERGENCE_ROOT);
  const abs = resolve(repoRoot, relPath);
  const within = relative(divergenceRoot, abs);
  if (within === "" || within.startsWith("..") || isAbsolute(within)) {
    throw new Error(`cannot reconcile: ${relPath} is outside the divergence root (${DIVERGENCE_ROOT})`);
  }
  rejectSymlinkedAncestors(divergenceRoot, abs, relPath);
  // Read directly and treat a missing file as a signal rather than pre-checking
  // with existsSync — the check-then-read gap is a TOCTOU race (CWE-367), and
  // the error path is the same friendly message either way.
  let fd: number | undefined;
  try {
    fd = openRegularShardForReadWrite(abs, relPath);
    const stat = fstatSync(fd);
    if (!stat.isFile()) {
      throw new Error(`cannot reconcile: ${relPath} is not a regular file`);
    }
    const original = readFileSync(fd, "utf8");
    if (parseShardMeta(original) === null) {
      throw new Error(
        `cannot reconcile: ${relPath} is not a divergence shard (missing frontmatter or type != divergence)`,
      );
    }
    // fillReconciliation validates eagerly (decision vocabulary + section
    // present + still pending) and throws before mutation. Compute the
    // reconciled markdown first; only truncate/write once it has succeeded.
    const reconciled = fillReconciliation(original, decision, note);
    ftruncateSync(fd, 0);
    writeAllUtf8Sync(fd, reconciled);
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
  return { relPath, decision };
}

function repoRoot(): string {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  } catch {
    return process.cwd();
  }
}

function renderPendingReport(pending: readonly PendingShard[]): string {
  if (pending.length === 0) {
    return "No unreconciled divergence shards. Nothing to reconcile.\n";
  }
  let report = `${pending.length} unreconciled divergence shard(s) — oldest first:\n\n`;
  for (const s of pending) {
    report += `  ${s.relPath}\n`;
    report += `    tick:  ${s.tick}\n`;
    report += `    topic: ${s.topic}\n`;
    report += `    loops: ${s.loopAAgent} vs ${s.loopBAgent}\n\n`;
  }
  report +=
    "Per docs/hygiene-history/divergences/README.md: read each shard, decide " +
    "(accept-loop-a | accept-loop-b | accept-both | escalate), fill the " +
    "## Reconciliation section in place, then resolve the thread.\n";
  return report;
}

export function pendingShardListJson(pending: readonly PendingShard[]): PendingShardListJson {
  return { schemaVersion: 1, pending };
}

export function renderPendingJsonReport(pending: readonly PendingShard[]): string {
  return `${JSON.stringify(pendingShardListJson(pending), null, 2)}\n`;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export interface MainOptions {
  readonly repoRoot?: () => string;
  readonly stdout?: Pick<typeof process.stdout, "write">;
  readonly stderr?: Pick<typeof process.stderr, "write">;
}

// Default with no args is the morning-reconciliation READER, not a CI gate:
// pending shards are a human to-do, so list mode exits 0. The explicit
// --reconcile action is the bounded write-back CLI for AC #4's "one action".
export function main(argv: readonly string[] = process.argv.slice(2), options: MainOptions = {}): number {
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const parsed = parseArgs(argv);
  if (parsed.kind === "error") {
    stderr.write(`error: ${parsed.message}\n\n${usage()}\n`);
    return 2;
  }
  if (parsed.command.kind === "help") {
    stdout.write(`${usage()}\n`);
    return 0;
  }

  try {
    const root = (options.repoRoot ?? repoRoot)();
    if (parsed.command.kind === "list") {
      const pending = scanDivergenceDir(root);
      stdout.write(parsed.command.format === "json" ? renderPendingJsonReport(pending) : renderPendingReport(pending));
      return 0;
    }
    const result = reconcileDivergenceShard(root, parsed.command.relPath, parsed.command.decision, parsed.command.note);
    stdout.write(`Reconciled ${result.relPath} with ${result.decision}.\n`);
    return 0;
  } catch (err) {
    stderr.write(`error: ${errorMessage(err)}\n`);
    return 1;
  }
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
