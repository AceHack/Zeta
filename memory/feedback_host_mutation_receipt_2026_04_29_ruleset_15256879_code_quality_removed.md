---
name: Host mutation receipt — ruleset 15256879 code_quality rule removed (Aaron-authorized 2026-04-29)
description: Receipt for a live host (GitHub) mutation made before the executable-host-settings tooling exists. PUT /repos/Lucent-Financial-Group/Zeta/rulesets/15256879 removed the `code_quality severity=all` rule that had been injecting `event=dynamic` "Code Quality" CodeQL runs (the host-side / non-git-declared CodeQL owner). This made the git-visible advanced workflow `.github/workflows/codeql.yml` (with the source-presence gate from PR #857) the sole CodeQL owner — resolving the multi-master conflict that blocked PR #849. Per Amara 2026-04-29 ("Clickops used to restore declarative ownership must become a receipt, or it becomes the next drift"), this receipt records the live mutation so that future executable-host-settings tooling can absorb it into the desired-state declaration at `.zeta/hosts/github/lfg-zeta.yaml` (parked on `doctrine/executable-declarative-host-settings-2026-04-29` branch pending Aaron's research-first directive).
type: feedback
---

# Host mutation receipt — ruleset 15256879 / code_quality rule removed

**This is a receipt, not a doctrine memory.** The rule it records: *Clickops used to restore declarative ownership must become a receipt, or it becomes the next drift* (Amara 2026-04-29). The receipt's purpose is to make the live host change visible to future agents and to the future executable-host-settings reconciler.

## What changed

**Operation**: `PUT /repos/Lucent-Financial-Group/Zeta/rulesets/15256879`

**Diff** (rules array):

- BEFORE (6 rules): `deletion`, `non_fast_forward`, `copilot_code_review`, `pull_request`, `required_linear_history`, **`code_quality severity=all`**
- AFTER (5 rules): `deletion`, `non_fast_forward`, `copilot_code_review`, `pull_request`, `required_linear_history`

The `code_quality severity=all` rule was the *only* item removed.

**Ruleset metadata after change**:

- `id: 15256879`
- `name: "Default"`
- `target: branch`
- `source_type: Repository` (NOT inherited from org)
- `source: Lucent-Financial-Group/Zeta`
- `enforcement: active`
- `conditions.ref_name.include: ["~DEFAULT_BRANCH"]`
- `updated_at: 2026-04-29T17:05:06.670-04:00` (= 2026-04-29T21:05:06.670Z UTC)

## Why

### The failure mode

The repo's `code_quality severity=all` rule (a public-preview GitHub Code Quality feature, NOT marked "legacy" in GitHub's product taxonomy — only legacy *relative to Zeta's desired declarative architecture*) was injecting `event=dynamic` runs named `"Code Quality: PR #849"` whose `workflowName: "CodeQL"` matched the repo's advanced-setup workflow but ran with a different shape — without the `path-gate` job and without the per-language source-presence gate that PR #857 added.

For PR #849 (Python tools retiring after the TS port), the live CodeQL extractor on the dynamic run failed with the documented "no source code seen during build" error (exit 32) because no first-party `*.py` files remained. The PR was BLOCKED on `Analyze (python) FAILURE` from this dynamic run, even though the parallel `event=pull_request` run from the advanced workflow showed `Analyze (python) SUCCESS` via the no-source baseline path.

### Multi-master CodeQL

Per Amara 2026-04-29 ("Choose one owner: Default Setup only OR Advanced Setup only. Do not multi-master CodeQL"), the two paths can't peacefully co-own one analysis surface. GitHub aggregates per-language status by check-name across runs and takes the worst, so even when the advanced setup succeeds, a parallel host-side dynamic run failing keeps the PR blocked.

### Aaron's signal

Aaron 2026-04-29: *"if the org-recommended are legacy we can remove, declarative is better."* Aaron's "GitHub legacy = non-declarative" framing — whenever GitHub offers two paths for one capability (declarative + API-driven), prefer declarative; if no declarative path exists, wrap the API. The `code_quality` rule is the API-driven path; `.github/workflows/codeql.yml` is the declarative path with the source-presence gate.

## Authorization chain

1. **Aaron 2026-04-29**: *"if the org-recommended are legacy we can remove, declarative is better"* — explicit signal authorizing removal.
2. **Amara 2026-04-29**: *"Make advanced setup the sole CodeQL owner for Zeta right now. Disable Default Setup / dynamic CodeQL owner"* — design recommendation prior to Aaron's signal.
3. **Standing-authority memory** (`feedback_standing_authority_create_test_git_repos_public_only_track_billing_aaron_2026_04_29.md`) and **branch-protection-is-agent-call** (Aaron 2026-04-23) — delegated authority pattern that this mutation falls under.

## What this receipt is NOT

- **NOT a doctrine adoption.** Removing the rule is invariant maintenance. The doctrine that should govern future ruleset mutations is the executable-host-settings design — verbatim packet currently parked on branch `doctrine/executable-declarative-host-settings-2026-04-29` (unlanded on main pending Aaron's "research-first" lane; will land at `docs/research/2026-04-29-amara-executable-declarative-host-settings.md` and `memory/feedback_executable_declarative_host_settings_design_packet_research_first_aaron_amara_2026_04_29.md` when the space-survey research lands). **Research-first; NO active adoption yet** per Aaron's *"we should research it first i think the whole space"* signal.
- **NOT a precedent for casual ruleset mutations.** The hook denial during this episode was **healthy**: it required explicit authorization and refused the broad-permission shortcut. Per Amara: future ruleset apply path is host-reconciler-mediated with WorkClaim + policy + receipt, NOT direct `gh api ... rulesets/PUT` from the agent. Do NOT broaden the `Bash:gh api -X PUT repos/.../rulesets/*` permission in `.claude/settings.json`.
- **NOT a permanent erasure of GitHub Code Quality.** GitHub Code Quality is a current public-preview feature — it's "legacy" only relative to Zeta's desired architecture. If the executable-host-settings design later determines the host-side rule should re-enable in a different form (e.g., as a non-blocking advisory check), the desired-state declaration at `.zeta/hosts/github/lfg-zeta.yaml` will say so and the reconciler will converge.

## Future-state record (for the executable-host-settings reconciler)

When `.zeta/hosts/github/lfg-zeta.yaml` lands (per Amara's MVP "PR 1"), the desired-state declaration should include:

```yaml
rulesets:
  - id: 15256879
    name: Default
    target: branch
    enforcement: active
    include:
      - "~DEFAULT_BRANCH"   # matches the live ruleset condition; resolves to refs/heads/main on this repo today
    rules:
      - type: deletion
      - type: non_fast_forward
      - type: copilot_code_review
        parameters:
          review_on_push: true
          review_draft_pull_requests: true
      - type: pull_request
        parameters:
          required_approving_review_count: 0
          dismiss_stale_reviews_on_push: false
          required_review_thread_resolution: true
          allowed_merge_methods: ["squash"]
      - type: required_linear_history
      # NOTE: `code_quality` rule intentionally absent — see receipt
      # `feedback_host_mutation_receipt_2026_04_29_ruleset_15256879_
      # code_quality_removed.md` for the live-mutation history.
      # The git-visible `.github/workflows/codeql.yml` is the sole
      # CodeQL owner for this repo.
```

When the reconciler runs `hosts:diff` for the first time, this receipt should resolve the would-be `unauthorized_drift` finding (live host has 5 rules; pre-mutation history would expect 6) into `expected_drift` with this receipt as the proof.

## Composes with

- **`feedback_otto_363_substrate_or_it_didnt_happen_no_invisible_directives_aaron_amara_2026_04_29.md`** — substrate-or-it-didn't-happen demands this receipt land as durable substrate so git can remember the change.
- **Executable-host-settings design** (parked on `doctrine/executable-declarative-host-settings-2026-04-29` branch; will land at `memory/feedback_executable_declarative_host_settings_design_packet_research_first_aaron_amara_2026_04_29.md` after the space-survey research) — the design that this receipt is the first concrete artifact for. The reconciler tooling will read this receipt as input once the lane lands.
- **PR #857** (codeql per-language source-presence gate) — the source-presence gate that this mutation makes the sole CodeQL owner.
- **PR #849** (TS hygiene-port) — the PR that surfaced the multi-master conflict and triggered the mutation.
- **Task #342 (completed)** — multi-master CodeQL conflict resolution.
- **Task #343** — drift-debt receipt task this file fulfils.

## Carved blade (Amara, preserved verbatim)

> *Clickops used to restore declarative ownership must become a receipt, or it becomes the next drift.*

> *The host was disagreeing with git. We made git the owner again. Now record the host mutation so git can remember it.*
