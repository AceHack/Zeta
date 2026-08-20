namespace Zeta.Core

/// **The erasure declaration for witness-correlation FORMATION — the gap `§7e` warned about,
/// opened rather than filled with a number.**
///
/// The research thread that produced `ErasureClass` recorded a worry and then a correction to it:
///
/// > *"if our ledger meters compaction but not the establishment of witness correlations, then
/// > mutual witnessing looks free in our books."* (§7e)
/// >
/// > *"§7e's conditional has a FALSE ANTECEDENT — the ledger meters **neither** half, so the
/// > worry was understated rather than validated."* (§11i)
///
/// `QuorumAlgebra.join` is the formation step: independent sources' contributions become one
/// quorum, and from that moment the witnesses are correlated. Nothing charged it. This type is the
/// declaration that lets `ErasureCharge` charge it — and, for the half that genuinely cannot be
/// measured today, the declaration that says so out loud instead of posting a zero.
///
/// ## Two rows for one function, because there are two questions
///
/// **Row 1 — the marginal cost, MEASURED.** How much does `join` destroy about *its own inputs*?
/// It is idempotent (`join q q = q`) and commutative (`join a b = join b a`), so the arrival order
/// and the multiplicity of contributions are gone from the result. That is a finite, exhaustively
/// sweepable question and the law pack sweeps it. Idempotence is erasure — the same finding
/// `IBackingStore.Save` produced from a completely different direction.
///
/// **Row 2 — the conditional cost, UNMEASURED and named.** The quantity §7c's result actually runs
/// on is `H(A|B)`: what it costs to erase `A` *given the side information `B`* that a correlated
/// witness retains (del Rio et al., *The thermodynamic meaning of negative entropy*, Nature
/// 474:61-63, 2011 — where conditional erasure can cost **zero or less** when the observer holds
/// correlations). The repo states its own gap precisely, at
/// `src/Core.TypeScript/algebra/erasure-derivation.ts:49`: the operation-level figure assumes
/// nothing about what the caller already knows, and computing the finer one *"requires modelling
/// caller-retained side information, which the two-ledger tracker does not carry."*
///
/// So the conditional figure has **no admissible measurement in this substrate today**, and the
/// honest deliverable is a hole with a written reason rather than an invented coefficient. Under
/// `ErasureCharge` that hole turns the observation's reading into a `LowerBound`, so a reader gets
/// the measured marginal *and* the fact that the conditional is unknown, in one value.
///
/// ## Why declaring the conditional `Unmeasured` is not a dodge
///
/// A class is stated relative to a **declared observation** (`ErasureClass`, and §12b of the
/// research doc: the same representation and operation carry opposite classes under two
/// observations, and both are honest). Row 1 does not claim the conditional is unknown; it
/// measures the marginal exactly. Row 2 does not claim the marginal is unknown; it says the
/// *conditional* observation admits no measurement here. Collapsing them into one row would be the
/// dishonest average the observation key exists to prevent.
///
/// ## What is NOT declared here, and is therefore still a gap
///
/// `SybilBft.decide` (a tally folded to one verdict), `Consensus`, and `TravelerRankLedger` charge
/// nothing and declare nothing. Their marginals are sweepable — this file does not pretend
/// otherwise by declaring them `Unmeasured`, it simply does not cover them yet. Tracked as
/// `081M0CP6V2N087G0R001P6SJ7C`.
///
/// Anchors (Beacon): Landauer 1961; Bennett 1973; del Rio, Aberg, Renner, Dahlsten & Vedral 2011
/// (conditional erasure, `H(A|B)`); Goguen-Meseguer 1982 (noninterference).
[<Sealed>]
type WitnessCorrelationErasureDeclaration() =
    interface IErasureDeclaring with
        member _.ErasureProfiles =
            [ { Representation = "QuorumAlgebra"
                Operation = "join"
                Observation = "the Quorum returned by join"
                RecoveryChannel =
                    "the surviving contributions, and the set of sources that conflicted — but \
                     NOT which side of the join each contribution arrived on, NOT how many times \
                     a source contributed, and NOT the order. join is idempotent and commutative, \
                     so every arrival history that yields the same source-to-contribution map is \
                     one post-state. That indistinguishability is the point of a quorum, and it is \
                     also, exactly, erasure"
                Classification = ErasureClass.ThermodynamicClass.Erasing
                Evidence =
                    ErasureClass.Evidence.BoundedModelSweep(
                        "all ordered pairs drawn from {empty, single a=x, single a=y, single b=x} — a 2-source, 2-value model, not production width",
                        3,
                        1_584_963L
                    ) }

              { Representation = "QuorumAlgebra"
                Operation = "join"
                Observation =
                    "the CONDITIONAL cost H(A|B) — what erasing the pre-join state costs an \
                     observer that retains the correlated side information B a witness holds"
                RecoveryChannel =
                    "unknown, and unknowably so from inside this function: what a correlated \
                     witness can still reconstruct depends on what that witness kept, which is not \
                     an input to join and is not carried by any ledger in this repository"
                Classification = ErasureClass.ThermodynamicClass.Unmeasured
                Evidence =
                    ErasureClass.Evidence.NoAdmissibleMeasurement
                        "the conditional-erasure result (del Rio et al. 2011) runs on H(A|B), and this substrate's two-ledger tracker carries no caller-retained side information — stated in the repo's own words at algebra/erasure-derivation.ts:49. There is no upper bound to charge that would not be an invented coefficient, so the fold refuses this row and reports it as a hole rather than as zero" } ]
