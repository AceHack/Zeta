module Zeta.Tests.ThresholdSignatureVerificationTests

// Acceptance tests for clean-room derivation B of
// `docs/specs/threshold-signature-verification-cleanroom-spec.md`.
//
// Every test below is written to DISCRIMINATE: each one names two inputs that make the same
// function's output differ, per the spec's "a criterion satisfiable by a literal is not a
// criterion". Where a test only observes a shape rather than separating two behaviours it is
// marked in the derivation report as `partial`, not `implemented`.

open System
open System.Security.Cryptography
open global.Xunit
open Zeta.Core

module TSV = ThresholdSignatureVerification
module Schemes = ThresholdSignatureSchemes

// ----------------------------------------------------------------- fixtures

let private ecdsaId = TSV.SchemeId Schemes.EcdsaP256Sha256Id
let private rsaId = TSV.SchemeId Schemes.RsaPssSha256Id
let private toyId = TSV.SchemeId Schemes.ToyOpenId

let private hex (b: byte[]) = Convert.ToHexString(b).ToLowerInvariant()

/// A fresh P-256 signer: (SPKI public key hex, sign : message -> signature hex).
let private newEcdsaSigner () =
    let key = ECDsa.Create(ECCurve.NamedCurves.nistP256)
    hex (key.ExportSubjectPublicKeyInfo()), (fun (msg: byte[]) -> hex (key.SignData(msg, HashAlgorithmName.SHA256)))

/// A fresh RSA-2048 signer under PSS/SHA-256.
let private newRsaSigner () =
    let key = RSA.Create(2048)

    hex (key.ExportSubjectPublicKeyInfo()),
    (fun (msg: byte[]) -> hex (key.SignData(msg, HashAlgorithmName.SHA256, RSASignaturePadding.Pss)))

let private registry =
    match TSV.createRegistry [ Schemes.ecdsaP256Sha256; Schemes.rsaPssSha256; Schemes.toyOpenDouble ] with
    | Ok r -> r
    | Error e -> failwithf "registry config error: %A" e

let private window scheme (fromEpoch: int64) (untilEpoch: int64 option) : TSV.SchemeAcceptance =
    { Scheme = scheme
      AcceptFrom = TSV.Epoch fromEpoch
      AcceptUntil = Option.map TSV.Epoch untilEpoch }

let private openWindow scheme = window scheme 0L None

let private mkVerifier id roster threshold accepted =
    match
        TSV.createVerifier
            { Id = TSV.VerifierId id
              Roster = roster
              Threshold = threshold
              Accepted = accepted }
    with
    | Ok v -> v
    | Error e -> failwithf "verifier config error: %A" e

let private mkRequest scope payloadHex : TSV.Request =
    { Scope = scope; PayloadHex = payloadHex }

let private request = mkRequest "ksk.rotate" "0badc0de"

let private messageOf req =
    match TSV.canonicalMessage req with
    | Ok m -> m
    | Error e -> failwithf "bad request: %A" e

let private verdictOf v subs =
    match TSV.verify v registry (TSV.Epoch 0L) request subs with
    | Ok verdict -> verdict
    | Error e -> failwithf "bad request: %A" e

let private entry signer keys : TSV.RosterEntry = { Signer = signer; Keys = keys }

let private submission signer scheme sigHex : TSV.Submission =
    { Signer = signer
      Scheme = scheme
      SignatureHex = sigHex }

let private signerA = TSV.SignerId "alice"
let private signerB = TSV.SignerId "bob"
let private signerC = TSV.SignerId "carol"

/// Flip the lowest bit of the first byte of a hex signature.
let private flipOneBit (sigHex: string) =
    let bytes = Convert.FromHexString(sigHex)
    bytes[0] <- bytes[0] ^^^ 1uy
    hex bytes

// ----------------------------------------------------------------- acceptance 1 (R2/R3)

[<Fact>]
let ``acceptance 1 - identical request: rostered verifier authorizes, off-roster verifier reports unknown signers`` () =
    let keyA, signA = newEcdsaSigner ()
    let keyB, signB = newEcdsaSigner ()
    let msg = messageOf request

    let subs =
        [ submission signerA ecdsaId (signA msg)
          submission signerB ecdsaId (signB msg) ]

    let knowing =
        mkVerifier "knows-both" [ entry signerA [ ecdsaId, keyA ]; entry signerB [ ecdsaId, keyB ] ] 2 [ openWindow ecdsaId ]

    // Same key material, different identities: the signers are simply not this verifier's people.
    let stranger =
        mkVerifier
            "knows-neither"
            [ entry (TSV.SignerId "dave") [ ecdsaId, keyA ]
              entry (TSV.SignerId "erin") [ ecdsaId, keyB ] ]
            2
            [ openWindow ecdsaId ]

    Assert.Equal(TSV.Authorized, (verdictOf knowing subs).Decision)

    let denied = verdictOf stranger subs
    Assert.Equal(TSV.Denied(TSV.UnknownSignersPresent 2), denied.Decision)
    Assert.Contains(TSV.UnknownSigner signerA, denied.Outcomes)
    Assert.Contains(TSV.UnknownSigner signerB, denied.Outcomes)
    Assert.Empty(denied.CountedSigners)

// ----------------------------------------------------------------- acceptance 2 (R5)

[<Fact>]
let ``acceptance 2 - a single flipped bit denies with a verification failure, not an insufficient count`` () =
    let keyA, signA = newEcdsaSigner ()
    let keyB, signB = newEcdsaSigner ()
    let msg = messageOf request

    let v =
        mkVerifier "v" [ entry signerA [ ecdsaId, keyA ]; entry signerB [ ecdsaId, keyB ] ] 2 [ openWindow ecdsaId ]

    let intact =
        [ submission signerA ecdsaId (signA msg)
          submission signerB ecdsaId (signB msg) ]

    let tampered =
        [ submission signerA ecdsaId (signA msg)
          submission signerB ecdsaId (flipOneBit (signB msg)) ]

    Assert.Equal(TSV.Authorized, (verdictOf v intact).Decision)

    let denied = verdictOf v tampered
    Assert.Equal(TSV.Denied(TSV.SignatureVerificationFailed 1), denied.Decision)
    Assert.Contains(TSV.SignatureInvalid(signerB, ecdsaId), denied.Outcomes)
    Assert.Equal<TSV.SignerId list>([ signerA ], denied.CountedSigners)

[<Fact>]
let ``R5 - a signature over one scope does not authorize another scope`` () =
    let keyA, signA = newEcdsaSigner ()

    let v = mkVerifier "v" [ entry signerA [ ecdsaId, keyA ] ] 1 [ openWindow ecdsaId ]

    let otherScope = mkRequest "ksk.destroy" request.PayloadHex
    let sigOverOther = signA (messageOf otherScope)

    // Same bytes, replayed against a different scope: counted there, rejected here.
    match TSV.verify v registry (TSV.Epoch 0L) otherScope [ submission signerA ecdsaId sigOverOther ] with
    | Ok verdict -> Assert.Equal(TSV.Authorized, verdict.Decision)
    | Error e -> failwithf "bad request: %A" e

    let replayed = verdictOf v [ submission signerA ecdsaId sigOverOther ]
    Assert.Equal(TSV.Denied(TSV.SignatureVerificationFailed 1), replayed.Decision)

[<Fact>]
let ``R5 - the signed message is length-framed, so the scope/payload boundary cannot be moved`` () =
    // "ab" + payload 0xcd   vs   "a" + payload 0x62 0xcd  are the same bytes under naive
    // concatenation ('b' = 0x62) and must NOT be under a framed encoding.
    let left = messageOf (mkRequest "ab" "cd")
    let right = messageOf (mkRequest "a" "62cd")
    Assert.NotEqual<byte[]>(left, right)

// ----------------------------------------------------------------- acceptance 3 (R4)

[<Fact>]
let ``acceptance 3 - one signer submitting threshold times does not authorize, and duplication is reported`` () =
    let keyA, signA = newEcdsaSigner ()
    let keyB, signB = newEcdsaSigner ()
    let msg = messageOf request

    let v =
        mkVerifier "v" [ entry signerA [ ecdsaId, keyA ]; entry signerB [ ecdsaId, keyB ] ] 2 [ openWindow ecdsaId ]

    // Two genuinely distinct valid signatures — ECDSA is randomized, so these differ in bytes.
    let doubled =
        [ submission signerA ecdsaId (signA msg)
          submission signerA ecdsaId (signA msg) ]

    let twoSigners =
        [ submission signerA ecdsaId (signA msg)
          submission signerB ecdsaId (signB msg) ]

    Assert.Equal(TSV.Authorized, (verdictOf v twoSigners).Decision)

    let denied = verdictOf v doubled
    Assert.Equal(TSV.Denied(TSV.DuplicateSubmissionsCollapsed(1, 1, 2)), denied.Decision)
    Assert.Contains(TSV.DuplicateSubmission signerA, denied.Outcomes)
    Assert.Equal<TSV.SignerId list>([ signerA ], denied.CountedSigners)

// ----------------------------------------------------------------- acceptance 4 (R2)

[<Fact>]
let ``acceptance 4 - two verifiers with different rosters reach different verdicts on one request`` () =
    let keyA, signA = newEcdsaSigner ()
    let keyB, signB = newEcdsaSigner ()
    let keyC, _ = newEcdsaSigner ()
    let msg = messageOf request

    let subs =
        [ submission signerA ecdsaId (signA msg)
          submission signerB ecdsaId (signB msg) ]

    let v1 =
        mkVerifier "v1" [ entry signerA [ ecdsaId, keyA ]; entry signerB [ ecdsaId, keyB ] ] 2 [ openWindow ecdsaId ]

    let v2 =
        mkVerifier "v2" [ entry signerA [ ecdsaId, keyA ]; entry signerC [ ecdsaId, keyC ] ] 2 [ openWindow ecdsaId ]

    let a = verdictOf v1 subs
    let b = verdictOf v2 subs

    Assert.Equal(TSV.Authorized, a.Decision)
    Assert.Equal(TSV.Denied(TSV.UnknownSignersPresent 1), b.Decision)
    Assert.NotEqual(a.Verifier, b.Verifier)

[<Fact>]
let ``R3 - an unknown signer's valid-looking signature does not contribute to the count`` () =
    let keyA, signA = newEcdsaSigner ()
    let keyB, signB = newEcdsaSigner ()
    let msg = messageOf request

    // Roster knows A and B; the submission set swaps B for an unrostered identity.
    let v =
        mkVerifier "v" [ entry signerA [ ecdsaId, keyA ]; entry signerB [ ecdsaId, keyB ] ] 2 [ openWindow ecdsaId ]

    let withStranger =
        [ submission signerA ecdsaId (signA msg)
          submission (TSV.SignerId "mallory") ecdsaId (signB msg) ]

    let denied = verdictOf v withStranger
    Assert.Equal(TSV.Denied(TSV.UnknownSignersPresent 1), denied.Decision)
    Assert.Equal<TSV.SignerId list>([ signerA ], denied.CountedSigners)

// ----------------------------------------------------------------- acceptance 5 (R6)

[<Fact>]
let ``acceptance 5 - the same request and roster verify under two scheme implementations, same call site`` () =
    let ecKeyA, ecSignA = newEcdsaSigner ()
    let ecKeyB, ecSignB = newEcdsaSigner ()
    let rsaKeyA, rsaSignA = newRsaSigner ()
    let rsaKeyB, rsaSignB = newRsaSigner ()
    let msg = messageOf request

    let v =
        mkVerifier
            "v"
            [ entry signerA [ ecdsaId, ecKeyA; rsaId, rsaKeyA ]
              entry signerB [ ecdsaId, ecKeyB; rsaId, rsaKeyB ] ]
            2
            [ openWindow ecdsaId; window rsaId 0L (Some 1000L) ]

    let underEcdsa =
        [ submission signerA ecdsaId (ecSignA msg)
          submission signerB ecdsaId (ecSignB msg) ]

    let underRsa =
        [ submission signerA rsaId (rsaSignA msg)
          submission signerB rsaId (rsaSignB msg) ]

    // Identical call site; only the data differs.
    Assert.Equal(TSV.Authorized, (verdictOf v underEcdsa).Decision)
    Assert.Equal(TSV.Authorized, (verdictOf v underRsa).Decision)

    // And the schemes are genuinely different implementations: an RSA signature is not an
    // ECDSA one.
    let crossed =
        [ submission signerA ecdsaId (rsaSignA msg)
          submission signerB ecdsaId (ecSignB msg) ]

    Assert.Equal(TSV.Denied(TSV.SignatureVerificationFailed 1), (verdictOf v crossed).Decision)

[<Fact>]
let ``R6 - two implementations claiming one scheme id is a configuration error, not last-one-wins`` () =
    match TSV.createRegistry [ Schemes.ecdsaP256Sha256; Schemes.ecdsaP256Sha256 ] with
    | Error(TSV.DuplicateSchemeImplementation id) -> Assert.Equal(ecdsaId, id)
    | other -> failwithf "expected duplicate-implementation error, got %A" other

[<Fact>]
let ``R6 - a scheme accepted by policy but absent from the registry is reported, not treated as invalid`` () =
    let keyA, _ = newEcdsaSigner ()
    let v = mkVerifier "v" [ entry signerA [ toyId, keyA ] ] 1 [ openWindow toyId ]

    let emptyRegistry =
        match TSV.createRegistry [] with
        | Ok r -> r
        | Error e -> failwithf "registry config error: %A" e

    match TSV.verify v emptyRegistry (TSV.Epoch 0L) request [ submission signerA toyId (String.replicate 64 "0") ] with
    | Ok verdict ->
        Assert.Contains(TSV.SchemeUnavailable(signerA, toyId), verdict.Outcomes)
        Assert.Equal(TSV.Denied(TSV.SchemeUnusable 1), verdict.Decision)
    | Error e -> failwithf "bad request: %A" e

// ----------------------------------------------------------------- acceptance 6 (R7)

/// A verifier mid-migration: the toy scheme is retiring at epoch 20 (inclusive), the ECDSA
/// scheme is current. The toy double lets the window be exercised without key generation.
let private migrationFixture () =
    let toyKey = "aabbcc"
    let toyKeyBytes = Convert.FromHexString(toyKey)
    let ecKey, ecSign = newEcdsaSigner ()

    let v =
        mkVerifier
            "migrating"
            [ entry signerA [ toyId, toyKey; ecdsaId, ecKey ] ]
            1
            [ window toyId 10L (Some 20L); openWindow ecdsaId ]

    let toySig msg = hex (Schemes.toyOpenSignature toyKeyBytes msg)
    v, toySig, ecSign

[<Fact>]
let ``acceptance 6 - the retiring scheme verifies inside its window and is refused on both sides of it`` () =
    let v, toySig, _ = migrationFixture ()
    let msg = messageOf request
    let subs = [ submission signerA toyId (toySig msg) ]

    let at e =
        match TSV.verify v registry (TSV.Epoch e) request subs with
        | Ok verdict -> verdict
        | Error err -> failwithf "bad request: %A" err

    // Lower boundary: 9 refused, 10 accepted.
    Assert.Equal(TSV.Denied(TSV.SchemeUnusable 1), (at 9L).Decision)
    Assert.Equal(TSV.Authorized, (at 10L).Decision)
    // Inside.
    Assert.Equal(TSV.Authorized, (at 15L).Decision)
    // Upper boundary: 20 accepted, 21 refused.
    Assert.Equal(TSV.Authorized, (at 20L).Decision)
    Assert.Equal(TSV.Denied(TSV.SchemeUnusable 1), (at 21L).Decision)
    Assert.Contains(TSV.SchemeNotAccepted(signerA, toyId), (at 21L).Outcomes)

[<Fact>]
let ``acceptance 6 - the current scheme keeps verifying after the retiring one has lapsed`` () =
    let v, toySig, ecSign = migrationFixture ()
    let msg = messageOf request

    let at e subs =
        match TSV.verify v registry (TSV.Epoch e) request subs with
        | Ok verdict -> verdict.Decision
        | Error err -> failwithf "bad request: %A" err

    // Inside the overlap both schemes authorize; outside it only the current one does.
    Assert.Equal(TSV.Authorized, at 15L [ submission signerA toyId (toySig msg) ])
    Assert.Equal(TSV.Authorized, at 15L [ submission signerA ecdsaId (ecSign msg) ])
    Assert.Equal(TSV.Denied(TSV.SchemeUnusable 1), at 99L [ submission signerA toyId (toySig msg) ])
    Assert.Equal(TSV.Authorized, at 99L [ submission signerA ecdsaId (ecSign msg) ])

// ----------------------------------------------------------------- acceptance 7 (R9)

[<Fact>]
let ``acceptance 7 - the verdict is identical across repeated invocations and submission orderings`` () =
    let keyA, signA = newEcdsaSigner ()
    let keyB, signB = newEcdsaSigner ()
    let keyC, signC = newEcdsaSigner ()
    let msg = messageOf request

    let v =
        mkVerifier
            "v"
            [ entry signerA [ ecdsaId, keyA ]
              entry signerB [ ecdsaId, keyB ]
              entry signerC [ ecdsaId, keyC ] ]
            2
            [ openWindow ecdsaId ]

    let a = submission signerA ecdsaId (signA msg)
    let b = submission signerB ecdsaId (signB msg)
    let c = submission signerC ecdsaId (flipOneBit (signC msg))
    let d = submission (TSV.SignerId "mallory") ecdsaId (signA msg)

    let baseline = verdictOf v [ a; b; c; d ]

    for perm in
        [ [ a; b; c; d ]
          [ d; c; b; a ]
          [ b; d; a; c ]
          [ c; a; d; b ]
          [ a; b; c; d ] ] do
        Assert.Equal(baseline, verdictOf v perm)

    // ...and the verdict is not a constant: change the inputs and it changes.
    Assert.NotEqual(baseline, verdictOf v [ a; b ])

// ----------------------------------------------------------------- R8 (bounded configuration)

[<Fact>]
let ``R8 - a threshold below one is a configuration error`` () =
    let cfg: TSV.VerifierConfig =
        { Id = TSV.VerifierId "v"
          Roster = [ entry signerA [ ecdsaId, "aabb" ] ]
          Threshold = 0
          Accepted = [ openWindow ecdsaId ] }

    Assert.Equal(Error(TSV.ThresholdBelowOne 0), TSV.createVerifier cfg)
    Assert.True((TSV.createVerifier { cfg with Threshold = 1 }) |> Result.isOk)

[<Fact>]
let ``R8 - a threshold above the roster size is a configuration error, not a permanent silent deny`` () =
    let cfg: TSV.VerifierConfig =
        { Id = TSV.VerifierId "v"
          Roster = [ entry signerA [ ecdsaId, "aabb" ]; entry signerB [ ecdsaId, "ccdd" ] ]
          Threshold = 3
          Accepted = [ openWindow ecdsaId ] }

    Assert.Equal(Error(TSV.ThresholdExceedsRoster(3, 2)), TSV.createVerifier cfg)
    Assert.True((TSV.createVerifier { cfg with Threshold = 2 }) |> Result.isOk)

[<Fact>]
let ``R8 - empty roster, no accepted scheme, duplicate signer and inverted window are all configuration errors`` () =
    let baseCfg: TSV.VerifierConfig =
        { Id = TSV.VerifierId "v"
          Roster = [ entry signerA [ ecdsaId, "aabb" ] ]
          Threshold = 1
          Accepted = [ openWindow ecdsaId ] }

    Assert.Equal(Error TSV.EmptyRoster, TSV.createVerifier { baseCfg with Roster = [] })
    Assert.Equal(Error TSV.NoAcceptedSchemes, TSV.createVerifier { baseCfg with Accepted = [] })

    Assert.Equal(
        Error(TSV.DuplicateRosterEntry signerA),
        TSV.createVerifier
            { baseCfg with
                Roster = [ entry signerA [ ecdsaId, "aabb" ]; entry signerA [ ecdsaId, "ccdd" ] ] }
    )

    Assert.Equal(
        Error(TSV.EmptyAcceptanceWindow ecdsaId),
        TSV.createVerifier
            { baseCfg with
                Accepted = [ window ecdsaId 10L (Some 9L) ] }
    )

    Assert.Equal(
        Error(TSV.MalformedKeyMaterial(signerA, ecdsaId)),
        TSV.createVerifier { baseCfg with Roster = [ entry signerA [ ecdsaId, "not-hex" ] ] }
    )

[<Fact>]
let ``R7 - two simultaneously accepted schemes with no stated end is a configuration error`` () =
    let cfg: TSV.VerifierConfig =
        { Id = TSV.VerifierId "v"
          Roster = [ entry signerA [ ecdsaId, "aabb" ] ]
          Threshold = 1
          Accepted = [ openWindow ecdsaId; openWindow rsaId ] }

    Assert.Equal(Error TSV.UnboundedMigrationOverlap, TSV.createVerifier cfg)

    // Stating the retirement makes the identical configuration valid.
    let bounded =
        { cfg with
            Accepted = [ openWindow ecdsaId; window rsaId 0L (Some 5L) ] }

    Assert.True(TSV.createVerifier bounded |> Result.isOk)

// ----------------------------------------------------------------- R10 (no secrets out)

[<Fact>]
let ``R10 - neither key material nor signature bytes appear anywhere in a verdict`` () =
    let keyA, signA = newEcdsaSigner ()
    let keyB, signB = newEcdsaSigner ()
    let msg = messageOf request
    let sigA = signA msg
    let sigB = flipOneBit (signB msg)

    let v =
        mkVerifier "v" [ entry signerA [ ecdsaId, keyA ]; entry signerB [ ecdsaId, keyB ] ] 2 [ openWindow ecdsaId ]

    let rendered = sprintf "%A" (verdictOf v [ submission signerA ecdsaId sigA; submission signerB ecdsaId sigB ])

    Assert.DoesNotContain(keyA, rendered, StringComparison.OrdinalIgnoreCase)
    Assert.DoesNotContain(keyB, rendered, StringComparison.OrdinalIgnoreCase)
    Assert.DoesNotContain(sigA, rendered, StringComparison.OrdinalIgnoreCase)
    Assert.DoesNotContain(sigB, rendered, StringComparison.OrdinalIgnoreCase)
    // ...while the identities the caller is owed ARE present.
    Assert.Contains("alice", rendered, StringComparison.Ordinal)

// ----------------------------------------------------------------- request-level errors

[<Fact>]
let ``a malformed payload is a request error rather than a denial`` () =
    let keyA, _ = newEcdsaSigner ()
    let v = mkVerifier "v" [ entry signerA [ ecdsaId, keyA ] ] 1 [ openWindow ecdsaId ]

    let bad = mkRequest "ksk.rotate" "zz"

    Assert.Equal(Error TSV.MalformedPayloadHex, TSV.verify v registry (TSV.Epoch 0L) bad [])

[<Fact>]
let ``a malformed signature is reported as rejected input, not as an invalid signature`` () =
    let keyA, _ = newEcdsaSigner ()
    let v = mkVerifier "v" [ entry signerA [ ecdsaId, keyA ] ] 1 [ openWindow ecdsaId ]
    let verdict = verdictOf v [ submission signerA ecdsaId "zz" ]

    Assert.Contains(TSV.SchemeRejectedInput(signerA, ecdsaId, TSV.MalformedSignature), verdict.Outcomes)

[<Fact>]
let ``a rostered signer with no key under the submitted scheme is reported distinctly`` () =
    let keyA, signA = newEcdsaSigner ()
    let msg = messageOf request

    let v =
        mkVerifier
            "v"
            [ entry signerA [ ecdsaId, keyA ] ]
            1
            [ openWindow ecdsaId; window toyId 0L (Some 9L) ]

    let verdict = verdictOf v [ submission signerA toyId (String.replicate 64 "0") ]
    Assert.Contains(TSV.NoKeyForScheme(signerA, toyId), verdict.Outcomes)
    // The same verifier authorizes the same signer under the scheme it does hold a key for.
    Assert.Equal(TSV.Authorized, (verdictOf v [ submission signerA ecdsaId (signA msg) ]).Decision)
