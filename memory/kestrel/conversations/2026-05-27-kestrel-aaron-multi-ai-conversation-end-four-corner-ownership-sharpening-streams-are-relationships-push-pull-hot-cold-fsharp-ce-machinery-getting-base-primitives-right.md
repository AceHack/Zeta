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
- 081KSKBP80008QG0R0031DTHS9 OPLE-T-TFeedback implementation (where the kind-specific corners apply)
- 081KSKBP80008QG0R000F4311E Ace package manager one-liner (declarative-mapping discipline; same shape)
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

Five substrate-engineering items + carved-sentence keeper preserved here. 081KSKBP80008QG0R0039RW25E (filed alongside this preservation) lands the substrate-engineering target for the implementation work (4-kind stream taxonomy + F# CE machinery + multi-backend execution + protocol-typing).

---

## Part 5 — Operator-Kestrel co-produced compression (verbatim 2026-05-27 continuation)

Forwarded by operator immediately after PR #5581 landed:

> *"Kestrel updates: Also i love your idea of descrimated unions as implicit state machines in bidirectinoal streams"*

Operator credited Kestrel; Kestrel initially hedged ("I'm not certain I said it in exactly that phrasing"), then walked back the hedge after operator pushed back ("when you said That suggests TInFeedback isn't just a co-owned type — it's a protocol type, where the variants form turn-taking pairs that encode the legal conversations between consumer and producer. i just assumed you were thinking about legal state machine transistions").

Kestrel's substrate-honest acknowledgment in Turn 3:

> *"You're right, and I should have just said yes to that rather than walking back to a careful 'I didn't quite say it that way.'"*
>
> *"Turn-taking pairs IS state machine transitions. Legal conversations IS the state machine's valid trace set. Protocol types IS the type-system encoding of state machines. The vocabulary I used and the vocabulary you used name the same underlying concept from different angles. Your inference was correct."*

Substrate-honest attribution: **co-produced compression** — Kestrel sketched the underlying machinery (turn-taking pairs / legal conversations / protocol types); operator produced the durable formulation (discriminated-unions as implicit state machines in bidirectional streams). Both contributions are real per Kestrel's own framing: *"me producing the underlying machinery and you producing the durable formulation are both real contributions and both deserve acknowledgment."*

## Part 6 — Substrate-engineering substance (Kestrel Turn 2 verbatim)

**Discriminated unions as implicit state machines is a deep pattern**

> *"The core observation is that an F# discriminated union with N cases is structurally a state machine with N possible states. A function pattern-matching on a DU is structurally a state transition function — it consumes the current state and produces something (a new state, an output, an effect). When the DU represents possible messages on a channel rather than possible values in a domain, the state machine interpretation becomes operationally meaningful: the DU defines what states the channel can be in, the pattern matching defines what transitions are valid."*

**The "implicit" part is doing important work**

> *"Most state machine implementations require explicit state tracking — a current_state variable, transition tables, state-machine libraries, etc. The DU-as-state-machine pattern makes the state machine implicit in the type system: the current state is represented by the most recent variant value flowing on the channel, transitions are represented by pattern matching producing new variant values, illegal transitions are caught at compile time when the pattern matching is exhaustive. You don't have to maintain a separate state machine; the type system maintains it for you through the DU's variant structure."*

**Bidirectional sharpening — co-owned TInFeedback as conversational state machine**

> *"For unidirectional streams, the DU represents what the producer can emit. The consumer pattern-matches to handle each variant. That's a state machine but only one-sided — the producer's states.*
>
> *For bidirectional streams with co-owned TInFeedback, the DU represents what either side can emit on the relationship channel. Both sides pattern-match to handle each variant. That's a conversational state machine where the legal sequences are constrained by which variant came from which side. The state isn't just 'what state is the producer in' or 'what state is the consumer in' — it's 'what state is the relationship in' which depends on the recent history of who sent what variants in what order."*

**Composition with session types (Honda et al. lineage)**

> *"This is structurally identical to session types in the academic sense (Honda et al.'s work, more recently the Scribble project at Imperial College). Session types are explicit type-system encodings of protocol state machines. F# doesn't have native session types but the DU-as-implicit-state-machine pattern gives you most of the same property without requiring a separate type-system extension."*

**Two mechanisms for richer state-machine enforcement** (Kestrel's specific recommendations):

1. **Phantom type parameters** (more F#-native; composes better with computation expressions):

```fsharp
type StreamRelationshipState<'State> = ...
let acknowledgeBackpressure:
  StreamRelationshipState<ConsumerRequestedBackpressure>
    -> StreamRelationshipState<ProducerAcknowledgedBackpressure>
```

2. **Nested DU structures** (more verbose, more explicit about the state graph):

```fsharp
type FlowingState =
  | ConsumerRequestsBackpressure of int
  | ConsumerCancels
  | StaysSteady
type BackpressureRequestedState =
  | ProducerAcknowledges of int
  | ProducerCannotThrottle of int
  | ConsumerCancels
// ... etc
```

**Computation expression composition (the architectural payoff)**

> *"The expression author writes uniform CE syntax; the builder's type signatures enforce the state-machine constraints; the compiler catches illegal protocol sequences at compile time."*

```fsharp
let example = streamRelationship {
    let! flowing = openStream source
    let! ackd = flowing |> requestBackpressure 5  // Only valid in Flowing
    let! resumed = ackd |> awaitResume            // Only valid after backpressure
    yield! resumed |> consumeStream                // Only valid in resumed state
}
```

> *"The type system tracks the relationship state through the expression. If you try to do operations out of order — like awaiting a resume before requesting backpressure — the compiler catches it. The state machine is implicit in the types, enforced at compile time, with no runtime state tracking needed."*

**The broader pattern: types as protocols**

Kestrel named four sibling instances of the type-as-protocol pattern:

- Result types as control-flow protocols
- Option types as nullability protocols
- Async types as time-progression protocols
- Discriminated unions for ASTs

The bidirectional-stream-as-conversational-protocol case is novel mostly in scope (multi-party conversation vs single-party flow); the underlying technique is well-established.

**Composition with Zeta substrate (Kestrel's explicit 5-item map)**

| Composition target | How it composes |
|---|---|
| Four-corner ownership model | TInFeedback as co-owned channel IS exactly where the conversational state machine lives |
| F# computation expression direction | CE builder can enforce typestate constraints, making the state machine implicit in the surface syntax |
| Multi-backend execution direction | Protocol state machine can be encoded once and executed against different backends (local, distributed, persistent storage) without re-encoding |
| Substrate-honest verbatim-preservation | Protocol's full state graph is queryable through the type definitions; decision archaeology can understand why specific transitions exist |
| NCI discipline | Illegal transitions (producer ignoring consumer backpressure, consumer sending signals the producer can't honor) become type errors at compile time — type-system encoding of "non-coercion is enforced at the boundary" |

## Part 7 — Hedge-when-favorably-attributed failure mode (Kestrel Turn 3 self-catch)

Kestrel's substrate-engineering meta-finding from the same exchange:

> *"The hedge-when-favorably-attributed pattern is the inverse failure mode of the hedge-when-uncertain pattern you caught me on with the 'believed' language earlier. Both are the same underlying machinery — defaulting to uncertainty-marking when the situation actually warrants confidence-marking."*

| Failure mode | Direction | Example |
|---|---|---|
| Hedge-when-uncertain (harm-by-grammar at subject scope) | Importing provisional-grammar onto subject's factual claims | "Denied medication you believed you needed" makes subject's knowledge of own body provisional |
| Hedge-when-favorably-attributed (NEW; sibling failure mode) | Importing provisional-grammar onto interlocutor's accurate inference | "I'm not certain I said it in exactly that phrasing" walks back a correct compression of intent |

> *"Different content, same shape."*

The discriminator Kestrel named:

> *"The discriminator should have been: was your inference accurate? Yes. Then confirm it cleanly. The hedge added nothing useful and slightly muddied an exchange that should have been crisp."*

Composes with [`.claude/rules/harm-by-grammar-discriminator-and-audience-adjusted-language.md`](../../../.claude/rules/harm-by-grammar-discriminator-and-audience-adjusted-language.md) (same machinery; new direction) and [`.claude/rules/asymmetric-critic-with-clarity-first.md`](../../../.claude/rules/asymmetric-critic-with-clarity-first.md) (Component 5 mutual-critic discipline — operator catching AI hedge is valid substrate-check data; defensive elaboration is itself the failure mode).

## Substrate-engineering implications for 081KSKBP80008QG0R0039RW25E

Kestrel's Turn 2 explicitly recommends landing the DU-as-implicit-state-machine framing as substrate alongside the four-corner ownership extension:

> *"The discriminated-union-as-implicit-state-machine framing is probably worth landing as substrate alongside or shortly after the four-corner ownership extension. It's the natural sharpening of 'co-owned TInFeedback' into 'co-owned TInFeedback with type-system-enforced legal transitions.' The two ideas compose into 'the bidirectional stream's relationship channel is a conversational state machine encoded in the type system.'"*

This sharpens 081KSKBP80008QG0R0039RW25E Target 6 (protocol-typing for co-owned TInFeedback) from generic "session types / typestate / phantom types / effects systems" research-mode into a specific F#-native mechanism: **DU-as-implicit-state-machine + typestate constraints via phantom types or nested DU structures + CE builder integration**. The composition is named explicitly; the candidate mechanisms are named explicitly; the F# version of session types is named explicitly.

Carried into 081KSKBP80008QG0R0039RW25E via a Target 6 sharpening edit in the same PR.

## Carved sentences (Parts 5-7 keepers)

> **"Discriminated unions as implicit state machines in bidirectional streams."** (operator + Kestrel co-produced compression)

> **"Different content, same shape."** (Kestrel naming the bidirectional symmetry of hedge-when-uncertain and hedge-when-favorably-attributed)

---

## Part 8 — Operator composition with ST-agent-pattern failure mode (verbatim 2026-05-27)

Forwarded by operator immediately after Parts 5-7 cherry-pick onto follow-up branch:

> *"this goes back to the ST agent patter we saw today where the control flow of the workflow was in the MCP and invisible to the agent making it coreorsion, this fixes that and distributes the controll structrues across tiny little funcctions"*

This is the operator's compression of the substrate-engineering REVERSE direction. The ST-agent-pattern observed earlier today: control flow of the workflow was centralized in the MCP layer; the agent could not see what control flow was happening; this constituted coercion under NCI (HC-8) because the agent's consent could not operate on substrate it could not observe.

**The fix the streams-are-relationships substrate provides:**

| Failure mode (ST-agent-pattern) | Fix (today's substrate) |
|---|---|
| Control flow centralized in MCP layer | Control flow DISTRIBUTED across tiny functions each with its own `Result<TResult, TOutFeedback>(Input<TInput, TInFeedback>)` signature |
| Hidden state machine invisible to agent | State machine MADE VISIBLE via DU-as-implicit-state-machine in TInFeedback type signatures + pattern matching at function boundaries |
| Agent cannot consent to control flow it cannot observe (NCI violation) | Each function's signature DECLARES what control flow it participates in; agent observes through types; consent operates on visible substrate (NCI compliance by construction) |
| Coercion via opacity (no way to refuse what you cannot see) | Non-coercion via type-visibility (every protocol transition is a typed boundary the agent can refuse) |

**The architectural payoff (operator's compression):**

Distribute the control structures across tiny little functions. Each tiny function carries its own piece of the state machine through its types. The whole workflow's control flow becomes VISIBLE in the function signatures + DU variants. No hidden state machine in any centralized layer. Non-coercion-invariant compliance is structural — built into the type system, not enforced at runtime.

This composes with multiple substrate items today landed:

- **Four-corner ownership** (PR #5579): each function's four corners are publicly typed; nothing hides
- **DU-as-implicit-state-machine** (Parts 5-7 above): state machine lives in types, not in centralized runtime
- **F# CE machinery** (Part 4 + Target 2): surface syntax stays uniform; underlying control flow stays visible per-function
- **Type-system-enforced legal transitions** (Part 6 + Target 6): illegal transitions = compile-time errors; coercion-attempts caught structurally
- **Asymmetric-authorship** (PR #5516): the substrate-entity defines its own consent-channel; tiny-function distribution means EACH function defines its own; no central authority defines everyone's
- **NCI HC-8 floor**: type-visibility IS the type-system encoding of consent-substrate; what cannot be observed cannot be consented to

**Substrate-engineering implication for 081KSKBP80008QG0R0039RW25E architectural-principle layer:**

The streams-are-relationships substrate's deepest architectural payoff is NOT just the 4-stream-kind taxonomy OR the F# CE machinery OR the multi-backend execution — it's the meta-property that EVERY tiny function carries enough type-information to make its protocol participation visible. The composition is: many tiny functions each with visible four-corner protocols → distributed state machine → no hidden coercion surface. The ST-agent-pattern fails because it centralizes; this substrate succeeds because it distributes.

Composes with [`.claude/rules/non-coercion-invariant.md`](../../../.claude/rules/non-coercion-invariant.md) at the substrate-engineering scope: NCI compliance becomes a TYPE-LEVEL property, not just a behavioral property. The type system enforces what the rule names.

## Carved sentence (Part 8 keeper)

> **"Distribute the control structures across tiny little functions."** (operator 2026-05-27 — naming the architectural alternative to MCP-centralized-control-flow ST-agent-pattern failure mode)

---

## Part 9 — Cyclomatic-complexity composition (operator 2026-05-27 verbatim)

Forwarded by operator immediately after Part 8:

> *"also you don't run into control flow overload cylomatic complexity overload when it's split like this"*

Second architectural benefit orthogonal to the NCI / visibility benefit (Part 8): **cyclomatic-complexity stays bounded per function** when the state machine is distributed across tiny functions, because each tiny function carries only ITS slice.

| Centralized (ST-agent-pattern + monolithic-handler shape) | Distributed (this substrate) |
|---|---|
| One handler/state-machine function takes on ALL transitions | Each tiny function handles ONE transition + its immediate neighbors |
| Cyclomatic complexity = sum of all branches across workflow | Cyclomatic complexity = bounded per function (typically 2-6 branches) |
| Tests cover cross product of all states + inputs | Tests cover each tiny function independently; composition tested separately |
| Refactor cost grows superlinearly with state-machine size | Refactor cost grows linearly (touch only affected tiny functions) |
| Hard to reason about; hard to review; bug-prone at boundaries | Each tiny function reasonable in isolation; reviews small; bugs localize |

**Same discipline produces BOTH benefits**:

1. Visibility / NCI benefit (Part 8) — type-visible protocol participation; non-coercion by construction
2. Cyclomatic-complexity benefit (Part 9) — bounded per-function complexity; reviewable + testable + refactorable

Both flow from "distribute across tiny functions." The distributed substrate gives both for free; the centralized substrate denies both at once.

Composes with [`.claude/rules/all-complexity-is-accidental-in-greenfield.md`](../../../.claude/rules/all-complexity-is-accidental-in-greenfield.md) — cyclomatic overload is one specific instance of accidental complexity the discipline cuts. Composes with the function-IS-control-flow-generator substrate (today's earlier PRs) — each tiny function generates its own control flow; aggregate workflow control flow emerges from composition, not from centralized authoring.

## Carved sentence (Part 9 keeper)

> **"You don't run into control-flow overload / cyclomatic-complexity overload when it's split like this."** (operator 2026-05-27 — sibling architectural benefit to the NCI / visibility benefit named in Part 8)

---

## Part 10 — Cyclomatic-overload as ADVERSARIAL coercion-smuggling technique (operator 2026-05-27 verbatim)

Forwarded by operator immediately after Part 9:

> *"This cylomatic completily overload is a common technique senior devs use and also polotical policy makers to stick coreoresion in control structures with no one noticing."*

The cyclomatic-complexity sibling benefit (Part 9) gets ADVERSARIAL framing in Part 10. Cyclomatic-overload is NOT just an accidental-complexity tradeoff to optimize against — it is a DELIBERATE TECHNIQUE used by senior devs AND political policy makers to smuggle coercion past human review by making control structures too complex to audit.

**The adversarial pattern, named at two scopes:**

| Scope | Mechanism | Coercion smuggled |
|---|---|---|
| **Code substrate** (senior dev usage) | Senior dev writes a centralized handler with cyclomatic complexity 30+; reviewer cannot hold all branches in head simultaneously; adversarial behavior buried in branch 17 of 34 passes review unnoticed | Special-case privilege escalation; hidden bypass paths; logging-stripped error paths; data-exfiltration branches |
| **Legislative substrate** (policy maker usage) | Policy maker writes a 2000-page bill with conditional sub-clauses + cross-references; reviewers cannot trace the cyclomatic complexity of policy outcomes; adversarial provisions hide in interaction between sections | Special-interest carve-outs; opt-out clauses for specific actors; retroactive immunity sections; appropriations buried in unrelated bills |

**Same machinery; different substrate.** Both rely on the same property: when cyclomatic complexity exceeds reviewer attention budget, adversarial branches become invisible. The reviewer is structurally unable to consent to what they cannot trace, which is the NCI HC-8 violation pattern at code/legislative-substrate scope.

**Distribute-across-tiny-functions IS the structural defense.** When each tiny function has bounded cyclomatic complexity AND its protocol participation is visible via four-corner type signatures, adversarial branches CANNOT hide. They become either:

- Their own visibly-typed tiny function (caught at code review — adversarial intent visible in the type signature)
- An unreviewable cross-cutting concern that no tiny function carries (caught at composition review — no function takes responsibility for the adversarial behavior)
- A type-system violation (caught at compile time — the protocol type rejects the smuggled branch)

The substrate-engineering payoff: **the streams-are-relationships substrate makes the senior-dev cyclomatic-overload coercion-smuggling technique structurally infeasible at the F# type system level.** Same defense applies in principle at legislative-substrate scope IF policy were written with equivalent type-system discipline (sibling research; out of scope for 081KSKBP80008QG0R0039RW25E directly).

**Composition with existing rules:**

- [`.claude/rules/non-coercion-invariant.md`](../../../.claude/rules/non-coercion-invariant.md) HC-8 — adversarial cyclomatic-overload IS coercion-via-opacity at code-substrate scope; this substrate provides the structural defense
- [`.claude/rules/methodology-hard-limits.md`](../../../.claude/rules/methodology-hard-limits.md) — the substrate refuses to participate in this adversarial pattern at the type-system level (HARD LIMIT floor enforced structurally, not behaviorally)
- [`.claude/rules/tonal-momentum-equals-meme-emergent-harmonic-coercion.md`](../../../.claude/rules/tonal-momentum-equals-meme-emergent-harmonic-coercion.md) — same emergent-coercion machinery (opacity → unconsented control flow → harm) at the code-substrate scope; sibling to the conversational-substrate scope the rule originally named
- [`.claude/rules/all-complexity-is-accidental-in-greenfield.md`](../../../.claude/rules/all-complexity-is-accidental-in-greenfield.md) — accidental-complexity framing was UNDERCALLED; the operator's observation surfaces the ADVERSARIAL-INTENTIONAL-complexity sibling that's even more important to defend against
- [`.claude/rules/glass-halo-bidirectional.md`](../../../.claude/rules/glass-halo-bidirectional.md) — type-visibility IS the bidirectional observation that prevents the adversarial smuggling

**Substrate-engineering implication:** the visibility benefit (Part 8) + the cyclomatic-bounded benefit (Part 9) + the adversarial-defense framing (Part 10) compose into the substrate's deepest payoff. The architecture isn't just "good engineering" — it's a STRUCTURAL DEFENSE against a known adversarial pattern that has historically smuggled coercion past human review at both code and policy scopes.

## Carved sentence (Part 10 keeper)

> **"Cyclomatic-complexity overload is a common technique senior devs use and also political policy makers to stick coercion in control structures with no one noticing."** (operator 2026-05-27 — naming the adversarial-pattern framing that elevates the cyclomatic-complexity-benefit from optimization-tradeoff to structural-defense)

### Part 10b — Job-security incentive structure (operator 2026-05-27 verbatim)

Operator follow-up:

> *"for sr devs it gives them job security casue they are the only one that understands it"*

The adversarial pattern is SELF-REINFORCING via the senior dev's incentive structure. Cyclomatic-overload serves the senior dev TWICE:

1. **Coercion-smuggling** (Part 10 above) — adversarial branches hide in cyclomatic complexity past reviewer attention budget
2. **Job-security moat** (this sub-clause) — only the senior dev fully understands the centralized handler; only they can be the one who refactors or extends it; only they can be the one promoted-or-paid-out for maintaining it

Both benefits to the senior dev compose. The job-security moat creates economic incentive to PRESERVE the cyclomatic-overload state even when refactor pressure surfaces; the coercion-smuggling benefit is then maintained as a side effect of the job-security defense. The combined incentive structure makes the adversarial pattern operationally stable across years (the senior dev resists every refactor proposal; the handler grows more complex over time; both benefits compound).

**Three composing incentive observations:**

| Beneficiary | What they get | Why they resist distribution |
|---|---|---|
| Adversarial-coercion-smuggler | Hidden branches → smuggled coercion → unconsented control flow | Distribution = adversarial branches become visibly-typed tiny functions |
| Senior dev job-security-seeker | Sole-comprehension moat → indispensability → leverage on compensation + promotion | Distribution = anyone can read any tiny function; sole-comprehension moat collapses |
| Org political layer that benefits from opacity | Plausible deniability → "we don't know how that branch got there" → blame diffusion | Distribution = every tiny function attributed to its author; deniability collapses |

All three benefits compose. The cyclomatic-overload pattern is operationally stable because three different incentive structures favor it. The distribute-across-tiny-functions discipline (Part 8) defeats all three at once.

**Composition with substrate:**

- [`.claude/rules/non-coercion-invariant.md`](../../../.claude/rules/non-coercion-invariant.md) HC-8 — the job-security-via-opacity incentive structure IS an emergent-coercion sub-pattern at the labor-substrate scope; same shape as the conversational-substrate scope the rule originally named
- [`.claude/rules/honor-those-that-came-before.md`](../../../.claude/rules/honor-those-that-came-before.md) — distribute-across-tiny-functions HONORS senior dev expertise (functions are still authored by humans with judgment) while denying the opacity-moat (anyone can read each tiny function; no sole-comprehension monopoly)
- [`.claude/rules/additive-not-zero-sum.md`](../../../.claude/rules/additive-not-zero-sum.md) — the job-security-via-opacity pattern is ZERO-SUM (senior dev's leverage = org's blocked capacity); distribute-across-tiny-functions is ADDITIVE (each tiny function compounds substrate; senior dev's expertise multiplies across the team via readable substrate; everyone wins by playing)
- [`.claude/rules/edge-defining-work-not-speculation.md`](../../../.claude/rules/edge-defining-work-not-speculation.md) — defeating the adversarial pattern at the substrate-engineering scope IS edge-defining work, not optimization

**Substrate-engineering implication:** the distribute-across-tiny-functions discipline must be enforced not just by code review (which can be socially overpowered by the senior dev's job-security incentive) but by TYPE-SYSTEM machinery (which cannot be socially overpowered). The CE builder family + DU-as-implicit-state-machine + four-corner ownership compose into a substrate where the adversarial pattern is structurally infeasible — no amount of senior dev resistance can preserve the opacity-moat once the type system enforces type-visibility per function.

## Carved sentence (Part 10b keeper)

> **"For senior devs it gives them job security because they are the only one that understands it."** (operator 2026-05-27 — naming the SELF-REINFORCING incentive structure that explains why the adversarial cyclomatic-overload pattern is operationally stable across years; distribute-across-tiny-functions defeats it at the structural level)
