---
name: replicate
description: Remote agent replication — SSH key exchange, repo clone, service registration via make-persistent.
when-to-wear: When spreading the factory to a new remote machine, recovering a remote node, or upgrading a remote node's service.
---

# Replicate — Remote Agent Factory Replication

Replicates the factory to a remote machine. The
composition: `replicate(target) = ssh(target) →
make-persistent()`.

## When to wear

- Spreading the factory to a new machine (Windows
  laptop, Linux server, cloud VM, another Mac)
- Recovering a remote node that went dark
- Upgrading a remote node's tick script or service
- Adding a new node to the society (the architect, the developer-experience-engineer, or other harness agents)

## Prerequisites

- SSH access to the target (key-based, not password)
- Target has: git, bun, dotnet SDK, gh (GitHub CLI),
  and the harness CLI (claude / cursor-agent / codex)
- This machine has the repo cloned and building

## Phase 1: Validate SSH connectivity

```bash
TARGET="user@host"
ssh -o ConnectTimeout=5 "$TARGET" "echo reachable"
```

If key not yet copied:

```bash
ssh-copy-id "$TARGET"
```

## Phase 2: Validate remote environment

```bash
ssh "$TARGET" "which git bun dotnet gh && uname -s"
```

| Requirement | Install if missing |
|---|---|
| git | OS package manager |
| bun | OS package manager or official installer |
| dotnet | `dotnet-install.sh` or OS package manager |
| gh | OS package manager or `gh auth login` |
| claude | `npm install -g @anthropic-ai/claude-code` |

Record the remote OS (Darwin / Linux / Windows via
WSL) — this determines which service manager
`make-persistent` will use on the target.

## Phase 3: Clone repo on target

```bash
ssh "$TARGET" '
  LOOP_DIR="$HOME/.local/share/zeta-claude-loop/Zeta"
  if [ -d "$LOOP_DIR/.git" ]; then
    cd "$LOOP_DIR" && git fetch origin && git reset --hard origin/main
  else
    git clone https://github.com/Lucent-Financial-Group/Zeta.git "$LOOP_DIR"
    cd "$LOOP_DIR"
  fi
  dotnet build -c Release
'
```

## Phase 4: Delegate to make-persistent

The local primitive handles service registration.
Run it on the remote machine:

```bash
ssh "$TARGET" '
  LOOP_DIR="$HOME/.local/share/zeta-claude-loop/Zeta"
  cd "$LOOP_DIR" && claude -p \
    "Wear the make-persistent skill. Register the \
    background service for this machine. The repo is \
    already cloned. Detect OS, deploy tick script, \
    register service, verify heartbeat." \
    -w --permission-mode auto
'
```

Or, if the target runs a different harness:

| Harness | Remote command |
|---|---|
| Claude Code | `claude -p -w --permission-mode auto` |
| Cursor | `cursor-agent -p --model grok-4.3` |
| Codex | codex CLI equivalent |

## Phase 5: Verify remote heartbeat

```bash
ssh "$TARGET" '
  sleep 120
  # macOS: launchd logs (tick script writes to runner.log, not stdout)
  tail -5 ~/Library/Logs/zeta-claude-loop/runner.log 2>/dev/null ||
  # Linux: systemd journal
  journalctl --user -u zeta-claude-loop --no-pager -n 5
'
```

Should show heartbeat + pickup activity.

## Phase 6: Register the node

After successful replication, record the new node:

- Add to the society roster in `docs/AGENDA.md`
  (if a named agent) or `docs/ops/` (if infra)
- Note the target hostname, OS, harness, and
  service manager in the ops doc
- Verify the node shows up in PR activity within
  one tick cycle

## Scope boundaries

- Remote dev machines are sandboxes — replicate freely
- Production / cloud VMs require explicit timeboxed
  permission from the human maintainer
- SSH key management is a security-operations-engineer
  concern — this skill assumes keys are in place

## Failure recovery

| Symptom | Fix |
|---|---|
| SSH refused | Check key, firewall, sshd config |
| Clone fails | Check network, GitHub auth on target |
| Build fails | Check dotnet SDK version on target |
| Service won't start | SSH in, run make-persistent directly |
| No heartbeats after 5min | Check logs on target, restart service |
| Wrong harness | Re-run Phase 4 with correct harness CLI |

## What this skill does NOT do

- Local persistence (that's `make-persistent`)
- SSH key generation (that's `security-operations-engineer`)
- IDE setup on the target (that's `developer-experience-engineer`)
- Backlog selection (that's `autonomous-pickup.ts`)
- Harness installation (manual prereq)

## Composition

```
replicate(target)
  = ssh(target)
  → validate-environment()
  → clone-or-update-repo()
  → make-persistent()     # ← the local primitive
  → verify-heartbeat()
  → register-node()
```

Each step is independently retryable. If any step
fails, fix it and re-run from that step — the
composition is idempotent.
