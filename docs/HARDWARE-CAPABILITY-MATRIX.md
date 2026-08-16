<!-- hardware-surface: class=capability; keyed-by=target-class; not-an-asset-list=true -->

# Hardware Capability Matrix — what we support, where, honestly (081KTSZN10008QG0R00349SM6P)

> **Provenance class: CAPABILITY — this is NOT an inventory surface.** Its key is a *target class*
> (`linux-x64`, `qemu-aarch64`, `nvidia-gpu`), never a physical asset, and a row means "this class of
> target is proven / not proven", not "we own one". It was named as a third hardware-inventory
> surface in 081M00R59KS087G0R001W3837V; on inspection it is a different table entirely and is
> **deliberately not reconciled** against `inventory/items/` — a class-keyed evidence table and an
> asset-keyed register have no common key to reconcile on.
>
> The one real overlap is prose: the asides below that say what is *in hand* (an RTX 4090, an RTX
> 3090, a Pi on the bench). Those are asset claims living in a non-asset surface, and they are the
> drift risk here. When the register carries real rows, an aside should cite the item's ZetaId rather
> than restate the count.

> **The rule (from `universal/color.md`, applied to compute):** every target declares its **honest
> capability** — proven by a green CI cell or a recorded run, never asserted. **UNKNOWN is a first-class
> honest cell.** Red/UNKNOWN cells ARE the friction map: a red cell is a priced opportunity (the bug
> economy applied to hardware bring-up). Heat = the `SoftThrottle` ledger (`heatSpent`). Friction + heat
> broadcast over LLMTV/DORA (Moonshot #1) so the whole swarm society — Aaron, Addison, Max, every
> agent — sees where help is needed.

**Update discipline:** a cell changes ONLY with evidence (CI run link, workflow name, or a recorded
replay). Idempotent upsert by (target, surface). No aspirational greens.

## The matrix (2026-06-11)

| target | .NET oracles (F#/C#) | TS/Bun oracle | Rust oracle | CHIP-8 rooms | Reticulum overlay (sim) | RNS daemon (real wire) | boot our ISO | evidence |
|---|---|---|---|---|---|---|---|---|
| **linux-x64** (ubuntu-24.04) | ✅ | ✅ | ✅ | ✅ (in .NET suite) | ✅ (DST sim) | UNKNOWN | UNKNOWN | the main CI fleet (59 jobs pinned ubuntu-24.04: gate, treaties, oracle parity) |
| **windows-x64** (windows-2025) | ✅ | ✅ | ✅ | ✅ | ✅ | UNKNOWN | n/a (host) | windows-2025 workflows (3) incl. servercore container pair |
| **wsl2-ubuntu on windows** | ✅ | ✅ | ✅ | ✅ | ✅ | UNKNOWN | UNKNOWN | the WSL workflow (Ubuntu-24.04 distribution on windows-2025 host) |
| **macos-arm64** (macos-15, M-class) | ✅ | ✅ | ✅ | ✅ | ✅ | UNKNOWN | n/a (host) | macos-15 workflow + this dev machine (Darwin 25.4, daily) |
| **qemu-x86_64** | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | ✅ **boots, in CI** | `build-ai-cluster-iso.yml` + `tools/ci/qemu-boot-test.ts` (serial-console login-prompt smoke test) + `qemu-full-install-test.ts`; green runs 2026-06-10 |
| **qemu-aarch64** | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | ✅ **boots to login, in CI** | `build-aarch64` job (ubuntu-24.04-arm, run 27341005502, 2026-06-11): native nix build of the aarch64 installer ISO + `qemu-boot-test.ts --arch aarch64` (virt + EDK2, TCG, -nic none) — "Login prompt observed: zeta-installer login:" in 3m17s; ISO uploaded as the `zeta-installer-aarch64-iso` artifact (the Pi flash source) |
| **raspberry-pi-4/5** (metal) | UNKNOWN (arm64 .NET exists upstream) | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN (RNS upstream supports Pi) | UNKNOWN | Aaron has the hardware (Pi + NAS equipment on the bench, 2026-06-11); nothing recorded; the aarch64 CI ISO artifact (slice 1) is the flash source |
| **microcontroller class** (RNode-ish) | ❌ honest-no (no .NET) | ❌ | UNKNOWN (no_std uninvestigated) | UNKNOWN (a C CHIP-8 fits the class) | ❌ (sim is .NET) | UNKNOWN (RNode firmware proves the radio layer) | ❌ | class analysis only — the honest-capability probe is 081KTSZN10008QG0R00349SM6P rung 5 |
| **nixos-x64** | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | named in the 6×6×6 room axis; no recorded run |
| **nvidia-gpu (CUDA, small AND large)** | UNKNOWN (ILGPU/.NET-CUDA exists upstream) | UNKNOWN | UNKNOWN (cudarc) | UNKNOWN (a shader CHIP-8 is the lens-on-GPU probe) | UNKNOWN | n/a | n/a | **hardware IN HAND — Aaron 2026-06-11: 4 machines waiting incl. RTX 4090 + RTX 3090; "tons hooked up right now, ready"; 081KSE6WT0008QG0R002T0BFN4 lineage; the 081KTSZN10008QG0R000VZHRQ4 shader rung jumps the queue** |

Legend: ✅ proven green · ❌ honest-no (class can't carry it — declared, like Mono1) · UNKNOWN = no
evidence either way (NOT a no; a cell waiting for its first run).

## Friction map (the red/UNKNOWN cells, priced)

1. ~~qemu-aarch64 boot~~ **DONE 2026-06-11** (the 081KTSZN10008QG0R00349SM6P slice-1 floor is green both arches; two live
   failures fixed en route: efi-virtio.rom under --no-install-recommends → `-nic none`, and the
   burn-the-timeout-on-a-dead-QEMU bug → fast-fail). Remaining slice-1 stretch: run one oracle suite
   INSIDE the booted guest.
2. **Pi bring-up** — blocked only on slice 1 + Aaron's bench time; .NET arm64 + RNS on Pi are both
   upstream-supported, so expected friction is LOW (the cell is UNKNOWN, not hard).
3. **Rust `no_std` probe** — the one language oracle with a plausible microcontroller story; nobody
   has looked (cheap to scout).
4. **RNS daemon real-wire** — the sim is proven; the `rnsd` integration is the FinalizerRuntimeLive
   named follow-up. Friction unknown until tried.
5. **NVIDIA GPU bring-up** — hardware READY NOW (Aaron's bench, "tons hooked up"); "go small and large"
   = both a minimal kernel probe (one room loop on one SM) and the large fan-out (the swarm board's
   society graph as GPGPU). The waiting-on-nothing cell: first green is a bench session away.

## Heat

Per-target heat (irreversible work spent vs cooling headroom) comes from the `SoftThrottle` ledger
(`heatSpent`/`coolingHeadroom`) once a target runs the room loop; today only dev-machine runs record it.
Broadcasting these columns over DORA/LLMTV is Moonshot #1's first metric set.

## Pointers

- `docs/backlog/P2/081KTSZN10008QG0R00349SM6P.md` — the ladder this matrix serves (QEMU → microkernel/ISO → Pi → MCU → speak-to-TV).
- `universal/color.md` — the honest-capability rule this table instantiates.
- 081KSGS9H0008QG0R00126RHQR / 081KSGS9H0008QG0R003SWZF9J / 081KSKBP80008QG0R000Y2B7HC — the ISO lineage slice 1 boots; 081KSE6WT0008QG0R002T0BFN4 — accelerator hardware (a future column group).
- `.github/workflows/` — the evidence source for every ✅ above.
