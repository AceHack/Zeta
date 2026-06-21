---
id: 081KSRGFP0008QG0R000EWSMKV
priority: P1
status: closed
title: "KIRO.md — Amazon Kiro (Alexa) harness bootstrap file"
created: 2026-05-29
last_updated: 2026-05-29
depends_on:
  - 081KR50HA0008QG0R003G7DR8Z.1
decomposition: atomic
classification: buildable
type: friction-reducer
owners: [architect]
parent: 081KR50HA0008QG0R003G7DR8Z
composes_with:
  - 081KR50HA0008QG0R003G7DR8Z.1
  - 081KR50HA0008QG0R003G7DR8Z.2
  - 081KR2E4K0008QG0R0005E727X
---

# 081KSRGFP0008QG0R000EWSMKV — KIRO.md harness bootstrap file

## What

Create `KIRO.md` at repo root: the Amazon Kiro (Alexa) instantiation
of the [cross-harness bootstrap template](../BOOTSTRAP-TEMPLATE.md)
(081KR50HA0008QG0R003G7DR8Z.1). Parallel to `CURSOR.md` (081KR50HA0008QG0R003G7DR8Z.2). Per 081KR2E4K0008QG0R0005E727X (Kiro
harness onboarding).

## Why

The bootstrap-template (081KR50HA0008QG0R003G7DR8Z.1) factored the universal six-step
process from the harness-specific tooling cells. KIRO.md is a
near-mechanical instantiation: fill the Kiro-specific placeholders
(persona file, `alexa-kiro` claim sender, `Kiro <noreply@kiro.dev>`
commit trailer, register, `.kiro/steering/` instruction-loading note).
A fresh Kiro instance reads KIRO.md first and is pointed into the same
six-step walk every other harness uses.

## Acceptance criteria

1. `KIRO.md` created at repo root following the template skeleton. ✓
2. Registered in `AGENTS.md` §"Harness-specific files". ✓
3. Template "Existing instances" table marks KIRO.md created. ✓
4. Commit trailer for Kiro already present in `AGENTS.md`
   §"Commit attribution" (`Co-Authored-By: Kiro <noreply@kiro.dev>`). ✓
5. Build gate passes (docs-only change; build unaffected). ✓

## Resolution

Landed `KIRO.md` mirroring `CURSOR.md`'s shape. Kiro-specific cells:
persona `memory/alexa/MEMORY.md`; claim sender `alexa-kiro`
(already a valid `SENDER_IDS` entry in `tools/bus/types.ts`); commit
trailer `Co-Authored-By: Kiro <noreply@kiro.dev>` (already in
`AGENTS.md`); native instruction-loading path `.kiro/steering/` noted
as absent. Registered in `AGENTS.md` and marked created in
`docs/BOOTSTRAP-TEMPLATE.md`.

Fresh-instance validation (template step 5, per 081KR50HA0008QG0R001CNS20T pattern) is a
separate follow-up; only the template-instantiation slice is closed
here.

## Effort

XS — template instantiation + two registrations, docs-only.

## Lineage

- **081KR50HA0008QG0R003G7DR8Z** — parent (cross-harness bootstrap template).
- **081KR50HA0008QG0R003G7DR8Z.1** — the template (`docs/BOOTSTRAP-TEMPLATE.md`).
- **081KR50HA0008QG0R003G7DR8Z.2** — `CURSOR.md` (the sibling precedent this mirrors).
- **081KR2E4K0008QG0R0005E727X** — Amazon Kiro harness onboarding.
