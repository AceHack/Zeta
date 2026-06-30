---
id: B-0328
priority: P1
status: open
title: "Update peer-call/README.md with kiro.ts + claude.ts entries"
tier: peer-call-substrate
effort: XS
parent: B-0065
created: 2026-05-08
last_updated: 2026-05-08
depends_on: [B-0326, B-0327]
composes_with: [B-0065]
tags: [peer-call, documentation, kiro, claude, self-call]
type: friction-reducer
---

# Update peer-call/README.md with kiro + claude entries

Update `tools/peer-call/README.md` to document the two new
sibling wrappers landed by B-0326 (kiro.ts) and B-0327
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
  (remove B-0065 children that have landed; keep B-0120
  and B-0121 references).
- Update the script count in the opening paragraph.

## Done-criteria

- [ ] README.md table has kiro.ts and claude.ts rows
- [ ] Cold-boot self-test examples documented
- [ ] Script count updated in opening paragraph
- [ ] No broken markdown links
