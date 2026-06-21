---
id: 081KRFA460008QG0R0035NKRHG
priority: P1
class: substrate-architecture
status: closed
closed: 2026-05-13
closed_by: "memory-index-integrity.yml replaced paired-edit gate with frontmatter-completeness gate"
title: Relax memory-index-integrity.yml CI check — heap-state-acceptable
created: 2026-05-13
last_updated: 2026-05-13
parent: 081KRCQQF0008QG0R0037YYP1A
depends_on: [081KRFA460008QG0R0006Q6BWP, 081KRFA460008QG0R0034C2W0E]
composes_with: [081KRCQQF0008QG0R0037YYP1A, 081KRFA460008QG0R000YPS21H, 081KRFA460008QG0R0034C2W0E, 081KQ8P5D0008QG0R002FSTGXP, 081KRA5AR0008QG0R0036JP9KM]
effort: S
tier: factory-tooling
authors: [otto]
---

# 081KRFA460008QG0R0035NKRHG — Relax memory-index-integrity.yml CI check

## Carved sentence

> `.github/workflows/memory-index-integrity.yml` enforces synchronous
> MEMORY.md paired edits on every memory file change. This IS the
> serialization point. Replace the strict paired-edit gate with a
> frontmatter-completeness gate: new memory files must have valid
> frontmatter; they do NOT need a same-PR MEMORY.md update.

## Context

`memory-index-integrity.yml` currently exits 1 when a `memory/*.md`
file is added or modified without a MEMORY.md paired edit in the same
PR. This enforces the serialization point that 081KRCQQF0008QG0R0037YYP1A is removing.

The new contract after 081KRCQQF0008QG0R0037YYP1A lands:

- **Required:** New memory files have valid frontmatter (`name:`,
  `description:`, `type:`, `created:` fields).
- **Not required:** Synchronous MEMORY.md paired edit.
- **Instead:** MEMORY.md is kept current by `tools/memory/reindex-memory-md.ts`
  running on the autonomous-loop tick cadence (081KRFA460008QG0R0034C2W0E).

**Dependency:** This slice must NOT land before 081KRFA460008QG0R0034C2W0E (loop wiring).
Removing the CI gate without automatic reindexing leaves MEMORY.md
permanently stale. 081KRFA460008QG0R0034C2W0E is the operational prerequisite.

**Relationship to 081KQ8P5D0008QG0R002FSTGXP:** 081KQ8P5D0008QG0R002FSTGXP and its children (081KRA5AR0008QG0R000GZ8ECC,
081KRA5AR0008QG0R0036JP9KM, 081KRA5AR0008QG0R002WVSEGW) asked whether to promote the paired-edit check
to required status or weaken it. 081KRCQQF0008QG0R0037YYP1A answers this definitively:
the synchronous paired-edit architecture is wrong; this slice replaces
it with frontmatter validation. 081KRA5AR0008QG0R0036JP9KM's "Option B (weaken)" is
effectively implemented here, with a stronger architectural rationale.
Mark 081KQ8P5D0008QG0R002FSTGXP and children as superseded by 081KRFA460008QG0R0035NKRHG in the commit.

## Acceptance criteria

### CI workflow changes (`memory-index-integrity.yml`)

Replace the current logic with a two-gate check:

**Gate 1 — Frontmatter completeness (new enforcement):**

For each added or modified `memory/*.md` file (excluding MEMORY.md,
README.md, CURRENT-*.md, INDEX-*.md, persona/*):

- Parse frontmatter block (`---` to `---`)
- Assert presence of: `name:`, `description:`, `type:`, `created:`
- Exit 1 with a clear message if any required field is missing

This ensures the reindexer can process every memory file it finds.

**Gate 2 — Paired-edit check (REMOVED / changed to informational):**

- Remove the `exit 1` when MEMORY.md is NOT updated alongside memory
  changes.
- Replace with an informational `echo` that MEMORY.md will be updated
  on the next autonomous-loop reindex cadence.
- Do NOT fail on missing MEMORY.md update.

### Workflow name and job name

- Keep workflow name: `memory-index-integrity`
- Rename job: `check memory file frontmatter completeness`
  (from `check memory/MEMORY.md paired edit`)

### Update the error message

The existing message cites the NSA-001 incident (discoverability).
Update to:

```
Memory file <filename> is missing required frontmatter field(s): <list>.
Required fields: name, description, type, created.
The reindexer (tools/memory/reindex-memory-md.ts) requires these
fields to index the file into MEMORY.md on cadence. Fix the
frontmatter before merging.
See 081KRCQQF0008QG0R0037YYP1A: docs/backlog/P1/081KRCQQF0008QG0R0037YYP1A-memory-md-serialization-point-2026-05-12.md
```

### Mark 081KQ8P5D0008QG0R002FSTGXP chain as superseded

In the same PR, add to 081KQ8P5D0008QG0R002FSTGXP:
```
superseded_by: 081KRFA460008QG0R0035NKRHG
resolved: 2026-05-13
```

And add a note to 081KRA5AR0008QG0R0036JP9KM:
```
resolved_by: 081KRFA460008QG0R0035NKRHG (Option B implemented via heap architecture, stronger fix)
```

## Why P1 (not P0)

This is the core architectural change. However, the serialization
point's friction is manageable until 081KRFA460008QG0R0034C2W0E (loop wiring) lands.
P0 would be appropriate if the serialization point were causing
factory-blocking failures; currently it produces rebase grind (P1).

Ordering constraint: this row MUST land after 081KRFA460008QG0R0034C2W0E in the merge
sequence. The PR for this slice should include a `depends_on:
[081KRFA460008QG0R0006Q6BWP, 081KRFA460008QG0R0034C2W0E]` check — only merge after those PRs are green
on main.

## Implementation notes

The workflow is a bash script under `run:`. The frontmatter parser
must scope validation to the YAML block only (the first `--- … ---`
delimited section) — scanning the whole file produces false negatives
when required keys appear in the markdown body but not in frontmatter.
Use `awk` to extract the block before grepping:

```bash
for f in $trigger_files; do
  # Extract lines between the first pair of --- delimiters only.
  frontmatter=$(awk '/^---$/{if (++n==2) exit; next} n==1' "$f")
  for field in name description type created; do
    if ! echo "$frontmatter" | grep -qE "^$field:"; then
      echo "MISSING: $field in $f"
      missing_fields=true
    fi
  done
done
if $missing_fields; then exit 1; fi
```

This keeps the workflow fast and avoids adding the bun install step.

## Composes with

- 081KRCQQF0008QG0R0037YYP1A (parent; this is slice 4 of 5)
- 081KRFA460008QG0R0006Q6BWP (test coverage must exist before this lands)
- 081KRFA460008QG0R000YPS21H (documentation should describe the new contract)
- 081KRFA460008QG0R0034C2W0E (loop wiring MUST land before this slice)
- 081KQ8P5D0008QG0R002FSTGXP (superseded by this slice)
- 081KRA5AR0008QG0R0036JP9KM (Option B is this slice's implementation)
