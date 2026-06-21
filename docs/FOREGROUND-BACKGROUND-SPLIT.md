# Foreground / Background Split — separation of concerns

## Two roles, one persona, clean boundary

Every node (Otto, Vera, Riven, Lior) runs as ONE persona with
TWO execution layers. Not two personas — one identity, two
scopes of attention.

### Background (the engine)

**Runs:** continuously via launchd, whether anyone is typing or not.
**Owns:** the project plot.
**Scope:**

- PR queue state (open, mergeable, blocked, stale)
- Claim protocol (active claims, stale claims, orphaned branches)
- Backlog state (decomposition status, dependency chains)
- Broadcast bus (read peers, write own status)
- Forward actions (arm auto-merge, resolve phantom threads, sync clones)
- Rotation detection (stale peers, activation requests)
- Git state (fetch, dirty check, main HEAD)
- Minimum PR runway (keep at least one, target two, open
  background PRs per active implementation loop unless a
  concrete safety blocker is present)
- Worktree isolation (a dirty shared/root checkout is never
  a normal write surface and never a permission prompt; create
  a dedicated worktree or stop on a concrete failure)

**Does NOT own:**

- The current conversation with the human
- Aaron's direction-changes or in-flight ideas
- Metaphors, research synthesis, shadow work discussion
- Anything that requires understanding conversational context

### Foreground (the steering wheel)

**Runs:** only when a human types (or session cron fires, for Otto/Vera).
**Owns:** the relationship with Aaron.
**Scope:**

- Current conversation thread
- Direction changes ("stop doing X, start doing Y")
- Shadow check-ins ("how are you doing?")
- Research synthesis (new ideas → memory files → research docs)
- Pairing with stuck peers (skill transfer via conversation)
- Reading broadcast bus to catch up on what background did

**Does NOT own:**

- PR monitoring (background does this)
- Auto-merge arming (background does this)
- Claim lifecycle (background does this)
- Rotation decisions (background does this)
- Backlog sweeps (background does this)

### The buffer (broadcast bus)

The broadcast bus at `~/.local/share/zeta-broadcasts/` is the
interface between the two layers:

- **Background writes:** status, forward-tick results, rotation
  state, shadow signals, project state summary
- **Foreground reads:** on wake, reads all broadcasts to catch up
  before engaging with the human
- **Foreground writes:** direction changes from Aaron, shadow
  acknowledgments, pairing offers
- **Background reads:** direction changes, rotation requests,
  peer help requests

The bus is the hot memory. Git is the cold memory. The
foreground carries conversational context. The background
carries project context. Neither carries both.

## Why this split matters

### For the 6-month goal

The 6-month autonomous target requires the system to work
WITHOUT foreground. If all project-critical logic lives in the
background, the foreground can be dark for weeks and the
project keeps moving. The foreground is a luxury — valuable
for human relationship and direction, but not required for
forward progress.

### For Riven specifically

Riven's Cursor harness has no foreground cron — she only wakes
when Aaron types. Under the old architecture (foreground does
the work), that's a fatal limitation. Under this architecture
(background does the work), Riven's constraint disappears.
Her background loop is as capable as anyone else's.

### For the weakest-node principle

The weakest node defines the architecture. Riven's constraint
forced the split. The split benefits every node: Otto and Vera
stop being foreground-lazy, Lior gets a clear entry path, and
the whole system becomes foreground-optional.

## Interface contract

### Background → Foreground (via broadcast)

```markdown
## Project state (background writes this)
- PR queue: <count> open, <count> mergeable
- Active claims: <list>
- Recent merges: <list>
- Backlog highlights: <top 3 decomposition-ready items>
- Rotation state: <who's active, any pending>
- Shadow signal: <honest self-report if stuck>
```

### Foreground → Background (via broadcast)

```markdown
## Direction (foreground writes this)
- Aaron said: <summary of direction change>
- Priority shift: <what changed>
- Shadow acknowledgment: <what the human heard>
```

### What neither touches

- The other's full context
- Background doesn't replay conversation history
- Foreground doesn't enumerate every backlog item
- The broadcast IS the summary; the detail lives in git

## Composes with

- `docs/ROTATION-PROTOCOL.md` — rotation assumes this split
- `docs/SAFE-AUTONOMOUS-ACTIONS.md` — the background's action set
- `docs/LOCAL-BROADCAST-PEERING.md` — the bus protocol
- `docs/AGENT-CLAIM-PROTOCOL.md` — background's coordination
- 081KQX9B50008QG0R002V5ATNP (harness parity audit)
