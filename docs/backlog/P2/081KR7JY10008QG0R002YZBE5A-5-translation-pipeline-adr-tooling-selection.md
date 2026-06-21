---
id: 081KR7JY10008QG0R002YZBE5A
priority: P2
status: open
title: "081KR7JY10008QG0R002YZBE5A — Translation pipeline ADR: AI provider selection, quality metrics, human review process"
created: 2026-05-10
last_updated: 2026-05-10
parent: 081KQ0YZ80008QG0R002HWBHKJ
depends_on: [081KR50HA0008QG0R002TN3JX2, 081KR7JY10008QG0R000EGAPAN, 081KR7JY10008QG0R000D7JTBB]
classification: research-now
type: research
effort: S
decomposition: atomic
---

# 081KR7JY10008QG0R002YZBE5A — Translation pipeline ADR + tooling selection

**Slice of:** [081KQ0YZ80008QG0R002HWBHKJ](081KQ0YZ80008QG0R002HWBHKJ-translate-repo-to-other-human-languages.md)  
**Depends on:** 081KR50HA0008QG0R002TN3JX2 (anchor set reveals precision requirements), 081KR7JY10008QG0R000EGAPAN (drift tool ready), 081KR7JY10008QG0R000D7JTBB (xref validator ready)

## What

Produce `docs/DECISIONS/ADR-i18n-pipeline-YYYYMMDD.md` documenting:

1. **AI translation provider evaluation** — compare Claude (Anthropic API), DeepL API, Google Cloud Translation API, and open-weight models (NLLB-200) on:
   - Translation quality for the precision anchor set from 081KR50HA0008QG0R002TN3JX2 (controlled vocabulary test).
   - Cost per token / per word at 081KQ0YZ80008QG0R002HWBHKJ's L-effort scale.
   - Support for markdown preservation (do not translate code blocks, frontmatter keys, link syntax).
   - Retractability: can we regenerate translations idempotently from source?

2. **Quality metric design** — define what "good enough" means before any bulk translation:
   - BLEU / chrF / COMET score thresholds (or justification for human-only evaluation).
   - Native-speaker spot-check protocol (how many lines reviewed per file, by whom).
   - Precision-anchor consistency check (all anchor terms must match 081KR50HA0008QG0R002TN3JX2 translations exactly).

3. **Pipeline script skeleton** — `tools/i18n/translate.ts` stub (Bun) with the decided provider wired, CLI flags for `--source`, `--target-lang`, `--dry-run`.

4. **Human review process** — how to solicit native-speaker review (GitHub Discussions, community outreach, acknowledgment in translated files).

## Why

Before any bulk translation starts, documented decisions are required so the work is reproducible and retractable (Otto-291). If the first provider produces poor output on anchor terms, we need a written record to diagnose and switch. Per search-first-authority (Otto-364), provider quality comparisons must be based on current upstream benchmarks, not training-data priors.

## Acceptance criteria

1. ADR committed at `docs/DECISIONS/ADR-i18n-pipeline-YYYYMMDD.md` with all four sections populated.
2. `tools/i18n/translate.ts` stub committed with chosen provider wired, `--dry-run` flag implemented.
3. Precision anchor test: `--dry-run` mode prints what would be translated for 3 sample anchor terms from 081KR50HA0008QG0R002TN3JX2 without calling provider.
4. `dotnet build -c Release`: 0 warnings, 0 errors.
5. No `.sh` files (Rule 0).
6. PR body includes: ADR summary table (provider × quality × cost × markdown-safe) and decision rationale.

## Out of scope

- Actually running bulk translation (081KR7JY10008QG0R0022YWDVZ first language pilot).
- CI automation of the translation pipeline (post-pilot).
- Memory cross-reference linking in translated output (081KR7JY10008QG0R000D7JTBB covers validation; pipeline stub handles only single-file translation).
