# Repo-Transfer Fire History

Append-only log of GitHub repository transfers this factory
has executed. Every row is one transfer event. The
authoritative procedure is
[`.claude/skills/github-repo-transfer/SKILL.md`](../../.claude/skills/github-repo-transfer/SKILL.md);
this file is the **fire-history surface** (FACTORY-HYGIENE
row #44 compliance — every cadenced or infrequent procedure
records its firings so cadence and behaviour are
verifiable).

## Schema

Each row contains:

- **Date (UTC).** YYYY-MM-DD of the `POST .../transfer`
  call.
- **Agent.** Which persona / wake / session executed the
  transfer. If human-executed, write `human: <name>`.
- **Old.** `<old-owner>/<name>` before transfer.
- **New.** `<new-owner>/<name>` after transfer.
- **Drifts caught.** Short comma-separated list of silent
  drifts detected by the step-6 scorecard diff. `none`
  is a valid and notable entry.
- **Drifts fixed.** Short note on remediation for each
  caught drift (`re-enabled`, `ruleset-off`, etc.).
- **Cross-cutting follow-ups.** Short list of in-repo /
  external-link heals that landed as step-8 work
  (`remote-url`, `readme-badges`, `pages-url`,
  `codeql-rule`, ...).
- **PR.** Link to the resolving PR (usually where the
  scorecard + drift-detector landed alongside the
  transfer).
- **ADR / HB.** Link to the decision artefact
  (`docs/HUMAN-BACKLOG.md#hb-NNN` or `docs/DECISIONS/...`).

## Why we keep this log

- **Cartographer / offline-readable cache.** A future
  agent (local or online) reading this file knows what
  transfers happened, what drifted, what healed — without
  re-querying `gh api` or reading session transcripts.
  Same pattern as
  `memory/project_local_agent_offline_capable_factory_cartographer_maps_as_skills.md`.
- **Gotcha accretion.** Each row's "drifts caught" column
  feeds the known-gotcha list in the skill. Patterns that
  repeat across transfers get promoted from "observed once"
  to "first-class procedure step".
- **Velocity honesty.** Transfers are infrequent,
  high-blast-radius operations. Logging them closes the
  cadence triangle (FACTORY-HYGIENE #23 existence, #43
  activation, #44 history).

## Rows

| Date | Agent | Old | New | Drifts caught | Drifts fixed | Cross-cutting follow-ups | PR | ADR / HB |
|---|---|---|---|---|---|---|---|---|
| 2026-04-21 | architect (kenji), retrospectively logged 2026-04-22 | `AceHack/Zeta` | `Lucent-Financial-Group/Zeta` | `secret_scanning=disabled`, `secret_scanning_push_protection=disabled` (both silently flipped by org-transfer code path) | re-enabled via `PATCH /repos/.../security_and_analysis` same session | `remote-url` (`git remote set-url origin`), `readme-badges` + `doc-urls` (commit `d96fe95`), `pages-url` (`acehack.github.io/Zeta/` → `lucent-financial-group.github.io/Zeta/`), `codeql-rule-off` (Gotcha 3), `merge-queue-unlocked` (Gotcha 2 — not enabled same session, parked) | [PR #45](https://github.com/Lucent-Financial-Group/Zeta/pull/45) (`f92f1d4`) | `HB-001` (resolved) |

## Retrospective — the 2026-04-21 row, unpacked

This row is the seed entry. It was written 2026-04-22 from
git history + artifacts + memory, not as live-ops logging.
Three lessons drove the creation of this file + the
`github-repo-transfer` skill:

1. **The scorecard caught what humans would have missed.**
   `secret_scanning` flipping `enabled → disabled` during
   transfer is not in GitHub's transfer-docs "what
   changes" list as of 2026-04-22. Without the declarative
   JSON diff, we'd have shipped the transfer and not
   noticed the security toggle was off.
2. **The platform gotchas cluster around transfers.**
   Merge queue (org-only) and CodeQL ruleset
   (default-setup-bound) both surfaced **because** of the
   transfer — one as an unlock, one as a break. Future
   transfers should expect the same pattern: the new
   surface exposes both capabilities and rules the old
   surface didn't enforce.
3. **Cross-cutting heal is not one step.** Git remote,
   README badges, doc URLs, Pages URL, CodeQL ruleset,
   merge-queue readiness — each a separate follow-up,
   each needs verification. The skill enumerates them so
   a future transfer doesn't re-discover the list.

Subsequent transfers append rows; this retrospective row
stays as the canonical first entry.

## Cadence

- **On-event.** Every transfer appends a row the same
  session.
- **Retrospective seed** (one-time). The 2026-04-21 row
  was logged 2026-04-22 when this file was created.
  Future retrospective logging is not expected — we log
  in real time from now on.
- **Round-close audit.** During round-close, if any
  transfer happened this round and no row exists, that's
  a hygiene failure — file immediately.

## Related

- [`.claude/skills/github-repo-transfer/SKILL.md`](../../.claude/skills/github-repo-transfer/SKILL.md)
  — the executable routine.
- [`docs/GITHUB-SETTINGS.md`](../GITHUB-SETTINGS.md) —
  declarative scorecard backing step 2 and step 6.
- [`docs/AGENT-GITHUB-SURFACES.md`](../AGENT-GITHUB-SURFACES.md)
  — the ten-surface playbook informing step 3 and step 8.
- [`docs/FACTORY-HYGIENE.md`](../FACTORY-HYGIENE.md) —
  row #44 (fire-history for every cadenced surface).
