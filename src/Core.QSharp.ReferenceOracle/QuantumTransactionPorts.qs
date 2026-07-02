/// QuantumTransactionPorts.qs — CALM/CRDT transaction boundaries as Q# quantum ports.
///
/// Design note: docs/research/2026-07-02-quantum-phase5-two-ledgers-calm-is-ctl-not-adj-landauer-as-cost-contract.md
/// Handoff: docs/handoffs/2026-06-21-alexa-to-research-team-quantum-phase5.md (item 2)
/// Routing: Soraya (formal-verification-expert), 2026-07-02.
///
/// CORRECTION to the handoff (load-bearing): CALM-monotone maps to the `Ctl` axis, NOT `Adj`.
///
///   CALM theorem (Hellerstein; Ameloot, Neven, Van den Bussche 2013): a program has a
///   coordination-free implementation IFF it is monotone. Translated to the port idiom:
///     - MONOTONE (CALM-safe) ⟺ expressible with NO USED control qubit  → fire unconditionally.
///     - NON-MONOTONE (needs coordination) ⟺ requires a USED control qubit → the control qubit
///       IS the coordination the CALM theorem says non-monotone programs cannot avoid.
///
///   Why NOT `Adj`: a CRDT/lattice join is idempotent (a ∨ a = a). Idempotent ⇒ not injective ⇒
///   no inverse ⇒ CANNOT be a unitary `Adj` op. So "monotone-safe = is Adj" inverts the truth:
///   the most CALM-safe thing there is (an idempotent merge) is exactly what fails the Adj test.
///   `Adj` is the RETRACT axis (emit/retract, DBSP +1/−1); `Ctl` is the COORDINATION axis. Orthogonal.
///
/// IDEMPOTENCE IMPEDANCE MISMATCH (named, not hidden): unitaries are never idempotent except
///   involutions (H²=I, X²=I) and identity. So these ports faithfully model COMMUTATIVITY +
///   ASSOCIATIVITY of the CRDT (confluence — provable at the unitary level) but NOT idempotence.
///   Idempotence re-enters ONLY through measurement/normalization — a non-unitary, sim-only step
///   (as ZSetISA.qs already notes: "Born collapse = sim-only. Live = soft"). Do not "prove
///   idempotence" at the unitary level — that would be Statement-class verification drift.
///
/// Formal coverage (see design note): confluence (ops commute) → Q# commutation + Z3 matrix
///   commutator (BP-16, P0-adjacent); CALM classification → signature audit/lint; associativity →
///   FsCheck over shipped GCounter.Merge / Divvy.merge.

namespace Zeta.TransactionPorts.Quantum {
    open Microsoft.Quantum.Intrinsic;

    /// MONOTONE port (CALM-safe, coordination-free): fires UNCONDITIONALLY.
    /// `Adj + Ctl` is declared for COMPOSABILITY, but NO control qubit is USED here — that
    /// "no used control" IS the coordination-free classification. Classification is on USE,
    /// not on the declared capability.
    /// sourceA and sourceB COMMUTE (confluence — the provable claim). Idempotence is NOT modelled
    /// here (it re-enters only at measurement).
    operation MonotoneMergePort(
        sourceA : (Qubit[] => Unit is Adj + Ctl),
        sourceB : (Qubit[] => Unit is Adj + Ctl),
        target  : Qubit[]
    ) : Unit is Adj + Ctl {
        sourceA(target);
        sourceB(target);
    }

    /// NON-MONOTONE port (needs coordination): the op is CONTROLLED on `coord`.
    /// The USED control qubit is the metered coordination door (§13 noninterference) that the
    /// CALM theorem forces on non-monotone operations.
    operation CoordinatedPort(
        coord  : Qubit,
        op     : (Qubit[] => Unit is Adj + Ctl),
        target : Qubit[]
    ) : Unit is Adj + Ctl {
        Controlled op([coord], target);
    }
}
