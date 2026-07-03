---
pr_number: 5417
title: "feat(081KSKBP80008QG0R000Y2B7HC.1): cosign keyless OIDC signing for ISO blob in build-ai-cluster-iso workflow (sigstore + Fulcio + Rekor; zero key management)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T07:27:06Z"
merged_at: "2026-05-27T07:29:33Z"
closed_at: "2026-05-27T07:29:33Z"
head_ref: "feat/b-0853-1-cosign-keyless-oidc-iso-signing"
base_ref: "main"
archived_at: "2026-05-27T19:25:16Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5417: feat(081KSKBP80008QG0R000Y2B7HC.1): cosign keyless OIDC signing for ISO blob in build-ai-cluster-iso workflow (sigstore + Fulcio + Rekor; zero key management)

## PR description

## Summary

081KSKBP80008QG0R000Y2B7HC sub-row .1 — smallest end-to-end slice of the sigstore artifact-signing substrate authorized by Aaron 2026-05-27 (*"please start on the free stuff and backlog it"*).

Signs the freshly-built ISO via **GitHub OIDC + Fulcio CA + Rekor transparency log** in the existing build-ai-cluster-iso CI flow. Zero private key material; zero third-party dep beyond the pinned sigstore action.

## 3 workflow changes

1. Add `id-token: write` to workflow-level permissions (required for keyless OIDC; no private key handled)
2. Insert **Install cosign** + **Sign ISO** steps between Locate-ISO-metadata + Upload-ISO-artifact
3. Add second **Upload cosign signature + certificate** step (`.sig` + `.pem` as separate artifact bundle so verifiers can grab just signature pair without re-fetching ~1.5GB ISO)

## Verification (any consumer)

```bash
cosign verify-blob \
  --certificate <iso>.pem \
  --signature <iso>.sig \
  --certificate-identity-regexp '^https://github.com/Lucent-Financial-Group/Zeta' \
  --certificate-oidc-issuer 'https://token.actions.githubusercontent.com' \
  <iso>
```

## Pin discipline (per `.claude/rules/dep-pin-search-first-authority.md`)

Verified live via gh API 2026-05-27:

```
gh api repos/sigstore/cosign-installer/releases/latest
→ tag: v4.1.2; published: 2026-05-07T01:27:27Z
gh api repos/sigstore/cosign-installer/git/ref/tags/v4.1.2
→ sha: 6f9f17788090df1f26f669e9d70d6ae9567deba6
```

Pin: `sigstore/cosign-installer@6f9f17788090df1f26f669e9d70d6ae9567deba6 # v4.1.2`

## Security discipline (matches existing workflow pattern)

- All inputs to `cosign sign-blob` come from `steps.iso.outputs.*` (THIS workflow's prior steps) via **env-var hop** (`ISO_PATH` env)
- No `github.event.*` interpolation in any `run:` block (matches existing discipline at line 182-186)
- `id-token` scope is workflow-bound; cannot be exfiltrated to mint signatures for other workflows
- Cosign 2.x defaults to ambient OIDC detection — GitHub-runner-issued token used automatically

## Composes with

- **081KSKBP80008QG0R000Y2B7HC** (parent row) — sigstore artifact signing free-stuff substrate
- **081KSGS9H0008QG0R0012R8ZWS** — artifact attestation; this lands the primitive
- **081KSKBP80008QG0R003Z4C0D0** — cluster substrate that consumes signed ISO
- **081KSGS9H0008QG0R00126RHQR** (deferred) — release-attach; sig + pem can attach to GitHub release tag when created

## What this is NOT

- NOT container image signing (081KSKBP80008QG0R000Y2B7HC.2; sibling slice)
- NOT cosign verify gate in `zeta-install.sh` (081KSKBP80008QG0R000Y2B7HC.5)
- NOT SLSA provenance attestations (081KSKBP80008QG0R000Y2B7HC.7)
- NOT cluster-side image policy webhook (081KSKBP80008QG0R000Y2B7HC.6)

## Test plan

- [ ] Workflow run on this PR triggers new steps cleanly
- [ ] `.sig` + `.pem` artifacts published alongside ISO
- [ ] Rekor entry verifiable via `rekor-cli get --uuid <uuid>`
- [ ] `cosign verify-blob` against published artifact succeeds with org-identity regex match
- [ ] No new GraphQL or REST budget burn

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T07:29:55Z)

## Pull request overview

Adds Sigstore/Cosign keyless (GitHub OIDC → Fulcio cert → Rekor transparency log) signing to the existing `build-ai-cluster-iso` GitHub Actions workflow, producing a `.sig` + `.pem` pair alongside the built ISO so downstream consumers can verify integrity without managing private keys.

**Changes:**

- Grants workflow OIDC capability by adding `id-token: write` permission.
- Installs `cosign` (pinned action) and signs the built ISO blob during the workflow run.
- Uploads the generated signature + certificate as a separate workflow artifact bundle.

## Review threads

### Thread 1: .github/workflows/build-ai-cluster-iso.yml:76 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T07:29:54Z):

P1: Consider scoping `id-token: write` to the `jobs.build.permissions` block instead of workflow-level. The repo already follows the pattern of keeping workflow-level permissions minimal and elevating only on the specific job that needs it (e.g. `.github/workflows/scorecard.yml` uses job-level `permissions:` for `id-token: write`). This reduces the blast radius if future jobs are added to this workflow.

### Thread 2: .github/workflows/build-ai-cluster-iso.yml:79 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T07:29:55Z):

P1: The comment claims the OIDC token-issuance permission "cannot be exfiltrated to mint signatures for other workflows." Any step that can request the OIDC token could still transmit it off-runner and use it to obtain a Fulcio cert and sign arbitrary blobs as this workflow identity (even if it can’t change the identity to a different workflow). Please tighten this wording to avoid overstating guarantees; the real safety properties are the token’s short lifetime + identity binding + trusted/pinned steps.

### Thread 3: .github/workflows/build-ai-cluster-iso.yml:323 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T07:29:55Z):

P1: The recommended `--certificate-identity-regexp '^https://github.com/Lucent-Financial-Group/Zeta'` is very broad; it will accept signatures from any workflow identity under the repo. For consumers verifying the published ISO, it’s safer to pin identity to this specific workflow (and usually the intended ref, e.g. `.../.github/workflows/build-ai-cluster-iso.yml@refs/heads/main` or tags) so another workflow in the same repo can’t produce a signature that passes verification.

## General comments

### @chatgpt-codex-connector (2026-05-27T07:27:11Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
