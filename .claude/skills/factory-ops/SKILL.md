---
name: factory-ops
description: Factory operations meta — auditing the factory, automation gaps, balance/brake coverage, highest-uplift optimization.
---

# factory ops

Category skill (blueprint pack). The `description` above is the only thing the
router sees — broad and generic on purpose. The fat detail lives in the
blueprints below; open the one that matches and read it in full.

Governs its own form per `.claude/rules/rules-are-small-carved-sentences-pointing-to-docs.md`
and `.claude/rules/mirror-beacon-register-discipline.md` (carved sentence = hub /
Beacon; blueprint = satellite / Mirror). The directory is an independent shipping unit.

## Blueprints

- [`factory-audit`](blueprints/factory-audit.md) — Factory audit — governance rules, persona coverage, round cadence, memory hygiene, docs landscape, meta-process.
- [`factory-automation-gap-finder`](blueprints/factory-automation-gap-finder.md) — Factory automation gap scanner — finds manual factory work to automate across CI, release, hygiene, dependencies.
- [`factory-balance-auditor`](blueprints/factory-balance-auditor.md) — Factory balance audit — finds powers/authorities/write-surfaces lacking a compensating brake or reviewer.
- [`factory-optimizer`](blueprints/factory-optimizer.md) — Factory optimizer — highest-uplift intervention per maintainer effort; pairs with factory-balance-auditor.
