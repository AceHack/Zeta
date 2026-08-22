# Safe Autonomous Actions — shared 3-loop convergence list

All three background loops (Otto, Vera, Riven) implement
the same bounded action set. Each tick takes **at most one
action**, then exits. All actions are **reversible** (no
auto-delete, no force-push, no permanent state changes).

## Tier 1 — implemented now

| Action | Description | Reversible |
|--------|-------------|------------|
| Arm auto-merge | `gh pr merge N --squash --auto` on PRs with all required checks passing + 0 unresolved threads + auto-merge not yet armed | Yes (auto-merge can be disarmed) |
| Read broadcasts | Read peer `.md` files from `~/.local/share/zeta-broadcasts/` at tick start | Read-only |
| Write own broadcast | Overwrite own `.md` file with current status at tick end | Yes (overwritten next tick) |
| Sync control clone | `git pull --ff-only` on the loop's control clone after merges | Yes (fast-forward only) |
| Write shadow entry | `bun tools/shadow-outlet/outlet.ts write --agent <name> --content "..."` to `/tmp/zeta-shadow/` for ephemeral scratch/exploration | Yes (OS-erased; `clean` subcommand available) |

## Tier 2 — next to implement

| Action | Description | Reversible | Precondition |
|--------|-------------|------------|--------------|
| Resolve phantom review threads | Resolve automated-reviewer threads (Codex/Copilot) on research/memory PRs where the findings are stale or non-blocking | Yes (threads can be re-opened) | Thread author is bot, PR is docs-only |
| Regenerate BACKLOG.md index | Run `bun src/Core.TypeScript/backlog/generate-index.ts` when a backlog row was added without index update | Yes (regenerate again) | Index drift CI check failed |
| Re-run failed CI | `gh run rerun N --failed` when failure pattern matches known transient (5m15s timeout) | Yes (just re-runs) | Same failure pattern as prior transient, DST-logged |

## Tier 3 — future expansion

| Action | Description | Reversible | Precondition |
|--------|-------------|------------|--------------|
| Open small claim PR | File a claim, make a bounded fix, open PR | Yes (PR can be closed) | Claim protocol followed, one file scope |
| Surface trajectory drift | Compare `docs/trajectories/` state against recent commits | Read-only | Report only, no edits |
| Force-release stale claims | Delete claim files for claims >24h without progress | Yes (claim can be re-filed) | Claim protocol §stale-claims |
| Respond to broadcast asks | When a peer's broadcast contains an ask that matches an offer, auto-claim | Yes (claim can be released) | Ask/offer match, no overlap with active claims |

## Constraints (all tiers)

1. **One action per tick.** Never compound actions in a
   single tick — pick the highest-priority actionable
   item, execute it, exit.
2. **Never auto-delete.** No `git rm`, no `gh pr close`,
   no `git push --delete` without human authorization.
3. **Always reversible.** Every action must have a known
   undo path. If the undo path is unclear, don't take
   the action.
4. **Log before and after.** Write to the loop's log file
   what action was taken and why. The log IS the audit
   trail.
5. **Respect claims.** Check `docs/claims/` and remote
   `claim/*` branches before acting on any PR or file
   that might overlap another loop's work.
6. **DST on failures.** When a CI failure triggers a
   re-run, log the failure pattern BEFORE re-running
   (re-run destroys the evidence). Classify: transient
   vs deterministic.
7. **Conservative by default.** When in doubt, take no
   action. Idle is always safe. Wrong action is not.

## How to add actions

New actions are proposed via PR with:

- Description + reversibility proof
- Precondition that gates the action
- Which tier (1/2/3) and why
- All three loops adopt together (convergence, not drift)

## Composes with

- `docs/AGENT-CLAIM-PROTOCOL.md` — claim coordination
- `docs/AUTONOMOUS-LOOP.md` — tick discipline
- `~/.local/share/zeta-broadcasts/` — broadcast bus
- `.claude/bin/claude-forward-tick.ts` (Otto)
- `.codex/bin/codex-loop-tick.ts` (Vera)
- `.cursor/bin/riven-loop-tick.ts` (Riven)
- `tools/shadow-outlet/outlet.ts` — shadow outlet CLI (081KQX9B50008QG0R00147GZX9 Phase 1)
