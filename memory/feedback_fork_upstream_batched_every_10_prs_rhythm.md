---
name: Fork → upstream batched rhythm — "upstream every ~10 PRs", not per-PR
description: Aaron 2026-04-21 "we only need to upstram back to lfg like every 10prs" — the fork (AceHack/Zeta) is a full staging environment; development PRs happen there; consolidated upstream PRs to Lucent-Financial-Group/Zeta land every ~10 fork PRs worth of accumulated change. Reduces per-push Copilot cost on LFG by ~10x.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Aaron 2026-04-21, in the thread that set up the fork-PR workflow
after the AceHack/Zeta → Lucent-Financial-Group/Zeta transfer:
*"we only need to upstram back to lfg like every 10prs"*.

**Why:** Every push to LFG/Zeta fires Copilot code review (per the
`Default` ruleset `copilot_code_review.review_on_push: true`), which
bills against LFG's budget-capped Copilot seat. Batching ~10 PRs worth
of fork-side development into a single upstream PR reduces per-push
Copilot cost on LFG by roughly 10x while still delivering the same
net change.

**Scope:** Zeta-specific overlay, NOT a factory-portable default.
The standard fork-PR pattern (industry norm) is one upstream PR per
change; Aaron explicitly flagged that. The Zeta batching is driven
by LFG's Copilot-review-per-push billing and budget cap, plus the
fact that Zeta is single-maintainer pre-v1 so consumer promptness
is not a constraint.

**How to apply:**
- **Fork is the staging environment.** Treat AceHack/Zeta as a
  complete development surface: branch-per-PR, CI gate runs, PRs
  merged on the fork's own `main`. Full matrix (Linux + macOS per
  task #191) runs on the fork for parity validation.
- **Upstream is the release surface.** Every ~10 fork PRs worth of
  accumulated change, open one consolidated PR
  `AceHack:main → Lucent-Financial-Group:main`. This PR is large
  (by design), batch-reviewed, and land-with-squash to carry ~10 fork
  commits into LFG as one squash commit.
- **Rhythm, not rule.** "Every 10 PRs" is rate-of-thumb, not a hard
  gate. Shorter batches if a security fix needs to land on LFG
  promptly; longer if no consumer of LFG is actively pulling.
- **Fork's main stays in sync with LFG's main** via a pre-upstream
  rebase: `git fetch upstream && git rebase upstream/main` on the
  fork-side branch before opening the upstream PR. No other
  upstream-pull work is needed on the fork.
- **Fork-PR skill (.claude/skills/fork-pr-workflow/) describes
  the STANDARD 1-PR-per-change flow as primary**, and mentions
  batched-upstream only as an explicit opt-in overlay for
  cost-constrained projects. The skill stays factory-portable
  (no `project: zeta` frontmatter).
- **Zeta-specific config lives in `docs/GITHUB-SETTINGS.md` or
  a dedicated `docs/UPSTREAM-RHYTHM.md`**, not in the skill. The
  skill cites the project doc for "projects may override the
  default rhythm" without hardcoding Zeta's choice.

Supersedes the implicit "every fork PR = one upstream PR" pattern
in the original fork-pr-workflow skill draft. Does not supersede
the broader fork-PR setup mechanics (three-remote convention,
`gh pr create --repo <upstream>` flag, `--force-with-lease`
discipline).
