namespace Zeta.Clis

open System

// ─────────────────────────────────────────────────────────────────────────────
// The CLI verb family — sim · mea · cut · cla · res — as PURE INTERFACE STUBS.
//
// Meta-rule (.claude/rules/interfaces-free-classes-earned-under-rules.md): the rules
// of the game are interfaces — free, weight-free, no instance state. A concrete class
// must be EARNED under rules/. So the verb contracts are interfaces only.
//
// STUB: not yet wired into a project (clis/ is a root folder). The supporting types
// are opaque interfaces too — to be reified from git-history metadata via gen/ (F#
// type providers + Roslyn generators). The loop is `cut mea sim` by currying; res
// iterates it (the finalizer) until it resolves.
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

/// The full family. `cut mea sim` by currying IS the loop; `res` iterates it.
type ICli =
    inherit ISimVerb
    inherit IMeaVerb
    inherit ICutVerb
    inherit IBenVerb
    inherit IClaVerb
    inherit IResVerb
