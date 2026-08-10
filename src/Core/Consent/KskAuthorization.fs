module Zeta.Core.Consent.KskAuthorization

open System

/// Signer identity for N-of-M multi-sig KSK override.
type Signer = {
    Id: string
    PublicKey: byte[]
}

/// The **evaluating traveler's own** trusted roster for KSK override authorization.
///
/// There is deliberately NO global roster: each traveler holds its own `Signers` set and decides
/// for itself whom it trusts (`R11` — per-principal trust, no mandatory central authority). A
/// consequence worth stating, because it looks like a bug and is not: **two travelers may reach
/// different verdicts on the identical request**, and both are correct. A single mandatory roster
/// would be a hub — the same capture this substrate refuses everywhere else.
type KskConfig = {
    Signers: Signer list
    Threshold: int
    Scope: string
}

/// Authorization request for KSK override (emergency bypass of consent gate).
type KskAuthorizationRequest = {
    Scope: string
    Signatures: (string * byte[]) list  // signerId * signature
}

/// Result of KSK threshold check.
type KskCheckResult =
    | Authorized of signerCount: int * threshold: int
    | InsufficientSigners of provided: int * required: int
    | ScopeMismatch of requested: string * configured: string
    | DuplicateSigners of duplicates: string list
    /// Signers that are not on the configured roster. Counting an unknown identity toward the
    /// threshold would let N fabricated names authorize the highest-authority path in the system.
    | UnknownSigners of unknown: string list

/// Validates N-of-M threshold for a KSK override **from the perspective of one traveler**, against
/// that traveler's own roster. Disagreement between travelers is a legitimate outcome, not a fault.
/// Returns Result< KskCheckResult, string > for error surfacing.
let checkKskAuthorization (config: KskConfig) (req: KskAuthorizationRequest) : Result<KskCheckResult, string> =
    if req.Scope <> config.Scope then
        Ok (ScopeMismatch (req.Scope, config.Scope))
    else
        let submitted = req.Signatures |> List.map fst
        let uniqueSigners = submitted |> List.distinct

        // Duplicates are reported before anything else counts them: submitting one signer N times
        // must never look like N signers.
        let duplicates =
            uniqueSigners |> List.filter (fun s -> submitted |> List.filter ((=) s) |> List.length > 1)

        // Roster membership. `config.Signers` is the authority on WHO may sign; using it only for
        // its length would let entirely unknown identities reach `Authorized` (081KZMGZTB508QG0R003F8AXYQ).
        let roster = config.Signers |> List.map (fun s -> s.Id) |> Set.ofList
        let unknown = uniqueSigners |> List.filter (fun s -> not (roster.Contains s))

        if not duplicates.IsEmpty then
            Ok (DuplicateSigners duplicates)
        elif not unknown.IsEmpty then
            Ok (UnknownSigners unknown)
        else
            // Only roster members count toward the threshold.
            let provided = uniqueSigners.Length
            let required = config.Threshold
            if provided < required then
                Ok (InsufficientSigners (provided, required))
            else
                Ok (Authorized (provided, required))

// ALGORITHM AGILITY (Aaron 2026-08-09): the signature scheme belongs behind a PORT, not baked in
// — "hexagonal / pluggable and rollable keys in case we make a bad assumption." A PQ choice made
// today (ML-DSA / FIPS 204, SLH-DSA / FIPS 205, or the unimplemented `PqLattice`) is a bet on a
// hardness assumption holding for decades, and that bet should be revisable without a migration
// event. Note the mechanism already exists: `KeyCustody`'s three-slot ladder makes **algorithm
// migration just a key rotation whose `next` slot carries a different scheme** — the bounded
// `previous` acceptance window is exactly the hybrid/transition period a PQ migration needs, and
// it works without a coordinator to sequence the cutover.
//
// STILL DEFERRED: full signature verification. This function now answers "did enough DISTINCT,
// ROSTERED parties submit?" — it does NOT verify that the submitted bytes are valid signatures by
// those parties over this scope. Until that lands, this gate is not sound against a caller that
// can fabricate signature bytes. Tracked with the algorithm choice (ML-DSA / SLH-DSA vs the
// unimplemented `PqLattice`) in 081KZMGZTB508QG0R003F8AXYQ.
