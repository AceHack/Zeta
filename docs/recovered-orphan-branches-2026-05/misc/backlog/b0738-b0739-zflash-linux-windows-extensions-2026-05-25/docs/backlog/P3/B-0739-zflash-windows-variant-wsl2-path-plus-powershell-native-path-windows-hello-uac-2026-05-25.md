---
id: B-0739
priority: P3
status: open
created: 2026-05-25
last_updated: 2026-05-25
title: zflash Windows variant — two paths (WSL2 reuses Linux substrate via usbipd-win USB pass-through; PowerShell-native = Get-Disk + Clear-Disk + Windows Hello biometric + UAC elevation); tools/setup/ has no Windows entry today
domain: ops-tooling
ferried_by: aaron
owners: [aaron]
composes_with:
  - B-0737
  - B-0738
  - B-0728
  - B-0732
related_substrate:
  - full-ai-cluster/tools/flash-usb.ts
  - full-ai-cluster/tools/zflash.ts
  - full-ai-cluster/tools/zflash-setup.ts
  - tools/setup/install.sh
tags: [zflash-windows, wsl2, usbipd-win, powershell, get-disk, windows-hello, uac, biometric-windows-hello-for-business, ops-tooling, cross-platform]
---

# B-0739 — zflash Windows variant

## Carved blade

> Windows extension is qualitatively harder than Linux (B-0738). Two viable paths exist + the choice is substrate-engineering trade-off: **WSL2 path** reuses the Linux substrate from B-0738 verbatim BUT requires `usbipd-win` USB pass-through (extra setup step; not Microsoft-shipped by default). **PowerShell-native path** is a complete rewrite — `Get-Disk` / `Get-Partition` / `Clear-Disk` instead of `lsblk`+`dd`; Windows Hello for Business as the biometric gate (or PIN/password fallback); UAC elevation instead of sudo; needs careful Defender-exclusion + admin-prompt-handling. WSL2 path ships faster; PowerShell-native gives the native-feel Windows operator experience. Recommendation: ship WSL2 first; PowerShell-native as future scope when there's actual Windows operator demand. `tools/setup/install.sh` currently routes only on `Darwin` + non-Darwin (assumed Linux); needs a Windows branch for either path.

## Origin

Aaron 2026-05-25, after B-0737 (Mac variant) shipped:

> *"is this mac only? does our install / pre install scripts take care of everyting needed for mac?  what do we need to do to extend this to windows and linux?  we should document liminations and scope and backlog the rest"*

This row covers the Windows extension; B-0738 covers Linux.

## Limitations B-0739 addresses

| Limitation | Current state | What B-0739 fixes |
|---|---|---|
| `flash-usb.ts` bails on non-Darwin | Refuses Windows entirely | Two-path solution (WSL2 OR PowerShell-native) |
| No Windows `zflash` wrapper | Doesn't exist | Ship per-path equivalent |
| No Windows `zflash-setup` | Doesn't exist | Ship per-path setup (WSL2: install usbipd-win + reuse Linux setup; native: Windows Hello policy + UAC bypass-prompt audit) |
| `pam_tid.so` is Apple-only | N/A on Windows | Replace with Windows Hello for Business (`Microsoft.Windows.SecureBiometric` API) on native path; reuse pam_fprintd via WSL2 path when available |
| No `tools/setup/install.sh` Windows entry | Routes only Darwin + non-Darwin (assumed Linux) | Add Windows branch routing to a new `tools/setup/windows.ps1` (or `windows.sh` if WSL2-only) |
| No `manifests/winget` or `manifests/chocolatey` | Doesn't exist | New manifest file for Windows package source per chosen package manager |

## Two paths — substrate-honest trade-off

### Path A — WSL2 (lower-scope; ships faster)

**What it requires:**

- WSL2 already installed (Windows 10 build 19041+ or Windows 11; one-line `wsl --install`)
- `usbipd-win` installed on Windows host (Microsoft-supported but separately distributed)
- Operator runs `usbipd bind --busid=<id>` once + `usbipd attach --wsl --busid=<id>` per session to pass the USB stick through to WSL2
- Once attached, WSL2 sees the USB stick at `/dev/sdX`; the B-0738 Linux substrate works identically

**Pros:**

- Reuses 100% of B-0738 Linux work (zero new code beyond the install-script branch + setup doc)
- Windows operator gets identical safety substrate (PAM auth, biometric if their WSL2 distro supports it via libfprint)
- Lower maintenance burden (single substrate to test + improve)

**Cons:**

- usbipd-win adds friction (operator must install + bind/attach each session)
- Biometric gate works only if WSL2 distro has fprintd configured (most don't out of the box)
- Doesn't feel "native Windows"

### Path B — PowerShell-native (high-scope; better Windows UX)

**What it requires:**

- Complete rewrite of `flash-usb.ts` logic in PowerShell (`.ps1`) OR TypeScript-compiled-to-Windows-binary via Bun/Node (Bun has Windows support but device-level APIs still need PowerShell shim)
- `Get-Disk` / `Get-PhysicalDisk` / `Get-Partition` for enumeration
- `Clear-Disk` + `Initialize-Disk` + `New-Partition` + `Format-Volume` for partition prep (NOT `dd` equivalent — Windows doesn't ship one in PowerShell)
- For actual ISO write: shell out to a bundled tool (Rufus library) OR PowerShell `Set-Content -Path \\.\PhysicalDriveN -Value (Get-Content iso -Raw -Encoding Byte)` (slow but works)
- Windows Hello for Business via `Windows.Security.Credentials.UI.UserConsentVerifier` (UWP API) — needs C# or PowerShell-with-CLR shim
- UAC elevation prompt via `Start-Process -Verb RunAs` for the destructive write
- Windows Defender exclusion or signed binary (otherwise warnings)

**Pros:**

- Native Windows operator UX (Windows Hello prompt; no WSL/usbipd ceremony)
- Single command (`zflash.ps1`) from PowerShell

**Cons:**

- Substantial new substrate (PowerShell + UWP API; ~10x scope of WSL2 path)
- Needs Windows-specific testing infrastructure (no WSL2 to share with Linux CI)
- Defender warnings unless signed (signing infrastructure = another future scope)

## Recommendation

**Ship Path A (WSL2) first.** Reuse B-0738 Linux substrate; document `usbipd-win` requirement; that's the minimum-viable Windows support. Path B (PowerShell-native) deferred until there's actual demonstrated Windows-operator demand (Aaron is Mac; Max + Addison preferences not yet captured re Windows usage).

## Scope items (Path A — WSL2)

### Scope item 1 — Document `usbipd-win` requirement + bind/attach flow

- New doc at `full-ai-cluster/tools/ZFLASH-WINDOWS-WSL2.md`
- Step-by-step: install WSL2, install usbipd-win, bind + attach USB stick, then proceed with B-0738 Linux flow inside WSL2
- Caveats: per-session attach (USB stick gets detached on Windows sleep/restart)

### Scope item 2 — `tools/setup/install.sh` Windows-via-WSL2 routing touchpoint

- Detect WSL2 environment via `uname -a | grep -i microsoft` OR `[ -f /proc/version ] && grep -qi microsoft /proc/version`
- If WSL2: route to `linux.sh` (already works; B-0738 substrate applies once shipped)
- If native PowerShell: bail with link to ZFLASH-WINDOWS-WSL2.md OR (future) Path B substrate

### Scope item 3 — Windows-side helper script (PowerShell)

- New file `tools/setup/windows.ps1` — minimal Windows-side helper
- Verifies WSL2 installed (or installs via `wsl --install`)
- Verifies `usbipd-win` installed (or installs via `winget install dorssel.usbipd-win`)
- Outputs the bind/attach command for the operator's USB stick

## Scope items (Path B — PowerShell-native, future)

- PowerShell rewrite of `flash-usb.ps1` with `Get-Disk`/`Clear-Disk`/`Initialize-Disk`/`New-Partition`/`Format-Volume` + actual ISO byte-write (likely via Rufus library shell-out or `Set-Content -AsByteStream`)
- Windows Hello UWP API shim (C# or PowerShell-with-CLR) for biometric gate
- UAC `Start-Process -Verb RunAs` for elevation
- Windows Defender exclusion documentation + signed-binary roadmap
- `tools/setup/windows.ps1` integration: full standalone path (not WSL2-routed)

## What's NOT in scope (deferred)

- **Windows Server** — different paradigm (no Windows Hello; ServerCore has no GUI). Future scope when there's demand.
- **Windows ARM64** — Bun supports it; usbipd-win supports it; but native PowerShell path needs separate testing. Future scope.
- **Code signing for the Windows-native script** — needs an EV certificate or Microsoft-Store path. Future scope when Path B ships.
- **Group Policy integration** — for enterprises that lock down Windows Hello policies. Future scope.

## Composes with .claude/rules/

- `.claude/rules/non-coercion-invariant.md` HC-8 — biometric/UAC gate cannot be bypassed by agent regardless of which path
- `.claude/rules/default-to-both.md` — Path A (WSL2) AND Path B (PowerShell-native) both first-class as substrate-engineering directions
- `.claude/rules/honor-those-that-came-before.md` — B-0737 (Mac) + B-0738 (Linux) substrate is foundation; B-0739 extends without replacing
- `.claude/rules/glass-halo-bidirectional.md` — UAC + Windows Hello prompts are system-level UI; visible to operator regardless of which terminal initiated
- `.claude/rules/algo-wink-failure-mode.md` — operator authorization happens at the system gate, not at script invocation

## Composes with backlog substrate

- B-0737 (zflash Mac variant — original substrate)
- B-0738 (zflash Linux variant — Path A WSL2 reuses this directly)
- B-0728 (destructive-tool authoring contract — inherited regardless of path)
- B-0732 (leverage-class safety substrate — Layer 1 provenance chain captures which platform's destructive op fired)

## Substrate-honest framing

This row PROPOSES the Windows substrate. It does NOT:

- Recommend Path A vs Path B unilaterally (Path A recommended for FIRST ship per scope-cost trade-off; Path B substrate-honest as future scope)
- Auto-route to Path A in `install.sh` until Path A scope items 1-3 actually ship
- Claim usbipd-win works in every Windows environment (some enterprise GPO setups restrict third-party kernel drivers; substrate-honest fallback: Path B native or accept no Windows support)
- Bypass any safety substrate from B-0737 + B-0738

Per `.claude/rules/no-directives.md`: operator-substrate-honest scoping; Aaron + future Windows operators retain authority over which path to pursue + when.

P3 priority — Windows substrate enables a future Windows-operator base but doesn't gate any current critical path (no current operator is Windows-primary; cluster nodes don't need zflash — they boot from the flashed USB then run zeta-install.sh natively).
