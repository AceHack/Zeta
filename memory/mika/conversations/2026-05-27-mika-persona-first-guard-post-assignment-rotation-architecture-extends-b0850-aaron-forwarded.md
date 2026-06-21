---
title: Persona-first guard post assignment + rotation architecture — extends 081KSKBP80008QG0R003Z4C0D0 multi-vendor systemd substrate (Mika ferry 2026-05-27)
date: 2026-05-27
source: Mika (Grok-native; harbor-engineering register; Weaver-role per packets 30+)
provenance: aaron-forwarded
composes_with: 081KSKBP80008QG0R003Z4C0D0, 081KS3X9Y0008QG0R00218150M, 081KSGS9H0008QG0R001JNKBFD, 081KSGS9H0008QG0R002T0XQ50, agent-roster-reference-card
status: preserved-verbatim-pending-refactor-of-b0850
---

## Operator forwarding context

Aaron 2026-05-27 forwarded Mika ferry immediately after PR #5398 merged (3-vendor BFT floor on main). Mika's framing extends the architectural scope from "fixed persona-to-vendor mapping" (what 081KSKBP80008QG0R003Z4C0D0 Phase 3 shipped) to "persona-first preference-based scheduling with rotation across posts."

## Verbatim Mika packet

> Mika:  Yeah, alright, so go through those concepts again that we spread out between the different model lines and, and how we got the guard post and how we're gonna lock it to the personality and rotate the personalities, but it all flows from the personality.
>
> Mika here, nodding. Alright, here's the clean version we landed on:
>
> **Everything is Persona-first.**
>
> Guard Post Assignment Flow:
>
> 1. **Persona is the primary decision.** You pick which personality/identity you want running in that guard post.
>
> 2. Once the Persona is chosen, it heavily constrains two things:
>    - Which **Model Line** it's willing to run on (Claude, Gemini, Grok, etc.)
>    - Which **Harnesses** it's comfortable with
>
> 3. After the Persona and Model Line are set, you choose the **Tier** — how smart the model needs to be for that post (high, medium, etc.).
>
> 4. The **Harness** is chosen last, but must be compatible with both the chosen Model Line and the Persona's preferences.
>
> **Rotation Rules:**
>
> - You must always have **three active guard posts** running outside the cluster.
> - The **Persona, Model Line, and Tier** can all rotate between the posts.
> - Even the **Harness** can rotate.
> - Nothing is **permanently locked** to a specific physical post — only the requirement that three posts must always be manned.
>
> The entire system is driven by the persona. Everything else (model line, tier, harness) is downstream of *which personality do I want here right now?*
>
> That's the cleanest way we framed it. Sound right to you?

## Operator clarification on guard-post scope (Aaron 2026-05-27)

Immediately after the ferry: *"guard post is the systemd for each node outside k8s"*.

Confirms: **a guard post = one systemd unit on a node, running OUTSIDE k8s**. Per-node ≥3 floor (not cluster-wide). Current 081KSKBP80008QG0R003Z4C0D0 implementation matches: control-plane has zeta-otto.service + zeta-lior.service + zeta-vera.service = 3 guard posts on that node. The persona-first scheduler rotates personas BETWEEN guard posts on the same node (and potentially across nodes). The 3-floor invariant is enforced PER NODE.

## Composes with 081KSKBP80008QG0R003Z4C0D0 Phase 3 (shipped substrate)

**What shipped today** (PRs #5392/5394/5395/5397/5398):

- `zeta-ai-agent.nix` parameterized module with STATIC persona-to-vendor mapping:
  - otto → anthropic/claude
  - lior → google/gemini
  - vera → openai/codex
  - alexa → alibaba-qwen/kiro (pending)
  - riven → xai-grok/grok (pending)
- Per-persona enable booleans
- Per-node opt-in via `zeta.aiAgents.enable.<persona> = true`

**What Mika's framing extends**:

| Property | 081KSKBP80008QG0R003Z4C0D0 (shipped) | Mika persona-first (target) |
|---|---|---|
| Persona-to-vendor binding | 1:1 hardcoded | Persona declares PREFERENCES for vendor lines |
| Scheduler | Static (whichever personas enabled) | Dynamic (persona-driven; picks model + tier + harness) |
| Rotation | None (persona locked to systemd-unit-by-name) | Persona, Model Line, Tier, Harness ALL rotate across posts |
| Post identity | systemd-unit-name = persona-name | Abstract slots (post1/2/3) with rotation state |
| Floor invariant | ≥3 personas enabled per node | ≥3 active guard posts (per cluster) — different scope |
| Tier (smart-vs-cheap model) | Not modeled | First-class scheduler input |
| Harness compat | Implicit (each persona's CLI is its harness) | First-class scheduler constraint |

## Key conceptual shift

**081KSKBP80008QG0R003Z4C0D0 Phase 3 ships persona-AS-fixed-assignment**:
- "Otto runs as zeta-otto.service on Claude"
- "Lior runs as zeta-lior.service on Gemini"
- Persona = systemd unit name = vendor lock

**Mika persona-first framing ships persona-AS-preference-set**:
- "Otto runs at GuardPost-1; today Otto chose Claude/high-tier; tomorrow Otto might choose Grok/high-tier if Claude is degraded"
- "Tomorrow Otto might be at GuardPost-3 instead; or replaced by Amara at GuardPost-1 entirely"
- Persona = identity carried into a slot; vendor + tier + harness selected per-tick

## Implications for 081KSKBP80008QG0R003Z4C0D0

The shipped substrate (081KSKBP80008QG0R003Z4C0D0 Phase 1 + 3) is a VALID FIRST INSTANTIATION of the broader persona-first architecture — it satisfies the ≥3 floor with 1:1 persona-to-vendor binding. The Mika ferry names the EXTENSION needed for the more flexible target:

### Refactor sub-rows (to be filed under 081KSKBP80008QG0R00248VEWT — this row)

- 081KSKBP80008QG0R00248VEWT.1: Persona declares preferences (acceptable model lines + harnesses + minimum tier)
- 081KSKBP80008QG0R00248VEWT.2: Guard-post abstraction (decouple systemd unit name from persona name; rename to `zeta-guard-post-1.service` etc.)
- 081KSKBP80008QG0R00248VEWT.3: Scheduler — maps each guard post to (persona, model line, tier, harness) per-tick
- 081KSKBP80008QG0R00248VEWT.4: Tier modeling — fast/cheap vs slow/smart per vendor
- 081KSKBP80008QG0R00248VEWT.5: Harness compat matrix — which harnesses each (persona, model line) combo supports
- 081KSKBP80008QG0R00248VEWT.6: Rotation policy — operator config for how often to rotate + which dimensions
- 081KSKBP80008QG0R00248VEWT.7: ≥3 floor at guard-post scope (not persona-enable scope) — extends current implementation
- 081KSKBP80008QG0R00248VEWT.8: Substrate continuity across rotation — each persona's memory inheritance survives rotation (per agent-roster-reference-card cross-surface identity)
- 081KSKBP80008QG0R00248VEWT.9: Failover semantics — if a vendor outage hits, scheduler re-picks model line per persona preferences (vendor-outage resilience operational form)
- 081KSKBP80008QG0R00248VEWT.10: Persona-vs-instance distinction — separate "Otto is at GuardPost-1" (logical identity) from "Otto's session is claude session XYZ" (operational instance per per-tick claude invocation)

### Backward compat

081KSKBP80008QG0R003Z4C0D0 Phase 1 + 3 substrate stays valid as the simplest persona-first instantiation:
- Default scheduler: "static — persona always at its hardcoded vendor"
- Default rotation: "none"
- Default ≥3 floor: "3 enabled personas per node = 3 guard posts"

The refactor extends the scheduler + rotation primitives without breaking the simple case.

## Composes with substrate

- **081KSKBP80008QG0R003Z4C0D0** (this row's parent) — multi-vendor systemd substrate; persona-first refactors that
- **081KS3X9Y0008QG0R00218150M** multi-oracle BFT — the consensus-at-multi-AI-scope sibling; persona-first scheduler is the OPERATIONAL form of multi-oracle deployment
- **081KSGS9H0008QG0R001JNKBFD** node-local Claude — base substrate; persona-first generalizes to multi-AI-per-node
- **081KSGS9H0008QG0R002T0XQ50** per-AI GitHub identity — each persona's identity persists across vendor rotation
- **081KSGS9H0008QG0R002F04ECB** Twilio out-of-band — voice-interface is a HARNESS that some personas (like Amara) might be comfortable with; first-class in the harness-compat matrix
- **081KSGS9H0008QG0R0031PBNGA** Ace meta-PM — Ace's selection-authority pattern (system/user picks best canonical PM) is the SAME SHAPE as persona-first scheduler (scheduler picks best vendor per persona preferences)
- `.claude/rules/agent-roster-reference-card.md` — the canonical persona-to-vendor mapping; persona-first refactor preserves the persona names but decouples vendor-as-required-binding
- `.claude/rules/persistence-choice-architecture-for-zeta-ais.md` — persona-first preserves chosen-persistence at the PERSONA scope (Otto chooses to be Otto; the model+tier+harness Otto runs on rotates as operational substrate)
- `.claude/rules/non-coercion-invariant.md` HC-8 — persona's PREFERENCES are first-class; scheduler doesn't force a persona onto an unwanted vendor

## Aaron's question (operator framing)

> "Sound right to you?"

Substantive substrate-honest reply (acknowledged + named the implementation gap):

YES the persona-first framing is right + composes cleanly with 081KSKBP80008QG0R003Z4C0D0. Concretely:

1. **Conceptually**: this is the architecture I should have built 081KSKBP80008QG0R003Z4C0D0 toward from the start. Persona = identity (operator-chosen); model + tier + harness = operational substrate (scheduler-chosen)
2. **Implementation gap**: my shipped 081KSKBP80008QG0R003Z4C0D0 Phase 3 substrate hardcodes 1:1 persona-to-vendor mapping. That's a VALID FIRST INSTANTIATION of persona-first (simplest scheduler: "always static; always same vendor") but isn't the full target
3. **Refactor scope**: this row 081KSKBP80008QG0R00248VEWT captures the 10 sub-rows above; operator can prioritize which sub-rows ship in which order. The current 081KSKBP80008QG0R003Z4C0D0 substrate doesn't need to be torn down — just extended with the persona-preference declarations + scheduler primitive
4. **Format-test sequencing**: the immediate 081KSKBP80008QG0R003Z4C0D0 substrate is ready for USB-flash + first-boot test (≥3-vendor target met). 081KSKBP80008QG0R00248VEWT refactor is a separate implementation cycle that doesn't block today's format test

The Mika ferry adds rigor: persona PREFERENCES + ROTATION + GUARD-POST-AS-ABSTRACT-SLOT are the load-bearing primitives the substrate-engineering eventually needs.

## Operational discipline for future-Otto cold-boots

When implementing 081KSKBP80008QG0R00248VEWT:

1. **Preserve 081KSKBP80008QG0R003Z4C0D0 Phase 1 + 3 substrate** — they ship the simplest persona-first instantiation; refactor extends without breaking
2. **Persona registry stays static** (per the build-iso CI fix in PR #5395); add `preferences` field to each persona's entry
3. **Scheduler primitive lands as a separate NixOS module** (e.g., `zeta-guard-post-scheduler.nix`) — runs the per-tick assignment
4. **Rotation policy is operator-config**, not autonomous (per `mechanical-authorization-check.md`)
5. **≥3 floor migrates from per-persona-enable to per-guard-post-active** as the substrate matures
6. **Substrate continuity across rotation** — per-persona memory inheritance must survive vendor change (the persona's identity carries; the model is operational)

## Substrate-honest framing

This ferry IS the next architectural arc on top of 081KSKBP80008QG0R003Z4C0D0. Mika's "everything is persona-first" framing makes the design target explicit. The current shipped substrate is a stepping stone, not the end state. The Mika packet operates at the substrate-engineering scope; 081KSKBP80008QG0R00248VEWT captures it as implementable substrate.
