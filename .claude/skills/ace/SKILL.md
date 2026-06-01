---
name: ace
description: Ace DLC package manager — list/install/verify content-addressed packages in ~/.ace store. Run via bun.
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

| Verb | Form | What |
|---|---|---|
| `list` | `bun tools/ace/ace.ts list [--store <path>] [--json]` | List installed packages from `~/.ace/store` |
| `install` | `bun tools/ace/ace.ts install <url-or-path>` | Download/read a package, verify content-hash integrity, install to `~/.ace/store` |
| `verify` | `bun tools/ace/ace.ts verify <hash>` | Confirm an installed package is present |
| `help` | `bun tools/ace/ace.ts help` | Usage |

`install` verifies **integrity** (content hash). Authenticity (signatures) is not yet checked — slice 3.

## Invocation

```bash
bun tools/ace/ace.ts list --json
```

Exit codes: `0` ok · `64` usage error.

## Where the deep substrate lives (one Read away)

- Distribution + DX design: `docs/agendas/ace-package-manager/2026-06-01-ace-cli-distribution-dx-design.md`
- Agenda: `docs/agendas/ace-package-manager/AGENDA.md`
- The bus↔Ace one-substrate synthesis: PR #6284 (G-Set ⊂ bag ⊂ Z-set; shared B-0867.27 fold engine)
