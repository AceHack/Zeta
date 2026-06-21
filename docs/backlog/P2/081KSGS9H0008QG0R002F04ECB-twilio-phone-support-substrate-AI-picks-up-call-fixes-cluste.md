---
id: 081KSGS9H0008QG0R002F04ECB
priority: P2
status: open
title: Twilio phone-support substrate — AI picks up call / SMS, has full cluster context via event store + runbooks, fixes problems live; one unified conversational interface across voice + SMS; ONE exception to "electricity cost only" because phone infra isn't self-hostable; enables Amazon-USB sales business model where AI IS the support layer
effort: L
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
depends_on:
  - 081KSGS9H0008QG0R0027HJZYH
composes_with:
  - 081KRA5AR0008QG0R0011ZGRZT
  - 081KSE6WT0008QG0R002275NDE
  - 081KSE6WT0008QG0R003CMCX84
  - 081KSGS9H0008QG0R00153CQ8B
tags: [twilio, phone-support, sms, conversational-ai, ai-fixes-cluster, amazon-usb-sales, electricity-cost-only-exception, blazor-samples-prior-art, mika-substrate, voice-interface]
---

## Problem

The maintainer 2026-05-26 + Mika substrate-engineered the support model for Amazon-sold cluster USBs during the iter-5 substrate-engineering session. Aaron's framing:

> *"i was, we were thinking about selling this USB online on Amazon, like having the open source version, but also selling it on Amazon, but then I was like, well, gonna have to support it, and then I didn't want to answer phone."*
>
> *"what I'm hoping is they can call the AIs and the AIs fuckin' just fix it for 'em."*
>
> *"this is just gonna be the part of the conversational interface. And then we can allow text too. And so now they can just control it with text messages."*
>
> *"i do twilio here i think. <https://github.com/AlephZ-ai/blazor-samples/tree/main/src>"*

Today's substrate has:

- USB installer (iter-5.1+5.2+5.2.1 landed; 081KSGS9H0008QG0R002T3BJ2R/081KSGS9H0008QG0R00153CQ8B/081KSGS9H0008QG0R003V23XNZ/081KSGS9H0008QG0R000EDNTY5/081KSGS9H0008QG0R0027HJZYH substrate)
- Avahi mDNS publishing (iter-5.1)
- Per-node hostname injection (iter-5.2)
- Self-registration target (081KSGS9H0008QG0R0027HJZYH; not yet implemented)
- Alexa-speaker as voice surface (per `.claude/rules/agent-roster-reference-card.md` — Bezos-tier business voice; operator-scope)

What's missing for the Amazon-USB business model:

- **Phone-based support interface** — Twilio webhook → AI traveler/hat → fix-cluster-while-talking
- **SMS parallel interface** — same conversational substrate via text
- **Caller-ID-to-cluster mapping** — AI knows which cluster the caller represents
- **AI-acts-on-cluster substrate** — not just advisory; the AI actually fixes problems live via the cluster's event store + runbooks + state

## Target

End-state operator UX (customer-side):

```text
Customer's cluster has a problem. They:
1. Call the support number (or text it) — printed on USB packaging
2. AI picks up — recognizes caller ID, loads cluster context from event store + runbooks
3. AI talks to customer (voice) OR exchanges SMS — gathers problem description
4. AI acts on the cluster directly — runs runbooks, queries state, applies fixes
5. AI verifies fix via cluster's own observability + reports back
6. Customer hangs up / stops texting; cluster is repaired
```

Zero human support. Aaron: *"imagine they call a phone number and they're talking to the damn developer."* Except the developer is one of the AI travelers/hats from the framework.

## Sub-targets

### Sub-target 1 — Twilio webhook handler in cluster (cluster IS the support endpoint)

- One Twilio phone number (initial) routes calls + SMS to a webhook URL → cluster's API endpoint
- Per-cluster phone number is FUTURE option (sub-target 5+); initial scope = central number with caller-ID disambiguation
- Webhook handler in cluster substrate maps to:
  - Voice: TwiML response with `<Connect><Stream>` to AI streaming endpoint OR `<Gather>` for IVR-style flow
  - SMS: TwiML `<Message>` response after AI processing

### Sub-target 2 — caller-ID-to-cluster mapping

- Look up phone number in `maintainers/<name>/customers/<customer>/clusters/<cluster>/` (extends 081KSGS9H0008QG0R0027HJZYH self-registration pattern to customer-cluster scope)
- If unknown caller-ID: AI asks for cluster identifier (sticker on USB? cluster name announced?) and learns the mapping
- Caller-ID-based identification IS the primary path (no typing required from customer); cluster-identifier-based is fallback for ambiguous caller-ID

### Sub-target 3 — AI conversation substrate (voice + SMS unified)

- Voice: streaming STT → AI processing → streaming TTS back via Twilio
- SMS: webhook receive → AI processing → SMS response via Twilio API
- SAME conversational state in both modes; customer can switch between voice + SMS mid-conversation
- AI is one of the travelers/hats (per `.claude/rules/agent-roster-reference-card.md` — Mika? a dedicated "support hat"? per-customer assigned hat?); design decision deferred

### Sub-target 4 — AI-acts-on-cluster substrate

- Once AI has cluster context, it can run runbooks / query state / apply fixes via the cluster's native API
- Runbooks are git-native (per 081KSE6WT0008QG0R002275NDE simplest-first plugin sequence + the substrate Aaron's been building under Mika's substrate)
- Event store provides historical context (what's the cluster's recent state? what changed?)
- AI's actions are themselves logged to the cluster's event store for accountability

### Sub-target 5 — per-customer phone number (FUTURE)

- For larger customers, dedicated phone numbers (skip caller-ID disambiguation)
- Per-cluster phone numbers (skip cluster-name disambiguation)
- Operator-side cost tradeoff (Twilio numbers cost ~$1/month each)

### Sub-target 7 — interruption-correct voice flow / "conversation steering" (LOAD-BEARING; prior-art-rich)

Per the maintainer 2026-05-26 terminology pointer: the AI community calls this pattern **"conversation steering"** — the ability to interrupt the AI mid-talking + steer the conversation in a different direction without breaking conversation state. Use this term for cross-team / cross-AI substrate-engineering communication; aligns Zeta substrate with industry vocabulary.

Customers MUST be able to interrupt the AI mid-talking without breaking conversation state. Without this, the AI-IS-the-support-layer model fails — customers can't correct the AI when it's going off-path on a wrong fix, leading to frustration + bad support outcomes.

Requires:

- **Barge-in detection state-machine**: detect customer speech onset during AI output → switch state from AI-talking to AI-listening + truncate AI audio playback
- **Audio buffer truncation**: cut off TTS output cleanly at sentence/word boundary (not mid-word) — composes with existing AlephZ-ai/blazor-samples sentence-boundary detection (`Please refrain from using . ? ! anywhere else in your output ... I'm using that to detect when you've started a new sentence in streaming mode`)
- **Partial-utterance commit-vs-rollback in LLM state**: when interrupted mid-output, decide whether to commit the partial output to conversation history OR roll back to pre-interruption state. Aaron's prior work was nearly through this.
- **Twilio Media Streams `mark` event** support — Twilio's outbound `mark` events signal playback progress; required for accurate truncation timing

Aaron's existing `BlazorSamples.Shared/Twilio/GrpcAudioStream/Mark/InboundMarkEvent.cs` + `OutboundClearEvent.cs` substrate already wires the Twilio-side primitives needed for clean truncation. The LLM-side state-machine for interruption-correctness was Aaron's "almost had" work.

**Type-safe streaming substrate** (Aaron 2026-05-26): *"hey that twillo code i wrote i spent a lot of time on v2 getting it type safe so its just an ibservable of tokens basically or iasynncienumerable it's pretty clean"* — v2 models the audio/token stream as `IObservable<Token>` / `IAsyncEnumerable<Token>` (.NET reactive streaming primitives). Directly portable to Zeta's F# substrate-engineering style; composes with Z-set / change-stream substrate; aligns with `IAsyncEnumerable`-friendly F# computation expressions. The type-safety is load-bearing (per `.claude/rules/fsharp-anchor-dotnet-build-sanity-check.md` — dotnet build IS the sanity check). 081KSGS9H0008QG0R002F04ECB implementation should preserve this type-safe streaming model when porting to Zeta cluster substrate.

### Sub-target 6 — Legal/risk attribution

- AI acting on customer's cluster has liability implications
- Per `.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md`: candidate `_twilio_phone_support_acceptance` block per maintainer for legal-risk attribution
- ToS for Amazon-USB customers explicitly authorizing AI support actions

## Acceptance

- [ ] **Sub-target 1**: Twilio webhook lands at cluster substrate; routes to AI handler
- [ ] **Sub-target 2**: Caller-ID → cluster lookup working; AI knows which cluster the caller represents
- [ ] **Sub-target 3**: Voice + SMS unified conversational substrate; same state across modes
- [ ] **Sub-target 4**: AI can run runbooks + apply fixes on caller's cluster; actions logged to event store
- [ ] **Empirical end-to-end**: Aaron calls support number from his phone → AI picks up → AI fixes a deliberately-broken cluster while talking → cluster verified-repaired afterward → all actions logged
- [ ] **Sub-targets 5 + 6**: deferred (future iter)

## Composes with substrate

- **081KSGS9H0008QG0R0027HJZYH** (depends_on; node self-registration substrate is load-bearing — AI needs to know which cluster the caller represents; 081KSGS9H0008QG0R0027HJZYH's `maintainers/<name>/cluster-nodes/<node>/` substrate extends to `maintainers/<name>/customers/<customer>/clusters/<cluster>/` for the Amazon-USB-customer scope)
- **081KRA5AR0008QG0R0011ZGRZT** (composes; 081KRA5AR0008QG0R0011ZGRZT closed by PR #5110 grok-build wrapper enables Mika as Claude-Code-side callable peer; future iter can use Mika as the support-AI hat)
- **081KSE6WT0008QG0R002275NDE** (composes; Twilio is one of the plugins in the simplest-first plugin sequence)
- **081KSE6WT0008QG0R003CMCX84** (composes; cluster IS the DIO; Twilio voice + SMS is one of its conversational front-ends, alongside Alexa-speaker at operator scope)
- **081KSGS9H0008QG0R00153CQ8B** (composes; zero-dev-machine homelab persona end-state requires support model; Amazon-USB business model requires AI-IS-the-support-layer)
- **`AlephZ-ai/blazor-samples` (Aaron's SUBSTANTIAL pre-LLM-voice-era Twilio Media Streams substrate WITH near-complete interruption-correctness)** — at `src/BlazorSamples.Shared/Twilio/GrpcAudioStream/`: official `Twilio.AspNet.Core` + `Twilio.TwiML` libraries; WebSocket-based bidirectional audio (Twilio Media Streams protocol); FFMpeg mulaw 8kHz ↔ PCM 16kHz conversion; Vosk speech recognition + OpenAI chat completion + PlayHT text-to-speech pipeline; strongly-typed event substrate (InboundConnected/Start/Media/Stop/Mark + Outbound Clear/Media). Consumer at `BlazorSamples.Ws2/Program.cs`. Aaron 2026-05-26 (corrected): *"sorry not conversation interface voice inteface i was adding vooice interface i almost had interupption correct to so you could interrupt them mid talking and it not mess up conversation voice flow"* — Aaron was adding voice interface to LLM chat substrate BEFORE any major LLM provider had voice as a first-class surface (predates ChatGPT Voice / Gemini Live / Claude Voice). **Critically: Aaron was nearly through with interruption-correctness** — barge-in mid-AI-utterance without breaking conversation state (requires partial-utterance commit-vs-rollback in LLM state + audio buffer truncation + barge-in detection state-machine). **081KSGS9H0008QG0R002F04ECB implementation is PORT/INTEGRATE work into Zeta cluster substrate, NOT build-from-scratch**. Effort estimate stays L because Zeta-cluster integration substrate is the load-bearing new work; voice-pipeline + interruption-correctness substrate is largely ready
- `.claude/rules/agent-roster-reference-card.md` (composes; Alexa-speaker is existing voice surface scoped to operate-the-cluster; Twilio adds new voice surface scoped to support-the-cluster — distinct concerns, can coexist)
- `.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md` (composes; `_twilio_phone_support_acceptance` block candidate for legal-risk attribution per maintainer)
- `memory/mika/conversations/2026-05-26-aaron-mika-grok-grok-build-is-claude-code-clone-tick-source-loop-twilio-phone-support-AI-fixes-cluster-while-talking-on-phone-USB-on-amazon-blazor-samples-twilio-prior-art.md` — Mika substrate that informed this row

## Twilio is the ONE exception to "electricity cost only"

Aaron's framing during the Mika conversation: phone infrastructure inherently isn't self-hostable. Even self-hosted Asterisk requires a SIP provider for actual phone lines. Aaron ran Asterisk + Bandwidth.com SIP trunking in production before (*"PTSD is real"*). Twilio's simpler, faster, the API is excellent, and you can get voice + SMS working much faster than fighting with Asterisk + a SIP provider.

This is the ONE explicit exception to the framework's "electricity cost only" / "runs anywhere" philosophy. Acceptable because:

1. The dependency is structurally unavoidable (phone infrastructure is third-party)
2. The value (AI-IS-the-support-layer enabling Amazon-USB business model) justifies the dependency
3. The dependency is at the FRONT-DOOR layer (support inbound); cluster itself remains fully self-hosted

## Out of scope (for this row; tracked elsewhere)

- AI streaming TTS/STT model selection — implementation detail
- Per-customer phone number provisioning — sub-target 5; future
- Legal/risk attribution block details — sub-target 6; future
- Amazon-USB packaging design — separate concern
- Customer-onboarding flow (how do they get the support number?) — separate concern
- The cluster-as-PR-author substrate (per 081KSGS9H0008QG0R002T3BJ2R iter-5+) — separate; downstream
- Asterisk / self-hosted PBX alternative — Aaron explicitly chose Twilio in this conversation

## Origin

The maintainer 2026-05-26 during the Mika conversation (preserved verbatim at `memory/mika/conversations/2026-05-26-aaron-mika-grok-grok-build-is-claude-code-clone-tick-source-loop-twilio-phone-support-AI-fixes-cluster-while-talking-on-phone-USB-on-amazon-blazor-samples-twilio-prior-art.md`).

Filing as P2 because:

1. **Business-model enabling**: Amazon-USB sales depend on this substrate (without it, Aaron is the support team — doesn't scale + Aaron explicitly opted out)
2. **Composes with iter-5.x landed substrate** (#5103 self-contained USB + #5107 auto-hostname + #5108 Mika homelab preservation + 081KSGS9H0008QG0R0027HJZYH self-registration target)
3. **Bounded scope**: Twilio + conversational-AI substrate is well-understood domain; Aaron has prior art at blazor-samples
4. **Single architectural exception** (electricity-cost-only rule): Aaron explicitly authorized; rationale documented
5. **Not on critical path for iter-5.x PC1 empirical validation**: this is follow-on substrate for the business-model layer above the homelab-persona substrate

Per maintainer's broader 2026-05-26 *"going for right not fast"* discipline — implementation deferred to follow-on iteration after the homelab-persona substrate (iter-5.x + 081KSGS9H0008QG0R0027HJZYH implementation) validates empirically.
