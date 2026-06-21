---
id: 081KR2E4K0008QG0R002FYNDT1
priority: P1
status: closed
closed: 2026-05-09
title: "Extract carved sentences from CLAUDE.md to .claude/rules/"
created: 2026-05-08
last_updated: 2026-05-09
parent: 081KQGDBJ0008QG0R003YPS5GB
depends_on: [081KR2E4K0008QG0R003DDAFJD]
classification: done
decomposition: atomic
type: feature
---

# 081KR2E4K0008QG0R002FYNDT1 — Extract carved sentences to rules

081KR2E4K0008QG0R003DDAFJD confirmed auto-load works. Moved 5 carved-sentence
bullets from CLAUDE.md to individual .claude/rules/<rule>.md
files. Each rule = one carved sentence + rationale pointer.
CLAUDE.md replaced verbose bullets with compact pointers.

## Extracted rules

1. `.claude/rules/encoding-rules-without-mechanizing.md`
2. `.claude/rules/mechanical-authorization-check.md`
3. `.claude/rules/substrate-or-it-didnt-happen.md`
4. `.claude/rules/all-complexity-is-accidental-in-greenfield.md`
5. `.claude/rules/largest-mechanizable-backlog-wins.md`

## Acceptance criteria

- [x] At least 5 carved sentences extracted from CLAUDE.md
- [x] Each in its own .claude/rules/<name>.md
- [x] CLAUDE.md shrinks by the extracted content (net -173 lines)
- [x] Build + tests still pass (0 warnings, 0 errors)
