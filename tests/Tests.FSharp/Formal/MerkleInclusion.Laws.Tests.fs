module Zeta.Tests.Formal.MerkleInclusionLawsTests

open System
open FsCheck.Xunit
open global.Xunit
open Zeta.Core

// math-team handoff row 4 — inclusion (audit) proof soundness, FsCheck leg.
//
// Companion to `Merkle.Laws.Tests.fs`, which proves ROOT tamper-evidence
// ("equal roots ⟹ equal leaves", structural + Z3). This file proves the
// per-leaf witness of that: a succinct inclusion proof that
//   (a) COMPLETENESS — every committed entry has a proof that verifies, and
//   (b) SOUNDNESS / no third-party forge — you cannot verify a proof for a
//       non-member, a tampered weight, a corrupted path, or against a
//       different set's root.
// Verification touches ONLY the proof + the root — never the tree (that
// tree-freeness IS the third-party property). HONEST SCOPE matches the
// sibling file: the structure is proven; the digest's collision-resistance
// is the named crypto premise (XxHash128 is non-cryptographic — swap to
// BLAKE3 for Byzantine integrity, per `Merkle.fs`). BP-16 cross-check: this
// FsCheck leg pairs with the existing Z3 root-determines-leaves proof.

module M = ZSetMerkle

let private encodeKey (k: int) : byte[] = BitConverter.GetBytes k

/// Distinct keys, each weight 1L — a clean support with no retraction/cancel.
let private zsetOf (keys: int list) : ZSet<int> =
    keys |> List.distinct |> List.map (fun k -> (k, 1L)) |> ZSet.ofSeq

let private nonEmpty (keys: int list) : int list =
    match List.distinct keys with
    | [] -> [ 0 ]
    | ks -> ks

[<Property>]
let ``completeness: every committed entry has a proof that verifies against the true root`` (keys: int list) =
    let ks = nonEmpty keys
    let z = zsetOf ks
    let r = M.root encodeKey z
    ks
    |> List.forall (fun k ->
        match M.proofFor encodeKey z k with
        | Some p -> M.verify p r
        | None -> false)

[<Property>]
let ``no-forge: a non-member key has no inclusion proof`` (keys: int list) (probe: int) =
    let ks = nonEmpty keys
    let z = zsetOf ks
    if List.contains probe ks then true // vacuous when the probe is actually a member
    else (M.proofFor encodeKey z probe).IsNone

[<Property>]
let ``no-forge: tampering the proven weight breaks verification`` (keys: int list) (delta: int) =
    let ks = nonEmpty keys
    let z = zsetOf ks
    let r = M.root encodeKey z
    match M.proofFor encodeKey z (List.head ks) with
    | Some p when delta <> 0 ->
        let tampered = { p with LeafWeight = p.LeafWeight + int64 delta }
        not (M.verify tampered r)
    | _ -> true

[<Property>]
let ``no-forge: a valid proof does not verify against a different set's root`` (a: int list) (b: int list) =
    let ka = nonEmpty a
    let kb = nonEmpty b
    let ra = M.root encodeKey (zsetOf ka)
    let rb = M.root encodeKey (zsetOf kb)
    if ra.ToHex() = rb.ToHex() then true // only meaningful when the roots actually differ
    else
        match M.proofFor encodeKey (zsetOf ka) (List.head ka) with
        | Some p -> not (M.verify p rb)
        | None -> false

[<Property>]
let ``no-forge: corrupting any sibling on the audit path breaks verification`` (keys: int list) (i: int) =
    let ks = nonEmpty keys
    let z = zsetOf ks
    let r = M.root encodeKey z
    match M.proofFor encodeKey z (List.head ks) with
    | Some p when p.Steps.Length > 0 ->
        let j = (abs i) % p.Steps.Length
        let s = p.Steps.[j]
        // flip one bit of the sibling digest → a guaranteed-different sibling
        let badSib = MerkleHash(s.Sibling.Hi ^^^ 1UL, s.Sibling.Lo)
        let steps2 = Array.copy p.Steps
        steps2.[j] <- { s with Sibling = badSib }
        not (M.verify { p with Steps = steps2 } r)
    | _ -> true

[<Property>]
let ``proofs are deterministic (same set + key → identical audit path)`` (keys: int list) =
    let ks = nonEmpty keys
    let z = zsetOf ks
    let k = List.head ks
    match M.proofFor encodeKey z k, M.proofFor encodeKey z k with
    | Some a, Some b ->
        a.LeafWeight = b.LeafWeight
        && a.Steps.Length = b.Steps.Length
        && Array.forall2
            (fun (x: M.MerkleStep) (y: M.MerkleStep) ->
                x.SiblingOnRight = y.SiblingOnRight
                && x.Sibling.ToHex() = y.Sibling.ToHex())
            a.Steps
            b.Steps
    | _ -> false

[<Property>]
let ``single-leaf tree: proof has no steps and verifies (root is the leaf)`` (k: int) =
    let z = zsetOf [ k ]
    let r = M.root encodeKey z
    match M.proofFor encodeKey z k with
    | Some p -> p.Steps.Length = 0 && M.verify p r
    | None -> false

[<Fact>]
let ``third-party verification uses only the proof and the root`` () =
    let z = zsetOf [ 3; 1; 4; 1; 5; 9; 2; 6 ]
    let r = M.root encodeKey z
    let p = (M.proofFor encodeKey z 4).Value
    // a verifier with ONLY (p, r) accepts — verify's signature never sees z.
    Assert.True(M.verify p r)

[<Fact>]
let ``retraction-native: a net-zero (retracted) entry has no inclusion proof`` () =
    // +1 then −1 on key 7 cancels (Z-set retraction), so 7 leaves the support
    // and cannot be proven included; 8 (net +1) still can.
    let z = ZSet.ofSeq [ (7, 1L); (7, -1L); (8, 1L) ]
    Assert.True((M.proofFor encodeKey z 7).IsNone)
    Assert.True((M.proofFor encodeKey z 8).IsSome)
