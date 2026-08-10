import { describe, expect, test } from "bun:test";
import { COMMON_SEED, createPhaseClock, type PhaseState } from "./phase-clock";
import { createTrustView, diffTrustView, type HeldAnchor } from "./local-trust-view";

const stamp = (phase: number, seed: number): PhaseState => ({
  phase,
  seed,
  lastAdvanceReason: "init",
  wallClockAt: "",
});

/** An honest chain of `n` stamps from a starting seed — what a real subject produces. */
function honestChain(startPhase: number, startSeed: number, n: number): PhaseState[] {
  const clock = createPhaseClock(startSeed);
  const out: PhaseState[] = [stamp(startPhase, startSeed)];
  for (let i = 1; i <= n; i++) {
    clock.tick("heartbeat");
    out.push(stamp(startPhase + i, clock.state.seed));
  }
  return out;
}

describe("property 1 — purity is the freedom guarantee", () => {
  test("same inputs, same verdict; no ambient reads", () => {
    const chain = honestChain(0, COMMON_SEED, 4);
    const held: HeldAnchor[] = [{ subject: "s", stamp: chain[1]! }];
    const a = createTrustView(held).about("s", chain);
    const b = createTrustView(held).about("s", chain);
    expect(a).toEqual(b);
  });

  test("mutating the caller's HELD array afterwards cannot change a verdict", () => {
    // Purity is only real if state captured at construction cannot move underneath it.
    //
    // NOTE the deliberate copy below. An earlier version of this test reused the chain
    // object itself, so mutating `held` also mutated `claimedChain` — and the verdict
    // changed CORRECTLY, because an ARGUMENT had changed. That is a pure function behaving
    // properly, not a leak. The property under test is narrower than "nothing changes".
    const chain = honestChain(0, COMMON_SEED, 3);
    const held: HeldAnchor[] = [{ subject: "s", stamp: { ...chain[1]! } }];
    const view = createTrustView(held);
    const before = view.about("s", chain);

    // The casts are the point, not a workaround: `HeldAnchor` is `readonly`, so TypeScript
    // REFUSES to compile these mutations — the property is enforced at the type level for
    // any typed caller. The runtime snapshot is the second line of defence, for JS callers
    // that ignore types entirely. Both are tested because both are real.
    held.push({ subject: "s", stamp: { ...chain[3]! } });
    (held[0]!.stamp as { phase: number }).phase = 99;
    (held[0] as { subject: string }).subject = "someone-else";

    expect(view.about("s", chain)).toEqual(before);
  });

  test("conversely a changed ARGUMENT does change the verdict — as a pure function must", () => {
    const chain = honestChain(0, COMMON_SEED, 3);
    const view = createTrustView([{ subject: "s", stamp: { ...chain[1]! } }]);
    const honest = view.about("s", chain);
    const forged = [...chain];
    forged[3] = stamp(3, chain[3]!.seed ^ 0xff);
    expect(view.about("s", forged)).not.toEqual(honest);
  });
});

describe("property 2 — HEADLINE: two nodes disagree, and both are correct", () => {
  test("different histories yield different verdicts about the same subject", () => {
    const chain = honestChain(0, COMMON_SEED, 6);

    // Node A witnessed the subject recently; node B only saw it long ago.
    const recent = createTrustView([{ subject: "s", stamp: chain[5]! }]);
    const stale = createTrustView([{ subject: "s", stamp: chain[1]! }]);

    const vRecent = recent.about("s", chain);
    const vStale = stale.about("s", chain);

    expect(vRecent).not.toEqual(vStale);

    // Both are CORRECT: each reports the true depth from its own anchor.
    const depthOf = (v: typeof vRecent) =>
      v.signals.find((s) => s.kind === "shared-anchor") as { depth: number } | undefined;
    expect(depthOf(vRecent)!.depth).toBe(1); // chain[5] -> chain[6]
    expect(depthOf(vStale)!.depth).toBe(5); // chain[1] -> chain[6]
  });

  test("a third node with no history reports absence, not distrust", () => {
    const chain = honestChain(0, COMMON_SEED, 3);
    const stranger = createTrustView([]);
    expect(stranger.about("s", chain).signals).toEqual([{ kind: "no-evidence" }]);
  });
});

describe("property 3 — spectrum, never a verdict", () => {
  test("no Friend/Enemy/trusted field exists anywhere in the output", () => {
    const chain = honestChain(0, COMMON_SEED, 3);
    const v = createTrustView([{ subject: "s", stamp: chain[0]! }]).about("s", chain);
    const json = JSON.stringify(v).toLowerCase();
    for (const forbidden of ["friend", "enemy", "trusted", "untrusted", "sybil", "score"]) {
      expect(json).not.toContain(forbidden);
    }
  });

  test("an honest continuation reports chain-verified with its span", () => {
    const chain = honestChain(0, COMMON_SEED, 4);
    const v = createTrustView([{ subject: "s", stamp: chain[0]! }]).about("s", chain);
    expect(v.signals.some((s) => s.kind === "chain-verified")).toBe(true);
  });

  test("a tampered continuation reports chain-broken WITH THE REASON, not a rejection", () => {
    const chain = honestChain(0, COMMON_SEED, 3);
    const forged = [...chain];
    forged[3] = stamp(3, chain[3]!.seed ^ 0xff);
    const v = createTrustView([{ subject: "s", stamp: chain[0]! }]).about("s", forged);
    const broken = v.signals.find((s) => s.kind === "chain-broken") as
      | { reason: string }
      | undefined;
    expect(broken?.reason).toBe("seed-mismatch");
  });

  test("recency is the strength measure — depth grows as the anchor goes stale", () => {
    const chain = honestChain(0, COMMON_SEED, 8);
    const depth = (i: number) => {
      const v = createTrustView([{ subject: "s", stamp: chain[i]! }]).about("s", chain);
      return (v.signals.find((s) => s.kind === "shared-anchor") as { depth: number }).depth;
    };
    expect(depth(7)).toBeLessThan(depth(2));
  });
});

describe("property 4 — open-keyed: no registry, no persona required", () => {
  test("an arbitrary locally-minted identifier works identically", () => {
    const chain = honestChain(0, COMMON_SEED, 3);
    for (const id of ["did:zeta:9f2a", "0xdeadbeef", "someone-nobody-registered", "🜁"]) {
      const v = createTrustView([{ subject: id, stamp: chain[0]! }]).about(id, chain);
      expect(v.subject).toBe(id);
      expect(v.signals.some((s) => s.kind === "shared-anchor")).toBe(true);
    }
  });

  test("subjects are isolated — an anchor for one says nothing about another", () => {
    const chain = honestChain(0, COMMON_SEED, 3);
    const view = createTrustView([{ subject: "alice", stamp: chain[0]! }]);
    expect(view.about("bob", chain).signals).toEqual([{ kind: "no-evidence" }]);
  });
});

describe("property 5 — no global assembly", () => {
  test("the view exposes no way to enumerate subjects", () => {
    const view = createTrustView([{ subject: "s", stamp: stamp(0, COMMON_SEED) }]);
    expect(Object.keys(view)).toEqual(["about"]);
  });
});

describe("slice 1b — diffTrustView: the disagreement is the product", () => {
  test("reports what each side knows that the other does not", () => {
    const c = honestChain(0, COMMON_SEED, 5);
    const mine: HeldAnchor[] = [c[1]!, c[2]!].map((s) => ({ subject: "s", stamp: s }));
    const theirs: HeldAnchor[] = [c[2]!, c[4]!].map((s) => ({ subject: "s", stamp: s }));
    const d = diffTrustView(mine, theirs, "s");
    expect(d.theyKnowWeDoNot).toEqual([4]);
    expect(d.weKnowTheyDoNot).toEqual([1]);
  });

  test("ASYMMETRIC on purpose — swapping the arguments answers a different question", () => {
    const c = honestChain(0, COMMON_SEED, 4);
    const mine: HeldAnchor[] = [{ subject: "s", stamp: c[1]! }];
    const theirs: HeldAnchor[] = [{ subject: "s", stamp: c[3]! }];
    const ab = diffTrustView(mine, theirs, "s");
    const ba = diffTrustView(theirs, mine, "s");
    expect(ab.theyKnowWeDoNot).toEqual(ba.weKnowTheyDoNot);
    expect(ab).not.toEqual(ba);
  });

  test("identical histories produce an empty diff — nothing to learn, not agreement", () => {
    const c = honestChain(0, COMMON_SEED, 3);
    const same: HeldAnchor[] = [{ subject: "s", stamp: c[2]! }];
    const d = diffTrustView(same, same, "s");
    expect(d.theyKnowWeDoNot).toEqual([]);
    expect(d.weKnowTheyDoNot).toEqual([]);
  });

  test("no conflict case exists in the type — differing is normal, not an error", () => {
    const c = honestChain(0, COMMON_SEED, 3);
    const d = diffTrustView(
      [{ subject: "s", stamp: c[0]! }],
      [{ subject: "s", stamp: c[2]! }],
      "s",
    );
    expect(Object.keys(d).sort()).toEqual(["subject", "theyKnowWeDoNot", "weKnowTheyDoNot"]);
  });
});
