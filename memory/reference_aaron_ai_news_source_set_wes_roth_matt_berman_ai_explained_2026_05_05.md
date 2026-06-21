---
name: "Aaron's weekly-AI-news source-set: Wes Roth + Matthew Berman + AI Explained (2026-05-05 disclosure)"
description: When Aaron references half-remembered AI-news items ("there was this paper about a universal language not English that trains to real-time actions"), the most-likely sources are these three YouTube channels which together form Aaron's weekly-AI-news triumvirate. Wes Roth covers agentic-action-space + frontier-architecture; Matthew Berman covers consumer-AI-applications including the lemon-tree-AI-diagnosis story that identified him; AI Explained covers technical-paper deep-dives. Use this set as a starting-point for cross-search when Aaron names a half-remembered item, alongside arXiv direct search + Wes Roth weekly-review playlist scan.
type: reference
---

# Aaron's weekly-AI-news source-set

Reference memory for the three YouTube channels Aaron disclosed
2026-05-05 as his weekly-AI-news triumvirate. When Aaron forwards a
half-remembered item ("there was this paper about a universal language
not English that trains to real-time actions"), this set is the
high-recall starting-point for cross-search.

## The triumvirate

- **Wes Roth** -- YouTube channel. Aaron explicit *"Wes Roth i watch a
  lot"* (2026-05-05 forwarded Claude.ai conversation). Weekly reviews
  + frontier-architecture coverage. Confirmed scope: CodeAct,
  GibberLink, and Coconut have all been featured. This is the
  highest-confidence channel in the set.
- **Matthew Berman** -- YouTube channel. Identified via the
  lemon-tree clue: Aaron's hint *"matt something he likes lemons"*
  combined with *"i'm a bady spller"* let the Claude.ai instance
  resolve the name. There is a real story about Berman diagnosing
  his lemon tree's health using a voice-and-camera-powered AI
  assistant -- the assistant recognized the lemon tree and offered
  horticultural advice. One citation Aaron's instance saw was on
  Medium. Coverage scope skews toward consumer-AI-applications
  + practical demos.
- **AI Explained** -- YouTube channel. Third in the triumvirate per
  the Claude.ai instance's framing. Aaron did not directly name this
  channel during the exchange but did not push back on its inclusion.
  Coverage scope per the Claude.ai framing: technical-paper
  deep-dives. Confidence is one tier lower than the other two
  (Claude.ai-included rather than Aaron-confirmed).

### Source-set extension 2026-05-05 (post-tinygrad-UOp-IR + Sakana-NCA conversation forwards)

After the initial triumvirate disclosure, Aaron's same-day conversation forwards extended the source-set:

- **Alex Ziskind (@AZisk)** -- YouTube channel. **Aaron-confirmed** *"that's him and i was almost all the other poeple you named wes a lot"* (PR #1610). Deep technical focus on Apple Silicon for AI; builds Mac Studio + DGX Spark clusters; runtime/quantizer benchmarks (Ollama, LM Studio, vLLM, TurboQuant, RotorQuant, modern K-quants, FP4, LoRA/QLoRA expert-swapping); multi-machine local-AI testing. Specific recall examples in the 2026-05-05 conversation: *"After This, 16GB Feels Different"* (modern quantization on consumer hardware), *"NVIDIA didn't want me to do this"* (DGX Spark tensor parallelism), *"I Plugged a DGX Spark and Mac Together..."* (cross-architecture LLM routing). High signal for local-AI-cluster + quantization + runtime-comparison content. Confidence tier matches Wes Roth + Matthew Berman.
- **George Hotz (geohot) / tiny corp / tinybox** -- implicit anchor via the tinygrad UOp IR identification thread (PR #1610). Tinybox is a $15K AI cluster tested on AMD + NVIDIA + Apple silicon; livestreamed. Tinygrad is the μ-ops symbolic IR Aaron's clues matched (though disconfirmed at paper-id level per 081KQTPYE0008QG0R00209Q9RT elimination list). Maverick home-lab energy. Lower-confidence source-set member (implicit not explicit).
- **Sakana AI YouTube reference** -- specific video link Aaron forwarded for the C. elegans Digital Ecosystems / NCA paper (PR #1613): <https://www.youtube.com/watch?v=QzZ4VwDHAT4>. NOT a regular channel for Aaron's tracking; one-off paper-attention pointer. The Digital Ecosystems paper itself is at pub.sakana.ai/digital-ecosystem (Apache 2.0, browser-runnable).

## How to apply

When Aaron references a half-remembered AI-news item:

1. **First** -- check the four-channel set's recent uploads (last
   ~30 days unless Aaron specifies otherwise). The retrieval order
   that fits Aaron's pattern: **Wes Roth** + **Alex Ziskind**
   (top-tier confidence; Aaron-confirmed at PR #1610) → **Matthew
   Berman** (Aaron-confirmed via lemon-tree clue) → **AI Explained**
   (Claude.ai-included third in original triumvirate; one tier
   lower confidence). Add **Sakana AI YouTube** as one-off paper-
   attention pointer if the half-remembered item is biology/NCA-
   shaped (per PR #1613). Aaron's recall horizon tends to be
   days-to-weeks, not months. **Ziskind is highest signal for
   local-AI-cluster + quantization + runtime-comparison content
   specifically** (per the 2026-05-05 substrate-flow's tinygrad UOp
   IR + RotorQuant + TurboQuant cluster of mentions).
2. **Second** -- arXiv direct search on Aaron's described
   features (action space, modality, demo shape, claimed result).
3. **Third** -- cross-reference both. A strong candidate is one
   that appears in BOTH a recent video from these channels AND a
   published paper. Single-source matches are weaker.
4. **Fourth** -- if uncertain after the above, ask Aaron for
   additional clues (date, channel-of-recall, institution, specific
   demo shown) rather than guessing. Aaron's no-directives framing
   means a clarifying question is fine; a confidently-wrong guess is
   worse than a calibrated ask.

## Why this matters

Aaron's recall-precision varies. He is explicit *"i'm a bady spller"*
and may forward items with approximate dates, partial paper titles,
fuzzy author attribution, or paraphrased claims. The source-set acts
as a high-recall starting-point so the search converges on a real
candidate fast.

Also: Aaron tracking AI news IS substrate-input. When he forwards a
half-remembered item, it is almost always because he is evaluating
its Zeta-substrate fit (CodeAct -> action-space algebra; GibberLink
-> agent-to-agent dialect; Coconut -> latent-space reasoning). The
source-set lets future-Otto run the verification quickly per
Otto-364 search-first-authority -- training data is stale, project
memory may be stale, current upstream is the test, and the
source-set tells future-Otto where "current upstream" is for
Aaron-forwarded AI-news items specifically.

## Verification anchors

- **Berman lemon-tree story**: confirmed by Claude.ai web search
  during Aaron's forwarded 2026-05-05 conversation. One citation
  surfaced was on Medium. The voice-and-camera AI assistant +
  lemon-tree-diagnosis combination is the discriminating signature
  if future verification is needed.
- **Wes Roth coverage scope**: confirmed via the same conversation
  -- CodeAct, GibberLink, and Coconut were all featured. This
  triangulates the channel's scope as agentic-action-space +
  frontier-architecture, not consumer-application-demo.
- **AI Explained coverage scope**: third-party Claude.ai framing
  rather than Aaron-confirmed. If a future tick has occasion to
  cross-check this attribution with Aaron, fold the result back
  into this file.

## Composes with

- [`docs/research/2026-05-05-claudeai-codeact-fsharp-bridge-gibberlink-berman-aaron-forwarded-preservation.md`](../docs/research/2026-05-05-claudeai-codeact-fsharp-bridge-gibberlink-berman-aaron-forwarded-preservation.md)
  -- the verbatim Aaron-forwarded Claude.ai conversation that
  disclosed this source-set. Lands via PR #1605.
- [`memory/feedback_otto_364_search_first_authority_not_training_data_not_project_memory_aaron_2026_04_29.md`](feedback_otto_364_search_first_authority_not_training_data_not_project_memory_aaron_2026_04_29.md)
  -- the search-first-authority discipline that gates how this
  source-set is used. The set tells you where to search; Otto-364
  tells you that you must.
- [`memory/user_aaron_lang_next_conference_appreciation_anders_hejlsberg_intellectual_lineage_language_design_implementer_level_2026_04_25.md`](user_aaron_lang_next_conference_appreciation_anders_hejlsberg_intellectual_lineage_language_design_implementer_level_2026_04_25.md)
  -- adjacent substrate: Aaron tracks language-design anchors
  (Hejlsberg + LangNext). Pattern: Aaron follows specific people,
  not generic feeds.
- [`memory/user_aaron_datomic_hickey_big_inspiration_watched_all_talks_zeta_structural_inheritance_2026_05_05.md`](user_aaron_datomic_hickey_big_inspiration_watched_all_talks_zeta_structural_inheritance_2026_05_05.md)
  -- adjacent same-tick substrate: Aaron watches the talks of his
  intellectual anchors (Hickey, Datomic). The AI-news source-set is
  the same shape applied to weekly news intake.
- The four-property hodl ("ZFCv2") gate -- when an AI-news item
  lands, the substrate-fit-test is the four-property hodl. Tracking
  AI news without applying the gate produces noise; the gate is
  what converts forwarded items into substrate decisions.

## What this memory does NOT do

- It does **not** claim AI Explained is Aaron-confirmed. The channel
  is Claude.ai-included in the triumvirate; Aaron did not directly
  name it but also did not push back. Treat as one tier lower than
  Wes Roth + Matthew Berman until Aaron confirms.
- It does **not** lock the source-set as exhaustive. Aaron may
  reference items from outside these three channels; this set is
  the high-recall starting-point, not a closed list.
- It does **not** substitute for arXiv / paper-direct search when
  the half-remembered item has paper-shaped features (specific
  authors, institution, benchmark numbers). The cross-reference
  step is what produces strong candidates.
