---
pr_number: 5419
title: "fix(081KSKBP80008QG0R000Y2B7HC.1 post-merge): 3 Copilot P1 security tightenings on PR #5417 (job-scope id-token + tightened safety wording + pinned verification identity)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T07:32:13Z"
merged_at: "2026-05-27T07:35:10Z"
closed_at: "2026-05-27T07:35:10Z"
head_ref: "fix/b-0853-1-copilot-3-security-tightenings"
base_ref: "main"
archived_at: "2026-05-27T19:25:13Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5419: fix(081KSKBP80008QG0R000Y2B7HC.1 post-merge): 3 Copilot P1 security tightenings on PR #5417 (job-scope id-token + tightened safety wording + pinned verification identity)

## PR description

## Summary

Post-merge fix-fwd for 3 Copilot P1 security findings on [PR #5417](https://github.com/Lucent-Financial-Group/Zeta/pull/5417) (cosign keyless OIDC ISO signing) which merged at \`70596a8db\` before the review threads could be addressed.

All 3 findings are valid security improvements; this PR is documentation/permission-scoping only — no runtime behavior change.

## Findings + fixes

### Finding 1 (P1): scope `id-token: write` to job, not workflow

**Before**: top-level `permissions: { id-token: write }`
**After**: scoped to `jobs.build.permissions: { id-token: write }`

Matches the repo pattern in \`.github/workflows/scorecard.yml\`. Reduces blast radius if future jobs are added to this workflow.

### Finding 2 (P1): tighten safety wording

**Before**: \"token-issuance scope is workflow-bound; granted permission cannot be exfiltrated to mint signatures for other workflows.\"

**Overstated** — any step with id-token access could in principle transmit the token off-runner.

**After**: comment names the actual mitigation surfaces (short-lived cert, identity binding, pinned steps) + acknowledges the realistic threat.

### Finding 3 (P1): tighten verification regexp

**Before**: \`--certificate-identity-regexp '^https://github.com/Lucent-Financial-Group/Zeta'\` (prefix-regex; accepts ANY workflow under the repo — defeats workflow-identity binding).

**After**: explicit pin to this specific workflow file + ref:
\`\`\`
--certificate-identity 'https://github.com/Lucent-Financial-Group/Zeta/.github/workflows/build-ai-cluster-iso.yml@refs/heads/main'
\`\`\`
Plus documented variants for verifying branch + tag signatures.

## What this is NOT

- NOT a runtime change to the cosign sign-blob step itself (identity emitted into signed cert is the same)
- NOT a re-do of PR #5417 (that one's merged; this builds on it)
- NOT a new sub-row (these are corrections to already-shipped substrate per 081KSKBP80008QG0R000Y2B7HC.1)

## Composes with

- **081KSKBP80008QG0R000Y2B7HC.1** parent ([PR #5417](https://github.com/Lucent-Financial-Group/Zeta/pull/5417) merged at \`70596a8db\`)
- **081KSKBP80008QG0R000Y2B7HC** parent row (sigstore signing substrate)

## Resolves Copilot threads on #5417

- \`PRRT_kwDOSF9kNM6FBtyf\` (id-token scoping)
- \`PRRT_kwDOSF9kNM6FBtzO\` (safety wording)
- \`PRRT_kwDOSF9kNM6FBtzn\` (verification identity pin)

## Test plan

- [ ] Workflow run still succeeds with job-scoped id-token (functionally identical)
- [ ] cosign sign-blob step unchanged; signed identity unchanged
- [ ] Documentation lint clean

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T07:33:27Z)

## Pull request overview

Post-merge security tightening for PR #5417's cosign keyless OIDC signing setup, addressing three P1 Copilot review findings on the `build-ai-cluster-iso` workflow. Changes are documentation- and permission-scoping-only with no runtime behavior change.

**Changes:**
- Move `id-token: write` from workflow-level to `jobs.build.permissions` (job scope), matching the `scorecard.yml` pattern.
- Replace overstated safety wording with realistic threat surfaces (short-lived cert, identity binding, pinned steps) and acknowledge the residual risk.
- Update documented `cosign verify-blob` invocation from a permissive `--certificate-identity-regexp` prefix to an exact `--certificate-identity` pin for the workflow file + ref, with variants for branches and tags.

## General comments

### @chatgpt-codex-connector (2026-05-27T07:32:18Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
