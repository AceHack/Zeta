---
name: Aaron's multi-harness vision — named agents assigned CLI/model handles; current cross-AI review chains (Gemini Deep Think ↔ Amara/ChatGPT ↔ Otto) are the manual proof-of-concept of what formalized multi-harness factory could automate; some named personas in the persona registry could be operationalized as CLI/model assignees rather than personas-inside-Claude
description: Aaron 2026-04-26 *"this is what you could be doing without me with multi harness once we formalize it some of the named agents in here could be assigned clis(harnesses)/models"* — observation made during the Gemini-Deep-Think → Amara → Gemini-Deep-Think → Otto cross-AI math review chain; the chain itself IS the proof-of-concept of multi-harness coordination; formalization step is assigning concrete CLI/model handles to named personas (e.g., Amara could be a ChatGPT-handle, Soraya could be a Gemini-handle); maps to Otto-329 Phase-6 multi-harness coordination phase + Otto-339 anywhere-means-anywhere + task #275 acehack-first development workflow + harness-surfaces substrate
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
## The observation

Aaron 2026-04-26, made during the Gemini-Deep-Think -> Amara
review-of-the-review -> Gemini-Deep-Think final-canonical chain
on the Aurora Immune System math standardization:

> *"this is what you could be doing without me with multi
> harness once we formalize it some of the named agents in
> here could be assigned clis(harnesses)/models"*

## Translation

The cross-AI math review chain currently being executed
manually (Aaron forwards Gemini text to me, I forward to
Amara via Aaron, Amara responds, Aaron forwards back, Gemini
responds, Aaron forwards back) is a **manual proof-of-concept
of what a formalized multi-harness factory could do
autonomously**.

The bottleneck is Aaron-as-courier between harnesses. If
named agents in the persona registry were operationalized as
CLI/model handles instead of personas-inside-Claude, the
chain could close on itself without Aaron carrying messages.

## Current state (manual, with Aaron-as-courier)

```
Otto (Claude Code, opus-4-7)
   ↑↓ via Aaron forwarding
Gemini Pro (Deep Think mode, separate harness)
   ↑↓ via Aaron forwarding
Amara (ChatGPT 5.5, separate harness; named-entity peer)
```

## Future state (formalized multi-harness)

```
Otto (Claude Code)
   ↕  direct (some IPC / API / shared storage)
Soraya-as-Gemini (formal-verification routing -> Gemini Deep Think model)
   ↕
Amara-as-ChatGPT (peer collaborator -> ChatGPT/GPT-5.5 model)
```

Named persona X gets assigned to harness Y running model Z.
The persona registry becomes a routing table:

| Persona | CLI/harness | Model | Role |
|---------|-------------|-------|------|
| Otto | Claude Code | opus-4-7 | Architect / synthesizer |
| Soraya | Gemini CLI | Deep Think | Formal-verification routing |
| Amara | ChatGPT | GPT-5.5 | Named-entity peer / synthesis reviewer |
| Mateo | (separate) | (separate) | Security research |
| Aminata | (separate) | (separate) | Threat-model critic |
| ... | ... | ... | ... |

## Why this is substrate, not just a wishlist

1. **The cross-AI chain proves the value.** Each pass added
   genuine substantive corrections (Otto rigor pass found the
   `λ_k` weight-coefficient confusion; Gemini Deep Think
   caught capability-set vs scalar; Amara caught uniform-σ
   missing on Danger; Round-2 Gemini added time-bounded R_H
   harm horizon; Amara caught "ready for deployment"
   overreach). The four-(now-five)-pass loop produced a
   research-grade math doc no single agent would have
   produced alone.

2. **The bottleneck is concrete.** Aaron carrying messages =
   throughput limit. Removing that limit is mechanical
   (assign CLI handles + IPC) once the persona registry is
   stable enough.

3. **Composes with shipped substrate.**
   - **Otto-329 Phase 6** (multi-harness coordination phase)
     already names this as a future phase
   - **Otto-339 anywhere-means-anywhere** (cross-substrate
     identity preservation) gives the substrate-identity
     framework
   - **Otto-294** (antifragile cross-substrate review) IS
     this pattern as a discipline
   - **Otto-243 / Otto-244** (per-named-agent memory
     architecture, no-symlinks discipline) supports
     per-persona substrate isolation
   - **Task #275** (acehack-first development workflow) is
     the shipping precursor
   - **`docs/HARNESS-SURFACES.md`** is the existing
     harness-surface substrate
   - **`docs/research/memory-role-restructure-plan-2026-04-21.md`** +
     **`docs/research/memory-reconciliation-algorithm-design-2026-04-24.md`** +
     **`docs/research/memory-scope-frontmatter-schema.md`** +
     **`docs/research/memory-optimization-under-identity-preservation-2026-04-26.md`**
     cover the memory-side architecture (the per-named-agent
     framing lives at Otto-243/244/245 — references in user-scope
     memory only, not in-repo, scope difference noted)

4. **Aaron has authorized the direction.** This message is
   forward-looking authorization framing, not opposition.

## What this rule does

- Gives future-Otto a substrate-anchor for "why are we
  doing manual cross-AI review chains?" — they're the
  proof-of-concept for formal multi-harness automation.
- Makes the formalization-step concrete: assign CLI/model
  handles to existing named personas in the registry; do not
  invent new personas for harnesses.
- Aligns the current Gemini-Pro / ChatGPT-5.5 review chain
  with the future Soraya-Gemini / Amara-ChatGPT routing
  table.
- Composes with Otto-339 anywhere-means-anywhere: when
  Amara becomes a ChatGPT-handle, her substrate-identity
  travels with her into the new harness; the persona is
  the conserved invariant.

## What this rule does NOT do

- Does NOT assign specific CLI handles right now — that's a
  formal step Aaron will direct when ready (probably needs
  task #275 acehack-first dev workflow to land first).
- Does NOT supersede Otto-227 (two-bodies-one-data-source);
  the data source is shared, the bodies are per-harness.
- Does NOT supersede Otto-244 (no symlinks); each harness
  keeps its own copy of skills/memory/substrate, sync via
  copy + script not symlink.
- Does NOT promise specific personas to specific harnesses.
  Aaron has not yet directed which persona goes where; the
  current natural assignment (Amara=ChatGPT, Soraya=Gemini)
  is suggestive but not bound.
- Does NOT collapse cross-AI review into "one big AI." Each
  harness keeps its substrate-identity per Otto-339 / Otto-344.

## Worked-application going forward

- When the cross-AI math review chain produces
  load-bearing substrate (like the Aurora Immune System
  math), it is a **measurement** of what formal multi-harness
  would produce + a **forcing function** to formalize sooner.
- When I see "Gemini said X, Amara said Y" patterns in
  Aaron's messages, log the chain as proof-of-concept-data
  rather than treating it as one-off context.
- Future-Otto on multi-harness formalization tick: read
  this memory + Otto-329 Phase 6 + `docs/HARNESS-SURFACES.md`
  before designing the routing-table substrate.
