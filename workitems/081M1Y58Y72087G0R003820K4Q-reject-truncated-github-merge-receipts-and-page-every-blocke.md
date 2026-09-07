---
id: 081M1Y58Y72087G0R003820K4Q
type: bug
state: backlog
priority: P2
slug: reject-truncated-github-merge-receipts-and-page-every-blocke
title: "Reject truncated GitHub merge receipts and page every blocker"
created: 2026-09-07T14:45:05.890Z
depends_on: []
composes_with: []
---

# Reject truncated GitHub merge receipts and page every blocker

The GitHub merge observer reads only the first 100 check contexts and review
threads and cannot detect continuation. Its receipt reaches the running
observe loop's merge authorization. A deterministic tail-thread or tail-check
fixture changes a locally permitted merge to refusal; the live 171-context
PR #16928 independently demonstrates the truncation without an unsafe merge.

Acceptance:

- Read every bounded check and review-thread page with explicit total counts,
  advancing unique cursors and unique node identities.
- Refuse incomplete, malformed, conflicting or changed-head evidence instead
  of producing an actionable partial receipt.
- Bind the PR head and observed commit consistently across all pages.
- Preserve current required-versus-optional classification; this is a receipt
  completeness correction, not a merge-policy amendment.
- Exercise actual observer and authorization consumers with paginated fixtures,
  retain the live witness and pass focused TS/static/preflight gates.
