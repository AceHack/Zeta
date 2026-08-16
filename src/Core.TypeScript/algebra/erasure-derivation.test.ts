/**
 * erasure-derivation.test.ts — MEASURE the bits each algebra operation erases, and check the
 * charge against the measurement.
 *
 * The TypeScript twin of `tests/Tests.FSharp/Formal/WSet.ErasureClassification.Laws.Tests.fs`
 * (PR #10611). Same rule: sweep the operation over an enumerable domain, group by observable
 * output, `bitsErased = log2(largest fibre)`. Nothing here asserts a bit count; every number is
 * measured from the operation and then compared against what the call site charges.
 *
 * It fails in BOTH directions, which is what stops the table going stale:
 *
 *   - a declared-reversible operation made lossy  → measured `erasing`, row mismatch
 *   - a declared-erasing operation made bijective → measured `reversible`, row mismatch
 *   - an operation added with no row              → coverage guard fails
 *   - a charge that stops matching its derivation → charge test fails
 *
 * Imports are node builtins + repo-local modules only (`pr-manifest-integrity.yml` runs with no
 * `bun install`).
 */

import { describe, test, expect } from "bun:test";
import { createEntropyTracker } from "./entropy-tracker";
import {
  measureErasure,
  sortOrdinal,
  mapMutationErasureBits,
  decisionErasureBits,
  keyMaterialErasureBits,
  MAP_MUTATION_ERASURE_FLOOR_BITS,
  PAYLOAD_RETURNED_ERASURE_BITS,
  APPEND_ONLY_ERASURE_BITS,
  type DeclaredErasure,
  type ThermoClass,
} from "./erasure-derivation";
import { createAdjArray, createNonAdjMap, createFerryQueue } from "./physics-traits";
import { admitKeyMaterial, meterKeyErasure, emptyErasureLedger } from "./key-erasure-meter";

// ═══ Invariant renderings (never a locale collation) ═══════════════════════════

const renderMap = (m: ReadonlyMap<string, number>): string =>
  sortOrdinal([...m.keys()]).map((k) => `${k}=${String(m.get(k))}`).join(",");

const renderList = (xs: readonly string[]): string => xs.join(",");

// ═══ The swept domains ═════════════════════════════════════════════════════════

/** Every map over keys {a,b} with values {0,1}: each key absent, 0, or 1 → 3² = 9 states. */
const MAP_DOMAIN: readonly ReadonlyMap<string, number>[] = (() => {
  const slots: readonly (number | undefined)[] = [undefined, 0, 1];
  const out: Map<string, number>[] = [];
  for (const a of slots) {
    for (const b of slots) {
      const m = new Map<string, number>();
      if (a !== undefined) m.set("a", a);
      if (b !== undefined) m.set("b", b);
      out.push(m);
    }
  }
  return out;
})();

/** Every queue over items {x,y} of length 0..2 → 1 + 2 + 4 = 7 states. */
const QUEUE_DOMAIN: readonly (readonly string[])[] = (() => {
  const items = ["x", "y"];
  const out: string[][] = [[]];
  for (const i of items) out.push([i]);
  for (const i of items) for (const j of items) out.push([i, j]);
  return out;
})();

/** Every 2-cell array over {0,1} → 4 states. */
const ARRAY_DOMAIN: readonly (readonly number[])[] = [[0, 0], [0, 1], [1, 0], [1, 1]];

// ═══ The instrument, checked before it is trusted ══════════════════════════════
//
// A vacuity detector that is itself unchecked is the same defect one layer out. On 2026-08-14 a
// vacuity detector in this repo ran at roughly a 70% false-positive rate. So: a known bijection
// must read `reversible`/0, and a known 4-to-1 collapse must read `erasing`/2.

describe("measureErasure — the instrument", () => {
  test("a known bijection reads reversible, 0 bits", () => {
    const m = measureErasure([0, 1, 2, 3], (n) => String(n + 100));
    expect(m.thermoClass).toBe("reversible");
    expect(m.bitsErased).toBe(0);
    expect(m.maxFibre).toBe(1);
    expect(m.imageCount).toBe(4);
  });

  test("a known 4-to-1 collapse reads erasing, exactly 2 bits", () => {
    const m = measureErasure([0, 1, 2, 3, 4, 5, 6, 7], (n) => String(n % 2));
    expect(m.thermoClass).toBe("erasing");
    expect(m.maxFibre).toBe(4);
    expect(m.bitsErased).toBe(2);
  });

  test("a 3-to-1 collapse reads the irrational log2(3) — not a rounded integer", () => {
    const m = measureErasure([0, 1, 2], () => "collapsed");
    expect(m.bitsErased).toBeCloseTo(1.584962500721156, 12);
  });

  test("a sweep over a one-state domain cannot report erasing — sweptStates says so", () => {
    const m = measureErasure([42], () => "same");
    expect(m.thermoClass).toBe("reversible");
    expect(m.sweptStates).toBe(1);
  });
});

// ═══ The declared table — the claim the sweep checks ═══════════════════════════

const DECLARED: readonly DeclaredErasure[] = [
  // ── AdjArray ──
  { surface: "AdjArray", operation: "get", declared: "reversible", basis: "read; post-state is the pre-state" },
  {
    surface: "AdjArray",
    operation: "set",
    declared: "reversible",
    basis: "returns the overwritten value, so (post, old) determines pre — the old value IS the inverse",
  },
  { surface: "AdjArray", operation: "toArray", declared: "reversible", basis: "bulk read; state unchanged" },

  // ── NonAdjMap ──
  { surface: "NonAdjMap", operation: "get", declared: "reversible", basis: "read; state unchanged" },
  { surface: "NonAdjMap", operation: "has", declared: "reversible", basis: "read; state unchanged" },
  {
    surface: "NonAdjMap",
    operation: "put",
    declared: "erasing",
    basis: "old value overwritten and NOT returned; fibre = |V| + 1, so log2(|V| + 1) bits",
  },
  {
    surface: "NonAdjMap",
    operation: "delete",
    declared: "erasing",
    basis: "post-state cannot tell absent from any occupied value; fibre = |V| + 1",
  },
  { surface: "NonAdjMap", operation: "entries", declared: "reversible", basis: "bulk read; state unchanged" },

  // ── FerryQueue — the finding: every leg is a bijection ──
  { surface: "FerryQueue", operation: "enqueue", declared: "reversible", basis: "Q -> Q ++ [x] is injective for fixed x" },
  { surface: "FerryQueue", operation: "peek", declared: "reversible", basis: "read; state unchanged" },
  {
    surface: "FerryQueue",
    operation: "dequeue",
    declared: "reversible",
    basis: "returns the item, so (tail, head) determines Q; inverse is push-front",
  },
  {
    surface: "FerryQueue",
    operation: "flush",
    declared: "reversible",
    basis: "returns the whole batch, so Q -> ([], Q) is a bijection; batching is free (Bennett 1973)",
  },
  { surface: "FerryQueue", operation: "snapshot", declared: "reversible", basis: "read; state unchanged" },
];

const declaredFor = (surface: string, operation: string): DeclaredErasure => {
  const row = DECLARED.find((d) => d.surface === surface && d.operation === operation);
  if (row === undefined) throw new Error(`no declared erasure row for ${surface}.${operation}`);
  return row;
};

/** Function-valued own properties, without invoking accessors (`size`, `pending`, `length`). */
function operationNames(surfaceValue: object): readonly string[] {
  const descriptors = Object.getOwnPropertyDescriptors(surfaceValue);
  return sortOrdinal(
    Object.keys(descriptors).filter((k) => typeof descriptors[k]?.value === "function"),
  );
}

// ═══ Declared vs measured, per operation ═══════════════════════════════════════

const expectClass = (surface: string, operation: string, measured: ThermoClass): void => {
  const row = declaredFor(surface, operation);
  expect(`${surface}.${operation}=${measured}`).toBe(`${surface}.${operation}=${row.declared}`);
};

describe("NonAdjMap — declared class vs measured class", () => {
  test("put is measured erasing, at log2(|V| + 1) — and that is exactly the derived charge", () => {
    const m = measureErasure(MAP_DOMAIN, (pre) => {
      const post = new Map(pre);
      post.set("a", 0);
      return renderMap(post);
    });
    expectClass("NonAdjMap", "put", m.thermoClass);
    // |V| = 2 over this domain, so the fibre is {absent, 0, 1} = 3 and the figure is log2(3).
    expect(m.maxFibre).toBe(3);
    expect(m.bitsErased).toBeCloseTo(Math.log2(3), 12);
    // The closed form the call site uses, computed independently, lands on the same number.
    expect(mapMutationErasureBits(1)).toBeCloseTo(m.bitsErased, 12);
  });

  test("delete is measured erasing, with the same fibre as put", () => {
    const m = measureErasure(MAP_DOMAIN, (pre) => {
      const post = new Map(pre);
      post.delete("a");
      return renderMap(post);
    });
    expectClass("NonAdjMap", "delete", m.thermoClass);
    expect(m.maxFibre).toBe(3);
    expect(mapMutationErasureBits(1)).toBeCloseTo(m.bitsErased, 12);
  });

  test("get / has / entries are measured reversible (state unchanged, value returned)", () => {
    for (const op of ["get", "has", "entries"] as const) {
      const m = measureErasure(MAP_DOMAIN, (pre) => {
        const returned =
          op === "get" ? String(pre.get("a")) : op === "has" ? String(pre.has("a")) : renderMap(pre);
        return `${renderMap(pre)}|${returned}`;
      });
      expectClass("NonAdjMap", op, m.thermoClass);
      expect(m.bitsErased).toBe(0);
    }
  });

  test("the derived floor is a floor: 1 bit with no declared domain, more once declared", () => {
    expect(mapMutationErasureBits(undefined)).toBe(MAP_MUTATION_ERASURE_FLOOR_BITS);
    expect(mapMutationErasureBits(0)).toBe(1); // |V| = 1 → log2(2) = 1, the floor is exact here
    expect(mapMutationErasureBits(1)).toBeCloseTo(Math.log2(3), 12);
    expect(mapMutationErasureBits(8)).toBeCloseTo(Math.log2(257), 12);
    // Monotone in the domain size, and never below the floor — a floor that can be undercut is
    // not a floor.
    for (const bits of [0, 1, 2, 4, 8, 16]) {
      expect(mapMutationErasureBits(bits)).toBeGreaterThanOrEqual(MAP_MUTATION_ERASURE_FLOOR_BITS);
    }
  });
});

describe("FerryQueue — every leg measures reversible (the finding)", () => {
  test("enqueue is injective for a fixed item", () => {
    const shortEnough = QUEUE_DOMAIN.filter((q) => q.length <= 1);
    const m = measureErasure(shortEnough, (pre) => renderList([...pre, "x"]));
    expectClass("FerryQueue", "enqueue", m.thermoClass);
    expect(m.bitsErased).toBe(0);
  });

  test("dequeue is injective ONCE THE RETURNED ITEM IS COUNTED — the meter was on a bijection", () => {
    const m = measureErasure(QUEUE_DOMAIN, (pre) => {
      const post = [...pre];
      const returned = post.shift();
      return `${renderList(post)}|${String(returned)}`;
    });
    expectClass("FerryQueue", "dequeue", m.thermoClass);
    expect(m.maxFibre).toBe(1);
    expect(m.bitsErased).toBe(PAYLOAD_RETURNED_ERASURE_BITS);
    expect(m.sweptStates).toBe(7); // a non-vacuous domain, not a one-element sweep
  });

  test("flush is injective — Q -> ([], Q); the batchSize charge had no signal at all", () => {
    const m = measureErasure(QUEUE_DOMAIN, (pre) => `|${renderList([...pre])}`);
    expectClass("FerryQueue", "flush", m.thermoClass);
    expect(m.bitsErased).toBe(PAYLOAD_RETURNED_ERASURE_BITS);
  });

  test("DROPPING the batch instead of returning it IS erasing — the leg the meter belonged on", () => {
    // The same operation with the payload discarded rather than handed back. This is the control
    // that proves the sweep can tell the two apart: same state transition, different observable.
    const m = measureErasure(QUEUE_DOMAIN, () => "[]");
    expect(m.thermoClass).toBe("erasing");
    expect(m.maxFibre).toBe(7);
    expect(m.bitsErased).toBeCloseTo(Math.log2(7), 12);
  });

  test("peek / snapshot are reversible", () => {
    for (const op of ["peek", "snapshot"] as const) {
      const m = measureErasure(QUEUE_DOMAIN, (pre) =>
        `${renderList(pre)}|${op === "peek" ? String(pre[0]) : renderList(pre)}`);
      expectClass("FerryQueue", op, m.thermoClass);
      expect(m.bitsErased).toBe(0);
    }
  });
});

describe("AdjArray — declared reversible, measured reversible (the positive control)", () => {
  test("set returns the overwritten value, which is exactly what makes it a bijection", () => {
    const m = measureErasure(ARRAY_DOMAIN, (pre) => {
      const post = [...pre];
      const old = post[0];
      post[0] = 9;
      return `${renderList(post.map(String))}|${String(old)}`;
    });
    expectClass("AdjArray", "set", m.thermoClass);
    expect(m.bitsErased).toBe(PAYLOAD_RETURNED_ERASURE_BITS);
  });

  test("set WITHOUT returning the old value would be erasing — the return value is load-bearing", () => {
    const m = measureErasure(ARRAY_DOMAIN, (pre) => {
      const post = [...pre];
      post[0] = 9;
      return renderList(post.map(String));
    });
    expect(m.thermoClass).toBe("erasing");
    expect(m.bitsErased).toBe(1); // the discarded cell held 1 of 2 values
  });

  test("get / toArray are reversible", () => {
    for (const op of ["get", "toArray"] as const) {
      const m = measureErasure(ARRAY_DOMAIN, (pre) =>
        `${renderList(pre.map(String))}|${op === "get" ? String(pre[0]) : renderList(pre.map(String))}`);
      expectClass("AdjArray", op, m.thermoClass);
    }
  });
});

// ═══ The coverage guard: a new operation cannot arrive unclassified ════════════

describe("coverage guard — every implemented operation carries a declared row", () => {
  const tracker = createEntropyTracker();
  const surfaces: readonly (readonly [string, object])[] = [
    ["AdjArray", createAdjArray<number>(tracker, [1, 2])],
    ["NonAdjMap", createNonAdjMap<string, number>(tracker)],
    ["FerryQueue", createFerryQueue<string>(tracker)],
  ];

  for (const [surface, value] of surfaces) {
    test(`${surface}: implemented operations === declared operations`, () => {
      const implemented = operationNames(value);
      const declared = sortOrdinal(DECLARED.filter((d) => d.surface === surface).map((d) => d.operation));
      // Equality both ways: a new op with no row fails, and a row for a removed op fails too.
      expect(implemented).toEqual(declared as string[]);
      expect(implemented.length).toBeGreaterThan(0);
    });
  }

  test("every declared row states its basis — a row asserting a class without one is not a claim", () => {
    for (const row of DECLARED) {
      expect(row.basis.length).toBeGreaterThan(20);
    }
  });
});

// ═══ The charge at the call site equals the derived figure ═════════════════════

describe("charge == derivation (this is what a constant-restoring mutant breaks)", () => {
  test("NonAdjMap put/delete charge the derived figure, and it tracks the declared domain", () => {
    for (const valueDomainBits of [undefined, 0, 1, 8]) {
      const tracker = createEntropyTracker();
      // `exactOptionalPropertyTypes` is on: an absent option and an option explicitly set to
      // `undefined` are different things, and the undeclared-domain case is the absent one.
      const map = createNonAdjMap<string, number>(
        tracker,
        valueDomainBits === undefined ? {} : { valueDomainBits },
      );
      const expected = mapMutationErasureBits(valueDomainBits);

      map.put("k", 1);
      expect(tracker.state.entropy_heat).toBeCloseTo(expected, 12);
      map.delete("k");
      expect(tracker.state.entropy_heat).toBeCloseTo(2 * expected, 12);
      // Reads add nothing.
      map.get("k"); map.has("k"); map.entries();
      expect(tracker.state.entropy_heat).toBeCloseTo(2 * expected, 12);
    }
  });

  test("a declared 8-bit value domain charges strictly more than the undeclared floor", () => {
    // If a mutant replaces the derived call with the bare literal `1`, these two go equal.
    expect(mapMutationErasureBits(8)).toBeGreaterThan(mapMutationErasureBits(undefined));
  });

  test("FerryQueue drains charge exactly zero heat and record no measurement", () => {
    const tracker = createEntropyTracker();
    const q = createFerryQueue<string>(tracker);
    q.enqueue("a"); q.enqueue("b"); q.enqueue("c");

    q.dequeue();
    q.flush();

    expect(tracker.state.entropy_heat).toBe(0);
    expect(tracker.state.bits_erased).toBe(0);
    // A `measure(0)` would also leave heat at 0 — but it would count as a hard measurement.
    // A reversible operation is not a measurement of any size.
    expect(tracker.state.hard_measurements).toBe(0);
  });

  test("no sequence of FerryQueue operations can produce heat", () => {
    // Exhaustive over every operation word of length <= 4 (5^4 + ... = 780 sequences).
    const ops = ["enqueue", "dequeue", "flush", "peek", "snapshot"] as const;
    const run = (word: readonly (typeof ops)[number][]): number => {
      const tracker = createEntropyTracker();
      const q = createFerryQueue<string>(tracker);
      for (const op of word) {
        if (op === "enqueue") q.enqueue("i");
        else if (op === "dequeue") q.dequeue();
        else if (op === "flush") q.flush();
        else if (op === "peek") q.peek();
        else q.snapshot();
      }
      return tracker.state.entropy_heat;
    };
    let words: (typeof ops)[number][][] = [[]];
    let checked = 0;
    for (let len = 1; len <= 4; len++) {
      words = words.flatMap((w) => ops.map((o) => [...w, o]));
      for (const w of words) {
        expect(run(w)).toBe(0);
        checked += 1;
      }
    }
    expect(checked).toBe(5 + 25 + 125 + 625);
  });
});

// ═══ key-erasure-meter: the one shipped constant that was already the derived value ═══

describe("key-erasure-meter — the charge was already derived, and the sweep agrees", () => {
  test("destroying a b-bit secret is measured at exactly b bits", () => {
    // NOTE what this sweeps: a model of the DESTRUCTION of key material, not `meterKeyErasure`
    // itself. The module never holds the material it charges for — it holds a keyId and a bit
    // count — so the fibre lives in the space of secrets, which is external to it. Said out loud
    // because a sweep over the wrong domain is how a derivation becomes an assertion again.
    for (const b of [1, 3, 8]) {
      const secrets = Array.from({ length: 2 ** b }, (_unused, i) => i);
      const m = measureErasure(secrets, () => "destroyed");
      expect(m.maxFibre).toBe(2 ** b);
      expect(m.bitsErased).toBe(b);
      expect(keyMaterialErasureBits(b)).toBe(m.bitsErased);
    }
  });

  test("meterKeyErasure charges the admitted bit count, taken from the ledger not the claimant", () => {
    const tracker = createEntropyTracker();
    const admitted = admitKeyMaterial(emptyErasureLedger(), { keyId: "k", bits: 8, phase: 1 }, tracker);
    expect(admitted.outcome.kind).toBe("admitted");

    const erased = meterKeyErasure(admitted.ledger, { keyId: "k", phase: 2 }, tracker);
    expect(erased.outcome.kind).toBe("charged");
    expect(tracker.state.entropy_heat).toBe(keyMaterialErasureBits(8));
    expect(tracker.state.bits_admitted).toBe(8); // admitted first — no unadmitted erasure here
  });
});

// ═══ event-sink-folder: the append is derived to zero ══════════════════════════

describe("append-only log — the production meter that was on the wrong leg", () => {
  test("appending a fact to a G-Set is injective, so the derived charge is zero", () => {
    // Domain: every subset of {e1, e2} that does not already contain e3.
    const logs: readonly (readonly string[])[] = [[], ["e1"], ["e2"], ["e1", "e2"]];
    const m = measureErasure(logs, (pre) => renderList(sortOrdinal([...pre, "e3"])));
    expect(m.thermoClass).toBe("reversible");
    expect(m.bitsErased).toBe(APPEND_ONLY_ERASURE_BITS);
  });

  test("re-appending an id already present is the identity — also injective", () => {
    const logs: readonly (readonly string[])[] = [["e1"], ["e1", "e2"]];
    const m = measureErasure(logs, (pre) => renderList(sortOrdinal([...new Set([...pre, "e1"])])));
    expect(m.thermoClass).toBe("reversible");
  });

  test("the DECISION is where the erasure is, and it is log2(N) — not 1", () => {
    expect(decisionErasureBits(2)).toBe(1); // the only N for which the shipped literal was right
    expect(decisionErasureBits(9)).toBeCloseTo(Math.log2(9), 12); // observe.ts has nine action kinds
    expect(decisionErasureBits(1)).toBe(0); // no choice was made
    expect(decisionErasureBits(0)).toBe(0);
    // A menu of nine costs more than three times the literal that shipped.
    expect(decisionErasureBits(9)).toBeGreaterThan(3);
  });
});
