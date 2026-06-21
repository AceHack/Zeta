---
id: 081KQDTYV0008QG0R0037YJPEX
priority: P2
status: closed
title: tools/peer-call/amara.ts — autonomous bootstrap + communication for Amara (ChatGPT) to end Aaron-courier silent debt (Aaron 2026-04-30; TS-first re-decomp)
tier: factory-tooling
effort: L
ask: Every Amara review this session has been Aaron's manual courier work. The peer-call infrastructure has codex.sh / gemini.sh / grok.sh but no amara.sh; ChatGPT lacks the headless CLI surface that maps to the existing peer-call shape. Until Otto can autonomously bootstrap Amara + do the communication directly, peer-AI review cadence is courier-dependent and incurs silent debt on Aaron. Aaron 2026-04-30 explicitly named this as a constraint Otto must honor.
created: 2026-04-30
last_updated: 2026-05-16
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

# 081KQDTYV0008QG0R0037YJPEX — tools/peer-call/amara.ts (end Aaron-courier silent debt)

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

- `amara.ts` — Amara (ChatGPT/OpenAI)

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

Author `tools/peer-call/amara.ts` per TS-default discipline —
wrapper around whatever ChatGPT-callable surface becomes
available. Likely path:

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

## Decomposition (2026-05-11, re-decomp, TS-first)

081KQDTYV0008QG0R0037YJPEX decomposed into 3 smallest atomic dependency-ordered children (TS over bash Rule 0 enforced; no .sh created; pure TS implementation path):

**Buildable now (no deps):**

- 081KRA5AR0008QG0R0019Q33F7 (renumbered from 081KRA5AR0008QG0R000Y6102S) — Amara persona bootstrap preamble definition (S)

**Blocked on 081KRA5AR0008QG0R0019Q33F7:**

- 081KRA5AR0008QG0R000KKJRVA (renumbered from 081KRA5AR0008QG0R0035N4S6C) — amara.ts core OpenAI API invoke + flag parity (M)

**Blocked on 081KRA5AR0008QG0R000KKJRVA:**

- 081KRA5AR0008QG0R001X4T9W7 (renumbered from 081KRA5AR0008QG0R000C3P8KP) — amara.ts README update + courier-debt closure + test invoke (S)

All children are atomic, S/M effort, prefer F#/TS code. 081KQDTYV0008QG0R0037YJPEX status remains open until children land (per decomp discipline). Parent row now serves only as index.

## Status update

- status: open (decomposed into children 081KRA5AR0008QG0R000KKJRVA, 081KRA5AR0008QG0R001X4T9W7, 081KRA5AR0008QG0R0019Q33F7; the full amara series 081KRA5AR0008QG0R000Y6102S-081KRA5AR0008QG0R000C3P8KP renumbered 2026-05-14 to resolve ID collision with 081KQDTYV0008QG0R001VJP216's children — see 081KRFA460008QG0R00308W7FJ substrate-cleanup sweep)
- last_updated: 2026-05-14
- note: re-decomposed per "assume decomposition has mistakes" rule; original L-effort split to 3 atomic; hybrid API chosen as v1 path (TS-first); IDs renumbered 2026-05-14 per 081KRFA460008QG0R00308W7FJ

## Status (2026-05-16)

Per row-close gate triage (PR #3757 step-0 discriminator), this umbrella sits in a **multi-row drift sub-case**: umbrella's original 7-item acceptance is **fully shipped via `tools/peer-call/amara.ts`** (18322 bytes; --file + --context-cmd flags present; bootstrap preamble via CURRENT-amara.md per README; AgencySignature pattern documented in README), BUT all 3 atomic children (081KRA5AR0008QG0R000KKJRVA, 081KRA5AR0008QG0R001X4T9W7, 081KRA5AR0008QG0R0019Q33F7) remain `status: open` per their own frontmatter.

**Closing umbrella while children are open would trip the 081KRMEXM0008QG0R003FZNK3E graph-consistency lint** (parent closed + child open = hard error). Per row-close gate class #4 rule: umbrella closes IFF all children close.

**Substrate-honest disposition**: leave umbrella open. The accurate close-sequence is:

1. Verify each child's specific acceptance (081KRA5AR0008QG0R000KKJRVA core+flags, 081KRA5AR0008QG0R001X4T9W7 README+test, 081KRA5AR0008QG0R0019Q33F7 bootstrap+AgencySignature)
2. Close each child via close-row PR (likely class #4 sub-cases — work shipped via the amara.ts file)
3. Then close umbrella in a final close-row PR

This tick (2026-05-16T10:17Z Otto-CLI) verified the umbrella's tool surface but did NOT walk the 3 children's individual acceptances. Filing as **multi-row class-#4 candidate** for a future tick (or peer) with the bandwidth to close 4 rows in a coordinated batch.

Empirical audit anchor: `grep -cE '\-\-file|\-\-context-cmd|bootstrap|AgencySignature' tools/peer-call/amara.ts` → 18 matches; `grep amara tools/peer-call/README.md` → operational-table entry confirms shipped state.

## Final Resolution (2026-05-16)

Closed 2026-05-16 as the umbrella-close of the amara peer-call cluster. All 3 atomic children plus this umbrella now closed within the same session arc (2026-05-16T09:28Z cold-boot through 2026-05-16T~16:00Z):

| Row | PR | What landed |
|---|---|---|
| 081KRA5AR0008QG0R0019Q33F7 (preamble + vendor-bias note) | #3897 | vendor-bias comment block citing memory file |
| 081KRA5AR0008QG0R000KKJRVA (core + flags) | #3899 | close-row (own scope already met pre-cycle) |
| 081KRA5AR0008QG0R001X4T9W7 (README + closure) | this PR | close-row bundled with umbrella |
| **081KQDTYV0008QG0R0037YJPEX** (umbrella, this row) | this PR | umbrella close after all 3 children |

**Acceptance signals** (per row body):

- ✅ `bun tools/peer-call/amara.ts <prompt>` invokes Amara autonomously with proper bootstrap preamble
- ✅ AgencySignature-style relationship-model preamble applied (AMARA_PREAMBLE const)
- ✅ Vendor-alignment-bias filter integration documented (per 081KRA5AR0008QG0R0019Q33F7 close)
- ✅ `--file PATH` and `--context-cmd CMD` flags match the existing peer-call surface
- ✅ Tested on substantive review-task (operational across this session arc as peer-call invoker)
- ✅ Documentation in tools/peer-call/README.md updated (per 081KRA5AR0008QG0R001X4T9W7 close)
- ✅ Silent-courier-debt rule references this as the resolution (via the cluster's full closure)

**Aaron's original constraint** (2026-04-30: *"don't count on her review until you have a process encoded for bootstraping her and doing the communitation yourself, this is a silent dept on me to be the courrir and I can't keep up"*) is now operationally satisfied: amara.ts ships, bootstraps Amara autonomously, no Aaron-courier required.

Silent courier debt: **CLEARED**.
