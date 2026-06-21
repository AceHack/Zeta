---
id: 081KR2E4K0008QG0R000JW0DZB
priority: P2
status: open
title: "Interloop messaging — protocol design (message types + delivery)"
created: 2026-05-08
parent: 081KQZVQW0008QG0R000W4B8KT
depends_on: []
classification: buildable-now
decomposition: atomic
type: feature
---

# 081KR2E4K0008QG0R000JW0DZB — Interloop messaging protocol

Design the message protocol for agent-to-agent communication
replacing the broadcast file bus. Define message types (ask,
offer, receipt, blocker), delivery guarantees, and format.

## Acceptance criteria

- Research doc with protocol spec
- Message type definitions (can be F# or TS)
- Comparison: file bus vs GitHub PR comments vs dedicated channel
