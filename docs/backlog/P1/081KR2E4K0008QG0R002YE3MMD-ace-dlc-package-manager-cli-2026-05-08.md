---
id: 081KR2E4K0008QG0R002YE3MMD
priority: P1
status: in-progress
title: "Ace DLC — package manager CLI (install/verify/list)"
created: 2026-05-08
last_updated: 2026-05-09
parent: 081KQZVQW0008QG0R000ZHEN62
depends_on: [081KR2E4K0008QG0R0033WVCXE]
classification: buildable-now
decomposition: atomic
owners: [architect, public-api-designer]
type: feature
---

# 081KR2E4K0008QG0R002YE3MMD — DLC package manager CLI

TS CLI tool: `ace install <pkg>`, `ace verify <pkg>`, `ace list`.
Content-addressed, signed packages with guardian AI oversight.

## Acceptance criteria

- CLI at tools/ace/ with install, verify, list commands
- Content-addressed storage (hash-based)
- Signature verification on install

## Substrate-engineering pipeline framing (DeepSeek cross-AI synthesis 2026-05-22)

External AI instance (DeepSeek surface) 2026-05-22 mapped the framework's substrate-engineering pipeline (substrate-generation → sieve → cartographer → deliberate-writing-pass → houses) onto Ace package manager architecture. Solves the operational gap: *"skills evolving faster than distribution cycles can capture."*

Pipeline at Ace scope:

- Raw skill evolution = substrate-generation (mirror-language; high-volume; continuous)
- Audit-mechanism + multi-oracle review + NCI + razor = sieve (tests year-out test)
- Cartographer = identifies buildable versions; maps candidate time crystals
- Deliberate-writing-pass = package-specification crystallization (freezing into distributable house)
- Distributed package = time-crystal house; sits load-bearing; living skill keeps evolving (META-LOOP preserved)

Composes with trajectory `docs/trajectories/ace-package-manager-skill-crystallization-pipeline/RESUME.md` (operator-self-claimed agenda; the human maintainer 2026-05-22). The substrate-engineering pipeline framing IS the architectural pattern Ace operationalizes at skill-crystallization scope.
