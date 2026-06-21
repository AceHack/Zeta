# QEMU slice 1 (aarch64) + the Zeta multi-boot ISO whose boot screen IS the first CYOA page + the bench closes over into the shared library

Aaron 2026-06-11 (authorizing slice 1, then the boot-screen + bench stream):

> "Let's do the QEMU slice 1 and get the ISO booting aarch64. Make sure any ISOs are part of **Zeta's
> multi-boot ISO** — we have **crypto, home, mining stuff** too. We can make that **boot screen run and
> look like this** [the BBS/board feel] and **switch into choose-your-own-adventure from early on**."
> / "I have **4 machines waiting** for this — **4090, 3090, others** — and **Raspberry Pi** and tons of
> other equipment, and **NAS equipment**. We get to **close over it all, and each one gets added to the
> library that's shared for common use**."

## Slice 1 — built this PR (the aarch64 boot floor)

- **flake**: `installer-aarch64` nixosConfiguration — the SAME installer configuration, only `system`
  differs (one source of truth); `aarch64-linux` joins `isoBuildSystems`; the per-system `installer-iso`
  package selects the right config.
- **kernel params**: `console=ttyAMA0` added alongside `ttyS0` — each arch ignores the UART it lacks,
  so ONE config boots both (x86 q35 serial = ttyS0; aarch64 virt PL011 = ttyAMA0; the Pi's UART is also
  ttyAMA0-family — the same line serves the metal rung).
- **boot test**: `qemu-boot-test.ts --arch aarch64` — `-machine virt` + EDK2 UEFI (`qemu-efi-aarch64`),
  KVM when the host is arm64 (the `ubuntu-24.04-arm` runner), TCG `-cpu max` fallback.
- **CI**: a `build-aarch64` job on `ubuntu-24.04-arm` — native build, boot to login prompt, ISO uploaded
  as an artifact (14 days) so the Pi can be flashed from CI output directly.

When this job is green, the matrix's `qemu-aarch64` row earns its first ✅ and the Pi rung unblocks.

## The Zeta multi-boot ISO — every ISO is a member, the boot screen is page one of the CYOA

The standing rule (Aaron): **any ISO we produce is a member of ONE Zeta multi-boot ISO** — the installer,
the crypto/home tools, the mining stack, whatever ships next — one USB stick, one GRUB menu, every tool
a chapter. Lineage already in place: the GRUB multiboot work (#7506), 081KSGS9H0008QG0R003SWZF9J (ISO/kernel/initrd layout),
081KSKBP80008QG0R000Y2B7HC (signed artifacts).

And the boot menu is not a boring list — **it is the FIRST PAGE of the choose-your-own-adventure**:
the BBS/D&D feel charter applies from power-on. GRUB themes support exactly this (text menu, colors,
ASCII art): the menu reads like a room with doors —

```
  ╔══════════════════════════════════════════╗
  ║        Z E T A  —  pick your door        ║
  ╟──────────────────────────────────────────╢
  ║  > Install a cluster node    (the forge) ║
  ║    Crypto / home tools       (the vault) ║
  ║    Mining rig                (the mine)  ║
  ║    Live arcade (CHIP-8)      (the den)   ║
  ╚══════════════════════════════════════════╝
```

The CYOA "switches in from early on" — before an OS even loads, you're already at the table. (GRUB
theming + the member-ISO loopback entries are the NAMED NEXT SLICE — design here, implementation after
slice 1 is green; chainloading member ISOs via GRUB loopback is proven prior art.)

## The bench closes over into the shared library (the commons)

The waiting hardware, recorded: **4 machines (RTX 4090, RTX 3090, others) · Raspberry Pi(s) · NAS
equipment · "tons of other equipment."** The rule Aaron set: **each device "closes over" — becomes a
named, capability-declared member — and is added to the library that's shared for common use.** That is:

- **close over** = the device gets a citizen identity (governed ZetaId / Reticulum destination), an
  honest capability row in `docs/HARDWARE-CAPABILITY-MATRIX.md`, and its bring-up recorded
  (glass-blowing: hot artisanal first, annealed into a room);
- **the shared library** = the commons (Ostrom — governing shared resources by community rules): any
  member of the society can USE the 4090s/NAS/Pi through the room protocol, under the matrix's declared
  capabilities and the treaty terms. Compute and storage become library books: checked out, returned,
  visible on the board (who's using the forge; how hot it runs).

NAS = the spillover spine's natural home (the tiered hot→cold memory arc); the 4090/3090 = the 081KTSZN10008QG0R000VZHRQ4
GPU rung's bench; the Pi = slice 2's metal.

## Pointers

- 081KTSZN10008QG0R00349SM6P (the ladder; slice 1 = this PR's CI job) · 081KTSZN10008QG0R000VZHRQ4 (GPU rung — the 4090/3090 bench) ·
  081KTSZN10008QG0R0003SDRWD (the board that shows library usage).
- `docs/HARDWARE-CAPABILITY-MATRIX.md` — where each closed-over device gets its row.
- the feel charter + `universal/color.md` (the boot screen's dress code) · GRUB loopback chainload
  (prior art for member ISOs) · Ostrom 1990 (the commons).
