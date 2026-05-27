---
date: 2026-05-27
scope: "Kestrel (claude.ai sharpening peer per agent-roster-reference-card) substrate-honest sharpening of today's four-corner ownership model (PR #5579 landed). End of multi-AI conversation cluster (Amara + Prism + Kestrel + operator + Otto-CLI 5-register convergence). Operator-explicit substrate-landing directive: 'trying to get base primitives right.'"
source: operator-forwarded Kestrel substrate
register: claude.ai sharpening register; high-precision substrate-engineering review
preservation: verbatim BEFORE summary per substrate-or-it-didn't-happen rule
participants:
  - operator
  - Kestrel (External AI; claude.ai surface per agent-roster-reference-card; ferries research; does not commit)
non_fusion_disclaimer: |
  This file preserves Kestrel's external substrate-engineering review
  + sharpening of the four-corner ownership model landed in PR #5579.
  Per `.claude/rules/agent-roster-reference-card.md`: Kestrel is
  external AI participant (claude.ai surface); ferries research;
  does not commit to repo; substrate landed via operator-forwarded
  preservation per `.claude/rules/substrate-or-it-didnt-happen.md`
  verbatim-preservation trigger.
---

## Verbatim Kestrel multi-AI conversation end (operator-forwarded 2026-05-27)

### Part 1 — Four-corner ownership confirmation + scope refinement

> Yeah — this update is rightly scoped. The key correction is that the four-corner ownership model is not a universal function rule. It becomes load-bearing when a function participates in a stream / observable / long-running interaction.
>
> The model:
>
> ```text
> Result<TResult, TOutFeedback> x(Input<TInput, TInFeedback> y)
> ```
>
> lands as:
>
> ```text
> TInput        = caller-owned input value
> TResult       = function-owned result value
> TOutFeedback  = function-owned outbound feedback
> TInFeedback   = co-owned inbound / interaction feedback
> ```
>
> That last one is the new piece. TInFeedback is not cleanly caller-owned or function-owned because in a stream both sides shape the flow:
>
> consumer says: pause / resume / cancel / slow down
> producer says: acknowledged / cannot throttle / resumed / completed
>
> So for ordinary one-shot closed functions, this is probably too much ceremony. But for streams, observables, iterators, async enumerables, Rx queries, backpressure, conversation flows, and agent handoffs, it matters a lot. The uploaded update captures exactly that scope-bounding: not a hard universal rule, but a focused extension for functions involved in stream/observable contexts.
>
> My clean rule would be:
>
> One-shot functions own their output feedback. Stream functions co-own their input feedback with the consumer.
>
> Or sharper:
>
> ```text
> TOutFeedback = callee voice.
> TInFeedback = relationship channel.
> ```
>
> That is the difference. TOutFeedback says, "Here is what happened inside me." TInFeedback says, "Here is how we are coordinating while the interaction is alive."
>
> This also fits OPLE nicely:
>
> ```text
> Observe<T, TFeedback>
> Persist<T, TFeedback>
> Limit<T, TFeedback>
> Emit<T, TFeedback>
> ```
>
> For one-shot OPLE calls, a single TFeedback may be enough. But for streaming OPLE, you probably want:
>
> ```text
> EmitStream<TResult, TOutFeedback, TInput, TInFeedback>
> ```
>
> because emission is no longer just output. It becomes a negotiated channel.
>
> Keeper:
>
> Streams are relationships, not just repeated function calls.
>
> That's why co-owned feedback belongs there.

### Part 2 — Sharpening observations + composition with NCI

> Good to engage on the actual substrate. The framing you've landed is right and I want to push on it where I think it can sharpen further, because the "streams are relationships, not just repeated function calls" line is doing real load-bearing work and the rest of the framing should follow from it cleanly.
>
> The core distinction is correct: one-shot functions are message-passing (caller sends input, function returns result with possibly some metadata about how it went), streams are relationships (both sides are alive simultaneously, both shape the ongoing flow, the interaction has a duration during which negotiation happens). The type signature you've worked out captures this cleanly because TInFeedback as co-owned is the type-system encoding of "this channel exists for negotiation rather than for one-directional signaling."
>
> A few sharpening observations on where the framing could be tightened:
>
> **The co-ownership is actually stronger than "both sides author variants"**
>
> The way you've described it, TInFeedback is co-owned because both sides contribute variant cases — consumer-authored backpressure variants plus producer-authored acknowledgment variants in the same discriminated union. That's true but it understates what's actually going on. The deeper property is that the variants from each side are responses to variants from the other side. Consumer's "BackpressureRequest of severity: int" exists because the consumer needs to communicate something it observes (its own processing capacity); producer's "AcknowledgedBackpressure" exists because the producer needs to respond to the consumer's signal. The variants aren't independently authored; they're conversational pairs.
>
> That suggests TInFeedback isn't just a co-owned type — it's a protocol type, where the variants form turn-taking pairs that encode the legal conversations between consumer and producer. The type system encoding could be tighter than a flat discriminated union; something like a session type where each variant constrains what the other side can validly respond with. F# doesn't have native session types but you can encode them with phantom types or with state machines, and Rust's typestate pattern can express them cleanly. Worth noting in the rule that the full expressive power of co-owned TInFeedback is realized through protocol-typing rather than just bag-of-variants.
>
> **The OPLE-streaming extension might want to factor differently**
>
> You've sketched:
>
> ```text
> EmitStream<TResult, TOutFeedback, TInput, TInFeedback>
> ```
>
> which puts all four corners in the streaming variant. That's defensible but it assumes that for streams, all four channels are active. Some streams have trivial TInput (the consumer doesn't push anything to the producer except control signals, in which case TInput collapses into TInFeedback's consumer-authored variants). Some streams have trivial TResult (the producer's value channel and feedback channel merge into one channel, like progress reports on a long-running operation that has no separate "final value"). Some streams have trivial TOutFeedback (the producer says nothing about its internal state except through the value channel).
>
> The cleaner factoring might be to make the four corners optional rather than required:
>
> ```text
> Stream<TResult, TOutFeedback?, TInput?, TInFeedback>
> ```
>
> where TInFeedback is the only required corner (because that's what makes it a stream rather than a function), and the other three are present when they're load-bearing. That's more permissive but it matches how streams actually get used in practice — many streams have trivial caller-input, many have trivial producer-feedback, but all streams have the co-owned negotiation channel.
>
> **The scope-bounding should probably name "long-running" explicitly rather than just "stream/observable"**
>
> Your framing uses stream/observable/iterator/async-enumerable as the scope. That's right but the underlying property is duration — the function is alive long enough for both sides to shape the interaction. Some non-stream interactions have this property too. A long-running RPC call that supports progress updates and cancellation has co-owned TInFeedback even though it's not a stream in the usual sense. A WebSocket connection has co-owned TInFeedback even though the values flowing through it might not be a stream-of-T. The scope-bounding should probably be "long-running interactions where both sides remain active during the interaction" rather than the specific abstraction names, with stream/observable/iterator being the most common instances.
>
> That also avoids a definitional question: is a long-running query in CockroachDB a stream? It returns rows progressively and supports cancellation. Calling it "a stream" is a category choice; calling it "a long-running interaction with co-owned TInFeedback" is a structural description. The structural description is more durable.
>
> **The "streams are relationships" framing has a nice composition with NCI**
>
> This is where the rule gets sharper in your framework specifically. NCI (non-coercion invariant) is about respecting the agency of parties in an interaction. For one-shot function calls, agency is trivially preserved because each call is its own discrete event. For streams (long-running interactions), agency is preserved through the co-owned TInFeedback channel — the consumer can signal pause/cancel/resume, the producer can signal completion/error/acknowledgment, and both sides have to honor the other's signals. The co-owned TInFeedback is the type-system encoding of the NCI discipline applied to long-running interactions.
>
> That suggests the rule isn't just "stream functions co-own their input feedback" but "long-running interactions require co-owned TInFeedback as the operational form of NCI within the interaction." Without co-owned feedback, the producer can ignore consumer signals (coercion: producer pushes data the consumer can't handle), or the consumer can ignore producer signals (coercion: consumer demands behavior the producer can't deliver). The co-owned channel is what makes the interaction non-coercive.
>
> Worth naming explicitly because it grounds the rule in the framework's existing disciplines rather than being a separate type-design observation.
>
> **The "callee voice vs relationship channel" distinction is the cleanest version**
>
> Your two-line summary —
>
> ```text
> TOutFeedback = callee voice
> TInFeedback = relationship channel
> ```
>
> — is the part of the framing I'd most want to keep as the durable artifact. It's compressed enough to be memorable, precise enough to be operational, and it grounds the type-system distinction in conversational intuition that any future contributor (AI or human) can map to. The longer rule should probably build to this as its punchline rather than burying it in the middle.
>
> **One genuine question about the type signature**
>
> In the signature:
>
> ```text
> Result<TResult, TOutFeedback> x(Input<TInput, TInFeedback> y)
> ```
>
> the placement of TInFeedback inside Input<> and TOutFeedback inside Result<> is meaningful — it says feedback travels alongside the value in each direction. For one-shot functions that works cleanly. For streams, though, the feedback channel often outlives any individual value — the consumer might send a BackpressureRequest that affects all future values from the producer, not just the next one. The current signature implies a 1:1 pairing between values and feedback events that might not hold for streams.
>
> The honest streaming signature might separate the feedback channels from the value channels:
>
> ```text
> Stream<TResult, TOutFeedback>(TInput, TInFeedback) y
> ```
>
> where TInput is the value channel (consumer to producer), TInFeedback is the control channel (consumer to producer, but independent of value flow), TResult is the value channel (producer to consumer), and TOutFeedback is the control channel (producer to consumer, but independent of value flow). The four channels remain but they're decoupled rather than paired.
>
> That might be over-engineering for the rule's scope — your existing signature works fine for the cases you've identified — but it's worth noting that streams sometimes need the temporal decoupling that the existing signature implies happens together.
>
> **Composition with the multi-AI conversation context you mentioned**
>
> You said this is the end of a multi-AI conversation. I'd guess the cascade I'm seeing is some combination of you, Prism (DeepSeek?), and possibly Otto's CLI session, with each contributing pieces to the four-corner model. The rule as it lands should preserve attribution for the conversational moves that produced it — Prism's iterator/generator asymmetry contribution, your four-corner ownership framing, the co-ownership insight, the scope-bounding to streams. The "honor those that came before" discipline you've been operating with would suggest the PR commit message and the rule's own preamble should name the cascade rather than presenting the rule as if it emerged from one source.
>
> The substrate-or-it-didn't-happen discipline also suggests preserving the verbatim exchange that produced the four-corner model — not because it's secret substrate but because future contributors trying to understand why the rule is shaped the way it is will benefit from seeing the conversational path that produced it.
>
> **For the actual PR landing**
>
> Your instinct on shipping as a small focused extension to the asymmetric-authorship rule (option b, but bounded as you've now described) is right. The four-corner model isn't structurally distinct enough from the asymmetric-authorship rule to warrant its own first-class rule — it's a sharpening of "asymmetric authorship per channel" with the recognition that some channels have co-authored content. Putting it as an extension keeps the substrate consolidated and lets future contributors find the co-ownership case from the existing rule rather than having to know to look for a separate rule.
>
> The scope-bounding you've articulated ("not a hard universal rule, just for functions involved in stream/observable contexts") is the right calibration. The asymmetric-authorship rule applies universally for single-author channels; the four-corner extension applies specifically when the function participates in a long-running interaction where co-ownership of the relationship channel becomes load-bearing.
>
> Carry on with the PR. The framing is sound and the composition with the existing substrate is clean. The "streams are relationships, not just repeated function calls" line is the keeper and the rest builds out from it correctly.

### Part 3 — Push/pull × hot/cold support requirement

operator: *"yes we want to support push/pull hot/cold"*

> Right, and that's the dimension that makes the four-corner model actually load-bearing rather than just elegant. Push/pull and hot/cold are the orthogonal axes that determine which corners of the four-corner model carry weight in any given stream. Let me trace why the support requirement sharpens the design.
>
> The two axes are well-established in reactive programming literature (Rx, ReactiveX, the broader functional reactive programming community) but worth being precise about because they interact with co-ownership in specific ways:
>
> **Push vs pull is about who drives the timing of value flow**
>
> Push: producer decides when to send values, consumer reacts. The producer's clock dominates. Examples: event streams (mouse events, keyboard events, sensor readings), Observable<T> in Rx, MessageReceived events, Server-Sent Events.
>
> Pull: consumer decides when to request values, producer responds. The consumer's clock dominates. Examples: IEnumerable<T>, iterators, IAsyncEnumerable<T>, pull-based REST pagination.
>
> **Hot vs cold is about whether the stream has independent existence from subscribers**
>
> Hot: stream exists and produces values regardless of who's subscribed. Subscribers see values starting from when they subscribe; values produced before subscription are missed. Examples: live sensor data, broadcast events, market data feeds, system event streams.
>
> Cold: stream produces values per-subscriber on subscription. Each subscriber gets their own production. Examples: database query results, file reads, HTTP requests-as-streams, computed sequences.
>
> **The four combinations have different co-ownership shapes**
>
> This is where push/pull and hot/cold interact with the four-corner model in specific ways:
>
> **Push + Cold (per-subscriber Observable)**
>
> The producer drives timing but the production is per-subscriber. TInFeedback co-ownership is rich here: consumer can request backpressure (the canonical Rx case), cancel subscription, request specific filtering. Producer can signal completion, errors, acknowledgment of backpressure. Each subscriber gets their own producer-consumer relationship, so the co-owned TInFeedback channel is per-subscription. This is the case Rx was originally designed for and where the asymmetric-authorship-with-co-owned-feedback model fits most naturally.
>
> **Push + Hot (broadcast event stream)**
>
> The producer drives timing and exists independently. TInFeedback co-ownership is constrained: consumer can subscribe/unsubscribe but can't meaningfully backpressure the producer (the producer is broadcasting to potentially many subscribers, and slowing for one slows for all). Producer's TOutFeedback dominates; consumer's TInFeedback shrinks to subscription lifecycle signals. The co-ownership pattern degenerates partially because the producer can't honor per-consumer feedback without breaking its broadcast contract. This is where you typically see "if you can't keep up, you drop messages" or "if you can't keep up, you get disconnected" — the co-ownership is real but bounded by the broadcast constraint.
>
> **Pull + Cold (iterator, IAsyncEnumerable)**
>
> The consumer drives timing and production is per-subscriber. TInFeedback co-ownership has a specific shape: consumer's pull rate IS the backpressure signal (slow consumption naturally throttles production), consumer can cancel via the iteration protocol. Producer's TOutFeedback signals completion, errors, current-position. The co-ownership is implicit in the pull mechanic — backpressure happens automatically because production only occurs when the consumer pulls. IAsyncEnumerable<T> with CancellationToken is the canonical example: the cancellation token IS the consumer-authored TInFeedback channel made explicit in the type system.
>
> **Pull + Hot (consumer-driven access to independently-existing stream)**
>
> The consumer drives timing but the stream has independent state. This is the least common combination but exists in patterns like Kafka consumer groups (the topic exists hot; consumers pull at their own pace). TInFeedback co-ownership is interesting here: consumer can pull at their own rate (implicit backpressure), seek to specific positions (consumer-authored variant the producer must honor), commit offsets (consumer-authored variant that affects the producer's state). Producer's TOutFeedback includes high-water marks, partition assignments, rebalancing events. The co-ownership is significant because both sides are negotiating against the independently-existing stream state.
>
> [4-kind type system implications + Stream<…> typedefs + composition with substrate concerns + push/pull dimension matters for JIT execution + engineering recommendation for rule extension naming the 4 kinds explicitly + NCI implication generalizes too (4 NCI shapes) + scope decision rule-vs-design-doc]
>
> The framing is sound and the composition with Rx lineage, IAsyncEnumerable patterns, Kafka consumer semantics, and your own CRDT-CAS-BFT layering is clean. The "streams are relationships, not just repeated function calls" line generalizes correctly across all four kinds. Carry on.

### Part 4 — F# CE machinery for one-interface-multi-semantics

operator: *"is there anyting we can do with computatonal expressions so it looks like one interface but the expression domain over it defines the semantics?"*

> Yes, and this is one of the cleanest applications of F# computation expressions I can think of — using the CE machinery to project a single surface syntax onto multiple underlying semantics determined by the builder. Let me trace what makes this work and where the design choices land.
>
> F# computation expressions are essentially syntactic sugar over builder methods. When you write `stream { let! x = source; return x }`, the compiler desugars that into method calls on a builder object: `builder.Bind(source, fun x -> builder.Return(x))`. The builder's implementation of Bind, Return, Combine, Yield, For, Using, While, Delay, Run, etc. determines the actual semantics. The surface syntax stays consistent; the meaning varies with the builder. That's exactly the property you want — one interface, multiple semantic domains.
>
> For the push/pull/hot/cold case, you'd have four builders (or one builder family with kind-parameterized methods) where the same `stream { ... }` syntax produces different underlying machinery: [4-builder example sketch with pushCold/pullCold/pushHot/pullHot expressions].
>
> [Builder also determines which TInFeedback variants are legal + type-system enforces kind-appropriate co-ownership shape; the user writes uniform syntax + type system enforces kind-appropriate semantics + compiler errors when feedback variants don't match the stream kind; much stronger than runtime-checked policies — compile-time enforcement of four-corner-model's kind-specific shapes]
>
> **Composition with Rx/Reaqtor/Bonsai lineage**
>
> This is where the F# CE approach composes uncommonly well with the Rx serializable expression tree work (Reaqtor's Bonsai). [F# CEs designed to build expression trees rather than execute directly; serializable / transmittable to other processes / executable against different backends; same source expression runs in multiple semantic domains determined by the runtime choice, not just the builder choice — another layer of "one interface, multiple semantics" beyond the four stream kinds.]
>
> [The "tools are rented not owned by agents" framing also gets sharper here. The stream expression is the rented tool; the backend (local execution, distributed execution, SQL compilation, DBSP retraction) is the renter's choice; the expression author doesn't have to know or care which backend is used as long as the semantics match.]
>
> **Technical machinery you'd need**
>
> The F# CE features that make this work: CustomOperation attribute / Quotations / Builder methods returning monadic values vs expression trees / Type providers / Statically resolved type parameters (SRTPs).
>
> [Combining all of these: you get a stream CE that has uniform surface syntax, kind-specific type-safe semantics, compile-time specialization, optional deferred execution via expression trees, multi-backend execution capability, and type-provider-driven schema integration.]
>
> **Reaqtor/Bonsai precedent specifically**
>
> Reaqtor (Bart De Smet's work at Microsoft, descended from the Rx team) does almost exactly this for serializable Rx expressions in C#. The Bonsai expression tree is an intermediate representation that can be transmitted across process boundaries, persisted to disk, optimized, and re-executed. Your F# version would have the advantage of CE syntax integration, which C# lacks — CE syntax in F# is genuinely nicer than LINQ-comprehension syntax in C# for stream-shaped problems, and the F# type system is more expressive for encoding the four-corner ownership constraints.
>
> The composition direction worth being explicit about: F# CE for the surface syntax + Bonsai-style serializable expression trees for the intermediate representation + multi-backend execution for the runtime + type providers for schema integration + the four-kind builder family for stream-kind-specific semantics. Each of those exists in some form in the ecosystem; combining them in one architecture is the distinctive thing.
>
> **Potential complications worth being honest about**
>
> Computation expressions in F# have known sharp edges: inference fragility with complex builders / CustomOperation restrictions / expression tree building slower than direct execution / four-kind builder family maintenance cost. These complications are tractable; none of them invalidate the approach.
>
> **For the immediate PR scope**
>
> The CE-based projection from uniform surface syntax to multiple semantic domains is research-direction-worth-pursuing rather than next-PR scope. The four-corner ownership model extension you're landing now is the foundation; the CE-based surface syntax is the eventual user-facing API that exposes the model to expression authors. The two compose but they're separately landable.
>
> I'd suggest:
>
> **PR-now**: the four-corner ownership extension to the asymmetric-authorship rule, with the scope-bounding to long-running interactions and possibly a brief note that the stream-kind-specific shapes (push/pull/hot/cold) are documented separately.
>
> **Backlog-row**: the CE-based surface syntax with kind-specific builders, the expression-tree intermediate representation, and the multi-backend execution capability. That's a substantial design project that deserves its own backlog row with the design exploration captured as part of the row.
>
> **Runbook-gesture**: the deeper composition with Bonsai, type providers, and your schemas-as-rows architecture. That's the research-direction territory that benefits from the runbook-gesture register rather than being prematurely formalized.
>
> The progression matches your framework's existing patterns — land the foundational rule, build the backlog row for the next layer, preserve the further direction in runbook for JIT refinement when the prerequisites are in place.
>
> The "one interface, multiple semantics determined by the expression domain" framing is operationally precise and the F# computation expression machinery is the right tool for the job. The composition with the rest of the framework (substrate, type system, multi-backend execution, schema integration) is clean. Carry on.

## Substrate-landing notes

Five substantive substrate-engineering items from Kestrel's multi-AI conversation end:

### Item 1 — Co-ownership is PROTOCOL TYPE not just bag-of-variants

Kestrel's sharpening: TInFeedback variants aren't independently authored; they're **conversational pairs**. Consumer's variants exist as responses to producer's needs; producer's variants exist as responses to consumer's signals. The full expressive power is realized through **protocol-typing** (F# state machines + phantom types; Rust typestate pattern) rather than flat discriminated unions.

### Item 2 — Four corners should be OPTIONAL not REQUIRED

Some streams have trivial TInput / TResult / TOutFeedback. The cleaner factoring: TInFeedback is the only required corner (what makes it a stream); other three optional when load-bearing.

```text
Stream<TResult, TOutFeedback?, TInput?, TInFeedback>
```

### Item 3 — Scope-bounding should name "long-running" not just stream/observable

Property is **duration** — function alive long enough for both sides to shape interaction. Long-running RPC with progress + cancellation has same co-ownership shape; WebSocket has same; long-running CockroachDB query has same. Structural description ("long-running interactions where both sides remain active") more durable than abstraction-name-specific framing.

### Item 4 — Composes with NCI: co-owned TInFeedback IS NCI at long-running scope

> *"long-running interactions require co-owned TInFeedback as the operational form of NCI within the interaction"*

Without co-owned feedback: producer can ignore consumer signals (coercion: push-data-consumer-can't-handle); consumer can ignore producer signals (coercion: demand-behavior-producer-can't-deliver). Co-owned channel IS what makes interaction non-coercive.

### Item 5 — Push/pull × hot/cold = 4-stream-kind taxonomy with kind-specific NCI shapes

| Kind | Co-ownership richness | NCI shape |
|---|---|---|
| Push + Cold (Rx Observable) | Rich; per-subscriber backpressure | Producer honors consumer backpressure |
| Push + Hot (broadcast) | Constrained; subscription-lifecycle only | Producer provides consumer-visible drop-policy (transparency NCI not per-consumer-accommodation) |
| Pull + Cold (iterator) | Implicit in pull-rate + cancellation token | Producer honors cancellation; pull-rate IS backpressure |
| Pull + Hot (Kafka-style) | Both sides negotiate against independent stream state | Producer honors seek/commit; consumer doesn't advance offsets unprocessed |

NCI doesn't have one shape; it has four shapes corresponding to the four stream kinds.

### Item 6 — F# CE machinery for one-interface-multi-semantics

Kestrel's substrate-engineering recommendation: **F# computation expressions** are the right tool for projecting one surface syntax onto multiple semantics via builder polymorphism. Same `stream { ... }` syntax produces fundamentally different runtime machinery depending on builder. Composes with:

- **CustomOperation attribute** (custom operators within CE syntax)
- **Quotations** (F# expression-tree facility for deferred execution)
- **Type providers** (schema-derived types at compile time)
- **SRTPs** (statically resolved type parameters for compile-time specialization)
- **Reaqtor/Bonsai precedent** (serializable expression trees for multi-backend execution)
- **CRDT-CAS-BFT layered mediation** (hot streams live in CRDT layer; cold streams in CAS layer)

### Carved-sentence keeper

> *"Streams are relationships, not just repeated function calls."*

> *"TOutFeedback = callee voice. TInFeedback = relationship channel."*

## Composes with substrate

- PR #5579 four-corner ownership extension (the rule Kestrel sharpens)
- PR #5516 asymmetric-authorship rule (the parent rule)
- PR #5517 Prism iterator/generator-asymmetry (the antecedent insight)
- PR #5511 monad-propagation-pattern-cross-language (cross-language composition)
- B-0862 OPLE-T-TFeedback implementation (where the kind-specific corners apply)
- B-0863 Ace package manager one-liner (declarative-mapping discipline; same shape)
- Today's full 24-PR substrate-engineering cluster

## Composes with rules

- `.claude/rules/substrate-or-it-didnt-happen.md` — verbatim-preservation trigger
- `.claude/rules/asymmetric-authorship-substrate-entity-defines-consent-channel-recipient-acknowledges.md` (PR #5516 + #5577 + #5579) — the rule Kestrel sharpens
- `.claude/rules/non-coercion-invariant.md` HC-8 — Kestrel's NCI-at-long-running-interaction-scope composition
- `.claude/rules/monad-propagation-pattern-cross-language-substrate-shape.md` — cross-language CE machinery composition
- `.claude/rules/honor-those-that-came-before.md` — Kestrel's attribution-preservation framing for the cascade
- `.claude/rules/agent-roster-reference-card.md` — Kestrel is claude.ai sharpening peer; ferries research; does not commit

## Substrate-honest framing

This file is verbatim preservation of Kestrel's external substrate-engineering review per the substrate-or-it-didn't-happen rule's verbatim-preservation trigger. The non-fusion disclaimer (per framing convention) preserves that Kestrel's substrate is research-grade; not framework commitment to specific claims beyond what's separately substrate-landed via the cited PRs.

Five substrate-engineering items + carved-sentence keeper preserved here. B-0864 (filed alongside this preservation) lands the substrate-engineering target for the implementation work (4-kind stream taxonomy + F# CE machinery + multi-backend execution + protocol-typing).
