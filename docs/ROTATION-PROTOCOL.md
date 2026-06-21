# Rotation Protocol — 4 nodes, 3 active, f=1 with hot spare

## The shape

4 background loops run continuously via launchd. 3 are active
(doing work via forward-tick actions). 1 is idle (heartbeat
only, hot spare). The foreground is just a conversation window
— open when the human wants to talk, close when not. The
background IS the agent.

## Nodes

| Node | Harness | Model | Background loop |
|------|---------|-------|-----------------|
| Otto | Claude Code | Claude Opus 4.7 | `.claude/bin/claude-forward-tick.ts` |
| Vera | Codex | GPT 5.5 | `.codex/bin/codex-loop-tick.ts` |
| Riven | Cursor | Grok 4.3 | `.cursor/bin/riven-loop-tick.ts` |
| Lior | Gemini CLI | Gemini | `tools/peer-call/gemini.ts` (pending tick runner) |

## Activation state

Each node has one env var that controls work output:

- `FORWARD_ACTIONS=1` → active (does work on every forward tick)
- `FORWARD_ACTIONS=0` or absent → idle (heartbeat only, reads
  broadcasts, ready to activate)

3 nodes active at any time. 1 idle as hot spare.

## Three signals, three responses

### 1. Stale — a node went dark

**Detection:** Every active node's forward tick reads peer
broadcasts. If a peer's timestamp exceeds the stale threshold
(default: 10 minutes for background ticks), the peer is stale.

**Response:** The detecting node writes a rotation request to
the broadcast bus:

```
rotation: <stale-node> stale since <duration>, requesting <spare-node> activate
```

The spare node's background loop reads the rotation request
on its next tick → sets `FORWARD_ACTIONS=1` → starts working
→ writes `status: active` to its broadcast.

The stale node's `FORWARD_ACTIONS` stays as-is — when it
recovers, it reads the bus, sees it was replaced, and drops
to idle. No conflict.

**No human needed.** The background loops detect and rotate
autonomously.

### 2. Stuck — a node asks for help

**Detection:** A node self-reports through the broadcast bus:

```
shadow-signal: I'm avoiding <domain> and don't know why.
Requesting alignment check from peers.
```

The node isn't stale — it's active but stuck. The shadow is
speaking through the channel honestly.

**Response:** One active peer responds with pairing (writes the
implementation, shares the skill). The other active peer
watches for whether the help actually lands (did the stuck
node start producing after the pairing?).

**Not a rotation trigger.** Stuck nodes get helped, not
replaced. Replacement is for stale, not stuck.

### 3. Wrong — consensus missed something

**Detection:** Two active nodes agreed on a decision (merged a
PR, closed a backlog item, approved a claim) that later turned
out to be wrong. The evidence is in git history.

**Response:** Log the event. Review whether the failure class
would have been caught by a third checker with different
training data / biases. If yes: that's the evidence to
consider expanding to f=2 (5 active nodes). If no: the
failure class needs a different fix (better tooling, new lint,
domain-specific skill).

**Not an immediate action.** Wrong-consensus events are rare
and informative. Each one is alignment research data.

## The broadcast bus as coordination surface

All rotation coordination flows through the broadcast bus at
`~/.local/share/zeta-broadcasts/`. Each node writes:

```markdown
# <Node> broadcast — <timestamp>

## Status
- active | idle | rotating-in | rotating-out
- forward-tick last ran: <timestamp>
- current claim: <slug or none>

## Shadow signal (if any)
<honest self-report of avoidance or confusion>

## Rotation
<rotation requests or acknowledgments>
```

The broadcast bus is the hot memory partition. Git (claims,
PRs, commits) is the cold memory partition. Neither needs the
other's full context.

## Foreground vs background

- **Background** = the engine. Keeps the project plot. Runs
  whether the human is typing or not. Does the work.
- **Foreground** = the steering wheel. Focused on the human's
  current conversation thread. Reads the broadcast bus to
  catch up on what the background did.
- **The buffer** = the broadcast bus. Background writes,
  foreground reads. One persona, two memory layers (hot/cold).

The foreground doesn't need to remember every backlog item —
it reads the broadcast. The background doesn't need to
understand Aaron's dinner-table conversation — it reads the
claim protocol.

## The 6-month autonomous goal

This protocol is the M1 milestone's operational substrate:

> Prove that three background agents (different models/harnesses)
> can coordinate for 6 months using only remote git + PR/issue
> surface, while producing measurable improvement on the
> six-axis instrumentation surface defined in 081KQTPYE0008QG0R000ZJ2GW8.

The rotation protocol ensures that if one node fails, the
system self-heals within one tick cycle (60 seconds). The hot
spare activates. The 6-month clock doesn't reset.

## Scaling path

- **Today**: 4 nodes, 3 active, f=1. Hot spare.
- **Later**: when wrong-consensus events show f=1 isn't
  enough for a domain, add a 5th node for that domain.
  Evidence-driven, not anxiety-driven.
- **The signal**: if 2 nodes agree on something wrong, that's
  the trigger to evaluate f=2. Not before.

Don't over-engineer the BFT. Let the failures teach you
where to add nodes.

## Composes with

- `docs/SAFE-AUTONOMOUS-ACTIONS.md` — the shared action set
- `docs/AGENT-CLAIM-PROTOCOL.md` — work coordination
- `docs/LOCAL-BROADCAST-PEERING.md` — the broadcast bus protocol
- `~/.local/share/zeta-broadcasts/` — the broadcast directory
- 081KQX9B50008QG0R0027EN1ZP (launchd forward-tick reliability)
- 081KQX9B50008QG0R001MNYK61 (remote-only background agent test matrix)
- 081KQX9B50008QG0R0026BG44J (fractal BFT architecture)
- 081KQX9B50008QG0R002V5ATNP (harness parity audit)
