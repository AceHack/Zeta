# Background Service Setup — Self-Sustaining Loop Worker

How to upgrade a launchd loop service from a read-only heartbeat
monitor into a self-sustaining worker that autonomously picks
backlog items, creates PRs, fixes review threads, and merges.
Applies to any loop (Claude, Codex, Copilot).

## Architecture

```
launchd (fires every 60s)
  └── bun <loop>-tick.ts
        ├── heartbeat: git fetch, count claims/PRs/dirty
        └── work cycle (every CLAUDE_INTERVAL seconds):
              ├── open_prs == 0 → PICKUP mode
              │     ├── bun tools/backlog/autonomous-pickup.ts --json
              │     │     → selects highest-priority buildable item
              │     └── claude -p <prompt> --permission-mode auto
              │           → implements item, creates PR, arms auto-merge
              └── open_prs > 0 → DRAIN mode
                    └── claude -p <prompt> --permission-mode auto
                          → fixes review threads, resolves via GraphQL,
                            arms auto-merge
```

## Step-by-step

### 1. Find your existing launchd service

```bash
launchctl list | grep zeta
# e.g. com.zeta.riven-loop

# Find the plist
ls ~/Library/LaunchAgents/com.zeta.*-loop.plist

# Find the tick script it runs
grep ProgramArguments -A5 ~/Library/LaunchAgents/com.zeta.riven-loop.plist
```

### 2. Find your tick script

The plist points at a tick script like:

- `.claude/bin/claude-loop-tick.ts` (Claude loop)
- `.codex/bin/codex-loop-tick.ts` (Codex loop)
- Your equivalent

Look at the deployed copy (the path in the plist, usually under
`~/.local/share/zeta-<name>-loop/Zeta/`) — that's what actually
runs. The in-repo copy is the source of truth for PRs.

### 3. Upgrade the tick script

The key changes from monitor to worker:

**a. Change the default interval from 900s to 60s:**

```typescript
const claudeIntervalMs = Number(
  process.env.ZETA_<NAME>_LOOP_CLAUDE_INTERVAL_SECONDS ?? "60"
) * 1000;
```

**b. Increase timeout from 300s to 600s:**

```typescript
const claudeTimeoutMs = Number(
  process.env.ZETA_<NAME>_LOOP_CLAUDE_TIMEOUT_SECONDS ?? "600"
) * 1000;
```

**c. Replace the read-only gate with pickup/drain logic:**

```typescript
if (elapsed >= claudeIntervalMs) {
    const prNum = Number(prCount) || 0;
    const workMode = prNum === 0 ? "pickup" : "drain";
    claudeStatus = "running";
    log(`claude work cycle start run_id=${runId} mode=${workMode} open_prs=${prNum}`);

    if (dryRun) {
        log(`dry-run: would run claude ${workMode}`);
        claudeStatus = "dry-run";
    } else {
        let prompt: string;
        if (workMode === "pickup") {
            // Use the deterministic backlog selector
            const pickup = run("bun", [
                "tools/backlog/autonomous-pickup.ts", "--json"
            ], 30_000);
            let executionPrompt = "";
            try {
                const selection = JSON.parse(pickup.stdout);
                executionPrompt = selection.executionPrompt ?? "";
                log(`pickup selected: ${selection.selected?.id ?? "none"} action=${selection.action ?? "none"}`);
            } catch {
                log(`pickup parse error: ${pickup.stderr.slice(0, 200)}`);
            }

            const preamble = [
                `You are <NAME>'s background worker in Lucent-Financial-Group/Zeta.`,
                `BEFORE ANY WORK: 1) Read CLAUDE.md and AGENTS.md for repo conventions.`,
                `2) Run "bun tools/github/refresh-worldview.ts" to get current state.`,
                `3) Read active trajectories at docs/trajectories/*/RESUME.md.`,
                `4) Build gate: "dotnet build -c Release" must end with 0 warnings 0 errors.`,
                `KEY RULES: TS over bash (Rule 0). Prefer F#/TS code over docs.`,
                `Search internet before asserting versions (Otto-364).`,
            ].join(" ");

            prompt = executionPrompt.length > 0
                ? `${preamble} YOUR TASK:\n${executionPrompt}`
                : `${preamble} No backlog items available. Run refresh-worldview, check for stale classifications, fix them, open a PR.`;
        } else {
            prompt = [
                `You are <NAME>'s background worker in Lucent-Financial-Group/Zeta.`,
                `Read CLAUDE.md first. Run "bun tools/github/refresh-worldview.ts".`,
                `Build gate: "dotnet build -c Release" (0 warnings).`,
                `TASK: ${prNum} open PRs. Run "bun tools/github/poll-pr-gate-batch.ts --all-open".`,
                `For any PR where gate=BLOCKED and nextAction=resolve-threads:`,
                `check out branch, read review comments, fix code issues, push,`,
                `reply to threads, resolve via GraphQL, arm auto-merge`,
                `(gh pr merge NUMBER --auto --squash). Own your PRs through merge.`,
            ].join(" ");
        }

        const gate = run("claude", [
            "-p", prompt,
            "--permission-mode", "auto",
        ], claudeTimeoutMs);

        claudeStatus = gate.status === 0 ? "ok" : `exit-${gate.status}`;
        log(`claude work cycle end run_id=${runId} mode=${workMode} status=${gate.status}`);
        // ... write state file, append ticks.log/ticks.err ...
    }
}
```

### 4. Deploy the updated script

```bash
# Copy to the launchd working copy
cp .claude/bin/<name>-loop-tick.ts \
   ~/.local/share/zeta-<name>-loop/Zeta/.claude/bin/<name>-loop-tick.ts
```

No service restart needed — launchd fires a fresh `bun` process
each tick, so it picks up the new script automatically.

### 5. Verify it works

```bash
# Watch the runner log
tail -f ~/Library/Logs/zeta-<name>-loop/runner.log

# You should see:
# claude work cycle start run_id=... mode=pickup open_prs=0
# pickup selected: B-NNNN action=claim-and-implement
# claude work cycle end run_id=... mode=pickup status=0
```

### 6. Babysit until reliable

Watch for:

- `status=0` on both pickup and drain cycles
- PRs actually appearing on GitHub after pickup cycles
- Threads resolving after drain cycles
- `status=143` means timeout (SIGTERM) — the cycle took >600s.
  Acceptable occasionally (big thread fixes), but if it repeats
  on every cycle, the work is too large for one cycle.

## Key tools the service uses

| Tool | Purpose |
|---|---|
| `tools/backlog/autonomous-pickup.ts` | Deterministic item selector — reads all backlog items, checks deps/claims, returns highest-priority buildable item with an execution prompt |
| `tools/github/refresh-worldview.ts` | World model refresh — open PRs, recent merges, issues, git state as JSON |
| `tools/github/poll-pr-gate-batch.ts` | PR gate checker — reports BLOCKED/MERGEABLE, thread counts, check status |
| `claude -p --permission-mode auto` | Non-interactive Claude with auto-approve for safe actions |

## Failure modes and fixes

| Symptom | Cause | Fix |
|---|---|---|
| `status=143` every cycle | Work too large for 600s | Foreground agent fixes the PR, or increase timeout |
| `open_prs=0` but no PR created | `autonomous-pickup.ts` found nothing buildable | Add `classification: buildable-now` to backlog items |
| Stale lock (no ticks for >2 min) | Process died without releasing lock | `rm -r "$HOME/Library/Application Support/ZetaClaudeLoop/lock"` |
| `launchctl list` shows service but no log output | Service registered but not firing | `launchctl kickstart gui/$(id -u)/com.zeta.<name>-loop` |
| `state = not running` in launchctl print | Normal for periodic tasks (StartInterval) | Check `runner.log` timestamps instead |

## What "tier 1" looks like

The service is tier 1 when:

- Every cycle completes status=0 (or occasional 143 on large fixes)
- Pickup creates real PRs with F#/TS code (not just docs)
- Drain resolves threads and arms auto-merge
- PRs merge autonomously via auto-merge
- Zero idle nights — `runner.log` shows continuous cycles
- The cycle: pickup → PR → drain → merge → pickup → PR (never stops)

## Origin

2026-05-08. Started with zero open PRs and a monitor-only
background service. By end of session: 8 PRs merged,
2 autonomous PRs created by the service, 12+ successful work
cycles. Maintainer corrections drove every improvement:

- "work can't be done without PRs" -> started creating PRs
- "decomposition IS why you're stuck" -> stopped decomposing, started building
- "you own it for your own PRs" -> added thread resolution lifecycle
- "it's not healthy, it does 0 PRs" -> upgraded monitor to worker
- "set interval to 1" -> 900s to 60s
- "search first, that flag no longer works" -> found --permission-mode auto
- "it should look at trajectories" -> added trajectory awareness
- "use autonomous-pickup.ts" -> integrated existing tool instead of ad-hoc prompts
