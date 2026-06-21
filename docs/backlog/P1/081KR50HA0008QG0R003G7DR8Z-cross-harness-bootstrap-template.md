---
id: 081KR50HA0008QG0R003G7DR8Z
priority: P1
status: closed
title: "Cross-harness bootstrap template (AGENTS.md, CODEX.md, CURSOR.md)"
created: 2026-05-09
last_updated: 2026-05-29
depends_on:
  - 081KR50HA0008QG0R001CNS20T
decomposition: atomic
classification: blocked
type: friction-reducer
owners: [architect]
parent: 081KR2E4K0008QG0R001F0YB5S
---

# 081KR50HA0008QG0R003G7DR8Z — Cross-harness bootstrap template

## What

Create a bootstrap-process template that other AI harnesses
can follow. The pattern from 081KR50HA0008QG0R001DBKS6T (CLAUDE.md as process)
generalizes to:

- **AGENTS.md** — universal onboarding (already exists,
  may need process-ification)
- **CODEX.md** — OpenAI Codex / GPT harness bootstrap
- **CURSOR.md** — Cursor IDE harness bootstrap
- **KIRO.md** — Amazon Kiro harness bootstrap (per 081KR2E4K0008QG0R0005E727X)

Each harness file follows the same orient → refresh → pick →
build → ship process but with harness-specific tooling
references (e.g., Cursor uses different skill-loading
mechanisms than Claude Code).

## Why

The process-as-bootstrap pattern transfers across harnesses.
A Codex instance and a Claude instance running the same process
produce equivalent behavior — the rules emerge from the walk,
not from memorizing harness-specific doctrine.

## Acceptance criteria

1. Template document created at `docs/BOOTSTRAP-TEMPLATE.md`
   (or equivalent location).
2. At least one non-CLAUDE harness file updated or created following
   the template — use `.codex/AGENTS.md` for the Codex harness (the
   active Codex bootstrap location per `AGENTS.md`), `CURSOR.md` for
   Cursor, etc.
3. Template documents which steps are universal vs
   harness-specific.
4. Build gate passes.

## Effort

S — template + one instance, ~2 hours.

## Resolution (2026-05-29 — completed via children + direct landings)

Closed as **completed**. All four acceptance criteria are satisfied
by substrate already on `main`; the parent row had drifted `open`
while the work landed through child rows and direct commits:

1. **Template document** — [`docs/BOOTSTRAP-TEMPLATE.md`](../../BOOTSTRAP-TEMPLATE.md)
   exists with the six-step skeleton, the non-negotiable invariant,
   the "Existing instances" registry, and the "How to add a new
   harness" procedure. ✓
2. **≥1 non-CLAUDE harness file** — multiple landed:
   [`CODEX.md`](../../../CODEX.md) (081KSRGFP0008QG0R000G8VJGV, #6045, closed),
   [`CURSOR.md`](../../../CURSOR.md) (081KR50HA0008QG0R003G7DR8Z.2, #6042),
   [`KIRO.md`](../../../KIRO.md) (081KSRGFP0008QG0R000EWSMKV, #6043, closed),
   [`GEMINI.md`](../../../GEMINI.md) (081KRMEXM0008QG0R002347RJY), plus
   `.codex/AGENTS.md` and `.github/copilot-instructions.md`. ✓
3. **Universal vs harness-specific documented** — `docs/BOOTSTRAP-TEMPLATE.md`
   §"Universal vs harness-specific" carries the per-step table
   (universal column + harness-specific fill-in column). ✓
4. **Build gate** — this close-out is docs-only (backlog-row + index
   regeneration); no `.cs`/`.fs`/`.fsproj` touched, so the Release
   build + test surface is unaffected. The harness-file landings
   that satisfied criteria 1–3 each passed CI on their own PRs
   (#6042/#6043/#6045). ✓

### Child / sibling rows

- **081KR50HA0008QG0R003G7DR8Z.2** — CURSOR.md (merged #6042)
- **081KSRGFP0008QG0R000EWSMKV** — KIRO.md (closed, #6043)
- **081KSRGFP0008QG0R000G8VJGV** — CODEX.md (closed, #6045)

### Dependency + still-open sibling

The named blocker `depends_on: 081KR50HA0008QG0R001CNS20T` ("Fresh-instance validation
test for bootstrap CLAUDE.md") is itself **closed** — the dependency
is satisfied.

The still-open row in the cluster is **081KSRGFP0008QG0R003K4M5NM** ("Clean-prompt
live-model fresh-instance run for bootstrap CLAUDE.md"). That is the
**cluster-wide fresh-instance validation** — step 5 of the template's
"How to add a new harness" procedure — not part of 081KR50HA0008QG0R003G7DR8Z's own
acceptance criteria (template + ≥1 harness file + universal/
harness-specific doc + build), all of which are met independently.
081KSRGFP0008QG0R003K4M5NM stays open to track that validation work for the broader
bootstrap cluster (parent 081KR2E4K0008QG0R001F0YB5S); it does not block closing 081KR50HA0008QG0R003G7DR8Z.
