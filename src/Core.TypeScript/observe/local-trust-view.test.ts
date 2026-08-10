import { describe, expect, test } from "bun:test";
import { COMMON_SEED, createPhaseClock, type PhaseState } from "./phase-clock";
import {
  TRUST_SIGNAL_KINDS,
  createTrustView,
  diffTrustView,
  type HeldAnchor,
  type TrustVerdict,
} from "./local-trust-view";

const stamp = (phase: number, seed: number): PhaseState => ({
  phase,
  seed,
  lastAdvanceReason: "init",
  wallClockAt: "",
});

/** An honest chain of `n+1` stamps from a starting seed — what a real subject produces. */
function honestChain(startPhase: number, startSeed: number, n: number): PhaseState[] {
  const clock = createPhaseClock(startSeed);
  const out: PhaseState[] = [stamp(startPhase, startSeed)];
  for (let i = 1; i <= n; i++) {
    clock.tick("heartbeat");
    out.push(stamp(startPhase + i, clock.state.seed));
  }
  return out;
}

const kinds = (v: TrustVerdict) => v.signals.map((s) => s.kind);
const depthOf = (v: TrustVerdict) =>
  (v.signals.find((s) => s.kind === "shared-anchor") as { depth: number } | undefined)?.depth;

describe("property 1 — purity is the freedom guarantee", () => {
  test("same inputs, same verdict", () => {
    const chain = honestChain(0, COMMON_SEED, 4);
    const held: HeldAnchor[] = [{ subject: "s", stamp: chain[1]! }];
    expect(createTrustView(held).about("s", chain)).toEqual(
      createTrustView(held).about("s", chain),
    );
  });

  test("mutating the caller's HELD array afterwards cannot change a verdict", () => {
    // The casts are the point: `HeldAnchor` is readonly, so TypeScript REFUSES to compile
    // these mutations for a typed caller. The runtime snapshot is the second line of
    // defence, for JS callers that ignore types. Both are real, so both are tested.
    const chain = honestChain(0, COMMON_SEED, 3);
    const held: HeldAnchor[] = [{ subject: "s", stamp: { ...chain[1]! } }];
    const view = createTrustView(held);
    const before = view.about("s", chain);

    held.push({ subject: "s", stamp: { ...chain[3]! } });
    (held[0]!.stamp as { phase: number }).phase = 99;
    (held[0] as { subject: string }).subject = "someone-else";

    expect(view.about("s", chain)).toEqual(before);
  });

  test("a changed ARGUMENT does change the verdict — as a pure function must", () => {
    const chain = honestChain(0, COMMON_SEED, 3);
    const view = createTrustView([{ subject: "s", stamp: { ...chain[1]! } }]);
    const forged = [...chain];
    forged[3] = stamp(3, chain[3]!.seed ^ 0xff);
    expect(view.about("s", forged)).not.toEqual(view.about("s", chain));
  });

  test("verdicts do not depend on the ORDER anchors were supplied in", () => {
    const chain = honestChain(0, COMMON_SEED, 4);
    const a: HeldAnchor[] = [chain[1]!, chain[3]!].map((s) => ({ subject: "s", stamp: s }));
    const b: HeldAnchor[] = [chain[3]!, chain[1]!].map((s) => ({ subject: "s", stamp: s }));
    expect(createTrustView(a).about("s", chain)).toEqual(createTrustView(b).about("s", chain));
  });
});

describe("property 2 — HEADLINE: two nodes disagree, and both are correct", () => {
  test("different histories yield different verdicts about the same subject", () => {
    const chain = honestChain(0, COMMON_SEED, 6);
    const recent = createTrustView([{ subject: "s", stamp: chain[5]! }]);
    const stale = createTrustView([{ subject: "s", stamp: chain[1]! }]);

    const vRecent = recent.about("s", chain);
    const vStale = stale.about("s", chain);

    expect(vRecent).not.toEqual(vStale);
    // Both CORRECT: each reports the true distance from its own anchor.
    expect(depthOf(vRecent)).toBe(1);
    expect(depthOf(vStale)).toBe(5);
  });

  test("a node with no history reports absence, not distrust", () => {
    const chain = honestChain(0, COMMON_SEED, 3);
    expect(kinds(createTrustView([]).about("s", chain))).toEqual(["no-evidence"]);
  });
});

describe("P0 REGRESSION — presenting LESS must not look better", () => {
  // Found by Kira. Empty / truncated / forged-at-anchor claims all returned depth 0,
  // indistinguishable from a perfect match and BETTER than an honest claim's depth 2.
  // A claimant improved its standing by withholding. Absence must not read as recency.
  const chain = honestChain(0, COMMON_SEED, 5);
  const view = () => createTrustView([{ subject: "s", stamp: chain[3]! }]);

  test("an EMPTY claim is no-evidence, not depth 0", () => {
    expect(kinds(view().about("s", []))).toEqual(["no-evidence"]);
  });

  test("a claim entirely BELOW our anchor is no-evidence", () => {
    expect(kinds(view().about("s", chain.slice(0, 3)))).toEqual(["no-evidence"]);
  });

  test("a forged stamp AT the anchor phase is caught, not silently accepted", () => {
    const v = view().about("s", [stamp(3, 0xdeadbeef)]);
    expect(kinds(v)).not.toEqual(["shared-anchor"]);
    expect(v.signals.some((s) => s.kind === "chain-broken")).toBe(true);
  });

  test("withholding never scores better than honesty", () => {
    const honest = view().about("s", chain);
    for (const withheld of [[], chain.slice(0, 3), chain.slice(0, 2)]) {
      expect(view().about("s", withheld)).not.toEqual(honest);
    }
  });
});

describe("P0 REGRESSION — chain-verified must mean the CHAIN, not the endpoints", () => {
  test("a tampered MIDDLE stamp is caught and located", () => {
    // Previously: only anchor -> newest was compared, so this reported chain-verified.
    // The old test forged only the LAST element, so the gap was untested by construction.
    const chain = honestChain(0, COMMON_SEED, 5);
    const tampered = [...chain];
    tampered[2] = stamp(2, 0xbadbad);
    const v = createTrustView([{ subject: "s", stamp: chain[0]! }]).about("s", tampered);
    expect(v.signals.some((s) => s.kind === "chain-verified")).toBe(false);
    const broken = v.signals.find((s) => s.kind === "chain-broken") as
      | { atIndex: number }
      | undefined;
    expect(broken?.atIndex).toBe(2);
  });

  test("an honest chain verifies and reports how many LINKS were checked", () => {
    const chain = honestChain(0, COMMON_SEED, 4);
    const v = createTrustView([{ subject: "s", stamp: chain[0]! }]).about("s", chain);
    const ok = v.signals.find((s) => s.kind === "chain-verified") as
      | { links: number; span: number }
      | undefined;
    expect(ok?.links).toBe(4);
    expect(ok?.span).toBe(4);
  });
});

describe("property 3 — spectrum, never a verdict (asserted on the TYPE, not the text)", () => {
  test("the exhaustive kind list contains no judgement", () => {
    // Replaces an earlier test that grepped serialised JSON for "friend"/"enemy". That
    // could only fail if someone literally spelled those words; `{kind:"hostile"}` passed.
    // The falsifier is about the TYPE, so assert the union itself.
    expect([...TRUST_SIGNAL_KINDS]).toEqual([
      "shared-anchor",
      "chain-verified",
      "chain-broken",
      "no-evidence",
    ]);
  });

  test("every emitted signal kind is drawn from that list, across all outcome paths", () => {
    const chain = honestChain(0, COMMON_SEED, 4);
    const tampered = [...chain];
    tampered[2] = stamp(2, 1);
    const outcomes = [
      createTrustView([]).about("s", chain),
      createTrustView([{ subject: "s", stamp: chain[0]! }]).about("s", chain),
      createTrustView([{ subject: "s", stamp: chain[0]! }]).about("s", tampered),
      createTrustView([{ subject: "s", stamp: chain[2]! }]).about("s", []),
    ];
    for (const v of outcomes) {
      for (const k of kinds(v)) expect(TRUST_SIGNAL_KINDS).toContain(k);
      expect(v.signals.length).toBeGreaterThan(0);
    }
  });

  test("recency is the strength measure — depth grows as the anchor goes stale", () => {
    const chain = honestChain(0, COMMON_SEED, 8);
    const d = (i: number) =>
      depthOf(createTrustView([{ subject: "s", stamp: chain[i]! }]).about("s", chain))!;
    expect(d(7)).toBeLessThan(d(2));
  });
});

describe("property 4 — open-keyed: no registry, no persona required", () => {
  test("arbitrary locally-minted identifiers work identically", () => {
    const chain = honestChain(0, COMMON_SEED, 3);
    for (const id of ["did:zeta:9f2a", "0xdeadbeef", "someone-nobody-registered", "🜁"]) {
      const v = createTrustView([{ subject: id, stamp: chain[0]! }]).about(id, chain);
      expect(v.subject).toBe(id);
      expect(kinds(v)).toContain("shared-anchor");
    }
  });

  test("subjects are isolated — an anchor for one says nothing about another", () => {
    const chain = honestChain(0, COMMON_SEED, 3);
    const view = createTrustView([{ subject: "alice", stamp: chain[0]! }]);
    expect(kinds(view.about("bob", chain))).toEqual(["no-evidence"]);
  });
});

describe("property 5 — no global assembly (enforced by the SIGNATURE)", () => {
  test("diffTrustView cannot see any subject but the one asked about", () => {
    // The real assembly surface was never `Object.keys(view)` — that is trivially defeated
    // by a non-enumerable property. It was diffTrustView requiring a peer's whole
    // cross-subject HeldAnchor[] to answer about ONE subject (Kira). It now takes
    // per-subject stamps, so the type cannot express the global request.
    const chain = honestChain(0, COMMON_SEED, 3);
    const d = diffTrustView("s", [chain[0]!], [chain[1]!]);
    expect(d.subject).toBe("s");
    expect(Object.keys(d).sort()).toEqual(["subject", "theyKnowWeDoNot", "weKnowTheyDoNot"]);
  });

  test("the view exposes exactly one query and no enumeration", () => {
    const view = createTrustView([{ subject: "s", stamp: stamp(0, COMMON_SEED) }]);
    expect(Object.keys(view)).toEqual(["about"]);
  });
});

describe("slice 1b — diffTrustView: the disagreement is the product", () => {
  test("reports what each side knows that the other does not", () => {
    const c = honestChain(0, COMMON_SEED, 5);
    const d = diffTrustView("s", [c[1]!, c[2]!], [c[2]!, c[4]!]);
    expect(d.theyKnowWeDoNot.map((s) => s.phase)).toEqual([4]);
    expect(d.weKnowTheyDoNot.map((s) => s.phase)).toEqual([1]);
  });

  test("A FORK at the same phase is surfaced, not silently merged", () => {
    // Keying on phase alone reported "nothing to learn" for two conflicting stamps at the
    // same phase — the single highest-value divergence this primitive exists to find.
    const a = stamp(2, 111);
    const b = stamp(2, 222);
    const d = diffTrustView("s", [a], [b]);
    expect(d.theyKnowWeDoNot).toEqual([b]);
    expect(d.weKnowTheyDoNot).toEqual([a]);
  });

  test("ASYMMETRIC on purpose — swapping arguments answers a different question", () => {
    const c = honestChain(0, COMMON_SEED, 4);
    const ab = diffTrustView("s", [c[1]!], [c[3]!]);
    const ba = diffTrustView("s", [c[3]!], [c[1]!]);
    expect(ab.theyKnowWeDoNot).toEqual(ba.weKnowTheyDoNot);
    expect(ab).not.toEqual(ba);
  });

  test("identical histories produce an empty diff — nothing to learn, not agreement", () => {
    const c = honestChain(0, COMMON_SEED, 3);
    const d = diffTrustView("s", [c[2]!], [c[2]!]);
    expect(d.theyKnowWeDoNot).toEqual([]);
    expect(d.weKnowTheyDoNot).toEqual([]);
  });
});
