---
name: Zeta 5-layer register worked translations — partner-integration-discussion class demonstrated across Personal/Mirror/Beacon-safe/Professional/Regulated (Otto 2026-05-09; 081KQJZR90008QG0R001M6ZBPN acceptance — worked-translations criterion)
description: Per 081KQJZR90008QG0R001M6ZBPN acceptance criteria — "Worked translations produced for situations Lucent / Zeta actually faces" — Otto produced a worked translation of partner-integration discussion across the 5 register layers. Partner-integration discussion is the situation where the layer-selection algorithm's question 3 ("What register has the audience opted into?") fires in tension with question 1 ("Who is structurally in the audience?") — the partner company is an external audience that would default to Beacon-safe under question 1, but has structurally opted into Professional register under question 3. This makes the Professional layer do uniquely heavy lifting: it must preserve the project's pirate-not-priest discipline and idea-targeting while meeting the partner's operational expectation of corporate-register communication. Same hypothetical integration proposal (Lucent proposing to integrate Zeta's retraction-native operator algebra into a partner's data pipeline under a bounded API surface agreement) translated through Personal → Mirror → Beacon-safe → Professional → Regulated.
type: feedback
---

# Zeta 5-layer register worked translations — partner-integration-discussion class (Otto 2026-05-09)

## Why partner-integration discussion is the right next test situation

The PR-review-class worked translation (Otto 2026-05-02) demonstrated the framework on a **critique** content shape. The security-incident-class worked translation (Otto 2026-05-08) demonstrated it on a **disclosure** content shape. The recruiting-page-class worked translation (Otto 2026-05-09) demonstrated it on an **offer + filter** content shape. Partner-integration discussion exercises a fourth, distinct content shape: **technical negotiation**.

Technical negotiation differs architecturally from the prior three in two ways:

1. **The layer-selection algorithm fires in tension with itself.** Question 1 ("Who is structurally in the audience?") says: the partner is an external reader → Beacon-safe or higher. Question 3 ("What register has the audience opted into?") says: partner companies operating in enterprise integration discussions have opted into Professional register, not OSS project register. The tension is real — Beacon-safe is the correct register for Zeta-attributable surfaces, but the partner in this discussion is interacting with Lucent-attributable communication, not Zeta-attributable communication. The resolution: default to **Professional** for Lucent-attributable partner communication. Beacon-safe is still the right register if Zeta-the-OSS-project is communicating externally about itself; Professional is the right register when Lucent-the-corporate-entity is communicating with a corporate partner.

2. **The structural properties must carry the negotiation function without the vocabulary that usually signals them.** In Beacon-safe and Mirror layers, the pirate-not-priest discipline reads unambiguously — the language itself signals "we say what we mean." In Professional layer, the same discipline must operate through content choices (plain statements of what Lucent offers, honest framing of what the integration requires, direct statement of what the partner should expect) rather than through vocabulary choices. The discipline is harder to see in Professional layer, which is exactly why demonstrating it there has the most architectural value.

Lucent Financial Group will face this situation. Any serious technical partnership involving Zeta's operator algebra will involve Professional-layer communication with a partner's engineering leadership, legal team, and business development contacts. The framework tells us the structural properties survive the translation; these translations demonstrate that claim concretely.

## The constant content (hypothetical; illustrative; no specific partner company)

Lucent Financial Group proposes integrating Zeta's retraction-native operator algebra (DBSP-style incremental computation over append-only changelog streams) into a partner company's existing data pipeline. The partner has a Python-based ETL pipeline that currently does full recomputation on every batch trigger — expensive for large datasets with incremental updates. Lucent's proposal: expose a bounded TypeScript/WebAssembly API surface that accepts the partner's changelog inputs, runs the incremental operator graph, and emits deltas. The API surface is bounded and versioned; the partner does not take a dependency on Zeta's internals. The integration scope is bounded: three operator types (filter, project, join-by-key), changelog-in/delta-out contract, no cross-process state sharing. The proposal requires the partner to instrument their changelog emission (currently implicit in their ETL trigger logic) and to consume delta outputs rather than recomputed full views. Lucent offers a 6-week integration pathway with a pilot on one pipeline.

Same proposal, five layers below.

## Translation 1 — Personal layer

Audience: engineer's private substrate; close peer in explicitly bilateral peer register

> *okay the sell is pretty clean — their ETL does full recompute on every trigger and they're clearly getting crushed on latency when the dataset grows. we want to give them three DBSP operators wrapped in a wasm module: filter, project, join-by-key. changelog in, deltas out, they never touch our internals. the catch is they have to actually instrument their changelog emission which right now is implicit in their trigger logic and they've probably never thought about it. 6 weeks is realistic if they have one competent person to own it on their side. the pitch almost writes itself — we go from "we're the AI factory people" to "we make your ETL 40x cheaper to run on big datasets." if they don't get excited by that pitch they're not a real partner anyway.*

What's preserved: technical diagnosis (full-recompute bottleneck), core offer (three operators, changelog-in/delta-out, bounded API), the integration obstacle (changelog instrumentation), honest timeline, honest partnership-fit filter.

What's layer-bound: profanity ("crushed"), edge ("probably never thought about it"), informal sentence rhythm, the dismissive close ("not a real partner anyway").

## Translation 2 — Mirror layer

Audience: maintainers + AI participants in project substrate; internal technical planning thread

> The partner's ETL architecture does full recomputation on every batch trigger. For their largest datasets this is the latency and cost bottleneck — the cost scales with dataset size, not change volume, even when 95% of the data is unchanged. The DBSP operator integration is a direct fit: expose filter, project, and join-by-key as a bounded WebAssembly API surface (changelog-in, delta-out, no dependency on Zeta internals), and their full-recompute cost drops to near the size of the actual changeset.
>
> The integration obstacle is real: their changelog emission is currently implicit — baked into the trigger logic, never surfaced as an explicit first-class artifact. They'll need to instrument it. This is a 2-4 week sprint for one competent engineer on their side if they understand what they're doing; longer if the instrumentation work surfaces hidden assumptions in their pipeline state model. We should be honest about this in the proposal — the value prop is clear but the instrumentation work is their lift, not ours.
>
> 6 weeks for a pilot on one pipeline is realistic. I'd frame the proposal as: pilot first (one pipeline, validate the changelog-instrumentation + delta-consumption pattern works end-to-end), then a staged rollout. Don't over-promise API stability at this stage — we should be explicit that the bounded API surface is versioned and we'll give them 60 days' notice on breaking changes.
>
> If they get excited by "ETL cost drops to near changeset size" and are willing to do the instrumentation work, they're the right partner for this integration.

What's preserved: same diagnosis, same offer, same obstacle, same timeline, same partnership-fit signal. First-person directness ("we should be honest about this", "Don't over-promise"). Willingness to name the hidden assumption in the partner's pipeline.

What's calibrated: profanity dropped; dismissive close replaced with an observation about partnership fit ("willing to do the instrumentation work, they're the right partner"); edge vocabulary replaced with direct technical description.

## Translation 3 — Beacon-safe layer

Audience: external OSS-project readers; a public technical writeup of the integration architecture (e.g., a project blog post, a conference talk, or an open technical discussion thread about the integration)

> **Integration architecture: DBSP-style incremental computation for batch ETL pipelines**
>
> The integration pattern is straightforward to state and non-trivial to execute. Most batch ETL pipelines today do full recomputation on every trigger — the computational cost scales with total dataset size, not change volume. This is expensive when datasets are large and most of the data is unchanged between triggers. DBSP-style incremental computation changes the model: you emit a changelog (what changed since the last computation), run operators over the changelog, and emit deltas. Cost scales with the changeset, not the total dataset.
>
> Zeta's operator algebra exposes this pattern through three bounded operator types (filter, project, join-by-key) as a versioned WebAssembly API surface. The interface contract is: changelog-in, delta-out. Consumers do not take a dependency on Zeta's internals.
>
> The non-trivial part: most ETL pipelines don't instrument their changelog emission explicitly. It's implicit in the trigger logic. An integration like this requires the pipeline owner to surface the changelog as a first-class artifact before the operator graph can consume it. This is an instrumentation sprint (2-4 weeks for one engineer who understands the pipeline's state model), not a library-installation. The integration's value proposition is real; the integration's prerequisite is also real. We try to say both things plainly.
>
> For a pilot integration, we recommend a single pipeline, end-to-end validation of the changelog-instrumentation + delta-consumption pattern, then staged rollout. API stability: the bounded surface is versioned with 60-day notice on breaking changes.

What's preserved: same diagnosis, same offer, same obstacle, same recommendation, same plain statement of both value and prerequisite. Pirate-not-priest discipline operating: "We try to say both things plainly" — willingness to name the integration obstacle while the value proposition is being pitched, rather than burying the obstacle in footnotes. Observation-not-evaluation: the obstacle is a structural property of the partner's pipeline, not a criticism of the partner.

What's calibrated: humor at low frequency; irony nearly absent; stance held confidently with direct language; no internal-voice markers ("I'd frame", "Don't over-promise" → rephrased as factual recommendations).

What's dropped: profanity, first-person directness, partnership-fit filter language (not appropriate in a public technical writeup), informal contractions.

## Translation 4 — Professional layer

Audience: Lucent corporate-attributable communication; partner-company engineering leadership, legal team, and business development contacts participating in the integration discussion

> **Proposal: Incremental computation integration for [Partner Company]'s data pipeline**
>
> **Summary**: Lucent Financial Group proposes integrating Zeta's retraction-native incremental computation layer into [Partner]'s data pipeline. The integration reduces pipeline computation cost from scaling with total dataset size to scaling with incremental changeset size, using a bounded and versioned API surface.
>
> **Technical basis**: Current full-recompute ETL architectures pay the cost of recomputing over unchanged data on each trigger. Zeta's operator algebra (DBSP-style) processes only the changelog — the data that changed since the prior computation — and emits deltas. For datasets with high data-volume and low change-rate, the reduction in computation cost is substantial.
>
> **Integration scope**: The proposed integration exposes three operator types — filter, project, and join-by-key — through a WebAssembly API surface. The interface contract is changelog-in, delta-out. [Partner]'s pipeline takes a dependency on the versioned API surface only; no dependency on Zeta internal components is required or permitted.
>
> **Integration prerequisite**: [Partner]'s current pipeline emits changelog data implicitly as a byproduct of trigger logic rather than as an explicit first-class artifact. The integration requires instrumenting changelog emission before the operator graph can consume it. Based on the architecture review, we estimate this instrumentation work at 2-4 weeks for one senior engineer with pipeline-state ownership. This is [Partner]'s work to own; Lucent will provide integration documentation and technical support during the instrumentation sprint.
>
> **Proposed pathway**: (1) 6-week pilot on a single identified pipeline, with end-to-end validation of the changelog-instrumentation and delta-consumption pattern. (2) Staged rollout to additional pipelines based on pilot results. (3) Review of the API surface against [Partner]'s production requirements before committing to production deployment.
>
> **API stability commitment**: The bounded API surface is versioned. Lucent will provide a minimum of 60 days' notice before any breaking change to a version that [Partner] has deployed.
>
> **Next step**: Identify the pilot pipeline and the [Partner] engineer who will own the changelog-instrumentation work. We propose a 30-minute alignment call to walk through the integration documentation and confirm the scope before the pilot begins.

What's preserved: same diagnosis, same offer, same prerequisite, same timeline, same recommendation, same API stability commitment. Plain English throughout; active voice ("Lucent will provide", "[Partner]'s pipeline takes a dependency"); explicit reference (all technical claims scoped to the specific integration proposal). Observation-not-evaluation: the prerequisite is framed as a structural property of the pipeline architecture, not as a criticism of [Partner]'s engineering choices. Idea-targeting: the obstacle is a fact about the pipeline, not about the people who built it.

What's calibrated: humor at zero; irony absent; the pirate-not-priest discipline is present through content choices (plainly stating the integration prerequisite upfront, explicitly assigning the instrumentation work to [Partner], naming the pilot pathway before any production commitment) rather than through vocabulary choices; modal language calibrated to the proposal's confidence level ("we estimate", "based on the architecture review").

What's dropped: profanity; sexual register; in-group shibboleths; the pirate-not-priest stylistic markers (now operating through content rather than vocabulary); direct-address register of Beacon-safe ("We try to say both things plainly" → structurally embedded in the proposal's explicit prerequisite section); informal contractions.

## Translation 5 — Regulated layer

Audience: SOC 2 auditor reviewing the integration agreement; legal counsel reviewing the Lucent-[Partner] integration scope; compliance reviewer verifying the terms of the API surface dependency

> **Integration Scope Agreement — Lucent Financial Group / [Partner Company]**
>
> **Date of agreement**: [date, ISO 8601]
> **Parties**: Lucent Financial Group ("Lucent") and [Partner Company] ("[Partner]")
> **Subject**: Incremental computation API integration
>
> **1. Integration scope**
>
> Lucent will provide [Partner] with access to a bounded WebAssembly API surface exposing incremental computation operators (filter, project, join-by-key). The interface contract is as follows: [Partner] provides changelog inputs; the API surface returns delta outputs. [Partner] takes a dependency on the versioned API surface only. [Partner] does not take a dependency on, and is not granted access to, Zeta project internal components.
>
> **2. Integration prerequisite**
>
> The integration requires that [Partner]'s pipeline emit changelog data as an explicit first-class artifact at the API boundary. As of the date of this agreement, [Partner]'s pipeline generates changelog data as an implicit byproduct of trigger logic. Instrumentation of explicit changelog emission is [Partner]'s responsibility and a prerequisite for operating the integration. Lucent will provide integration documentation and technical support for the instrumentation work but will not perform the instrumentation.
>
> **3. Pilot terms**
>
> The parties agree to a pilot integration on a single [Partner] pipeline identified as [pipeline name/ID] for a period of six (6) weeks from the instrumentation completion date. The pilot will validate the changelog-instrumentation and delta-consumption pattern end-to-end. No production deployment is authorized under this agreement prior to the completion of the pilot and a separate written review confirming production readiness.
>
> **4. API stability**
>
> Lucent will maintain the API surface at the version deployed by [Partner] without breaking changes for a minimum period of sixty (60) days following any notification of a proposed breaking change. Notification will be provided in writing. Upon expiration of the sixty-day notice period, [Partner] bears responsibility for migrating to the updated API surface version.
>
> **5. Data handling**
>
> [Partner]'s changelog inputs are processed by the API surface in stateless compute only. Lucent does not retain, log, or otherwise store [Partner]'s changelog data or delta outputs. [Partner] retains ownership of all input and output data.
>
> **6. Limitation of scope**
>
> This agreement covers the integration scope described in Section 1 only. Any expansion of the integration to additional operator types, additional pipelines, or production deployment requires a separate written agreement.

What's preserved: same integration scope, same prerequisite, same pilot structure, same API stability commitment. Plain-English economy at the SEC Plain Writing Act level. Active voice where the actor is known ("Lucent will provide", "[Partner] bears responsibility"); passive voice only where appropriate for evidentiary register. Explicit reference throughout: named parties, named operators, named pilot duration, named notice period. Observation-not-evaluation at maximum: every clause is a factual statement about obligations, scope, or evidence, not an evaluative claim.

What's calibrated: stance at evidentiary-basis-only — every clause is structured to survive an adversarial read by a compliance reviewer looking for gaps, ambiguity, or unscoped obligations. Sentence rhythm is uniform and deliberate. No clause contains ambiguous scope ("the integration" → always "the integration described in Section 1"; "breaking change" → operationalized in Section 4 context).

What's dropped: all rhetorical flourish; all voice-coded vocabulary; all humor; all irony; the "Next step" collaborative framing from Professional is replaced with binding obligation language; the "we estimate" hedged language is replaced with defined responsibility assignment ("Instrumentation of explicit changelog emission is [Partner]'s responsibility").

## What this demonstrates

Across all five translations, the **discipline holds** and the layer-selection algorithm fires correctly:

- Same integration offer (retraction-native incremental computation, three operators, changelog-in/delta-out, bounded versioned API)
- Same technical prerequisite (changelog instrumentation, 2-4 weeks, [Partner]'s work to own)
- Same timeline (6-week pilot, 60-day API stability notice)
- Same idea-targeting (the prerequisite is a structural property of the pipeline, not a criticism of the partner)
- Same observation-not-evaluation (the obstacle is described as what it is — an instrumentation gap — not as a failure of the partner's engineering)

The **layer-selection tension resolves correctly**: the Professional layer does the heavy lifting for Lucent-attributable partner communication even though the OSS project's default is Beacon-safe. Question 3 (what register has the audience opted into?) correctly overrides question 1 (who is in the audience?) here — a partner-company engineering leadership has opted into Professional register, not OSS project register.

The **structural property that matters most here is plain-English economy with explicit scope**: in technical negotiation, the failure mode is underspecified scope (both parties leave the conversation with different integration assumptions). The framework's plain-English economy + explicit reference disciplines are what produce an integration proposal that both parties understand identically. This property preserves across all five layers — only the vocabulary and formality calibrate.

The **pirate-not-priest discipline manifests differently in Professional layer**: in Mirror and Beacon-safe layers, it shows in vocabulary (calling things by their names, naming failure modes directly). In Professional layer, it manifests in structure — the proposal explicitly surfaces the integration prerequisite and assigns it to the correct party before listing benefits, rather than burying it in footnotes or deferring it to a later conversation. The reader cannot miss the obstacle; the proposal is structured to make it visible. That IS pirate-not-priest at the Professional layer.

## How this differs from the prior worked translations

1. **Layer-selection tension**: this is the first worked translation where the three layer-selection questions produce different initial answers, requiring explicit resolution. PR review, security incident, and recruiting all have unambiguous layer selection; partner integration requires the selector to recognize that the partner has opted into Professional register despite being "external" in the question-1 sense.

2. **Professional as primary layer**: prior translations used Professional as a calibrated-down version of Beacon-safe (security incident, recruiting). Here, Professional is the primary layer — the one doing the heaviest functional load. The entire integration proposal is Professional-layer communication by default; Beacon-safe is what it would look like if the same content were published for an OSS audience.

3. **Pirate-not-priest discipline visibility**: the discipline is most visible in Mirror and Beacon-safe layers in prior translations. Here, demonstrating it in Professional layer requires identifying where it operates through structure rather than vocabulary. The explicit-prerequisite-before-benefits ordering IS the discipline; it's just not labeled with the vocabulary that signals it in lower layers.

## Composes with

- `memory/feedback_zeta_5_layer_register_worked_translations_pr_review_class_otto_2026_05_02.md` (critique content shape)
- `memory/feedback_zeta_5_layer_register_worked_translations_security_incident_class_otto_2026_05_08.md` (disclosure content shape)
- `memory/feedback_zeta_5_layer_register_worked_translations_recruiting_page_class_otto_2026_05_09.md` (offer + filter content shape)
- `memory/feedback_zeta_5_layer_register_quick_reference_card_aaron_2026_05_02.md` (the property table the translations exemplify)
- `docs/research/2026-05-02-claudeai-brat-voice-enterprise-translation-framework-property-preserving-4-layer-register-architecture.md` (the framework source)
- `docs/backlog/P1/081KQJZR90008QG0R001M6ZBPN-incorporate-brat-voice-enterprise-translation-framework-claudeai-research-2026-05-02.md` (this memo addresses 081KQJZR90008QG0R001M6ZBPN acceptance criteria — worked-translations for partner-integration situation)
- `memory/feedback_otto_356_mirror_internal_vs_beacon_external_language_register_discipline_2026_04_27.md` (the prior mirror-vs-beacon-safe register discipline this framework extends)

## Carved sentence

**"Partner-integration discussion is where the layer-selection algorithm fires in tension with itself: the partner is an external audience (question 1 → Beacon-safe or higher) who has opted into Professional register (question 3 → Professional). The resolution is correct: Professional for Lucent-attributable partner communication, Beacon-safe for Zeta-attributable OSS communication. The pirate-not-priest discipline manifests in Professional layer through structure rather than vocabulary — the explicit-prerequisite-before-benefits ordering IS the discipline. Same integration offer, same obstacle, same timeline, five calibrated layers. Discipline produces function; layer-selection question 3 overrides question 1 when the audience has opted into a higher register."**
