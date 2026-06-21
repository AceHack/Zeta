---
id: 081KR2E4K0008QG0R001ZWARTN
priority: P1
status: closed
title: "External-anchor coverage scanner — per-concept anchor presence/absence audit"
tier: substrate-quality
effort: S
parent: 081KQ8P5D0008QG0R000N718AC
created: 2026-05-08
last_updated: 2026-05-09
depends_on: [081KR2E4K0008QG0R003DS2XHJ]
composes_with: [081KQ8P5D0008QG0R000N718AC, 081KR2E4K0008QG0R003DS2XHJ, 081KR2E4K0008QG0R0009QXZ77, 081KR2E4K0008QG0R00289GE8Z, 081KR2E4K0008QG0R001ADMBVW, 081KR2E4K0008QG0R000R3ZVGD, 081KR2E4K0008QG0R0032TWN5H]
tags: [substrate-quality, tooling, external-anchors, human-lineage, beacon-safety]
type: friction-reducer
---

# External-anchor coverage scanner

Build `tools/alignment/audit_external_anchors.ts` — given
the concept registry from 081KR2E4K0008QG0R003DS2XHJ, scans the substrate surface
where each concept lives and extracts existing external anchor
URLs (papers, RFCs, blog posts, Stack Overflow / Stack Exchange
threads, conference talks). Produces a coverage report mapping
each concept to its external anchors or an "anchor-pending"
marker.

## How it works

1. Load the concept registry (from 081KR2E4K0008QG0R003DS2XHJ tool output or
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
