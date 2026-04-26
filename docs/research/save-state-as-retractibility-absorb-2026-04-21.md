# Save-state as runtime retractibility — absorb note, 2026-04-21

**Status:** absorb note per `feedback_absorb_emulator_ideas_not_code_clean_room_safe_targets.md`.
Ideas-absorption only — no code, no BIOS, no protected
surfaces. Clean-room-safe target corpus: MAME / higan /
bsnes / Mesen / PCSX-ReDux / Mednafen / open-hardware
platforms. Source material is engineering-shape as
described in public open-source emulator architecture
notes and academic papers on deterministic emulation;
nothing here is a port, a transcription, or derivative
of any emulator's implementation.

## What a save-state is (engineering-shape)

A save-state is a byte-exact snapshot of the emulated
machine's complete state at one point in simulated time:

- **CPU registers** (every architectural register, every
  flag, the program counter, the interrupt-enable state).
- **RAM contents** (work RAM, video RAM, save RAM where
  battery-backed).
- **Cycle counter** (how many cycles this CPU / PPU /
  APU has executed this frame; in cycle-accurate
  emulators, sub-instruction accurate).
- **DMA / bus state** (in-flight transfers, arbitration
  state, pending writes).
- **Peripheral state** (PPU frame position, APU wave
  generator phases, controller input latches, cartridge
  mapper banks).
- **Any "undocumented" state** an engine relied on —
  open-bus residue, IRQ latches, RAM-retention decay on
  cold-boot.

A save-state loader is a **structural inverse**: reading
the snapshot reconstructs the whole VM such that
execution resumes **byte-identically** from that point —
the same next instruction, the same next frame, the same
next sample. Determinism is contractual; anything less
and TAS tooling breaks.

## Why this resonates with Zeta

Zeta's operator algebra is retraction-native: every
operator has a retraction (`D`, the differentiator, is
the retract of `I`, the integrator, up to the usual
`z⁻¹` delay). A retractible pipeline can un-apply any
delta: `I(D(x)) = x` holds by construction.

Save-state is the **same shape at a coarser granularity:**

| Emulator layer                  | Zeta layer                                      |
|---------------------------------|-------------------------------------------------|
| Save-state snapshot             | ZSet snapshot at a given clock                  |
| Save-state load                 | Retraction to a prior clock + replay forward    |
| Cycle counter                   | DBSP logical clock                              |
| Byte-identical resume           | Retraction-invariance (`I(D(x)) = x`)           |
| TAS input-movie replay          | Deterministic input-log replay                  |
| Cartridge mapper bank-switch    | `View<T>@clock` paraconsistent overlay          |
| Undocumented timing reliance    | Composite-invariant registry                    |

The pattern match is not metaphorical; both are
*first-class retractibility at the process/VM level*.
Emulators have shipped the pattern continuously since
the mid-1990s (ZSNES, Nesticle, bsnes). The pattern is
battle-tested: TAS communities distribute 10-hour input
movies that reproduce byte-exact play across thousands
of independent runs. That is stronger replay discipline
than mainstream property-based testing typically
achieves.

## What Zeta can absorb (engineering-shape only)

1. **Snapshot-point discipline.** Save-state emulators
   have a small, well-defined list of "safe to snapshot
   here" points in the cycle — never mid-instruction,
   never mid-DMA, never in the middle of a PPU scanline
   transition. Zeta pipelines have the analogous
   question: where in a circuit evaluation is a ZSet
   snapshot byte-identically resumable? The current
   answer is "between ticks", but emulator practice
   suggests formalising the safe-points as a first-class
   invariant the planner consults. (**Absorb target:
   composite-invariants registry.**)

2. **State enumeration as a type.** Good emulators
   encode the entire VM state as a (usually flat)
   serializable struct — one type that enumerates every
   field that must survive save/load. "Any state not in
   this type is not preserved by save-state" becomes a
   type-level contract. Zeta's equivalent: the explicit
   per-operator state type (e.g., `Spine` for joins,
   `IndexedZSet` for group-by) already partly does this,
   but "any state outside the state type is
   non-retractible" is not yet a type-checkable
   invariant. (**Absorb target: operator-state
   discipline → add a Roslyn/FSharp.Analyzers rule that
   flags stateful fields outside the declared state
   type.**)

3. **Deterministic replay as total-evidence.** TAS
   input-movie format: `(frame, controller_state)*`
   replayed byte-by-byte reconstructs the original run.
   Zeta's equivalent: `(clock, ZSet_delta)*` replayed
   byte-by-byte reconstructs the pipeline's prior state.
   Zeta already has the ingredients (retraction-native
   operator algebra, stable hashing); what emulator
   practice adds is **input-log-as-total-evidence for
   regression-replay in CI** — a failing integration
   test ships a tiny input movie that reproduces the bug
   on any runner byte-for-byte. (**Absorb target: CI
   retractability inventory + regression-replay
   surface.**)

4. **Bank-switching as address-space overlay.** NES
   mappers (MMC1/MMC3), SNES HiROM/LoROM, Game Boy MBC1-5,
   PS1 paged TLBs — all swap which physical memory backs
   a given logical address range, typically via a small
   bank-select register. Zeta's `View<T>@clock` is the
   exact same shape: which underlying snapshot is "live"
   at a given address (clock), selected by overlay
   register. (**Absorb target: `View<T>@clock`
   paraconsistent-superposition — the bank-switching
   shape justifies treating overlay-select as a
   first-class pipeline operator rather than a debugging
   affordance.**)

5. **JIT recompilation with retractible caches.**
   Dolphin (GameCube/Wii) and RPCS3 (PS3) do dynamic
   recompilation: they compile guest instructions into
   host instructions on the fly. Self-modifying guest
   code invalidates the compiled cache for the affected
   address range. The invalidation is *retractible* by
   design — re-running the guest after a cache-flush
   produces identical output because the cache is just a
   memoisation. Zeta's incremental compilation under
   retraction has the same shape: compile-time
   evaluation caches must invalidate cleanly on spec
   mutation without changing observable semantics.
   (**Absorb target: compilation-cache invariants —
   formalise "cache is a memoisation, not a state" as a
   type-level rule.**)

6. **Cycle-accurate heterogeneous scheduling.**
   higan/bsnes, Mesen, Mednafen schedule CPU + PPU + APU
   + DMA at sub-instruction granularity, because
   software relied on exact cycle counts (e.g., the SNES
   mid-scanline HDMA timing). Zeta's heterogeneous
   operators (stateful / stateless / windowed / joined)
   have varying cost profiles that Imani's planner
   cost-model already surfaces. Emulator scheduling adds
   the idea of **committed-cycle budget** — each
   operator announces a cycle budget before a tick, and
   the planner arbitrates who runs next based on
   elapsed-vs-budget. (**Absorb target: planner
   cost-model — add a committed-cycle-budget dimension.**)

## What is **not** absorbed

- **No emulator source code.** Not transcribed, not
  ported, not "translated-to-F#". The engineering-shape
  is public knowledge; the bytes are each project's own.
- **No proprietary BIOS / bootrom / firmware.** Aaron
  explicit per
  `feedback_absorb_emulator_ideas_not_code_clean_room_safe_targets.md`.
- **No ROM bytes.** The save-state patterns absorb;
  save-state files produced from protected games do not.
- **No DRM circumvention research.** Denuvo / PlayReady
  / Widevine are adversarial-surface out of scope per
  CLAUDE.md never-fetch discipline.
- **No Switch-era work.** Yuzu / Ryujinx 2024
  enforcement precedent excludes this surface; even
  ideas-absorption from firmware-key-dependent
  emulation risks taint.

## Math-safety check

Per `feedback_no_permanent_harm_mathematical_safety_retractibility_preservation.md`,
this absorb note is mathematically safe because:

- **Ideas are retractible.** If a mapping in the table
  above turns out to be wrong (e.g., bank-switching
  doesn't cleanly match `View<T>@clock`), a dated
  revision block in this note additively corrects;
  prior state stays in git history.
- **No distributed-code entanglement.** No emulator
  project's code or protected assets ever enter Zeta's
  repo or build artifacts, so there is nothing that
  could need to be "un-distributed" under takedown.
- **Retractibility is preserved.** Every absorb-target
  listed above strengthens Zeta's retractibility
  posture rather than weakening it — save-state
  discipline IS retractibility at a coarser grain.

## Three-filter discipline

1. **F1 engineering-first** ✓ — every absorb target
   maps to a surface Zeta already has or was reaching
   for (composite-invariants registry, operator-state
   discipline, CI replay, `View<T>@clock`, compilation
   cache, planner cost-model). The filter is satisfied:
   we would have reached for these absorb targets via
   our own engineering before noticing the emulator
   parallel.
2. **F2 structural-not-superficial** ✓ — the match is
   structural (retractibility-at-VM-grain vs.
   retractibility-at-ZSet-grain), not nominative
   (nobody is suggesting we name anything "Mesen"). The
   byte-identical-resume contract is the invariant
   being matched, not the word "save-state".
3. **F3 tradition-name-load-bearing** ✓ — emulator
   communities are a multi-decade tradition (1990s-
   present); TAS communities have institutional
   practice (TASVideos.org, 20+ years of input-movie
   archiving); academic treatment exists (cycle-accurate
   emulation papers from Higan/bsnes authors). The
   tradition is load-bearing and cited.

## Priority

**P3 — long-running research posture.** Per Aaron's
*"backlow down low"*. Per-idea M-effort landings when
the factory surface is actually reaching for the
pattern — no forcing function from this note alone.

## Cross-references

- `feedback_absorb_emulator_ideas_not_code_clean_room_safe_targets.md`
  — the memory that authorises this absorb note and
  sets the safety boundaries.
- `feedback_no_permanent_harm_mathematical_safety_retractibility_preservation.md`
  — the math-safety framing for ideas-vs-code absorb.
- `feedback_see_the_multiverse_in_our_code_paraconsistent_superposition.md`
  — `View<T>@clock` paraconsistent overlay, the
  absorption home for bank-switching.
- `docs/BACKLOG.md` — P3 "noted, deferred" emulator
  ideas row (commit `180f110`) is this note's
  forward-pointer.
- `docs/research/ci-retractability-inventory.md` — the
  current CI-replay surface that the TAS input-movie
  pattern would extend.
