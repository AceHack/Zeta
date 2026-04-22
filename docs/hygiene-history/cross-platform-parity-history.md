# Cross-platform parity audit — fire history

Per-fire ledger for FACTORY-HYGIENE row #48 (cross-platform
parity audit). Schema per row #44 (date / agent / output /
link / next-expected).

Authoritative audit: `tools/hygiene/audit-cross-platform-parity.sh`.

| Date | Agent | Output | Link | Next expected |
|---|---|---|---|---|
| 2026-04-22 | Claude (during round 44 autonomous-loop tick) | First fire. 13 gaps — 12 pre-setup bash under `tools/setup/` missing `.ps1` twin (Q1 violation); 1 post-setup permanent-bash (`tools/profile.sh`) missing `.ps1` twin. 10 transitional (no twin obligation). 0 paired. | Triage queued: `docs/BACKLOG.md` P1 "Cross-platform parity triage — 13 baseline gaps". Audit source: `tools/hygiene/audit-cross-platform-parity.sh`. | Round 45 opportunistic-on-touch when any `tools/` script is edited; next scheduled cadenced run round 49-54 (5-10 round cadence). |
