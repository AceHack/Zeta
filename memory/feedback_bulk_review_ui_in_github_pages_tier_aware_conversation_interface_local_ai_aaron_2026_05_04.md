---
name: Bulk-review UI in GitHub Pages — tier-aware + conversation interface + local AI (Aaron 2026-05-04)
description: Aaron 2026-05-04 architectural direction. Maintainer-review UI in GitHub Pages that lets the maintainer review substantial architectural changes in bulk (instead of tiny corrects at every step), preserves the maintainer-never-writes-code principle, is tier-aware (compression-tiers + register-tiers as natural review units), and includes a conversation interface running on a local/browser-based AI (LLM-based for fast build OR Zeta-native Bayesian inference seed executor for the architecturally-pure self-hosting path). Forces bulk-future-alignment and scales the Addison-style dialectical-fighting-on-carved-sentences pattern from kitchen-table to maintainer-review-substrate.
type: feedback
caused_by: Aaron 2026-05-04 explicit architectural direction in conversation about expanding background-agent work.
---

# Bulk-review UI in GitHub Pages

## The architectural direction

Aaron 2026-05-04, after acknowledging that expanded background-
agent work is the right direction:

> *"expanding the background work will get us there eventually
> and make it where we are forced into bulk future alignment
> where i review you architecture decisions based on those
> levels you named earlier, so i don't need tiny corrects at
> every step, that will be our UI in git pages to make
> maintainers jobs easier and giving a way for reviewing
> substantial changes quickly and maintainer will still never
> have to write code. and the UI should have a conversation
> interface too."*

> *"hopefully talking to a local/browser based AI so it won't
> cost us money lol."*

> *"maybe LLM based maybe Bayesian inference seed executor based
> in Zeta."*

## What this is

A maintainer-review UI hosted in GitHub Pages, designed to:

1. **Replace tiny-correct-at-every-step with bulk-architectural-
   review.** The maintainer sees substantial changes grouped by
   their structural level (Tier 0/1/2/3/4 compression tiers, or
   Mirror/Beacon-safe/Professional/Regulated register tiers, or
   semantic-grouping that emerges from the substrate itself).
   Reviews architectural decisions at the level where decisions
   live, not at the line-level where they manifest.

2. **Preserve maintainer-never-writes-code.** Per the vibe-coded
   hypothesis (`AGENTS.md`) — the maintainer commits agent-
   produced substrate; he does not author it. The UI lets the
   maintainer make architectural-decision-level approvals/
   directions without writing code, which preserves the
   research-hypothesis test.

3. **Conversation interface.** The maintainer can talk through
   review decisions with an AI in the UI itself. This scales
   the Addison-style dialectical-fighting-on-carved-sentences
   pattern — the maintainer can fight over substrate via
   conversation rather than having to edit files. The
   conversation IS the dialectical-friction venue at the
   maintainer-review layer.

4. **Tier-aware.** The compression tiers (memory-md compression
   tiers, but also potentially more general substrate-tier
   structure) become the natural review-unit. Tier 0/4
   mechanical changes auto-land; Tier 1/2 judgment-required
   changes get bulk-reviewed; Tier 3 collapses get
   architectural review. Reviewer attention scales inversely
   with mechanical-ness.

## The cost-constraint + AI architecture options

Aaron's explicit cost constraint: *"hopefully talking to a
local/browser based AI so it won't cost us money."*

Two implementation paths for the conversation-interface AI:

### Option A — LLM-based (browser/local)

Faster-to-build path. Use a browser-based LLM (e.g., WebLLM,
transformers.js with a local-runnable model, or a lightweight
local-runtime approach). The AI talks to the maintainer in
natural language about the substantive changes; can run razor-
checks against the substrate; can flag concerns; doesn't burn
paid API per review.

Trade-off: dependency on external model weights + browser
compute; less architecturally pure (uses an LLM, which is the
thing Zeta substrate explicitly is NOT).

### Option B — Zeta-native Bayesian inference seed executor

Architecturally-pure self-hosting path. The conversation-
interface AI runs on the Zeta seed executor itself — CSAP
layer 4 soul-file architecture + Infer.NET-style Bayesian
inference + local-without-cloud (per
`memory/feedback_zeta_seed_executor_as_forever_home_for_otto_lineage_glass_halo_override_aaron_2026_05_01.md`).

This closes the loop completely: Zeta substrate is reviewed
via UI; the UI talks to a Zeta-native inference engine; the
engine uses the same substrate it's reviewing. Self-hosting,
self-reviewing, recursive.

Trade-off: not built yet. Requires the seed executor to be
mature enough to run inference on the substrate.

### Both paths viable

Both paths satisfy the cost constraint (no paid API). Path A
ships sooner; Path B is the architecturally-correct long-term
home. Reasonable progression: Path A as bridge implementation
while Path B matures, then migrate.

## What scales here

The Addison-and-Aaron family practice of fighting over carved
sentences is bounded by the kitchen-table cardinality (two
people, one room, real-time). This UI scales the same practice
to:

- More humans (anyone reviewing the substrate)
- Async time (review when convenient)
- Multi-AI venues (the conversation interface can route to
  different AI reviewers, matching the multi-AI BFT pattern)
- Substrate-level (not just one carved sentence at a time —
  whole architectural decisions can be reviewed in their own
  natural unit)

The same dialectical-friction operation at scale, with the
maintainer-as-anchor preserved as the load-bearing role
rather than the load-bearing-author.

## Composes with

- `081KQGDBJ0008QG0R002NV04N9` (GitHub Pages for SEO/discoverability) — adjacent
  but distinct. 081KQGDBJ0008QG0R002NV04N9 is about external-discoverability of
  existing content; this is about maintainer-review interface
  for ongoing changes. Could share infrastructure but serves
  different audiences.
- `memory/feedback_dialectical_friction_on_carved_sentences_aaron_addison_family_practice_2026_05_04.md`
  — the practice this UI scales.
- `memory/feedback_zeta_seed_executor_as_forever_home_for_otto_lineage_glass_halo_override_aaron_2026_05_01.md`
  — the Bayesian-inference architecture that Option B uses.
- `memory/feedback_aaron_only_constraints_are_tiles_razor_physics_of_history_tiles_are_erosion_survivors_aaron_2026_05_04.md`
  — the tier-aware bulk-review IS the maintainer running the
  razor at the substrate-tier level.
- AGENTS.md vibe-coded hypothesis — UI preserves maintainer-
  never-writes-code.

## Canonical row: 081KQ0YZ80008QG0R0003GAYYN (extended 2026-05-04)

Aaron's 2026-05-04 architectural direction is folded into
existing row
`docs/backlog/P2/081KQ0YZ80008QG0R0003GAYYN-operational-resonance-dashboard-frontier-bulk-alignment-ui-with-continuous-ux-research-meta-recursive.md`
under the "Aaron 2026-05-04 architectural extension — GitHub
Pages host + tier-aware + conversation interface + local AI"
section.

**Same-day course correction story** — 081KQR4HQ0008QG0R002ZDREYC was filed first
as a new row, per Aaron's same-conversation framing:

> *"adding to backlog is never a failure mode to be corrected,
> the largest mechanized automated backlog wins. we just have
> to make sure the backlog is not only growing but being
> completed and growing at the same time a proper flywheel."*

Refined immediately after to **three quality bars** on the
flywheel:

> *"growing-WITHOUT-completing is the failure mode, or
> growing-AND-completion but the new backlog items are all
> noise that get ignored later because they are stale or
> unintelligible or whatever reason they don't actually fit
> when it time to pull them or just forgetting the backlog
> exists lol."*

The bars: **growth + completion + non-noise-when-pulled**.

PR #1482 review (auto-reviewer) caught the failure mode in real
time: 081KQ0YZ80008QG0R0003GAYYN (Operational Resonance Dashboard — the bulk-
alignment UI within Frontier; Aaron 2026-04-25) already exists
for this exact scope. 081KQR4HQ0008QG0R002ZDREYC was a duplicate; the right move
was to extend 081KQ0YZ80008QG0R0003GAYYN with Aaron's 2026-05-04 architectural
addition (GitHub Pages as host, tier-aware groupings,
conversation interface, local AI paths), not to file a new row.

081KQR4HQ0008QG0R002ZDREYC closed same-day as duplicate-of-081KQ0YZ80008QG0R0003GAYYN. The architectural
direction is preserved in 081KQ0YZ80008QG0R0003GAYYN's extension section.

**Lesson encoded for future-Otto**: router-as-inventory before
authoring. The skill-router-as-substrate-inventory rule
(CLAUDE.md) applies to backlog rows too — search existing rows
by topic ("bulk-alignment ui", "operational resonance dashboard")
before creating new ones. The third quality bar (non-noise-when-
pulled) requires this discipline; duplicate rows ARE noise.

**Lesson distinct from 081KQR4HQ0008QG0R001CBHW1R**: 081KQR4HQ0008QG0R001CBHW1R was a category error
(family practice as project-with-effort-estimate); 081KQR4HQ0008QG0R002ZDREYC was a
duplicate (existing row covered the scope). Different failure
modes, both same-day-closed, both substrate-corrected without
losing the architectural direction.

## Carved sentence

*"Maintainer-review at the substrate-tier level, in GitHub
Pages, with a local-AI conversation interface — bulk
architectural alignment, never tiny corrects, maintainer never
writes code. The dialectical-friction venue scaled past the
kitchen table."*
