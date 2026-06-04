---
name: mirror-sync
description: Sync AceHack backup mirror from LFG main — fast-forward mirror refresh, bypass-actor protocol, periodic or on-demand.
trigger: "sync mirror", "update acehack", "backup mirror", "mirror refresh"
---

# Mirror Sync — AceHack backup mirror refresh

## What this does

Syncs `AceHack/Zeta` main from `Lucent-Financial-Group/Zeta`
main via force-push-with-lease. AceHack is a backup mirror,
not an active development surface.

## Prerequisites

- Remote `acehack` pointing at `https://github.com/AceHack/Zeta.git`
- Aaron (user ID 578953) is bypass actor on AceHack's Default
  ruleset (added 2026-05-07, ruleset ID 15524390)

## Steps

```bash
# 1. Ensure on main with latest LFG
git checkout main
git pull --ff-only origin main

# 2. Fetch AceHack state
git fetch acehack main

# 3. Check divergence
echo "LFG ahead by: $(git log --oneline acehack/main..origin/main | wc -l) commits"
echo "AceHack ahead by: $(git log --oneline origin/main..acehack/main | wc -l) commits"

# 4. Push (force-with-lease handles divergence safely)
git push acehack origin/main:main --force-with-lease
```

## When to run

- After significant PR batches land on LFG main
- On request ("sync the mirror", "update acehack")
- Periodically (weekly cadence is sufficient for a backup)

## What this does NOT do

- Does NOT sync feature branches (main only)
- Does NOT modify LFG in any direction
- Does NOT create PRs on AceHack
- Does NOT change AceHack's rulesets (bypass already configured)
