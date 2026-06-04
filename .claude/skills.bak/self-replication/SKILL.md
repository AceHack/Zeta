---
name: self-replication
description: Agent persistence — OS detect, service worktree, tick deploy, daemon register, heartbeat verify, SSH remote replication.
when-to-wear: When setting up a new machine as a factory node, when replicating to a remote machine via SSH, when recovering a broken background service, or when upgrading an existing service to the latest tick script.
---

# Self-Replication — Make the Agent Persistent

The skill that makes the factory portable. Clone the repo,
invoke this skill, the agent persists on the new machine.

## When to wear

- Setting up a new machine (Mac, Windows, Linux) as a factory node
- Replicating to a remote machine via SSH
- Recovering a broken or stale background service
- Upgrading an existing service to the latest tick script

## Procedure

### Phase 1: Detect environment

```bash
# What OS?
uname -s  # Darwin = macOS, Linux = Linux
# Windows: check via PowerShell
# $env:OS  # Windows_NT

# What's available?
which bun git dotnet claude gh
```

Map the results:

| OS | Service manager | Tick config |
|---|---|---|
| macOS | launchd (plist) | ~/Library/LaunchAgents/ |
| Windows | Task Scheduler | schtasks / Register-ScheduledTask |
| Linux | systemd (unit file) | ~/.config/systemd/user/ |

### Phase 2: Create service worktree

```bash
# Dedicated clone — NOT the interactive checkout
LOOP_DIR="$HOME/.local/share/zeta-claude-loop/Zeta"
git clone https://github.com/Lucent-Financial-Group/Zeta.git "$LOOP_DIR"
cd "$LOOP_DIR"
dotnet build -c Release  # verify build gate
```

### Phase 3: Deploy tick script

The tick script lives at `.claude/bin/claude-loop-tick.ts`
in the repo. Key settings:

- Interval: 60s (work every tick)
- Timeout: 600s (10 min per work cycle)
- `git reset --hard origin/main` after fetch (stay current)
- `autonomous-pickup.ts` for item selection
- `-w` flag for worktree isolation
- `--permission-mode auto` for non-interactive

### Phase 4: Register background service

#### macOS (launchd)

```bash
cat > ~/Library/LaunchAgents/com.zeta.claude-loop.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>com.zeta.claude-loop</string>
    <key>ProgramArguments</key><array>
        <string>/opt/homebrew/bin/bun</string>
        <string>LOOP_DIR/.claude/bin/claude-loop-tick.ts</string>
    </array>
    <key>StartInterval</key><integer>60</integer>
    <key>RunAtLoad</key><true/>
    <key>StandardOutPath</key>
      <string>HOME/Library/Logs/zeta-claude-loop/stdout.log</string>
    <key>StandardErrorPath</key>
      <string>HOME/Library/Logs/zeta-claude-loop/stderr.log</string>
    <key>EnvironmentVariables</key><dict>
        <key>HOME</key><string>HOME</string>
        <key>ZETA_CLAUDE_LOOP_RUN_CLAUDE</key><string>1</string>
    </dict>
</dict>
</plist>
EOF

# Replace placeholders
sed -i '' "s|LOOP_DIR|$LOOP_DIR|g; s|HOME|$HOME|g" \
  ~/Library/LaunchAgents/com.zeta.claude-loop.plist

# Create log directory
mkdir -p ~/Library/Logs/zeta-claude-loop

# Register
launchctl bootstrap gui/$(id -u) \
  ~/Library/LaunchAgents/com.zeta.claude-loop.plist
```

#### Windows (Task Scheduler)

```powershell
$action = New-ScheduledTaskAction `
    -Execute "bun" `
    -Argument ".claude/bin/claude-loop-tick.ts" `
    -WorkingDirectory "$env:USERPROFILE\.local\share\zeta-claude-loop\Zeta"

$trigger = New-ScheduledTaskTrigger `
    -RepetitionInterval (New-TimeSpan -Seconds 60) `
    -Once -At (Get-Date)

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable

Register-ScheduledTask `
    -TaskName "ZetaClaudeLoop" `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -RunLevel Highest
```

#### Linux (systemd user unit)

```bash
mkdir -p ~/.config/systemd/user

cat > ~/.config/systemd/user/zeta-claude-loop.service << EOF
[Unit]
Description=Zeta Claude Loop

[Service]
ExecStart=/usr/bin/bun $LOOP_DIR/.claude/bin/claude-loop-tick.ts
WorkingDirectory=$LOOP_DIR
Restart=always
RestartSec=60

[Install]
WantedBy=default.target
EOF

systemctl --user enable zeta-claude-loop
systemctl --user start zeta-claude-loop
```

### Phase 5: Verify heartbeat

```bash
# Wait 2 minutes then check
tail -5 ~/Library/Logs/zeta-claude-loop/runner.log  # macOS
# or
journalctl --user -u zeta-claude-loop -n 5           # Linux

# Should show:
# heartbeat complete run_id=... fetch=ok claims=N open_prs=N
# claude work cycle start run_id=... mode=pickup open_prs=0
# pickup selected: B-NNNN action=claim-and-implement
```

### Phase 6: Remote replication via SSH

```bash
# From the controller machine:
ssh <user>@<target-ip>

# Then run Phase 1-5 on the remote machine
# Or script it:
ssh <user>@<target-ip> 'bash -s' << 'REMOTE'
  git clone https://github.com/Lucent-Financial-Group/Zeta.git \
    ~/.local/share/zeta-claude-loop/Zeta
  cd ~/.local/share/zeta-claude-loop/Zeta
  dotnet build -c Release
  # ... register service per OS
REMOTE
```

## Scope boundaries

- Dev laptops are sandboxes — act, don't ask
- Production access requires explicit timeboxed permission
- Corporate boundaries respected by the book
- Use the machine owner's credentials and auth flow

## Verification checklist

- [ ] `launchctl list | grep zeta` (or equivalent) shows the service
- [ ] `runner.log` shows heartbeats every 60s
- [ ] Work cycles fire (pickup or drain)
- [ ] PRs appear on GitHub from the new node
- [ ] `git status` in the service worktree is clean after reset

## Failure recovery

| Symptom | Fix |
|---|---|
| No heartbeats | Check service registration, restart |
| `fetch=exit-1` | Network issue, will self-recover |
| Stale lock | `rm -rf "APP_SUPPORT_DIR/lock"` |
| `status=143` every cycle | Item too large, mark as blob |
| Dirty worktree | `git reset --hard origin/main` in service worktree |

## What this skill does NOT do

- Does not configure IDE/editor integration (that's developer-experience-engineer)
- Does not set up the foreground interactive session (that's the harness itself)
- Does not manage SSH keys (that's the security-operations-engineer hat)
- Does not choose which backlog items to work on (that's autonomous-pickup.ts)

## Adapting for other harnesses

The tick script and service registration pattern is the same
for any harness. Replace `claude -p --permission-mode auto`
with the harness equivalent:

| Harness | Non-interactive command |
|---|---|
| Claude Code | `claude -p -w --permission-mode auto` |
| Cursor | `cursor-agent -p --model grok-4.3` |
| Codex | codex CLI equivalent |

The rest (launchd/systemd/Task Scheduler, worktree, heartbeat)
is identical across harnesses.
