namespace Zeta.Clis

open System

// ─────────────────────────────────────────────────────────────────────────────
// The CLI verb family — sim · mea · cut · cla · res — as PURE INTERFACE STUBS.
//
// Meta-rule (.claude/rules/interfaces-free-classes-earned-under-rules.md): the rules
// of the game are interfaces — free, weight-free, no instance state. A concrete class
// must be EARNED under rules/. So the verb contracts are interfaces only.
//
// The supporting types are opaque interfaces too — to be reified from git-history
// metadata via gen/ (F# type providers + Roslyn generators). The loop is
// `sim |> mea |> cut` (the pipe = cut(mea(sim)); bare `cut mea sim` is multi-arg
// application, NOT nesting — F# is left-associative); res iterates it (the finalizer)
// until it resolves.
//
// COMPILED since 081M08VM385087G0R001DTM0K6 (2026-08-17) via clis/Zeta.Clis.fsproj, in
// Zeta.sln. This header used to read "STUB: not yet wired into a project" — true when
// written, and the reason the two defects below stood undetected: no compiler had ever
// read this file. Aaron 2026-08-17: "clis/Verbs.fs this is our ultimate dogfood surface
// plus our universal interfaces" — so it is compiled, not retired.
//
// KNOWN, UNFIXED, AND DELIBERATELY SO — the documented loop above does NOT typecheck,
// for two INDEPENDENT reasons (both reproduced against the compiler, not inferred):
//   A. Nothing produces the value `mea` consumes. `ISimVerb.Sim` returns `unit`;
//      `IMeaVerb.Mea` consumes `ISim<'a>`; no member returns an `ISim<'a>`.
//   B. `cut` does not consume what `mea` produces, even given an `ISim` from elsewhere:
//      `ICutVerb.Cut` takes `ISim<'a>`, while `mea` yields `IMeasurement`. So fixing A
//      alone would not make the pipe compose.
// Deciding what `Sim` returns fixes the semantics of the interface everything else must
// conform to, and the "produces NO output (void)" docstring below reads as intent rather
// than oversight — so it is Aaron's call. The gap is witnessed as a type (not prose) in
// tests/Tests.FSharp/Clis/Verbs.Tests.fs, which also records that the braid sub-family
// (tie/braid/weave/bob) DOES compose end to end. Design analysis:
// docs/research/2026-08-17-sim-as-the-room-runner-*.md §3, §10 Q1.
// ─────────────────────────────────────────────────────────────────────────────

// ── Supporting types (opaque stubs; reified later via gen/) ──

/// The 128-bit common-cause seed.
type ISeed = interface end

/// Injected effects: null (DST) or real I/O (prod). Real I/O adds NEW external
/// observation; its absence does NOT make a measurement empty — sim carries
/// intrinsic persona entropy (git history, reified types) it can always measure.
type IEffects = interface end

/// An ephemeral simulation computation — the VOID base every verb lifts.
/// `sim` returns this as unit/void; identity comes from that (full) void.
type ISim<'a> = interface end

/// A committed measurement: the uncertainty reduction (the finalizer's ΔU).
type IMeasurement = interface end

/// A Z-set delta (DBSP: +1 assertions / −1 retractions) — the excised/inserted change.
type IDelta<'a> = interface end

/// The sticky-end cut boundary the finalizer re-ligates to main (the same/ ctxboundary).
type ISeam = interface end

/// A class label — the discriminator / lens.
type IClassLabel = interface end

/// A benchmark result — perf measurement (timing / allocations / throughput), distinct
/// from IMeasurement's uncertainty-reduction (ΔU). Lands in bench/.
type IBenchmark = interface end

// ── The verbs (3-letter stems; pure interface stubs) ──

/// sim(ulate) — ephemeral; produces NO output (void). The SETI@home edge run;
/// `sim <duration>` (bare = 30s). Identity comes from the void.
type ISimVerb =
    abstract member Sim: seed: ISeed * duration: TimeSpan -> unit

/// mea(sure) — `mea(sim)`: the committing lift over sim. Commits ΔU to the ledger.
/// Real I/O via DI (effects) adds new external observation.
type IMeaVerb =
    abstract member Mea<'a> : effects: IEffects * sim: ISim<'a> -> IMeasurement

/// cut — cut at a recognition site that is a TIME (default 30s): `mea(sim)` cuts at
/// 30s by default. Residue = a Z-set delta + a sticky-end seam (re-ligated to main).
type ICutVerb =
    abstract member Cut<'a> : at: TimeSpan * sim: ISim<'a> -> IDelta<'a> * ISeam

/// ben(chmark) — instrument the sim for performance: the benchmark loop is
/// `cut mea ben sim` (ben wraps sim, alongside mea's ΔU). Produces a perf result.
type IBenVerb =
    abstract member Ben<'a> : effects: IEffects * sim: ISim<'a> -> IBenchmark

/// cla(ssify) — assign the result to a class / lens (the discriminator).
type IClaVerb =
    abstract member Cla<'a> : sim: ISim<'a> -> IClassLabel

/// res(olve) — loop `mea` repeatedly until it resolves (a fixed point; finalizer-
/// iterated; shapes A/B/D). "Resolves" = converges (ΔU→0) AND gains resolution.
type IResVerb =
    abstract member Res<'a> : effects: IEffects * sim: ISim<'a> -> IMeasurement

/// The full family. The loop is `sim |> mea |> cut` (pipe = cut(mea(sim)); not bare
/// juxtaposition — F# application is left-associative); `res` iterates it.
type ICli =
    inherit ISimVerb
    inherit IMeaVerb
    inherit ICutVerb
    inherit IBenVerb
    inherit IClaVerb
    inherit IResVerb

// ─────────────────────────────────────────────────────────────────────────────
// The braid / soft-topology verbs — bob · weave · braid · tie (new 2026-06-10).
//
// Aaron: "bob weave braid tie all tie to 2x2 3x3 4x4 etc... structures that make
// effective qubits" + "topology is hairdressing." These are hairdressing words AND
// the operations of topological quantum computing (braid group / anyon braiding) —
// they BUILD the n×n effective-qubit substrate. Map (clis/VERB-MAP.md):
//   tie   → src/Core/FingerprintPrism.fs (`soft` Match) + WeightedSet soft links
//   braid → src/Core/QubitIso.fs (Pauli/SU(2)) + src/Core/Cl3.fs (Clifford Cl(3,0))
//   weave → src/Core/AmplitudeEmu.fs (complex amplitudes → interference)
//   bob   → the cut that sizes the structure (the n in n×n)
//   2→4→8 doubling = src/Core/CayleyDickson.fs (ℝ→ℂ→ℍ→𝕆; ℍ = SU(2) = one qubit)
// Peel: "effective qubits" = qubit-shaped linear algebra, classically simulated +
// replayable (BellTest reproduces Tsirelson 2√2 in DST); the braid-as-gate layer is
// to build. Stubs, like the six above; opaque supporting types reified later via gen/.
// ─────────────────────────────────────────────────────────────────────────────

/// A SOFT tie — a weighted/probabilistic link between elements. In the soft topology the *tie itself*
/// is soft (not crisp); `src/Core/FingerprintPrism.fs` `soft` is a concrete soft tie. The 2-strand join.
type ISoftTie<'a> = interface end

/// A braid — a braid-group element over strands (the pattern of crossings); an anyon braid = a gate =
/// a computation. Sturdy: the information lives in the crossings, not any one strand (= topological
/// fault-tolerance, the same reason a hair braid holds).
type IBraid<'a> = interface end

/// A woven structure — strands interlaced into one sturdy n×n effective-qubit structure.
type IWeave<'a> = interface end

/// tie — soft-link two strands into a soft tie (the binary 2×2 base of the n×n ladder).
type ITieVerb =
    abstract member Tie<'a> : a: ISim<'a> * b: ISim<'a> -> ISoftTie<'a>

/// braid — cross n strands in a pattern (a braid-group element = an effective-qubit gate). Interleaves
/// the independent deterministic choice-streams (the bob-weave braid over the shared seed).
type IBraidVerb =
    abstract member Braid<'a> : strands: ISim<'a> list -> IBraid<'a>

/// weave — interlace the braided strands into one sturdy n×n structure (build the effective qubit).
type IWeaveVerb =
    abstract member Weave<'a> : braid: IBraid<'a> -> IWeave<'a>

/// bob — cut the weave to a chosen length/dimension (the cut that *sizes* the structure — the n in n×n).
/// Residue is cut-shaped: a Z-set delta + a sticky-end seam the finalizer re-ligates.
type IBobVerb =
    abstract member Bob<'a> : at: int * weave: IWeave<'a> -> IDelta<'a> * ISeam

/// The braid / soft-topology sub-family (the effective-qubit constructors).
type IBraidCli =
    inherit ITieVerb
    inherit IBraidVerb
    inherit IWeaveVerb
    inherit IBobVerb
