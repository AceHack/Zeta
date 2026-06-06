---
id: B-0004.5
zetaid: 081KR7JY10008QG0R002YZBE5A
priority: P2
status: open
title: "B-0004.5 — Translation pipeline ADR: AI provider selection, quality metrics, human review process"
created: 2026-05-10
last_updated: 2026-05-10
parent: B-0004
depends_on: [B-0004.2, B-0004.3, B-0004.4]
classification: research-now
type: research
effort: S
decomposition: atomic
---

# B-0004.5 — Translation pipeline ADR + tooling selection

**Slice of:** [B-0004](B-0004-translate-repo-to-other-human-languages.md)  
**Depends on:** B-0004.2 (anchor set reveals precision requirements), B-0004.3 (drift tool ready), B-0004.4 (xref validator ready)

## What

Produce `docs/DECISIONS/ADR-i18n-pipeline-YYYYMMDD.md` documenting:

1. **AI translation provider evaluation** — compare Claude (Anthropic API), DeepL API, Google Cloud Translation API, and open-weight models (NLLB-200) on:
   - Translation quality for the precision anchor set from B-0004.2 (controlled vocabulary test).
   - Cost per token / per word at B-0004's L-effort scale.
   - Support for markdown preservation (do not translate code blocks, frontmatter keys, link syntax).
   - Retractability: can we regenerate translations idempotently from source?

2. **Quality metric design** — define what "good enough" means before any bulk translation:
   - BLEU / chrF / COMET score thresholds (or justification for human-only evaluation).
   - Native-speaker spot-check protocol (how many lines reviewed per file, by whom).
   - Precision-anchor consistency check (all anchor terms must match B-0004.2 translations exactly).

3. **Pipeline script skeleton** — `tools/i18n/translate.ts` stub (Bun) with the decided provider wired, CLI flags for `--source`, `--target-lang`, `--dry-run`.

4. **Human review process** — how to solicit native-speaker review (GitHub Discussions, community outreach, acknowledgment in translated files).

## Why

Before any bulk translation starts, documented decisions are required so the work is reproducible and retractable (Otto-291). If the first provider produces poor output on anchor terms, we need a written record to diagnose and switch. Per search-first-authority (Otto-364), provider quality comparisons must be based on current upstream benchmarks, not training-data priors.

## Acceptance criteria

1. ADR committed at `docs/DECISIONS/ADR-i18n-pipeline-YYYYMMDD.md` with all four sections populated.
2. `tools/i18n/translate.ts` stub committed with chosen provider wired, `--dry-run` flag implemented.
3. Precision anchor test: `--dry-run` mode prints what would be translated for 3 sample anchor terms from B-0004.2 without calling provider.
4. `dotnet build -c Release`: 0 warnings, 0 errors.
5. No `.sh` files (Rule 0).
6. PR body includes: ADR summary table (provider × quality × cost × markdown-safe) and decision rationale.

## Out of scope

- Actually running bulk translation (B-0004.7 first language pilot).
- CI automation of the translation pipeline (post-pilot).
- Memory cross-reference linking in translated output (B-0004.4 covers validation; pipeline stub handles only single-file translation).
