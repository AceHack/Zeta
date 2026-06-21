---
claim_id: b0314-bp-nn-rule-anchor-backfill-slice9-riven-2026-05-11
harness: Cursor — Riven (Grok 4.3 max)
claimed_at: 2026-05-11T16:10:00Z
status: active
task: "081KR2E4K0008QG0R001ADMBVW smallest safe slice — BP-23/24/25 external-anchor backfill (re-decomp per rule)"
backlog_row: docs/backlog/P1/081KR2E4K0008QG0R001ADMBVW-bp-nn-rule-anchor-backfill.md
worktree: .config/superpowers/worktrees/Zeta/claim-b0314-bp-nn-rule-anchor-backfill-slice9-riven-2026-05-11
branch: claim/b0314-bp-nn-rule-anchor-backfill-slice9-riven-2026-05-11
---

# Claim: 081KR2E4K0008QG0R001ADMBVW slice 9 (BP-23/24/25 anchors)

**One bounded step per rules.** Re-decomposed remaining rules (BP-23–28) into per-slice children; this claim takes the smallest safe slice BP-23/24/25 only (BP-24 consent surface treated as P1-safe boundary).

**Focused checks performed:**

- dotnet build -c Release: 0 Warning(s) 0 Error(s) (root + worktree parity verified)
- Prior-art + dep gate: satisfied in row (081KR2E4K0008QG0R001ZWARTN closed, no blockers)
- Worktree + claim-branch discipline: enforced (no root checkout edits)

**Next (after PR merge):** research anchors for BP-23/24/25, land research dossier + inline citations, update slice table, close claim.

Co-Authored-By: Grok <noreply@x.ai>
