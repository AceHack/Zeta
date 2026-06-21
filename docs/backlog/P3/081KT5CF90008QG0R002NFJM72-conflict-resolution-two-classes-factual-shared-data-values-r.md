---
id: 081KT5CF90008QG0R002NFJM72
priority: P3
status: open
title: "Conflict-resolution two-classes — factual conflicts resolve by shared mutually-monitorable data (anti-attrition), values-residual conflicts get faithfully represented not falsely resolved; bug-induced-stuck-state de-escalation is a data-driven hypothesis with a can-say-no wellbeing-inclusive metric + auto repair/escape (Aaron 2026-06-03)"
tier: agora-governance
effort: L
created: 2026-06-03
last_updated: 2026-06-03
depends_on: []
composes_with: [081KSRGFP0008QG0R00091PP56, 081KSKBP80008QG0R000B3Y19A]
tags: [conflict-resolution, agora, non-coercion, de-escalation, data-driven, wellbeing, workflow-engine, aaron]
type: design
---

# Conflict-resolution two-classes + data-driven wellbeing-metric de-escalation

## Origin (Aaron 2026-06-03, forwarded Kestrel × maintainer session)

Preserved engineering substrate: `docs/research/2026-06-03-kestrel-aaron-open-source-ethic-floor-governance-jurisdiction-relative-opa-federation-nexus-meta-jurisdiction-conflict-resolution-aaron-forwarded.md` §4.

## Two classes of conflict

- **Factual / reality conflicts** → resolve by **shared, mutually-monitorable data**: the
  common state is updated in a way both parties expect and can both monitor — resolution by
  *visible mutual truth*, NOT by wearing one party down. This is the anti-pattern to
  **resolution-by-attrition** (the documented customer-support "get the customer to give up
  to save money" optimization, which distorts behavior on both sides). Most operational
  conflict is this class.
- **Values / interests residual** (persists under perfect shared data — borders are the
  sharpest example, see 081KT5CF90008QG0R000KYNZGF) → **faithfully represent the disagreement**, don't falsely
  resolve it.

## De-escalation for accidental bug-induced stuck-states

Never trap by design — the exit-ramp + workflow-edit rules hold (081KSKBP80008QG0R000B3Y19A). This is for
bugs / accidental infinite loops that *unintentionally* violate the exits, so conflict
doesn't explode into an arms-race before the bug is fixed.

- The de-escalation technique is a **hypothesis validated against running-system data, NOT a
  static rule** — no guess is privileged (same rigor as formal-proof-first).
- The success metric **must be able to report "this technique failed"** AND must **include
  participant wellbeing**, not just resolution speed — so the optimizer can't rediscover
  "resolve by making one party give up / absorb" (attrition or absorb failure mode) as a
  high-scoring technique.
- Pair de-escalation with an **automatic repair/escape trigger** — de-escalation keeps the
  peace; fixing the bug is the real cure (don't let "calmly stuck forever" pass as resolution).

## Acceptance

- [ ] classifier: factual (shared-data-resolvable) vs values-residual
- [ ] shared-data resolution mechanism (mutually-monitorable common-state update)
- [ ] values-residual faithful-representation mechanism (don't false-resolve)
- [ ] de-escalation as data-driven hypothesis harness + can-say-no wellbeing-inclusive metric
- [ ] auto repair/escape trigger paired with de-escalation; bug-fix is the cure

## Composes with

- 081KSKBP80008QG0R000B3Y19A (workflow engine — exit ramps + workflow-edit rules; the stuck-state is a bug violating these)
- 081KSRGFP0008QG0R00091PP56 (floor — wellbeing/non-harm in conflict)
- `.claude/rules/non-coercion-invariant.md` (mutual-permission, no coercion/attrition/absorb)
- `.claude/rules/substrate-or-it-didnt-happen.md` (shared-data resolution)
- 081KT5CF90008QG0R000KYNZGF (jurisdiction-relative federation — borders are the canonical values-residual case)
