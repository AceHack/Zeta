import { describe, expect, it } from "bun:test";
import type { DiscoveryTransport } from "./discovery-beacon";
import type { BroadcastTransport, SourceMind } from "./llmtv-broadcast";
import { foldReplayArtifact } from "./llmtv-replay";
import { createLlmtvLiveReplayBridge } from "./llmtv-live-replay-bridge";
import type { LlmtvNodeConfig, Scheduler } from "./llmtv-node";

interface FakeMesh {
  attach(id: string): DiscoveryTransport & BroadcastTransport;
  scheduler(): Scheduler;
  advance(ms: number): void;
}

function createFakeMesh(): FakeMesh {
  const nodes: Array<{ id: string; handlers: Array<(text: string, from: string) => void> }> = [];
  let clock = 0;
  let nextId = 0;
  const intervals: Array<{ ms: number; fn: () => void; last: number; id: number }> = [];

  return {
    attach(id) {
      const self = { id, handlers: [] as Array<(text: string, from: string) => void> };
      nodes.push(self);
      const send = (text: string): void => {
        for (const node of nodes) {
          if (node.id !== id) {
            for (const handler of node.handlers) handler(text, id);
          }
        }
      };
      return {
        broadcast: send,
        publish: send,
        onMessage: (handler) => self.handlers.push(handler),
        onFrame: (handler) => self.handlers.push(handler),
      };
    },
    scheduler() {
      return {
        now: () => clock,
        setInterval: (ms, fn) => {
          const id = ++nextId;
          intervals.push({ ms, fn, last: clock, id });
          return () => {
            const index = intervals.findIndex((interval) => interval.id === id);
            if (index >= 0) intervals.splice(index, 1);
          };
        },
      };
    },
    advance(ms) {
      const target = clock + ms;
      let guard = 0;
      for (;;) {
        let next = Infinity;
        for (const interval of intervals) {
          const at = interval.last + interval.ms;
          if (at <= target && at < next) next = at;
        }
        if (next === Infinity) break;
        clock = next;
        const firing = intervals.filter((interval) => interval.last + interval.ms === next);
        for (const interval of firing) interval.last = next;
        for (const interval of firing) interval.fn();
        if (++guard > 100_000) throw new Error("interval storm");
      }
      clock = target;
    },
  };
}

function mind(label: string): () => SourceMind {
  return () => ({
    role: "prediction",
    hat: `${label} hat`,
    required: [{ label, temp: "hot", valueMilli: 800, epsilonMilli: 100 }],
  });
}

function config(name: string): LlmtvNodeConfig {
  return {
    self: { persona: name, surface: "llmtv", instance: "0", node: "test" },
    zid: `zid-${name}`,
    routes: [{ kind: "udp", addr: `239.0.0.1:4200#${name}` }],
    source: { zid: `zid-${name}`, name },
    mind: mind(name),
    ttlMs: 10_000,
    helloEveryMs: 1_000,
    publishEveryMs: 1_000,
  };
}

describe("LLMTV live replay bridge", () => {
  it("records live self and peer broadcast frames into a replay artifact", () => {
    const mesh = createFakeMesh();
    const scheduler = mesh.scheduler();
    const alexaPort = mesh.attach("alexa");
    const sorayaPort = mesh.attach("soraya");
    const alexa = createLlmtvLiveReplayBridge(config("alexa"), alexaPort, alexaPort, scheduler);
    const soraya = createLlmtvLiveReplayBridge(config("soraya"), sorayaPort, sorayaPort, scheduler);

    alexa.node.start();
    soraya.node.start();
    mesh.advance(1_500);

    const artifact = alexa.artifact({ seed: "S4" });
    const replay = foldReplayArtifact(artifact);

    expect(artifact.generatedBy).toBe("llmtv-live-replay-bridge");
    expect(replay.stats.rejected).toBe(0);
    expect(replay.transcript.phaseClock).toMatchObject({
      schema: "zeta.darkhall.phase-clock.v1",
      basis: "seed-phase",
      seed: "S4",
      travelers: 2,
    });
    expect(replay.transcript.dwellers.map((dweller) => dweller.name).sort()).toEqual(["alexa", "soraya"]);
    expect(soraya.node.society("S4").dwellers.map((dweller) => dweller.name)).toEqual(["alexa"]);
  });

  it("can record only inbound peer frames when the local producer does not want self replay", () => {
    const mesh = createFakeMesh();
    const scheduler = mesh.scheduler();
    const alexaPort = mesh.attach("alexa");
    const sorayaPort = mesh.attach("soraya");
    const alexa = createLlmtvLiveReplayBridge(config("alexa"), alexaPort, alexaPort, scheduler, {
      recordOutbound: false,
    });
    const soraya = createLlmtvLiveReplayBridge(config("soraya"), sorayaPort, sorayaPort, scheduler);

    alexa.node.start();
    soraya.node.start();
    mesh.advance(1_500);

    expect(
      foldReplayArtifact(alexa.artifact({ seed: "S4" })).transcript.dwellers.map((dweller) => dweller.name),
    ).toEqual(["soraya"]);
  });

  it("drains a snapshot and clears the recorder for the next UI/readout tick", () => {
    const mesh = createFakeMesh();
    const scheduler = mesh.scheduler();
    const alexaPort = mesh.attach("alexa");
    const sorayaPort = mesh.attach("soraya");
    const alexa = createLlmtvLiveReplayBridge(config("alexa"), alexaPort, alexaPort, scheduler);
    const soraya = createLlmtvLiveReplayBridge(config("soraya"), sorayaPort, sorayaPort, scheduler);

    alexa.node.start();
    soraya.node.start();
    mesh.advance(1_500);
    const drained = alexa.drain({ seed: "S4", generatedBy: "test-drain" });

    expect(drained.generatedBy).toBe("test-drain");
    expect(drained.frames.length).toBeGreaterThan(0);
    expect(alexa.recorder.frames()).toEqual([]);

    mesh.advance(1_000);
    expect(alexa.recorder.frames().length).toBeGreaterThan(0);
  });
});
