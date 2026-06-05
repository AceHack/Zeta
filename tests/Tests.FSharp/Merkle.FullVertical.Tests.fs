module Zeta.Tests.MerkleFullVerticalTests

open System
open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core
open Zeta.Tests.Support

// ═══════════════════════════════════════════════════════════════════
// Merkle integrity full-vertical — the G-Set/Clock TEMPLATE applied to the
// INTEGRITY primitive (PROVEN-CORE-MAP #3). math leg already holds
// (Formal/Merkle.Laws.Tests.fs: Z3 structural tamper-evidence + FsCheck on the
// real MerkleTree). This adds the carrier/operation legs:
//   4-ser + Arrow : the root digest (MerkleHash) ↔ its canonical DynamicValue
//                   (the 32-char lowercase hex String) → every serializer recovers it.
//   Bonsai        : the Merkle internal-node construction (MerkleHash.combine —
//                   the catamorphism's algebra) reified as a Bonsai Expr,
//                   round-tripped + applied to compute the parent digest.
//   homeostat     : Merkle's role in a homeostat is INTEGRITY / ANTI-ENTROPY,
//                   NOT convergence-to-LUB. `combine` is deliberately NON-
//                   commutative (left/right order is load-bearing — a Merkle tree
//                   is a sequence witness, not a set), so Merkle is NOT a join-
//                   semilattice like G-Set/Clock. Its homeostat-tie is the
//                   VERIFY + MINIMAL-DELTA property: (1) same converged leaf-state
//                   ⟹ same root (the root is a deterministic witness of
//                   convergence — "same state → same root" per the map's role
//                   taxonomy); (2) LeafDiff pinpoints exactly the changed leaves,
//                   and shipping only those leaves drives a replica to the SAME
//                   root (the anti-entropy mechanism CRDT homeostats converge with).
//
// Scope honesty (NOT yet FULL PROVEN): this clears 5 of 6 legs in F#
// (math + 4-ser + Arrow + Bonsai + homeostat). The 4-lang leg is the remaining
// gap — Merkle is F#-only today (Aaron deferred the pure-TS XxHash128 port behind
// the G-Set vertical). So this flips Merkle from math-only to "math + carrier +
// operation + homeostat"; FULL PROVEN waits on the 3 sibling-language ports
// reproducing byte-identical roots.
// ═══════════════════════════════════════════════════════════════════

// ── the carrier bridge: MerkleHash (128-bit root) ↔ DynamicValue ──
// The root travels as its canonical hex String (Hi then Lo, 16 hex digits each).
// String is in every serializer's text subset (Bytes is not — see SerializerLegs),
// so hex is the clean cross-format carrier for a 128-bit digest.

let private hashToDynamic (h: MerkleHash) : DynamicValue = DynamicValue.String(h.ToHex())

let private dynamicToHash (dv: DynamicValue) : MerkleHash option =
    match dv with
    | DynamicValue.String s when s.Length = 32 ->
        try Some(MerkleHash(Convert.ToUInt64(s.Substring(0, 16), 16), Convert.ToUInt64(s.Substring(16, 16), 16)))
        with _ -> None
    | _ -> None

let private genHash : Gen<MerkleHash> =
    Gen.arrayOf (Gen.choose (0, 255) |> Gen.map byte)
    |> Gen.map (fun b -> MerkleHash.ofBytes (ReadOnlySpan<byte> b))

type MerkleArb() =
    static member H() = Arb.fromGen genHash

// ── 4-ser + Arrow legs (via the shared SerializerLegs helper) ──

[<Property(Arbitrary = [| typeof<MerkleArb> |])>]
let ``Merkle × 4-ser: JSON+CBOR+YAML+XML all recover the same root digest`` (h: MerkleHash) =
    let dv = hashToDynamic h
    SerializerLegs.fourSerAgree dv && (SerializerLegs.jsonRT dv |> Option.bind dynamicToHash = Some h)

[<Property(Arbitrary = [| typeof<MerkleArb> |])>]
let ``Merkle × Arrow: round-trips through Arrow IPC and recovers the same root digest`` (h: MerkleHash) =
    let dv = hashToDynamic h
    SerializerLegs.arrowAgree dv && (SerializerLegs.arrowRT dv |> Option.bind dynamicToHash = Some h)

[<Fact>]
let ``Merkle × carrier: fixed roots (Zero / known leaves) round-trip through every format`` () =
    let cases =
        [ MerkleHash.Zero
          (MerkleTree [| "a"B; "b"B; "c"B |]).Root
          MerkleHash.combine (MerkleHash.ofBytes (ReadOnlySpan<byte> "x"B)) (MerkleHash.ofBytes (ReadOnlySpan<byte> "y"B)) ]
    for h in cases do
        let dv = hashToDynamic h
        Assert.Equal(Some h, SerializerLegs.jsonRT dv |> Option.bind dynamicToHash)
        Assert.Equal(Some h, SerializerLegs.cborRT dv |> Option.bind dynamicToHash)
        Assert.Equal(Some h, SerializerLegs.yamlRT dv |> Option.bind dynamicToHash)
        Assert.Equal(Some h, SerializerLegs.xmlRT dv |> Option.bind dynamicToHash)
        Assert.Equal(Some h, SerializerLegs.arrowRT dv |> Option.bind dynamicToHash)

// ── Bonsai leg: the Merkle combine (internal-node algebra) reified, round-tripped, applied ──
// combine is the algebra of the Merkle catamorphism (fold leaves bottom-up into the root);
// reifying it as a Bonsai Expr and recovering the SAME parent digest after a serialize/parse
// round-trip is the reify/apply isomorphism for the Merkle operation.

let rec private applyCombine (env: Map<string, MerkleHash>) (e: Bonsai.Expr) : MerkleHash option =
    match e with
    | Bonsai.Param n -> Map.tryFind n env
    | Bonsai.Call ("merkle-combine", [ l; r ]) ->
        match applyCombine env l, applyCombine env r with
        | Some a, Some b -> Some(MerkleHash.combine a b)
        | _ -> None
    | _ -> None

let private combineExpr : Bonsai.Expr =
    Bonsai.Call("merkle-combine", [ Bonsai.Param "a"; Bonsai.Param "b" ])

let private bonsaiRT (e: Bonsai.Expr) : Bonsai.Expr option =
    match Bonsai.serialize e with
    | Ok s -> (match Bonsai.parse s with | Ok e2 -> Some e2 | Error _ -> None)
    | Error _ -> None

[<Property(Arbitrary = [| typeof<MerkleArb> |])>]
let ``Merkle × Bonsai: combine reified as a Bonsai Expr round-trips and applies to the parent digest``
    (a: MerkleHash) (b: MerkleHash) =
    match bonsaiRT combineExpr with
    | Some e -> applyCombine (Map.ofList [ "a", a; "b", b ]) e = Some(MerkleHash.combine a b)
    | None -> false

[<Fact>]
let ``Merkle × Bonsai: the reified combine expression round-trips byte-stably`` () =
    Assert.Equal<Bonsai.Expr option>(Some combineExpr, bonsaiRT combineExpr)

// ── homeostat leg: INTEGRITY / ANTI-ENTROPY (verify + minimal-delta), Merkle's role ──
// Generate equal-length current/prior leaf sequences as pairs so LeafDiff compares
// index-wise without padding ambiguity.

let private genLeaf : Gen<byte[]> = Gen.arrayOf (Gen.choose (0, 255) |> Gen.map byte)

let private genLeafPairs : Gen<(byte[] * byte[]) list> = Gen.listOf (Gen.zip genLeaf genLeaf)

type LeafPairsArb() =
    static member P() = Arb.fromGen genLeafPairs

[<Property(Arbitrary = [| typeof<LeafPairsArb> |])>]
let ``Merkle × homeostat: same converged leaf-state ⟹ same root (the root is a deterministic convergence witness)``
    (pairs: (byte[] * byte[]) list) =
    let leaves = [| for (c, _) in pairs -> c |]
    // two replicas that independently reach the SAME leaf-state produce equal roots
    (MerkleTree leaves).Root = (MerkleTree leaves).Root
    // and a structurally-distinct rebuild agrees (determinism = the verify property)
    && (MerkleTree(Array.copy leaves)).Root = (MerkleTree leaves).Root

[<Property(Arbitrary = [| typeof<LeafPairsArb> |])>]
let ``Merkle × homeostat: LeafDiff is empty exactly when roots agree (convergence detector)``
    (pairs: (byte[] * byte[]) list) =
    let cur = MerkleTree [| for (c, _) in pairs -> c |]
    let prior = MerkleTree [| for (_, p) in pairs -> p |]
    // empty diff ⟺ converged (equal roots). No-collision premise (128-bit digest, < 2^60 leaves).
    Array.isEmpty (cur.LeafDiff prior) = (cur.Root = prior.Root)

[<Property(Arbitrary = [| typeof<LeafPairsArb> |])>]
let ``Merkle × homeostat: shipping only the LeafDiff leaves drives prior to the SAME root (anti-entropy)``
    (pairs: (byte[] * byte[]) list) =
    let curLeaves = [| for (c, _) in pairs -> c |]
    let priorLeaves = [| for (_, p) in pairs -> p |]
    let cur = MerkleTree curLeaves
    let prior = MerkleTree priorLeaves
    let diff = cur.LeafDiff prior
    // patch prior with ONLY the changed leaves the diff identified → converge
    let patched = Array.copy priorLeaves
    for i in diff do
        patched.[i] <- curLeaves.[i]
    (MerkleTree patched).Root = cur.Root

[<Fact>]
let ``Merkle × homeostat: anti-entropy fixed case (one changed leaf syncs via the diff)`` () =
    let cur = MerkleTree [| "a"B; "b"B; "c"B |]
    let prior = MerkleTree [| "a"B; "X"B; "c"B |]
    let diff = cur.LeafDiff prior
    Assert.Equal<int[]>([| 1 |], diff) // exactly the changed index
    let patched = [| "a"B; "X"B; "c"B |]
    for i in diff do
        patched.[i] <- [| "a"B; "b"B; "c"B |].[i]
    Assert.Equal(cur.Root, (MerkleTree patched).Root) // converged after shipping only leaf 1

// ── Merkle × 4-lang (F# ↔ C#) byte-lock leg ──
// The C# oracle (Zeta.Core.CSharp.Merkle) shares System.IO.Hashing.XxHash128 and the
// identical little-endian Hi/Lo combine layout, so the root over the same leaves is
// BYTE-IDENTICAL across F# and C#. This is the SECOND of the four language ports;
// Rust + pure-TS XxHash128 (byte-identical to .NET's XXH3-128) remain the 4-lang gap.

let private genLeaves : Gen<byte[][]> =
    Gen.arrayOf (Gen.arrayOf (Gen.choose (0, 255) |> Gen.map byte))

type LeavesArb() =
    static member L() = Arb.fromGen genLeaves

[<Property(Arbitrary = [| typeof<LeavesArb> |])>]
let ``Merkle × 4-lang: F# and C# produce byte-identical roots over the same leaves`` (leaves: byte[][]) =
    let fsRoot = (MerkleTree leaves).Root
    let csRoot = (Zeta.Core.CSharp.MerkleTree(leaves)).Root
    fsRoot.ToHex() = csRoot.ToHex()

[<Fact>]
let ``Merkle × 4-lang: F# ↔ C# byte-lock on fixed cases (empty / single / odd / even)`` () =
    let cases =
        [ [||]
          [| "a"B |]
          [| "a"B; "b"B; "c"B |]
          [| "x"B; "y"B; "z"B; "w"B; "q"B |] ]
    for leaves in cases do
        Assert.Equal((MerkleTree leaves).Root.ToHex(), (Zeta.Core.CSharp.MerkleTree(leaves)).Root.ToHex())
