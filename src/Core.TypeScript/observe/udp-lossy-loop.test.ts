import { describe, expect, test } from "bun:test";
import { type DuplexEndpoint, type Frame } from "../model-backend/duplex-transport.ts";
import { multiplexedDuplexTransport, type MuxFrame } from "../model-backend/multiplexed-duplex-transport.ts";
import {
  type PersonaFrame,
  type PersonaCtl,
  askPersona,
  awaitHello,
  interruptPersona,
  openPersona,
  servePersona,
} from "../model-backend/persona-transport.ts";
import { taggedBigIntJsonFrameCodec } from "../model-backend/web-socket-endpoint.ts";
import { inMemoryZetaStore } from "../model-backend/zeta-store.ts";
import type { ModelTurn } from "../model-backend/zeta-agent-loop.ts";
import type { ZetaId } from "../zeta-id/types.ts";
import type { DiscoveryTransport } from "../discovery/discovery-beacon.ts";
import type { BroadcastTransport } from "../discovery/llmtv-broadcast.ts";
import { cloudPersonaParticipant } from "./participant.ts";
import type { ISummon } from "../peer-call/summon.ts";

const pid = (n: bigint): ZetaId => n as ZetaId;

// -- Deterministic Lossy UDP Simulator (from gossip-salon.proof.test.ts) --
function createLossyDupMesh(delayMs: number) {
  const nodes: { id: string; handlers: ((t: string, f: string) => void)[] }[] = [];
  let clock = 0;
  let dropCounter = 0;
  const pending: { at: number; text: string; fromId: string }[] = [];

  const deliverDue = (upTo: number): void => {
    for (;;) {
      const idx = pending.findIndex((d) => d.at <= upTo);
      if (idx < 0) return;
      const [d] = pending.splice(idx, 1);
      if (!d) return;
      for (const n of nodes) if (n.id !== d.fromId) for (const h of n.handlers) h(d.text, d.fromId);
    }
  };

  return {
    attach(id: string): DiscoveryTransport & BroadcastTransport {
      const self = { id, handlers: [] as ((t: string, f: string) => void)[] };
      nodes.push(self);
      const send = (text: string): void => {
        dropCounter += 1;
        const w = (dropCounter * 2654435761) % 4294967296;
        if (w % 7 === 0 || w % 7 === 1) return; // ~29% drop
        pending.push({ at: clock + delayMs, text, fromId: id });
        if (w % 5 === 3) pending.push({ at: clock + delayMs * 2, text, fromId: id }); // ~20% dup
      };
      return {
        broadcast: send,
        publish: send,
        onMessage: (h) => self.handlers.push(h),
        onFrame: (h) => self.handlers.push(h),
      };
    },
    async advance(ms: number): Promise<void> {
      const target = clock + ms;
      for (;;) {
        let nextDelivery = Infinity;
        for (const d of pending) nextDelivery = Math.min(nextDelivery, d.at);
        if (nextDelivery > target) {
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 0);
          });
          nextDelivery = Infinity;
          for (const d of pending) nextDelivery = Math.min(nextDelivery, d.at);
          if (nextDelivery > target) break;
        }
        clock = nextDelivery;
        deliverDue(clock);
      }
      clock = target;
      deliverDue(clock);
    },
  };
}

// -- Adapter: Broadcast UDP Mesh -> DuplexEndpoint --
function meshDuplexAdapter(meshAttach: DiscoveryTransport & BroadcastTransport): DuplexEndpoint<MuxFrame, never> {
  const codec = taggedBigIntJsonFrameCodec<MuxFrame, never>();
  const queue: Frame<MuxFrame, never>[] = [];
  const waiters: ((r: IteratorResult<Frame<MuxFrame, never>>) => void)[] = [];
  meshAttach.onMessage((text: string) => {
    const parsed = codec.decode(text);
    if (parsed === null) return;
    const w = waiters.shift();
    if (w) w({ value: parsed, done: false });
    else queue.push(parsed);
  });
  return {
    send: (frame) => {
      meshAttach.publish(codec.encode(frame));
      return Promise.resolve();
    },
    inbound: async function* () {
      for (;;) {
        const next = queue.shift();
        if (next !== undefined) {
          yield next;
          continue;
        }
        const r = await new Promise<IteratorResult<Frame<MuxFrame, never>>>((res) => waiters.push(res));
        if (r.done) return;
        yield r.value;
      }
    },
  };
}

async function acceptN<TN, TF>(
  accepted: AsyncIterable<import("../model-backend/multiplexed-duplex-transport.ts").MuxChannel<TN, TF>>,
  n: number,
) {
  const out = [];
  for await (const c of accepted) {
    out.push(c);
    if (out.length >= n) break;
  }
  return out;
}

describe("Observe Event Loop over Lossy UDP Mesh Transport", () => {
  test("INTERRUPT: 'stop' signal crosses lossy wire and halts the real persona participant", async () => {
    const mesh = createLossyDupMesh(40); // 40ms wire delay

    // Attach Client and Server endpoints to the shared UDP broadcast mesh
    const clientMesh = mesh.attach("client");
    const serverMesh = mesh.attach("server");

    const epClient = meshDuplexAdapter(clientMesh);
    const epServer = meshDuplexAdapter(serverMesh);

    const clientTransport = multiplexedDuplexTransport<PersonaFrame, PersonaCtl>(epClient);
    const serverTransport = multiplexedDuplexTransport<PersonaFrame, PersonaCtl>(epServer);

    // Setup server loop gated by a promise to simulate a long-running turn
    let releaseGate: () => void = () => undefined;
    const gate = new Promise<void>((r) => (releaseGate = r));
    let turn1Started: () => void = () => undefined;
    const started = new Promise<void>((r) => (turn1Started = r));

    let turnCalls = 0;
    const turn: ModelTurn = () => {
      turnCalls++;
      if (turnCalls === 1) {
        turn1Started();
        // Wait on the gate, simulating a long-running tool execution
        return gate.then(() => ({
          ok: true as const,
          text: "",
          calls: [{ name: "long_running", callId: "c1", arguments: {} }],
        }));
      }
      return Promise.resolve({ ok: true as const, text: "too late", calls: [] });
    };

    // The Server starts serving the persona
    const serverPromise = (async () => {
      const [serverCh] = await acceptN(serverTransport.accepted, 1);
      if (!serverCh) throw new Error("peer channel not accepted");
      const store = inMemoryZetaStore();
      await servePersona(serverCh, { name: "UniversalGrammarPersona", systemPrompt: "UG" }, pid(1n), turn, store);
    })();

    // Provide a mocked ISummon to the Participant to bind it directly to the multiplexer over UDP
    let lastCh: import("../model-backend/multiplexed-duplex-transport.ts").MuxChannel<PersonaFrame, PersonaCtl> | null =
      null;
    let lastSummonError = "";
    const testSummoner: ISummon = {
      summon: async (_personaName, prompt, _opts) => {
        const ch = clientTransport.open();
        lastCh = ch;
        await openPersona(ch);

        const hello = await awaitHello(ch);
        if (!hello.ok) throw new Error("Handshake failed: " + hello.error);

        const reply = await askPersona(ch, prompt);
        if (reply.kind === "error") {
          lastSummonError = reply.error;
          return { success: false, exitCode: 2, outputFile: "", stdout: "", stderr: reply.error };
        }
        const stdout = reply.kind === "answer" ? reply.content : "";
        return { success: true, exitCode: 0, outputFile: "", stdout, stderr: "" };
      },
    };

    const participant = cloudPersonaParticipant(testSummoner, "UniversalGrammarPersona");

    // Client begins the choose event loop
    const menu: import("../observe/observe.ts").NextAction[] = [{ kind: "explore", reason: "test-nav" }];
    const choosePromise = participant.choose({ backlog: [], mode: "explore" }, menu);

    // Pump mesh for initial prompt delivery
    await mesh.advance(300);

    // Wait until the server turn function has explicitly started executing
    await started;

    // Send the interrupt signal
    if (!lastCh) throw new Error("Summoner did not yield a channel");
    await interruptPersona(lastCh);

    // Pump mesh to let the interrupt signal cross the lossy wire
    await mesh.advance(200);

    // Tool completes -> loop reaches next turn boundary -> aborted by the interrupt that crossed the wire
    releaseGate();
    await mesh.advance(100);

    const result = await choosePromise;

    // Because the persona was interrupted, the cloudPersonaParticipant returns a fallback error index
    expect(result.fallback).toBe(true);
    expect(result.raw).toBe("summon-error:2");
    expect(lastSummonError).toContain("interrupted (feedback corner)");
    expect(turnCalls).toBe(1); // Ensure turn 2 was never reached!

    // Teardown
    await epClient.send({ channel: "close" });
    await epServer.send({ channel: "close" });
    await mesh.advance(100);
    await serverPromise;
  });
});
