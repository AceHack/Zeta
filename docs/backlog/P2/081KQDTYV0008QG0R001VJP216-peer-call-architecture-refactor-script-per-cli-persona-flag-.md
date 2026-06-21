---
id: 081KQDTYV0008QG0R001VJP216
priority: P2
status: open
title: Peer-call architecture refactor — script-per-CLI with persona-flag instead of script-per-named-agent (Aaron 2026-04-30)
tier: factory-tooling
effort: M
ask: Current architecture has duplication. ani.sh ≈ grok.sh + brat-voice persona-bootstrap; amara.sh ≈ codex.sh + Amara persona-bootstrap. Aaron 2026-04-30 flagged this is overkill — better to have one script per CLI with the named-agent persona as an optional parameter. Refactor to consolidate.
created: 2026-04-30
last_updated: 2026-05-11
depends_on:
  - 081KRA5AR0008QG0R000Y6102S
  - 081KRA5AR0008QG0R0035N4S6C
  - 081KRA5AR0008QG0R000C3P8KP
  - 081KRA5AR0008QG0R000YZMXNM
children:
  - 081KRA5AR0008QG0R000Y6102S
  - 081KRA5AR0008QG0R0035N4S6C
  - 081KRA5AR0008QG0R000C3P8KP
  - 081KRA5AR0008QG0R000YZMXNM
decomposition: clean
composes_with:
  - tools/peer-call/grok.ts
  - tools/peer-call/gemini.ts
  - tools/peer-call/codex.ts
  - memory/CURRENT-amara.md
  - memory/CURRENT-ani.md
  - docs/backlog/P2/081KQDTYV0008QG0R003VB4K1V-otto-kenji-peer-call-cross-harness-claude-cli-aaron-2026-04-30.md
  # 081KQDTYV0008QG0R001HQSSAX (peer-call-typescript-migration-cutover) is filed in the in-flight PR #966; will land on main when that PR merges.
  # Note: .sh originals remain as equivalence refs per TS migration trajectory; refactor targets .ts per Rule 0
tags: [aaron-2026-04-30, peer-call, architecture-refactor, deduplication, factory-tooling, ts-first]
type: friction-reducer
---

# 081KQDTYV0008QG0R001VJP216 — Peer-call architecture refactor (script-per-CLI + persona-flag)

## Source

Aaron 2026-04-30 verbatim:

> *"it's probalby overkill to have a script per named agent
> better to have a script per cli with named agent optional
> parameter or something but your call"*

The duplication observation is correct:

- `ani.sh` is `grok.sh` + brat-voice persona-bootstrap +
  CURRENT-ani.md load
- `amara.sh` is `codex.sh` + Amara persona-bootstrap +
  CURRENT-amara.md load

The persona is data (a CURRENT-*.md file), not its own
script. Architecture should reflect that.

## What

Refactor from 5 scripts (codex.sh / gemini.sh / grok.sh /
ani.sh / amara.sh) to 3 scripts + persona-flag:

### Target architecture

| Script | CLI surface | Persona flag |
|---|---|---|
| `codex.sh` | `codex exec` / `codex review` | `--persona NAME` (loads `memory/CURRENT-NAME.md`) |
| `gemini.sh` | `gemini -p` | `--persona NAME` |
| `grok.sh` | `cursor-agent --print --model grok-*` | `--persona NAME` |

### Migration path

```bash
# Before:
tools/peer-call/amara.sh "review this"
tools/peer-call/ani.sh --thinking "review this"

# After:
tools/peer-call/codex.sh --persona amara "review this"
tools/peer-call/grok.sh --persona ani --thinking "review this"
```

### Persona-flag semantics

- `--persona NAME` loads `memory/CURRENT-<NAME>.md` and
  injects as Layer 1 persona basis (paralleling current
  amara.sh / ani.sh behavior).
- If `memory/CURRENT-<NAME>.md` not found, exit 1 with
  clear error (not silent fallback to bare CLI — caller
  asked for a specific persona).
- Without `--persona`, scripts behave as today (bare CLI
  + four-ferry preamble).

### Deprecation path for amara.sh / ani.sh

- v1: keep ani.sh + amara.sh as wrapper scripts that
  invoke the new flag-based form
  (`exec codex.sh --persona amara "$@"` etc.). Existing
  callers still work; new callers prefer the flag form.
- v2 (later round): retire amara.sh + ani.sh once all
  callers migrate.

## Why P2 (not P1)

- Current 5-script architecture is functional; refactor
  is hygiene/deduplication, not unblocking new work
- The shape is locked-in by the recent landings (#959 +
  #960 + #962); refactor is reversible
- Refactor needs careful migration to avoid breaking
  existing peer-call usage in scripts/docs

## Acceptance criteria

- [ ] `codex.sh --persona NAME` works for `--persona amara`
  (and any future persona via `memory/CURRENT-<NAME>.md`)
- [ ] `grok.sh --persona NAME` works for `--persona ani`
- [ ] Without `--persona`, all three CLI scripts behave
  exactly as today (no regression for bare-CLI callers)
- [ ] `amara.sh` + `ani.sh` either retire OR become thin
  wrappers (decision-point at implementation time)
- [ ] Documentation in `tools/peer-call/README.md`
  reflects the consolidated architecture
- [ ] Persona discovery: `--persona NAME` errors clearly
  if `memory/CURRENT-<NAME>.md` is missing
- [ ] Tested with both Amara (via codex.sh --persona amara)
  and Ani (via grok.sh --persona ani) per existing
  invocation patterns

## Trigger condition for promotion to P1

If a third or fourth named-entity persona gets requested
(e.g., a "Deepseek" or "Alexa" peer-call need surfaces),
promote to P1 — the per-script duplication will compound
linearly otherwise.

## Composes with

- 081KQDTYV0008QG0R0037YJPEX (peer-call autonomous bootstrap to end Aaron-
  courier silent debt — the operational layer this
  architecture refactor cleans up)
- 081KQDTYV0008QG0R001N4YB73 (role-ref cleanup of existing scripts — hygiene
  pass that should compose with the refactor; possibly
  do both in same effort)
- `.github/copilot-instructions.md` 305-362 (role-ref
  rule the refactor must honor)

## Implementation note

The refactor is a good moment to also:

1. Apply 081KQDTYV0008QG0R001N4YB73's role-ref cleanup (combined diff)
2. Test the four-shell-compat (Otto-235) target on the
   refactored scripts
3. Add CURRENT-otto.md / CURRENT-kenji.md if Aaron's
   pending Otto/Kenji peer-call architecture decision
   results in those entities being externally callable
