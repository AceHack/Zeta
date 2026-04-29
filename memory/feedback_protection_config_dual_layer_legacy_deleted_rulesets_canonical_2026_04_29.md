---
name: AceHack/Zeta protection config — legacy branch protection deleted, repository rulesets canonical (2026-04-29)
description: During 0/0/0 hard-reset on 2026-04-29, AceHack/Zeta was discovered to have BOTH legacy branch protection (`/repos/{owner}/{repo}/branches/main/protection`) AND repository rulesets (`/repos/{owner}/{repo}/rulesets`) configured on `main`. The two layers enforce independently, and GitHub's UI does not surface that they're separate. Per maintainer call 2026-04-29 (Aaron), legacy protection was DELETED and rulesets are now the canonical protection surface for AceHack/Zeta. Future protection-config changes go through rulesets only.
type: feedback
---

# AceHack/Zeta protection config — dual-layer surprise + decommission decision

## What happened (2026-04-29T14:00–14:05Z)

During the 0/0/0 hard-reset, `git push --force-with-lease` against AceHack/main was rejected with:

```
remote: error: GH013: Repository rule violations found for refs/heads/main.
remote: - Cannot force-push to this branch
```

After disabling the only ruleset (id=15524390 "Default", `enforcement: disabled`) and retrying, the push was rejected AGAIN with a **different error code**:

```
remote: error: GH006: Protected branch update failed for refs/heads/main.
remote: - Cannot force-push to this branch
```

That second rejection came from the **legacy branch protection layer** at `/repos/{owner}/{repo}/branches/main/protection` (with `allow_force_pushes: {enabled: false}`), which is a separate enforcement surface from the rulesets system.

## Aaron's confirmation

> *"GH006 (legacy branch protection). i might have had them both turned on"*
> *"I knew there were two but I was confused why, the UI does not make it clear one is legacy, their UI is confusing but I do remember setting it twice."*

So both layers had been configured at different times, both enforced together, and GitHub's UI does not visually surface that they coexist.

## Maintainer decision (2026-04-29)

> *"you could turn off both and leave the legacy off — when you turn back on, just turn back on the rulesets"*

Executed:

```bash
# Delete legacy branch protection (this removed the GH006 blocker)
gh api -X DELETE repos/AceHack/Zeta/branches/main/protection
# → success (rc=0, no body printed; GitHub returns 204 No Content)
# Subsequent verification GET returns 404 "Branch not protected":
#   gh api repos/AceHack/Zeta/branches/main/protection
#   → {"message":"Branch not protected", "status":"404"}

# Disable rulesets enforcement (--input - reads JSON body from stdin via heredoc)
gh api -X PUT repos/AceHack/Zeta/rulesets/15524390 --input - <<'EOF'
{"enforcement": "disabled"}
EOF

# The destructive force-push (now permitted)
git push --force-with-lease=refs/heads/main:OLD_SHA \
  acehack refs/remotes/origin/main:refs/heads/main

# Re-enable rulesets enforcement (same heredoc pattern)
gh api -X PUT repos/AceHack/Zeta/rulesets/15524390 --input - <<'EOF'
{"enforcement": "active"}
EOF
```

Note on `gh api --input`: it takes a FILE PATH, not inline JSON. Use `--input -` to read from stdin (then pipe / heredoc the JSON body in), or `--input path/to/file.json` for a file. Inline JSON via `--input '{...}'` is not supported syntax — `gh` would treat the JSON string as a filename and fail. Alternative: `-f key=value` for individual fields, or `-F` for typed fields.

Final config: rulesets active, legacy gone. Single source of truth for AceHack/Zeta branch policy.

## Error-code mapping (load-bearing for future debugging)

| GitHub error code | Source | Surface |
|---|---|---|
| `GH013` | Rulesets ("Repository rules") | `/repos/{owner}/{repo}/rulesets` |
| `GH006` | Classic / legacy branch protection | `/repos/{owner}/{repo}/branches/{branch}/protection` |

If a push gets rejected with one error code, disabling that layer alone does NOT guarantee the push will succeed — the OTHER layer may also be enforcing. Always check both surfaces when diagnosing protection-related rejection.

## How to detect both layers exist on a repo (script)

```bash
# Legacy branch protection
gh api repos/{owner}/{repo}/branches/{branch}/protection 2>&1 | head -3
# Returns full config OR "Branch not protected" (404)

# Repository rulesets
gh api repos/{owner}/{repo}/rulesets --jq '.[] | {id, name, enforcement, target}'
# Returns array of rulesets with enforcement state

# Status flag (high-level)
gh api repos/{owner}/{repo}/branches/{branch} --jq '.protected'
# true if EITHER layer is active; doesn't tell you which one
```

## Why this matters going forward

1. **Operational diagnosis**: future force-push or branch-policy issues should check BOTH surfaces. Don't trust `branch.protected` flag alone.
2. **Config drift**: future config changes must go through rulesets only; never re-create legacy branch protection on AceHack/Zeta.
3. **Cross-org applicability**: this is a GitHub-wide UI confusion (not specific to AceHack). Other repos in Lucent-Financial-Group / etc. might have the same dual-layer config. Worth checking on cadence.
4. **CLAUDE.md protocol verification**: CLAUDE.md says *"Force-push to AceHack main is part of the protocol"*. The rulesets `non_fast_forward` rule blocks this, which means **the rulesets config still doesn't match the documented protocol**. Either the protocol gets revised (no force-push, only sync via PR) or the ruleset's `non_fast_forward` rule needs a bypass-actor allowlist for the maintainer credential. task #275-adjacent ("Set up acehack-first development workflow") is the home for that decision.

## Composes with

- `memory/feedback_destructive_git_op_5_pre_flight_disciplines_codex_gemini_2026_04_28.md` — pre-flight disciplines for destructive git ops (force-push needs `--force-with-lease=ref:exact-old-sha`)
- `docs/active-trajectory.md` — 0/0/0 hard-reset gate spec + post-reset state
- task #275 (TaskList, pending: "Set up acehack-first development workflow") — protection-config protocol-vs-ruleset alignment goes under that lane. Note: distinct from PR numbers #305/etc. which are unrelated artifacts; this is the in-session TaskCreate/TaskList tracker.
- Aaron's standing visibility-constraint principle (don't change shared-production things he can't see) — satisfied here because Aaron is repo admin on AceHack/Zeta and the rulesets toggles are visible in the GitHub UI (even if confused by the dual-layer surface). The detailed memory for this principle currently lives in user-scope memory only (`~/.claude/projects/-Users-acehack-Documents-src-repos-Zeta/memory/feedback_aaron_visibility_constraint_no_changes_he_cant_see_2026_04_28.md`), not in-repo. (In-repo `memory/MEMORY.md` does not currently index the visibility-constraint principle; user-scope MEMORY.md does.) A future audit pass should backfill this principle to in-repo memory; tracked under task #291 (MEMORY.md index audit + backfill).
