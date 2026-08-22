---
name: cross-substrate-triangulator
description: Cross-substrate triangulation — validate load-bearing substrate via an independent AI persona on a different harness.
record_source: "081KRW63S0008QG0R0025E4PH6 LOCK-IN by Aaron 2026-05-18"
load_datetime: "2026-05-18"
last_updated: "2026-05-18"
status: active
bp_rules_cited: [BP-11]
---

# Cross-Substrate Triangulator — Independent-Persona Validation Discipline

Capability skill. No persona lives here; the persona (if any) is carried by the
matching entry under `.claude/agents/`.

## What this is

**N-independent-AI-persona observation paths arriving at consistent substrate = strongest epistemic ratification possible without empirical implementation.**

When a substrate claim has been derived in ONE conversation with ONE AI persona, its
epistemic standing remains **single-conversation artifact** until independent
observers (different personas on different harnesses) arrive at consistent
conclusions via separate reasoning chains. This skill operationalizes the
discipline of carrying substrate through that ratification.

Per Aaron 2026-05-18 (081KRW63S0008QG0R0025E4PH6 LOCK-IN): *"this is a feature of linking the plot we
want first class as a skill / hat."*

## When to invoke

Invoke when:

- A substrate claim is load-bearing (architectural decision, governance principle,
  Constitution-Class candidate, design that will compose downstream)
- The substrate has been derived in only ONE conversation with ONE AI persona
- You're about to act on the substrate as if it were epistemically robust
- Future-Otto cold-boots would inherit the substrate; ratification matters

Do NOT invoke when:

- The substrate is exploratory / low-stakes
- Multiple independent observers have already validated it
- The substrate is already empirically implemented + measured (empirical > triangulation)
- Time-budget doesn't permit (note as deferred work; don't act on substrate as
  epistemically robust)

## Three minimum criteria for valid triangulation

1. **Independence**: target persona must NOT have read source-persona's substrate
   before (no context pollution from prior exposure)
2. **Different harness**: same persona on the same harness ≠ independent (vary
   the substrate-runtime axis: Grok native vs Grok via Cursor vs Claude vs
   Codex vs Gemini)
3. **Verbatim preservation**: source substrate must be presented AS-IS to target
   (no summary/paraphrase — that introduces source-persona biases)

## Procedure

1. **Identify the substrate to triangulate**
   - One specific claim, not a vague "Agora is cool"
   - Verbatim text of the substrate (or `docs/research/*` archive reference)
   - Source persona + source surface

2. **Select an independent persona via the agent roster**
   - Read `.claude/rules.bak/agent-roster-reference-card.md` for available personas
   - Choose a persona on a DIFFERENT harness from the source
   - Avoid personas the source has already engaged on this substrate

3. **Pick the appropriate peer-call wrapper**
   - `src/Core.TypeScript/peer-call/claude.ts` — Claude Code peer (read-only self-test mode)
   - `src/Core.TypeScript/peer-call/grok.ts` — Grok via cursor-agent (NOTE: 081KRA5AR0008QG0R0011ZGRZT currently
     open — cursor-agent exit 1 / empty output; alternative: Grok website-text-mode
     git connector)
   - `src/Core.TypeScript/peer-call/gemini.ts` — Gemini, propose role
   - `src/Core.TypeScript/peer-call/codex.ts` — Vera / OpenAI Codex peer
   - `src/Core.TypeScript/peer-call/kiro.ts` — Kiro specification peer
   - `src/Core.TypeScript/peer-call/amara.ts` — Amara persona on codex (sharpen role)
   - `src/Core.TypeScript/peer-call/ani.ts` — Ani persona on Grok (brat-voice register)
   - `src/Core.TypeScript/peer-call/riven.ts` — Riven persona on Grok (adversarial-truth-axis)

4. **Forward the substrate verbatim**
   - Present source substrate as-is
   - State the question: "validate / refine / red-team this substrate"
   - Do NOT bias toward any specific outcome

5. **Engage with substrate-honest framing**
   - Let the independent persona work through it
   - Capture their full response verbatim
   - Note divergences (refinements, concerns, alternative framings)

6. **Preserve §33 verbatim in `docs/research/`**
   - Filename pattern: `YYYY-MM-DD-<persona>-<harness>-<topic>-<validation|refinement|red-team>.md`
   - Include §33 archive headers in first 20 lines (Scope, Attribution,
     Operational status, Non-fusion disclaimer)
   - Verbatim transcript as the body
   - Cross-link with source substrate
   - Add cross-substrate-triangulation note marking epistemic standing change

7. **Cross-link substrate**
   - Update source substrate row(s) with reference to validation
   - Note epistemic standing change ("triangulated via N independent personas")
   - File any refinements as new B-NNNN rows
   - File any red-team concerns as new backlog items

## Three outcome classes

| Outcome | What it means | Substrate impact |
|---|---|---|
| **Validation** | Independent persona arrives at consistent conclusions via separate reasoning | Epistemic standing strengthened; substrate moves beyond single-conversation-artifact |
| **Refinement** | Independent persona identifies gaps source missed | Substrate sharpens; new sub-rows file the refinements |
| **Red-team** | Independent persona raises concerns source didn't | Substrate stress-tested; either substrate evolves OR rejection is substrate-honest |

If ALL independent observers raise concerns, the substrate **fails** triangulation. That's substrate-honest rejection, not failure of the skill.

## Today's canonical worked example (3-Grok-persona triangulation on Agora V6)

| Persona | Surface | Role | Outcome |
|---|---|---|---|
| Mika | Grok native (grok.com) | Original-derivation | Wave-particle / Integrate / O-P-L-E + Agora V6 8-section |
| Ani | Grok native (grok.com, text-mode) | Independent validation | Arrived at same substrate via separate reasoning; introduced Limit-is-simulation refinement |
| Riven | Grok via Cursor | Adversarial-truth-axis stress-test | Validated physics + reputation; raised non-collapse duality; extracted no-artificial-throttle principle |

Three independent observation paths. Substrate moved beyond single-conversation-artifact status. Documented in:

- `docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`
- `docs/research/2026-05-18-ani-grok-agora-v6-constitution-wave-particle-validation-free-will-is-what-collapses.md`
- `docs/research/2026-05-18-riven-grok-cursor-agora-v6-non-collapse-duality-no-artificial-throttle.md`

## Cascade-honest framing

Today's 3-Grok triangulation is significant BUT all 3 are Grok-based. A stronger
triangulation extends across:

- Grok (multiple personas / harnesses — done today)
- Claude (Otto on CLI, Alexa on Kiro, Kestrel on web)
- Codex / OpenAI (Vera on Codex)
- Gemini (Lior on Antigravity)
- DeepSeek (DeepSeek on API)

Each axis (Grok-cross-harness, then Grok-vs-Claude, then Grok-vs-Codex, etc.)
progressively strengthens epistemic standing. Triangulation is start, not end.

## What this is NOT

- NOT a guarantee of truth (independent observers can share systematic biases)
- NOT a substitute for empirical implementation (when implementable, build + measure beats triangulate)
- NOT a license to ignore critical review (triangulation IS multi-agent critical review)
- NOT a way to artificially boost weak substrate (if all observers raise concerns, the substrate fails)
- NOT mandatory for every substrate decision (reserve for load-bearing; methodology-grade work doesn't need it)

## Composition with HAT framework (per 081KRW63S0008QG0R000BH37EV)

This skill is the OPERATIONAL procedure; the HAT (Triangulator) is the type-safe
COGNITIVE commitment. Agent wearing the Triangulator hat for load-bearing substrate
type-system-enforced to (a) forward substrate verbatim, (b) preserve §33 verbatim,
(c) cross-link with ratification framing. See [081KRW63S0008QG0R000BH37EV](../../../docs/backlog/P3/081KRW63S0008QG0R000BH37EV-voluntary-type-safe-binding-hat-domain-criticality-mika-2026-05-18.md)
voluntary type-safe binding hat × domain × criticality framework.

## Composes with

- [`081KRW63S0008QG0R0025E4PH6`](../../../docs/backlog/P1/081KRW63S0008QG0R0025E4PH6-cross-substrate-triangulation-first-class-skill-hat-aaron-2026-05-18.md) — the LOCK-IN row that promoted this pattern to first-class skill + hat
- [`081KRW63S0008QG0R000BH37EV`](../../../docs/backlog/P3/081KRW63S0008QG0R000BH37EV-voluntary-type-safe-binding-hat-domain-criticality-mika-2026-05-18.md) — voluntary type-safe binding hat × domain × criticality framework
- [`081KRW63S0008QG0R002ZRNDJ8`](../../../docs/backlog/P1/081KRW63S0008QG0R002ZRNDJ8-limit-is-simulation-not-collapse-pure-function-preview-aaron-ani-2026-05-18.md) — Limit-is-simulation (triangulation IS meta-Limit-simulation)
- [`081KRW63S0008QG0R001Z10PVV`](../../../docs/backlog/P1/081KRW63S0008QG0R001Z10PVV-agora-v6-constitution-marketplace-agora-2-primitives-economic-architecture-aaron-ani-2026-05-18.md) — Agora V6 (today's canonical worked example)
- [`.claude/rules.bak/peer-call-infrastructure.md`](../../rules/peer-call-infrastructure.md) — peer-call wrappers (the operational substrate)
- [`.claude/rules.bak/agent-roster-reference-card.md`](../../rules/agent-roster-reference-card.md) — agent roster (which personas + surfaces are available)
- [`.claude/rules.bak/glass-halo-bidirectional.md`](../../rules/glass-halo-bidirectional.md) — cross-substrate triangulation discipline (this skill formalizes the rule)
- [`.claude/rules.bak/substrate-or-it-didnt-happen.md`](../../rules/substrate-or-it-didnt-happen.md) — §33 verbatim preservation discipline
- `tools/peer-call/*.ts` — 8 peer-call wrappers (claude/grok/gemini/codex/kiro/amara/ani/riven)

## Status

Active. Authored 2026-05-18 per 081KRW63S0008QG0R0025E4PH6 LOCK-IN. Aaron's verbatim: *"this is a
feature of linking the plot we want first class as a skill / hat."*
