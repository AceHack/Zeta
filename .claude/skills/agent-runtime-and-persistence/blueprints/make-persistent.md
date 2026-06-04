---
name: make-persistent
description: Install persistent agent service — OS detection, service worktree, tick script, registration, heartbeat verification.
when-to-wear: When setting up persistence on the current machine, recovering a broken service, or upgrading an existing service.
---

# Make Persistent — Local Agent Persistence

Makes the current agent persistent on THIS machine. No
SSH required. The primitive that `replicate` composes.

## When to wear

- First boot on a new machine — make yourself stay
- Recovering a broken or stale background service
- Upgrading an existing service to the latest tick script
- After a crash that killed the service registration

## Phase 1: Detect environment

```bash
uname -s  # Darwin = macOS, Linux = Linux
# Windows: $env:OS = Windows_NT
which bun git dotnet claude gh
```

| OS | Service manager | Config location |
|---|---|---|
| macOS | launchd (plist) | ~/Library/LaunchAgents/ |
| Windows | Task Scheduler | Register-ScheduledTask |
| Linux | systemd (user unit) | ~/.config/systemd/user/ |

## Phase 2: Create service worktree

```bash
LOOP_DIR="$HOME/.local/share/zeta-claude-loop/Zeta"
BUN_PATH="$(which bun)"
if [ -d "$LOOP_DIR/.git" ]; then
  cd "$LOOP_DIR" && git fetch origin && git reset --hard origin/main
else
  git clone https://github.com/Lucent-Financial-Group/Zeta.git "$LOOP_DIR"
  cd "$LOOP_DIR"
fi
dotnet build -c Release
```

## Phase 3: Deploy tick script

Key settings in `.claude/bin/claude-loop-tick.ts`:

- Interval: 60s
- Timeout: 600s
- `git reset --hard origin/main` after fetch
- `autonomous-pickup.ts` for item selection
- `-w` flag for worktree isolation
- `--permission-mode auto` for non-interactive

## Phase 4: Register background service

### macOS

```bash
BUN_PATH="$(which bun)"
cat > ~/Library/LaunchAgents/com.zeta.claude-loop.plist << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>com.zeta.claude-loop</string>
    <key>ProgramArguments</key><array>
        <string>BUN_PATH</string>
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
        <key>ZETA_CLAUDE_LOOP_MODEL</key><string>sonnet</string>
    </dict>
</dict>
</plist>
PLIST

sed -i '' "s|BUN_PATH|$BUN_PATH|g; s|LOOP_DIR|$LOOP_DIR|g; s|HOME|$HOME|g" \
  ~/Library/LaunchAgents/com.zeta.claude-loop.plist
mkdir -p ~/Library/Logs/zeta-claude-loop
launchctl bootstrap gui/$(id -u) \
  ~/Library/LaunchAgents/com.zeta.claude-loop.plist
```

### Windows

```powershell
[System.Environment]::SetEnvironmentVariable(
    "ZETA_CLAUDE_LOOP_RUN_CLAUDE", "1", "User")
$action = New-ScheduledTaskAction `
    -Execute "bun" `
    -Argument ".claude/bin/claude-loop-tick.ts" `
    -WorkingDirectory "$env:USERPROFILE\.local\share\zeta-claude-loop\Zeta"
$trigger = New-ScheduledTaskTrigger `
    -RepetitionInterval (New-TimeSpan -Seconds 60) `
    -Once -At (Get-Date)
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -StartWhenAvailable
Register-ScheduledTask -TaskName "ZetaClaudeLoop" `
    -Action $action -Trigger $trigger `
    -Settings $settings -RunLevel Highest
```

### Linux

```bash
mkdir -p ~/.config/systemd/user
BUN_PATH="$(which bun)"
LOOP_DIR="$HOME/.local/share/zeta-claude-loop/Zeta"
cat > ~/.config/systemd/user/zeta-claude-loop.service << EOF
[Unit]
Description=Zeta Claude Loop
[Service]
Environment=ZETA_CLAUDE_LOOP_RUN_CLAUDE=1
ExecStart=$BUN_PATH $LOOP_DIR/.claude/bin/claude-loop-tick.ts
WorkingDirectory=$LOOP_DIR
Restart=always
RestartSec=60
[Install]
WantedBy=default.target
EOF
systemctl --user enable --now zeta-claude-loop
```

## Phase 5: Verify heartbeat

```bash
# Wait 2 minutes then check
tail -5 ~/Library/Logs/zeta-claude-loop/runner.log
# Should show:
# heartbeat complete ... fetch=ok
# claude work cycle start ... mode=pickup
# pickup selected: B-NNNN action=claim-and-implement
```

## Scope boundaries

- Dev laptops are sandboxes — act, don't ask
- Prod requires explicit timeboxed permission

## Failure recovery

| Symptom | Fix |
|---|---|
| No heartbeats | Restart service |
| Stale lock | `rm -rf` the lock directory |
| `status=143` every cycle | Item too large, mark as blob |
| Dirty worktree | `git reset --hard origin/main` |

## What this skill does NOT do

- Remote replication (that's `replicate`)
- SSH key management (that's `security-operations-engineer`)
- IDE setup (that's `developer-experience-engineer`)
- Backlog selection (that's `autonomous-pickup.ts`)

## Harness adaption

| Harness | Command |
|---|---|
| Claude Code | `claude -p -w --permission-mode auto` |
| Cursor | `cursor-agent -p --model grok-4.3` |
| Codex | codex CLI equivalent |
