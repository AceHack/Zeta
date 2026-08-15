#!/usr/bin/env bun
// measure.ts — the `measure` verb: commit a bug-fix's ΔU to the `db/uncertainty/` ledger.
//
// WHY THIS EXISTS. `.claude/rules/every-bug-has-economic-value.md` is always-loaded and says a
// bug-fix "commits the measurement and the uncertainty reduction (the finalizer's ΔU) to the
// `db/uncertainty/` ledger". Audited 2026-08-15: NO code in any language referenced
// `db/uncertainty/` or `db/sims/` — no writer, no reader. `mea` existed only as an unwired pure
// interface stub in `clis/Verbs.fs` (`IMeasurement = interface end`), and the ledger's single
// entry was hand-authored. This is the smallest thing that makes the rule's sentence true, and
// that can be falsified when it is not.
//
// THE REGISTER IS ORDINAL, NOT CARDINAL. The ledger records a ΔU *sign* plus a *witness*, never
// an invented number. There is no metering discipline in the repo that could produce a cardinal
// price for a bug-fix, so a cardinal price would be `toy` asserted as `metered`
// (.claude/rules/toy-is-free-metered-must-be-earned.md) — and this rule is about PRICING, so a
// fabricated price corrupts the one thing the ledger is for. `sign` + `witness` is what we can
// actually stand behind today; a cardinal ΔU must be EARNED by a metering discipline later.
//
// WHAT IT REFUSES (each refusal is the falsifier — a measure that cannot be refused is not a
// measure, it is a text editor):
//   • a work-item key that does not resolve to a file in the repo  → unsubstantiated key
//   • an empty witness                                             → an unwitnessed ΔU is unmetered
//   • an empty rationale                                           → a price with no reason is a guess
//   • a non-canonical ZetaId                                       → not a key
//
// IDEMPOTENT BY KEY (dv2-data-split-discipline-activated.md §6): the key is the work-item ZetaId.
// Measuring the same fix twice is an UPSERT, not double-pay — identical content is a byte-identical
// no-op. An existing entry is matched when its leading id-token is a PREFIX of the given ZetaId,
// so the legacy short-form entry (`081KWG9JQ9H-...` for `081KWG9JQ9H08QG0R0024EMETG`) dedups
// correctly instead of gaining a twin.
//
// TEXT ONLY (no-binary-in-proof-lineage.md): entries are markdown, diffable, mergeable.
//
// Usage:
//   bun src/Core.TypeScript/ledger/measure.ts \
//     --work-item 081KZZZH24H087G0R002TXQA15 \
//     --title "derive block address from seq" \
//     --measure "what moved, concretely" \
//     --sign reduced|increased|unchanged \
//     --because "why that is a ΔU of that sign" \
//     --witness "the test/proof that fails without the fix" \
//     [--lineage "how it was found"] [--repo-root .] [--ledger-dir db/uncertainty] [--dry-run]
//
// Exit codes: 0 ok (created / upserted / unchanged) · 2 refused or usage error.

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** The direction of the uncertainty change. Ordinal on purpose — see the header. */
export type DeltaUSign = "reduced" | "increased" | "unchanged";

const SIGN_GLYPH: Readonly<Record<DeltaUSign, string>> = {
  reduced: "ΔU > 0",
  increased: "ΔU < 0",
  unchanged: "ΔU ≈ 0",
};

export const DELTA_U_SIGNS: readonly DeltaUSign[] = ["reduced", "increased", "unchanged"];

/** A ΔU measurement awaiting commit to the ledger. */
export interface MeasureSpec {
  /** The dedup key: a canonical 26-char Crockford base32 ZetaId naming the work-item fixed. */
  readonly workItem: string;
  readonly title: string;
  /** What moved — the concrete before/after. */
  readonly measure: string;
  readonly sign: DeltaUSign;
  /** Why that is a ΔU of that sign. */
  readonly because: string;
  /** What makes it falsifiable: the test/proof that fails without the fix. */
  readonly witness: string;
  /** Optional: how it was found. */
  readonly lineage?: string | undefined;
}

export type RefusalCode =
  | "malformed-key"
  | "unknown-work-item"
  | "unwitnessed"
  | "unreasoned"
  | "untitled"
  | "unmeasured";

export type Validation =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: RefusalCode; readonly reason: string };

/** Canonical ZetaId: 26 chars, Crockford base32 (no I, L, O, U). */
const ZETAID_RE = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{26}$/;

/** Shortest id-token we will treat as a dedup-capable prefix of a ZetaId. */
export const MIN_KEY_PREFIX = 8;

/** Resolves a work-item ZetaId to its file, or null. Injected so tests need no repo. */
export type WorkItemResolver = (zetaid: string) => string | null;

const WORK_ITEM_ROOTS = ["workitems", "docs/backlog"] as const;

function walkFiles(dir: string, out: string[], depth = 0): void {
  if (depth > 6 || !existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    let s;
    try {
      s = statSync(p);
    } catch {
      continue;
    }
    if (s.isDirectory()) walkFiles(p, out, depth + 1);
    else out.push(name);
  }
}

/**
 * The real resolver: a work-item ZetaId is substantiated iff some file under `workitems/` or
 * `docs/backlog/` is named for it. This is the check that makes an invented key impossible.
 */
export function repoWorkItemResolver(repoRoot: string): WorkItemResolver {
  const names: string[] = [];
  for (const root of WORK_ITEM_ROOTS) walkFiles(join(repoRoot, root), names);
  return (zetaid: string) => names.find((n) => n.startsWith(zetaid)) ?? null;
}

/** Validate a measurement. Every `ok: false` is a refusal the caller must surface. */
export function validateMeasure(spec: MeasureSpec, resolve: WorkItemResolver): Validation {
  if (!ZETAID_RE.test(spec.workItem))
    return {
      ok: false,
      code: "malformed-key",
      reason: `'${spec.workItem}' is not a canonical 26-char Crockford base32 ZetaId, so it is not a key`,
    };
  if (resolve(spec.workItem) === null)
    return {
      ok: false,
      code: "unknown-work-item",
      reason: `no work-item file named for ${spec.workItem} under workitems/ or docs/backlog/ — an unsubstantiated key would price a fix nobody can find`,
    };
  if (spec.title.trim().length === 0)
    return { ok: false, code: "untitled", reason: "an entry with no title is not readable in a diff" };
  if (spec.measure.trim().length === 0)
    return { ok: false, code: "unmeasured", reason: "a `measure` with nothing measured is a claim, not a measurement" };
  if (spec.because.trim().length === 0)
    return { ok: false, code: "unreasoned", reason: "a ΔU sign with no rationale is a guess wearing a price tag" };
  if (spec.witness.trim().length === 0)
    return {
      ok: false,
      code: "unwitnessed",
      reason:
        "an unwitnessed ΔU is `unmetered` asserted as `metered` — name the test or proof that fails without the fix",
    };
  return { ok: true };
}

/** Filename slug: lowercase, ordinal, hyphenated, bounded. */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/** Render the entry. Schema matches the ledger's pre-existing hand-authored entry. */
export function renderEntry(spec: MeasureSpec): string {
  const lines = [
    `# ΔU: ${spec.workItem} — ${spec.title.trim()}`,
    "",
    `- **measure:** ${spec.measure.trim()}`,
    `- **${SIGN_GLYPH[spec.sign]} because:** ${spec.because.trim()}`,
    `- **witnessed by:** ${spec.witness.trim()}`,
  ];
  if (spec.lineage && spec.lineage.trim().length > 0) lines.push(`- **lineage:** ${spec.lineage.trim()}`);
  return lines.join("\n") + "\n";
}

/**
 * Find the existing entry for this key, if any. An entry matches when its leading id-token is a
 * prefix of the given ZetaId — so the legacy short-form entries dedup instead of duplicating.
 */
export function findExistingEntry(ledgerDir: string, workItem: string): string | null {
  if (!existsSync(ledgerDir)) return null;
  for (const name of readdirSync(ledgerDir)) {
    if (!name.endsWith(".md") || name === "README.md") continue;
    const token = name.slice(0, name.indexOf("-") === -1 ? name.length - 3 : name.indexOf("-"));
    if (token.length >= MIN_KEY_PREFIX && workItem.startsWith(token)) return name;
  }
  return null;
}

export type CommitResult =
  | { readonly kind: "created" | "upserted" | "unchanged"; readonly path: string }
  | { readonly kind: "refused"; readonly code: RefusalCode; readonly reason: string };

/**
 * Commit a measurement to the ledger. Idempotent by work-item key: apply-N-times == apply-once
 * (dv2 §6) — the second identical measure is `unchanged` and writes nothing.
 */
export function commitMeasure(
  ledgerDir: string,
  spec: MeasureSpec,
  resolve: WorkItemResolver,
  write = true,
): CommitResult {
  const v = validateMeasure(spec, resolve);
  if (!v.ok) return { kind: "refused", code: v.code, reason: v.reason };

  const existing = findExistingEntry(ledgerDir, spec.workItem);
  const filename = existing ?? `${spec.workItem}-${slugify(spec.title)}.md`;
  const path = join(ledgerDir, filename);
  const content = renderEntry(spec);

  if (existing !== null && readFileSync(path, "utf8") === content) return { kind: "unchanged", path };
  if (!write) return { kind: existing === null ? "created" : "upserted", path };

  mkdirSync(ledgerDir, { recursive: true });
  writeFileSync(path, content, "utf8");
  return { kind: existing === null ? "created" : "upserted", path };
}

// ── CLI ───────────────────────────────────────────────────────────────────────────────────────

function parseArgs(argv: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a?.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      out[key] = next;
      i++;
    } else out[key] = "true";
  }
  return out;
}

export function main(argv: readonly string[]): number {
  const args = parseArgs(argv);
  const repoRoot = args["repo-root"] ?? ".";
  const ledgerDir = args["ledger-dir"] ?? join(repoRoot, "db", "uncertainty");
  const sign = (args["sign"] ?? "reduced") as DeltaUSign;

  if (!DELTA_U_SIGNS.includes(sign)) {
    process.stderr.write(`measure: --sign must be one of ${DELTA_U_SIGNS.join(" | ")}, got '${sign}'\n`);
    return 2;
  }

  const spec: MeasureSpec = {
    workItem: args["work-item"] ?? "",
    title: args["title"] ?? "",
    measure: args["measure"] ?? "",
    sign,
    because: args["because"] ?? "",
    witness: args["witness"] ?? "",
    lineage: args["lineage"],
  };

  const result = commitMeasure(ledgerDir, spec, repoWorkItemResolver(repoRoot), args["dry-run"] === undefined);
  if (result.kind === "refused") {
    process.stderr.write(`measure: REFUSED (${result.code}) — ${result.reason}\n`);
    return 2;
  }
  process.stdout.write(`measure: ${result.kind} ${result.path}\n`);
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
