# Cross-platform USB flashing (dd-equivalent) over install.sh as the push-down base — design + the current macOS-only gap

*Captured 2026-06-09 from Aaron, to Otto (shadow\*). The zflash design intent: USB-ISO + a `dd`-style raw write, made
**cross-platform-OS**, built **on install.sh as the push-down base** (the #7185 compiler-domain dep-closure provisions
the cross-plat flashing tool). Current state (confirmed): zflash is **macOS-only**. Registers: [grounded current
state], [design intent], [gap / build front].*

## The statement

Aaron: *"we were going to use **USB ISO** … and we need some sort of **dd or something** … think **cross-plat OS
close-over** is what we're going for, **on top of install.sh as our push-down base.**"*

## Current state (grounded — confirmed in `full-ai-cluster/tools/zflash.ts`)

- **Mechanism:** USB-**ISO** (NixOS isohybrid ISO from `usb-nixos-installer/`) written to the USB via **`dd`**. ✓
  (matches the intent — ISO + dd.)
- **Platform: macOS-ONLY.** It uses **`diskutil`** (macOS-specific) for device enumeration / ESP mount + `dd` for
  the write; **only 1 `process.platform` branch** in the whole tool. Linux and Windows are **not** handled.
- **Not install.sh-provisioned:** the flashing tools are **not in the manifests** (`tools/setup/manifests/*` have no
  `dd`/flasher entry) — it relies on macOS **built-ins** (`diskutil`, `dd`). So flashing is *not yet* part of the
  install.sh push-down closure.

So: the **ISO + dd** core matches the intent, but **cross-platform** and **install.sh-provisioned** are the **gap.**

## The design: cross-platform raw-write, one ISO, per-OS device layer

Same ISO, same `dd`-semantics (raw block write); abstract the **OS-specific device-enumeration + raw-write** behind
a `detectPlatform() → { identify, write, mountESP }` interface:

| OS | identify device | raw write | ESP inject | status |
|---|---|---|---|---|
| **macOS** | `diskutil list external` | `dd` | `diskutil mount` + `sudo tee` | **done** (current) |
| **Linux** | `lsblk` / `/dev/sdX` | `dd` (native) | `mount` + write | **easy add** (dd is native) |
| **Windows** | `wmic`/PowerShell `Get-Disk` | **raw-write tool** (no `dd`) — `usbimager` / `balena-etcher-cli` / a dd-for-Windows / PowerShell raw write | mount + write | **the hard one** (needs a tool) |

The ISO and the dd-semantics are invariant; only the **device layer** is per-OS. (Same shape as the manifest-
symmetry split, #7182: one capability, OS-specific provisioning.)

## install.sh as the push-down base (#7185)

This is the #7185 move — **install.sh is the compiler-domain closure / push-down base** that provisions the cross-
platform flashing capability via the **declarative dep-closure** (the `PushDown` dep-noun; the manifests):

- **macOS / Linux:** `dd` is a **built-in** (coreutils) — nothing to declare (it's below the push-down line, like
  `curl`/`build-essential` are Windows-built-in exceptions in #7182's symmetry test). `diskutil`/`lsblk` are OS
  built-ins too.
- **Windows:** the **raw-write tool is NOT a built-in** → it must be **declared in `manifests/windows`** (scoop/
  winget — e.g. `usbimager` or a dd-for-windows), so install.sh **provisions** the flashing capability. This is the
  one piece the push-down base actually has to install. (And it must pass the manifest-symmetry test, #7182 — likely
  a `WINDOWS_EXCEPTION` for the unix `dd`/coreutils "it's built-in" + a real windows flasher line.)

So "cross-plat close-over on top of install.sh as the push-down base" = **the flashing capability is part of the
install.sh dep-closure**: built-in where the OS provides it (mac/linux `dd`), provisioned where it doesn't (Windows
flasher). The flashing tool joins the **wake-time tool closure** (#7185) — plug in any machine, install.sh has made
it flash-capable.

## The gap / build front

Extend zflash from **macOS-only → cross-platform**: add the **Linux** device layer (`lsblk` + native `dd` — easy)
and the **Windows** layer (a declared raw-write tool + `Get-Disk` enumeration — the real work), behind the
`detectPlatform()` abstraction, and **declare the Windows flasher in `manifests/windows`** so install.sh provisions
it (manifest-symmetry, #7182). → Route to **Dejan** (devops — owns install.sh + the manifests + cross-OS) + the
**usb-zflash-installer trajectory**. (Today's macOS flow is fully working for the operator's own tests; this is about
making *any* machine flash-capable via the push-down base.)

## Honest scope

[grounded current state]: `full-ai-cluster/tools/zflash.ts` is macOS-only (`diskutil` + `dd`, 1 platform branch);
flashing tools not in the manifests (macOS built-ins). [design intent]: cross-platform raw-write (one ISO, per-OS
device layer) provisioned via install.sh push-down base (#7185) — Aaron's stated direction. [gap / build front]:
Linux + Windows layers + the Windows-flasher manifest entry are **not built**; routed to Dejan + the zflash
trajectory. No new code; captures the design + the macOS-only gap.

## Pointers

- The push-down base: `2026-06-08-the-closed-model-two-internal-domains-…-installsh-is-the-wake-time-tool-closure.md`
  (#7185, install.sh = compiler-domain closure / push-down base) · `2026-06-08-…declarative-r-tectonic-install-manifests`
  (#7182, manifest cross-OS symmetry + the symmetry test) · `Db.fs` (the `PushDown` dep-noun).
- zflash: `full-ai-cluster/tools/zflash.ts` (the macOS tool) · `docs/runbooks/zflash-end-to-end.md` (the procedure) ·
  `docs/trajectories/usb-zflash-installer/RESUME.md` (the workstream) · `tools/setup/manifests/{apt,brew,windows}`
  (where the Windows flasher would be declared).
- Anchors: `dd` (raw block write); per-OS device enumeration (`diskutil`/`lsblk`/`Get-Disk`); the dep-closure over
  host→os→hardware (#7185).
