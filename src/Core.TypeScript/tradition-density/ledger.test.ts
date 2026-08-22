import { describe, expect, test } from "bun:test";
import { densityOf, nullRate } from "./density";
import { drawAt, mscCorpus } from "./draw";
import {
  appendAll,
  appendEntry,
  canonicalEntry,
  emptyLedger,
  entriesOf,
  entryKey,
  parseLedger,
  serializeLedger,
  validateEntry,
  type LedgerEntry,
} from "./ledger";
import { MSC2020_TOP_LEVEL } from "./msc2020-corpus";

/** Index/find accessor that refuses `undefined` loudly — a missing element is a failed test, not a silent `!`. */
function must<T>(x: T | undefined): T {
  if (x === undefined) throw new Error("expected a value, got undefined");
  return x;
}


const corpus = mscCorpus(MSC2020_TOP_LEVEL);
const SEED = 20260817n;
const alwaysResolves = (): boolean => true;
const neverResolves = (): boolean => false;

function entryAt(iteration: number, coupling: LedgerEntry["coupling"]): LedgerEntry {
  const d = drawAt(corpus, SEED, iteration);
  return { corpus: d.corpus, corpusVersion: d.corpusVersion, seed: d.seed, iteration, code: d.code, title: d.title, coupling };
}

const coupled = (target: string, claim = "a claim"): LedgerEntry["coupling"] => ({ kind: "coupled", targets: [{ target, claim }] });

describe("ledger — append-only (G-Set)", () => {
  // MUTATION TARGET (a): make the ledger overwrite instead of append.
  test("a revision of an existing key is REFUSED, and the original survives untouched", () => {
    const first = entryAt(0, coupled("src/Core/GSet.fs", "original"));
    const revised = entryAt(0, coupled("src/Core/Crdt.fs", "revised after the fact"));
    const l1 = appendEntry(emptyLedger, first);
    expect(l1.ok).toBe(true);
    if (!l1.ok) return;
    const l2 = appendEntry(l1.value, revised);
    expect(l2.ok).toBe(false);
    if (l2.ok) return;
    expect(l2.error).toContain("append-only");
    // and the original is still exactly what it was
    expect(l1.value).toEqual(appendEntry(emptyLedger, first).ok ? l1.value : []);
    expect(entriesOf(l1.value)).toHaveLength(1);
    expect(canonicalEntry(must(entriesOf(l1.value)[0]))).toBe(canonicalEntry(first));
  });

  test("a null cannot be revised into a hit", () => {
    const asNull = entryAt(1, { kind: "null", note: "nothing specific found" });
    const asHit = entryAt(1, coupled("src/Core/GSet.fs"));
    const l1 = appendEntry(emptyLedger, asNull);
    expect(l1.ok).toBe(true);
    if (!l1.ok) return;
    expect(appendEntry(l1.value, asHit).ok).toBe(false);
  });

  test("re-appending a byte-identical entry is an idempotent no-op", () => {
    const e = entryAt(2, coupled("src/Core/GSet.fs"));
    const l1 = appendEntry(emptyLedger, e);
    expect(l1.ok).toBe(true);
    if (!l1.ok) return;
    const l2 = appendEntry(l1.value, e);
    expect(l2.ok).toBe(true);
    if (!l2.ok) return;
    expect(l2.value).toEqual(l1.value);
    expect(entriesOf(l2.value)).toHaveLength(1);
  });

  test("target order does not change the canonical bytes (so re-submission stays idempotent)", () => {
    const a = entryAt(3, { kind: "coupled", targets: [{ target: "b.ts", claim: "x" }, { target: "a.ts", claim: "y" }] });
    const b = entryAt(3, { kind: "coupled", targets: [{ target: "a.ts", claim: "y" }, { target: "b.ts", claim: "x" }] });
    expect(canonicalEntry(a)).toBe(canonicalEntry(b));
  });

  test("the same code drawn at two iterations is two rows, never merged", () => {
    // iterations 8 and 13 of the demo seed both draw MSC 68.
    expect(drawAt(corpus, SEED, 8).code).toBe(drawAt(corpus, SEED, 13).code);
    const r = appendAll(emptyLedger, [entryAt(8, coupled("src/Core/GSet.fs")), entryAt(13, coupled("src/Core/GSet.fs"))]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(entriesOf(r.value)).toHaveLength(2);
    expect(entryKey(must(entriesOf(r.value)[0]))).not.toBe(entryKey(must(entriesOf(r.value)[1])));
  });

  test("serialize/parse round-trips through text (no binary in the proof lineage)", () => {
    const r = appendAll(emptyLedger, [entryAt(0, coupled("a.ts")), entryAt(1, { kind: "null", note: "n" })]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(parseLedger(serializeLedger(r.value))).toEqual(r.value);
  });
});

describe("ledger — validation", () => {
  test("a target that does not resolve is refused", () => {
    const e = entryAt(0, coupled("src/Core/DoesNotExist.fs"));
    const v = validateEntry(e, drawAt(corpus, SEED, 0), neverResolves);
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.error).toContain("does not resolve");
  });

  test("an entry claiming a tradition the seed did not draw is refused", () => {
    const e = { ...entryAt(0, coupled("a.ts")), code: "68", title: "Computer science" };
    expect(validateEntry(e, drawAt(corpus, SEED, 0), alwaysResolves).ok).toBe(false);
  });

  test("a coupled entry with zero targets is refused as a disguised null", () => {
    const e = entryAt(0, { kind: "coupled", targets: [] });
    const v = validateEntry(e, drawAt(corpus, SEED, 0), alwaysResolves);
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.error).toContain("null wearing a hit's label");
  });

  test("a target with no claim is refused", () => {
    const e = entryAt(0, { kind: "coupled", targets: [{ target: "a.ts", claim: "   " }] });
    expect(validateEntry(e, drawAt(corpus, SEED, 0), alwaysResolves).ok).toBe(false);
  });

  // MUTATION TARGET (c): drop the null-result recording.
  test("a null WITH a stated reason is admitted — the nulls are data", () => {
    const e = entryAt(0, { kind: "null", note: "searched X, Y, Z; nothing specific" });
    expect(validateEntry(e, drawAt(corpus, SEED, 0), neverResolves).ok).toBe(true);
  });

  test("a null with no stated reason is refused — an unexplained null is not a measurement", () => {
    const e = entryAt(0, { kind: "null", note: "  " });
    expect(validateEntry(e, drawAt(corpus, SEED, 0), alwaysResolves).ok).toBe(false);
  });
});

describe("ledger — nulls reach the distribution", () => {
  // MUTATION TARGET (c), the consequence side: if nulls stop being recorded or stop being folded,
  // the null rate collapses and a corpus of pure noise would report universal connection.
  test("nulls sit in the denominator of the null rate", () => {
    const r = appendAll(emptyLedger, [
      entryAt(0, { kind: "null", note: "nothing" }),
      entryAt(1, { kind: "null", note: "nothing" }),
      entryAt(2, coupled("a.ts")),
      entryAt(3, coupled("b.ts")),
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const report = densityOf(entriesOf(r.value));
    expect(report.draws).toBe(4);
    expect(report.nullDraws).toBe(2);
    expect(report.coupledDraws).toBe(2);
    expect(nullRate(report)).toBe(0.5);
  });

  test("dropping the nulls visibly changes the reported rate", () => {
    const withNulls = [entryAt(0, { kind: "null", note: "n" }), entryAt(2, coupled("a.ts"))];
    const withoutNulls = withNulls.filter((e) => e.coupling.kind !== "null");
    expect(nullRate(densityOf(withNulls))).toBe(0.5);
    expect(nullRate(densityOf(withoutNulls))).toBe(0);
  });
});
