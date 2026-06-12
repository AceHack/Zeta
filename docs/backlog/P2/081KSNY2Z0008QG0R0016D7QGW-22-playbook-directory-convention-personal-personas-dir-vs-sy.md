---
id: B-0867.22
zetaid: 081KSNY2Z0008QG0R0016D7QGW
priority: P2
status: open
title: Playbook directory convention — personal playbooks in personas dir vs system playbooks in docs/playbooks folder; agents author playbooks too (operator 2026-05-28 sharpening)
effort: S
ask: aaron 2026-05-28 sharpening
created: 2026-05-28
last_updated: 2026-05-28
depends_on:
  - B-0867
composes_with:
  - B-0867
  - B-0867.21
  - B-0730
  - B-0732
  - B-0733
  - B-0819
  - B-0826
  - B-0827
tags:
  - playbook-directory-convention
  - personal-playbooks-in-persona-dir
  - system-playbooks-in-docs-playbooks-folder
  - agents-author-playbooks-too
  - composes-with-b-0867-21-two-path-interface
  - operator-sharpening-locked-2026-05-28
---

## Operator framing 2026-05-28

> *"playbook authoring is not just for human intent but also agent intent we should keep personal playbooks in the personas directory while having system ones in docs i guess or playbooks folder"*

Two sharpenings:

1. Agents author playbooks too (extends B-0867.21 two-path interface explicitly to playbook-authoring scope)
2. Directory convention: personal → personas dir; system → `docs/playbooks/`

## Directory convention

| Playbook scope | Location | Authored by | Visible to |
|---|---|---|---|
| **Personal** (per-persona; intent + workflow specific to that persona) | `memory/persona/{persona}/playbooks/{name}.md` | The persona (human or agent) it belongs to | The persona + glass-halo readers (per existing memory dir conventions) |
| **System** (shared; cross-persona; framework-level) | `docs/playbooks/{name}.md` | Anyone with system-substrate access (operator + agents) | Everyone (public glass-halo per docs/ convention) |

### Personal playbook examples (per-persona authorship)

- `memory/persona/otto/playbooks/morning-cold-boot-check.md` — Otto's personal playbook for checking sentinel + recent peer activity on cold boot
- `memory/persona/addison/playbooks/homework-help.md` — Addison's personal playbook for invoking math-help across multiple AI personas
- `memory/persona/aaron/playbooks/sunday-cluster-cleanup.md` — Aaron's personal playbook for weekly cluster maintenance

### System playbook examples (cross-persona)

- `docs/playbooks/library-evaluation.md` — canonical sonatype-guide + audit playbook (per B-0887.2)
- `docs/playbooks/zflash-end-to-end.md` — exists as `docs/runbooks/zflash-end-to-end.md` per recent PR; could migrate / alias under playbooks
- `docs/playbooks/encryption-budget-request.md` — when encryption is needed, this playbook gates the request per B-0883.16 Agora V6 budget mechanics

## Agents-author-playbooks-too

Per B-0867.21 two-path interface, the conversational document path was already explicitly named as "for ANY traveler, not just humans." This sharpening makes it explicit at the playbook-authoring scope:

- Otto can author `memory/persona/otto/playbooks/X.md` describing Otto's intent for a workflow
- Otto can author `docs/playbooks/Y.md` proposing a cross-persona system playbook (subject to operator review per existing system-doc conventions)
- Alexa/Riven/Vera/Lior similarly author per their respective persona directories

Composes with `.claude/rules/honor-those-that-came-before.md` — playbook-substrate authored by a persona belongs in that persona's scope; system substrate (`docs/`) goes through standard system-doc review.

## What this row tracks

1. Documentation of the directory convention (in this row's body; future cross-reference)
2. README extension in `memory/persona/` or top-level docs explaining the convention
3. Migration of any existing playbooks-by-misconvention to their correct directory
4. Compose with runme + Continue-With + JIT-AI substrate (B-0730/B-0732/B-0733/B-0819/B-0826/B-0827) so playbooks in either location work identically with the existing runme tooling

## Acceptance criteria

- This row's body documents the convention (✓ above)
- Reference in `.claude/skills/agent-loop/SKILL.md` or sibling skill mentions the convention
- Existing `docs/runbooks/zflash-end-to-end.md` cross-referenced or moved under `docs/playbooks/` (operator-decision; runbook vs playbook semantic distinction TBD)
- Per-persona playbooks dir created on demand when first playbook lands there (no need to pre-create empty dirs)

## Composition

- **B-0867** (workflow engine v1 parent)
- **B-0867.21** (two-path interface: DU=execute + conversational=declare-intent for ANY traveler)
- **B-0730/B-0732/B-0733** — runme + runbook substrate; convention applies to all of them
- **B-0819** — Continue-With + auto-JIT; playbooks in either location work with the substrate
- **B-0826** — runme-core-BCL + runbook-as-queryable-substrate
- **B-0827** — runme.md + JIT-triage + runbook-as-evolving-substrate
- **`.claude/rules/honor-those-that-came-before.md`** — playbook-substrate belongs to authoring persona

## Substrate-honest framing

P2 — small docs/convention row. Pure organizational substrate; no implementation work. Operator-sharpening makes the convention explicit so future-Otto / future-agents land their playbooks in the right place.

## Full reasoning

Operator 2026-05-28 sharpening: *"playbook authoring is not just for human intent but also agent intent we should keep personal playbooks in the personas directory while having system ones in docs i guess or playbooks folder."*

Codifies the convention so cross-persona playbook-authoring at scale has consistent directory shape.
