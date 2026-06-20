module Zeta.Tests.Formal.NftCommitBindingTests

open System
open FsCheck.Xunit
open global.Xunit
open Zeta.Core

module Z = Zeta.Core.CostarZSet

// math-team handoff row 2 — NFT binding / collision-resistance, FsCheck cross-check leg.
//
// The minted NFT over a co-star pair commits `(canonical Link {A≤B}, rating)` —
// `CostarZSet.toDynamicValue rating link` → canonical CBOR → content hash. Row 2's
// property `H_AB ≠ H_AC ⇒ Commit ≠ Commit` is the BINDING of that commitment: the
// committed bytes pin the SPECIFIC pair AND its rating, so you cannot present one
// pair's commit as another's, nor silently re-rate a pair.
//
// HONEST SCOPE: this is the empirical evidence leg over the REAL encoder. The
// **Z3 (QF_BV)** structural domain-separation proof and the Lean domain-sep theorem
// (the formal injectivity of the canonical encoding) stay the math team's PRIMARY —
// CBOR text strings are length-prefixed and the object keys are distinct tags, so the
// encoding is injective by construction; the hash's collision-resistance is the named
// crypto premise (XxHash128 → BLAKE3 for Byzantine). "The commit is binding" here
// means: distinct inputs ⇒ distinct committed bytes (modulo that premise).

/// IMDb-style person id (safe ASCII — keeps the canonical CBOR text-string total).
let private pid (n: int) : string = sprintf "nm%07d" (abs (n % 9_000_000) + 1_000_000)

/// The commit preimage: canonical CBOR bytes of the minted `(link, rating)` record,
/// rendered hex. Distinct hex ⇔ distinct committed bytes ⇔ (premise) distinct hash.
let private commit (rating: int64) (l: Z.Link) : string =
    match DynamicValue.toCanonicalCbor (Z.toDynamicValue rating l) with
    | Ok bytes -> Convert.ToHexString bytes
    | Error e -> failwithf "canonical CBOR encode failed (unexpected for nm-id input): %A" e

[<Property>]
let ``binding: distinct (canonical link, rating) ⇒ distinct commit`` (a1: int) (b1: int) (r1: int64) (a2: int) (b2: int) (r2: int64) =
    let l1 = Z.link (pid a1) (pid b1)
    let l2 = Z.link (pid a2) (pid b2)
    // distinct minted tuples must not collide; equal tuples are the determinism case
    if l1 = l2 && r1 = r2 then true
    else commit r1 l1 <> commit r2 l2

[<Property>]
let ``rating-binding: same pair, distinct rating ⇒ distinct commit (no silent re-rating)`` (a: int) (b: int) (r1: int64) (r2: int64) =
    let l = Z.link (pid a) (pid b)
    r1 = r2 || commit r1 l <> commit r2 l

[<Property>]
let ``pair-binding: distinct canonical pairs ⇒ distinct commit at equal rating`` (a1: int) (b1: int) (a2: int) (b2: int) (r: int64) =
    let l1 = Z.link (pid a1) (pid b1)
    let l2 = Z.link (pid a2) (pid b2)
    l1 = l2 || commit r l1 <> commit r l2

[<Property>]
let ``unordered-pair invariant: commit is symmetric in the pair (a feature, not a collision)`` (a: int) (b: int) (r: int64) =
    // link canonicalizes A≤B, so {A,B} has ONE representation — commit(a,b) = commit(b,a).
    commit r (Z.link (pid a) (pid b)) = commit r (Z.link (pid b) (pid a))

[<Property>]
let ``determinism: same (link, rating) ⇒ same commit`` (a: int) (b: int) (r: int64) =
    let l = Z.link (pid a) (pid b)
    commit r l = commit r l

[<Fact>]
let ``specificity: a pair's commit binds the pair AND its rating (H_AB ≠ H_AC ⇒ Commit ≠ Commit)`` () =
    let ab = Z.link "nm0000001" "nm0000002"
    let ac = Z.link "nm0000001" "nm0000003"
    // distinct pairs → distinct commits (cannot pass (A,B)'s NFT off as (A,C)'s)
    Assert.NotEqual<string>(commit 5L ab, commit 5L ac)
    // same pair, distinct rating → distinct commits (cannot silently re-rate)
    Assert.NotEqual<string>(commit 5L ab, commit 6L ab)
    // the unordered-pair invariant holds (B,A canonicalizes to the same NFT)
    Assert.Equal<string>(commit 5L ab, commit 5L (Z.link "nm0000002" "nm0000001"))
