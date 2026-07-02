/// QuantumPersistentLog.qs — the durable append-only log as a reversible Q# pipeline.
///
/// Design note: docs/research/2026-07-02-quantum-phase5-two-ledgers-calm-is-ctl-not-adj-landauer-as-cost-contract.md
/// Handoff: docs/handoffs/2026-06-21-alexa-to-research-team-quantum-phase5.md (item 1)
/// Routing: Soraya (formal-verification-expert), 2026-07-02.
///
/// Convention (AlgebraInterfaces.qs): Q# has no interfaces — a matching signature IS the instance.
///
/// Load-bearing design decision (Soraya): ORDER IS DATA, NOT OPERATION ORDER.
///   A log entry is (index, payload); `index` is encoded into the basis key, so appends on
///   distinct indices COMMUTE (Z-set add is commutative — matches DBSP / CRDT item 2) while the
///   total order stays recoverable by reading the index field (Lamport: the sequence number carries
///   the order, the transport need not).
///
/// Round-trip proven BY CONSTRUCTION: `Encode is Adj` ⇒ Decode := Adjoint Encode ⇒
///   Decode ∘ Encode = I holds at the type level (Q# will not compile an Adj op whose adjoint is
///   not its unitary inverse). The annotation is the theorem — nothing to model-check.
///
/// gen(gen) IS the persistence (only-the-irreducible-is-primitive rule: the generator is the ECC;
///   regenerating from the irreducible IS error-correction across replay).
///
/// Formal coverage (see design note): append-only/index-monotone → TLA+; round-trip → this file's
///   `is Adj` + FsCheck over the shipped decoder; gen(gen)=gen idempotence → FsCheck.

namespace Zeta.PersistentLog.Quantum {
    open Microsoft.Quantum.Intrinsic;

    /// Encode a log entry into the register. `index` carries order; `payload` carries content.
    /// `is Adj` is load-bearing: DecodeEntry is its adjoint, so round-trip = I by construction.
    /// Body TBD by codegen (Alexa's lane).
    operation EncodeEntry(index : Qubit[], payload : Qubit[], target : Qubit[]) : Unit is Adj + Ctl {
        // controlled-emit at position `index`; interface contract only for now.
    }

    /// Decode = the adjoint of Encode. NOT a separately-written inverse — the compiler guarantees
    /// inverse-ness, which is the whole point (round-trip proven by construction).
    operation DecodeEntry(index : Qubit[], payload : Qubit[], target : Qubit[]) : Unit is Adj + Ctl {
        Adjoint EncodeEntry(index, payload, target);
    }

    /// Append is order-free ON THE OPERATION (distinct indices commute); order lives in `index`.
    /// This is what reconciles "append-only + order-preserving" with "CRDT merge commutes" (item 2).
    operation Append(index : Qubit[], payload : Qubit[], log : Qubit[]) : Unit is Adj + Ctl {
        EncodeEntry(index, payload, log);
    }
}
