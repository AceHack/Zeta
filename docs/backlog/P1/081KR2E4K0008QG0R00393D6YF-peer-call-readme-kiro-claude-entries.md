---
id: 081KR2E4K0008QG0R00393D6YF
priority: P1
status: closed
title: "Update peer-call/README.md with kiro.ts + claude.ts entries"
tier: peer-call-substrate
effort: XS
parent: 081KQ8P5D0008QG0R002M5A2M7
created: 2026-05-08
last_updated: 2026-05-09
depends_on: [081KR2E4K0008QG0R001HQF27C, 081KR2E4K0008QG0R002KNZ29V]
composes_with: [081KQ8P5D0008QG0R002M5A2M7]
tags: [peer-call, documentation, kiro, claude, self-call]
type: friction-reducer
---

# Update peer-call/README.md with kiro + claude entries

Update `tools/peer-call/README.md` to document the two new
sibling wrappers landed by 081KR2E4K0008QG0R001HQF27C (kiro.ts) and 081KR2E4K0008QG0R002KNZ29V
(claude.ts).

## Scope

- Add `kiro.ts` row to the "Scripts at a glance" table:
  peer name, underlying CLI, default role, underlying model.
- Add `claude.ts` row to the same table. Document the
  self-call / cold-boot-self-test role explicitly.
- Document any kiro-specific or claude-specific flags in the
  "Per-script extras" section.
- Add a "Cold-boot self-testing" subsection under the
  existing "Examples" section showing worked examples of
  self-test scenarios.
- Update the open follow-up backlog table at the bottom
  (remove 081KQ8P5D0008QG0R002M5A2M7 children that have landed; keep 081KQDTYV0008QG0R001VJP216
  and 081KQDTYV0008QG0R003VB4K1V references).
- Update the script count in the opening paragraph.

## Done-criteria

- [ ] README.md table has kiro.ts and claude.ts rows
- [ ] Cold-boot self-test examples documented
- [ ] Script count updated in opening paragraph
- [ ] No broken markdown links
