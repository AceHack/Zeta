#!/usr/bin/env bun
/**
 * classify-zetaid-nonresolution.ts — SEPARATE the failure classes that
 * `audit-task-zetaid-resolves.ts` currently reports under one message.
 *
 * THIS IS A CLASSIFIER, NOT A GATE. It changes no verdict, blocks no PR, and is
 * wired into no workflow. It exists because the audit says "no work-item file
 * carries this id" for at least four different defects with four different
 * remedies, and a remedy cannot be chosen from an undifferentiated count.
 *
 * The four classes
 * ----------------
 *   resolves-workitem   the gate's current accept set (`workitems/**`).
 *   resolves-backlog    MISLOCATED — a real, minted row filed under
 *                       `docs/backlog/` instead. Resolver-fixable.
 *   malformed           the string cannot have come out of `pack()`: some field
 *                       the canonical mint holds CONSTANT does not hold. No
 *                       resolver reaches this; the id names nothing anywhere.
 *   unminted            structurally indistinguishable from a genuine mint, and
 *                       no file carries it. `pack()` almost certainly produced
 *                       it; nothing ever wrote the file. This is the vacuity
 *                       class — and NO resolver widening can rescue it, which is
 *                       precisely why the classes had to be separated first.
 *
 * The orthogonal risk flag — and the reason this file is not just a resolver
 * ------------------------------------------------------------------------
 * `prefixAmbiguous` is reported INDEPENDENTLY of class, because a RESOLVING id
 * can still be the wrong one. Measured on this tree: a WorkItem ZetaId's first
 * 19 characters are a pure function of (timestamp, the constant mint fields) —
 * all 32 free bits live in the last 7 characters. The `docs/backlog/` corpus was
 * backfilled with DAY-GRANULAR timestamps, so 99.6% of its 1118 ids share their
 * first 19 characters with at least one sibling and the largest such cohort is
 * 98 ids. `workitems/`, minted at millisecond resolution, sits at 0.3%.
 *
 * Worked consequence, and the finding that decides the widening question:
 * `.github/workflows/context-cost-trend-cadence.yml` names
 * `081KT7YW00008QG0R002T1XNWT` in its comments, its commit subject, and — for
 * every commit between 2026-06-22 and 2026-08-13 — its `Task:` trailer. That id
 * RESOLVES: to `…-canonical-yaml-never-collapse-empty-collections…`, a row closed
 * 2026-06-04 about YAML. The row the workflow describes itself as serving is
 * `081KT7YW00008QG0R003JV9D4J-context-window-minimization…`. Same 19-character
 * prefix; different item. Widening the resolver to `docs/backlog/` would turn
 * that reference GREEN while it stays wrong.
 *
 * NOT counted here — a THIRD input-surface class, fixed in flight by PR #15607:
 * `audit-task-zetaid-resolves.ts` `extractTaskIds` falls back to scanning all
 * text for ZetaIds when no `Task:` line yielded one, and `Task: none` opens that
 * fallback — so every id CITED in prose is promoted to a DECLARED task. This file
 * is deliberately agnostic: it classifies whatever ids it is handed and never
 * decides which were declared. Callers must separate declaration from citation
 * BEFORE classifying, or every count is inflated by the promoted citations.
 *
 * Rule 0: TypeScript (no .sh) per `.claude/rules/rule-0-no-sh-files.md`.
 *
 * Usage:
 *   bun src/Core.TypeScript/hygiene/classify-zetaid-nonresolution.ts <id> [<id>...]
 *   bun src/Core.TypeScript/hygiene/classify-zetaid-nonresolution.ts --all-trailers
 *   bun src/Core.TypeScript/hygiene/classify-zetaid-nonresolution.ts --corpus
 *   ... add --json for machine output.
 *
 * Exit codes: 0 = classification produced · 2 = configuration error (empty index).
 * NEVER exit 1. A classifier that can fail a build is a gate wearing a disguise,
 * and this one is deliberately not that.
 */

import { readdirSync } from "node:fs";
import type { Dirent } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { parse, isCanonical } from "../zeta-id/encoding";
import { BIT_MASKS } from "../zeta-id/zeta-id.gen";

function repoRoot(): string {
  return resolve(process.env["REPO_ROOT"] ?? process.cwd());
}

/** Filename prefix form of a ZetaId-keyed row, in any of the trees below. */
const FILE_ID_RE = /^(081[0-9A-Z]{23})-/;

/**
 * Every field `new-workitem.ts` `mintWorkItem` holds CONSTANT, with the value it
 * writes. Read straight off that function — version 1, MetaCoherence chromosome,
 * WorkItem category, Standard authority (15), persona 0, Normal momentum (96),
 * location 0.
 *
 * `timestamp` is excluded (it varies by design) and `randomness` is excluded (it
 * IS the entropy). Everything else is fixed, which is what makes a structural
 * test possible at all: a canonical WorkItem mint has 32 free bits out of 128.
 */
export const MINT_SIGNATURE: ReadonlyMap<string, bigint> = new Map([
  ["version", 1n],
  ["chromosome", 0n],
  ["category", 8n],
  ["authority", 15n],
  ["persona", 0n],
  ["momentum", 96n],
  ["location", 0n],
]);

/**
 * Bits no layout writes, which must therefore pack as zero.
 *
 *  - bit 64 is the RESERVED slot (formerly Firefly, reclaimed NO-SHIFT
 *    2026-08-11). It is NOT in this set: ids minted before that date carry it
 *    SET, and 165 of the 671 committed `workitems/` ids do. It is an epoch
 *    marker, reported rather than judged.
 *  - bits 32..34 sit between `randomness` (0..31) and `location` (35..42). No
 *    field covers them and `pack` never writes them, so a nonzero value there is
 *    positive evidence the string did not come from `pack`.
 */
const ZERO_GAP = { offset: 32n, width: 3n } as const;

/** The number of leading characters a canonical mint determines from the clock alone. */
export const DETERMINED_PREFIX_CHARS = 19;

function field(v: bigint, offset: bigint, width: bigint): bigint {
  return (v >> offset) & ((1n << width) - 1n);
}

export interface Decoded {
  readonly timestampMs: number;
  readonly reservedBit64: boolean;
  readonly randomness: bigint;
  /** Every constant-field value actually present, for reporting. */
  readonly fields: ReadonlyMap<string, bigint>;
}

export function decodeWorkItemId(id: string): Decoded | null {
  let v: bigint;
  try {
    v = parse(id) as unknown as bigint;
  } catch {
    return null;
  }
  const fields = new Map<string, bigint>();
  for (const name of MINT_SIGNATURE.keys()) {
    const m = BIT_MASKS[name as keyof typeof BIT_MASKS];
    if (m === undefined) continue;
    fields.set(name, field(v, m.offset, m.width));
  }
  return {
    timestampMs: Number(field(v, BIT_MASKS.timestamp.offset, BIT_MASKS.timestamp.width)),
    reservedBit64: field(v, 64n, 1n) === 1n,
    randomness: field(v, BIT_MASKS.randomness.offset, BIT_MASKS.randomness.width),
    fields,
  };
}

/**
 * Structural reasons this string cannot be a canonical WorkItem mint.
 *
 * An EMPTY list is not proof the id was minted — that is the honest limit this
 * whole file is built around, and the labeled positive
 * `081M0X0JQGY087G0R000EBCPQ3` returns an empty list. It means only that no
 * structural test we have refutes it.
 */
export function structuralViolations(id: string): string[] {
  const out: string[] = [];
  if (!isCanonical(id)) {
    out.push("not the canonical 26-char Crockford form `format()` emits");
    return out;
  }
  const d = decodeWorkItemId(id);
  if (d === null) {
    out.push("does not parse as a 128-bit ZetaId");
    return out;
  }
  for (const [name, expected] of MINT_SIGNATURE) {
    const got = d.fields.get(name);
    if (got !== undefined && got !== expected) {
      out.push(`${name}=${String(got)} — the canonical mint always writes ${String(expected)}`);
    }
  }
  const v = parse(id) as unknown as bigint;
  const gap = field(v, ZERO_GAP.offset, ZERO_GAP.width);
  if (gap !== 0n) {
    out.push(`bits 32..34 = ${String(gap)} — no field covers them and \`pack\` never writes them`);
  }
  // A timestamp outside the repo's own lifetime is not a mint this tree produced.
  // Bounded generously on purpose: the point is to catch 1970 and 33000, not to
  // adjudicate a plausible date.
  const t = d.timestampMs;
  if (!(t > Date.UTC(2020, 0, 1) && t < Date.UTC(2100, 0, 1))) {
    out.push(`timestamp ${String(t)} ms is outside 2020..2100 — not a clock this tree ran under`);
  }
  return out;
}

export type IdClass = "resolves-workitem" | "resolves-backlog" | "malformed" | "unminted";

export interface IdIndex {
  /** id → repo-relative path, for `workitems/**`. The gate's current accept set. */
  readonly workitems: ReadonlyMap<string, string>;
  /** id → repo-relative path, for `docs/backlog/**`. The mislocated candidates. */
  readonly backlog: ReadonlyMap<string, string>;
}

export interface Classification {
  readonly id: string;
  readonly cls: IdClass;
  readonly path: string | null;
  readonly violations: readonly string[];
  readonly mintedAtIso: string | null;
  readonly reservedBit64: boolean;
  /**
   * Ids (other than this one) sharing the first `DETERMINED_PREFIX_CHARS`
   * characters. Non-empty means a misattribution is one glance away — reported
   * for RESOLVING ids too, which is the whole point of keeping it orthogonal.
   */
  readonly prefixCohort: readonly string[];
}

function walk(root: string, sub: string, out: Map<string, string>, depth = 0): void {
  if (depth > 8) return;
  let entries: Dirent[];
  try {
    entries = readdirSync(join(root, sub), { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (ent.isDirectory()) {
      // `events/` is a DIFFERENT id space (see audit-task-zetaid-resolves.ts).
      if (ent.name === "events") continue;
      walk(root, join(sub, ent.name), out, depth + 1);
      continue;
    }
    if (!ent.name.endsWith(".md")) continue;
    const m = FILE_ID_RE.exec(ent.name);
    if (m?.[1] !== undefined) out.set(m[1], join(sub, ent.name));
  }
}

export function buildIndex(root: string): IdIndex {
  const workitems = new Map<string, string>();
  const backlog = new Map<string, string>();
  walk(root, "workitems", workitems);
  walk(root, join("docs", "backlog"), backlog);
  return { workitems, backlog };
}

export function classify(id: string, index: IdIndex): Classification {
  const violations = structuralViolations(id);
  const d = decodeWorkItemId(id);
  const wi = index.workitems.get(id);
  const bl = index.backlog.get(id);

  // Resolution is checked BEFORE malformation on purpose: a file that exists is
  // a fact about this tree, and a structural opinion must never overrule it.
  // (If a committed row is malformed, the violations still ride along.)
  const cls: IdClass =
    wi !== undefined
      ? "resolves-workitem"
      : bl !== undefined
        ? "resolves-backlog"
        : violations.length > 0
          ? "malformed"
          : "unminted";

  const prefix = id.slice(0, DETERMINED_PREFIX_CHARS);
  const cohort: string[] = [];
  for (const known of [...index.workitems.keys(), ...index.backlog.keys()]) {
    if (known !== id && known.startsWith(prefix)) cohort.push(known);
  }
  cohort.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)); // ordinal, never localeCompare

  return {
    id,
    cls,
    path: wi ?? bl ?? null,
    violations,
    mintedAtIso:
      d !== null && d.timestampMs > 0 && d.timestampMs < 4e12 ? new Date(d.timestampMs).toISOString() : null,
    reservedBit64: d?.reservedBit64 ?? false,
    prefixCohort: cohort,
  };
}

/** A `Task:` line and nothing else. No fallback — see `declaredTaskIds`. */
const STRICT_TASK_LINE_RE = /^Task:[ \t]*(\S+)[ \t]*$/gm;

/**
 * Ids a text DECLARES as its task — strictly, from `Task:` lines only.
 *
 * The distinction this exists to make: **citing an id is not declaring it.**
 * `.claude/rules/workitems-mint-with-zetaid.md` already draws exactly this line
 * for the legacy scheme ("naming an existing legacy id in prose is not
 * minting"); this is the same line for the ZetaId scheme.
 *
 * `audit-task-zetaid-resolves.ts` `extractTaskIds` cannot make it: it falls back
 * to scanning all text when no `Task:` line yielded an id, and `Task: none` — the
 * value essentially every autonomous PR body carries — is not a ZetaId, so the
 * fallback opens and the whole body is read as a list of declarations. That is a
 * real bug being fixed in flight by PR #15607, and this function is NOT a second
 * fix for it: nothing here is wired into any gate. It exists so that a
 * MEASUREMENT of the non-resolution population can be taken over declarations
 * rather than over citations, which is a different job from gating a PR.
 *
 * Deliberately returns `[]` for a bare list of ids with no `Task:` prefix. That
 * is the case the audit's fallback was built for, and conflating "supports the
 * CLI's bare-list input" with "decides what a body declares" is how the two got
 * fused in the first place.
 */
export function declaredTaskIds(text: string): string[] {
  const out = new Set<string>();
  STRICT_TASK_LINE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = STRICT_TASK_LINE_RE.exec(text)) !== null) {
    const v = m[1];
    if (v !== undefined && /^081[0-9A-Z]{23}$/.test(v)) out.add(v);
  }
  return [...out].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Every `Task:` trailer value on the current branch's first-parent history. */
export function taskTrailersOnMain(root: string): string[] {
  const out = new Set<string>();
  let raw = "";
  try {
    raw = execFileSync("git", ["log", "--format=%(trailers:key=Task,valueonly)"], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return [];
  }
  for (const line of raw.split("\n")) {
    const v = line.trim();
    if (/^081[0-9A-Z]{23}$/.test(v)) out.add(v);
  }
  return [...out].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function render(cs: readonly Classification[], index: IdIndex): string {
  const tally = new Map<IdClass, number>();
  for (const c of cs) tally.set(c.cls, (tally.get(c.cls) ?? 0) + 1);
  const lines = [
    `classify-zetaid-nonresolution: ${cs.length} id(s) against ` +
      `${index.workitems.size} workitems/ + ${index.backlog.size} docs/backlog/ rows.`,
    "",
    "CLASSES: " +
      [...tally.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k}=${String(v)}`)
        .join("  "),
    "",
  ];
  for (const c of cs) {
    const amb = c.prefixCohort.length > 0 ? ` prefix-cohort=${String(c.prefixCohort.length)}` : "";
    lines.push(`${c.id}  ${c.cls}${amb}  minted=${c.mintedAtIso ?? "?"}  ${c.path ?? "(no file)"}`);
    for (const v of c.violations) lines.push(`    ! ${v}`);
    if (c.cls === "unminted") {
      lines.push("    ! NO structural test refutes this id and no file carries it.");
      lines.push("    ! Widening the resolver does NOT rescue it — see the mistake-resolution protocol.");
    }
    for (const k of c.prefixCohort.slice(0, 4)) {
      lines.push(`    ~ shares ${String(DETERMINED_PREFIX_CHARS)} chars with ${k} (${index.workitems.get(k) ?? index.backlog.get(k) ?? "?"})`);
    }
  }
  return lines.join("\n");
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const json = argv.includes("--json");
  const root = repoRoot();
  const index = buildIndex(root);

  if (index.workitems.size === 0 && index.backlog.size === 0) {
    console.error(
      "classify-zetaid-nonresolution: configuration error — indexed ZERO rows. " +
        "That is not a clean tree, it is a scan that did not run.",
    );
    process.exit(2);
  }

  let ids: string[];
  if (argv.includes("--all-trailers")) ids = taskTrailersOnMain(root);
  else if (argv.includes("--corpus")) ids = [...index.workitems.keys(), ...index.backlog.keys()];
  else ids = argv.filter((a) => !a.startsWith("--"));

  const cs = ids.map((id) => classify(id, index));
  if (json) console.log(JSON.stringify(cs, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v), 2));
  else console.log(render(cs, index));
  // Deliberately always 0 — see the header. A classifier that can redden a gate
  // is a gate, and this file's entire argument is that the gate must not move yet.
  process.exit(0);
}
