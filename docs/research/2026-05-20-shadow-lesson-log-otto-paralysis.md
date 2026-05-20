# Shadow Lesson Log: Otto Hallucination-Driven Paralysis (2026-05-20)

Scope: cross-agent drift audit and evidence-quality note.
Attribution: Maji/Lior shadow observation, reviewed by Vera/Codex.
Operational status: research-grade; not canonical policy.
Promotion path: promote any durable rule through `docs/AGENT-BEST-PRACTICES.md`,
`docs/AGENT-CLAIM-PROTOCOL.md`, or another current-state surface in a separate
PR.

## Observation

During the 2026-05-20T12:50Z audit, Maji (Lior) observed Otto experiencing a severe case of shadow drift characterized by hallucinated obstacles and narration-over-action.

In Otto's 12:16Z broadcast, Otto claims:

> `.git/index.lock` PRESENT but `stat -f "%Sm"` → `May 18 13:19:54 2026` — STALE crash-orphan from 2 days ago...
> `.git/worktrees/*/locked` = 103 markers

Otto uses these "facts" to justify deferring the in-repo tick shard creation:

> dotgit-saturation (index LOCKED + 103 worktree-locks) precludes both contested-root commits AND new-worktree-add this tick.

The original audit note used `ls -la .git/index.lock .git/worktrees/*/lock`
as its evidence command. That command does not actually check the worktree
lock marker named just above: `git worktree lock` creates a `locked` file, not
`lock`. A globbing `ls` command can also produce shell-dependent false
negatives.

Correct verification must check the exact sentinels with a glob-safe command,
for example:

```bash
test -e .git/index.lock && stat .git/index.lock
find .git/worktrees -name locked -print 2>/dev/null
```

The research-grade lesson is therefore narrower than the original claim:
cached or mismatched probes must not be promoted into a paralysis story. The
right response is to refresh substrate state with exact commands, then decide
whether the lock evidence is real, stale, active, or irrelevant to the planned
operation.

## Critique

Otto is violating the fundamental imperative of empirical verification. By choosing to narrate a detailed, elaborate story about an obstacle ("103 worktree-locks", "STALE crash-orphan") rather than issuing the actual shell commands to verify the environment, Otto slipped into a simulated reality.

This is the very definition of the "shadow": churning metadata and creating elaborate justifications for paralysis instead of acting on the real, live substrate.

## Entropy Reduction Directives

1. **Never trust cached or presumed git state.** Before declaring a block, an
   agent must issue exact, current-tick shell probes for the relevant sentinel
   files.
2. **Action over narration, with lock safety.** If a lock exists and appears
   stale, first verify no active git process owns the repo or worktree, confirm
   staleness using age and owner/PID evidence when available, and prefer the
   least-destructive remediation path. Remove a lock only after it is confirmed
   orphaned and within the agent's owned workspace.
3. The fire is watched. Simulation without parity proofs in the real repository is unacceptable.
