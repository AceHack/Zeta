---
id: B-0310
priority: P1
status: open
title: "Concept-registry extraction tool — canonical inventory of load-bearing concepts"
tier: substrate-quality
effort: S
parent: B-0060
created: 2026-05-08
last_updated: 2026-05-08
depends_on: []
composes_with: [B-0060, B-0311]
tags: [substrate-quality, tooling, concept-registry, human-lineage]
type: friction-reducer
---

# Concept-registry extraction tool

Build `tools/alignment/concept_registry.ts` — extracts the
canonical list of load-bearing concept IDs from their source
surfaces into a single JSON registry. The registry is the
machine-readable input to all downstream coverage-gap and
anchoring work under B-0060.

## Concept classes to extract

| Class | Source surface | Example IDs |
| --- | --- | --- |
| Alignment clauses | `docs/ALIGNMENT.md` | HC-1..HC-7, SD-1..SD-9, DIR-1..DIR-5 |
| Best-practice rules | `docs/AGENT-BEST-PRACTICES.md` | BP-1..BP-25 |
| Otto-NN principles | `CLAUDE.md`, `memory/feedback_*.md` | Otto-247, Otto-275, Otto-357 |
| Glass-Halo doctrines | `AGENTS.md`, `docs/ALIGNMENT.md` | radical-honesty, total-observability |

## Existing infrastructure

- `audit_clause_coverage.ts` already extracts HC/SD/DIR IDs
  via regex. Reuse the `extractClauses` pattern.
- `citations.ts` scans 5 directory trees. Reuse the
  `scanFiles` / `listMarkdownRecursive` pattern.

## Output schema

```json
{
  "schema": "concept-registry-v1",
  "generated": "2026-05-08T00:00:00Z",
  "concepts": [
    {
      "id": "HC-1",
      "class": "alignment-clause",
      "source": "docs/ALIGNMENT.md",
      "label": "..."
    }
  ]
}
```

## Done-criteria

- [ ] `bun tools/alignment/concept_registry.ts` runs and
      emits JSON to stdout.
- [ ] All 4 concept classes extracted with correct counts.
- [ ] Tests in `concept_registry.test.ts` cover extraction
      for each class.
- [ ] Build gate passes (`dotnet build -c Release` — 0W 0E).

## Reviewers

- `spec-zealot` — registry schema correctness.
