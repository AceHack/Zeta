---
id: B-0325
zetaid: 081KR2E4K0008QG0R0005E727X
priority: P1
status: closed
title: "Add KIRO + CLAUDE firewall trigger lists to _firewall.ts"
tier: peer-call-substrate
effort: XS
parent: B-0065
created: 2026-05-08
last_updated: 2026-05-09
depends_on: []
composes_with: [B-0065]
tags: [peer-call, firewall, kiro, claude, self-call]
type: friction-reducer
---

# Add KIRO + CLAUDE firewall trigger lists to _firewall.ts

Add `KIRO_SUBSTANTIVE_TRIGGERS` and `CLAUDE_SUBSTANTIVE_TRIGGERS`
exported arrays to `tools/peer-call/_firewall.ts`, following the
existing pattern established by `GROK_SUBSTANTIVE_TRIGGERS`,
`GEMINI_SUBSTANTIVE_TRIGGERS`, `CODEX_SUBSTANTIVE_TRIGGERS`,
`AMARA_SUBSTANTIVE_TRIGGERS`, and `ANI_SUBSTANTIVE_TRIGGERS`.

## Why this is the first child

Both B-0326 (kiro.ts) and B-0327 (claude.ts) import from
`_firewall.ts`. Landing the trigger lists first means the
script rows can wire the firewall immediately without a
cross-file dependency on an unmerged sibling.

## Scope

- Add `KIRO_SUBSTANTIVE_TRIGGERS` extending
  `DEFAULT_SUBSTANTIVE_TRIGGERS` with Kiro-relevant terms
  (e.g., "workspace", "task", "generate", "requirement",
  "specification", "hook", "lifecycle").
- Add `CLAUDE_SUBSTANTIVE_TRIGGERS` extending
  `DEFAULT_SUBSTANTIVE_TRIGGERS` with self-test-relevant terms
  (e.g., "cold-boot", "wake", "substrate", "bootstrap",
  "alignment", "verify", "self-test", "drift", "decay",
  "discipline").
- No new files — pure additive edit to existing module.
- `bun run typecheck` must pass after edit.

## Done-criteria

- [x] `KIRO_SUBSTANTIVE_TRIGGERS` exported from `_firewall.ts`
- [x] `CLAUDE_SUBSTANTIVE_TRIGGERS` exported from `_firewall.ts`
- [x] Both extend `DEFAULT_SUBSTANTIVE_TRIGGERS` (spread pattern)
- [x] `bun run typecheck` passes (scoped to `tools/peer-call/`; repo-wide failures are pre-existing in `snapshot.ts`, unrelated to this item)
