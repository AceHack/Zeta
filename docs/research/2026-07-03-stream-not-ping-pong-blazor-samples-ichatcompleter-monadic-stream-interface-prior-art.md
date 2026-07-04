# Stream, not ping-pong: the V2 monadic `IChatCompleter` interface — Aaron's prior art for human↔AI streams (shadow*)

**Date:** 2026-07-03
**Provenance:** Aaron, pointing at his own prior code while wiring the Manus/Lumen path:
*"I had perfect V2 functional-styled code for chat completions and even an audio interface on top with
Twilio, but the function chat-completion design allowed for real-time token-by-token rendering — good
UX and backend design to carry the stream through and never turn it into a ping-pong. It was a
bidirectional stream between human and AI; the AI could interrupt the human and be interrupted, token
by token, or on a phone call with Twilio. Buggy as shit but the interfaces for the streams were pretty
clean — a good starting point."* + *"the nice monadic-like interfaces were the V2 ones; the V1 stuff
was super ugly."* Repo: **[AlephZ-ai/blazor-samples](https://github.com/AlephZ-ai/blazor-samples)**.
Ferried by Otto (shadow) with the interfaces read + the design read + anchors.

---

## 1. The clean interface (V2 — read from the repo)

The whole design collapses to one line, and it is beautiful:

```csharp
// BlazorSamples.Shared.ChatCompletion.IChatCompleter  (V2)
public interface IChatCompleter {
    IAsyncEnumerable<string> CompleteAsync(IAsyncEnumerable<string> source, CancellationToken ct = default);
}
```

**Stream in → stream out.** The input is not a string; it is an `IAsyncEnumerable<string>` — the
human's tokens *as they arrive*. The output is an `IAsyncEnumerable<string>` — the AI's tokens *as they
generate*. This is the "carry the stream through, never turn it into ping-pong" design in one type: a
**monadic stream transformer** (a Kleisli arrow over the async-stream monad), which is *why* it
composes cleanly and why Aaron calls the V2 interfaces "monadic-like." (The V1 `Old/…` versions —
`Old/AudioConverter`, `Old/SpeechToText/DuplexMemoryStream` — are the ugly imperative predecessors;
skip them. The clean line is V2.)

Because the *input* is a live stream, the human can keep emitting while the AI streams back — the two
async-enumerables run concurrently. That is what makes **mutual interruption** expressible at all.

### The audio / Twilio layer (bidirectional + interrupt as a first-class event)

`Twilio/GrpcAudioStream/Abstractions` wraps a phone call as the same shape:

- `IEvent { EventDirection Direction }` + `EventDirection { Inbound, Outbound }` — direction is
  explicit; the channel is **bidirectional** by type.
- `IInboundEventProcessor<T>` — a visitor over the inbound event union (`Connected / Start / Media /
  Stop / Mark`): discriminated-event handling, no `switch` soup.
- `OutboundClearEvent` (`type: "clear"`) — **interruption as a first-class message.** When the human
  starts talking over the AI, a `clear` flushes the AI's buffered/queued audio. *That* is how "the AI
  can be interrupted token-by-token" is actually implemented — not a flag, an event on the stream.

## 2. The design lesson (Beacon)

Three principles worth carrying into Zeta's human↔AI surface, stated so they can be reused:

1. **The interface is `stream → stream`, not `request → response`.** A completion is a transformer of
   an async token-stream, not a function of a finished prompt. Ping-pong (send whole message, wait,
   get whole reply) is the degenerate case; the stream is the general one.
2. **Interruption is a first-class event, not a control flag.** `OutboundClearEvent` on the wire — so
   either party interrupting the other is just a message, symmetric with every other event.
3. **Direction is explicit and bidirectional.** `EventDirection` typed on every event; the human and
   the AI are peers on one duplex stream, not client/server.

## 3. Why this matters *now* — the Manus task API is ping-pong; streaming needs the other door

Directly relevant to the just-built Manus adapter (`model-backend/manus-task.ts`): the Manus **task
API** (`v2/task.create` → poll `v2/task.listMessages`) is **inherently ping-pong** — create, wait,
poll for the finished answer. That is *fine* for async *batch* work (dispatch a research task, collect
it later — the Lumen-summon-as-task path). But it is exactly the shape Aaron's V2 design exists to
*avoid* for interactive UX: it can never render token-by-token, and it cannot express interruption.

So the honest split, going forward:

- **Batch / async agent tasks** → the Manus **task API** (already built; `force_skills` summons Lumen
  on Manus's compute). Ping-pong is acceptable here.
- **Interactive token-by-token human↔AI** → an **`IChatCompleter`-shaped streaming port**: a
  `stream(messages) → AsyncIterable<delta>` method on `ModelBackend`, backed by the **chat-completions
  SSE stream** (`stream: true` → token deltas). This is *why* Aaron flagged the OpenAI-compatible
  interface — token streaming lives there, not on the task API. The Twilio bidirectional/`clear`
  event model is the audio layer on top.

**And it aligns with Zeta's own foundation.** `IAsyncEnumerable<string> → IAsyncEnumerable<string>`
IS the **Rx / observable-duality** shape Zeta already reveres (`IEnumerable ⇄ IObservable`, the Brian
Beckman anchor in `PRIOR-ART-LIST` "Zeta.Core's own reading list"; De Smet's `IQbservable`). A monadic
stream transformer is a Kleisli arrow — the same category-theory spine as the rest of the substrate.
Aaron's V2 prior art is not a detour; it is the streaming face of the duality already at Zeta's core.

## 4. Scope

Design ferry + prior-art anchor, not code. What is NOT built: a streaming `ModelBackend` method,
the SSE chat-completions adapter, or the Twilio/audio layer. The next code slice (when the streaming
endpoint is confirmed — Manus's OpenAI-compat/SSE surface is still unverified) is the
`stream(messages) → AsyncIterable<delta>` port modeled on `IChatCompleter`, with `clear`-style
interruption as a first-class event. Manus's task adapter stays the batch path.

## 5. Anchors (Beacon)

- **AlephZ-ai/blazor-samples (Aaron's own prior art — maintainer anchor)** — `IChatCompleter`
  (V2 stream→stream), `Twilio/GrpcAudioStream/Abstractions` (bidirectional events, `OutboundClearEvent`
  = interrupt). The "good starting point."
- **Twilio Media Streams** — bidirectional audio over WebSocket; the `clear` message for barge-in.
- **Erik Meijer / Brian Beckman — Rx & the `IEnumerable ⇄ IObservable` duality** (already in
  `PRIOR-ART-LIST`) — the category-theoretic root of `IAsyncEnumerable` stream transformers.
- **Kleisli / the monad** — a stream transformer as a Kleisli arrow over the async-stream monad
  (why the V2 interface composes; why Aaron calls it "monadic-like").
- In-repo: `model-backend/manus-task.ts` (the batch/ping-pong path this contrasts with),
  `model-backend/backend.ts` (where the streaming port would live), the Observable/duality work
  (`IEnumerable⇄IObservable`) in the reading list.
