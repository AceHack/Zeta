import { describe, test, expect } from "bun:test";
import {
  type Traveler,
  type PhaseStamp,
  type StandingRegister,
  crossVerifyRound,
  happenedBefore,
  concurrent,
} from "./traveler";

// ═══════════════════════════════════════════════════════════════════════
// THE PROOF that "time is not different from the other travelers" (Aaron
// 2026-07-08). Two DIFFERENT inhabitants of the SAME Traveler interface —
// TIME (a phase-clock) and an AGENT (alexa/otto/soraya) — go into one fleet
// and are cross-verified by ONE generic round with NO special case for time.
// If this compiles and the round treats them identically, "not different"
// holds by construction (interfaces-free: time needs no earned class).
// ═══════════════════════════════════════════════════════════════════════

const HLC = (local: number, peer: number): number => Math.max(local, peer) + 1;

/** TIME as a Traveler — the phase-clock's shape (phase + seed standing). */
function timeTraveler(id = "time", seed = 4): Traveler {
  let phase = 0;
  let s = seed;
  const xorshift = (x: number): number => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return x >>> 0;
  };
  return {
    id,
    standing(): StandingRegister {
      return { id, phase, extra: { seed: s } };
    },
    heartbeat(): PhaseStamp {
      phase += 1;
      s = xorshift(s);
      return { phase, derived: s };
    },
    observe(peer: PhaseStamp): PhaseStamp {
      phase = HLC(phase, peer.phase);
      s = xorshift(s);
      return { phase, derived: s };
    },
    stamp(): PhaseStamp {
      return { phase, derived: s };
    },
  };
}

/** An AGENT as a Traveler — identity + reliability standing, no seed. */
function agentTraveler(id: string): Traveler {
  let phase = 0;
  let heartbeats = 0;
  return {
    id,
    standing(): StandingRegister {
      return { id, phase, extra: { heartbeats, reliability: 1 } };
    },
    heartbeat(): PhaseStamp {
      phase += 1;
      heartbeats += 1;
      return { phase };
    },
    observe(peer: PhaseStamp): PhaseStamp {
      phase = HLC(phase, peer.phase);
      return { phase };
    },
    stamp(): PhaseStamp {
      return { phase };
    },
  };
}

describe("Traveler — time is not different (the interface proof)", () => {
  test("TIME and an AGENT both inhabit the SAME Traveler interface (structural)", () => {
    const time: Traveler = timeTraveler();
    const alexa: Traveler = agentTraveler("alexa");
    // Both typed as Traveler with no cast, no special case — this compiling
    // IS the type-level half of "not different".
    expect(time.id).toBe("time");
    expect(alexa.id).toBe("alexa");
    expect(time.stamp().phase).toBe(0);
    expect(alexa.stamp().phase).toBe(0);
  });

  test("a heterogeneous fleet (time + 3 agents) cross-verifies with NO isTime branch", () => {
    const alexa = agentTraveler("alexa");
    const otto = agentTraveler("otto");
    const soraya = agentTraveler("soraya");
    const time = timeTraveler("time");
    // One agent races ahead so there's a real leader to converge on.
    alexa.heartbeat();
    alexa.heartbeat();
    alexa.heartbeat(); // alexa at phase 3
    // Time is JUST ANOTHER element of the fleet array.
    const fleet: Traveler[] = [alexa, otto, soraya, time];

    const after = crossVerifyRound(fleet);
    // Every traveler — time included — converged onto the leader by the SAME
    // HLC rule (lead.phase 3 + 1 = 4). No element was special-cased.
    for (const s of after) {
      expect(s.phase).toBe(4);
    }
    // Time, queried directly, moved identically to the agents.
    expect(time.stamp().phase).toBe(4);
  });

  test("the round is agnostic to WHICH traveler is time — swap position, same result", () => {
    const runFleet = (timeIndex: number): number[] => {
      const a = agentTraveler("a");
      const b = agentTraveler("b");
      const c = agentTraveler("c");
      a.heartbeat();
      a.heartbeat();
      a.heartbeat(); // fixed leader: a at phase 3
      const fleet: Traveler[] = [a, b, c];
      fleet.splice(timeIndex, 0, timeTraveler("time"));
      return crossVerifyRound(fleet)
        .map((s) => s.phase)
        .sort((x, y) => x - y);
    };
    // Time at the front vs in the middle → identical phase multiset ([4,4,4,4]),
    // because nothing branches on time's position/identity.
    expect(runFleet(0)).toEqual(runFleet(2));
  });

  test("time's heartbeat and an agent's heartbeat advance the SAME causal counter", () => {
    const time = timeTraveler();
    const otto = agentTraveler("otto");
    expect(time.heartbeat().phase).toBe(1);
    expect(otto.heartbeat().phase).toBe(1);
    // both monotone
    expect(time.heartbeat().phase).toBe(2);
    expect(otto.heartbeat().phase).toBe(2);
  });

  test("causal order (happenedBefore/concurrent) is shared across traveler kinds", () => {
    const time = timeTraveler();
    const soraya = agentTraveler("soraya");
    time.heartbeat(); // phase 1
    const ts = time.stamp();
    const ss = soraya.stamp(); // phase 0
    expect(happenedBefore(ss, ts)).toBe(true); // agent(0) before time(1)
    expect(concurrent(ss, soraya.stamp())).toBe(true);
  });

  test("observe converges a traveler onto a peer ahead of it (HLC), same for both", () => {
    const time = timeTraveler();
    const agent = agentTraveler("x");
    const peerAhead: PhaseStamp = { phase: 10 };
    expect(time.observe(peerAhead).phase).toBe(11); // max(0,10)+1
    expect(agent.observe(peerAhead).phase).toBe(11); // identical rule
  });
});
