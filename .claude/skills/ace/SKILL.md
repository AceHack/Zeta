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

Publisher verbs: `keygen`, `sign`. Consumer verbs: `install`, `verify`, `trust add`, `trust list`, `list`.

| Verb | Form | What |
|---|---|---|
| `keygen` | `bun tools/ace/ace.ts keygen [--out <prefix>]` | Generate an Ed25519 keypair (writes `<prefix>.key` 0600 + `<prefix>.pub`) |
| `sign` | `bun tools/ace/ace.ts sign <pkg> --key <priv.key> [--out <file>]` | Sign a package manifest with an Ed25519 private key |
| `list` | `bun tools/ace/ace.ts list [--store <path>] [--json]` | List installed packages from `~/.ace/store` |
| `install` | `bun tools/ace/ace.ts install <url-or-path> [--allow-no-signature]` | Resolve the transitive dependency graph, verify integrity + authenticity of every node, install leaves-first (atomic) |
| `verify` | `bun tools/ace/ace.ts verify <hash>` | Confirm an installed package is present |
| `trust add` | `bun tools/ace/ace.ts trust add <pub-file-or-b64> [--label <name>]` | Add an Ed25519 public key to the user trust store (`~/.ace/trusted-keys.json`) |
| `trust list` | `bun tools/ace/ace.ts trust list` | List all trusted keys (bundled + user) |
| `help` | `bun tools/ace/ace.ts help` | Usage |

`install` verifies **integrity** (content hash) AND **authenticity** (Ed25519 signature
against the trust store). Unsigned packages need `--allow-no-signature`; a present-but-untrusted
signature is always refused (`ace trust add` the key).

For a manifest with `dependencies` (inline-URL: `{name, version, url, package_hash}`),
`install` resolves the full transitive graph and installs every node leaves-first.
Resolution is atomic: it verifies the whole graph (slice-2 hash + slice-3 signature
per node, identity-pinned by `package_hash`) and preflights path-safety + store-key
uniqueness BEFORE extracting anything — any failure installs nothing. Refusal reasons:
`version-skew`, `tamper`, `pin-mismatch`, `bad-content-hash`, `bad-signature`,
`untrusted-key`, `unsupported-algo`, `no-signature`, `cycle`, `fetch-failed`,
`invalid-package`, `store-collision`. `--allow-no-signature` applies graph-wide
(permits only genuinely-unsigned nodes; a bad/untrusted signature on any node always refuses).

## Invocation

```bash
bun tools/ace/ace.ts list --json
```

Exit codes: `0` ok · `64` usage error · `65` invalid package JSON · `1` refused (bad signature / untrusted key / integrity fail).

## Where the deep substrate lives (one Read away)

- Distribution + DX design: `docs/agendas/ace-package-manager/2026-06-01-ace-cli-distribution-dx-design.md`
- Authenticity design: `docs/agendas/ace-package-manager/2026-06-01-ace-cli-slice3-authenticity-signature-verify-design.md`
- Agenda: `docs/agendas/ace-package-manager/AGENDA.md`
- The bus↔Ace one-substrate synthesis: PR #6284 (G-Set ⊂ bag ⊂ Z-set; shared B-0867.27 fold engine)
