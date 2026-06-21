---
id: 081KR2E4K0008QG0R0028VW6B3
priority: P2
status: open
title: "Interloop messaging — implementation on chosen transport"
created: 2026-05-08
parent: 081KQZVQW0008QG0R000W4B8KT
depends_on: [081KR2E4K0008QG0R000JW0DZB]
classification: blocked-on-081KR2E4K0008QG0R000JW0DZB
decomposition: atomic
type: feature
---

# 081KR2E4K0008QG0R0028VW6B3 — Interloop messaging implementation

Implement the protocol from 081KR2E4K0008QG0R000JW0DZB on the chosen transport
(GitHub PR comments, dedicated file channel, or Orleans grains).

## Acceptance criteria

- Working send/receive between at least 2 agents
- Message delivery verified in test
- Integrated into tick scripts
