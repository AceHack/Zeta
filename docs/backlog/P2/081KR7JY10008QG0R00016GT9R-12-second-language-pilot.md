---
id: 081KR7JY10008QG0R00016GT9R
priority: P2
status: open
title: "081KR7JY10008QG0R00016GT9R — Second language pilot: validate process reproducibility across a different language family"
created: 2026-05-10
last_updated: 2026-05-10
parent: 081KQ0YZ80008QG0R002HWBHKJ
depends_on: [081KR7JY10008QG0R003YPVJB1, 081KR7JY10008QG0R001XQ6N71, 081KR7JY10008QG0R002VN6707]
classification: blocked
type: feature
effort: M
decomposition: atomic
---

# 081KR7JY10008QG0R00016GT9R — Second language pilot

**Slice of:** [081KQ0YZ80008QG0R002HWBHKJ](081KQ0YZ80008QG0R002HWBHKJ-translate-repo-to-other-human-languages.md)  
**Depends on:** 081KR7JY10008QG0R003YPVJB1 (first language memory+skills complete), 081KR7JY10008QG0R001XQ6N71 (structure formalized), 081KR7JY10008QG0R002VN6707 (external surfaces done for first language)

## What

Apply the full translation pipeline to a second language from the 081KQ0YZ80008QG0R002HWBHKJ candidate list, chosen via:

- A mini-ADR update to 081KR7JY10008QG0R003SATDK8 recording the second language selection with scoring.
- Using the established `docs/i18n/STRUCTURE.md` structure from 081KR7JY10008QG0R001XQ6N71 — the process should be mechanical.
- Running the same toolchain: `bun tools/i18n/translate.ts`, `drift-check`, `xref-check`, `anchor-check`, `gen-index`.
- Producing the same artifacts: P0 substrate, memory + skills, external surfaces, per-language README, `anchors-<lang>.json`.

Preferred second language: one from a **different language family** than the first pilot (e.g., if first is Spanish/Romance, second should be Arabic/Semitic or Mandarin/Sino-Tibetan or Hindi/Indo-Aryan) to stress-test the pipeline's generalization.

Also: run a retrospective. Produce `docs/research/081KR7JY10008QG0R00016GT9R-process-retrospective.md` answering:

- What broke in the tooling when processing the second language (right-to-left text, CJK character handling, markdown width, etc.)?
- What needed manual fixup that should be automated?
- What is the estimated effort for language N+1 given N is done?

## Why

One pilot proves the concept. Two pilots from different language families prove the process. After 081KR7JY10008QG0R00016GT9R ships, the pattern is established: the remaining 12 candidate languages are mechanical follow-ons, potentially parallelizable across community volunteer teams. The retrospective captures where the L-effort estimate was right and where it was wrong — per "largest mechanizable backlog wins," the retrospective seeds further automation. 081KQ0YZ80008QG0R002HWBHKJ body: *"Pace: ship one language at a time + verify reception before next."* 081KR7JY10008QG0R00016GT9R is the second step in that paced expansion.

## Acceptance criteria

1. Full translated artifact set for second language committed under `docs/i18n/<code2>/`.
2. `bun tools/i18n/gen-index.ts` updated `docs/i18n/INDEX.md` shows 2 languages with coverage percentages.
3. All three validators (`drift-check`, `xref-check`, `anchor-check`) green for second language.
4. `docs/research/081KR7JY10008QG0R00016GT9R-process-retrospective.md` committed with the three retrospective questions answered.
5. 081KR7JY10008QG0R003SATDK8 ADR mini-update with second language selection rationale committed.
6. `dotnet build -c Release`: 0 warnings, 0 errors.
7. PR body: INDEX.md output showing both languages, retrospective summary (≤10 lines).

## Out of scope

- Third and subsequent languages (they follow the same process as 081KR7JY10008QG0R00016GT9R mechanically; open separate child rows as demand warrants).
- Full automation of translation (the pipeline ADR from 081KR7JY10008QG0R002YZBE5A may be updated based on retrospective findings; separate task).
- Code comment translation (a separate future child due to its different complexity profile).
