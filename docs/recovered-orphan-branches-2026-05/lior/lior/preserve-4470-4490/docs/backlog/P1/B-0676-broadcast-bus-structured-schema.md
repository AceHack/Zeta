---
id: B-0676
priority: P1
status: open
title: "Broadcast bus structured JSON schema — machine-parseable loops"
created: 2026-05-21
last_updated: 2026-05-21
decomposition: atomic
depends_on: [B-0210]
type: feature
---

# B-0676 — Broadcast bus structured JSON schema

Decomposed slice 1 from [B-0213](./B-0213-broadcast-bus-production-hardening-schema-ttl-receipts-2026-05-06.md).

The broadcast bus at `~/.local/share/zeta-broadcasts/` currently uses unstructured markdown files. This item introduces a **structured JSON schema** (e.g. `broadcast.schema.json` or `.yaml`) and tooling to ensure broadcasts are machine-parseable by background loops.

## Requirements

1. Define a strict schema for broadcast messages.
2. Provide a TypeScript interface and validator/parser (using Zod or TypeBox) in `src/`.
3. Update the existing broadcast bus v0 to write the structured JSON block alongside markdown (or as a structured frontmatter header).
4. Unconditional enforcement — isolation via Docker infrastructure, not feature flags (Aaron 2026-05-06).