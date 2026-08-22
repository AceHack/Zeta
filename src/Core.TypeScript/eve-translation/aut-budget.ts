#!/usr/bin/env bun
// aut-budget.ts — how many bits of the Eve translation does the agreed structure NOT determine?
//
// What this computes
// ------------------
// Two parties meet on an algebraic structure and assign labels afterwards (Eve
// protocol; Aaron 2026-05-12 "you agree on the structure ... and then you assign
// labels later", 2026-08-14 "meet in the middle on algebraic structure then assign
// labels and translations after the structure first").
//
// The governing theorem (proved in the 2026-08-14 icons-before-symbols ferry): if
// `Iso(A,B)` is non-empty it is a TORSOR under `Aut(A)`, so `|Iso(A,B)| = |Aut(A)|`.
// `|Aut| = 1` means exactly one translation exists -- it is FORCED, either party can
// compute it alone, and nobody chose it. `|Aut| = n > 1` means n translations exist
// and the structure prefers none of them, so somebody must supply `log2(n)` bits.
// That is the IMPOSITION BUDGET, and this script is the thing that reports it as a
// number instead of a stance.
//
// Corollary, and the gate below: a claim survives the hand-off if and only if it is
// `Aut`-invariant. A non-invariant claim is not wrong -- it is DECIDED BY WHOEVER
// SPENT THE BIT, and it must say so.
//
// What is actually computed here
// ------------------------------
// `Aut` of the full structure is not directly computable. What IS computable is the
// subgroup of `Sym(tags)` that preserves a declared family of invariants. Every
// genuine automorphism preserves every invariant, so
//
//     Aut(S)  is a subgroup of  Stab(invariants)
//
// and this script reports an UPPER BOUND on |Aut|. That asymmetry is the useful one:
// an upper bound of 1 is EXACT (the identity is always an automorphism, so
// 1 <= |Aut| <= 1), which means "the translation is forced" is certifiable by upper
// bound alone. A large bound proves nothing; a bound of 1 proves rigidity.
//
// Each rung must name an operation the RECEIVER can perform unaided -- that is what
// makes the structure an icon in Peirce's sense (checkable against the thing) rather
// than a convention handed over. `eve-invariant-table.json` carries the rungs, the
// performability note, and the evidence; this file is only the arithmetic and the gate.
//
// Anchors (checked, per .claude/rules/anchor-to-human-prior-art.md)
//   - Joseph Goguen, "An Introduction to Algebraic Semiotics" (LNAI 1562, 1999,
//     pp. 242-291) -- sign systems as algebraic theories; structure over content.
//     The formal home of structure-first / labels-after.
//   - C. S. Peirce, CP 2.247-2.249 -- icon / index / symbol; only the symbol needs a
//     prior convention.
//   - David Lewis, "Convention" (1969) -- equilibrium selection needs salience; the
//     residual bits are exactly the salience Lewis says cannot come for free.
//   - Torsor fact: elementary, proof sketch in the ferry doc.
//
// Register: the torsor fact and every group order below are THEOREMS (brute-forced,
// cross-checked against a closed form). The reading of `log2|Aut|` as *coercion*
// remains a TOY per .claude/rules/toy-is-free-metered-must-be-earned.md -- this
// script attaches a concrete number to a real structure, which makes the toy
// falsifiable, and does NOT promote it. See the spec's register table.
//
// Rule 0: TypeScript (no .sh) per .claude/rules/rule-0-no-sh-files.md.
//
// Usage:
//   bun src/Core.TypeScript/eve-translation/aut-budget.ts
//   bun src/Core.TypeScript/eve-translation/aut-budget.ts --json
//   bun src/Core.TypeScript/eve-translation/aut-budget.ts --table <path>
//
// Exit codes:
//   0   the tag set matches the shipped source, every rung's evidence is present,
//       every claim is invariant where it says it is, and the uncontested budget is
//       within the declared ceiling
//   1   a gate failed (drift, missing evidence, an over-claimed invariance, or a
//       budget above the ceiling)
//   2   configuration error (table or source unreadable / malformed)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const DEFAULT_TABLE = "src/Core.TypeScript/eve-translation/eve-invariant-table.json";

function repoRoot(): string {
  return resolve(process.env["REPO_ROOT"] ?? process.cwd());
}

// ---------------------------------------------------------------------------
// Table shape
// ---------------------------------------------------------------------------

export interface Evidence {
  readonly file: string;
  readonly contains: string;
}

export interface UnaryRung {
  readonly level: number;
  readonly id: string;
  readonly kind: "unary";
  readonly contested?: boolean;
  readonly evidence: readonly Evidence[];
  readonly profile: Readonly<Record<string, string>>;
}

export interface RelationRung {
  readonly level: number;
  readonly id: string;
  readonly kind: "relation";
  readonly contested?: boolean;
  readonly evidence: readonly Evidence[];
  readonly pairs: readonly (readonly [string, string])[];
}

export type Rung = UnaryRung | RelationRung;

export interface Claim {
  readonly id: string;
  readonly invariantAt: number;
  readonly assignment: Readonly<Record<string, string>>;
}

export interface InvariantTable {
  readonly structure: string;
  readonly source: string;
  readonly tags: readonly string[];
  readonly uncontestedCeilingBits: number;
  readonly ladder: readonly Rung[];
  readonly claims: readonly Claim[];
}

// ---------------------------------------------------------------------------
// Permutations
// ---------------------------------------------------------------------------

/** A permutation as an index array: `p[i]` is the image of tag `i`. */
export type Perm = readonly number[];

/** Every permutation of `n` points. `n = 8` gives 40320 -- brute force is free here. */
export function allPerms(n: number): Perm[] {
  const out: Perm[] = [];
  const cur: number[] = [];
  const used = new Array<boolean>(n).fill(false);
  const walk = (): void => {
    if (cur.length === n) {
      out.push(cur.slice());
      return;
    }
    for (let i = 0; i < n; i++) {
      if (used[i] === true) continue;
      used[i] = true;
      cur.push(i);
      walk();
      cur.pop();
      used[i] = false;
    }
  };
  walk();
  return out;
}

/**
 * Does `p` preserve `rung`?
 *
 * Unary: the profile must be constant along the permutation --
 *   `profile[p(t)] === profile[t]` for every tag `t`.
 * Relation: the pair set must map into itself --
 *   `(a,b) in R` implies `(p(a), p(b)) in R`. (On a finite set an injective
 *   self-map of `R` is onto it, so preservation in one direction suffices.)
 */
export function preserves(p: Perm, rung: Rung, tags: readonly string[]): boolean {
  if (rung.kind === "unary") {
    for (let i = 0; i < tags.length; i++) {
      const from = rung.profile[tags[i] as string];
      const to = rung.profile[tags[p[i] as number] as string];
      if (from === undefined || to === undefined) return false;
      if (from !== to) return false;
    }
    return true;
  }
  const index = new Map(tags.map((t, i) => [t, i] as const));
  const key = (a: number, b: number): string => `${a}\u0000${b}`;
  const inR = new Set(rung.pairs.map(([a, b]) => key(index.get(a) as number, index.get(b) as number)));
  for (const [a, b] of rung.pairs) {
    const ia = index.get(a);
    const ib = index.get(b);
    if (ia === undefined || ib === undefined) return false;
    if (!inR.has(key(p[ia] as number, p[ib] as number))) return false;
  }
  return true;
}

/**
 * The subgroup of `Sym(tags)` preserving every rung at or below `level`.
 *
 * Rungs marked `contested` are included only when `includeContested` is set --
 * the whole point of the contested flag is that the budget gets reported both
 * with and without them rather than rounded down to the flattering number.
 */
export function stabilizer(
  tags: readonly string[],
  ladder: readonly Rung[],
  level: number,
  includeContested: boolean,
): Perm[] {
  const active = ladder.filter((r) => r.level <= level && (includeContested || r.contested !== true));
  return allPerms(tags.length).filter((p) => active.every((r) => preserves(p, r, tags)));
}

/** `log2` of a group order, in bits. Order 1 gives exactly 0. */
export function bits(order: number): number {
  return Math.log2(order);
}

/**
 * Is `claim` constant on the orbits of `group`? That is the `Aut`-invariance test:
 * two translations differ by an automorphism, so a claim is independent of WHICH
 * translation was chosen exactly when no automorphism moves its value.
 */
export function isInvariant(claim: Claim, group: readonly Perm[], tags: readonly string[]): boolean {
  for (const p of group) {
    for (let i = 0; i < tags.length; i++) {
      const from = claim.assignment[tags[i] as string];
      const to = claim.assignment[tags[p[i] as number] as string];
      if (from === undefined || to === undefined) return false;
      if (from !== to) return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Scan floor: the tag set must still be the one the shipped source declares
// ---------------------------------------------------------------------------

/**
 * The `DynamicValueType` cases, in declaration order, read out of the F# source.
 *
 * This is the scan floor and it is the reason this check is not blind: the shipped
 * doc-comment says format extras ("CBOR semantic tags, BSON dates / ObjectId,
 * decimal128, msgpack ext") are OPEN FOR EXTENSION. Adding a variant whose invariant
 * profile duplicates an existing one silently enlarges `Aut` and un-forces the
 * translation. This parser is what makes that show up as a red build instead of as
 * nothing at all.
 */
export function parseTags(source: string): string[] {
  const start = source.indexOf("type DynamicValueType =");
  if (start < 0) return [];
  const rest = source.slice(start);
  const out: string[] = [];
  for (const line of rest.split("\n").slice(1)) {
    const m = /^\s*\|\s*([A-Z][A-Za-z0-9_]*)\s*$/.exec(line);
    if (m !== null) {
      out.push(m[1] as string);
      continue;
    }
    // The DU ends at the first line that is neither a bare case nor blank.
    if (line.trim() === "") continue;
    break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export interface RungReport {
  readonly level: number;
  readonly id: string;
  readonly contested: boolean;
  readonly order: number;
  readonly bits: number;
}

function main(): number {
  const argv = process.argv.slice(2);
  const asJson = argv.includes("--json");
  const tIdx = argv.indexOf("--table");
  const tablePath = tIdx >= 0 ? (argv[tIdx + 1] as string) : DEFAULT_TABLE;
  const root = repoRoot();

  let table: InvariantTable;
  try {
    table = JSON.parse(readFileSync(resolve(root, tablePath), "utf8")) as InvariantTable;
  } catch (e) {
    process.stderr.write(`aut-budget: cannot read invariant table ${tablePath}: ${String(e)}\n`);
    return 2;
  }

  let source: string;
  try {
    source = readFileSync(resolve(root, table.source), "utf8");
  } catch (e) {
    process.stderr.write(`aut-budget: cannot read structure source ${table.source}: ${String(e)}\n`);
    return 2;
  }

  const failures: string[] = [];

  // Gate 1 -- drift. The negotiated tag set must be the shipped one.
  const shipped = parseTags(source);
  const declared = [...table.tags];
  if (shipped.length === 0) {
    failures.push(
      `could not parse any DynamicValueType case out of ${table.source} -- the DU shape changed and this check is now blind`,
    );
  } else if (shipped.join(",") !== declared.join(",")) {
    failures.push(
      `tag-set drift: shipped [${shipped.join(", ")}] but the invariant table declares [${declared.join(", ")}]. ` +
        `A new tag needs a rung that distinguishes it, or it enlarges Aut and un-forces the translation.`,
    );
  }

  // Gate 2 -- checked anchors. Every rung's evidence must exist in the tree.
  for (const rung of table.ladder) {
    for (const ev of rung.evidence) {
      let text: string;
      try {
        text = readFileSync(resolve(root, ev.file), "utf8");
      } catch {
        failures.push(`rung ${rung.id}: evidence file ${ev.file} is unreadable`);
        continue;
      }
      if (!text.includes(ev.contains)) {
        failures.push(
          `rung ${rung.id}: evidence not found in ${ev.file} -- ${JSON.stringify(ev.contains)}. ` +
            `An invariant whose evidence has moved is an unchecked anchor.`,
        );
      }
    }
  }

  // The ladder itself.
  const tags = declared;
  const levels = [0, ...table.ladder.map((r) => r.level)].sort((a, b) => a - b);
  const strict: RungReport[] = [];
  const role: RungReport[] = [];
  for (const level of levels) {
    const at = table.ladder.find((r) => r.level === level);
    const s = stabilizer(tags, table.ladder, level, false);
    const r = stabilizer(tags, table.ladder, level, true);
    strict.push({
      level,
      id: at?.id ?? "bare-tag-set",
      contested: at?.contested === true,
      order: s.length,
      bits: bits(s.length),
    });
    role.push({
      level,
      id: at?.id ?? "bare-tag-set",
      contested: at?.contested === true,
      order: r.length,
      bits: bits(r.length),
    });
  }

  const topLevel = Math.max(...levels);
  const strictGroup = stabilizer(tags, table.ladder, topLevel, false);
  const roleGroup = stabilizer(tags, table.ladder, topLevel, true);
  const strictBits = bits(strictGroup.length);
  const roleBits = bits(roleGroup.length);

  // Cross-check: a ladder of purely unary rungs has closed-form order = product of
  // block-size factorials. Where that applies it must agree with the brute force.
  // Double entry -- a bug in `preserves` that a single method would hide.
  const unaryOnly = table.ladder.filter((r) => r.level <= topLevel && r.kind === "unary");
  if (unaryOnly.length === table.ladder.filter((r) => r.level <= topLevel).length) {
    const blocks = new Map<string, number>();
    for (const t of tags) {
      const sig = unaryOnly.map((r) => (r as UnaryRung).profile[t]).join("|");
      blocks.set(sig, (blocks.get(sig) ?? 0) + 1);
    }
    let closed = 1;
    for (const n of blocks.values()) for (let i = 2; i <= n; i++) closed *= i;
    if (closed !== roleGroup.length) {
      failures.push(`internal: brute-force order ${roleGroup.length} disagrees with the closed form ${closed}`);
    }
  }

  // Gate 3 -- claims must be invariant where they say they are.
  const claimRows: { id: string; invariantAt: number; ok: boolean }[] = [];
  for (const claim of table.claims) {
    const g = stabilizer(tags, table.ladder, claim.invariantAt, true);
    const ok = isInvariant(claim, g, tags);
    claimRows.push({ id: claim.id, invariantAt: claim.invariantAt, ok });
    if (!ok) {
      failures.push(
        `claim ${claim.id} declares Aut-invariance at level ${claim.invariantAt}, but the residual ` +
          `group there has order ${g.length} and moves it. The claim is decided by whoever spends ` +
          `those bits -- raise the level, add a rung, or record it in the ledger.`,
      );
    }
  }

  // Gate 4 -- the uncontested budget must be within its declared ceiling.
  if (strictBits > table.uncontestedCeilingBits + 1e-9) {
    failures.push(
      `uncontested imposition budget is ${strictBits.toFixed(4)} bits, above the declared ceiling ` +
        `of ${table.uncontestedCeilingBits} bits`,
    );
  }

  if (asJson) {
    process.stdout.write(
      `${JSON.stringify(
        { structure: table.structure, tags, strict, role, strictBits, roleBits, claims: claimRows, failures },
        null,
        2,
      )}\n`,
    );
  } else {
    process.stdout.write(`Eve translation layer -- imposition budget\n`);
    process.stdout.write(`structure: ${table.structure}\n`);
    process.stdout.write(`tags (${tags.length}, read from ${table.source}): ${tags.join(", ")}\n\n`);
    process.stdout.write(`  level  rung                        |Aut| <=   bits\n`);
    for (const r of strict) {
      const mark = r.contested ? " (contested -- excluded)" : "";
      process.stdout.write(
        `  ${String(r.level).padStart(5)}  ${r.id.padEnd(26)} ${String(r.order).padStart(8)}   ${r.bits.toFixed(4)}${mark}\n`,
      );
    }
    process.stdout.write(`\n  strict reading (contested rungs excluded): ${strictBits.toFixed(4)} bits\n`);
    process.stdout.write(`  role reading   (contested rungs included): ${roleBits.toFixed(4)} bits\n\n`);
    for (const c of claimRows) {
      process.stdout.write(
        `  ${c.ok ? "ok  " : "FAIL"} claim ${c.id} (declared invariant at level ${c.invariantAt})\n`,
      );
    }
    process.stdout.write("\n");
  }

  if (failures.length > 0) {
    for (const f of failures) process.stderr.write(`aut-budget: ${f}\n`);
    return 1;
  }
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
