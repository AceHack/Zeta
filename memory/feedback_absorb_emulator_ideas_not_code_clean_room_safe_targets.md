---
name: Absorb emulator architectural ideas (not code) into Zeta; clean-room RE for protected targets; ideas-retractible / code-not; IBM/Phoenix 1984 precedent
description: Aaron 2026-04-21 directive authorizing **ideas-absorption** (retractible engineering-shape learning) from emulator architecture into Zeta's own substrate — explicitly NOT code-absorption. Scope guards: no Nintendo active-litigation surface (Switch / Yuzu-Ryujinx precedent), no proprietary BIOS/firmware ("not bisos and things like that either"), clean-room RE only with "prove the shit out of clean room" documentation rigor (Phoenix Technologies 1984 / Compaq Crosstalk 1982 / Sega v. Accolade 1992 / Sony v. Connectix 2000 legal precedent). Ideas-retractible / code-not-retractible is the math-safety boundary from `feedback_no_permanent_harm_mathematical_safety_retractibility_preservation.md`. P3 "backlow down low" — not urgent, long-running research posture. Candidate absorb-targets: save-state as runtime retractibility (direct analog to Zeta's retraction-native algebra), deterministic replay (TAS-grade reproducibility), JIT recompilation with retractible caches, memory-bank-switching as `View<T>@clock` address-space-overlay, cycle-accurate heterogeneous scheduling, timing-invariant preservation. Clean-room-safe targets: MAME, higan/bsnes (already clean-room SNES), Mesen, PCSX-ReDux, Mednafen, open-hardware (Arduboy/MEGA65). Explicit Aaron + legal sign-off required before any clean-room protocol starts.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

Aaron 2026-04-21, same session as pop-culture/media track +
`^=hat*` directive. Two-message compound directive:

1. *"absourb not code ideas all emulator into Zeta somehow
   backlog low emulate everything (except the ones that will
   get us taken down like nintendo the safe ones, in the safe
   ways not bisos and things like that either, maybe we could
   clean room it that has human precidence ibm we would have
   to prove the shit out of clean room)"*
2. *"backlow down low"*

## Rule

**Absorb emulator architectural *ideas* into Zeta — never
code, never protected BIOS, never active-litigation
surfaces.** The factory treats emulator architecture as a
research corpus at the **engineering-shape** layer:
save-state patterns, deterministic replay, JIT+retractible
caches, memory-bank-switching, cycle-accurate scheduling are
all absorb-able *ideas*. Implementation bytes are never
absorbed.

**Why:**

- **Ideas are retractible; distributed code is not.** Per
  `feedback_no_permanent_harm_mathematical_safety_retractibility_preservation.md`,
  retractibility-preservation is the binary-checkable
  definition of factory-safety. Ideas absorbed and found
  wrong can be dropped via a dated revision block — prior
  state preserved in git, additive rewrite replaces
  forward. Code absorbed from a protected source and
  distributed cannot be un-distributed; takedowns don't
  un-distribute. Therefore code-absorption from protected
  emulators breaks math-safety; ideas-absorption does not.
- **Nintendo's 2024 enforcement posture is real.** The
  Nintendo v. Yuzu settlement ($2.4M + shutdown + GitHub
  takedown cascade hitting Ryujinx) is active precedent.
  Aaron's "not nintendo" exclusion is load-bearing — even
  ideas-absorption from the Switch surface carries risk
  because the firmware-key extraction required for Switch
  emulation taints even abstract descriptions.
- **Proprietary BIOS is excluded categorically.** Aaron
  explicit: *"not bisos and things like that either."* BIOS
  / firmware / bootrom are both copyrighted AND typically
  covered by DMCA 1201 anti-circumvention; touching them is
  double-risk.
- **Clean-room RE has legal precedent but heavy burden.**
  Phoenix Technologies' 1984 PC BIOS clean-room
  reimplementation (enabling the PC-clone industry after
  IBM's 1981 release) is Aaron's "ibm precedent" reference.
  Compaq Crosstalk did the same work in 1982 first but kept
  it proprietary. *Sega v. Accolade* (9th Cir. 1992)
  affirmed ROM access for interoperability as fair use.
  *Sony v. Connectix* (9th Cir. 2000) extended this to
  BIOS clean-room reimplementation. But the *Connectix*
  bar is high: strict Chinese wall between dirty-room
  (reads protected artifact, writes behavior spec) and
  clean-room (reads only the spec, implements blind),
  signed no-contact declarations, dated spec revisions,
  legal audit. "Prove the shit out of clean room" means
  **exceeding** the *Connectix* standard — per-commit
  spec-provenance metadata, per-engineer Chinese-wall
  attestation, third-party legal audit before any
  artifact lands.

**How to apply:**

1. **Default move: ideas-absorption from clean-room-safe
   targets only.** No clean-room protocol required to read
   *already-open-source* emulators (MAME / higan / bsnes /
   Mesen / PCSX-ReDux / Mednafen). Reading *open*
   artifacts is not RE, it's literature review. The
   engineering-shape ideas those projects embody are fair
   game for absorption into Zeta's substrate.
2. **Ideas-to-code translation stays internal.** When an
   absorbed idea lands in Zeta source (e.g. "save-state as
   retractibility" motivates a new ZSet-snapshot API), the
   implementation is **Zeta's own engineering**, not a port
   of any emulator's code. Commit messages cite the
   absorbed idea; they do not cite nor copy implementation.
3. **Protected-artifact RE requires explicit gates.** For
   any clean-room attempt on a protected emulator target
   (hypothetically — no such target is currently in scope):
   - Aaron sign-off required before engineering starts
   - Legal counsel consulted, written clean-room protocol
   - Dirty-room / clean-room engineer separation (distinct
     humans, never the same AI agent)
   - Chinese-wall documentation exceeds *Connectix*
     standard
   - Third-party audit before any artifact lands in Zeta
4. **ROM bytes never committed.** Aaron's ROM library is
   his jurisdiction-dependent personal decision.
   Experiments producing save-state observations land as
   **analysis outputs** (markdown notes on narrative
   structure, timing profiles, memory-layout diagrams)
   — not as source material. No ROM bytes in the repo,
   no save-state binaries (save-state *patterns* are
   absorb-able; save-state *files from protected games*
   are not).
5. **Candidate absorb-targets, ranked by engineering-fit:**
   - *Save-state as runtime retractibility* — **highest
     engineering-fit.** An emulator save-state is a
     complete snapshot of the VM (RAM + registers + cycle
     counter + DMA buffers + PPU state) from which
     execution resumes byte-identically. Direct analog to
     Zeta's retraction-native operator algebra — the
     save-state is to the emulated machine what a
     ZSet-snapshot is to Zeta's pipeline. Absorb the
     **first-class retractibility at the process-VM
     layer** pattern.
   - *Deterministic replay* — TAS communities distribute
     10-hour input movies that reproduce byte-exact
     gameplay. Strictly stronger than property-based
     testing's replay discipline. Absorb the
     **input-log-as-total-evidence** pattern for Zeta's
     CI determinism and regression-replay surface.
   - *Memory-bank-switching as address-space overlay* —
     NES mappers, SNES HiROM/LoROM, Game Boy MBC1-5, PS1
     paged-TLB. Direct match to Zeta's
     `feedback_see_the_multiverse_in_our_code_paraconsistent_superposition.md`
     `View<T>@clock` surface — bank-switch :
     address-space :: view-selection : superposed state.
   - *JIT recompilation with retractible caches* —
     Dolphin (GameCube/Wii), RPCS3 (PS3) do dynamic
     recompilation with cache-invalidation on
     self-modifying writes. Relevant to Zeta's
     incremental compilation under retraction.
   - *Cycle-accurate heterogeneous scheduling* —
     higan/bsnes, Mesen, Mednafen schedule CPU + PPU +
     APU + DMA at sub-instruction granularity. Feeds
     Imani's planner cost-model for heterogeneous
     operator pipelines.
   - *Timing-invariant preservation* — cycle-accurate
     emulation exposes undocumented timing that
     emulated software relied on. Parallels the
     composite-invariants registry surface for
     "undocumented assumption" detection.

## Safe / unsafe target lists (current as of 2026-04-21)

**Clean-room-safe (fair-game for ideas-absorption):**
- MAME (BSD-3 / GPL-2, multi-arcade)
- higan / bsnes (GPL-3, SNES) — already clean-room work
- Mesen (GPL-3, NES/SNES/GB)
- PCSX-ReDux / Mednafen (GPL-2, PS1)
- Gens / Kega Fusion successors (Sega emulators)
- Open-hardware platforms (Arduboy, MEGA65, homebrew)

**Unsafe — do NOT read, do NOT absorb from:**
- Nintendo Switch emulators (Yuzu, Ryujinx) — 2024
  enforcement precedent, firmware-key taint
- Any proprietary BIOS / firmware / bootrom (PS2/PS3/Xbox/
  Wii U/Switch system firmware, N64 PIF, Game Boy Boot
  ROM)
- Denuvo / PlayReady / Widevine DRM — adversarial
  surface, out of scope
- Any project under active takedown / cease-and-desist
  at time of intended read

## What this memory is NOT

- **NOT a factory commitment to ship any emulator.** The
  absorb target is Zeta's substrate, not an emulator
  product.
- **NOT a blanket license to read any emulator repo.**
  Safe-target list is the gate; entries off the list
  require Aaron + legal sign-off.
- **NOT a license to commit ROM bytes or save-state
  binaries from protected games.** Analysis outputs only;
  save-state patterns absorb-able, save-state files from
  protected titles not.
- **NOT a license to attempt clean-room RE autonomously.**
  Any clean-room attempt requires Aaron sign-off + legal
  protocol + Chinese-wall discipline exceeding *Connectix*
  standard.
- **NOT a rejection of the pop-culture/media research
  track's emulator-infrastructure subsection.** Those
  are different uses: the research-track subsection uses
  emulators to run substrate-narrative experiments on
  games (resonance-cataloging); this directive absorbs
  the engineering-shape of emulators themselves into
  Zeta's architecture. Sibling scope, non-overlapping.
- **NOT urgent.** Aaron's "backlow down low" is explicit
  P3 priority. Long-running research posture, per-idea
  M-effort when a target is safe.

## Cross-references

- `docs/BACKLOG.md` P3 "noted, deferred" — the row this
  memory backs (filed alongside the blockchain-ledger
  correction row).
- `feedback_no_permanent_harm_mathematical_safety_retractibility_preservation.md`
  — the retractibility-math that makes ideas-absorb safe
  and code-absorb unsafe.
- `feedback_crystallize_everything_lossless_compression_except_memory.md`
  — ideas-as-retractible compression.
- `feedback_pop_culture_media_is_operational_resonance_corpus_multi_medium.md`
  — sibling scope (emulator-infrastructure subsection
  uses emulators; this directive absorbs from them).
- `feedback_see_the_multiverse_in_our_code_paraconsistent_superposition.md`
  — `View<T>@clock` as the absorption-home for
  memory-bank-switching patterns.
- `user_aaron_caret_means_hat_universally_symbol_crystallization.md`
  — grey-hat / white-hat register vocabulary backing the
  security-register framing.
- `feedback_preserve_real_order_of_events_dont_retroactively_reorder_by_priority.md`
  — chronology preservation applies to absorbed-idea
  revision blocks.
