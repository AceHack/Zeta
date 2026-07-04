// persona-transport.ts — summon over the mux: personas as four-corner channels (shadow*).
//
// Aaron 2026-07-04: "yes, this is a persona transport exactly." The capstone that JOINS the two proven
// arcs: the summon (auto-refresh + closed-surface tool loop over the subscription, zeta-summon.ts) now
// rides a ZetaId-keyed four-corner channel (multiplexed-duplex-transport.ts) instead of being a bare
// function call. What that buys, concretely:
//   - N personas over ONE physical transport, each on its own self-describing ZetaId channel;
//   - the FEEDBACK CORNER is live: a "stop" pushed up the feedback wire interrupts the persona's
//     tool loop BETWEEN TURNS — the mutually-interruptible conversation chat-completions cannot do;
//   - the OpenAI backend stays the degenerate fill inside (the extraction projection, unchanged) —
//     drop this onto a Reticulum link later and nothing above the DuplexEndpoint port moves.
//
// HONEST SCOPE: the interrupt aborts the agent loop at the next turn boundary (before the next model
// round-trip) — it does not cancel an HTTP request already in flight (the injected transport exposes no
// abort; a fetch-abort fill is a later slice). So "mid-conversation interruption" is real (multi-turn tool
// loops stop early, the wire answer says so); "mid-token cancellation" is not claimed. Noninterference §13:
// everything injected (turn, store, channel) — fake-testable, NO network, NO secret in tests.

import type { ChatMessage } from "./backend.ts";
import type { ModelTurn, LoopOutcome } from "./zeta-agent-loop.ts";
import { runToolLoop } from "./zeta-agent-loop.ts";
import type { ZetaStore } from "./zeta-store.ts";
import type { Persona, SummonDeps } from "./zeta-summon.ts";
import { refreshingCodexTurn } from "./zeta-summon.ts";
import type { MuxChannel } from "./multiplexed-duplex-transport.ts";

/// The persona wire protocol (the channel's normal payload, both directions).
export type PersonaFrame =
  | { readonly kind: "user"; readonly content: string }
  | { readonly kind: "answer"; readonly content: string; readonly turns: number }
  | { readonly kind: "error"; readonly error: string };

/// The feedback-corner control signal: "stop" interrupts the running tool loop at the next turn boundary.
export type PersonaCtl = "stop";

/// Wrap a ModelTurn so it aborts (cleanly, Result-style) when `interrupted()` is true — checked BEFORE each
/// model round-trip, so a multi-turn tool loop stops at the next turn boundary. Never throws.
export function interruptibleTurn(turn: ModelTurn, interrupted: () => boolean): ModelTurn {
  return (input) => {
    if (interrupted()) return Promise.resolve({ ok: false as const, error: "interrupted (feedback corner)" });
    return turn(input);
  };
}

/// Serve a persona on a mux channel: for each inbound `user` frame, run the tool loop (persona system
/// prompt first, same as `summon`) and send back `answer`/`error`. A "stop" on the feedback corner
/// interrupts the CURRENT loop at its next turn boundary; the flag resets so the next message runs fresh.
/// Resolves when the channel's normal stream ends (transport closed). Everything injected.
export async function servePersona(channel: MuxChannel<PersonaFrame, PersonaCtl>, persona: Persona, turn: ModelTurn, store: ZetaStore, maxTurns = 8): Promise<void> {
  let stopRequested = false;
  // watch the feedback corner — the live interrupt wire.
  // (PersonaCtl is currently only "stop", so ANY feedback signal interrupts; branch when the union widens.)
  // (PersonaCtl is only "stop" today, so every arriving signal interrupts; branch on the value when the
  //  union widens — for now consume the iterator directly to keep the single-member union lint-honest.)
  const feedback = channel.wire.feedbackIn[Symbol.asyncIterator]();
  const watch = (async () => {
    while (!(await feedback.next()).done) stopRequested = true;
  })();
  const guarded = interruptibleTurn(turn, () => stopRequested);
  for await (const frame of channel.wire.normalIn) {
    if (frame.kind !== "user") continue; // a server only acts on user frames
    stopRequested = false; // each message starts un-interrupted
    const messages: ChatMessage[] = [
      { role: "system", content: persona.systemPrompt },
      { role: "user", content: frame.content },
    ];
    const out: LoopOutcome = await runToolLoop(guarded, store, messages, maxTurns);
    await channel.wire.sendNormal(out.ok ? { kind: "answer", content: out.content, turns: out.turns } : { kind: "error", error: out.error });
  }
  await watch;
}

/// Serve a persona over the SUBSCRIPTION on a mux channel — the production wiring: the auto-refreshing
/// codex turn (stored token, 401→refresh→retry) + the deps' ZetaStore. `servePersona` with the real fill.
export function serveSubscriptionPersona(channel: MuxChannel<PersonaFrame, PersonaCtl>, persona: Persona, deps: SummonDeps): Promise<void> {
  return servePersona(channel, persona, refreshingCodexTurn(deps), deps.zetaStore, deps.maxTurns);
}

/// Client side: ask the persona on this channel one question and await its reply frame (answer or error).
/// (Single-consumer note: the caller owns the channel's normalIn — ask sequentially, not concurrently.)
export async function askPersona(channel: MuxChannel<PersonaFrame, PersonaCtl>, content: string): Promise<PersonaFrame> {
  await channel.wire.sendNormal({ kind: "user", content });
  for await (const frame of channel.wire.normalIn) {
    if (frame.kind === "answer" || frame.kind === "error") return frame;
  }
  return { kind: "error", error: "channel closed before a reply arrived" };
}

/// Client side: interrupt the persona's current loop — a "stop" up the feedback corner.
export function interruptPersona(channel: MuxChannel<PersonaFrame, PersonaCtl>): Promise<void> {
  return channel.wire.feedbackOut.push("stop");
}
