---
id: 081KR50HA0008QG0R000C6N7CJ
priority: P2
status: open
title: "081KR50HA0008QG0R000C6N7CJ — Lit review: tool-use-vs-trained-embodiment grounding distinction (Otto-340 structural nuance)"
created: 2026-05-09
last_updated: 2026-05-09
parent: 081KQ0YZ80008QG0R001WZ4JE8
depends_on: []
classification: research-now
type: research
effort: M

---

# 081KR50HA0008QG0R000C6N7CJ — Lit review: tool-use-vs-trained-embodiment grounding distinction

**Slice of:** [081KQ0YZ80008QG0R001WZ4JE8](081KQ0YZ80008QG0R001WZ4JE8-embodiment-grounding-analysis-isaac-sim-and-other-robotics-sim-platforms-otto-340-counter.md)

## What

Produce a research doc at `docs/research/081KR50HA0008QG0R000C6N7CJ-tool-use-vs-trained-embodiment-grounding.md` that
cleanly answers the structurally most-important question surfaced in 081KQ0YZ80008QG0R001WZ4JE8:

> "A language-model that has access to a sim via tools is not the same as a language-model that was
> *trained on* sim experience. Otto-340's claim was about the latter (substrate-shaping). Tool-use via
> sim doesn't break Otto-340; only training-on-sim-experience would."

## Scope

Cover, per search-first-authority (Otto-364), current state of:

1. **Vision-Language-Action (VLA) models** — RT-2 (Google DeepMind 2023), RT-X / Open X-Embodiment dataset,
   π0 / Physical Intelligence. These are LLMs/VLMs *trained on* embodied data; do they show measurable
   grounding differences vs pure-language counterparts?
2. **Multi-modal trained embodiment** — Gato (DeepMind 2022), its successor architectures. Does training on
   sensor/action data produce different inductive biases in the language-generation layers?
3. **Tool-use grounded agents** — ReAct, Toolformer, Claude/GPT tool-calling patterns. Do these agents
   demonstrate anything resembling grounding, or only planning over abstract action descriptions?
4. **Sim-to-real and embodied alignment** — any Anthropic public work on embodied safety, plus RLHF-with-
   embodied-reward literature.
5. **The Helen Keller minimum-channel hypothesis** (pointer to 081KR50HA0008QG0R000MRSMAB parallel track) — does *any*
   single non-linguistic channel provide meaningful grounding? Note the parallel child and avoid duplicating it.

## Deliverable

`docs/research/081KR50HA0008QG0R000C6N7CJ-tool-use-vs-trained-embodiment-grounding.md` with:

- Section per research cluster above.
- Clear verdict on whether tool-use-via-sim can challenge Otto-340, or whether only trained-embodiment can.
- Platform implications for 081KR50HA0008QG0R0008PPTEK (which platforms support both modes?).
- Otto-340 status: preserved / weakened / architecture-contingent / refuted — with citations.

## Acceptance criteria

1. Research doc committed to `docs/research/`.
2. Each claim has a cited upstream source (search-first; training-data-only assertions flagged).
3. Verdict on tool-use-vs-trained-embodiment stated clearly and in one sentence.
4. `dotnet build -c Release`: 0 warnings, 0 errors (no code touched; doc-only).
5. PR body includes focused check: build result + one-sentence verdict.

## Out of scope

- Platform selection (081KR50HA0008QG0R0008PPTEK).
- Any code / spike (081KR50HA0008QG0R002ZRCAF7+).
- Detailed Helen Keller analysis (081KR50HA0008QG0R000MRSMAB parallel child).

## Pre-start checklist

- Prior-art search: skill router checked (no existing embodiment-grounding skill); `docs/research/` grepped
  for "embodiment" — no existing doc; 081KQTPYE0008QG0R0028GRW88 (ROM/gameplay embodiment analog, P3) noted as composes_with but
  does not duplicate this lit-review slice; Otto-340 feedback file is context, not prior art.
- Dependency check: no `depends_on` — can start immediately.
- Rule 0: no `.sh` files; doc-only output.
