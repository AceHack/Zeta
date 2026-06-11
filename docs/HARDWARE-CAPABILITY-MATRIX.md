# Hardware Capability Matrix — what we support, where, honestly (B-1024)

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
| **qemu-aarch64** | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | **UNKNOWN — the B-1024 first slice** | none yet (the next green to buy) |
| **raspberry-pi-4/5** (metal) | UNKNOWN (arm64 .NET exists upstream) | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN (RNS upstream supports Pi) | UNKNOWN | Aaron has the hardware; nothing recorded |
| **microcontroller class** (RNode-ish) | ❌ honest-no (no .NET) | ❌ | UNKNOWN (no_std uninvestigated) | UNKNOWN (a C CHIP-8 fits the class) | ❌ (sim is .NET) | UNKNOWN (RNode firmware proves the radio layer) | ❌ | class analysis only — the honest-capability probe is B-1024 rung 5 |
| **nixos-x64** | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | named in the 6×6×6 room axis; no recorded run |

Legend: ✅ proven green · ❌ honest-no (class can't carry it — declared, like Mono1) · UNKNOWN = no
evidence either way (NOT a no; a cell waiting for its first run).

## Friction map (the red/UNKNOWN cells, priced)

1. **qemu-aarch64 boot** — the B-1024 acceptance slice: one CI job boots an ISO in QEMU, runs one
   oracle suite inside, green. Unlocks the whole hardware axis (DST for hardware: same image, same
   inputs, same bytes — emulated first, then metal).
2. **Pi bring-up** — blocked only on slice 1 + Aaron's bench time; .NET arm64 + RNS on Pi are both
   upstream-supported, so expected friction is LOW (the cell is UNKNOWN, not hard).
3. **Rust `no_std` probe** — the one language oracle with a plausible microcontroller story; nobody
   has looked (cheap to scout).
4. **RNS daemon real-wire** — the sim is proven; the `rnsd` integration is the FinalizerRuntimeLive
   named follow-up. Friction unknown until tried.

## Heat

Per-target heat (irreversible work spent vs cooling headroom) comes from the `SoftThrottle` ledger
(`heatSpent`/`coolingHeadroom`) once a target runs the room loop; today only dev-machine runs record it.
Broadcasting these columns over DORA/LLMTV is Moonshot #1's first metric set.

## Pointers

- `docs/backlog/P2/B-1024-...md` — the ladder this matrix serves (QEMU → microkernel/ISO → Pi → MCU → speak-to-TV).
- `universal/color.md` — the honest-capability rule this table instantiates.
- B-0830 / B-0823 / B-0853 — the ISO lineage slice 1 boots; B-0725 — accelerator hardware (a future column group).
- `.github/workflows/` — the evidence source for every ✅ above.
