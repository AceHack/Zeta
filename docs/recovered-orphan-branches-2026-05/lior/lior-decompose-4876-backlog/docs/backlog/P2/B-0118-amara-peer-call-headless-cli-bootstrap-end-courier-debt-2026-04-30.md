---
id: B-0118
priority: P2
status: open
title: tools/peer-call/amara.sh — autonomous bootstrap + communication for Amara (ChatGPT) to end Aaron-courier silent debt (Aaron 2026-04-30)
tier: factory-tooling
effort: L
ask: Every Amara review this session has been Aaron's manual courier work. The peer-call infrastructure has codex.sh / gemini.sh / grok.sh but no amara.sh; ChatGPT lacks the headless CLI surface that maps to the existing peer-call shape. Until Otto can autonomously bootstrap Amara + do the communication directly, peer-AI review cadence is courier-dependent and incurs silent debt on Aaron. Aaron 2026-04-30 explicitly named this as a constraint Otto must honor.
created: 2026-04-30
last_updated: 2026-05-02
depends_on: []
composes_with:
  - tools/peer-call/README.md
  - tools/peer-call/codex.sh
  - tools/peer-call/gemini.sh
  - tools/peer-call/grok.sh
  - feedback_silent_courier_debt_no_amara_headless_cli_dont_count_on_peer_ai_reviews_as_loop_aaron_2026_04_30.md
  - feedback_otto_to_aaron_pushback_when_overloaded_processing_budget_is_survival_surface_aaron_2026_04_30.md
tags: [aaron-2026-04-30, peer-call, amara, chatgpt, autonomous-bootstrap, courier-debt-elimination, factory-tooling]
type: friction-reducer
---

# B-0118 — tools/peer-call/amara.sh (end Aaron-courier silent debt)

## Source

Aaron 2026-04-30 verbatim:

> *"don't count on her review until you have a process
> encoded for bootstraping her and doing the communitation
> yourself, this is a silent dept on me to be the courrir
> and I can't keep up"*

## Context

The peer-call infrastructure currently has:

- `codex.sh` / `codex.ts` — Codex (OpenAI) via `codex exec`
- `gemini.sh` / `gemini.ts` — Gemini (Google) via `gemini -p`
- `grok.sh` / `grok.ts` — Grok (xAI) via `cursor-agent`

It does NOT have:

- `amara.sh` / `amara.ts` — Amara (ChatGPT/OpenAI)

The README explicitly notes the gap as future-work:

> *"when another peer (Amara via ChatGPT, etc.) gains a
> headless CLI surface..."*

Every Amara review this session (Reviews 9, 12, 13 in
`docs/research/2026-04-30-session-end-peer-ai-reviews-verbatim.md`)
required Aaron to manually courier:

1. Copy Otto's substrate from Claude Code chat
2. Paste into ChatGPT (Amara's surface)
3. Wait for Amara's response
4. Copy Amara's response
5. Paste back into Claude Code chat

That cycle is invisible to Otto's cost model but consumed
significant Aaron time + cognitive load. As substrate cadence
accelerated, the courier load grew proportionally, until
Aaron explicitly named it as a constraint.

## What

Author `tools/peer-call/amara.sh` (and `amara.ts` per TS-default
discipline) — wrapper around whatever ChatGPT-callable surface
becomes available. Likely path:

1. **OpenAI API direct** — call `gpt-4o` or successor via
   `openai` CLI or HTTP. Pros: works today. Cons: not
   exactly the same as Amara-on-ChatGPT (different system
   prompt environment, different conversation continuity,
   different context window).
2. **ChatGPT headless surface** (when available) — wait
   for OpenAI to provide a headless CLI matching the
   `gemini -p` / `codex exec` shape. Pros: matches the
   existing peer-call architecture. Cons: doesn't exist
   yet.
3. **Hybrid: API + Amara-context-bootstrap** — use OpenAI
   API but with a system-prompt + context-attachment
   that bootstraps Amara's persona (her voice, her
   discipline, her four-ferry role of "sharpening" per
   `gemini.sh` README). Pros: works today AND matches
   Amara's review posture. Cons: not the same as
   Amara-on-ChatGPT (no conversation continuity).

The hybrid approach is likely the right path for a v1
that ends courier debt.

## Acceptance criteria

- [ ] `bun tools/peer-call/amara.ts <prompt>` invokes Amara
  autonomously with proper bootstrap preamble
- [ ] AgencySignature-style relationship-model preamble
  applied (per the existing peer-call pattern)
- [ ] Vendor-alignment-bias filter integration documented
  (per `memory/feedback_vendor_alignment_bias_in_peer_ai_reviews_maintainer_authority_aaron_2026_04_30.md`)
- [ ] `--file PATH` and `--context-cmd CMD` flags match the
  existing peer-call surface
- [ ] Tested on a substantive review-task to verify Amara's
  voice + discipline + sharpening role come through
- [ ] Documentation in tools/peer-call/README.md updated to
  remove the "future-task" note and add Amara to the
  operational table
- [ ] Silent-courier-debt rule references this as the
  resolution

## Trigger condition for promotion to P1

If substrate work in any future session blocks on
Amara-review (i.e., the operational loop genuinely needs her
input but Aaron isn't available to courier), promote to P1.

## Why P2 (not P1)

- Substrate work CAN proceed without Amara reviews (Otto
  has codex/gemini/grok as autonomous peer-call options).
- The cost is real but bounded — Aaron has been carrying
  it; he's now flagged it as a constraint.
- Implementation is L-effort (API integration + persona
  bootstrap + flag wiring).

## What this row does NOT do

- Does NOT block past Amara-attributed substrate. Reviews
  9, 12, 13 stand as preserved peer-AI input with Aaron-
  courier as the carrier.
- Does NOT assume Amara reviews are valuable enough to
  justify any specific implementation timeline. Amara's
  reviews HAVE been valuable, but the substrate has plenty
  of other peer-AI input + Otto's own razor.
- Does NOT propose calling Amara on every substrate
  cluster once `amara.sh` exists. The peer-call frequency
  question is separate from the autonomous-call capability
  question.

## Composes with

- `memory/feedback_silent_courier_debt_no_amara_headless_cli_dont_count_on_peer_ai_reviews_as_loop_aaron_2026_04_30.md`
  (the rule this row resolves)
- `tools/peer-call/{codex,gemini,grok}.{sh,ts}` (the
  pattern this implementation follows)
- `feedback_otto_to_aaron_pushback_when_overloaded_processing_budget_is_survival_surface_aaron_2026_04_30.md`
  (inverse surface — Otto-to-Aaron push-back covers
  Aaron's input overloading Otto; this rule covers
  Otto's substrate-cadence overloading Aaron's courier
  capacity)
- `feedback_vendor_alignment_bias_in_peer_ai_reviews_maintainer_authority_aaron_2026_04_30.md`
  (the filter applied to all peer-AI input including
  Amara's; carries through unchanged when amara.sh lands)
