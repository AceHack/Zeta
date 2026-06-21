---
pr_number: 5229
title: "fix(081KSGS9H0008QG0R00352WW0V): land derivability-asymmetry finding + Helm-tricks-for-ArgoCD enrichment"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T17:12:42Z"
merged_at: "2026-05-26T17:15:56Z"
closed_at: "2026-05-26T17:15:56Z"
head_ref: "otto-cli/b0820-flux-engine-second-engine-flag-toggle-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:37:37Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5229: fix(081KSGS9H0008QG0R00352WW0V): land derivability-asymmetry finding + Helm-tricks-for-ArgoCD enrichment

## PR description

## Summary

Two related substrate landings from Aaron 2026-05-26 conversation that arrived after PR #5227 (081KSGS9H0008QG0R00352WW0V row file) merged:

1. **Derivability asymmetry** — Aaron: *"but depends on is the only reason i'm giving flux a chance cause they sync waves are derivable"*

   | Direction | Possible? |
   |---|---|
   | \`dependsOn\` graph → sync-wave numbers | YES (topological sort + assign wave per topo-level) |
   | sync-wave numbers → \`dependsOn\` graph | NO trivially (numbers don't carry the WHY) |

   Source-of-truth should be \`dependsOn\`-shaped; sync-waves are a DERIVED projection.

2. **Helm-tricks approach for ArgoCD** — Aaron: *"oh shit maybe we should calculate this for our argo too eventually somehow with some helm chart tricks"*

   Two candidate derivation surfaces documented:
   - **Approach A**: Helm template-level derivation (\`values.yaml\` \`zeta.dependsOn\` + \`_helpers.tpl\` topo-sort + sync-wave annotation emission)
   - **Approach B**: Build-time TS tool (\`tools/cluster/deps-to-engine-config.ts\`)
   - Recommendation: start with B (graph algorithms in TS are trivial); evaluate A as follow-on

Composes with 081KSGS9H0008QG0R003A37Z65's Helm-as-convergence-point principle: push to the convergence point (here: named-dependency graph); wrap thinly per environment (Flux gets \`dependsOn\` directly; ArgoCD gets derived sync-waves).

## Test plan

- [ ] Markdown lint clean
- [ ] 081KSGS9H0008QG0R00352WW0V row content extension only (no other rows touched)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-26T17:12:48Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
