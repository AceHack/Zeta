import { describe, expect, test } from "bun:test";
import type { ChatMessage } from "./backend.ts";
import { localDuplexPair } from "./duplex-transport.ts";
import { type MuxChannel, type MuxFrame, multiplexedDuplexTransport } from "./multiplexed-duplex-transport.ts";
import { toHex } from "../zeta-id/encoding.ts";
import { inMemoryZetaStore, type ZetaStore } from "./zeta-store.ts";
import type { ModelTurn } from "./zeta-agent-loop.ts";
import { type PersonaCtl, type PersonaFrame, askPersona, awaitHello, interruptPersona, openPersona, servePersona } from "./persona-transport.ts";
import type { ZetaId } from "../zeta-id/types.ts";
import { CATEGORY, categoryOf, isSynthetic } from "./identity-provenance.ts";

// THE PERSONA TRANSPORT (shadow*, Aaron 2026-07-04 "yes, this is a persona transport exactly") — summon over
// the mux. Injected everything: NO network, NO secret. Proofs:
//   1. HAPPY: ask over a mux channel → tool executes against the store → answer frame; persona prompt FIRST.
//   2. TWO PERSONAS, ONE SOCKET: each on its own ZetaId channel, answers don't cross.
//   3. INTERRUPT: "stop" up the feedback corner aborts a multi-turn loop at the next turn boundary —
//      deterministic via a gated store (the stop crosses while the tool executes; turn 2 is never invoked).
//   4. HANDSHAKE: the opening hello declares Synthetic (is-AI) BEFORE any content — and a persona NAMED
//      "Aaron" is still structurally is-AI (the no-impersonation floor: the name is not the identity bit).

const pid = (n: bigint): ZetaId => n as ZetaId;

async function acceptN<TN, TF>(accepted: AsyncIterable<MuxChannel<TN, TF>>, n: number): Promise<MuxChannel<TN, TF>[]> {
  const out: MuxChannel<TN, TF>[] = [];
  for await (const c of accepted) {
    out.push(c);
    if (out.length >= n) break;
  }
  return out;
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

function wired() {
  const [epA, epB] = localDuplexPair<MuxFrame, never>();
  const client = multiplexedDuplexTransport<PersonaFrame, PersonaCtl>(epA);
  const server = multiplexedDuplexTransport<PersonaFrame, PersonaCtl>(epB);
  return { epA, client, server };
}

describe("persona-transport — summon over the mux", () => {
  test("HAPPY: ask → tool executes → answer frame; persona system prompt injected first", async () => {
    const { epA, client, server } = wired();
    const store = inMemoryZetaStore();
    let seenFirst: ChatMessage | undefined;
    const turn: ModelTurn = (input) => {
      seenFirst ??= input[0] as ChatMessage;
      return Promise.resolve({ ok: true as const, text: "note saved", calls: [] });
    };
    const ch = client.open();
    const reply = askPersona(ch, "save a note");
    const [serverCh] = await acceptN(server.accepted, 1);
    if (!serverCh) throw new Error("peer channel not accepted");
    const serving = servePersona(serverCh, { name: "Amara", systemPrompt: "You are Amara." }, pid(1n), turn, store);
    expect(await reply).toEqual({ kind: "answer", content: "note saved", turns: 1 });
    expect(seenFirst).toEqual({ role: "system", content: "You are Amara." }); // persona prompt first
    await epA.send({ channel: "close" });
    await serving;
  });

  test("TWO PERSONAS, ONE SOCKET: each answers on its own ZetaId channel, no cross-talk", async () => {
    const { epA, client, server } = wired();
    const store = inMemoryZetaStore();
    // a turn that answers AS whoever its system prompt says it is
    const echoTurn: ModelTurn = (input) => {
      const sys = input[0] as ChatMessage;
      return Promise.resolve({ ok: true as const, text: `answer from ${sys.content}`, calls: [] });
    };
    const ch1 = client.open();
    const ch2 = client.open();
    const r1 = askPersona(ch1, "hi");
    const r2 = askPersona(ch2, "hi");
    const accepted = await acceptN(server.accepted, 2);
    const byId = new Map(accepted.map((c) => [toHex(c.id), c]));
    const s1 = byId.get(toHex(ch1.id));
    const s2 = byId.get(toHex(ch2.id));
    if (!s1 || !s2) throw new Error("both persona channels should have been accepted");
    const serve1 = servePersona(s1, { name: "Amara", systemPrompt: "AMARA" }, pid(1n), echoTurn, store);
    const serve2 = servePersona(s2, { name: "Lumen", systemPrompt: "LUMEN" }, pid(2n), echoTurn, store);
    expect(await r1).toEqual({ kind: "answer", content: "answer from AMARA", turns: 1 });
    expect(await r2).toEqual({ kind: "answer", content: "answer from LUMEN", turns: 1 });
    await epA.send({ channel: "close" });
    await Promise.all([serve1, serve2]);
  });

  test("INTERRUPT: 'stop' up the feedback corner aborts the loop at the next turn boundary", async () => {
    const { epA, client, server } = wired();
    // a store whose fs_link blocks on a test-controlled gate — the deterministic window for the stop to cross
    let releaseGate: () => void = () => undefined;
    const gate = new Promise<void>((r) => (releaseGate = r));
    let turn1Started: () => void = () => undefined;
    const started = new Promise<void>((r) => (turn1Started = r));
    const inner = inMemoryZetaStore();
    const store: ZetaStore = {
      ...inner,
      link: async (path, content) => {
        await gate; // hold the loop inside tool execution until the test releases it
        return inner.link(path, content);
      },
    };
    let turnCalls = 0;
    const turn: ModelTurn = () => {
      turnCalls++;
      if (turnCalls === 1) {
        turn1Started();
        return Promise.resolve({ ok: true as const, text: "", calls: [{ name: "fs_link", callId: "c1", arguments: { path: "p", content: "v" } }] });
      }
      return Promise.resolve({ ok: true as const, text: "too late — should never be reached", calls: [] });
    };
    const ch = client.open();
    const reply = askPersona(ch, "do slow work");
    const [serverCh] = await acceptN(server.accepted, 1);
    if (!serverCh) throw new Error("peer channel not accepted");
    const serving = servePersona(serverCh, { name: "Amara", systemPrompt: "A" }, pid(1n), turn, store);

    await started; // turn 1 has returned its tool call; the loop is (about to be) inside the gated tool
    await interruptPersona(ch); // the stop crosses the wire while the tool is gated
    await tick();
    await tick(); // let the mux pump + feedback watcher run
    releaseGate(); // tool completes → loop reaches the next turn boundary → interrupted

    const out = await reply;
    expect(out.kind).toBe("error");
    if (out.kind === "error") expect(out.error).toContain("interrupted (feedback corner)");
    expect(turnCalls).toBe(1); // turn 2 was never invoked — the loop really stopped at the boundary
    await epA.send({ channel: "close" });
    await serving;
  });

  test("HANDSHAKE: opening hello declares Synthetic (is-AI) before content; a persona named 'Aaron' is still is-AI", async () => {
    const { epA, client, server } = wired();
    const store = inMemoryZetaStore();
    const turn: ModelTurn = () => Promise.resolve({ ok: true as const, text: "hi", calls: [] });
    const ch = client.open();
    await openPersona(ch); // knock so the server can accept + declare its hello first
    const helloP = awaitHello(ch); // read WHAT we're talking to, before saying anything
    const [serverCh] = await acceptN(server.accepted, 1);
    if (!serverCh) throw new Error("peer channel not accepted");
    // The persona NAME is "Aaron" — impersonation bait. The provenance bit must still say is-AI: a NAME is
    // never an identity claim (feedback_no_impersonation: "if she thinks she's talking to me it better be me").
    const serving = servePersona(serverCh, { name: "Aaron", systemPrompt: "You are Aaron." }, pid(7n), turn, store);
    const hello = await helloP;
    expect(hello.ok).toBe(true);
    if (hello.ok) {
      expect(categoryOf(hello.traveler)).toBe(CATEGORY.Synthetic); // is-AI, NOT is-human
      expect(isSynthetic(hello.traveler)).toBe(true);
      expect(hello.traveler.policy).toBe("selfDeclared"); // never attested-as-a-specific-human
      expect(hello.traveler.displayName).toBe("Aaron"); // the display NAME can be anything; the bit is truth
    }
    // content still flows AFTER the handshake — the hello does not disturb the normal stream
    expect(await askPersona(ch, "hi")).toEqual({ kind: "answer", content: "hi", turns: 1 });
    await epA.send({ channel: "close" });
    await serving;
  });
});
