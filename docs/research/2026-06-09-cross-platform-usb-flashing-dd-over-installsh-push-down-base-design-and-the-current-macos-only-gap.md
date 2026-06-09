# Cross-platform USB flashing (dd-equivalent) over install.sh as the push-down base — design, state, and the Windows-Hello auth-parity requirement

> *Filename keeps "macos-only-gap" for link stability — but that framing was **corrected**: flashing is already
> cross-platform (mac + Windows + Linux). See the CORRECTION banner below.*

*Captured 2026-06-09 from Aaron, to Otto (shadow\*). The zflash design intent: USB-ISO + a `dd`-style raw write, made
**cross-platform-OS**, built **on install.sh as the push-down base** (the #7185 compiler-domain dep-closure provisions
the cross-plat flashing tool). State (corrected 2026-06-09): already cross-platform across **three sibling tools**
(mac/Touch ID, Windows/UAC via Max, Linux/manual); open items are **auth-parity (Windows Hello, not just UAC)**,
unification, and install.sh provisioning. Registers: [grounded state], [correction], [requirement — Aaron], [build
fronts].*

## The statement

Aaron: *"we were going to use **USB ISO** … and we need some sort of **dd or something** … think **cross-plat OS
close-over** is what we're going for, **on top of install.sh as our push-down base.**"*

> **CORRECTION 2026-06-09 (Aaron + Max):** the original draft said "macOS-ONLY" — **wrong.** That described
> `zflash.ts` (the single mac tool), not the *capability*. **Max shipped a Windows flasher** (`flash-usb-windows.ts`,
> #6868/#6895/#6981) with mac-parity safety rails + raw-FAT ESP key injection; Linux has `flash-usb.ts` (manual).
> So flashing is **already cross-platform** — it's **three sibling tools**, not one `detectPlatform()`. The real open
> items are (a) **auth-parity** (see the new section — Windows uses UAC, not Touch-ID-equivalent biometric) and
> (b) **unification + install.sh provisioning**. Corrected below.

## Current state (grounded — confirmed on main 2026-06-09)

- **Mechanism:** USB-**ISO** (NixOS isohybrid ISO from `usb-nixos-installer/`) written to the USB via **`dd`** /
  raw-write. ✓ (matches the intent — ISO + raw write.)
- **Platform: cross-platform already, as THREE sibling tools** (not one unified tool):
  - **macOS** — `zflash.ts`: `diskutil` enumeration + `dd` + **Touch ID** (PAM/`sudo`) as the presence gate. (The
    `darwin`-only bail in `zflash.ts` is *that tool's* scope, not the capability's.)
  - **Windows** — `flash-usb-windows.ts` (Max, #6868/#6895/#6981): elevated PowerShell, `\\.\PhysicalDriveN`
    raw-write, raw-FAT ESP key injection; **UAC / Administrator prompt** as the presence gate (Windows Hello only
    *"if configured"*, not required). Device-path handling in `zflash-lib.ts`.
  - **Linux** — `flash-usb.ts` (manual flow per its header): `/dev/sdX` + native `dd`.
- **Not yet unified / install.sh-provisioned:** three tools, not one `detectPlatform()`; flashers not declared in
  `tools/setup/manifests/*` (rely on OS built-ins / per-OS install). So the *push-down provisioning* is still open.

So: the **ISO + raw-write** core AND **cross-platform coverage** are **done**; **auth-parity** and **unification +
install.sh provisioning** are the open items.

## The design: cross-platform raw-write, one ISO, per-OS device layer

Same ISO, same `dd`-semantics (raw block write); abstract the **OS-specific device-enumeration + raw-write** behind
a `detectPlatform() → { identify, write, mountESP }` interface:

| OS | tool | identify device | raw write | ESP inject | presence gate | status |
|---|---|---|---|---|---|---|
| **macOS** | `zflash.ts` | `diskutil list external` | `dd` | `diskutil mount` + `sudo tee` | **Touch ID** (PAM) | **done** |
| **Windows** | `flash-usb-windows.ts` | PowerShell `Get-Disk` | `\\.\PhysicalDriveN` raw-write | raw-FAT inject | **UAC** (Hello *if configured*) | **done** (Max) — auth-parity gap |
| **Linux** | `flash-usb.ts` | `lsblk` / `/dev/sdX` | `dd` (native) | `mount` + write | `sudo` | **manual** |

The ISO and raw-write semantics are invariant; the **device layer + presence gate** are per-OS. (Same shape as the
manifest-symmetry split, #7182: one capability, OS-specific provisioning.) **Unification** into one
`detectPlatform()` dispatcher over the three is the remaining engineering tidy.

## Auth-parity: Touch ID vs UAC — Zeta needs at least Windows Hello (Aaron, 2026-06-09)

The three tools cover the *write*, but their **presence gates are not parity**, and Aaron flags this as a
**requirement, not a nicety**:

- **macOS = Touch ID** — an **identity-bound biometric presence** gate. *This specific human is physically here.*
- **Windows = UAC** — a **privilege-elevation** gate. *An administrator approved this.* That's a **different
  thing**: it proves authority, not the identity-bound physical presence of a specific person. (Windows Hello is
  supported only *"if configured"* — i.e. optional, not the bar.)

> Aaron: *"Windows UAC is fine for Windows, but **Zeta is designing the future of human↔AI interaction**, so we need
> **at least Windows Hello, not just Windows UAC.**"*

**Why it's load-bearing (not cosmetic):** Zeta's authorization model is **consent-first / identity-bound presence**
(manifesto §6) — the gate on a destructive, identity-injecting act (SSH-key inject into the ESP) should assert
*"this particular human is here and consents,"* which is exactly what **biometric presence** (Touch ID / Windows
Hello) gives and what **UAC (mere admin elevation) does not**. For a system whose whole thesis is the future of
human↔AI interaction, the **biometric presence gate is the right default**; UAC is an acceptable **fallback**, not
the target.

**The requirement / build front:** elevate `flash-usb-windows.ts` from **UAC-only → Windows Hello required**
(biometric presence, parity with mac Touch ID), **UAC as graceful fallback** where Hello isn't available. → Route to
**Max** (owns the Windows flasher) + **Dejan** (cross-OS) + a backlog item. (Anchor: Windows Hello API /
`KeyCredentialManager` for a presence assertion; the consent-first §6 / identity-bound-presence principle.)

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

## The open items / build fronts (revised)

Cross-platform *coverage* is **done** (mac + Windows + Linux). What's left:

1. **Auth-parity → Windows Hello** (Aaron's requirement): elevate `flash-usb-windows.ts` from UAC-only to
   **Windows Hello required** (biometric presence parity with mac Touch ID), UAC as fallback. → **Max** + backlog.
   *(The load-bearing one — it's the consent-first §6 principle, not a polish.)*
2. **Unify the three tools** behind one `detectPlatform()` dispatcher (so `zflash` is one entry point on any OS,
   not three siblings). → engineering tidy.
3. **install.sh provisioning** (#7185): declare the per-OS flasher deps in `tools/setup/manifests/*` so the
   push-down base makes *any* machine flash-capable (manifest-symmetry, #7182). → **Dejan**.

→ Owners: **Max** (Windows flasher / Hello), **Dejan** (install.sh + manifests + cross-OS), the
**usb-zflash-installer trajectory**.

## Honest scope

[grounded current state]: flashing is **already cross-platform on main** — `zflash.ts` (macOS/Touch ID),
`flash-usb-windows.ts` (Windows/UAC, Max #6868/#6895/#6981), `flash-usb.ts` (Linux/manual); three sibling tools,
not unified, not in the manifests. [correction]: the original draft's "macOS-only" was wrong (described the one tool,
not the capability). [requirement — Aaron]: **Windows Hello (biometric presence), not just UAC** — because Zeta
designs the future of human↔AI interaction and the gate must assert identity-bound presence (consent-first §6), not
mere admin elevation. [open build fronts]: Windows-Hello parity (Max), unification, install.sh provisioning (Dejan).
No new code; corrects the record + captures the auth-parity requirement.

## Pointers

- The push-down base: `2026-06-08-the-closed-model-two-internal-domains-…-installsh-is-the-wake-time-tool-closure.md`
  (#7185, install.sh = compiler-domain closure / push-down base) · `2026-06-08-…declarative-r-tectonic-install-manifests`
  (#7182, manifest cross-OS symmetry + the symmetry test) · `Db.fs` (the `PushDown` dep-noun).
- zflash: `full-ai-cluster/tools/zflash.ts` (the macOS tool) · `docs/runbooks/zflash-end-to-end.md` (the procedure) ·
  `docs/trajectories/usb-zflash-installer/RESUME.md` (the workstream) · `tools/setup/manifests/{apt,brew,windows}`
  (where the Windows flasher would be declared).
- Anchors: `dd` (raw block write); per-OS device enumeration (`diskutil`/`lsblk`/`Get-Disk`); the dep-closure over
  host→os→hardware (#7185).
