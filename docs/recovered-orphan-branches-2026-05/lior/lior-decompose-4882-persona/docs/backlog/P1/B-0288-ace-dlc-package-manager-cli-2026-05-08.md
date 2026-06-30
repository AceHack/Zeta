---
id: B-0288
priority: P1
status: open
title: "Ace DLC — package manager CLI (install/verify/list)"
created: 2026-05-08
last_updated: 2026-05-08
parent: B-0247
depends_on: [B-0287]
classification: blocked-on-B-0287
decomposition: atomic
owners: [architect, public-api-designer]
type: feature
---

# B-0288 — DLC package manager CLI

TS CLI tool: `ace install <pkg>`, `ace verify <pkg>`, `ace list`.
Content-addressed, signed packages with guardian AI oversight.

## Acceptance criteria

- CLI at tools/ace/ with install, verify, list commands
- Content-addressed storage (hash-based)
- Signature verification on install
