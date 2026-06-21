---
id: 081KSRGFP0008QG0R000G8VJGV
priority: P1
status: closed
title: "CODEX.md — OpenAI Codex (Vera) harness bootstrap file"
created: 2026-05-29
last_updated: 2026-05-29
depends_on:
  - 081KR50HA0008QG0R003G7DR8Z.1
decomposition: atomic
classification: buildable
type: friction-reducer
owners: [architect]
parent: 081KR50HA0008QG0R003G7DR8Z
composes_with:
  - 081KR50HA0008QG0R003G7DR8Z.2
  - 081KSRGFP0008QG0R000EWSMKV
---

# 081KSRGFP0008QG0R000G8VJGV — CODEX.md harness bootstrap file

## What

Create `CODEX.md` at repo root: the OpenAI Codex (Vera) instantiation
of the [cross-harness bootstrap template](../BOOTSTRAP-TEMPLATE.md)
(081KR50HA0008QG0R003G7DR8Z.1). Parallel to `CURSOR.md` (081KR50HA0008QG0R003G7DR8Z.2) and `KIRO.md` (081KSRGFP0008QG0R000EWSMKV).
This is the harness file named directly in the parent title
("AGENTS.md, CODEX.md, CURSOR.md") and the last major harness without a
root six-step pointer tree.

## Why

The bootstrap-template (081KR50HA0008QG0R003G7DR8Z.1) factored the universal six-step
process from the harness-specific tooling cells. `.codex/AGENTS.md`
already carries a rich Codex addendum, but it predates the template
(last touched 2026-05-13) and does not follow the six-step shape — and
`.codex/**` is Codex-owned (routine edits should come from a Codex
session). The cross-harness-discoverable root `CODEX.md` achieves the
template-conforming Codex bootstrap **without crossing the Codex
ownership boundary**: it is a thin six-step pointer tree at repo root
that points *into* `.codex/AGENTS.md` for the deep host-loop mechanics,
composing-with rather than editing-over.

## Acceptance criteria

1. `CODEX.md` created at repo root following the template skeleton. ✓
2. Registered in `AGENTS.md` §"Harness-specific files" (the entry
   already anticipated a root `CODEX.md`). ✓
3. Template "Existing instances" table adds a CODEX.md row and clarifies
   the `.codex/AGENTS.md` row as the Codex-owned deep addendum. ✓
4. Commit trailer for Codex already present in `AGENTS.md`
   §"Commit attribution" (`Co-Authored-By: Codex <noreply@openai.com>`). ✓
5. `.codex/**` untouched (Codex ownership boundary respected). ✓
6. Build gate unaffected (docs-only change). ✓

## Resolution

Landed `CODEX.md` mirroring `CURSOR.md` / `KIRO.md` shape. Codex-specific
cells: addendum + state files `.codex/AGENTS.md` → `.codex/CURRENT-codex.md`;
claim sender `vera-codex` (already a valid `SENDER_IDS` entry) plus the
claim-branch + heartbeat discipline in `docs/AGENT-CLAIM-PROTOCOL.md`;
commit trailer `Co-Authored-By: Codex <noreply@openai.com>` (already in
`AGENTS.md`); `Vera:` speaker prefix; Codex ownership boundary noted
(`.codex/**` stays Vera's lane). Registered in `AGENTS.md` and added to
the `docs/BOOTSTRAP-TEMPLATE.md` "Existing instances" table.

Process-ifying `.codex/AGENTS.md` itself into the six-step shape is a
Codex-lane follow-up (Vera), deliberately not done here to respect the
ownership boundary. Fresh-instance validation (template step 5, per the
081KR50HA0008QG0R001CNS20T pattern) is also a separate follow-up; only the
template-instantiation slice is closed here.

## Effort

XS — template instantiation + two registrations, docs-only.

## Lineage

- **081KR50HA0008QG0R003G7DR8Z** — parent (cross-harness bootstrap template); title names
  AGENTS.md, CODEX.md, CURSOR.md — this closes the CODEX.md member.
- **081KR50HA0008QG0R003G7DR8Z.1** — the template (`docs/BOOTSTRAP-TEMPLATE.md`).
- **081KR50HA0008QG0R003G7DR8Z.2** — `CURSOR.md` (sibling precedent).
- **081KSRGFP0008QG0R000EWSMKV** — `KIRO.md` (sibling precedent).
