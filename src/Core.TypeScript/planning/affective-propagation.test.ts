import { describe, it, expect } from "bun:test";
import {
  createNetwork, addAgent, addEdge, propagate, propagateN,
  meanState, emotionalEntropy, neutralState
} from "./affective-propagation";

describe("Affective Propagation (Friedkin-Johnsen)", () => {
  it("AP-1: neutral network stays neutral (stubbornness anchor at 0)", () => {
    let net = createNetwork();
    net = addAgent(net, "A", neutralState());
    net = addAgent(net, "B", neutralState());
    net = addEdge(net, "A", "B", 1.0);
    net = addEdge(net, "B", "A", 1.0);
    net = propagateN(net, 10);
    const mean = meanState(net);
    expect(mean.valence).toBeCloseTo(0.0, 6);
    expect(mean.arousal).toBeCloseTo(0.0, 6);
  });

  it("AP-2: positive agent spreads valence to neutral neighbor", () => {
    let net = createNetwork();
    net = addAgent(net, "A", { valence: 1.0, arousal: 0.0 });
    net = addAgent(net, "B", { valence: 0.0, arousal: 0.0 });
    net = addEdge(net, "A", "B", 1.0);
    net = propagate(net);
    const b = net.agents.get("B")!;
    expect(b.state.valence).toBeGreaterThan(0.0);
  });

  it("AP-3: high-trust source propagates MORE strongly than low-trust source (Friedkin-Johnsen fix)", () => {
    // Friedkin-Johnsen: trust has ABSOLUTE effect (no row-normalisation).
    // A lone untrusted source should move B less than a lone trusted source.

    // netLow: A has trustWeight=0.1 → B receives little influence
    let netLow = createNetwork();
    netLow = addAgent(netLow, "A", { valence: 1.0, arousal: 0.0 }, 0.1, 0.5); // low trust
    netLow = addAgent(netLow, "B", { valence: 0.0, arousal: 0.0 }, 0.5, 0.5);
    netLow = addEdge(netLow, "A", "B", 1.0);
    netLow = propagate(netLow);

    // netHigh: A has trustWeight=0.9 → B receives strong influence
    let netHigh = createNetwork();
    netHigh = addAgent(netHigh, "A", { valence: 1.0, arousal: 0.0 }, 0.9, 0.5); // high trust
    netHigh = addAgent(netHigh, "B", { valence: 0.0, arousal: 0.0 }, 0.5, 0.5);
    netHigh = addEdge(netHigh, "A", "B", 1.0);
    netHigh = propagate(netHigh);

    const bLow = netLow.agents.get("B")!.state.valence;
    const bHigh = netHigh.agents.get("B")!.state.valence;

    // Both should be positive (A's valence propagates to B)
    expect(bLow).toBeGreaterThan(0.0);
    expect(bHigh).toBeGreaterThan(0.0);

    // HIGH TRUST should produce STRICTLY MORE influence than LOW TRUST
    // This is the Friedkin-Johnsen fix: trust has absolute effect.
    expect(bHigh).toBeGreaterThan(bLow);

    // Verify the exact values:
    // bLow = openness_B * W_AB * trust_A * v_A + (1-openness_B) * v_B(0)
    //      = 0.5 * 1.0 * 0.1 * 1.0 + 0.5 * 0.0 = 0.05
    // bHigh = 0.5 * 1.0 * 0.9 * 1.0 + 0.5 * 0.0 = 0.45
    expect(bLow).toBeCloseTo(0.05, 10);
    expect(bHigh).toBeCloseTo(0.45, 10);
  });

  it("AP-4: stubbornness anchor prevents full convergence", () => {
    // With openness=0.5, agent B anchors to its initial valence=0.
    // Even after many ticks with a positive neighbor, B should not reach 1.0.
    let net = createNetwork();
    net = addAgent(net, "A", { valence: 1.0, arousal: 0.0 }, 1.0, 0.5);
    net = addAgent(net, "B", { valence: 0.0, arousal: 0.0 }, 0.5, 0.5);
    net = addEdge(net, "A", "B", 1.0);
    net = propagateN(net, 100);
    const b = net.agents.get("B")!.state.valence;
    // B should be positive but less than 1.0 (stubbornness holds it back)
    expect(b).toBeGreaterThan(0.0);
    expect(b).toBeLessThan(1.0);
  });

  it("AP-5: valence is clamped to [-1, 1]", () => {
    let net = createNetwork();
    net = addAgent(net, "A", { valence: 1.0, arousal: 1.0 }, 1.0, 1.0);
    net = addAgent(net, "B", { valence: 1.0, arousal: 1.0 }, 1.0, 1.0);
    net = addEdge(net, "A", "B", 10.0);
    net = propagateN(net, 20);
    for (const agent of net.agents.values()) {
      expect(agent.state.valence).toBeLessThanOrEqual(1.0);
      expect(agent.state.valence).toBeGreaterThanOrEqual(-1.0);
    }
  });

  it("AP-6: tick counter increments", () => {
    let net = createNetwork();
    net = addAgent(net, "A");
    net = propagateN(net, 5);
    expect(net.tick).toBe(5);
  });

  it("AP-7: emotionalEntropy is 0 for uniform state", () => {
    let net = createNetwork();
    for (let i = 0; i < 5; i++) net = addAgent(net, `A${i}`, { valence: 0.5, arousal: 0.0 });
    const entropy = emotionalEntropy(net);
    expect(entropy).toBeCloseTo(0.0, 1);
  });

  it("AP-8: emotionalEntropy > 0 for diverse states", () => {
    let net = createNetwork();
    net = addAgent(net, "A", { valence: -0.8, arousal: 0.0 });
    net = addAgent(net, "B", { valence: 0.0, arousal: 0.0 });
    net = addAgent(net, "C", { valence: 0.8, arousal: 0.0 });
    const entropy = emotionalEntropy(net);
    expect(entropy).toBeGreaterThan(0.0);
  });

  it("AP-9: zero openness = fully stubborn (no influence)", () => {
    let net = createNetwork();
    net = addAgent(net, "A", { valence: 1.0, arousal: 0.0 }, 1.0, 0.5);
    net = addAgent(net, "B", { valence: 0.0, arousal: 0.0 }, 0.5, 0.0); // openness=0
    net = addEdge(net, "A", "B", 1.0);
    net = propagateN(net, 10);
    const b = net.agents.get("B")!.state.valence;
    expect(b).toBeCloseTo(0.0, 10);  // stays at initial valence
  });

  it("AP-10: full openness = fully susceptible (no stubbornness)", () => {
    let net = createNetwork();
    net = addAgent(net, "A", { valence: 1.0, arousal: 0.0 }, 1.0, 0.5);
    net = addAgent(net, "B", { valence: 0.0, arousal: 0.0 }, 0.5, 1.0); // openness=1
    net = addEdge(net, "A", "B", 1.0);
    net = propagate(net);
    const b = net.agents.get("B")!.state.valence;
    // openness=1: v_B = 1.0 * W * trust_A * v_A + 0 * v_B(0) = 1.0 * 1.0 * 1.0 * 1.0 = 1.0
    expect(b).toBeCloseTo(1.0, 10);
  });
});
