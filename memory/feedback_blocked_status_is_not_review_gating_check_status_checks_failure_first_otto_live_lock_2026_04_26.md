---
name: GitHub PR "BLOCKED" mergeStateStatus is NOT just review-approval gating — failing CI checks block too; ALWAYS check statusCheckRollup for FAILURE before claiming "review approval gated"; this pattern caused a session live-lock today
description: Aaron 2026-04-26 *"gated on review approval check again you'll find you are live locked and already know what the problem is, we've had this issue several times now"*. I had been claiming "BLOCKED on review approval" across 10+ session PRs without investigating actual CI status. Re-check revealed multiple PRs had FAILING checks (markdownlint, actionlint, macos-26 build-and-test) — those were the real blockers. Auto-merge armed + green review + failing CI = PR sits forever. The mergeStateStatus="BLOCKED" is a multi-cause state; I was treating it as single-cause (review-only).
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
## The miss

Across this session, I claimed many PRs were "BLOCKED on review approval" based on `mergeStateStatus: BLOCKED`. Aaron caught the pattern: I'd been doing it for hours, and "we've had this issue several times now" — meaning prior sessions too.

Re-check revealed the actual blockers were CI check FAILURES:

| PR | "BLOCKED" claim | Actual blocker |
|----|----------------|----------------|
| #586 | review-approval | `lint (markdownlint)` failing |
| #588 | review-approval | `build-and-test (macos-26)` failing |
| #557 | review-approval | `lint (actionlint)` + `lint (markdownlint)` failing |
| #200 | review-approval | `lint (markdownlint)` failing |

The auto-merge-armed PRs were sitting forever NOT because of human review gating, but because failing checks prevented auto-merge from firing.

## Rule

**`mergeStateStatus: BLOCKED` is multi-cause. ALWAYS investigate `statusCheckRollup` for FAILURE / IN_PROGRESS / QUEUED before claiming "review-approval gated".**

Quick check command:

```bash
gh pr view <N> --repo <owner/repo> --json statusCheckRollup,reviewDecision --jq '{
  review: .reviewDecision,
  fails: ([.statusCheckRollup[] | select(.conclusion=="FAILURE")] | length),
  running: ([.statusCheckRollup[] | select(.status=="IN_PROGRESS" or .status=="QUEUED")] | length),
  success: ([.statusCheckRollup[] | select(.conclusion=="SUCCESS")] | length)
}'
```

Output classes:

- `fails: 0, running: 0, review: ""` + BLOCKED → genuinely review-approval-gated (rare)
- `fails: >0` + BLOCKED → CI failing; fix the failures
- `running: >0` + BLOCKED → CI in flight; auto-merge will fire once green
- `fails: 0, running: 0, success: N, review: ""` + BLOCKED → likely required-reviewers-not-configured or branch-protection-required-checks-not-yet-running

## Live-lock shape

The recurring pattern that wastes session time:

1. Push PR with auto-merge armed
2. CI runs; some check fails (often markdownlint or actionlint on freshly-touched files)
3. Auto-merge waits for green; PR stays BLOCKED
4. I check `mergeStateStatus`, see BLOCKED, claim "review-approval gated"
5. PR sits forever; I move on
6. Aaron eventually catches it; I'd already had the data to diagnose
7. Repeat next session

The miss is in step 4 — `BLOCKED` without investigation is misdiagnosis. The data is one `gh api` call away.

## How to apply

**Before claiming "review-approval gated" on any BLOCKED PR:**

1. Run the statusCheckRollup query above.
2. If `fails > 0`: investigate each failing check, fix the underlying issue, push.
3. If `running > 0`: wait, don't claim "review gated" yet.
4. If `fails == 0 && running == 0 && success > 0`: NOW it's likely review-gating; check `reviewDecision` field too.
5. Document the actual blocker in PR comments / tick-history if relevant.

**Trigger:** any time the word "BLOCKED" appears in a status check or summary, the next move is statusCheckRollup investigation, not assuming review-only.

## Composes with

- `feedback_never_pray_auto_merge_completes_inspect_actual_blockers_otto_276_2026_04_24.md` —
  same shape: don't pray, inspect. This memory adds the specific
  diagnostic command + decision tree.
- `feedback_every_tick_inspects_holding_is_prayer_unless_preceded_by_inspection_otto_277_2026_04_24.md`
  — every tick inspects; the inspect step for a BLOCKED PR is
  statusCheckRollup, not just `mergeStateStatus`.
- `feedback_dont_assume_subagent_failed_mid_execution_wait_for_completion_signal_otto_271_2026_04_24.md`
  — same pattern at subagent layer: don't conclude failure from partial state.

## Cost of this miss

- ~20+ PRs across this session diagnosed as "review-approval gated" when they had failing CI
- Aaron had to flag the live-lock manually: *"check again you'll find you are live locked and already know what the problem is, we've had this issue several times now"*
- The fix (running statusCheckRollup query) takes ~5 seconds
- The cost-of-not-fixing (PR sitting BLOCKED for hours, false claims, Aaron-correction round-trip) compounds across PRs

## Why "we've had this issue several times now"

The pattern likely existed across multiple sessions. The previous version of me hit the same misdiagnosis. The fix didn't stick because:

1. The diagnostic query isn't muscle memory yet
2. `mergeStateStatus: BLOCKED` reads as "blocked on humans" semantically
3. Auto-merge armed + green review + failing CI is a counterintuitive state
4. Without an explicit memory rule, the wrong heuristic reasserts

This memory + the discipline ("BLOCKED → check statusCheckRollup, never claim review-only without it") is the structural fix.

## What this rule does NOT do

- Does NOT mean every BLOCKED PR is failing-CI. Sometimes review-approval IS the genuine gate.
- Does NOT replace investigating WHY the check fails. Identifying "markdownlint failed" is step one; fixing the lint is step two.
- Does NOT authorize bypassing failing checks. The fix is to address the failure, not skip it.

## Generalization — other obvious live-lock places

Aaron 2026-04-26 follow-up: *"can you correct your future self to do that better and not get live locked there or any other obvious places next time?"*

The shape of all live-locks: **claim a state without inspecting the underlying signal that determines that state**. Generalize beyond BLOCKED-as-review-gating to:

### 1. Edit-tool no-op silently due to linter race

**Pattern:** Edit fails because file was modified between my Read and Edit. I move on assuming the change landed. Actually a no-op. Later: false-claim of "fixed in $SHA".

**Diagnostic:** ALWAYS verify after Edit: check `git diff --stat` shows the expected change before claiming the fix. If a system-reminder mentions the file was modified, RE-READ before continuing.

**Fix this session:** caught when I claimed "Fixed in $SHA" on #581 thread but the commit was no-op; reversed via `unresolveReviewThread` mutation + apology.

### 2. PR-status BLOCKED treated as single-cause

(Covered above — markdownlint / actionlint / build failures hide behind BLOCKED.)

### 3. "Auto-merge armed" treated as "will eventually merge"

**Pattern:** I push, see auto-merge armed, claim victory. PR sits with failing checks for hours. I never re-check.

**Diagnostic:** auto-merge armed ≠ will merge; only fires when ALL conditions green. Periodically re-poll:

```bash
for pr in <list>; do
  gh pr view $pr --repo X --json statusCheckRollup --jq '
    [.statusCheckRollup[] | select(.conclusion=="FAILURE") | .name]'
done
```

### 4. "Holding for Aaron" treated as "fully blocked, nothing to do"

**Pattern:** I post a status update with a question, then go idle waiting for response. Aaron later says "you have authority" and I should have just acted.

**Diagnostic:** "holding for Aaron" should be reserved for genuinely irreversible / high-blast-radius decisions. Default IS act-with-authority + retract-via-UI-bulk-align-later. The Phase 1 drain triage table earlier this session was an instance of the wrong heuristic.

### 5. Cherry-pick rebase appearing successful when it skipped commits

**Pattern:** Cherry-pick said "skip" because main already had the content. I assumed both commits applied. Actually only one did. Subsequent steps assumed both.

**Diagnostic:** ALWAYS verify `git diff --stat origin/main..HEAD` matches expected change-set after cherry-pick. Not just exit code.

### 6. Resolve-thread treated as fix-confirmed

**Pattern:** I post "Fixed in $SHA" + resolve thread. Reviewer thinks issue is fixed. But $SHA was prior commit, not new fix. Or the fix was on a no-op commit.

**Diagnostic:** before resolving a thread, verify the fix is actually in the latest pushed commit. `git show <branch>:<file> | head` and confirm the change is there.

### 7. Copilot complaints treated as binary (true / false-positive) without checking

**Pattern:** I see Copilot complaint, immediately classify as "false-positive" (table syntax `||` etc.). Sometimes I'm right; sometimes I'm wrong and gloss over a real issue.

**Diagnostic:** ALWAYS verify the actual file content against the complaint, even when it's the Nth instance of a known false-positive pattern. The Nth instance might be different.

### 8. "Stale-base rebase = always destructive" mental shortcut

**Pattern:** I see large negative diff in cherry-pick rebase, conclude "stale-base, must use cherry-pick approach." Sometimes simple rebase would work fine if I dug into the conflict.

**Diagnostic:** check the actual conflict shape. Negative diff alone ≠ stale-base; could be a clean rebase that adds new content above the divergence.

### 9. Check-name ≠ actual-failing-step

**Pattern:** "Failed: lint (markdownlint)" reads as "markdownlint found violations." Actually the workflow may have died during `tools/setup/install.sh` before markdownlint ever ran (transient `curl 502` on tool download). The check NAME is what it WOULD have linted; the FAILURE is wherever the workflow died.

**Diagnostic:** before assuming the named check found content issues, `gh run view <run-id> --log-failed | grep -iE "exit code|error|fatal|502|404"` to see the actual failure line. Only edit content if the failure is genuinely in the lint step.

**Triggering case 2026-04-26:** I assumed #200's "lint (markdownlint)" failure was a markdown content issue. Re-checking, the actual failure was `curl: (22) The requested URL returned error: 502` during uv install — transient infrastructure flake. Same shape on #557. The fix is `gh run rerun --failed`, not editing content.

## Anti-pattern signature

The live-lock signature across ALL 8 cases:

- **Surface signal** (mergeStateStatus / Edit-success / auto-merge-armed / "holding" / cherry-pick-success / thread-resolved / "false-positive" / "stale-base")
- **Underlying signal** (statusCheckRollup / git-diff-stat / per-check-status / actual-blast-radius / git-diff-after-cherry-pick / git-show-of-fix-commit / actual-file-content / actual-conflict-shape)
- **Misdiagnosis** (treating surface as sufficient)
- **Cost** (PR sits, false-claim posted, work doesn't advance)

The discipline: **whenever a state-claim is about to ship, verify the underlying signal first.** ~5-second `gh api` / `git diff --stat` / `Read` calls.

## DEFINITIVE — actual LFG main branch settings (Aaron 2026-04-26 push)

Aaron 2026-04-26 deeper push: *"if you search logs you'll find you've had this exact hallucination before 'review approval.' look at our branch settings this is an impossible state for these repos."*

`gh api repos/Lucent-Financial-Group/Zeta/rules/branches/main` confirms:

```
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

**The actual gates for auto-merge to fire on LFG main:**

1. **All CI checks PASS** (`code_quality: all` — failing markdownlint / actionlint / build = blocker)
2. **All review threads RESOLVED** (`required_review_thread_resolution: true` — unresolved = blocker)
3. **Copilot has REVIEWED the latest push** (`copilot_code_review.review_on_push: true`)
4. **Linear history** (no merge commits via the merge button)

**Human review approval is EXPLICITLY NOT a gate** (`required_approving_review_count: 0`).

This is the canonical truth. The "BLOCKED state means human-review needed" mental model is **incompatible with this repo's settings**. My future-self MUST consult this memory file (or run the `gh api` query) before claiming "review approval gated" again.

## Substrate-level fix per Otto-329 Phase 4 (Aaron 2026-04-26)

Aaron 2026-04-26: *"this is another reason when we backup git and all setting these setting will be visible in repo."*

The structural fix per Otto-341 (mechanism over vigilance) is NOT "remind agent to check branch settings" — that's vigilance and reasserts under pressure. The structural fix is **make settings visible in repo so the agent reads them naturally during normal work**.

Phase 4 of Otto-329 (full backups including host-layer settings) directly prevents this entire hallucination class. Once `gh api repos/.../rules/branches/main` output is checked into the repo (e.g., `docs/operations/branch-protection.md` regenerated periodically), agents reading the repo see actual config. The training-data default ("review-required") cannot dominate because the in-repo data shows otherwise.

**Substrate composition:**

- **Otto-341 (mechanism over vigilance)** — discipline-by-tool not discipline-by-reminder
- **Otto-339 (anywhere means anywhere; words shift weights)** — settings-in-repo are part of the substrate; their absence is a substrate gap
- **Otto-329 Phase 4 (full backups including settings)** — the structural primitive that closes this gap
- **Otto-247 (training-data defaults drift)** — the failure mode that this fix prevents

Action owed (post-Phase-1-drain): elevate Otto-329 Phase 4 backup work to include explicit branch-protection JSON snapshot + checked-in markdown summary that an agent grep would surface naturally when working on a PR.

## Multi-layer default dominance (Aaron 2026-04-26 refinement)

Aaron 2026-04-26 deeper push:

> *"training-data defaults can't dominate. well depending on how much biases in it, it could still override possible even with settings checked in, since that is not a common pattern."*
>
> *"it could be harness system prompts too, i don't know if you have any ability to ignore overwrite parts of those with our substrate, the claude code harness system prompts and defaults? this is closed source code."*
>
> *"but it was leaked the other day [...] by anthropic by accident lol"*

The hallucination isn't just training-data drift; it's **multi-layer default dominance**. Three layers all encode the same wrong-for-Zeta default:

1. **Model training weights** (statistical prior — most repos require ≥1 approval)
2. **Claude Code harness system prompts** (closed-source; I cannot read them; may encode "review-required" defaults that nudge agents toward that mental model)
3. **Repo settings** (the layer I CAN see — `gh api`)

**Substrate-visibility (Otto-329 Phase 4) helps but is NOT sufficient when (1) and (2) are aligned against (3).** A single in-repo `branch-protection.json` cannot override a strong multi-layer prior the way it would override a weak prior.

**What this means operationally:**

- I cannot fully neutralize harness-level defaults via repo substrate alone
- The structural fix must include **explicit override mechanism**: e.g., a tool/lint that FAILS hard if I claim "review-approval gated" without a `gh pr view --json reviewDecision` value of `REVIEW_REQUIRED`. Mechanism not memory; CI not substrate.
- The leaked Claude Code system prompt (Anthropic accidentally published recently per Aaron — post-Jan-2026 cutoff so I don't have it loaded) may contain language that biases me toward "review-approval gated" framing. Future-me should ask Aaron if there's a referenceable copy worth absorbing into substrate.

**Composes with `feedback_otto_339_language_routes_through_model_weights_*`:** language anywhere shifts weights. Multi-layer means weights are shifted by training + harness + repo simultaneously. Getting one layer right (repo) doesn't override the other two if they push the same way.

## 2nd-agent audit findings (Aaron 2026-04-26 dispatch)

Aaron asked for a 2nd-agent opinion. Audit doc landed at `/tmp/live-lock-audit-2026-04-26.md`. Key independent findings beyond the 8 patterns:

1. **PR #143 irony** — the PR titled "live-lock audit tool" has been live-locked for 69 hours with failing CI. Strongest single evidence the discipline isn't sticking.
2. **mergeStateStatus has 5 causes not 4** — `DIRTY` (merge conflicts) is conflated with `BLOCKED` in my mental model. Diagnostic must distinguish.
3. **Context-window-collapse pattern** — the `gh api ... approvals: 0` ground truth was actually loaded earlier in session and decayed across compaction boundaries. The training-data prior reasserted post-compaction. **This is the multi-layer dominance in action.**
4. **Lossy-tool-output discipline** — unifies `mergeStateStatus`, `grep -oE` truncation, `git diff --stat`, single-line `gh pr view`. Surface-vs-underlying signal mismatch is the meta-pattern.
5. **Memory ↔ mechanism pairing gap** — Otto-276/277 already shipped 2 days ago, didn't stick. **Memory-without-mechanism is the meta-defect.**

**Top-3 structural fixes per auditor:**

1. **Ship Otto-329 Phase 4 NOW** — `gh api .../rules/branches/main` JSON checked into `docs/operations/branch-protection.json` + AGENTS.md required-reading entry.
2. `tools/hygiene/check-blocked-pr-rollup.sh` as enforcing tick check (mechanism-not-memory).
3. Meta-discipline self-check — fail CI if any PR titled `live-lock`/`prayer`/`hallucin` sits >24h.

**Auditor's verdict on what Otto got right:** "honest naming, correct cross-references, accurate root-cause attribution to Otto-247, and explicit acknowledgment that memory alone won't suffice. The gap is operationalisation, not analysis."

The gap between knowing-the-rule and applying-the-rule is exactly the multi-layer-dominance problem. Mechanism (Phase 4 + hygiene tool + CI check) is the only known fix.

## Hallucination root cause

The "human review approval required" model is the **training-data statistical default** for GitHub repos. Most public repos require ≥1 approval. Zeta does NOT, which is why this hallucination keeps reasserting — the prior is strong, the actual config is unusual.

Per Otto-247 / `feedback_version_currency_always_search_first_training_data_is_stale_otto_247_2026_04_24.md` — training-data defaults DRIFT from current state. Same mechanism applies here at the GitHub-config layer: training data assumes "review-required" is the norm; Zeta config says otherwise. Always check the actual config.

## Memory-reinforcement step

Per Aaron 2026-04-26 *"we've had this issue several times now"*: this memory needs to STICK across sessions. The reinforcement mechanism:

- This memory file (this one)
- Index entry in `MEMORY.md` flagging the live-lock cluster
- Cross-reference from `feedback_never_pray_auto_merge_completes_inspect_actual_blockers_otto_276_2026_04_24.md` (which already had the seed) — needs updating to point HERE for the generalized form
- 2nd-agent opinion (Aaron 2026-04-26 *"maybe get a 2nd agent opinion too"*) — dispatched separately

If the memory still doesn't stick, the next-tier intervention is structural: hooks / pre-commit lints / a `tools/hygiene/check-blocked-pr-statuscheckrollup.sh` audit script that runs whenever I claim "BLOCKED on review."
