---
id: 081M10AAVAT087G0R0027M0GV5
type: task
state: in-progress
priority: P1
slug: dus-expand-to-dynamicvalue-and-softvalue-granular-dv2-repo-s
title: "DUs expand to DynamicValue and SoftValue; granular DV2 repo splits; local actions global effects"
created: 2026-08-27T00:36:18.399Z
depends_on: []
composes_with:
  - 081M100RB97087G0R0008EAAY7
  - 081M102M6Y2087G0R000407SW3
---

# DUs expand to DynamicValue and SoftValue; granular DV2 repo splits

Aaron 2026-08-26: DUs expand into DynamicValue and SoftValue — the bridge
to Bayesian stuff over our own interpretation. Dogfood while splitting
reusable chunks into their own repos; expect **dozens**, DV2 on change
rate *and* toolchain. Concert: **local actions lead to global effects**.

## This increment

- `src/Core/DuExpand.fs` — collapsed `"k"` object, SoftValue interpret,
  localAction, globalEffect (commuting observe)
- ROADMAP 8c — granular peer-repo splits, dogfood-then-extract
- No repository created (cutover is gated, ADR 2026-08-26)

## Remaining

- Route `NextAction` / `DbCommand` through `DuExpand` (ObserveBridge
  already uses `"k"`)
- BNN chooser reads SoftValue over DU cases
- Next extract after Harny (CRP: `zeta-formal` / `zeta-wasm`) — execute
  only via the cutover sequence, not from chat
