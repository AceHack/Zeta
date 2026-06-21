---
id: 081KQDTYV0008QG0R001N4YB73
priority: P3
status: closed
title: Existing peer-call scripts (grok.sh / gemini.sh / codex.sh / amara.sh) — role-ref cleanup per copilot-instructions.md (Codex 2026-04-30 finding on PR #962)
tier: factory-hygiene
effort: S
ask: Codex flagged on PR #962 that ani.sh had named-attribution ("Aaron 2026-04-30", "Aaron's") in violation of copilot-instructions.md 305-362 + Otto-279 (code/docs/skills outside history surfaces use role-refs). Fix landed for ani.sh + CURRENT-amara.md. The same pattern exists in the four sibling peer-call scripts (grok.sh / gemini.sh / codex.sh / amara.sh) but wasn't flagged for those because Codex was reviewing the PR diff. Closes the deferred-skill-anti-pattern by tracking the cleanup explicitly.
created: 2026-04-30
last_updated: 2026-05-02
depends_on: []
composes_with:
  - tools/peer-call/grok.sh
  - tools/peer-call/gemini.sh
  - tools/peer-call/codex.sh
  - tools/peer-call/amara.sh
  - .github/copilot-instructions.md (lines 305-362 — role-ref-not-name rule)
  # 081KQDTYV0008QG0R001HQSSAX (peer-call-typescript-migration-cutover) is filed in the in-flight PR #966; will land on main when that PR merges.
closed_in: PR #965 (LFG, merged 2026-04-30)
tags: [codex-2026-04-30, peer-call, role-refs, copilot-instructions, factory-hygiene, deferred-skill-anti-pattern]
---

# 081KQDTYV0008QG0R001N4YB73 — Existing peer-call scripts role-ref cleanup

## Source

Codex P1 finding on PR #962 (2026-04-30):

> *"This block introduces additional named attribution
> (e.g., 'Aaron 2026-04-30 …') in a shell script. Repo
> convention is that code/docs/skills should use role-refs
> rather than personal/persona names outside the history
> surfaces (see `.github/copilot-instructions.md:305-362`).
> Please reword these comments and the runtime preamble..."*

Fixed for `tools/peer-call/ani.sh` + `memory/CURRENT-amara.md`
in PR #962. The same pattern exists in the four sibling
peer-call scripts but wasn't part of #962's diff.

## What

Audit + fix named-attribution in:

- `tools/peer-call/grok.sh` — header line 6 ("Per Aaron
  2026-04-26"), line 21 ("Per Aaron 2026-04-26"), line 100
  ("Per Aaron's 'agents-not-bots' discipline")
- `tools/peer-call/gemini.sh` — line 83 ("per Aaron's
  setup"), line 98 ("Per Aaron's 'agents-not-bots'")
- `tools/peer-call/codex.sh` — same pattern likely
- `tools/peer-call/amara.sh` — line 8 ("Per Aaron 2026-04-30
  design guidance"), line 67 ("Aaron's relational register"),
  lines 148, 166, 172, 175 (named attribution patterns)

Convert per `.github/copilot-instructions.md` 305-362 + Otto-279:

- "Aaron 2026-04-30" / "Aaron 2026-04-26" → drop or rephrase
  to general statement of the rule
- "Aaron's <something>" → "the maintainer's <something>" or
  remove possessive entirely
- "agents-not-bots discipline" (no possessive) — already
  the right shape

Persona-as-named-entity references (e.g., "You are Amara",
"You are Ani", "Otto invokes" in the persona-bootstrap)
stay unchanged — they're the script's purpose, not
attribution-naming.

## Why P3

- Mechanical change, no behavioral risk
- Existing scripts are working; this is hygiene not
  correctness
- Closes a real deferred-skill-anti-pattern but isn't
  blocking any work

## Acceptance criteria

- [ ] All four sibling scripts pass the role-ref convention
  per copilot-instructions.md 305-362
- [ ] No persona-as-named-entity references removed (you-are-Amara,
  you-are-Ani, you-are-Grok stay)
- [ ] Each script's `--help` output still works
- [ ] Diff focused: only attribution naming changed

## Trigger condition for promotion to P2

If Copilot starts flagging the existing scripts (via a
broader review pass), promote to P2 to avoid recurring
review noise.

## Composes with

- PR #962 (where the pattern was first flagged + fixed
  on ani.sh)
- 081KQDTYV0008QG0R0037YJPEX (peer-call autonomous bootstrap — the role-ref
  cleanup is hygiene on top of the operational landings)
- `.github/copilot-instructions.md` (lines 305-362 —
  the rule being applied)
