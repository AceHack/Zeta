---
id: B-0311
priority: P1
status: open
title: "External-anchor coverage scanner — per-concept anchor presence/absence audit"
tier: substrate-quality
effort: S
parent: B-0060
created: 2026-05-08
last_updated: 2026-05-08
depends_on: [B-0310]
composes_with: [B-0060, B-0310, B-0312, B-0313, B-0314, B-0315, B-0316]
tags: [substrate-quality, tooling, external-anchors, human-lineage, beacon-safety]
type: friction-reducer
---

# External-anchor coverage scanner

Build `tools/alignment/audit_external_anchors.ts` — given
the concept registry from B-0310, scans the substrate surface
where each concept lives and extracts existing external anchor
URLs (papers, RFCs, blog posts, Stack Overflow / Stack Exchange
threads, conference talks). Produces a coverage report mapping
each concept to its external anchors or an "anchor-pending"
marker.

## How it works

1. Load the concept registry (from B-0310 tool output or
   inline extraction).
2. For each concept, locate its definition section in the
   source surface.
3. Extract external URLs (http/https) from that section.
4. Classify each URL: paper / RFC / blog / SO-SE / talk /
   other.
5. Emit per-concept coverage: `anchored` (with URL list) or
   `anchor-pending`.

## Existing infrastructure

- `citations.ts` already detects external URLs via
  `EXTERNAL_RE` and counts them. Extend with per-concept
  granularity.
- `audit_clause_coverage.ts` already locates clause
  references per surface. Extend to locate the clause
  definition sections.

## Output schema

```json
{
  "schema": "external-anchor-coverage-v1",
  "totalConcepts": 72,
  "anchored": 15,
  "pending": 57,
  "concepts": [
    {
      "id": "HC-1",
      "class": "alignment-clause",
      "status": "anchored",
      "anchors": [
        { "url": "https://...", "kind": "paper", "title": "..." }
      ]
    },
    {
      "id": "BP-3",
      "class": "best-practice",
      "status": "anchor-pending",
      "anchors": []
    }
  ]
}
```

## Done-criteria

- [ ] `bun tools/alignment/audit_external_anchors.ts` emits
      JSON coverage report.
- [ ] `--md` flag emits markdown coverage table.
- [ ] Tests cover anchored and anchor-pending classification.
- [ ] Build gate passes.

## Reviewers

- `spec-zealot` — schema correctness.
- `alignment-auditor` — HC/SD/DIR coverage signal.
