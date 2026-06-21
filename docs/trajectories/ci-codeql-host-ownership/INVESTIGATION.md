# Lane A — sticky `Analyze (python)` ownership investigation

**Lane**: A — Live unblock on PR #849 (TS port of `tools/hygiene` Python scripts)
**Probe question**: Who owns the sticky `Analyze (python)` check that flips PR #849 to UNSTABLE?
**Status**: Owner identified. Closure-state proposal below.
**Last updated**: 2026-04-29T23:05:07Z

## Probe results (one probe, single-purpose)

### Failing-check identity

| Field | Value |
|---|---|
| Failing check name | `Analyze (python)` |
| Failing run id | 25134077654 (PR #849 head) |
| Workflow path | `dynamic/github-code-scanning/codeql` (GitHub-managed dynamic, NOT a checked-in workflow file) |
| Run event | `dynamic` |
| Workflow display name | `Code Quality: PR #849` |
| `isRequired` | `null` (NOT a required check under branch protection) |
| Conclusion | `failure` (configuration error: `CodeQL detected code written in GitHub Actions, C#, JavaScript/TypeScript and Java/Kotlin, but not any written in Python.`) |

### Repo-level Code Scanning state

```json
{
  "state": "not-configured",
  "languages": ["actions", "csharp", "java-kotlin", "javascript",
                "javascript-typescript", "python", "typescript"],
  "query_suite": "extended",
  "threat_model": "remote",
  "runner_type": "standard"
}
```

Repo-level Default Setup is `not-configured`. The repo-level `code-security-configuration` endpoint returns `204 No Content` — no configuration is explicitly attached to Zeta.

### Latest CodeQL analyses (verified working)

```text
csharp           (CodeQL)  2026-04-29T22:45:46Z  refs/heads/main
java-kotlin      (CodeQL)  2026-04-29T22:44:10Z  refs/heads/main
javascript-ts    (CodeQL)  2026-04-29T22:44:00Z  refs/heads/main
```

These are from the in-repo `.github/workflows/codeql.yml` per-language source-presence gate (PR #857). Python is correctly excluded by that workflow because Zeta has no Python source at root (only `tools/lean4/.lake/packages/mathlib/scripts/*.py` upstream + the two `tools/hygiene/*.py` scripts being ported in #849).

### Owner: org-level `default_for_new_repos: "all"`

LFG org Code Security has 6 configurations. Configuration `244997` ("Code Scanning enabled") carries:

```json
{
  "default_for_new_repos": "all",
  "configuration": {
    "id": 244997,
    "target_type": "organization",
    "code_scanning_default_setup": "enabled",
    "code_scanning_default_setup_options": {
      "runner_type": "not_set",
      "runner_label": null
    }
  }
}
```

This `default_for_new_repos: "all"` policy auto-applies Code Scanning Default Setup to every LFG repo, including Zeta — even though no explicit attachment shows on the `repos/Zeta/code-security-configuration` endpoint. The auto-applied Default Setup spawns the GitHub-managed dynamic Code Quality run that fires `Analyze (python)` on PR diffs containing Python paths (whether or not the in-repo workflow's `paths-ignore` filter would skip them).

PR #849's diff includes the two `tools/hygiene/*.py` scripts being deleted as part of the port → the dynamic run sees Python paths in the diff → tries to extract Python sources at repo root → fails because the `paths-ignore` filter is in `.github/codeql/codeql-config.yml` (which the in-repo workflow honors) but the GitHub-managed dynamic run does not honor.

### Branch protection on `main`

```json
{
  "required_approving_review_count": 0,
  "dismiss_stale_reviews_on_push": false,
  "required_reviewers": [],
  "require_code_owner_review": false,
  "require_last_push_approval": false,
  "required_review_thread_resolution": true,
  "allowed_merge_methods": ["squash"]
}
```

- 0 approvals required
- All review threads must be resolved (currently 0 unresolved on #849)
- Squash-merge only

### PR #849 mergeability

| Field | Value |
|---|---|
| `state` | OPEN |
| `mergeable` | MERGEABLE |
| `mergeStateStatus` | UNSTABLE (failed checks present, but none required) |
| Required failing checks | 0 |
| Unresolved review threads | 0 |
| Auto-merge | NOT armed |

PR #849 is **mergeable** under branch protection. The UNSTABLE state reflects only the non-required `Analyze (python)` failure.

## Closure-state proposal

Per the locked Lane A closure states (Amara extended set, 5 options):

> 1. `merged`
> 2. `abandoned_with_reason`
> 3. `blocked_on_authority_action_with_exact_next_step`
> 4. `non_actionable_by_otto_with_evidence`
> 5. `actionable_by_otto`

**Two-axis classification** (because the sticky check and the PR are different objects):

| Object | State | Reasoning |
|---|---|---|
| Sticky `Analyze (python)` check | `non_actionable_by_otto_with_evidence` | Modifying LFG org config 244997 `default_for_new_repos: "all"` would affect every LFG repo (wrong blast radius). Out of Lane A scope. |
| PR #849 merge | `actionable_by_otto` | All required checks pass, 0 unresolved threads, branch protection allows merge with non-required failures, standing authority covers the merge. |

**Lane A closes at `merged`** — not at "sticky check fixed." The check is informational noise. The PR is the lane.

### Evidence (per locked evidence types)

Evidence type 5 from the locked list — *"specific stale/non-required check evidence showing no further technical action needed"* — is met:

- The sticky check is `isRequired: null`
- Branch protection allows merge with non-required failing checks
- All required checks pass (23 SUCCESS at last count)
- 0 unresolved review threads
- The PR is `MERGEABLE` per GitHub's mergeability calculation

The sticky check is **noise**, not a blocker. The actual path to close Lane A is to merge PR #849 as-is.

### Why not change the org config?

Modifying `default_for_new_repos: "all"` on configuration 244997 would affect every LFG org repo, not just Zeta. Big blast radius. Alternative: detach Zeta specifically — but Zeta isn't explicitly attached, so detachment isn't the operation. Either path requires changes that go beyond the scope of unblocking #849. **Out of scope for Lane A.**

The right framing: the org-level Code Quality dynamic run is host-side noise. Zeta's in-repo `codeql.yml` (PR #857) correctly handles per-language source-presence gating. The dynamic run firing alongside is a known multi-master pattern that produces non-required failures. Living with the noise (and merging PRs despite UNSTABLE) is the operational path until/unless the org-level policy is revisited. That revisit is **not** part of Lane A — it's a separate trajectory that would belong in Lane B+ work.

## Recommended next action

Squash-merge PR #849 as-is — under standing authority per the locked discipline ("if owner is actionable, act").

- It's the TS port of `tools/hygiene/sort-tick-history-canonical.py` + `fix-markdown-md032-md026.py` (081KQ8P5D0008QG0R003BFZPRC).
- All required CI is green.
- The sticky `Analyze (python)` is non-required and informational only.
- Branch protection allows the merge (0 approvals required, conversation resolution met, squash-only allowed).
- This advances the TS migration trajectory by ~3% in PR → ~3% landed.

**Why-it-advances-Lane-A test**: squash-merging PR #849 advances closure of Lane A directly because Lane A *is* the unblock of #849. The merge moves the lane from `actionable_by_otto` → `merged`. This satisfies the lane-continuation classifier ("Would completing this directly advance closure of #849?" → yes).

## Composes with

- Multi-AI troubleshooting round 1 + round 2 verbatim packets (parked on branch `research/multi-ai-troubleshooting-mode-mixing-2026-04-29`, not currently merged to main; that's where the locked discipline this investigation follows lives in verbatim form)
- `memory/feedback_host_mutation_receipt_2026_04_29_ruleset_15256879_code_quality_removed.md` (PR #861 — earlier host mutation removed the ruleset-level code_quality severity rule; the `default_for_new_repos: "all"` policy is a different surface)
- `.github/workflows/codeql.yml` (in-repo workflow with PR #857's per-language gate)
- `.github/codeql/codeql-config.yml` (paths-ignore filter, honored by in-repo workflow but NOT by dynamic run)

## Deferred notes

(Per the round-2 closing rule: deferred notes go in this file's `## Deferred notes` section rather than creating a new file. Goes here only if the deferral is durable substrate that would otherwise be lost.)

- Round-close meta-observations on review-surface health are optional. The data is in the diff. Commentary can rest for several rounds.
- The org-level `default_for_new_repos: "all"` policy is a candidate for Lane B+ trajectory work (post-#849 closure). If Lane B's trajectory enumeration walks branches/PRs/tasks, it should pick this up. Until then, parking here as a deferred note rather than a new task (per the zero-fan-out rule).
- The github-settings-drift workflow is failing on every push event (separate pre-existing tech debt). Also a Lane B+ candidate, not a Lane A subtask.
- **Trajectory-naming correction (mid-Lane-A, post-merge)**: this directory is named `ci-codeql-host-ownership/` and reads like a trajectory, but it's actually a **blocker record** for the actual trajectory (TypeScript/Bun migration). The trajectory the maintainer cares about is *"how far along is the TS/Bun migration, and what's the next slice?"* — not *"who owns the sticky CodeQL check?"*. Lane B's first artifact should be `docs/trajectories/typescript-bun-migration/RESUME.md` tracking landed TS/Bun ports + remaining Python + remaining Bash + which scripts stay Bash vs become TS vs become F#/dotnet + next PR slice. This investigation links FROM that trajectory as the #849 blocker record. Carved: *CodeQL was the blocker. TypeScript/Bun is the trajectory.*
