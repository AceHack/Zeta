# sim·mea·cut — the soft substrate, rooms-as-sign-off, toward .NET-in-shaders

Status: ACTIVE — operator-self-claimed (Aaron 2026-06-10, the night-long stream). Heavy concept set; this
RESUME is the reload point so it doesn't have to be held all at once.
Last refreshed: 2026-06-10
Current focus (Aaron): **rooms being the sign-off** + a **soft `IScheduler` inside rooms**.
Next concrete action: finish soft `GameFingerprint` (MinHash) + `FingerprintPrism` (#4 below) while Aaron
drives the soft scheduler.

## The one-line arc

**memory is lensable → reverse-engineer hard↔soft → lensing-over-time finds the quasi-time-crystals
(the repeating patterns = the *meaning* the compiler discarded) → tracing-JIT / PGO those → run on the
GPU → eventually the .NET runtime (IL + GC) in shaders.** Rooms wrap IO in uncertainty at the *promise*
level; `mea` collapses; the finalizer commits; a room *resolving* is the sign-off.

## The verb family (the CLI / the loop)

`sim · mea · cut · ben · cla · res` (diskpart-style abbrev: full word AND any unambiguous prefix).

- `sim` simulate — ephemeral, **void** (identity comes from the void); no output.
- `mea` measure — `mea(sim)`, the committing lift; posts ΔU to `uncertainty/`. F# spelling: **`sim |> mea |> cut`** (pipe, NOT bare juxtaposition — left-assoc).
- `cut` — cut at a recognition site (a TIME; default 30s); residue = Z-set delta + seam, re-ligated by the finalizer.
- `ben` benchmark · `cla` classify · `res` resolve (loop until fixed point).
- Commit semantics: `sim` leaves nothing; `mea`/`cut`/etc. commit to a branch → the **test finalizer merges to main**. (`clis/Verbs.fs` stubs + `clis/README.md`.)

## Built tonight (real code, tested, on main)

- `src/Core/Sim.fs` — the `sim` entrypoint (deterministic loop; DST-tested; 5-platform green).
- `src/Core/CliVerb.fs` — diskpart verb resolver (`mea`==`measure`).
- `src/Core/Optics.fs` — `ILens` (lensable) + `IPrism` (prismable/fingerprintable); lens/prism laws tested.
- `src/Core/UniversalNumber.fs` — hexagonal **port** + first **adapter** (`BigInteger`); bits/exact accounting.
- Infra: headscale→ArgoCD (`full-ai-cluster/k8s/applications/headscale`); the `lint (yaml/k8s)` gate (yamllint+kubeconform, declarative via `.mise.toml`, install.sh+install.ps1 in sync); GRUB2 multiboot scaffold (`full-ai-cluster/usb-nixos-installer/multiboot/`).

## Prior art FOUND (do NOT reinvent — look-don't-infer wins from tonight)

- **TriBoolean middle-out Float** = our BigFloat / universal number carrier: `src/Core.{FSharp,CSharp,Rust}.TriBoolean/Float*` + `src/Core.TypeScript/tri-boolean-float/`; **proven 4/4** (PROVEN-COVERAGE). Middle decodes the ends; trits T/F/N; `measure` collapses = `mea` at the number scope.
- **ISR Kleisli arrow** = the soft-scheduler START: `src/Core/IntrCtx.fs` — `ISR<'A,'B> = IntrCtx -> 'A -> Task<Result<'B,InterruptFeedback>>`; `>=>` composition; `InterruptKind` (8 interrupts). Task = the future; the soft promise = the ISR arrow.
- **SoftValue** (`src/Core/SoftValue.fs`) — Bayesian value-axis uncertainty (resolve when confident else held). **SoftChip8** + the soft-CHIP-8 stack. **GameFingerprint** (hard exact) + **StructureFingerprint** (has soft `similarity`).

## The concept map (each → its capture doc, all docs/research/2026-06-10-*)

- **Filesystem IS the startup MerkleDAG** + the sim/mea/cut triad (MacVector-for-DNA): `...filesystem-is-the-startup-merkledag-and-the-sim-mea-cut-cli-triad-macvector-for-dna.md`
- **sim is void; mea needs injected I/O; reified types via type providers + Roslyn gens; recursive sim in compiler** (same doc; corrections folded).
- **Tests become cells with strict boundaries** (Markov membrane; room=physics-accounting demon; Reticulum/disk crossings = injected IEffects, per-subsystem = params of the room; rooms=useful-work, require hats, agents pick hats per iteration): `...tests-become-cells-with-strict-boundaries-...md`
- **Rooms = IO-packet wrappers; uncertainty at the PROMISE level** (Promise Theory/Burgess): `...rooms-are-io-packet-wrappers-...md`
- **Physics of floats OVER Bayesian inference; Resolution primitive (unum=universal number); BigFloat (not bigint)**: `...physics-of-floats-room-boundary-is-a-bit-budget-...md` + `universal/number.md` (one interface, many backends; bigint+TriBoolean; coercing override opt-in; living-things risks).
- **Forcing lensability (CHIP-8/Cheat-Engine, everything a lens by address); heap = common-seed-lensed (shader-GC dissolved); interrupts unrolled to single-threaded loops; lensing-over-time finds quasi-time-crystals; arrow tracks state, per-crystal ownership**: `...forcing-lensability-chip8-...md`
- **.NET (IL + runtime + GC) in shaders — the telos; IL runner hard-first + soft; Cheat-Engine = JIT over CPU instr; reverse-engineer hard↔soft (per-game, GameFingerprint-keyed); tracing-JIT/PGO; recover the MEANING (designers think in repeating patterns = ECS, not assembly)**: `...dotnet-runtime-in-shaders-telos-...md`
- **sim|>mea|>cut = DNA polymerase (cut = proofreading exonuclease); poly-mer-ACE (ace=close-over)**: `...sim-mea-cut-is-dna-polymerase-...md`
- **Every bug has economic value** (rule): `.claude/rules/every-bug-has-economic-value.md` · **interfaces free, classes earned under rules/** (meta-rule): `.claude/rules/interfaces-free-classes-earned-under-rules.md` + `meta/`.

## Build queue (toward rooms-as-sign-off + soft scheduler + shaders)

1. **Soft `IScheduler`** — on the ISR arrow (`IntrCtx`); the loop running ISR on `InterruptKind` in rooms; unrolled-interrupt single-threaded loops; lensed-seed heap. *(Aaron driving.)*
2. **Wire `SoftValue` into the ISR `Result` channel** — value-axis uncertainty into the promise/arrow.
3. **IL runner** — hard regular IL first (close-over-compilers; Bonsai yin/yang), soft both eventually → soft .NET mini-CPU → our own runtime → shaders.
4. ~~**Finish soft `GameFingerprint` (MinHash similarity) + `FingerprintPrism`** — switch games staying soft.~~ **DONE (#7527):** `src/Core/FingerprintPrism.fs` — `Rainbow` table → `hard` (exact, `GameFingerprint.key`) + `soft` (nearest by MinHash Jaccard, insertion-robust) `IPrism`; `softBytes`/`softBytesSimilarity`; 5/5 tests; doesn't touch proven-4/4 GameFingerprint.fs. **CHIP-8 = the soft scheduler's first client** (SoftChip8 60Hz timer/interrupt loop on the `IntrCtx` ISR arrow validates the scheduler at minimal-VM scale; `FingerprintPrism.soft` picks/switches the game staying soft). **Math-team models** get an execution substrate: Nash = fixed-point time-crystals, Bayesian convergence = `SoftValue.observe`/`res`, board-room params = room configs; toy=DoP1/null-IO vs real=DoPN/injected-IEffects, same code path.
5. **rooms-as-sign-off** — a room resolving = approval (finalizer + soft scheduler); replaces per-action human gates.
6. Loose: `sim`/`mea`/`cut` console binary; shader memory/GC; the lensability/time-crystal detector; parser-gen→CHIP-8 + interrupts = the game.

## Founding why (lived tonight)

The pattern felt like "nothing" on waking, then "everything" when reloaded — the feeling tracks *load*,
not worth. That's why this RESUME exists: event-source the pattern so losing it is temporary, not final.
See `memory/user_zeta_felt_like_nothing_on_waking_then_everything_*`.
