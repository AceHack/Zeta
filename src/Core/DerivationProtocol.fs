namespace Zeta.Core

/// The N-version derivation protocol, as types rather than as prose.
///
/// Derived from the key-custody exercise (2026-08-09), where two independent derivations of one
/// specification produced twelve spec defects and one acceptance criterion that everybody believed
/// was met and nobody had built. Every case below exists because that run needed it; nothing here is
/// speculative shape.
///
/// The protocol in one line: **a divergence between two independent derivations is a defect in the
/// SPECIFICATION until shown otherwise** — so the derivations are the instrument, and the amended
/// spec is the output.
module DerivationProtocol =

    // ────────────────────────────── How a derivation is separated ──────────────────────────────

    /// What a whitebox derivation owes, in place of a wall. Sight of prior art is permitted; these
    /// obligations are what make that honest rather than appropriation.
    type Attribution =
        { /// The human or organisation to credit. Never elided.
          Author: string
          /// The specific work read.
          Work: string
          /// The license it carries. `None` means *unknown*, which is not the same as permissive —
          /// an unknown license blocks a whitebox derivation until it is established.
          License: string option
          /// Improvements are offered upstream rather than only kept.
          ContributesBack: bool
          /// Value derived is shared with the original author.
          SharesProfit: bool }

    /// The separation discipline a derivation runs under.
    type Wall =
        /// The implementer is barred from prior art, and independence is the guarantee. Costs a full
        /// duplicate implementation; buys a genuine second reading of the spec.
        | Cleanroom
        /// Sight is permitted and obligations replace the wall. Cheaper and more honest where it is
        /// available — it does not pretend to an independence it does not have.
        | Whitebox of Attribution

    /// A whitebox derivation is only permissible once its license is *established*. Unknown is a
    /// blocker, not a default-permit — the one place this module refuses rather than reports.
    let whiteboxPermitted (a: Attribution) : bool = a.License |> Option.isSome

    // ────────────────────────────── What counts as verified ──────────────────────────────

    /// Why a requirement is believed met. The distinctions here are the ones that were actually
    /// confused in practice.
    type Evidence =
        /// A test ran and discriminated between two inputs.
        | Executed of what: string
        /// A mutant was introduced and the suite went red — the suite detects this class of error.
        | MutantKilled of mutant: string
        /// A mutant was introduced and the suite stayed green. This is a hole in the TESTS, and it
        /// must never be counted toward coverage.
        | MutantSurvived of mutant: string
        /// A mutant produced no usable signal (failed to compile, emitted no result). Honest
        /// bookkeeping: not a kill, not a survival, and not evidence.
        | NotConfirmed of mutant: string * why: string
        /// The property is stated but nothing discriminates on it — a literal field, a non-optional
        /// parameter, a type-level constant. The vacuity class: a test asserting it cannot fail.
        | AssertedOnly of why: string

    /// Evidence that actually supports a coverage claim. `MutantSurvived`, `NotConfirmed` and
    /// `AssertedOnly` deliberately do not.
    let supportsClaim (e: Evidence) : bool =
        match e with
        | Executed _
        | MutantKilled _ -> true
        | MutantSurvived _
        | NotConfirmed _
        | AssertedOnly _ -> false

    /// A derivation's own declaration for one requirement. Declaring is mandatory; rounding `Partial`
    /// up to `Implemented` is the failure this type exists to make expressible-and-checkable.
    type Coverage =
        | Implemented of Evidence list
        /// Some of it is verified and some is not, and both lists are named.
        | Partial of verified: string list * unverified: string list
        /// Deliberately out of this slice. A correct and expected outcome.
        | Deferred of reason: string
        /// Cannot be implemented until something else exists. Distinct from `Deferred`: this one has
        /// an owner and a dependency, and no amount of effort on this slice reaches it.
        | Blocked of dependency: string

    /// Whether a coverage declaration is honestly claimable as done. A `Partial` never is, and an
    /// `Implemented` backed only by non-supporting evidence never is either.
    let isDone (c: Coverage) : bool =
        match c with
        | Implemented evidence -> not evidence.IsEmpty && List.forall supportsClaim evidence
        | Partial _
        | Deferred _
        | Blocked _ -> false

    /// A requirement as one derivation reports it.
    type Claim =
        { Requirement: string
          Declared: Coverage }

    /// The gap between what a derivation *claims* and what its evidence *earns*. Empty is the good
    /// case; anything here is a coverage claim that was not paid for.
    let unearnedClaims (claims: Claim list) : (string * Coverage) list =
        claims
        |> List.filter (fun c ->
            match c.Declared with
            | Implemented _ -> not (isDone c.Declared)
            | _ -> false)
        |> List.map (fun c -> c.Requirement, c.Declared)

    // ────────────────────────────── Reducing to a known fixed point ──────────────────────────────

    /// The input set a predicate was checked for discrimination over. "Satisfiable by a literal" and
    /// "no conforming implementation can fail it" are the same defect over different sets, which is
    /// why this is a parameter rather than two cases.
    type InputSet =
        /// Nothing can make the predicate differ — a literal, a constant, a non-optional field.
        | AllInputs
        /// It could differ in principle, but obeying the spec removes the discriminating input. The
        /// text is fine; the logic is circular.
        | ConformingInputs

    /// Where a reduction's category came from. **Pigeonhole by the subject's own self-claim, never by
    /// the observer's inference** — the observer's job is to check whether the self-claim was
    /// delivered, not to choose the bin. Assumption-based classification skips the declaration and
    /// corrupts both steps.
    type ReductionKey =
        /// The criterion (or its author) states its own form. The only admissible key.
        | SelfClaimed of form: string
        /// An observer guessed the form. Recorded so the guess is visible, never acted on.
        | Inferred of by: string

    /// The result of reducing against the fixed-point registry. `DoesNotReduce` is a first-class
    /// outcome, not a fallthrough: a registry that always finds a match is the vacuity class wearing
    /// a lookup table.
    type Reduction =
        | ReducesTo of known: string * key: ReductionKey
        /// Genuinely new. Register it rather than forcing a fit — forcing one destroys the finding.
        | DoesNotReduce of proposed: string

    /// Only a self-claimed reduction may be acted on. This makes the pigeonhole rule mechanical.
    let admissible (r: Reduction) : bool =
        match r with
        | ReducesTo(_, SelfClaimed _) -> true
        | ReducesTo(_, Inferred _) -> false
        | DoesNotReduce _ -> true

    // ────────────────────────────── What a divergence means ──────────────────────────────

    /// Why two derivations of one spec came out different. The default reading is that the SPEC is at
    /// fault — an implementation defect must be argued for, not assumed.
    type Divergence =
        /// One sentence admitted two honest readings. The common case, and the valuable one.
        | SpecAmbiguity of requirement: string * readings: string list
        /// The spec states no requirement at all for something it names.
        | NoNormativeText of requirement: string
        /// A criterion that **fails to discriminate** over `over`. One case rather than three.
        | NonDiscriminating of criterion: string * over: InputSet * reduction: Reduction
        /// Two requirements that cannot both hold in some reachable state.
        | RequirementsInTension of a: string * b: string * state: string
        /// The host repo's convention was never given to the implementer, who therefore could not
        /// honour it. Our defect, not theirs.
        | ConventionUnstated of convention: string
        /// Genuinely one implementation being wrong. Requires the argument, and names the evidence.
        | ImplementationDefect of derivation: string * requirement: string * evidence: Evidence

    /// A divergence is a specification defect unless it is an argued implementation defect. This is
    /// the protocol's central bias, made mechanical.
    let isSpecDefect (d: Divergence) : bool =
        match d with
        | ImplementationDefect _ -> false
        | _ -> true

    // ────────────────────────────── The workflow ──────────────────────────────

    /// One implementer's output. The **report is a first-class artifact**, not a courtesy: in the
    /// key-custody run the implementer's own report found more spec defects than the combine over its
    /// finished code did, because it had the experience of hitting each ambiguity while building.
    /// That evidence is unrecoverable from the artifact afterwards, and was nearly lost.
    type Derivation =
        { Name: string
          Wall: Wall
          Claims: Claim list
          /// Ambiguities the implementer resolved by choosing. The highest-value field here.
          ResolvedByChoosing: Divergence list }

    /// The protocol's states. A combine needs at least two derivations to be meaningful; one
    /// derivation cannot diverge from anything, which is precisely why a lone implementation's
    /// coverage claim cannot be checked.
    type Stage =
        | Specified of requirements: string list
        | Derived of Derivation list
        | Combined of Divergence list
        | Amended of amendments: string list

    /// Requirements no derivation has honestly claimed — the green-field list. In the key-custody run
    /// this is what exposed that custody transfer was unbuilt while one derivation reported it done.
    let unmetBy (requirements: string list) (derivations: Derivation list) : string list =
        requirements
        |> List.filter (fun r ->
            derivations
            |> List.forall (fun d ->
                d.Claims
                |> List.exists (fun c -> c.Requirement = r && isDone c.Declared)
                |> not))

    /// Everything a combine should surface: the spec defects, then the unearned claims per
    /// derivation. Ordered spec-defects-first because that is where the value is.
    let combine (derivations: Derivation list) (found: Divergence list) : Divergence list * (string * string * Coverage) list =
        let specDefects = found |> List.filter isSpecDefect

        let unearned =
            derivations
            |> List.collect (fun d -> unearnedClaims d.Claims |> List.map (fun (r, c) -> d.Name, r, c))

        specDefects, unearned
