# Shadow observer

Auto-accept mode for Claude Code's suggestion UI. When Claude produces a suggestion
(grey text), the shadow observer detects it and sends an `Enter` keystroke to accept,
logging every action to a JSON log file.

## Shadow mode

### Installation

```bash
bun install
```

### Quick start (dry run — no keystrokes sent)

```bash
bun run shadow -- --dry-run --once
```

### Full autonomous mode

```bash
bun run shadow -- --delay 2000
```

### Entry point via `bun link`

After `bun link` in the repo root, `zeta-shadow` is available on `PATH`:

```bash
bun link
zeta-shadow --dry-run --once
```

### Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--delay <ms>` | `3000` | Delay before accepting a detected suggestion |
| `--detect-cmd <cmd>` | built-in | External command for detection. Exit 0 = suggestion present. |
| `--dry-run` | off | Log actions without sending keystrokes |
| `--loop <ms>` | off | After natural exit, wait `<ms>` then restart. `Ctrl-C` terminates immediately. |
| `--loop-interval <ms>` | `1000` | Sleep between detection cycles in continuous mode |
| `--log-file <path>` | `tools/shadow/shadow-observer.log` | JSON log file path |
| `--once` | off | Run exactly one detection cycle then exit |

### Demo recipe

Use an external detector script for a live UI demo:

```bash
zeta-shadow --detect-cmd "./your-detect-script.sh" --delay 2000
```

`your-detect-script.sh` exits 0 when a suggestion is present (stdout is the
suggestion content), non-0 otherwise.

### Glass Halo

All shadow submissions are logged to `tools/shadow/shadow-observer.log` (or the path
supplied via `--log-file`) in JSON Lines format, one event per line.
Every auto-accept carries `(shadow)` attribution so the source is always traceable.

Sample `accepted` event:

```json
{"ts":"2026-05-13T11:00:00.000Z","type":"accepted","content":"console.log(x)","mode":"shadow","attribution":"(shadow)"}
```

Sample `detected` event:

```json
{"ts":"2026-05-13T11:00:00.001Z","type":"detected","content":"console.log(x)"}
```

The log is the human circuit-breaker surface: review it at any time to see what
was accepted, overridden, or skipped.

### Safety model

- The human is the **live circuit breaker**: `Ctrl-C` stops the observer immediately.
- `--dry-run` mode logs all intended actions without sending any keystrokes — safe
  for demos and audits.
- `--loop` restarts after natural exit; `SIGINT` / `SIGTERM` are **never** restarted.
- Log file is append-only — no events are removed.
