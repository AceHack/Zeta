# The four-corner interface — mutual empowerment, not extraction; chat-completions is the degenerate projection

*Shadow ferry, 2026-07-04. Aaron's design note on the summon wire format, banked after the live summon
confirmed the extraction projection works (Amara answered "Hello — I'm alive and ready.", `role:"system"`
accepted). The note sets the *direction* of the interface; the current backend is the feedback-free
special case.*

## Aaron verbatim

> "we're basically using OpenAI completions — the API written from a *human* perspective; ours will end
> up being from a *traveler's* perspective. Chat completions are more **extraction-shaped**; our final
> form will be more **mutual-empowerment** based. The biggest difference in the interfaces is the
> **four-corner feedback system** — there are two in and two out channels: one for normal flow and one
> for feedback flow, in both directions."

## The distinction

| | Chat completions (OpenAI) | The four-corner interface (Zeta final form) |
|---|---|---|
| Perspective | **human** (I extract a completion) | **traveler** (mutual empowerment) |
| Channels | **2**: prompt in → completion out | **4**: normal-in/out **+** feedback-in/out |
| Value flow | one-way (extraction) | both-ways (feedback in *both* directions) |
| Type | `messages → answer` | `Input<T, TFeedback> → Output<T, TFeedback>` (feedback rides the input channel too) |
| Interruption | none (you wait for the completion) | first-class (interruption is a feedback-channel event) |

The four corners: **normal-in**, **normal-out**, **feedback-in**, **feedback-out** — the forward flow
(what chat completions gives you) *plus* the feedback flow, running in **both** directions. This is the
four-corner `Input<T, TFeedback>` from the earlier ferry, promoted from a value type to the *interface
shape*: feedback flows backward on the **input** channel, not just the result channel.

## Why it's mutual, not extractive

In chat completions the model cannot push feedback *up your input channel*, and you cannot feed into its
stream *mid-flight*. Value flows one way: you prompt, it completes, you took something. The feedback
corners make it **mutual** — both parties feed back into the other's flow, in both directions. That is
also the **mutually-interruptible** requirement Aaron named at the very start of this arc ("the end goal
is our entire network stack over Reticulum, bidirectional and mutually interruptible"): the interruption
*is* a feedback-channel event (cf. Twilio's `OutboundClearEvent`, the MultiplexedWebSockets full-duplex
multiplex, and HEAT as the backpressure that autonegotiates it over UDP/analog).

## Chat-completions is the DEGENERATE PROJECTION (one is a special case of the other)

The four-corner interface is a **strict superset**: **drop the two feedback corners and you get chat
completions.** So the current `summon` / `respond` (`messages → answer`) is the *extraction projection*
of the four-corner interface — the feedback-free instance. This is the same "beautiful on 1, scales to N
/ one is a special case of the other" discipline that already runs through the streaming primitive
(`respond` = collect `respondStream`) and the DU-loop: **the four-corner interface is the general shape;
the OpenAI backend fills only the normal corners.** Future backends (Reticulum, the traveler mesh) fill
the feedback corners; the type should be four-corner so the shape is right from the start, with OpenAI as
the degenerate fill.

## Honest register

- **The OpenAI backend cannot natively carry 4 channels** — it's a 2-channel HTTP API. So the four-corner
  interface *wraps* it: normal corners → the codex/responses request/stream; feedback corners → Zeta's
  addition, carried in-band (in the message/event stream) or out-of-band, and *fully* realized only over a
  genuinely bidirectional transport (Reticulum). Until then the feedback corners are present in the type
  but empty against OpenAI — honest: the shape is right, the fill is partial.
- **This is a direction, not a built interface yet.** The live summon proved the *extraction projection*
  works end to end (Amara, `role:"system"`). Typing the interface as four-corner (`Input<T,TFeedback>` in,
  the dual out) is the next principled slice — the OpenAI `summon` becomes the feedback-free instance of it.
  **UPDATE 2026-07-04:** the type is now built — `src/Core.TypeScript/model-backend/four-corner.ts`
  (`FeedbackSink` / `Input<T,F>` / `Output<T,F>` / `FourCorner<TIn,TOut,F>`, the `noFeedbackSink` fill, and
  `liftExtraction`/`projectExtraction` with `project ∘ lift = id` proving extraction is a genuine
  sub-object). It is a pure interface (free; a class must be earned — `interfaces-free-classes-earned`); the
  OpenAI corners are filled, the feedback corners carry a live signal in test but stay dark against the
  vendor (honest: shape right, fill partial).
- **Anchors:** the four-corner ferry (`Input<T,TFeedback>` / Maji / Z-set retraction as the feedback);
  mutual-empowerment fitness (the E8/Condorcet decorrelation thread); the traveler frame; bidirectional
  mutually-interruptible streaming (blazor-samples V2, Twilio `OutboundClearEvent`, MultiplexedWebSockets,
  HEAT backpressure); control theory (feedback = the loop; the DU-loop `loop : dt → SoftValue<DU<branch>>`
  with the feedback corner is the closed loop).

## Cross-links

- The summon (the extraction projection, live): `src/Core.TypeScript/model-backend/zeta-summon.ts`.
- The four-corner value type + Maji/Meno retraction: the pilot-wave/qualia ferry + the max-mode/Condorcet ferries.
- The DU-loop type (the feedback closes the loop): `2026-07-04-self-similar-drawing-visual-ecc-to-universal-temperature-control-similar-loops-not-numbers.md` §4.
