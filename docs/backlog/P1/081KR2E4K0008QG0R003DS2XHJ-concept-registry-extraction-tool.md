---
id: 081KR2E4K0008QG0R003DS2XHJ
priority: P1
status: closed
title: "Concept-registry extraction tool — canonical inventory of load-bearing concepts"
tier: substrate-quality
effort: S
parent: 081KQ8P5D0008QG0R000N718AC
created: 2026-05-08
last_updated: 2026-05-09
depends_on: []
composes_with: [081KQ8P5D0008QG0R000N718AC, 081KR2E4K0008QG0R001ZWARTN]
tags: [substrate-quality, tooling, concept-registry, human-lineage]
type: friction-reducer
---

# Concept-registry extraction tool

Build `tools/alignment/concept_registry.ts` — extracts the
canonical list of load-bearing concept IDs from their source
surfaces into a single JSON registry. The registry is the
machine-readable input to all downstream coverage-gap and
anchoring work under 081KQ8P5D0008QG0R000N718AC.

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
      "conceptClass": "alignment-clause",
      "source": "docs/ALIGNMENT.md",
      "label": "...",
      "anchor": "Pearl-2009"
    }
  ],
  "summary": {
    "alignment-clause": 7
  }
}
```

> `anchor` is optional (081KR50HA0008QG0R001G4QHQF). When present it records the human-lineage anchor for the concept (e.g. a Pearl citation). Omit for concepts with no declared anchor.

## Done-criteria

- [ ] `bun tools/alignment/concept_registry.ts` runs and
      emits JSON to stdout.
- [ ] All 4 concept classes extracted with correct counts.
- [ ] Tests in `concept_registry.test.ts` cover extraction
      for each class.
- [ ] Build gate passes (`dotnet build -c Release` — 0W 0E).

## Reviewers

- `spec-zealot` — registry schema correctness.
