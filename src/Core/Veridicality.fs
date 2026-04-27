namespace Zeta.Core

open System


/// **Veridicality — provenance-aware claim scoring (foundation).**
///
/// This module hosts the primitives for what the bootstrap-era
/// conversation called the "bullshit detector" and Amara's
/// subsequent ferries (7th-10th) formalized as veridicality
/// scoring. The name `Veridicality` (from Latin *veridicus*,
/// "truth-telling") names the scorable quantity: how true-to-
/// reality a claim looks given its provenance, falsifiability,
/// coherence, drift, and compression-gap signals. "Bullshit" is
/// the informal inverse (`bullshit = 1 - veridicality`).
///
/// **First graduation (this file):** `Provenance` + `Claim<'T>`
/// record types + `validateProvenance`. These are the input
/// shapes for every downstream scorer. The actual veridicality
/// scorer (`V(c) = σ(β₀ + β₁(1-P) + β₂(1-F) + β₃(1-K) + …)` from
/// Amara's 7th ferry, or `BS(c) = σ(w₁·C + w₂·(1-P) + …)` from
/// the 10th ferry) is a separate graduation that composes over
/// these types.
///
/// **Attribution.**
/// * **Concept** — the bullshit-detector / provenance-aware-
///   scoring framing is Aaron's design, present in the bootstrap
///   conversation (`docs/amara-full-conversation/**`) before
///   Amara's ferries formalized it. Aaron 2026-04-24 Otto-112:
///   *"bullshit, it was in our conversation history too, not
///   just her ferry."*
/// * **Formalization** — Amara (7th/8th/9th/10th ferries):
///   veridicality formula, semantic-canonicalization "rainbow
///   table", oracle-rule specification, 7-feature composite.
/// * **Implementation** — Otto, under the Otto-105 graduation
///   cadence. Fifth graduation.
///
/// Future graduations add (in priority order): `antiConsensusGate`
/// (requires `Provenance`); `canonicalizeClaim` (semantic
/// canonicalization → `CanonicalClaimKey`); `scoreVeridicality`
/// (the composite function).
[<AutoOpen>]
module Veridicality =

    /// **Provenance** — the evidence trail behind a claim.
    ///
    /// Every accepted claim MUST carry provenance with at minimum
    /// `SourceId`, `RootAuthority`, `ArtifactHash`, and
    /// `SignatureOk = true`. Empty-string `SourceId` or
    /// `RootAuthority`, empty `ArtifactHash`, or `SignatureOk =
    /// false` all indicate unverified or missing evidence.
    ///
    /// Fields match Amara's 9th/10th ferry specification verbatim
    /// (`docs/aurora/2026-04-23-amara-aurora-deep-research-
    /// report-10th-ferry.md` §ADR-style spec for oracle rules and
    /// implementation).
    ///
    /// `RootAuthority` vs `SourceId`: a single source may speak
    /// under different authorities (a mailing list, an academic
    /// publication, a company blog), and consumers of the claim
    /// need both to distinguish "two sources, same root
    /// authority" (anti-consensus-gate failure) from "two sources,
    /// two independent roots" (anti-consensus-gate pass).
    type Provenance =
        { SourceId: string
          RootAuthority: string
          ArtifactHash: string
          BuilderId: string option
          TimestampUtc: DateTimeOffset
          EvidenceClass: string
          SignatureOk: bool }

    /// **Claim<'T>** — a piece of information with a payload,
    /// a weight (matches the Z-set weight model for retraction-
    /// native semantics), and its provenance.
    ///
    /// `Id` is the claim's identity in the claim ledger. `Payload`
    /// is the domain-specific information being claimed (a string,
    /// a record, a numeric oracle reading — whatever the caller
    /// has). `Weight` is a signed multiplicity: positive for
    /// assertion, negative for retraction. Total net-zero after
    /// assertion+retraction matches Z-set semantics.
    type Claim<'T> =
        { Id: string
          Payload: 'T
          Weight: int64
          Prov: Provenance }

    /// **Validate provenance** — returns `true` when the
    /// provenance has the minimum fields populated + a valid
    /// signature. Returns `false` on empty-string `SourceId`,
    /// `RootAuthority`, or `ArtifactHash`, or when `SignatureOk
    /// = false`.
    ///
    /// Matches Amara's 10th-ferry snippet:
    ///
    /// ```
    /// let validateProvenance c =
    ///     c.Prov.SourceId <> ""
    ///     && c.Prov.RootAuthority <> ""
    ///     && c.Prov.ArtifactHash <> ""
    ///     && c.Prov.SignatureOk
    /// ```
    ///
    /// `BuilderId = None`, `TimestampUtc`, and `EvidenceClass`
    /// are NOT checked by this predicate — they are evidence
    /// quality signals that downstream scorers consume, not
    /// hard validity gates. An unsigned artifact with known
    /// source/root/hash is still rejected, because cryptographic
    /// attestation is the minimum trust bar.
    let validateProvenance (p: Provenance) : bool =
        p.SourceId <> ""
        && p.RootAuthority <> ""
        && p.ArtifactHash <> ""
        && p.SignatureOk

    /// Convenience alias for `validateProvenance` on a full
    /// `Claim<'T>`, matching Amara's 10th-ferry snippet which
    /// takes a claim rather than bare provenance.
    let validateClaim (c: Claim<'T>) : bool =
        validateProvenance c.Prov

    /// **CanonicalClaimKey** — the "aboutness" fingerprint
    /// of a claim. Two claims with the same key assert the
    /// same proposition (possibly from different sources,
    /// possibly with different weights/retractions). Two
    /// claims with different keys assert different
    /// propositions.
    ///
    /// Derived from Amara's 8th / 10th ferry spec
    /// `K(c) = hash(subject, predicate, object, time-scope,
    /// modality, provenance-root, evidence-class)`, with
    /// a deliberate divergence: this key EXCLUDES
    /// `provenance-root` and `evidence-class`. Rationale:
    /// the key's purpose here is to GROUP claims about the
    /// same proposition across sources so that
    /// `antiConsensusGate` can then check independent-root
    /// cardinality. Including `provenance-root` in the key
    /// would defeat that grouping. If a future use-case
    /// needs dedupe-by-identical-source semantics, add a
    /// separate 7-field `SourceScopedCanonicalClaimKey`
    /// type rather than expanding this one.
    type CanonicalClaimKey =
        { Subject: string
          Predicate: string
          Object: string
          TimeScope: string
          Modality: string }

    /// Extract a canonical claim key from a claim, given a
    /// user-supplied payload-to-SPO projector. The projector
    /// is where domain-specific semantics live: callers parse
    /// their payload (string / record / AST / etc.) into the
    /// 5-field canonical shape. This module does not prescribe
    /// how to canonicalize natural-language strings into SPO
    /// triples — that's a downstream concern (NLP / structural
    /// parsing / etc.) and different domains call it
    /// differently.
    ///
    /// Normalization is the projector's responsibility too:
    /// lowercasing, trimming, unit-unification, alias-resolving
    /// — all happen in the projector before it returns the
    /// canonical 5-tuple. This module just projects.
    let canonicalKey
            (project: 'T -> string * string * string * string * string)
            (c: Claim<'T>)
            : CanonicalClaimKey =
        let (subject, predicate, obj, timeScope, modality) = project c.Payload
        { Subject = subject
          Predicate = predicate
          Object = obj
          TimeScope = timeScope
          Modality = modality }

    /// Group claims by canonical key. Two claims end up in
    /// the same bucket iff their projectors produce the same
    /// 5-tuple. Downstream code (e.g. `antiConsensusGate`)
    /// then operates per-bucket to check multi-root
    /// independence. Input order is preserved within each
    /// bucket.
    ///
    /// Returns a `Map<CanonicalClaimKey, Claim<'T> list>`.
    /// Empty input → empty map. The per-bucket list order
    /// matches the input order (Map.add + List.rev pattern).
    let groupByCanonical
            (project: 'T -> string * string * string * string * string)
            (claims: Claim<'T> seq)
            : Map<CanonicalClaimKey, Claim<'T> list> =
        claims
        |> Seq.fold (fun acc c ->
            let key = canonicalKey project c
            let existing =
                match Map.tryFind key acc with
                | Some xs -> xs
                | None -> []
            Map.add key (c :: existing) acc) Map.empty
        |> Map.map (fun _ xs -> List.rev xs)

    /// **Anti-consensus gate** — claims supporting the same
    /// assertion must come from at least TWO independent
    /// `RootAuthority` values before they're allowed to upgrade
    /// trust. Returns `Ok claims` when the set of distinct
    /// non-empty root authorities across the input has
    /// cardinality >= 2; `Error msg` otherwise.
    ///
    /// Operational intent: if 50 claims all assert the same
    /// fact but they all trace back to a single upstream source,
    /// the 50-way agreement is a single piece of evidence, not
    /// 50 independent pieces. The gate rejects pseudo-consensus;
    /// genuine multi-root agreement passes.
    ///
    /// The input list is assumed to already be ABOUT the same
    /// assertion (callers group-by canonical claim key before
    /// invoking). The gate does NOT canonicalize; that's the
    /// `canonicalKey` / `groupByCanonical` pair's job.
    ///
    /// **Degenerate-root filter.** Empty / whitespace-only
    /// `RootAuthority` values are dropped before counting —
    /// they do not count as a distinct root. This matches the
    /// tolerant-skip convention of the module's other
    /// primitives (degenerate input is skipped rather than
    /// throwing). Callers that want strict validation should
    /// run `validateProvenance` first.
    ///
    /// Edge cases:
    /// * Empty list — zero roots, fails the gate.
    /// * Single-claim list — one root, fails.
    /// * Duplicate-root lists — fails unless a distinct alternate
    ///   root also appears.
    /// * Lists whose only "second root" is empty/whitespace —
    ///   fails (empty root does not count).
    let antiConsensusGate (claims: Claim<'T> list) : Result<Claim<'T> list, string> =
        // Per Copilot review on PR #26: count only AFFIRMING claims
        // (Weight > 0). Retractions (Weight < 0) from a different
        // root would otherwise satisfy "independent roots" without
        // actually contributing supporting agreement — false-positive
        // for the trust-upgrade workflows this gate guards.
        let agreeingRoots =
            claims
            |> List.filter (fun c -> c.Weight > 0L)
            |> List.map (fun c -> c.Prov.RootAuthority)
            |> List.filter (fun r -> not (String.IsNullOrWhiteSpace r))
            |> Set.ofList
            |> Set.count
        if agreeingRoots < 2 then
            Error "Agreement without independent roots"
        else
            Ok claims
