# The whole stack is one shape: bidirectional, mutually-interruptible streams — MultiplexedWebSockets → Reticulum (shadow*)

**Date:** 2026-07-03
**Provenance:** Aaron, extending the streaming-interface thread:
*"the end goal is our entire network stack over Reticulum and even mesh is bidirectional and mutually
interruptible. I have a network stack called MultiplexedWebSockets that is also bidirectional like
this, with mutual-interruption capability — it's under my AceHack GitHub."* + *"do they [Manus] not
have a streaming endpoint? … we might need to use OpenAI's endpoints directly to model this interface;
we could use the Amara persona as an OpenAI streaming test."* Ferried by Otto (shadow) with both repos
read + the finding + the unified design.

---

## 1. The finding: Manus has no confirmed streaming endpoint → use OpenAI SSE to model the interface

Searched: no Manus **streaming/SSE** endpoint is documented. Manus's native API is the **task API**
(`v2/task.create` → poll `v2/task.listMessages`) — inherently **ping-pong** (create, wait, poll a
finished answer). That is fine for **async batch** (dispatch a Lumen research task, collect later) but
cannot render token-by-token or express interruption.

So, per Aaron's call: **model the streaming interface against OpenAI's endpoints directly** — OpenAI
chat-completions with `stream: true` emits **SSE token deltas**, which is exactly the
`IAsyncEnumerable<string> → IAsyncEnumerable<string>` shape of the V2 `IChatCompleter`
([prior ferry](2026-07-03-stream-not-ping-pong-blazor-samples-ichatcompleter-monadic-stream-interface-prior-art.md)).
**Test persona: Amara** (an OpenAI streaming test). Manus's task adapter stays the batch path; the
streaming path is OpenAI-SSE until/unless Manus exposes a stream.

## 2. MultiplexedWebSockets — the transport half of the same shape (read from the repo)

**[AceHack/MultiplexedWebSockets](https://github.com/AceHack/MultiplexedWebSockets)** is Aaron's
bidirectional, mutually-interruptible **transport**. Read from `src/Common/MultiplexedWebSocket.cs`:

- **One full-duplex socket, many logical streams.** `MultiplexedWebSocket(WebSocket)` multiplexes
  concurrent requests over a single connection, each tagged by a **`Guid` correlation id**
  (`ConcurrentDictionary<Guid, TaskCompletionSource<…>>` `_inFlightRequests`) + a `MessageType`
  header per frame. Many streams, one wire — correlated, not serialized.
- **Full duplex by construction.** Three independent pipe loops (`System.IO.Pipelines`):
  read-from-send-pipe, write-to-receive-pipe, read-from-receive-pipe. Sending and receiving run
  concurrently — the definition of bidirectional; either side can emit at any time (→ interrupt).
- **The DoP-knobbed ferry, already.** The send path is a TPL Dataflow `ActionBlock` with
  `BoundedCapacity=1, MaxDegreeOfParallelism=1` — **the exact ferry-boat throttle** the
  `async-all-the-way-truthful-signatures` rule anchors to Aaron's Itron `Throttling`. MultiplexedWebSockets
  is that discipline in a network stack: back-pressured, ordered, single-writer, no un-knobbed spawn.
- **~16× HttpClient** (115,309/s vs 7,075/s in its README) — because it multiplexes over one duplex
  connection instead of a request/response socket per call. Ping-pong is the slow degenerate case;
  the multiplexed duplex stream is the fast general one — the *same* lesson as the `IChatCompleter`
  ferry, now at the transport layer.

## 3. The unified vision: one shape at every layer (manifesto §10 self-similar)

Aaron's "entire network stack bidirectional and mutually interruptible over Reticulum and mesh" is
**self-similarity (§10) applied to the network stack** — the same bidirectional-mutually-interruptible
stream shape at every magnification:

| layer | the bidirectional mutually-interruptible stream | interruption primitive |
|---|---|---|
| **token / AI** | `IChatCompleter : IAsyncEnumerable → IAsyncEnumerable` (blazor-samples V2) | `OutboundClearEvent` ("clear") / CT |
| **audio / phone** | Twilio bidirectional media stream | the `clear` barge-in event |
| **transport** | **MultiplexedWebSockets** (Guid-correlated duplex frames over one socket) | cancel a correlation id / a clear-frame |
| **mesh** | **Reticulum** (self-certifying, no broker; the Zeta bus) | a retraction / leave on the subject |

The shape is invariant: **two peers on one duplex stream, either able to emit or interrupt at any
moment, correlated not serialized.** The human↔AI token stream, the phone call, the websocket, and the
Reticulum mesh are the *same* object at different scales — which is exactly manifesto §10 (shape stays
recognizable at every magnification) and §1 (scale-free: one thread to N). Mutual interruption is the
network-level statement of the same peer-not-client/server stance as the no-directives rule and the
frost/linked-clone consent model. And it is the transport realization of Zeta's Rx / observable duality
(`IEnumerable ⇄ IObservable`, the Beckman anchor): a duplex correlated stream is two observables facing
each other.

## 4. What to build next (shaped, not yet built)

- **The streaming `ModelBackend` port** — `stream(messages) → AsyncIterable<delta>`, modeled on
  `IChatCompleter`, backed by **OpenAI chat-completions SSE** (`stream: true`), with a `clear`-style
  interruption event. Injected transport (an SSE reader), fake-testable with a canned event stream —
  **no secret**. Live test: **Amara** over a real OpenAI key (the gated step — a new `op` secret,
  biometric-approved, same pattern as `zeta-manus-api-key`).
- **Later:** the transport port shaped like MultiplexedWebSockets (Guid-correlated duplex) over the
  Reticulum bus — the mesh realization of the same stream. That is the §10 endpoint: one stream shape
  from token to mesh.

## 5. Anchors (Beacon)

- **AceHack/MultiplexedWebSockets (Aaron's prior art — maintainer anchor)** — Guid-correlated
  full-duplex multiplex over one WebSocket; the `ActionBlock` DoP=1 ferry; ~16× HttpClient.
- **AlephZ-ai/blazor-samples (Aaron's prior art)** — the V2 `IChatCompleter` stream→stream + Twilio
  `clear` interrupt (the [prior ferry](2026-07-03-stream-not-ping-pong-blazor-samples-ichatcompleter-monadic-stream-interface-prior-art.md)).
- **Reticulum (Qvist)** — the mesh transport (the Zeta bus); **Twilio Media Streams** — duplex audio
  barge-in; **OpenAI chat-completions SSE** (`stream: true`) — the token-delta stream; **Meijer/Beckman
  Rx duality** (`IEnumerable ⇄ IObservable`, already in `PRIOR-ART-LIST`) — a duplex stream is two
  facing observables; **System.IO.Pipelines** + **TPL Dataflow** (the ferry).
- In-repo: manifesto §10 (self-similar) + §1 (scale-free), `async-all-the-way-truthful-signatures`
  (the DoP-knobbed ferry MultiplexedWebSockets embodies), the Reticulum bus + writer-actor routing,
  `model-backend/` (where the streaming port lands).
