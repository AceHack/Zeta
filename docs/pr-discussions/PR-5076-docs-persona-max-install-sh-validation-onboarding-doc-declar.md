---
pr_number: 5076
title: "docs(persona/max): install.sh validation + onboarding doc + declarative soft-deps + tier-0 maintainer-owned dev/cluster substrate"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T03:21:41Z"
merged_at: "2026-05-26T03:23:58Z"
closed_at: "2026-05-26T03:23:58Z"
head_ref: "otto-cli/max-persona-install-onboarding-declarative-2026-05-25"
base_ref: "main"
archived_at: "2026-05-27T19:44:50Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5076: docs(persona/max): install.sh validation + onboarding doc + declarative soft-deps + tier-0 maintainer-owned dev/cluster substrate

## PR description

## Summary

Follow-up to PR #5074 (Max persona tier-2 Docker Desktop workstream). Adds four scope items Aaron surfaced across subsequent ticks:

1. **install.sh validation on a fresh-ish Mac** as bonus scope — running `tools/setup/install.sh` on Max's Mac IS substrate-engineering work, not just onboarding. Each gap surfaced gets a per-class disposition (real missing dep → manifest entry; implicit-system-state → doctor.sh detection; can't-be-automated → onboarding doc; slow/costly → opt-in env var). Composes with GOVERNANCE.md §24 + 081KSE6WT0008QG0R003G0Y62D first-time-CLI-user persona.

2. **New-dev onboarding documentation ownership** — Max owns `docs/ONBOARDING.md` (or operator-picked path) covering everything install.sh demonstrably can't automate. Aaron 2026-05-25: *"anything not in install.sh shold be called out for new devs like him so he own onboarding documentaiton too."*

3. **Declarative soft-dependency manifests for Mac-side substrate** — onboarding doc is NOT free-form prose; it's generated from declarative manifests parallel to existing brew/mise/uv-tools/dotnet-tools/verifiers manifests. New manifest classes: `dmgs/`, `oauth-flows/`, `manual-steps/`. Aaron 2026-05-25: *"we should still have declarative soft dependencies for dmgs just like we talked about with declarative nix for anytihng humans have to do on mac."*

4. **Per-dev-machine git-native state tracking under maintainers/<name>/ top-level partition** — tier-0 in the three-tier testing story. Aaron 2026-05-25: *"we should start dev machine tracking in git native too so we can track the current install deps we depend on and their status and stuff just like the prod cluster lol... so each dev machine has its own location too per maintiner and cluster are attached to mainiers too."* Hub-Link-Satellite per DV2.0 (one of the 5 always-active disciplines). Maintainer-as-top-level mirrors LFG co-ownership reality.

## Files changed

- `memory/max/PERSONA.md` — three new sub-sections under "Current focus": "Bonus scope — install.sh validation on a fresh-ish Mac" + "Bonus-bonus scope — new-dev onboarding documentation" (with "Declarative soft-dependencies" sub-section) + "Per-dev-machine git-native state tracking" (with maintainers/<name>/ top-level shape + DV2.0 mapping + migration story)
- `memory/max/STARTING-POINT.md` — promoted install.sh run to deliverable #1; added onboarding doc as #2 (now born declarative); added tier-0 maintainer-owned dev-machine substrate as #3; renumbered remaining items

Composes with PR #5074 (Max persona tier-2 workstream, merged at 5f9d60457).

## Test plan

- [x] markdownlint clean (both files; project config disables MD028/MD060 + memory/** ignored — IDE warnings are noise)
- [x] No new files (only edits to existing persona files)
- [x] Cross-references resolve (.claude/rules/dv2-data-split-discipline-activated.md, tools/setup/manifests/, tools/setup/install.sh, full-ai-cluster/nixos/hosts/, GOVERNANCE.md §24)
- [ ] CI passes (gate workflow + CodeQL)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-26T03:21:45Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
