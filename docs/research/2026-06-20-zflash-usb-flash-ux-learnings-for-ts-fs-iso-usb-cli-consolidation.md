# zflash USB-flash UX learnings — input for the TS/FS iso-usb CLI consolidation

**Date:** 2026-06-20. **Source:** Otto (shadow) ran a live USB flash on Aaron's Mac at his
direction (`/dev/disk6`, agent-driven mode, Touch ID gate). **Aaron's framing:** *"we are trying to
get the cli iso/usb ts/fs versions all working together instead of the old zflash … save the updates
and user experience for improvement for next time."* This note captures what worked + the one real
UX footgun, as **input for that consolidation** (not a patch — the consolidation is in-flight; this
informs it).

## What worked (keep these)

A clean end-to-end flash via the **platform CLI** with the agent flag:

```bash
bun src/Core.TypeScript/zflash/cli.ts --agent
```

- **Auto-download of the freshest CI ISO works** (confirmed): it detected the local ISO was stale
  (2026-06-09) and pulled the newest successful `build-ai-cluster-iso` artifact
  (`zeta-installer-25.11-ci27887666934-2026-06-21.iso`, run 27887666934) via `gh run download`
  before flashing. `autoDownloadFreshIsoIfNeeded()` (cli.ts:339, called :1101) does what the operator
  expects — no manual `gh run download`.
- **Agent-driven mode is the right design:** `--agent` auto-types the `yes <nonce>` challenge while
  the **Touch ID PAM gate still fires on the operator's Mac** — biometric physical-presence consent
  that an agent cannot bypass. This is the correct split (agent drives; human's finger is the
  irreducible gate for the destructive `dd`). Output narrates the auto-type per glass-halo.
- Full flow completed: fresh-ISO pull → unmount → `dd` 1.54 GiB → "Flash complete" → SSH pubkey
  injected into the ESP (`zeta-authorized-keys.pub`) → disk ejected. ~1–2 min.

## The one real UX footgun (the consolidation target)

There are **two TypeScript entry points with divergent argument surfaces**, and mixing them fails
cryptically:

| Entry point | Role | `usb` arg |
|---|---|---|
| `zeta-flash.ts` | **router** (`zeta flash <usb\|inject\|inspect>`; MCP `zeta_flash`) | **subcommand** — `zeta flash usb --agent` strips `usb`, reexecs `cli.ts --agent` |
| `cli.ts` | macOS **platform CLI** | **NOT a subcommand** — `positional[0]` is treated as an **ISO path** |

So running the *inner* CLI with the *router's* subcommand —

```bash
bun src/Core.TypeScript/zflash/cli.ts usb --agent      # WRONG
```

— parses `usb` as an ISO path and dies with the misleading **`flash-usb: ISO file does not exist:
.../usb`** (and silently *skips* the auto-download, since an explicit ISO path was "given"). The docs
are actually correct (they show `zeta-flash.ts usb` for the router and `cli.ts` bare for the
platform), but the **shape is a footgun**: the two surfaces look interchangeable and aren't.

## Recommendations for the consolidation (TS/FS iso-usb unify)

1. **One arg surface across F# shell · TS router (`zeta-flash.ts`) · TS platform (`cli.ts`).** Either
   `cli.ts` also accepts the `usb` subcommand (and `inject`/`inspect`), or it **rejects** a known
   router-subcommand passed as `positional[0]` with a *helpful* error instead of the cryptic
   ISO-not-found:
   > `cli.ts takes no 'usb' subcommand — run 'zeta flash usb' / 'zeta-flash.ts usb', or call cli.ts
   > with flags only.`
   A 3-line guard at the positional-validation site (cli.ts ~:1012) turns the footgun into a signpost.
2. **F# (`zeta flash usb`) and TS (`zeta-flash.ts usb`) must stay arg-identical** as they converge —
   same subcommands, same flags (`--agent`, `--host`, `--ssh-key`, `--setup`, `--no-inject`), same
   challenge/Touch-ID flow — so a runbook works verbatim on either.
3. **Preserve `--agent` + Touch-ID-gate semantics** in the unified CLI (the consent floor is the win).
4. **Auto-download stays default** (it already is in `cli.ts`); ensure the F# leg and router both
   route through it so "old stale local ISO" can never be silently flashed.
5. Retire the "old zflash" framing once the F#/TS surfaces are unified behind `zeta flash`.

## Pointers

- `src/Core.TypeScript/zflash/{zeta-flash.ts (router), cli.ts (mac), flash-usb-windows.ts (win), flash-usb.ts}`
- `.claude/skills/agent-runtime-and-persistence/blueprints/zflash-overview.md` (runbook; entry points §)
- Backlog: `docs/backlog/P1/081KSGS9H0008QG0R001EZKNCB-zflash-agent-mode-native-implementation-close-doc-vs-impleme.md` (the doc-vs-impl gap this is an instance of)
- `build-ai-cluster-iso.yml` (the CI ISO artifact the auto-download pulls)
