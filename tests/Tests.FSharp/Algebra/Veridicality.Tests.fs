module Zeta.Tests.Algebra.VeridicalityTests

open System
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ─── Provenance / validateProvenance ─────────

let private goodProv () : Veridicality.Provenance =
    { SourceId = "repo/amara/ferry-10"
      RootAuthority = "amara@aurora"
      ArtifactHash = "blake3:3f8e..."
      BuilderId = Some "otto-115"
      TimestampUtc = DateTimeOffset.UtcNow
      EvidenceClass = "research"
      SignatureOk = true }

[<Fact>]
let ``validateProvenance accepts a fully-populated signed provenance`` () =
    Veridicality.validateProvenance (goodProv ()) |> should equal true

[<Fact>]
let ``validateProvenance rejects empty SourceId`` () =
    let p = { goodProv () with SourceId = "" }
    Veridicality.validateProvenance p |> should equal false

[<Fact>]
let ``validateProvenance rejects empty RootAuthority`` () =
    let p = { goodProv () with RootAuthority = "" }
    Veridicality.validateProvenance p |> should equal false

[<Fact>]
let ``validateProvenance rejects empty ArtifactHash`` () =
    let p = { goodProv () with ArtifactHash = "" }
    Veridicality.validateProvenance p |> should equal false

[<Fact>]
let ``validateProvenance rejects SignatureOk = false`` () =
    let p = { goodProv () with SignatureOk = false }
    Veridicality.validateProvenance p |> should equal false

[<Fact>]
let ``validateProvenance accepts BuilderId = None (not a hard gate)`` () =
    // BuilderId is a quality signal, not a validity gate. An
    // artifact can be legitimately signed without a builder
    // identity (e.g., a human-authored doc signed with a personal
    // key).
    let p = { goodProv () with BuilderId = None }
    Veridicality.validateProvenance p |> should equal true


// ─── Claim<'T> / validateClaim ─────────

[<Fact>]
let ``validateClaim wraps validateProvenance on the claim's provenance`` () =
    let c =
        { Id = "claim-001"
          Payload = 42
          Weight = 1L
          Prov = goodProv () }
    Veridicality.validateClaim c |> should equal true

[<Fact>]
let ``validateClaim is polymorphic over the Payload type`` () =
    // Same validation whether payload is int, string, record, etc.
    // The provenance discipline doesn't depend on payload shape.
    let c =
        { Id = "claim-002"
          Payload = "Zeta is a retraction-native substrate."
          Weight = 1L
          Prov = goodProv () }
    Veridicality.validateClaim c |> should equal true

[<Fact>]
let ``validateClaim rejects a claim with invalid provenance`` () =
    let c =
        { Id = "claim-003"
          Payload = ()
          Weight = 1L
          Prov = { goodProv () with SignatureOk = false } }
    Veridicality.validateClaim c |> should equal false

[<Fact>]
let ``Claim supports negative Weight for retraction semantics`` () =
    // Z-set style: negative weight = retraction. validateClaim
    // does NOT inspect Weight; a retraction claim is valid if its
    // provenance is valid. Retraction semantics are at the ledger
    // level, not the claim-validity level.
    let c =
        { Id = "claim-004"
          Payload = 7
          Weight = -1L
          Prov = goodProv () }
    Veridicality.validateClaim c |> should equal true


// ─── canonicalKey / groupByCanonical ─────────

let private simpleProject (payload: string) : string * string * string * string * string =
    // toy projector: splits on "|" into 5 parts. Real projectors
    // apply normalization (lowercase / trim / unit-unify) first.
    match payload.Split('|') with
    | [| s; p; o; t; m |] -> s, p, o, t, m
    | _ -> "", "", "", "", ""

let private claimOfPayload (id: string) (payload: string) (root: string) : Veridicality.Claim<string> =
    { Id = id
      Payload = payload
      Weight = 1L
      Prov = { goodProv () with RootAuthority = root } }

[<Fact>]
let ``canonicalKey projects payload fields into record`` () =
    let c = claimOfPayload "c1" "Zeta|is|retraction-native|now|fact" "root-a"
    let key = Veridicality.canonicalKey simpleProject c
    key.Subject |> should equal "Zeta"
    key.Predicate |> should equal "is"
    key.Object |> should equal "retraction-native"
    key.TimeScope |> should equal "now"
    key.Modality |> should equal "fact"

[<Fact>]
let ``canonicalKey EXCLUDES provenance-root (two claims same proposition, different roots, match)`` () =
    let c1 = claimOfPayload "c1" "Zeta|is|retraction-native|now|fact" "root-a"
    let c2 = claimOfPayload "c2" "Zeta|is|retraction-native|now|fact" "root-b"
    let k1 = Veridicality.canonicalKey simpleProject c1
    let k2 = Veridicality.canonicalKey simpleProject c2
    k1 |> should equal k2

[<Fact>]
let ``canonicalKey distinguishes different propositions`` () =
    let c1 = claimOfPayload "c1" "Zeta|is|retraction-native|now|fact" "root-a"
    let c2 = claimOfPayload "c2" "Zeta|is|immutable|now|fact" "root-a"
    let k1 = Veridicality.canonicalKey simpleProject c1
    let k2 = Veridicality.canonicalKey simpleProject c2
    k1 |> should not' (equal k2)

[<Fact>]
let ``groupByCanonical groups claims with same proposition under one key`` () =
    let claims = [
        claimOfPayload "c1" "Zeta|is|retraction-native|now|fact" "root-a"
        claimOfPayload "c2" "Zeta|is|retraction-native|now|fact" "root-b"
        claimOfPayload "c3" "Zeta|is|immutable|now|fact" "root-a"
    ]
    let grouped = Veridicality.groupByCanonical simpleProject claims
    grouped |> Map.count |> should equal 2
    // The retraction-native group should have 2 claims
    let retractionKey: Veridicality.CanonicalClaimKey =
        { Subject = "Zeta"; Predicate = "is"; Object = "retraction-native"; TimeScope = "now"; Modality = "fact" }
    grouped.[retractionKey] |> List.length |> should equal 2

[<Fact>]
let ``groupByCanonical preserves input order within each bucket`` () =
    let c1 = claimOfPayload "c1" "A|is|X|now|fact" "root-a"
    let c2 = claimOfPayload "c2" "A|is|X|now|fact" "root-b"
    let c3 = claimOfPayload "c3" "A|is|X|now|fact" "root-c"
    let grouped = Veridicality.groupByCanonical simpleProject [c1; c2; c3]
    let only = grouped |> Map.toList |> List.head |> snd
    only |> List.map (fun c -> c.Id) |> should equal ["c1"; "c2"; "c3"]

[<Fact>]
let ``groupByCanonical on empty seq returns empty map`` () =
    Veridicality.groupByCanonical simpleProject [] |> Map.count |> should equal 0

[<Fact>]
let ``groupByCanonical produces distinct-root counts per bucket`` () =
    // The downstream composition (group → per-bucket independence
    // check) is what `antiConsensusGate` enables once both
    // primitives land on main. Here we verify the groupByCanonical
    // half: buckets contain the claims with matching proposition,
    // and downstream code can count distinct Prov.RootAuthority.
    let claims = [
        claimOfPayload "c1" "A|is|X|now|fact" "root-a"
        claimOfPayload "c2" "A|is|X|now|fact" "root-b"
        claimOfPayload "c3" "A|is|Y|now|fact" "root-a"
        claimOfPayload "c4" "A|is|Y|now|fact" "root-a"
    ]
    let grouped = Veridicality.groupByCanonical simpleProject claims
    let xKey: Veridicality.CanonicalClaimKey =
        { Subject = "A"; Predicate = "is"; Object = "X"; TimeScope = "now"; Modality = "fact" }
    let yKey: Veridicality.CanonicalClaimKey =
        { Subject = "A"; Predicate = "is"; Object = "Y"; TimeScope = "now"; Modality = "fact" }
    let distinctRoots bucket =
        bucket |> List.map (fun c -> c.Prov.RootAuthority) |> Set.ofList |> Set.count
    distinctRoots grouped.[xKey] |> should equal 2
    distinctRoots grouped.[yKey] |> should equal 1


// ─── antiConsensusGate ─────────

let private claimWithRoot (id: string) (root: string) : Veridicality.Claim<int> =
    { Id = id
      Payload = 0
      Weight = 1L
      Prov = { goodProv () with RootAuthority = root } }

[<Fact>]
let ``antiConsensusGate rejects empty list`` () =
    match Veridicality.antiConsensusGate [] with
    | Error _ -> ()
    | Ok _ -> failwith "expected Error for empty list"

[<Fact>]
let ``antiConsensusGate rejects a single-claim list`` () =
    let claims = [ claimWithRoot "c1" "root-a" ]
    match Veridicality.antiConsensusGate claims with
    | Error _ -> ()
    | Ok _ -> failwith "expected Error for single claim"

[<Fact>]
let ``antiConsensusGate rejects many claims from a single root`` () =
    // 50-way agreement from one root is still one piece of
    // evidence, not 50.
    let claims =
        [ for i in 1 .. 50 -> claimWithRoot $"c{i}" "root-a" ]
    match Veridicality.antiConsensusGate claims with
    | Error msg -> msg.Contains("independent") |> should equal true
    | Ok _ -> failwith "expected Error for same-root cluster"

[<Fact>]
let ``antiConsensusGate accepts two claims from two distinct roots`` () =
    let claims =
        [ claimWithRoot "c1" "root-a"
          claimWithRoot "c2" "root-b" ]
    match Veridicality.antiConsensusGate claims with
    | Ok returned -> returned |> should equal claims
    | Error msg -> failwith $"expected Ok, got Error: {msg}"

[<Fact>]
let ``antiConsensusGate accepts many claims spanning multiple roots`` () =
    let claims =
        [ claimWithRoot "c1" "root-a"
          claimWithRoot "c2" "root-a"
          claimWithRoot "c3" "root-b"
          claimWithRoot "c4" "root-c" ]
    match Veridicality.antiConsensusGate claims with
    | Ok _ -> ()
    | Error msg -> failwith $"expected Ok, got Error: {msg}"

[<Fact>]
let ``antiConsensusGate returns Ok with the original list unchanged on pass`` () =
    // Gate is read-only: it returns the same list it was given.
    let claims =
        [ claimWithRoot "c1" "root-a"
          claimWithRoot "c2" "root-b" ]
    match Veridicality.antiConsensusGate claims with
    | Ok returned -> returned |> List.length |> should equal 2
    | Error msg -> failwith msg

[<Fact>]
let ``antiConsensusGate does NOT count empty RootAuthority as a distinct root`` () =
    // Degenerate/missing RootAuthority values must be filtered
    // before counting distinct roots — otherwise an empty string
    // would inflate the anti-consensus count and let a single-
    // source cluster pass the gate.
    let claims =
        [ claimWithRoot "c1" "root-a"
          claimWithRoot "c2" "" ]
    match Veridicality.antiConsensusGate claims with
    | Error _ -> ()
    | Ok _ -> failwith "expected Error when the only 'second root' is empty"

[<Fact>]
let ``antiConsensusGate does NOT count whitespace RootAuthority as a distinct root`` () =
    // Whitespace-only RootAuthority values are treated the same
    // as empty — they don't count toward the distinct-root total.
    let claims =
        [ claimWithRoot "c1" "root-a"
          claimWithRoot "c2" "   " ]
    match Veridicality.antiConsensusGate claims with
    | Error _ -> ()
    | Ok _ -> failwith "expected Error when the only 'second root' is whitespace"

[<Fact>]
let ``antiConsensusGate skips empty RootAuthority but still passes on two valid roots`` () =
    // Empty-root claims are silently skipped; remaining valid
    // roots are counted. Two valid distinct roots → pass.
    let claims =
        [ claimWithRoot "c1" "root-a"
          claimWithRoot "c2" ""
          claimWithRoot "c3" "root-b" ]
    match Veridicality.antiConsensusGate claims with
    | Ok _ -> ()
    | Error msg -> failwith $"expected Ok (two valid distinct roots), got Error: {msg}"
