---
id: 081KDVJZK7008QG0R001QH4W62
priority: P2
status: open
title: TS lucky-guess + unsolicited-inference firewall protocol
tier: factory-hygiene
effort: S
depends_on:
  - 081KDVJZK7008QG0R0023FS41G
composes_with:
  - 081KQ8P5D0008QG0R003MY8246
tags: [riven-2026-05-11, ts-prefer, lucky-guess, inference-firewall, compliance]
---
# 081KDVJZK7008QG0R001QH4W62 — Atomic child: TS lucky-guess + unsolicited-inference firewall

Smallest slice of 081KQ8P5D0008QG0R003MY8246 enhancements #3+#4: implement `tools/alignment/audit-inference-firewall.ts` that scans for patterns ("should I buy/sell", "given <employer>, <ticker> may...", internal-roadmap inference) and enforces the standardized Aaron response + agent rule (no ask, no treat silence as confirm). Outputs violation report or clean.

Depends on scanner surface (081KDVJZK7008QG0R0023FS41G). S effort, TS only.

Focused check: `bun run ... --scan memory/ docs/` reports 0 violations on existing, lint 0 errors.

Unblocks lattice + bead children.
