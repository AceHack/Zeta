module Zeta.Tests.ThresholdSignatureVerificationTests

// Derivation A of the N-version clean-room build of
// `docs/specs/threshold-signature-verification-cleanroom-spec.md`.
//
// Every test below is named for the requirement or acceptance criterion it discriminates. A test
// that would still pass with the requirement removed is not a test — so each one pins a pair of
// inputs whose outputs differ, per the spec's "a criterion satisfiable by a literal is not a
// criterion".

open System
open global.Xunit
open Zeta.Core
open Zeta.Core.ThresholdSignatureVerification

// -------------------------------------------------------------------------------------------------
// Fixtures — golden vectors, hex-in-text (no binary in the proof lineage).
//
// Four NIST P-256 key pairs were generated once with the platform RNG; only the public SPKI and one
// signature over the canonical message for (scope, payload) below are retained. Verification is
// deterministic, so these bytes replay identically on any machine — the private keys are gone and
// were never needed here.
// -------------------------------------------------------------------------------------------------

let private hex (s: string) : byte[] = Convert.FromHexString s

let private Scope = "zeta.rotate-key"
let private Payload = Text.Encoding.UTF8.GetBytes "successor=081K-ALPHA"

let private aliceSpki =
    hex
        "3059301306072a8648ce3d020106082a8648ce3d030107034200044a5b3fcbc290e38cd559e35772ffe152d09778b6cc987be3902fccf7edb5e1b49ec47a4c6291e6463e35dd63ce4a494415e2495ae5e2191a88d54e38cd59f844"

let private aliceSig =
    hex "172e9077fd949b78a50d5c3538fccde55925c8da9fc33045577e33a822d4fa8f15135bed79316d5e15533838db0d3bfce9c823d0cd2c61c1b334f5fb96ad9102"

let private bobSpki =
    hex
        "3059301306072a8648ce3d020106082a8648ce3d030107034200042e8f2041bbb93f97500ef86dc0ceb92c341aa7a15584e0ec90eec776ea0552b18d89b04920f488100411ae3be17b2565a53b7d8c412c1b96e0c227c2213fdc92"

let private bobSig =
    hex "037f98ecbbfea700d009efaa77c56655a5b10be1a7a675fe886a2e7fdfcf3c5e8c09a0db2de9094b5d8d28d5a06d9d0eb0d5de5ac0ac11ba747ce209a2f29f47"

let private carolSpki =
    hex
        "3059301306072a8648ce3d020106082a8648ce3d03010703420004cca1e65aefc1ced7a8ae27162805e37c30b6a29f76ec940c6027d163f39d8f11156bc454cff563d44cf631635dacd71bd55b936a1ca169a8dc8c1f67f0171681"

let private mallorySpki =
    hex
        "3059301306072a8648ce3d020106082a8648ce3d03010703420004029abde39407000d32ffe84e3bc7d2be6abf82487e5e9f8e27bfee4c6b2abd79bb6b566e773db8c7fbc216dbdae37367cd7493f609a59b9802bd69c8c50ec50d"

let private alice = SignerId "alice"
let private bob = SignerId "bob"
let private carol = SignerId "carol"
let private mallory = SignerId "mallory"

let private ecdsaId = Schemes.EcdsaP256Sha256Id
let private toyId = Schemes.ToyDigestId
let private registry = [ Schemes.ecdsaP256Sha256; Schemes.toyDigest ]

let private ecdsaKey (spki: byte[]) = { Scheme = ecdsaId; Material = spki }
let private toyKey (name: string) = { Scheme = toyId; Material = Text.Encoding.UTF8.GetBytes("toy-key:" + name) }

let private policy roster threshold schemes =
    { Roster = Map.ofList roster
      Threshold = threshold
      AcceptedSchemes = schemes }

let private ecdsaOnly = [ { Scheme = ecdsaId; Status = Current } ]

let private submit signer scheme bytes =
    { Signer = signer
      Scheme = scheme
      Signature = bytes }

let private request subs =
    { Scope = Scope
      Payload = Payload
      Submissions = subs }

let private ok result =
    match result with
    | Ok v -> v
    | Error e -> failwithf "expected Ok, got configuration error %A" e

// The request every "same request" criterion refers to: alice and bob each sign the canonical
// (scope, payload) under the platform scheme.
let private aliceAndBob =
    request [ submit alice ecdsaId aliceSig; submit bob ecdsaId bobSig ]

// -------------------------------------------------------------------------------------------------
// Acceptance 1 / R2 / R3 — off-roster rejection
// -------------------------------------------------------------------------------------------------

[<Fact>]
let ``AC1 R3: identical request — rostered verifier authorizes, non-rostered verifier reports unknown signers`` () =
    let knows =
        policy [ alice, [ ecdsaKey aliceSpki ]; bob, [ ecdsaKey bobSpki ] ] 2 ecdsaOnly

    let stranger =
        policy [ carol, [ ecdsaKey carolSpki ]; mallory, [ ecdsaKey mallorySpki ] ] 2 ecdsaOnly

    let a = ok (verify registry knows aliceAndBob 0L)
    let b = ok (verify registry stranger aliceAndBob 0L)

    Assert.True a.Authorized
    Assert.Equal<SignerId list>([ alice; bob ], a.CountedSigners)

    // The distinct verdict: not "insufficient count" with no explanation — each signer is named as
    // off-roster, so the caller learns *why* without a round trip (R1), and the attempt is visible
    // rather than silently dropped (R3).
    Assert.False b.Authorized
    Assert.Empty b.CountedSigners
    Assert.Equal<(SignerId * RejectReason list) list>([ alice, [ NotOnRoster ]; bob, [ NotOnRoster ] ], b.Rejections)

// -------------------------------------------------------------------------------------------------
// Acceptance 2 / R5 — forgery rejection
// -------------------------------------------------------------------------------------------------

[<Fact>]
let ``AC2 R5: one bit flipped in a signature — rejected as a verification failure, not as a short count`` () =
    let p = policy [ alice, [ ecdsaKey aliceSpki ]; bob, [ ecdsaKey bobSpki ] ] 2 ecdsaOnly

    let tampered = Array.copy aliceSig
    tampered[7] <- tampered[7] ^^^ 1uy // exactly one bit

    let v = ok (verify registry p (request [ submit alice ecdsaId tampered; submit bob ecdsaId bobSig ]) 0L)

    Assert.False v.Authorized
    // Bob still counts: the failure is localized to the altered signature, not to the request.
    Assert.Equal<SignerId list>([ bob ], v.CountedSigners)
    // The reason names cryptographic verification. A count-only gate would have reported two names
    // supplied and authorized; this one reports one signer whose bytes did not verify.
    Assert.Equal<(SignerId * RejectReason list) list>([ alice, [ SignatureDidNotVerify ] ], v.Rejections)

[<Fact>]
let ``R5: an entirely fabricated signature by a rostered signer never counts`` () =
    let p = policy [ alice, [ ecdsaKey aliceSpki ] ] 1 ecdsaOnly
    let fabricated = Array.create 64 0uy
    let v = ok (verify registry p (request [ submit alice ecdsaId fabricated ]) 0L)
    Assert.False v.Authorized
    Assert.Empty v.CountedSigners
    // The same identity with the genuine bytes does authorize — so the discriminator is the bytes.
    let genuine = ok (verify registry p (request [ submit alice ecdsaId aliceSig ]) 0L)
    Assert.True genuine.Authorized

// -------------------------------------------------------------------------------------------------
// Acceptance 3 / R4 — duplicate collapse
// -------------------------------------------------------------------------------------------------

[<Fact>]
let ``AC3 R4: one signer submitting threshold-many valid signatures does not authorize, and is reported as duplicate`` () =
    let p = policy [ alice, [ ecdsaKey aliceSpki ]; bob, [ ecdsaKey bobSpki ] ] 2 ecdsaOnly

    let repeated =
        request [ submit alice ecdsaId aliceSig; submit alice ecdsaId aliceSig ]

    let v = ok (verify registry p repeated 0L)
    Assert.False v.Authorized
    Assert.Equal<SignerId list>([ alice ], v.CountedSigners) // counted once
    Assert.Equal<SignerId list>([ alice ], v.DuplicateSigners) // and the repetition is reported
    // Two *distinct* rostered signers with the same threshold do authorize — the discriminator is
    // distinctness, not submission count.
    Assert.True (ok (verify registry p aliceAndBob 0L)).Authorized

// -------------------------------------------------------------------------------------------------
// Acceptance 4 / R2 — legitimate disagreement
// -------------------------------------------------------------------------------------------------

[<Fact>]
let ``AC4 R2: one request, two partially overlapping rosters — different verdicts, both correct`` () =
    let bothRostered =
        policy [ alice, [ ecdsaKey aliceSpki ]; bob, [ ecdsaKey bobSpki ] ] 2 ecdsaOnly
    // This party trusts alice and carol. Carol did not sign; bob is a stranger to it.
    let overlapping =
        policy [ alice, [ ecdsaKey aliceSpki ]; carol, [ ecdsaKey carolSpki ] ] 2 ecdsaOnly

    let x = ok (verify registry bothRostered aliceAndBob 0L)
    let y = ok (verify registry overlapping aliceAndBob 0L)

    Assert.True x.Authorized
    Assert.False y.Authorized
    Assert.Equal<SignerId list>([ alice ], y.CountedSigners)
    Assert.Equal<(SignerId * RejectReason list) list>([ bob, [ NotOnRoster ] ], y.Rejections)
    Assert.NotEqual(x, y) // no global roster could produce both; the roster is the verifier's own

// -------------------------------------------------------------------------------------------------
// Acceptance 5 / R6 — algorithm swap with no call-site change
// -------------------------------------------------------------------------------------------------

[<Fact>]
let ``AC5 R6: the same scope, payload, signers and threshold verify under two scheme implementations, one call site`` () =
    // ONE call site, used for both runs: it names no algorithm.
    let callSite (p: VerifierPolicy) (r: Request) = ok (verify registry p r 0L)

    let underPlatform =
        callSite
            (policy [ alice, [ ecdsaKey aliceSpki ]; bob, [ ecdsaKey bobSpki ] ] 2 [ { Scheme = ecdsaId; Status = Current } ])
            aliceAndBob

    let aliceToy, bobToy = toyKey "alice", toyKey "bob"

    let underToy =
        callSite
            (policy [ alice, [ aliceToy ]; bob, [ bobToy ] ] 2 [ { Scheme = toyId; Status = Current } ])
            (request
                [ submit alice toyId (Schemes.toyDigestSign aliceToy.Material Scope Payload)
                  submit bob toyId (Schemes.toyDigestSign bobToy.Material Scope Payload) ])

    Assert.True underPlatform.Authorized
    Assert.True underToy.Authorized
    // Same verdict shape from both algorithms — the port is genuinely interchangeable.
    Assert.Equal<SignerId list>(underPlatform.CountedSigners, underToy.CountedSigners)
    // And the swap is not vacuous: bytes valid under one scheme are worthless under the other.
    let crossed =
        callSite
            (policy [ alice, [ aliceToy ]; bob, [ bobToy ] ] 2 [ { Scheme = toyId; Status = Current } ])
            (request [ submit alice toyId aliceSig; submit bob toyId bobSig ])
    Assert.False crossed.Authorized

// -------------------------------------------------------------------------------------------------
// Acceptance 6 / R7 — migration overlap window, boundary checked on both sides
// -------------------------------------------------------------------------------------------------

/// A verifier mid-migration: the platform scheme is current, the toy double is retiring and accepted
/// through epoch 100 inclusive. The bound lives in the data (`Retiring 100L`), not in code.
let private migrating =
    let aliceToy = toyKey "alice"
    let p =
        policy
            [ alice, [ ecdsaKey aliceSpki; aliceToy ]; bob, [ ecdsaKey bobSpki ] ]
            1
            [ { Scheme = ecdsaId; Status = Current }
              { Scheme = toyId; Status = Retiring 100L } ]
    p, aliceToy

[<Fact>]
let ``AC6 R7: a retiring-scheme signature counts inside the stated window and not outside it`` () =
    let p, aliceToy = migrating
    let retiringReq =
        request [ submit alice toyId (Schemes.toyDigestSign aliceToy.Material Scope Payload) ]

    let at (e: int64) = ok (verify registry p retiringReq e)

    // Both sides of the boundary, and the boundary itself (inclusive by this derivation's choice).
    Assert.True (at 0L).Authorized
    Assert.True (at 99L).Authorized
    Assert.True (at 100L).Authorized
    Assert.False (at 101L).Authorized
    Assert.Equal<(SignerId * RejectReason list) list>(
        [ alice, [ RetiringSchemeExpired(toyId, 100L) ] ],
        (at 101L).Rejections
    )

[<Fact>]
let ``R7: current and retiring schemes are accepted simultaneously inside the window`` () =
    let p, aliceToy = migrating
    // alice under the retiring scheme, bob under the current one, one request, threshold raised to 2.
    let mixed =
        request
            [ submit alice toyId (Schemes.toyDigestSign aliceToy.Material Scope Payload)
              submit bob ecdsaId bobSig ]
    let p2 = { p with Threshold = 2 }
    Assert.True (ok (verify registry p2 mixed 50L)).Authorized
    // Past the window only the current-scheme signer survives, so the same request no longer musters 2.
    let after = ok (verify registry p2 mixed 200L)
    Assert.False after.Authorized
    Assert.Equal<SignerId list>([ bob ], after.CountedSigners)

[<Fact>]
let ``R7: a scheme absent from the accepted set is distinct from a retiring scheme past its window`` () =
    let aliceToy = toyKey "alice"
    let notAccepted = policy [ alice, [ ecdsaKey aliceSpki; aliceToy ] ] 1 ecdsaOnly
    let v =
        ok (verify registry notAccepted (request [ submit alice toyId (Schemes.toyDigestSign aliceToy.Material Scope Payload) ]) 0L)
    Assert.Equal<(SignerId * RejectReason list) list>([ alice, [ SchemeNotAccepted toyId ] ], v.Rejections)

[<Fact>]
let ``R1: a rostered signer with no key for the scheme they used is distinguishable from one whose signature failed`` () =
    // alice holds only a platform key but signs under the (accepted) toy scheme.
    let p =
        policy
            [ alice, [ ecdsaKey aliceSpki ] ]
            1
            [ { Scheme = ecdsaId; Status = Current }; { Scheme = toyId; Status = Current } ]
    let v = ok (verify registry p (request [ submit alice toyId (Array.create 32 7uy) ]) 0L)
    Assert.Equal<(SignerId * RejectReason list) list>([ alice, [ NoKeyForScheme toyId ] ], v.Rejections)
    // …versus a signature under a scheme she *does* hold a key for, which fails cryptographically.
    let w = ok (verify registry p (request [ submit alice ecdsaId (Array.create 64 0uy) ]) 0L)
    Assert.Equal<(SignerId * RejectReason list) list>([ alice, [ SignatureDidNotVerify ] ], w.Rejections)

[<Fact>]
let ``R1 observed: the platform ECDSA reports a wrong-length signature as a non-verification, NOT a fault`` () =
    let p = policy [ alice, [ ecdsaKey aliceSpki ] ] 1 ecdsaOnly
    // 40 bytes is not an IEEE-P1363 P-256 signature at all. This test asserts what the platform
    // ACTUALLY does rather than what the port permits: `ECDsa.VerifyData` returns `false` for a
    // wrong-length P1363 signature instead of raising, so the reason is `SignatureDidNotVerify`.
    // Recorded as an observation, not a design claim: an implementation of the same port that
    // length-checked first would legitimately answer `InputRejectedByScheme MalformedSignature`.
    let v = ok (verify registry p (request [ submit alice ecdsaId (Array.create 40 0uy) ]) 0L)
    Assert.False v.Authorized
    Assert.Equal<(SignerId * RejectReason list) list>([ alice, [ SignatureDidNotVerify ] ], v.Rejections)

[<Fact>]
let ``R1: a malformed public key is a scheme fault, distinct from a failed verification`` () =
    // Both implementations of the port are exercised on this path.
    let toyP = policy [ alice, [ { Scheme = toyId; Material = Array.empty } ] ] 1 [ { Scheme = toyId; Status = Current } ]
    let toyV = ok (verify registry toyP (request [ submit alice toyId (Array.create 32 0uy) ]) 0L)
    Assert.Equal<(SignerId * RejectReason list) list>([ alice, [ InputRejectedByScheme MalformedPublicKey ] ], toyV.Rejections)

    // The platform implementation reaches the same reason via its own key parser rejecting garbage.
    let ecdsaP = policy [ alice, [ { Scheme = ecdsaId; Material = Array.create 16 0xABuy } ] ] 1 ecdsaOnly
    let ecdsaV = ok (verify registry ecdsaP (request [ submit alice ecdsaId aliceSig ]) 0L)
    Assert.Equal<(SignerId * RejectReason list) list>([ alice, [ InputRejectedByScheme MalformedPublicKey ] ], ecdsaV.Rejections)

// -------------------------------------------------------------------------------------------------
// Acceptance 7 / R9 — determinism
// -------------------------------------------------------------------------------------------------

[<Fact>]
let ``AC7 R9: repeated invocation, permuted submissions and reversed roster insertion give an identical verdict`` () =
    let forward =
        policy [ alice, [ ecdsaKey aliceSpki ]; bob, [ ecdsaKey bobSpki ]; carol, [ ecdsaKey carolSpki ] ] 2 ecdsaOnly
    let reversedInsertion =
        { forward with
            Roster =
                Map.ofList [ carol, [ ecdsaKey carolSpki ]; bob, [ ecdsaKey bobSpki ]; alice, [ ecdsaKey aliceSpki ] ] }

    let subs =
        [ submit alice ecdsaId aliceSig
          submit bob ecdsaId bobSig
          submit mallory ecdsaId (Array.create 64 3uy) ]

    let baseline = ok (verify registry forward (request subs) 0L)
    Assert.Equal(baseline, ok (verify registry forward (request subs) 0L)) // repeated invocation
    Assert.Equal(baseline, ok (verify registry forward (request (List.rev subs)) 0L)) // permuted submissions
    Assert.Equal(baseline, ok (verify registry forward (request [ subs[1]; subs[2]; subs[0] ]) 0L))
    Assert.Equal(baseline, ok (verify registry reversedInsertion (request subs) 0L)) // roster build order
    Assert.Equal(baseline, ok (verify (List.rev registry) forward (request subs) 0L)) // registry order
    Assert.True baseline.Authorized
    Assert.Equal<(SignerId * RejectReason list) list>([ mallory, [ NotOnRoster ] ], baseline.Rejections)

// -------------------------------------------------------------------------------------------------
// R8 — bounded, non-vacuous configuration
// -------------------------------------------------------------------------------------------------

[<Fact>]
let ``R8: a threshold below one is a configuration error, not an always-authorize`` () =
    let p = policy [ alice, [ ecdsaKey aliceSpki ] ] 0 ecdsaOnly
    Assert.Equal(Error(ThresholdBelowOne 0), verify registry p (request []) 0L)

[<Fact>]
let ``R8: a threshold above the roster size is a configuration error, not a silent permanent denial`` () =
    let p = policy [ alice, [ ecdsaKey aliceSpki ]; bob, [ ecdsaKey bobSpki ] ] 3 ecdsaOnly
    // The discriminator: with threshold 2 the identical inputs return Ok(authorized). With 3 they do
    // not return "Ok, denied" — they return an error naming the misconfiguration.
    Assert.Equal(Error(ThresholdExceedsRosterSize(3, 2)), verify registry p aliceAndBob 0L)
    Assert.True (ok (verify registry { p with Threshold = 2 } aliceAndBob 0L)).Authorized

[<Fact>]
let ``R8: an empty roster and an empty accepted-scheme set are configuration errors`` () =
    Assert.Equal(Error EmptyRoster, verify registry (policy [] 1 ecdsaOnly) aliceAndBob 0L)
    Assert.Equal(
        Error NoAcceptedSchemes,
        verify registry (policy [ alice, [ ecdsaKey aliceSpki ] ] 1 []) aliceAndBob 0L
    )

[<Fact>]
let ``R8: accepting a scheme nobody implements is a configuration error, not a silent rejection of every signature`` () =
    let ghost = SchemeId "pq-scheme-not-yet-shipped"
    let p =
        policy [ alice, [ ecdsaKey aliceSpki ] ] 1 [ { Scheme = ecdsaId; Status = Current }; { Scheme = ghost; Status = Current } ]
    Assert.Equal(Error(UnimplementedScheme ghost), verify registry p aliceAndBob 0L)

[<Fact>]
let ``R8: a signer holding two keys for one scheme is ambiguous and is refused`` () =
    let p = policy [ alice, [ ecdsaKey aliceSpki; ecdsaKey bobSpki ] ] 1 ecdsaOnly
    Assert.Equal(Error(AmbiguousKeyForSigner(alice, ecdsaId)), verify registry p aliceAndBob 0L)

[<Fact>]
let ``R8: two implementations answering to one scheme id are refused`` () =
    let p = policy [ alice, [ ecdsaKey aliceSpki ] ] 1 ecdsaOnly
    let doubled = [ Schemes.ecdsaP256Sha256; Schemes.ecdsaP256Sha256 ]
    Assert.Equal(Error(DuplicateSchemeImplementation ecdsaId), verify doubled p aliceAndBob 0L)

// -------------------------------------------------------------------------------------------------
// R10 — nothing secret escapes
// -------------------------------------------------------------------------------------------------

[<Fact>]
let ``R10: no verdict or reject-reason field can carry key material or signature bytes`` () =
    // Structural, not a spot check: reflect over the verdict record and every reject-reason case and
    // assert no field's type is a byte array or a PublicKey. Adding such a field breaks this test.
    let offending (t: Type) =
        t = typeof<byte[]> || t = typeof<PublicKey> || t = typeof<PublicKey list>

    let verdictFields =
        Reflection.FSharpType.GetRecordFields typeof<Verdict>
        |> Array.map (fun p -> p.PropertyType)

    let caseFields (t: Type) =
        Reflection.FSharpType.GetUnionCases t
        |> Array.collect (fun c -> c.GetFields() |> Array.map (fun f -> f.PropertyType))

    // Every type reachable from a returned value: the verdict, its reasons, and the error channel.
    let reasonFields = Array.append (caseFields typeof<RejectReason>) (caseFields typeof<ConfigError>)

    Assert.Empty(verdictFields |> Array.filter offending)
    Assert.Empty(reasonFields |> Array.filter offending)
    Assert.NotEmpty reasonFields // the reflection actually found fields — the check is not vacuous

// -------------------------------------------------------------------------------------------------
// Canonical signed bytes — the scope/payload binding of R5
// -------------------------------------------------------------------------------------------------

[<Fact>]
let ``R5: the signed bytes bind scope and payload injectively — no boundary re-split collides`` () =
    // "ab" + "c" and "a" + "bc" must not produce the same signed message.
    let one = signingBytes "ab" (Text.Encoding.UTF8.GetBytes "c")
    let two = signingBytes "a" (Text.Encoding.UTF8.GetBytes "bc")
    Assert.NotEqual<byte[]>(one, two)
    Assert.Equal<byte[]>(one, signingBytes "ab" (Text.Encoding.UTF8.GetBytes "c")) // and it is a function

[<Fact>]
let ``R5: a signature valid for one scope does not verify for another`` () =
    let p = policy [ alice, [ ecdsaKey aliceSpki ] ] 1 ecdsaOnly
    let other =
        { Scope = "zeta.revoke-key"
          Payload = Payload
          Submissions = [ submit alice ecdsaId aliceSig ] }
    Assert.False (ok (verify registry p other 0L)).Authorized
    let samePayloadOtherScope =
        { Scope = Scope
          Payload = Text.Encoding.UTF8.GetBytes "successor=081K-BETA"
          Submissions = [ submit alice ecdsaId aliceSig ] }
    Assert.False (ok (verify registry p samePayloadOtherScope 0L)).Authorized
    Assert.True (ok (verify registry p (request [ submit alice ecdsaId aliceSig ]) 0L)).Authorized
