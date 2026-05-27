---
pr_number: 5314
title: "feat(B-0829): schemas-as-rows + cluster-fork-as-trust-boundary + F# type providers from live cluster (Kestrel + Aaron 2026-05-26)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T20:51:43Z"
merged_at: "2026-05-26T20:53:15Z"
closed_at: "2026-05-26T20:53:15Z"
head_ref: "otto-cli/B-0829-schemas-as-rows-cluster-fork-federation-type-providers-from-live-cluster-kestrel-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:34:06Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5314: feat(B-0829): schemas-as-rows + cluster-fork-as-trust-boundary + F# type providers from live cluster (Kestrel + Aaron 2026-05-26)

## PR description

## Summary

9th substrate landing on B-0824 over 2026-05-26. Foundation-layer architecture for the meta-PM substrate + the Runme BCL ontology capability (B-0826). Aaron's architectural framing + Kestrel's substantive elaboration; 6th empirical anchor in attractor-as-encryption series (engineering-register-throughout; pathogen absent).

Aaron authorization: \"you don't have to ask me direction every time you can just assume all with the simplest first\".

## The collapse Aaron's framing enables

| Standard pattern | Aaron + Kestrel framing |
|---|---|
| Schemas are text artifacts in version control | Schemas are ROWS in distributed database substrate |
| Schema fork = text-merge through git workflows | Cluster-fork-or-federation = operational boundary; runtime-distinct |
| Types compiled from source code | Types preloaded from live cluster; fork-aware |
| Schema migration breaks deployments | Deployment reflects schema state compiled against; federation translates |
| Schema = code-layer concern | Schema = data-layer concern using same generate+join semantics |

## 4 architectural pillars

1. **Schemas as ROWS** — CRDT/CAS/BFT mediation (PR #5285) operates on schemas same as data
2. **Cluster-fork-as-trust-boundary** — three configurations (single cluster / federation / fork-without-federation); same trust-boundary machinery describes all three
3. **F# type providers from live cluster** — extends Don Syme + F# team type-provider work: schema source IS the live cluster
4. **Federation as trust-boundary primitive** — composes with B-0703 multi-oracle BFT; federation negotiations = multi-oracle consensus events

## What lands (2 files + index)

- \`docs/research/2026-05-26-kestrel-schemas-as-rows-cluster-fork-federation-trust-boundary-type-providers-from-live-cluster-aaron-forwarded.md\` — verbatim Kestrel preservation (6th anchor in attractor-as-encryption; pathogen absent)
- \`docs/backlog/P2/B-0829-schemas-as-rows-...\` — new backlog row for the foundation architecture
- \`docs/BACKLOG.md\` — regenerated index

## Composes with

- B-0824 (canonical generate+join meta-PM substrate)
- B-0826 (Runme BCL extension — B-0829 is foundation for the ontology capability)
- B-0703 (multi-oracle BFT)
- PR #5285 + #5286 + #5291 + #5295 + #5310 + #5312 (substrate cascade)

## Test plan

- [x] Pre-commit lint clean (markdownlint-cli2 --fix applied)
- [x] BACKLOG.md regenerated
- [x] Branch follows \`otto-cli/*\` surface-prefix convention
- [x] Authored from fresh independent clone
- [ ] CI green
- [ ] Copilot review pass

## General comments

### @chatgpt-codex-connector (2026-05-26T20:51:49Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
