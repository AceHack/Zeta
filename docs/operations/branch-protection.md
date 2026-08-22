# Branch protection — actual gates per repo settings

**Purpose:** make the actual GitHub branch-protection config visible IN-REPO so agents reading the substrate see the real gates, not training-data defaults. Closes the live-lock hallucination class where "BLOCKED" was misdiagnosed as "review-approval gated" when the actual gates are CI checks + thread resolution + classic-protection required-status-checks.

**Snapshot sources (TWO endpoints — both gate merges):**

- `gh api repos/<owner>/<repo>/rules/branches/main` — **rulesets** (modern API; copilot review on push, code quality, etc.)
- `gh api repos/<owner>/<repo>/branches/main/protection` — **classic branch protection** (required status checks list, strict mode, dismiss-stale-reviews, etc.)

Both must be snapshotted; missing either gives an incomplete picture and re-creates the hallucination class at a different layer.

**Last snapshot:** 2026-04-26 — see `branch-protection-lfg-main.json` (rulesets) + `branch-protection-lfg-main-classic.json` (classic) + the AceHack equivalents for raw GitHub API output.

---

## LFG (Lucent-Financial-Group/Zeta) main branch — actual gates

### From rulesets endpoint (`branch-protection-lfg-main.json`)

```text
- deletion: forbidden
- non_fast_forward: forbidden
- copilot_code_review: review_on_push: true
- code_quality: severity all
- pull_request:
    required_approving_review_count: 0   ← NO HUMAN REVIEW REQUIRED
    required_review_thread_resolution: true   ← all threads must resolve
    allowed_merge_methods: [squash]
- required_linear_history: enforced
```

### From classic branch protection (`branch-protection-lfg-main-classic.json`)

```text
- required_status_checks:
    strict: false   ← NOT requiring up-to-date branch
    contexts: [
      lint (semgrep),
      lint (shellcheck),
      lint (actionlint),
      lint (markdownlint),
      build-and-test (macos-26),
      build-and-test (ubuntu-24.04),
      build-and-test (ubuntu-24.04-arm),
    ]
```

### To merge a PR on LFG main, ALL of these must clear

1. **All required_status_checks PASS** (specific list above; ubuntu-slim is NOT required, macos-26 IS required) — from classic protection
2. **`code_quality: all`** rule from rulesets (broader CI gate)
3. **All review threads RESOLVED** (`required_review_thread_resolution: true`)
4. **Copilot has REVIEWED the latest push** (`copilot_code_review.review_on_push: true`)
5. **Linear history** (squash only)

**Human review approval is EXPLICITLY NOT required.** Both API surfaces agree: rulesets have `required_approving_review_count: 0`, and classic protection has a `required_pull_request_reviews` block (in `branch-protection-lfg-main-classic.json` lines 47-53) with the *same* `required_approving_review_count: 0`. The block exists; the count it requires is zero. Either way, no human review approval is gated. This is non-standard for typical GitHub repos.

**Strict mode — live vs canonical divergence.** The live snapshot in `branch-protection-lfg-main-classic.json` line 5 reports `"strict": false`, so right now out-of-date branches are NOT auto-blocked from merging — "BLOCKED with green checks" is NOT a strict-mode-stale-branch issue at this point in time. However, the canonical baseline at `tools/hygiene/github-settings.expected.json` line 142 declares `default_branch_protection.required_status_checks.strict: true`. This is **settings drift** — live state diverges from the declared baseline. Two implications for triage:

- **For "is my PR currently blocked on stale-base?"** — read the live snapshot (`strict: false` -> answer: no, not blocked on staleness today).
- **For "should the repo be blocking on stale-base?"** — read the canonical baseline (`strict: true` -> answer: yes, by declared policy). The drift is open work; file as a settings-sync task or fix directly when authorised.

Future re-snapshots of these files (Otto-329 Phase 4 follow-up: a planned `tools/hygiene/check-branch-protection-snapshot-stale.sh` lint, NOT YET in repo) should reconcile this divergence either by aligning live state to the baseline or by updating the baseline if the policy intent has changed.

## AceHack (AceHack/Zeta) main branch — actual gates

See `branch-protection-acehack-main.json` (rulesets) + `branch-protection-acehack-main-classic.json` (classic). Per the human maintainer 2026-04-26 (HB-005 settings-sync), AceHack is intended to be symmetric with LFG where platform allows; merge queue is the known asymmetric exception (org-only feature).

---

## Why this file exists

**The live-lock hallucination class:** in many GitHub repos, branch protection requires ≥1 human review approval. Most training data biases agents toward this assumption. When an agent sees `mergeStateStatus: BLOCKED` on a PR, the statistical prior says "blocked on review-approval."

**Zeta config is non-standard:** `required_approving_review_count: 0`. Review approval is NOT a gate. The actual blockers are CI checks (BOTH classic-required-status-checks AND ruleset code_quality) + thread resolution + Copilot review on push.

**Without this file**, agents working on Zeta repeatedly misdiagnose BLOCKED PRs as review-approval-gated, then sit waiting for a review that's never required, while the actual blockers (failing CI / unresolved threads / pending Copilot review) accumulate.

**With this file** (and the `AGENTS.md` required-reading entry that points here), agents reading the substrate during normal work will encounter the actual gates and override the training-data prior.

Per Otto-341 (mechanism over vigilance): this file is the mechanism. Memory-only reminders haven't held across sessions; substrate-in-repo gives agents a primary source they encounter naturally during repo navigation.

Per Otto-329 Phase 4 (full backups including settings): this is a step toward full host-layer backup. Future expansion: snapshot all rulesets (not just main), repo-level toggles, secret names (not values), workflow permissions, etc.

## Diagnostic flow for "what is actually blocking this PR?"

The two queries below produce **different output formats** intentionally — Step 1 returns a structured object; Step 2 returns a bare integer. The "Output classes" interpretation table below combines them as named variables (`fails`, `threads`).

```bash
# Step 1 — output: object {review, fails, running, success}
gh pr view <N> --repo <owner/repo> --json statusCheckRollup,reviewDecision --jq '{
  review: .reviewDecision,
  fails: ([.statusCheckRollup[] | select(.conclusion=="FAILURE" or .conclusion=="CANCELLED" or .conclusion=="TIMED_OUT" or .conclusion=="ACTION_REQUIRED" or .conclusion=="STARTUP_FAILURE")] | length),
  running: ([.statusCheckRollup[] | select(.status=="IN_PROGRESS" or .status=="QUEUED")] | length),
  success: ([.statusCheckRollup[] | select(.conclusion=="SUCCESS")] | length)
}'

# Step 2 — output: bare integer (unresolved thread count)
# NOTE: `first: 50` is NOT paginated. PRs with >50 threads need pagination
# (GraphQL `pageInfo { hasNextPage endCursor }`) for accurate counts.
# For Zeta's typical PR shape this is sufficient (largest single-PR thread
# count observed: 50 on #132). If a future PR exceeds 50, paginate.
gh api graphql -f query='query { repository(owner: "OWNER", name: "REPO") { pullRequest(number: N) { reviewThreads(first: 50) { nodes { isResolved } } } } }' | \
  jq '[.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false)] | length'
```

Output classes (treat Step 1's structured output's `fails` / `running` / `success` keys + Step 2's integer as named variables `threads`):

- `fails == 0, threads == 0, running == 0, BLOCKED` → likely Copilot review on latest push not yet posted; wait. **Caveat:** if `strict: true` were set in classic protection AND `required_status_checks` had pending checks waiting for the branch to update against base, BLOCKED could persist with green checks; current Zeta config has `strict: false` so this caveat does NOT apply, but stays in this doc as a future-state safeguard.
- `fails > 0` → fix the failing checks. ALWAYS verify the actual failure line via `gh run view <run-id> --log-failed | grep -iE "exit code|502|fatal|404"` because the check NAME may differ from the ACTUAL failing step (often transient `curl 502` infra flakes during `tools/setup/install.sh`, not content issues).
- `running > 0` → CI in flight; wait for green
- `threads > 0` → drain the threads
- **NEVER** claim "review-approval gated" without verifying `reviewDecision == "REVIEW_REQUIRED"` AND `required_approving_review_count > 0` in this file's snapshot. Both must be true; with current config (`required_approving_review_count: 0`), review-approval is structurally NOT a gate.

## Refresh cadence

Run when:

- The human maintainer changes branch-protection settings via GitHub UI
- A new ruleset is added to either repo
- Classic branch protection is updated (required status check list change, strict mode flip, etc.)
- Quarterly drift check (audit substrate vs live state)

Refresh command (snapshots BOTH endpoints — the prior version of this command missed classic protection):

```bash
# Rulesets endpoint
gh api repos/Lucent-Financial-Group/Zeta/rules/branches/main | python3 -m json.tool > docs/operations/branch-protection-lfg-main.json
gh api repos/AceHack/Zeta/rules/branches/main | python3 -m json.tool > docs/operations/branch-protection-acehack-main.json

# Classic protection endpoint (CRITICAL — without this, the snapshot misses
# required_status_checks list and strict-mode setting)
gh api repos/Lucent-Financial-Group/Zeta/branches/main/protection | python3 -m json.tool > docs/operations/branch-protection-lfg-main-classic.json
gh api repos/AceHack/Zeta/branches/main/protection | python3 -m json.tool > docs/operations/branch-protection-acehack-main-classic.json

# Update the "Last snapshot" date above + edit the LFG / AceHack tables if rules changed
```

**Future automation (planned, NOT YET in repo):** a `tools/hygiene/check-branch-protection-snapshot-stale.sh` lint that warns if any of the 4 JSON files are >30 days old. Owed work; see Otto-329 Phase 4 follow-up tasks.

## Composes with

- **Otto-329 Phase 4** (full backups including host-layer settings) — this file is one step toward full Phase 4
- **Otto-341** (mechanism over vigilance) — substrate-as-mechanism, not memory-as-reminder
- **Otto-247** (training-data defaults drift) — the failure mode this file prevents
- **Per-user memory** `feedback_blocked_status_is_not_review_gating_check_status_checks_failure_first_otto_live_lock_2026_04_26.md` (lives at `~/.claude/projects/<slug>/memory/`, NOT mirrored in repo `memory/` — per-Claude-Code-user-instance scope) — the live-lock memory this file structurally supports
- **`docs/GITHUB-SETTINGS.md`** — the existing settings-discipline doc that flagged classic branch protection as a separate axis; this file completes the snapshot
- **AGENTS.md** required-reading section (separate update owed) — should reference this file so agent cold-start encounters it
