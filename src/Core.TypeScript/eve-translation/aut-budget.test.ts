import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  allPerms,
  bits,
  DEFAULT_TABLE,
  isInvariant,
  parseTags,
  preserves,
  stabilizer,
  type Claim,
  type InvariantTable,
  type Rung,
} from "./aut-budget";

const root = resolve(process.env["REPO_ROOT"] ?? process.cwd());
const table = JSON.parse(readFileSync(resolve(root, DEFAULT_TABLE), "utf8")) as InvariantTable;
const TAGS = [...table.tags];
const TOP = Math.max(...table.ladder.map((r) => r.level));

describe("allPerms — the search space is Sym(n), brute-forced", () => {
  test("|Sym(8)| = 40320, and every permutation is distinct", () => {
    const ps = allPerms(8);
    expect(ps.length).toBe(40320);
    expect(new Set(ps.map((p) => p.join(","))).size).toBe(40320);
  });
});

describe("parseTags — the scan floor against the shipped F# DU", () => {
  test("reads the eight DynamicValueType cases in declaration order", () => {
    const src = readFileSync(resolve(root, table.source), "utf8");
    expect(parseTags(src)).toEqual(TAGS);
  });

  test("a NINTH tag is seen — this is the predicted extension, not a hypothetical", () => {
    // The shipped doc-comment invites exactly this: "CBOR semantic tags, BSON dates /
    // ObjectId, decimal128, msgpack ext ... open for extension".
    const src = readFileSync(resolve(root, table.source), "utf8").replace(
      "type DynamicValueType =\n    | Null",
      "type DynamicValueType =\n    | Decimal\n    | Null",
    );
    expect(parseTags(src)).toEqual(["Decimal", ...TAGS]);
  });

  test("returns empty when the DU is gone, so the caller can refuse to run blind", () => {
    expect(parseTags("namespace Zeta.Core\n\nlet x = 1\n")).toEqual([]);
  });

  test("stops at the end of the DU and does not swallow the next type", () => {
    const src = [
      "type DynamicValueType =",
      "    | Null",
      "    | Bool",
      "",
      "[<RequireQualifiedAccess>]",
      "type Other =",
      "    | Nope",
    ].join("\n");
    expect(parseTags(src)).toEqual(["Null", "Bool"]);
  });
});

describe("the ladder — every order is brute-forced, and matches the hand derivation", () => {
  // Hand-derived in the spec; recomputed here so a change to `preserves` cannot
  // silently move the budget.
  const expectedStrict: Record<number, number> = { 0: 40320, 1: 720, 2: 24, 3: 6, 4: 2, 5: 2 };
  const expectedRole: Record<number, number> = { 0: 40320, 1: 720, 2: 24, 3: 6, 4: 2, 5: 1 };

  for (const level of [0, 1, 2, 3, 4, 5]) {
    test(`level ${level}: |Aut| = ${expectedStrict[level]} strict / ${expectedRole[level]} role`, () => {
      expect(stabilizer(TAGS, table.ladder, level, false).length).toBe(expectedStrict[level] as number);
      expect(stabilizer(TAGS, table.ladder, level, true).length).toBe(expectedRole[level] as number);
    });
  }

  test("the ladder is monotone — a rung can only shrink the group, never grow it", () => {
    let prev = Number.POSITIVE_INFINITY;
    for (const level of [0, 1, 2, 3, 4, 5]) {
      const n = stabilizer(TAGS, table.ladder, level, true).length;
      expect(n).toBeLessThanOrEqual(prev);
      prev = n;
    }
  });

  test("the identity is always present — so an upper bound of 1 is EXACT", () => {
    const g = stabilizer(TAGS, table.ladder, TOP, true);
    expect(g.length).toBe(1);
    expect(g[0]).toEqual(TAGS.map((_, i) => i));
  });

  test("the strict reading keeps exactly one bit, and it is the Int/Bytes transposition", () => {
    const g = stabilizer(TAGS, table.ladder, TOP, false);
    expect(bits(g.length)).toBe(1);
    const moved = g
      .filter((p) => p.some((to, from) => to !== from))
      .map((p) => p.map((to, from) => (to === from ? null : [TAGS[from], TAGS[to]])).filter((x) => x !== null));
    expect(moved).toEqual([
      [
        ["Int", "Bytes"],
        ["Bytes", "Int"],
      ],
    ]);
  });
});

describe("preserves — the two invariant kinds", () => {
  const unary: Rung = {
    level: 1,
    id: "t",
    kind: "unary",
    evidence: [],
    profile: { A: "x", B: "x", C: "y" },
  };
  const tags3 = ["A", "B", "C"];

  test("a unary profile permits swaps inside a colour class and forbids swaps across", () => {
    expect(preserves([1, 0, 2], unary, tags3)).toBe(true); // A<->B, same colour
    expect(preserves([2, 1, 0], unary, tags3)).toBe(false); // A<->C, different colour
  });

  test("a relation pins its left member once its right member is pinned", () => {
    const rel: Rung = { level: 1, id: "r", kind: "relation", evidence: [], pairs: [["A", "C"]] };
    expect(preserves([0, 1, 2], rel, tags3)).toBe(true);
    expect(preserves([1, 0, 2], rel, tags3)).toBe(false); // moves A off the relation
  });
});

describe("the Aut-invariance gate — the discharge condition, and it FAILS when over-claimed", () => {
  const claimOf = (id: string): Claim => {
    const c = table.claims.find((x) => x.id === id);
    if (c === undefined) throw new Error(`no claim ${id}`);
    return c;
  };

  test("every claim in the shipped table is invariant where it says it is", () => {
    for (const c of table.claims) {
      expect(isInvariant(c, stabilizer(TAGS, table.ladder, c.invariantAt, true), TAGS)).toBe(true);
    }
  });

  test("PLANTED FAILURE: the CBOR major-type claim is NOT invariant at level 4", () => {
    // This is the whole point of the instrument. RFC 8949 gives Int major type 0 and
    // Bytes major type 2; the residual group at level 4 still transposes them, so the
    // assignment is not determined by the agreed structure. Declaring it invariant
    // there is a reachable, natural mistake — and it must be caught.
    const c = claimOf("cbor-major-type-assignment");
    expect(isInvariant(c, stabilizer(TAGS, table.ladder, 4, false), TAGS)).toBe(false);
    // ... and it becomes invariant only once the contested rung is admitted.
    expect(isInvariant(c, stabilizer(TAGS, table.ladder, 5, true), TAGS)).toBe(true);
  });

  test("PLANTED FAILURE: a claim distinguishing Int from Bytes fails under the strict reading", () => {
    const smuggled: Claim = {
      id: "int-is-the-numeric-one",
      invariantAt: TOP,
      assignment: Object.fromEntries(TAGS.map((t) => [t, t === "Int" ? "numeric" : "other"])),
    };
    expect(isInvariant(smuggled, stabilizer(TAGS, table.ladder, TOP, false), TAGS)).toBe(false);
  });

  test("a claim about an already-pinned tag survives — the gate is not vacuously strict", () => {
    const fine: Claim = {
      id: "object-is-object",
      invariantAt: TOP,
      assignment: Object.fromEntries(TAGS.map((t) => [t, t === "Object" ? "map" : "other"])),
    };
    expect(isInvariant(fine, stabilizer(TAGS, table.ladder, TOP, false), TAGS)).toBe(true);
  });
});

describe("PLANTED FAILURE: a new tag with a duplicate profile un-forces the translation", () => {
  test("adding `Decimal` with `Int`'s profile doubles the group and breaks the CBOR claim", () => {
    const tags9 = ["Decimal", ...TAGS];
    const ladder9: Rung[] = table.ladder.map((r) =>
      r.kind === "unary" ? { ...r, profile: { ...r.profile, Decimal: r.profile["Int"] as string } } : r,
    );
    // 1 bit -> 2.585 bits: the structure now fails to determine three more translations.
    expect(stabilizer(tags9, ladder9, 5, false).length).toBe(6);
    expect(stabilizer(tags9, ladder9, 5, true).length).toBe(2);

    const c = table.claims.find((x) => x.id === "cbor-major-type-assignment") as Claim;
    const c9: Claim = {
      ...c,
      assignment: { ...c.assignment, Decimal: c.assignment["Int"] as string },
    };
    // Previously invariant at level 5; no longer.
    expect(isInvariant(c9, stabilizer(tags9, ladder9, 5, true), tags9)).toBe(false);
  });
});

describe("bits", () => {
  test("a forced translation costs exactly zero", () => {
    expect(bits(1)).toBe(0);
  });
  test("the bare 8-tag set costs log2(8!) ~ 15.2992 bits", () => {
    expect(bits(40320)).toBeCloseTo(15.2992, 4);
  });
});
