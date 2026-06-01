---
name: ace
description: Ace DLC package manager — list (and, when built, install/verify) content-addressed packages from the local ~/.ace store. Run via bun; Node-floor portable.
record_source: "B-0288 + ace-package-manager agenda; distribution per 2026-06-01 design"
load_datetime: "2026-06-01"
last_updated: "2026-06-01"
status: active
---

# Ace — DLC package manager (skill surface)

Ace is the repo's package manager (`tools/ace/ace.ts`). This skill is the agent
surface; the human surface is the `ace` command (exposed by `install.sh` via
`bun link`).

## Runtime precondition (load-bearing)

Ace is TS run on **bun** in-repo: `bun tools/ace/ace.ts <verb>`. The floor is a JS
runtime — **Node ≥ 22.5 or bun**. Harnesses with a JS runtime (Claude Code, Cursor,
Gemini CLI) run it directly. A pure-Rust harness with **no** JS runtime (e.g. OpenAI
Codex CLI) must first install bun/Node (run the repo `install.sh`) — Ace cannot run
without one.

## Verb grammar

Today (`list`-only slice):

| Verb | Form | What |
|---|---|---|
| `list` | `bun tools/ace/ace.ts list [--store <path>] [--json]` | List installed packages from `~/.ace/store` |
| `help` | `bun tools/ace/ace.ts help` | Usage |

(Coming in slice 2: `install <url>` + `verify <hash>` — integrity-verified.)

## Invocation

```bash
bun tools/ace/ace.ts list --json
```

Exit codes: `0` ok · `64` usage error.

## Where the deep substrate lives (one Read away)

- Distribution + DX design: `docs/agendas/ace-package-manager/2026-06-01-ace-cli-distribution-dx-design.md`
- Agenda: `docs/agendas/ace-package-manager/AGENDA.md`
- The bus↔Ace one-substrate synthesis: PR #6284 (G-Set ⊂ bag ⊂ Z-set; shared B-0867.27 fold engine)
