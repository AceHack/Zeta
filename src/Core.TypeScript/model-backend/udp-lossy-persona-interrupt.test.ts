/**
 * model-backend/udp-lossy-persona-interrupt.test.ts — the persona transport's
 * INTERRUPT contract, exercised over a lossy, duplicating, delayed wire.
 *
 * The claim under test is the transport's, not any caller's: an `interruptPersona`
 * signal sent while a turn is mid-flight crosses a ~29%-drop mesh, and the served
 * loop halts at the NEXT turn boundary — the in-flight tool call still completes,
 * turn 2 never starts, and the asker sees an error naming the feedback corner.
 *
 * ── WHY THIS FILE IS HERE AND NOT IN `observe/` ─────────────────────────────
 * It was one half of `observe/udp-lossy-loop.test.ts`, which reached into six
 * `model-backend/` modules plus `peer-call/summon` to assert two different
 * things at once: this transport claim, and `cloudPersonaParticipant`'s
 * fallback behaviour. Seven of the meta-harness's 38 measured back-edges were
 * that one file (`docs/research/2026-09-09-repo-split-round-4-*.md` §3.1).
 *
 * Splitting it is not bookkeeping: the participant half never needed a wire at
 * all — it needs an `ISummon` that fails, which is an object literal — and this
 * half never needed a participant, which was only ever the thing holding the
 * `askPersona` call. Each half now sits with its own subject and constructs
 * only what it is actually asserting about. The participant half is
 * `observe/cloud-persona-participant.test.ts`.
 */

import { describe, expect, test } from "bun:test";
import { type DuplexEndpoint, type Frame } from "./duplex-transport.ts";
import {
  multiplexedDuplexTransport,
  type MuxChannel,
  type MuxFrame,
} from "./multiplexed-duplex-transport.ts";
import {
  type PersonaFrame,
  type PersonaCtl,
  askPersona,
  awaitHello,
  interruptPersona,
  openPersona,
  servePersona,
} from "./persona-transport.ts";
import { taggedBigIntJsonFrameCodec } from "./web-socket-endpoint.ts";
import { inMemoryZetaStore } from "./zeta-store.ts";
import type { ModelTurn } from "./zeta-agent-loop.ts";
import type { ZetaId } from "../zeta-id/types.ts";
import { createLossyDupMesh } from "../discovery/lossy-broadcast-mesh.ts";

const pid = (n: bigint): ZetaId => n as ZetaId;

/** Broadcast mesh node -> the duplex endpoint the multiplexer speaks. */
function meshDuplexAdapter(meshAttach: {
  publish(text: string): void;
  onMessage(handler: (text: string, from: string) => void): void;
}): DuplexEndpoint<MuxFrame, never> {
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

async function acceptN<TN, TF>(accepted: AsyncIterable<MuxChannel<TN, TF>>, n: number) {
  const out = [];
  for await (const c of accepted) {
    out.push(c);
    if (out.length >= n) break;
  }
  return out;
}

describe("Persona transport over a lossy UDP mesh", () => {
  test("INTERRUPT: 'stop' crosses the lossy wire and halts the served loop at the next turn boundary", async () => {
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

    // Client side: open a channel, handshake, and ask — the shape a summoner drives.
    const ch = clientTransport.open();
    await openPersona(ch);

    let askError = "";
    const askPromise = (async () => {
      const hello = await awaitHello(ch);
      if (!hello.ok) throw new Error("Handshake failed: " + hello.error);
      const reply = await askPersona(ch, "0: explore");
      if (reply.kind === "error") askError = reply.error;
      return reply;
    })();

    // Pump mesh for handshake + initial prompt delivery
    await mesh.advance(300);

    // Wait until the server turn function has explicitly started executing
    await started;

    // Send the interrupt signal
    await interruptPersona(ch);

    // Pump mesh to let the interrupt signal cross the lossy wire
    await mesh.advance(200);

    // Tool completes -> loop reaches next turn boundary -> aborted by the interrupt that crossed the wire
    releaseGate();
    await mesh.advance(100);

    const reply = await askPromise;

    expect(reply.kind).toBe("error");
    expect(askError).toContain("interrupted (feedback corner)");
    expect(turnCalls).toBe(1); // Ensure turn 2 was never reached!

    // Teardown
    await epClient.send({ channel: "close" });
    await epServer.send({ channel: "close" });
    await mesh.advance(100);
    await serverPromise;
  });
});
