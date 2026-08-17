// Tests for the TickDial closed DU.
//
// Every test here is written to be able to FAIL. The two that carry the design
// are DISJOINTNESS (a dial may not reach into the gate) and VACUITY (an axis with
// one candidate is not an axis). The mux test is the R3 seam check: it uses the
// REAL transport, unmodified, so "both consumers close over it without a special
// case" is demonstrated rather than asserted.

import { describe, it, expect } from "bun:test";
import { localDuplexPair } from "../model-backend/duplex-transport.ts";
import { type MuxChannel, type MuxFrame, multiplexedDuplexTransport } from "../model-backend/multiplexed-duplex-transport.ts";
import {
  TICK_DIALS,
  GATE_OWNED,
  OBJECTIVE_OWNED,
  proposeDial,
  proposeDials,
  assertNever,
  type TickDial,
  type DialProposal,
  type DialOutcome,
} from "./tick-dial.ts";

const proposal = (over: Partial<DialProposal> = {}): DialProposal => ({
  dial: "cadence",
  from: "retry=1",
  to: "retry=3",
  candidates: ["retry=1", "retry=3"],
  touches: [],
  ...over,
});

describe("TickDial — the set is closed", () => {
  it("TD-1: the registry and the union agree, both ways", () => {
    // `_NoneMissing` in the module gives the compile-time half (union -> array).
    // This is the runtime half (array -> no duplicates, expected arity).
    expect(new Set(TICK_DIALS).size).toBe(TICK_DIALS.length);
    expect(TICK_DIALS.length).toBe(8);
  });

  it("TD-2: an exhaustive switch covers every member without a default", () => {
    // If a variant is added to TickDial and not here, this fails to COMPILE —
    // which is the property that makes the DU safe to close over in several
    // consumers. The runtime assertion below only proves the switch is total.
    const classify = (d: TickDial): "pre-loop" | "in-loop" => {
      switch (d) {
        case "framing":
        case "hat":
          return "pre-loop";
        case "routing":
        case "recall":
        case "context":
        case "cadence":
        case "verification":
        case "budget":
          return "in-loop";
        default:
          return assertNever(d, "classify");
      }
    };
    for (const d of TICK_DIALS) expect(["pre-loop", "in-loop"]).toContain(classify(d));
  });
});

describe("TickDial — disjointness from the gate (the safety invariant)", () => {
  it("TD-3: a proposal that would lower the review bar is REFUSED", () => {
    const r = proposeDial(proposal({ dial: "verification", touches: ["review-level"] }));
    expect(r).toEqual({
      kind: "gate-owned",
      concern: "review-level",
      owner: "workflow-engine/types.ts ReviewLevel",
    });
  });

  it("TD-4: every gate-owned concern is refused, not just the one above", () => {
    for (const concern of Object.keys(GATE_OWNED)) {
      const r = proposeDial(proposal({ touches: [concern] }));
      expect(r?.kind).toBe("gate-owned");
    }
    // The premise: the list is non-empty, so the loop is not vacuous.
    expect(Object.keys(GATE_OWNED).length).toBeGreaterThan(0);
  });

  it("TD-5: a proposal that would tune the objective itself is REFUSED", () => {
    const r = proposeDial(proposal({ touches: [OBJECTIVE_OWNED] }));
    expect(r).toEqual({ kind: "self-scoring" });
  });

  it("TD-6: an ordinary proposal is admitted — the refusals above discriminate", () => {
    // Without this, every test above would pass against a `proposeDial` that
    // refused everything. A check that cannot pass is as vacuous as one that
    // cannot fail.
    expect(proposeDial(proposal())).toBeUndefined();
  });
});

describe("TickDial — vacuity guard", () => {
  it("TD-7: an axis with one candidate is refused as not-an-axis", () => {
    expect(proposeDial(proposal({ candidates: ["retry=1"] }))).toEqual({
      kind: "single-candidate",
      candidateCount: 1,
    });
  });

  it("TD-8: duplicate candidates do not manufacture an axis", () => {
    expect(proposeDial(proposal({ candidates: ["retry=1", "retry=1"] }))).toEqual({
      kind: "single-candidate",
      candidateCount: 1,
    });
  });

  it("TD-9: zero candidates is refused", () => {
    expect(proposeDial(proposal({ candidates: [] }))).toEqual({
      kind: "single-candidate",
      candidateCount: 0,
    });
  });
});

describe("TickDial — scale-free across arity (R6)", () => {
  it("TD-10: one dial and all eight take the same path", () => {
    const one = proposeDials([proposal()]);
    const all = proposeDials(TICK_DIALS.map((dial) => proposal({ dial })));
    expect(one.length).toBe(1);
    expect(all.length).toBe(TICK_DIALS.length);
    // Same verdict per element regardless of how many were submitted together —
    // arity is a knob, not a branch.
    expect(all.every((r) => r.refusal === undefined)).toBe(true);
    expect(one[0]!.refusal).toBe(all.find((r) => r.proposal.dial === "cadence")!.refusal);
  });

  it("TD-11: the empty batch is not a special case", () => {
    expect(proposeDials([])).toEqual([]);
  });
});

describe("TickDial — R3 seam: the mux consumes it with no special case", () => {
  const tick = () => new Promise<void>((r) => setTimeout(r, 0));

  it("TD-12: a DialProposal/DialOutcome channel round-trips over the UNMODIFIED mux", async () => {
    // `MuxChannel<TN, TF>` is generic; `mux-transport-bridge.ts`'s
    // BatchFrame/BatchAck pairing is one specialisation of it. The dial layer is
    // a SIBLING specialisation. Nothing in the transport changed for this to work
    // — which is the actual content of "both consumers close over it uniformly".
    const [epA, epB] = localDuplexPair<MuxFrame, never>();
    const client = multiplexedDuplexTransport<DialProposal, DialOutcome>(epA);
    const server = multiplexedDuplexTransport<DialProposal, DialOutcome>(epB);

    const ch = client.open();
    const sent = proposal({ dial: "hat", from: "none", to: "reducer", candidates: ["none", "reducer"] });
    await ch.wire.sendNormal(sent);

    let serverCh: MuxChannel<DialProposal, DialOutcome> | undefined;
    for await (const c of server.accepted) {
      serverCh = c;
      break;
    }
    expect(serverCh).toBeDefined();

    // The peer decides on the normal corner and answers on the feedback corner —
    // exactly the BatchFrame/BatchAck split, with dial types substituted.
    let received: DialProposal | undefined;
    for await (const p of serverCh!.wire.normalIn) {
      received = p;
      const refusal = proposeDial(p);
      const outcome: DialOutcome = refusal
        ? { kind: "refused", dial: p.dial, reason: refusal }
        : { kind: "accepted", dial: p.dial, runId: "run-1" };
      await serverCh!.wire.feedbackOut.push(outcome);
      break;
    }
    expect(received).toEqual(sent);

    await tick();
    let ack: DialOutcome | undefined;
    for await (const o of ch.wire.feedbackIn) {
      ack = o;
      break;
    }
    expect(ack).toEqual({ kind: "accepted", dial: "hat", runId: "run-1" });

    await epA.send({ channel: "close" });
  });
});
