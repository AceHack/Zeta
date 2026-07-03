---
pr_number: 5405
title: "feat(081KSKBP80008QG0R002VRN56K): zeta-install.sh \u2192 `ace install zeta` migration trajectory \u2014 declarative `package.json`-style manifest like `../scratch` and `../SQLSharp` (Aaron 2026-05-27)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T06:02:54Z"
merged_at: "2026-05-27T06:05:03Z"
closed_at: "2026-05-27T06:05:03Z"
head_ref: "backlog/b-0854-ace-install-zeta-migration-trajectory-2026-05-27"
base_ref: "main"
archived_at: "2026-05-27T19:25:25Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5405: feat(081KSKBP80008QG0R002VRN56K): zeta-install.sh → `ace install zeta` migration trajectory — declarative `package.json`-style manifest like `../scratch` and `../SQLSharp` (Aaron 2026-05-27)

## PR description

## Summary

- Operator-named migration trajectory: imperative bash installer → declarative Ace-package-manager-driven install
- Reference shape from `../scratch` + `../SQLSharp` on operator's machine (`package.json` + `bunfig.toml` + `bun.lock` + `Directory.Build.props`)
- 5-phase trajectory; Phase 0 + Phase 1 = smallest substrate slice (manifest stub at Zeta repo root)
- 9 sub-rows enumerated (081KSKBP80008QG0R002VRN56K.1-9)
- Composes with full Ace cluster: 081KR2E4K0008QG0R002YE3MMD CLI (parent dep) + 081KSGS9H0008QG0R0031PBNGA meta-PM + 081KSGS9H0008QG0R003A37Z65 ArgoCD-max + 081KSE6WT0008QG0R000YYH3DY distributable-POC + 081KSGS9H0008QG0R00367G209 dep-graph + 081KSGS9H0008QG0R0018ES3R4 diamond-res + 081KSE6WT0008QG0R000JSJ3SR ontology-negotiation + 081KQZVQW0008QG0R000ZHEN62 lineage

## Honors operator's "we just spoke about this earlier"

Existing Ace cluster substrate (081KR2E4K0008QG0R002YE3MMD + 0742 + 0777 + 0816 + 0821 + 0822 + 0824 + 0247 + ace-package-manager agenda + skill-crystallization-pipeline trajectory) covers the architecture + CLI primitives but does NOT explicitly name "Zeta installs itself via Ace" migration. This row is the OPERATIONAL bridge that closes the dogfooding loop without minting redundant architecture.

## Rule 0 preserved

Per `.claude/rules/rule-0-no-sh-files.md`: install-graph carve-out preserved through all phases. `zeta-install.sh` shrinks at Phase 4 (becomes thin bootstrap wrapping `ace install zeta`); full retirement only after `ace install zeta` is canonical entrypoint.

## Composes with adjacent in-flight work

- **081KSKBP80008QG0R003AX2A69** — cred persistence (the Ace-driven install respects same cred-persistence flow)
- **081KSKBP80008QG0R000Y2B7HC** — sigstore signing (Ace verifies manifest signature before fetch)

## Test plan

- [ ] Backlog index regen verified (BACKLOG.md shows 081KSKBP80008QG0R002VRN56K at P1)
- [ ] Composes_with reciprocity check (whole Ace cluster gets reciprocal back-ref when this row's implementation work begins)
- [ ] Phase 0 sub-row (081KSKBP80008QG0R002VRN56K.1 inventory) first concrete substrate when implementation work claims parent row

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T06:05:19Z)

## Pull request overview

Adds a new P1 backlog row for migrating Zeta installation from `zeta-install.sh` toward a declarative Ace-managed `ace install zeta` flow, and updates the generated backlog index to include it.

**Changes:**

- Adds 081KSKBP80008QG0R002VRN56K with phased migration plan and Ace-cluster cross-references.
- Updates `docs/BACKLOG.md` with the new P1 entry.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 2 comments.

| File | Description |
| ---- | ----------- |
| `docs/backlog/P1/081KSKBP80008QG0R002VRN56K-zeta-install-sh-to-ace-install-zeta-migration-trajectory-package-json-style-declarative-manifest-like-scratch-and-sqlsharp-aaron-2026-05-27.md` | New backlog row describing the Ace install migration trajectory. |
| `docs/BACKLOG.md` | Generated backlog index entry for 081KSKBP80008QG0R002VRN56K. |

## Review threads

### Thread 1: docs/backlog/P1/081KSKBP80008QG0R002VRN56K-zeta-install-sh-to-ace-install-zeta-migration-trajectory-package-json-style-declarative-manifest-like-scratch-and-sqlsharp-aaron-2026-05-27.md:20 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-27T06:05:18Z):

P1: `081KSKBP80008QG0R003AX2A69` is listed as a composed backlog row, but there is no `docs/backlog/**` row with `id: 081KSKBP80008QG0R003AX2A69` in this tree (only references from 081KSKBP80008QG0R000Y2B7HC and this new file). Either add the missing row in this PR or remove/replace this cross-reference so the backlog graph does not gain a dangling ID.

### Thread 2: docs/backlog/P1/081KSKBP80008QG0R002VRN56K-zeta-install-sh-to-ace-install-zeta-migration-trajectory-package-json-style-declarative-manifest-like-scratch-and-sqlsharp-aaron-2026-05-27.md:112 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-27T06:05:18Z):

P1: This trajectory should not bless a bootstrap path that streams bytes from `curl` directly into the installer. The repo’s supply-chain safe pattern says first-contact downloads must land on disk for validation before execution (`docs/security/SUPPLY-CHAIN-SAFE-PATTERNS.md:95-99`); rewrite this phase around a fetch/verify/install split or keep only the signed/pinned `nix run` style path.

## General comments

### @chatgpt-codex-connector (2026-05-27T06:02:59Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
