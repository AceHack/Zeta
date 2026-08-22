namespace Zeta.Core

open System
open System.Globalization

/// **Erasure classification — the substrate-wide thermodynamic vocabulary.**
///
/// Landauer 1961 prices *logical irreversibility*: a step whose output does not determine its
/// input dissipates at least `kT·ln2` per bit lost. Bennett 1973 is the converse — a bijective
/// step erases nothing and is free. So the classifying question is **injectivity**, and nothing
/// else. Not "is this called garbage collection", not "does this happen at a lifecycle boundary".
///
/// `WSetHeat` already carries that discipline for the four-corner algebra: a class DECLARED beside
/// each operation, MEASURED by exhaustive sweep in a law pack, and required to agree in BOTH
/// directions. This module is that same machinery, moved down the compile order so the
/// representation-owning types (delta logs, backing stores, the spine, the anonymity set) can
/// declare against the same vocabulary. It is deliberately **not a second list** — there is no
/// central roster here, only the type a declaration is written in. The roster is *derived* by
/// reflection in the law pack, so a new representation that declares nothing fails a test rather
/// than passing silently.
///
/// ## Why the key is the REPRESENTATION and not the operation name
///
/// `IDeltaLog.TruncateAsync` is one interface method with one call site, and across the backends
/// this repo actually ships it has **three different thermodynamic classes**:
///
/// * `InMemoryDeltaLog` — `list.RemoveAll`; the entries are gone. **Erasing.**
/// * `GitDeltaLog` — commits the truncated tree **with the old commit as parent**, so every
///   removed delta stays reachable by walking the DAG. **Reversible.**
/// * `GroupCommitDiskDeltaLog` — a no-op; compaction is unimplemented in v1. **Reversible**, and
///   for a reason that has nothing to do with the other two.
///
/// A name-based list cannot express that, which is why a name-based list — the one this module
/// replaces — could never be completed or trusted. **Erasure is a property of the representation,
/// so the declaration lives where the representation is chosen.**
///
/// ## Why every class is stated relative to a declared OBSERVATION
///
/// "Is the preimage recoverable" is meaningless until you say *by whom, through what*. The same
/// bytes can be unreachable through a log's own read surface and still present on the medium.
/// `ZetaFsDeltaLog.TruncateAsync` writes a new tree whose old version is an orphaned loose object:
/// nothing traverses to it, and nothing collects it either. Its class is `Erasing` **with respect
/// to the declared read surface** and simultaneously `Unmeasured` with respect to the physical
/// medium — two honest rows, not one dishonest average. Every `Profile` therefore names its
/// `Observation`, and `(Representation, Operation, Observation)` is the key.
///
/// ## Why `Unmeasured` exists and why it is never zero
///
/// An operation whose fibres nobody has measured has an **unknown** cost. Recording that as `0` is
/// the exact demon this vocabulary exists to catch: a channel that looks free because the ledger is
/// closed. `Unmeasured` is therefore a first-class class, `bitsErasedPpm` returns `None` rather
/// than `0L` for it, and the law pack treats it as a failure-to-classify that must carry a written
/// reason — never as a zero-cost operation.
///
/// Anchors (Beacon): Landauer 1961 "Irreversibility and Heat Generation in the Computing Process";
/// Bennett 1973 "Logical Reversibility of Computation"; Goguen–Meseguer 1982 (noninterference — an
/// unmetered channel is an undeclared one).
[<RequireQualifiedAccess>]
module ErasureClass =

    /// The classification. Three cases, and the third is a hole in the books rather than a cost.
    [<RequireQualifiedAccess>]
    type ThermodynamicClass =
        /// Injective with respect to the declared observation: every fibre is a singleton, zero
        /// bits lost, Bennett-free. A meter pointed here must read zero forever.
        | Reversible
        /// Non-injective with respect to the declared observation: at least one fibre has more
        /// than one preimage, `log2(largest fibre)` bits lost.
        | Erasing
        /// No admissible measurement exists yet. **This is not zero.** A meter must refuse or
        /// escalate rather than charge nothing.
        | Unmeasured

    /// How the declared class is backed. A declaration with no measurement behind it is an
    /// assertion, and assertions are what this whole apparatus refuses.
    [<RequireQualifiedAccess>]
    type Evidence =
        /// Every state of a finite domain enumerated and grouped by image. `Domain` names it.
        | ExhaustiveSweep of domain: string * largestFibre: int * bitsErasedPpm: int64
        /// Exhaustive over a deliberately shrunk model of a domain that is not enumerable in the
        /// real world (a filesystem, a routing table over 160-bit ids). `Model` names the shrink,
        /// so the reader can judge what the sweep does and does not cover.
        | BoundedModelSweep of model: string * largestFibre: int * bitsErasedPpm: int64
        /// Nothing here can be swept, and the reason is written down rather than implied.
        | NoAdmissibleMeasurement of reason: string

    /// One declaration, attached to one concrete representation.
    type Profile =
        { /// The concrete type or module that chooses the representation. **This is the key**, not
          /// `Operation` — the same operation name has opposite classes across backends.
          Representation: string
          /// The member or function classified, as it is spelled in the source.
          Operation: string
          /// What the injectivity is measured *against*. Without this a class is not a claim.
          Observation: string
          /// What a reader of the post-state can still get back, and through which channel.
          /// For `Erasing` rows this says what is gone; the phrasing is the audit trail.
          RecoveryChannel: string
          Classification: ThermodynamicClass
          Evidence: Evidence }

    /// `(Representation, Operation, Observation)` — the identity of a declaration.
    let key (p: Profile) : string =
        String.Format(CultureInfo.InvariantCulture, "{0}::{1}::{2}", p.Representation, p.Operation, p.Observation)

    /// The largest fibre, or `None` when unmeasured. Callers must handle `None`; there is no
    /// defaulting overload on purpose.
    let largestFibre (p: Profile) : int option =
        match p.Evidence with
        | Evidence.ExhaustiveSweep(_, fibre, _) -> Some fibre
        | Evidence.BoundedModelSweep(_, fibre, _) -> Some fibre
        | Evidence.NoAdmissibleMeasurement _ -> None

    /// Bits erased in parts per million, or `None` when unmeasured.
    ///
    /// **`None` is not `0L`.** Every caller that folds this into a ledger has to decide, in the
    /// open, what an unmeasured operation costs — which is the decision that silently defaulting
    /// to zero takes away.
    let bitsErasedPpm (p: Profile) : int64 option =
        match p.Evidence with
        | Evidence.ExhaustiveSweep(_, _, ppm) -> Some ppm
        | Evidence.BoundedModelSweep(_, _, ppm) -> Some ppm
        | Evidence.NoAdmissibleMeasurement _ -> None

    /// True when the evidence is a sweep someone can re-run — i.e. the law pack is obliged to
    /// contain a measurement for this row. Used by the anti-vacuity guard: a profile that claims
    /// to be measured and is measured by nobody is a golden vector nothing reads.
    let isSwept (p: Profile) : bool =
        match p.Evidence with
        | Evidence.ExhaustiveSweep _
        | Evidence.BoundedModelSweep _ -> true
        | Evidence.NoAdmissibleMeasurement _ -> false

    /// Internal well-formedness of a single declaration, independent of any measurement:
    /// the class and the evidence must not contradict each other. Returns the violations
    /// (empty = well formed) so a failing law pack can say exactly what is wrong.
    let inconsistencies (p: Profile) : string list =
        let complain (what: string) =
            String.Format(CultureInfo.InvariantCulture, "{0}: {1}", key p, what)

        [ if String.IsNullOrWhiteSpace p.Representation then
              complain "Representation is blank — the class has no key"
          if String.IsNullOrWhiteSpace p.Operation then
              complain "Operation is blank"
          if String.IsNullOrWhiteSpace p.Observation then
              complain "Observation is blank — a class without a stated observation is not a claim"
          if String.IsNullOrWhiteSpace p.RecoveryChannel then
              complain "RecoveryChannel is blank — say what survives, or say that nothing does"

          match p.Classification, p.Evidence with
          | ThermodynamicClass.Reversible, Evidence.NoAdmissibleMeasurement _ ->
              complain "declared Reversible on no measurement — that is the free-by-default claim this module exists to refuse"
          | ThermodynamicClass.Erasing, Evidence.NoAdmissibleMeasurement _ ->
              complain "declared Erasing on no measurement — use Unmeasured; an unbacked cost is still an assertion"
          | ThermodynamicClass.Unmeasured, Evidence.NoAdmissibleMeasurement reason ->
              if String.IsNullOrWhiteSpace reason then
                  complain "Unmeasured with no written reason"
          | ThermodynamicClass.Unmeasured, _ ->
              complain "declared Unmeasured but carries a sweep — if it was swept it has a class"
          | ThermodynamicClass.Reversible, _ ->
              match largestFibre p, bitsErasedPpm p with
              | Some 1, Some 0L -> ()
              | fibre, ppm ->
                  complain (
                      String.Format(
                          CultureInfo.InvariantCulture,
                          "declared Reversible but the evidence is fibre={0} ppm={1}; reversible means fibre 1 and exactly 0 bits",
                          (match fibre with Some f -> f.ToString(CultureInfo.InvariantCulture) | None -> "none"),
                          (match ppm with Some v -> v.ToString(CultureInfo.InvariantCulture) | None -> "none")
                      )
                  )
          | ThermodynamicClass.Erasing, _ ->
              match largestFibre p, bitsErasedPpm p with
              | Some f, Some ppm when f > 1 && ppm > 0L -> ()
              | fibre, ppm ->
                  complain (
                      String.Format(
                          CultureInfo.InvariantCulture,
                          "declared Erasing but the evidence is fibre={0} ppm={1}; erasing means fibre > 1 and strictly positive bits",
                          (match fibre with Some f -> f.ToString(CultureInfo.InvariantCulture) | None -> "none"),
                          (match ppm with Some v -> v.ToString(CultureInfo.InvariantCulture) | None -> "none")
                      )
                  ) ]

    /// The class implied by a measured largest fibre. `measured 1 = Reversible`; anything wider is
    /// `Erasing`. A sweep can never return `Unmeasured` — that case only exists for the absence of
    /// a sweep, which is precisely why it must not be confused with a measured zero.
    let ofLargestFibre (fibre: int) : ThermodynamicClass =
        if fibre <= 1 then ThermodynamicClass.Reversible else ThermodynamicClass.Erasing

    /// `log2(fibre)` in parts per million, rounded — the same integer form `WSetHeat` commits, so
    /// declared and measured values compare exactly rather than approximately.
    let bitsPpmOfLargestFibre (fibre: int) : int64 =
        if fibre <= 1 then 0L
        else int64 (Math.Round(Math.Log(float fibre, 2.0) * 1_000_000.0))


/// **Implemented by every concrete representation that can destroy a preimage.**
///
/// The declaration is an obligation of the *implementation*, never of the interface it satisfies,
/// because the interface is exactly the level at which the class is undecidable: `IDeltaLog` does
/// not know whether its truncation unlinks a file or commits a child of the old tip. So
/// `IDeltaLog` is left alone and each backend answers for itself.
///
/// The drift guard in the law pack reflects over the shipped assemblies and fails when a type
/// implements a preimage-bearing interface without also implementing this one. A new backend must
/// classify itself before it can be merged; silence is not a passing state.
type IErasureDeclaring =
    /// Every operation of this representation whose fibres could be non-trivial, one row per
    /// declared observation. An implementation with genuinely nothing to declare returns `[]` and
    /// says so in a comment — an empty list is a claim too.
    abstract member ErasureProfiles: ErasureClass.Profile list
