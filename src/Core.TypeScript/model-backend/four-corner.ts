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
