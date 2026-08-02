// four-corner.ts — the mutual-empowerment interface shape; chat-completions is its degenerate projection (shadow*).
//
// Aaron 2026-07-04: "chat completions are extraction-shaped (a HUMAN perspective: I prompt, it completes,
// I took something); ours will end up TRAVELER-shaped — mutual empowerment. The biggest difference is the
// FOUR-CORNER feedback system: two in and two out channels, one for normal flow and one for feedback flow,
// in BOTH directions." This module types that shape. It is deliberately PURE INTERFACE (no class, no state,
// no network) — interfaces are free; a class must be earned (rules/interfaces-free-classes-earned). The
// OpenAI `summon` path is NOT rewritten here; it is shown to be the feedback-free INSTANCE of this shape.
//
// The four corners (two duplex wires between two endpoints):
//   normal-out    forward payload  (client → server):  the prompt / messages
//   normal-in     forward payload  (server → client):  the completion / deltas
//   feedback-out  control signal   (client → server):  interrupt / steer / clear a running generation
//   feedback-in   control signal   (server → client):  backpressure / need-more / clarify mid-flight
//
// Chat-completions has ONLY the normal wire (normal-out + normal-in); the feedback wire is absent. So it is
// the projection of this interface where BOTH feedback sinks are the no-op sink. Drop the feedback corners
// and `Input<T,F> → Output<T,F>` collapses to `messages → completion`. This is the same "one is a special
// case of the other" discipline as the streaming primitive (`respond` = collect `respondStream`): the
// four-corner interface is the general shape; OpenAI fills only the normal corners. Future transports
// (Reticulum, the traveler mesh) fill the feedback corners; the type is four-corner from the start so the
// shape is right, with OpenAI as the degenerate fill.
//
// Anchors: full-duplex mutual interruption (Twilio `OutboundClearEvent`; MultiplexedWebSockets; HEAT
// backpressure over UDP/analog); control theory (feedback = the loop closed); the four-corner `Input<T,
// TFeedback>` ferry; the traveler frame. Honest scope: over an OpenAI 2-channel HTTP API the feedback
// corners are present in the TYPE but empty against the vendor — the shape is right, the fill is partial.

/// A feedback sink: a corner you can push control/feedback signals into WHILE the main flow runs. The
/// no-op sink (`noFeedbackSink`) accepts nothing and is exactly the chat-completions projection — a wire
/// that isn't there. Never throws (a control signal that no one is listening for is dropped, not an error).
export interface FeedbackSink<TFeedback> {
  push(signal: TFeedback): Promise<void>;
}

/// The forward (input) side of an exchange: the normal payload PLUS a feedback sink the RECEIVER may push
/// back into — feedback rides the input channel too, not just the result channel (Aaron 2026-07-04). Two
/// of the four corners: normal-out (`payload`) and feedback-out (`feedback`, pushed by the counterparty).
export interface Input<T, TFeedback> {
  readonly payload: T;
  readonly feedback: FeedbackSink<TFeedback>;
}

/// The return (output) side: the normal out-stream PLUS a feedback sink the CALLER may push into to
/// steer/interrupt the running output. The other two corners: normal-in (`stream`) and feedback-in
/// (`feedback`, the caller's mid-flight control channel — the thing chat-completions provably cannot do).
export interface Output<T, TFeedback> {
  readonly stream: AsyncIterable<T>;
  readonly feedback: FeedbackSink<TFeedback>;
}

/// A four-corner exchange: `Input` (normal-out + feedback-out) → `Output` (normal-in + feedback-in). Four
/// corners = two duplex wires. Chat-completions is the projection where BOTH feedback sinks are no-ops.
export type FourCorner<TIn, TOut, TFeedback> = (input: Input<TIn, TFeedback>) => Output<TOut, TFeedback>;

/// The no-op feedback sink — a wire that isn't there. Pushing a signal is silently dropped (no listener,
/// no error). THIS is the chat-completions fill: supply it for both corners and the four-corner interface
/// degenerates to `messages → completion`. `never` because a well-typed caller has no signal to send it.
export const noFeedbackSink: FeedbackSink<never> = { push: () => Promise.resolve() };

/// A feedback sink that records every pushed signal in order — the real duplex fill (and the test double
/// that proves a feedback corner actually CARRIES a signal, which the no-op sink / chat-completions can't).
export function recordingFeedbackSink<TFeedback>(): FeedbackSink<TFeedback> & { readonly signals: readonly TFeedback[] } {
  const signals: TFeedback[] = [];
  return {
    signals,
    push: (signal: TFeedback) => {
      signals.push(signal);
      return Promise.resolve();
    },
  };
}

/// Build the forward value for the EXTRACTION projection: a normal payload with the no-op feedback corner.
/// This is exactly the chat-completions request shape wearing the four-corner type (feedback wire dark).
export function extractionInput<T>(payload: T): Input<T, never> {
  return { payload, feedback: noFeedbackSink };
}

/// Lift a plain extraction completer (`payload → out-stream`, the chat-completions shape) INTO a four-corner
/// exchange whose feedback corners are dark. Proves chat-completions EMBEDS as the degenerate instance: the
/// existing `summon`/`respondStream` path is a `(TIn) => AsyncIterable<TOut>`, so it is already a FourCorner.
export function liftExtraction<TIn, TOut>(completer: (payload: TIn) => AsyncIterable<TOut>): FourCorner<TIn, TOut, never> {
  return (input: Input<TIn, never>): Output<TOut, never> => ({ stream: completer(input.payload), feedback: noFeedbackSink });
}

/// Project a four-corner exchange back DOWN to the plain extraction shape (`payload → out-stream`) by
/// supplying the no-op feedback corner and discarding the output's feedback corner. `project ∘ lift = id`
/// (round-trip identity) — extraction is a genuine sub-object of the four-corner interface, not a rewrite.
export function projectExtraction<TIn, TOut>(fc: FourCorner<TIn, TOut, never>): (payload: TIn) => AsyncIterable<TOut> {
  return (payload: TIn) => fc(extractionInput(payload)).stream;
}

// ═══ DUALITY — the law that makes "four corners" checkable rather than aspirational ═════════════
//
// The interface above NAMES four corners but nothing enforces that a transport fills them coherently.
// A transport wiring three corners type-checks today and is silently broken: a wire with one live end
// cannot carry a round trip. Found 2026-08-01 while anchoring the session-type lineage — the gap is not
// that duality is unenforced, it is that there was no `dual` operator to enforce anything with.
//
// The fix is Honda's, from session types: the two endpoints of a channel hold DUAL types, and duality is
// an INVOLUTION — `dual(dual(x)) = x`. Aaron 2026-08-01 reached the same shape from physics: "this is
// duals like electron and positron on the CPT reversal, it's like dual in reverse." Both are the same
// statement — flip every direction, keep the structure, and flipping twice is identity. (Feynman–
// Stueckelberg: an antiparticle is a particle traversed the other way; the dual endpoint is the same
// protocol traversed the other way.) Same fixpoint discipline as `gen(gen) == gen`.
//
// WHAT THE LAW CATCHES, precisely: corners come in DUAL PAIRS, and a pair is a wire. `normal-out` pairs
// with `normal-in`; `feedback-out` pairs with `feedback-in`. A corner set is well-formed iff every live
// corner's dual is also live. So:
//   - both feedback corners dark  ⇒ the feedback WIRE is absent ⇒ WELL-FORMED (this is chat-completions,
//     a legal projection — an absent wire is honest, a half-wire is not)
//   - exactly one feedback corner ⇒ HALF-WIRE ⇒ ill-formed, and now detectable
// This is shape-level, not runtime: it constrains what a transport may claim to implement.

/// The four corners, named. Two normal (payload) + two feedback (control), one of each per direction.
export type Corner = "normal-out" | "normal-in" | "feedback-out" | "feedback-in";

/// Which corners a transport actually fills. `chat-completions` fills the two normal corners only.
export type CornerSet = ReadonlySet<Corner>;

/// The involution on corners: flip the direction, keep the wire. This is the C of the CPT reading —
/// send becomes receive — and `dualCorner ∘ dualCorner = id` is the T (traverse the other way, twice).
export function dualCorner(corner: Corner): Corner {
  switch (corner) {
    case "normal-out": return "normal-in";
    case "normal-in": return "normal-out";
    case "feedback-out": return "feedback-in";
    case "feedback-in": return "feedback-out";
  }
}

/// The dual endpoint's corner set — what the OTHER side of this channel fills. Flipping every corner is
/// what "both ends are both" means: there is no client/server axis to swap, only directions to reverse.
/// (Stainback & Higgins, US 10,834,144 B2: initiation direction is not capability direction.)
export function dualCorners(corners: CornerSet): CornerSet {
  return new Set([...corners].map(dualCorner));
}

/// A corner set is WELL-FORMED iff every live corner's dual is live — i.e. it is made of whole wires.
/// An absent wire is honest (chat-completions); a half-wire is a transport claiming a round trip it
/// cannot complete, and this is the predicate that rejects it.
export function isWellFormed(corners: CornerSet): boolean {
  return [...corners].every((c) => corners.has(dualCorner(c)));
}

/// The two corner sets that name themselves in this codebase.
export const EXTRACTION_CORNERS: CornerSet = new Set<Corner>(["normal-out", "normal-in"]);
export const FULL_FOUR_CORNERS: CornerSet = new Set<Corner>(["normal-out", "normal-in", "feedback-out", "feedback-in"]);
