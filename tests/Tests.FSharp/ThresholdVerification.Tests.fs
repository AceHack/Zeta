/// Discriminating tests for clean-room derivation C of
/// `docs/specs/threshold-signature-verification-cleanroom-spec.md`.
///
/// Every test here is written so that it FAILS if the property under test is removed — the
/// acceptance criteria demand "two inputs that make the output differ", so each criterion test
/// carries its own control case.
module Zeta.Tests.ThresholdVerificationTests

open System
open System.Security.Cryptography
open System.Text
open global.Xunit
open Zeta.Core.ThresholdVerification
open Zeta.Core.ThresholdSchemes

// ---------------------------------------------------------------------------------------------
// Fixtures. Key GENERATION and SIGNING live here, not in Core: Core's surface is verification
// only, so no private material can cross the module boundary (R10).
// ---------------------------------------------------------------------------------------------

type private KeyPair =
    { Public: byte[]
      Sign: byte[] -> byte[] }

let private ecdsaKeyOn (curve: ECCurve) (hash: HashAlgorithmName) : KeyPair =
    let alg = ECDsa.Create(curve)

    { Public = alg.ExportSubjectPublicKeyInfo()
      Sign = fun m -> alg.SignData(m, hash) }

let private ecdsaKey () : KeyPair =
    ecdsaKeyOn ECCurve.NamedCurves.nistP256 HashAlgorithmName.SHA256

let private ecdsaKey384 () : KeyPair =
    ecdsaKeyOn ECCurve.NamedCurves.nistP384 HashAlgorithmName.SHA384

let private toyKey (label: string) : KeyPair =
    let pk = Encoding.UTF8.GetBytes(label)

    { Public = pk
      Sign = fun m -> toyDigestSignature pk m }

let private scope = "deploy/production"
let private payload = Encoding.UTF8.GetBytes("artifact-digest-000111")
let private message = canonicalMessage scope payload

let private sid = SignerId
let private ecdsaId = SchemeId EcdsaP256Name
let private toyId = SchemeId ToyDigestName
let private ecdsaOnly = { Current = ecdsaId; Retiring = None }

let private entry (scheme: SchemeId) (name: string) (k: KeyPair) =
    { Signer = sid name
      Scheme = scheme
      PublicKey = k.Public }

let private submission (scheme: SchemeId) (name: string) (bytes: byte[]) =
    { Signer = sid name
      Scheme = scheme
      Signature = bytes }

let private request epoch subs =
    { Scope = scope
      Payload = payload
      Epoch = epoch
      Signatures = subs }

let private shouldEqual (expected: 'a) (actual: 'a) =
    Assert.True((expected = actual), sprintf "expected %A but got %A" expected actual)

let private okVerdict (r: Result<Verdict, ConfigError>) =
    match r with
    | Ok v -> v
    | Error e -> failwith (sprintf "expected a verdict, got a configuration error: %A" e)

let private denialReasons (v: Verdict) =
    match v.Decision with
    | Denied rs -> rs
    | Authorized -> failwith "expected a denial, got Authorized"

let rec private permutations (lst: 'a list) : 'a list list =
    match lst with
    | [] -> [ [] ]
    | _ ->
        lst
        |> List.mapi (fun i x ->
            let rest =
                lst |> List.indexed |> List.filter (fun (j, _) -> j <> i) |> List.map snd

            permutations rest |> List.map (fun p -> x :: p))
        |> List.concat

// ---------------------------------------------------------------------------------------------
// Acceptance criterion 1 (and R3) — off-roster rejection.
// Two inputs that differ: the same request, verified by two verifiers with disjoint rosters.
// ---------------------------------------------------------------------------------------------

[<Fact>]
let ``AC1 off-roster: the same request authorizes under a roster that knows the signers and returns unknown-signer under one that does not``
    ()
    =
    let a, b, c, d = ecdsaKey (), ecdsaKey (), ecdsaKey (), ecdsaKey ()
    let schemes = [ ecdsaP256 ]

    let knowing =
        { Roster = [ entry ecdsaId "A" a; entry ecdsaId "B" b ]
          Threshold = 2
          Policy = ecdsaOnly }

    let stranger =
        { Roster = [ entry ecdsaId "C" c; entry ecdsaId "D" d ]
          Threshold = 2
          Policy = ecdsaOnly }

    let req =
        request 0L [ submission ecdsaId "A" (a.Sign message); submission ecdsaId "B" (b.Sign message) ]

    let known = okVerdict (verify schemes knowing req)
    let unknown = okVerdict (verify schemes stranger req)

    Assert.True(isAuthorized known)
    shouldEqual [ sid "A"; sid "B" ] known.VerifiedSigners
    shouldEqual ([]: SignerId list) known.UnknownSigners

    Assert.False(isAuthorized unknown)
    // R3: reported distinctly, not silently dropped.
    shouldEqual [ sid "A"; sid "B" ] unknown.UnknownSigners
    shouldEqual ([]: SignerId list) unknown.VerifiedSigners
    Assert.True(denialReasons unknown |> List.contains (UnknownSignersPresent [ sid "A"; sid "B" ]))

// ---------------------------------------------------------------------------------------------
// Acceptance criterion 2 (and R5) — forgery rejection, one bit flipped.
// ---------------------------------------------------------------------------------------------

[<Fact>]
let ``AC2 forgery: flipping one bit of one signature denies, and the FIRST reason names verification failure rather than an insufficient count``
    ()
    =
    let a, b = ecdsaKey (), ecdsaKey ()
    let schemes = [ ecdsaP256 ]

    let v =
        { Roster = [ entry ecdsaId "A" a; entry ecdsaId "B" b ]
          Threshold = 2
          Policy = ecdsaOnly }

    let sigA = a.Sign message
    let sigB = b.Sign message

    // Control: untampered.
    let honest = okVerdict (verify schemes v (request 0L [ submission ecdsaId "A" sigA; submission ecdsaId "B" sigB ]))
    Assert.True(isAuthorized honest)

    // One bit of B's signature flipped; identities and count are unchanged.
    let tampered = Array.copy sigB
    tampered[0] <- tampered[0] ^^^ 1uy

    let forged =
        okVerdict (verify schemes v (request 0L [ submission ecdsaId "A" sigA; submission ecdsaId "B" tampered ]))

    Assert.False(isAuthorized forged)
    shouldEqual [ sid "B" ] forged.InvalidSignatureSigners
    shouldEqual [ sid "A" ] forged.VerifiedSigners
    // The reason a caller reads first is the cryptographic failure, NOT the count shortfall.
    shouldEqual (InvalidSignaturesPresent [ sid "B" ]) (List.head (denialReasons forged))
    // The count shortfall is still reported (a teaching surface reports every finding, R1).
    Assert.True(denialReasons forged |> List.contains (InsufficientVerifiedSigners(2, 1)))

[<Fact>]
let ``R5 binding: a signature over one scope does not verify for another scope with the same payload`` () =
    let a = ecdsaKey ()
    let schemes = [ ecdsaP256 ]

    let v =
        { Roster = [ entry ecdsaId "A" a ]
          Threshold = 1
          Policy = ecdsaOnly }

    let sigForOurScope = a.Sign message
    let good = okVerdict (verify schemes v (request 0L [ submission ecdsaId "A" sigForOurScope ]))
    Assert.True(isAuthorized good)

    let otherScope =
        { Scope = "deploy/staging"
          Payload = payload
          Epoch = 0L
          Signatures = [ submission ecdsaId "A" sigForOurScope ] }

    let bad = okVerdict (verify schemes v otherScope)
    Assert.False(isAuthorized bad)
    shouldEqual [ sid "A" ] bad.InvalidSignatureSigners

[<Fact>]
let ``R5 binding: scope and payload are length-prefixed, so ("ab","c") and ("a","bc") do not share a message`` () =
    let m1 = canonicalMessage "ab" (Encoding.UTF8.GetBytes "c")
    let m2 = canonicalMessage "a" (Encoding.UTF8.GetBytes "bc")
    Assert.NotEqual<byte[]>(m1, m2)
    // ... and the binding is stable: same inputs, same bytes.
    shouldEqual m1 (canonicalMessage "ab" (Encoding.UTF8.GetBytes "c"))

// ---------------------------------------------------------------------------------------------
// Acceptance criterion 3 (and R4) — duplicate collapse.
// ---------------------------------------------------------------------------------------------

[<Fact>]
let ``AC3 duplicates: one signer submitting threshold-many distinct valid signatures counts once and is denied`` () =
    let a, b = ecdsaKey (), ecdsaKey ()
    let schemes = [ ecdsaP256 ]

    let v =
        { Roster = [ entry ecdsaId "A" a; entry ecdsaId "B" b ]
          Threshold = 2
          Policy = ecdsaOnly }

    // Two DIFFERENT valid signature byte-strings from the same signer (ECDSA is randomized), so
    // this cannot be defeated by byte-equality de-duplication alone.
    let dup =
        okVerdict (verify schemes v (request 0L [ submission ecdsaId "A" (a.Sign message); submission ecdsaId "A" (a.Sign message) ]))

    Assert.False(isAuthorized dup)
    shouldEqual [ sid "A" ] dup.VerifiedSigners
    shouldEqual [ sid "A" ] dup.DuplicateSigners
    Assert.True(denialReasons dup |> List.contains (DuplicateSignersPresent [ sid "A" ]))

    // Control: two DIFFERENT signers, same threshold ⇒ authorized.
    let distinct =
        okVerdict (verify schemes v (request 0L [ submission ecdsaId "A" (a.Sign message); submission ecdsaId "B" (b.Sign message) ]))

    Assert.True(isAuthorized distinct)
    shouldEqual ([]: SignerId list) distinct.DuplicateSigners

[<Fact>]
let ``R4 duplicates do not veto: a repeat alongside enough distinct signers still authorizes, and the repeat is still reported``
    ()
    =
    let a, b = ecdsaKey (), ecdsaKey ()
    let schemes = [ ecdsaP256 ]

    let v =
        { Roster = [ entry ecdsaId "A" a; entry ecdsaId "B" b ]
          Threshold = 2
          Policy = ecdsaOnly }

    let verdict =
        okVerdict (
            verify
                schemes
                v
                (request
                    0L
                    [ submission ecdsaId "A" (a.Sign message)
                      submission ecdsaId "A" (a.Sign message)
                      submission ecdsaId "B" (b.Sign message) ])
        )

    Assert.True(isAuthorized verdict)
    shouldEqual [ sid "A"; sid "B" ] verdict.VerifiedSigners
    shouldEqual [ sid "A" ] verdict.DuplicateSigners

// ---------------------------------------------------------------------------------------------
// Acceptance criterion 4 (and R2) — legitimate disagreement.
// ---------------------------------------------------------------------------------------------

[<Fact>]
let ``AC4 legitimate disagreement: one request, two rosters, two different verdicts, both correct`` () =
    let a, b, c = ecdsaKey (), ecdsaKey (), ecdsaKey ()
    let schemes = [ ecdsaP256 ]

    let alice =
        { Roster = [ entry ecdsaId "A" a; entry ecdsaId "B" b ]
          Threshold = 2
          Policy = ecdsaOnly }

    let bob =
        { Roster = [ entry ecdsaId "A" a; entry ecdsaId "C" c ]
          Threshold = 2
          Policy = ecdsaOnly }

    let req =
        request 0L [ submission ecdsaId "A" (a.Sign message); submission ecdsaId "B" (b.Sign message) ]

    let byAlice = okVerdict (verify schemes alice req)
    let byBob = okVerdict (verify schemes bob req)

    Assert.True(isAuthorized byAlice)
    Assert.False(isAuthorized byBob)
    // Bob is not wrong: from his perspective B is simply nobody he trusts.
    shouldEqual [ sid "B" ] byBob.UnknownSigners
    shouldEqual [ sid "A" ] byBob.VerifiedSigners

// ---------------------------------------------------------------------------------------------
// Acceptance criterion 5 (and R6) — algorithm swap with no call-site change.
// `runUnder` is the single call site. It names no algorithm: the scheme arrives as a value.
// ---------------------------------------------------------------------------------------------

let private runUnder (scheme: ISignatureScheme) (mkKey: string -> KeyPair) =
    let a, b = mkKey "A", mkKey "B"

    let v =
        { Roster = [ entry scheme.Scheme "A" a; entry scheme.Scheme "B" b ]
          Threshold = 2
          Policy = { Current = scheme.Scheme; Retiring = None } }

    let req =
        request 0L [ submission scheme.Scheme "A" (a.Sign message); submission scheme.Scheme "B" (b.Sign message) ]

    okVerdict (verify [ scheme ] v req)

[<Fact>]
let ``AC5 algorithm swap: the identical request shape authorizes under two different scheme implementations, one call site`` () =
    let underToy = runUnder toyDigest toyKey
    let underEcdsa = runUnder ecdsaP256 (fun _ -> ecdsaKey ())
    let underEcdsa384 = runUnder ecdsaP384 (fun _ -> ecdsaKey384 ())

    Assert.True(isAuthorized underToy)
    Assert.True(isAuthorized underEcdsa)
    Assert.True(isAuthorized underEcdsa384)
    // Identical verdict *content* — the algorithm is not observable in the result.
    shouldEqual underToy.VerifiedSigners underEcdsa.VerifiedSigners
    shouldEqual underToy.Decision underEcdsa.Decision
    shouldEqual underToy.Decision underEcdsa384.Decision

[<Fact>]
let ``R6 the port discriminates: each scheme rejects a signature made for the other`` () =
    let k = toyKey "A"
    Assert.True(toyDigest.Verify(k.Public, message, k.Sign message))
    Assert.False(ecdsaP256.Verify(k.Public, message, k.Sign message))

    let e = ecdsaKey ()
    Assert.True(ecdsaP256.Verify(e.Public, message, e.Sign message))
    Assert.False(toyDigest.Verify(e.Public, message, e.Sign message))

    // Different curve/hash ⇒ a different scheme, not a compatible one: a P-256 key and its
    // signature do not verify under the P-384 scheme (and vice versa) — no exception, just false.
    let e384 = ecdsaKey384 ()
    Assert.True(ecdsaP384.Verify(e384.Public, message, e384.Sign message))
    Assert.False(ecdsaP384.Verify(e.Public, message, e.Sign message))
    Assert.False(ecdsaP256.Verify(e384.Public, message, e384.Sign message))

[<Fact>]
let ``R6 the port is total: malformed key and truncated signature are verdicts, not exceptions`` () =
    Assert.False(ecdsaP256.Verify([| 1uy; 2uy; 3uy |], message, [| 4uy; 5uy |]))
    Assert.False(toyDigest.Verify([||], message, [||]))

// ---------------------------------------------------------------------------------------------
// Acceptance criterion 6 (and R7) — bounded migration overlap, boundary checked on both sides.
// ---------------------------------------------------------------------------------------------

let private migrationVerifier (a: KeyPair) =
    { Roster = [ entry ecdsaId "A" a ]
      Threshold = 1
      Policy =
        { Current = toyId
          Retiring =
            Some
                { Scheme = ecdsaId
                  FirstEpoch = 10L
                  LastEpoch = 20L } } }

[<Fact>]
let ``AC6 migration overlap: a retiring-scheme signature verifies inside the stated window and is refused on both sides of it`` () =
    let a = ecdsaKey ()
    let schemes = [ toyDigest; ecdsaP256 ]
    let v = migrationVerifier a
    let sigA = a.Sign message

    let at epoch = okVerdict (verify schemes v (request epoch [ submission ecdsaId "A" sigA ]))

    // Outside, below the window.
    let before = at 9L
    Assert.False(isAuthorized before)
    shouldEqual [ ecdsaId ] before.UnacceptedSchemes
    Assert.True(denialReasons before |> List.contains (UnacceptedSchemesPresent [ ecdsaId ]))

    // Both endpoints are inclusive.
    Assert.True(isAuthorized (at 10L))
    Assert.True(isAuthorized (at 15L))
    Assert.True(isAuthorized (at 20L))

    // Outside, above the window.
    let after = at 21L
    Assert.False(isAuthorized after)
    shouldEqual [ ecdsaId ] after.UnacceptedSchemes

[<Fact>]
let ``R7 the current scheme is accepted at every epoch, including epochs outside the retiring window`` () =
    let a = ecdsaKey ()
    let toyA = toyKey "A"

    let v =
        { migrationVerifier a with
            Roster = [ entry ecdsaId "A" a; entry toyId "A" toyA ] }

    let schemes = [ toyDigest; ecdsaP256 ]

    for epoch in [ 0L; 10L; 20L; 999L ] do
        let verdict =
            okVerdict (verify schemes v (request epoch [ submission toyId "A" (toyA.Sign message) ]))

        Assert.True(isAuthorized verdict)

// ---------------------------------------------------------------------------------------------
// Acceptance criterion 7 (and R9) — determinism across repeats and orderings.
// ---------------------------------------------------------------------------------------------

[<Fact>]
let ``AC7 determinism: repeated invocations and every permutation of submissions, roster and scheme list give an identical decision``
    ()
    =
    let a, b, x = ecdsaKey (), ecdsaKey (), ecdsaKey ()
    let toyA = toyKey "A"

    let v =
        { Roster = [ entry ecdsaId "A" a; entry ecdsaId "B" b; entry toyId "A" toyA ]
          Threshold = 2
          Policy = ecdsaOnly }

    let tampered =
        let s = Array.copy (b.Sign message)
        s[1] <- s[1] ^^^ 8uy
        s

    // A deliberately messy input: one valid, one duplicate, one tampered, one off-roster,
    // one under a scheme this verifier does not accept.
    let subs =
        [ submission ecdsaId "A" (a.Sign message)
          submission ecdsaId "A" (a.Sign message)
          submission ecdsaId "B" tampered
          submission ecdsaId "X" (x.Sign message)
          submission toyId "A" (toyA.Sign message) ]

    let baseline = okVerdict (verify [ ecdsaP256; toyDigest ] v (request 0L subs))

    // Repeated invocation, identical inputs.
    shouldEqual baseline (okVerdict (verify [ ecdsaP256; toyDigest ] v (request 0L subs)))

    let projection (verdict: Verdict) =
        verdict.Decision,
        verdict.VerifiedSigners,
        verdict.UnknownSigners,
        verdict.DuplicateSigners,
        verdict.InvalidSignatureSigners,
        verdict.UnacceptedSchemes

    let expected = projection baseline

    for permutedSubs in permutations subs do
        for permutedSchemes in permutations [ ecdsaP256; toyDigest ] do
            for permutedRoster in permutations v.Roster do
                let verdict =
                    okVerdict (verify permutedSchemes { v with Roster = permutedRoster } (request 0L permutedSubs))

                shouldEqual expected (projection verdict)

    // The honest boundary: the per-submission REPORT follows input order (its Index refers back
    // to it), so it is order-sensitive by design — as a multiset it is invariant.
    let asMultiset (verdict: Verdict) =
        verdict.Submissions
        |> List.map (fun r -> r.Signer, r.Scheme, r.Outcome)
        |> List.sortBy (fun (SignerId s, SchemeId sc, o) -> s, sc, sprintf "%A" o)

    let reversed =
        okVerdict (verify [ ecdsaP256; toyDigest ] v (request 0L (List.rev subs)))

    shouldEqual (asMultiset baseline) (asMultiset reversed)
    Assert.NotEqual<SubmissionReport list>(baseline.Submissions, reversed.Submissions)

// ---------------------------------------------------------------------------------------------
// R8 — bounded, self-rejecting configuration.
// ---------------------------------------------------------------------------------------------

let private cfgError (roster: RosterEntry list) threshold policy schemes =
    match verify schemes { Roster = roster; Threshold = threshold; Policy = policy } (request 0L []) with
    | Error e -> e
    | Ok v -> failwith (sprintf "expected a configuration error, got a verdict: %A" v.Decision)

[<Fact>]
let ``R8 configuration errors: threshold below one, threshold above roster size, empty roster, duplicate entry`` () =
    let a, b = ecdsaKey (), ecdsaKey ()
    let roster = [ entry ecdsaId "A" a; entry ecdsaId "B" b ]
    let schemes = [ ecdsaP256 ]

    shouldEqual (ThresholdBelowOne 0) (cfgError roster 0 ecdsaOnly schemes)
    shouldEqual (ThresholdBelowOne -1) (cfgError roster -1 ecdsaOnly schemes)
    shouldEqual (ThresholdExceedsRosterSize(3, 2)) (cfgError roster 3 ecdsaOnly schemes)
    shouldEqual EmptyRoster (cfgError [] 1 ecdsaOnly schemes)
    shouldEqual (DuplicateRosterEntry(sid "A", ecdsaId)) (cfgError (roster @ [ entry ecdsaId "A" a ]) 2 ecdsaOnly schemes)

    // Control: the same roster at a legal threshold produces a verdict, not an error.
    match verify schemes { Roster = roster; Threshold = 2; Policy = ecdsaOnly } (request 0L []) with
    | Ok v -> Assert.False(isAuthorized v)
    | Error e -> failwith (sprintf "unexpected configuration error %A" e)

[<Fact>]
let ``R8 roster size counts distinct SIGNERS, not key bindings: a signer under two schemes is one roster member`` () =
    let a = ecdsaKey ()
    let toyA = toyKey "A"
    let roster = [ entry ecdsaId "A" a; entry toyId "A" toyA ]

    let policy =
        { Current = ecdsaId
          Retiring =
            Some
                { Scheme = toyId
                  FirstEpoch = 0L
                  LastEpoch = 1L } }

    shouldEqual 1 (rosterSize { Roster = roster; Threshold = 1; Policy = policy })
    shouldEqual (ThresholdExceedsRosterSize(2, 1)) (cfgError roster 2 policy [ ecdsaP256; toyDigest ])

[<Fact>]
let ``R8 a roster that could never reach its threshold under any accepted scheme is a configuration error`` () =
    let a, b = ecdsaKey (), ecdsaKey ()
    // Both signers are rostered only under a scheme the policy never accepts.
    let roster = [ entry toyId "A" (toyKey "A"); entry toyId "B" (toyKey "B") ]

    shouldEqual (RosterCannotReachThreshold(0, 2)) (cfgError roster 2 ecdsaOnly [ ecdsaP256; toyDigest ])

    // Control: rostering them under the accepted scheme removes the error.
    match
        verify
            [ ecdsaP256 ]
            { Roster = [ entry ecdsaId "A" a; entry ecdsaId "B" b ]
              Threshold = 2
              Policy = ecdsaOnly }
            (request 0L [])
    with
    | Ok _ -> ()
    | Error e -> failwith (sprintf "unexpected configuration error %A" e)

[<Fact>]
let ``R8 malformed migration policy is a configuration error: inverted window, retiring equals current, missing implementation`` () =
    let a = ecdsaKey ()
    let roster = [ entry ecdsaId "A" a ]

    let inverted =
        { Current = toyId
          Retiring =
            Some
                { Scheme = ecdsaId
                  FirstEpoch = 20L
                  LastEpoch = 10L } }

    shouldEqual
        (RetiringWindowInverted(ecdsaId, 20L, 10L))
        (cfgError roster 1 inverted [ toyDigest; ecdsaP256 ])

    let selfRetiring =
        { Current = ecdsaId
          Retiring =
            Some
                { Scheme = ecdsaId
                  FirstEpoch = 0L
                  LastEpoch = 10L } }

    shouldEqual (RetiringSchemeIsCurrentScheme ecdsaId) (cfgError roster 1 selfRetiring [ ecdsaP256 ])

    // No implementation of the current scheme ⇒ the verifier could never authorize.
    shouldEqual (NoImplementationForCurrentScheme ecdsaId) (cfgError roster 1 ecdsaOnly [ toyDigest ])
    shouldEqual (DuplicateSchemeImplementation ecdsaId) (cfgError roster 1 ecdsaOnly [ ecdsaP256; ecdsaP256 ])

// ---------------------------------------------------------------------------------------------
// R10 — nothing secret in a returned value.
// ---------------------------------------------------------------------------------------------

[<Fact>]
let ``R10 the verdict carries identities, counts and indices only — no byte material of any kind`` () =
    let a, b = ecdsaKey (), ecdsaKey ()
    let schemes = [ ecdsaP256 ]

    let v =
        { Roster = [ entry ecdsaId "A" a; entry ecdsaId "B" b ]
          Threshold = 2
          Policy = ecdsaOnly }

    let sigA = a.Sign message

    let verdict =
        okVerdict (verify schemes v (request 0L [ submission ecdsaId "A" sigA; submission ecdsaId "X" (b.Sign message) ]))

    let rendered = sprintf "%A" verdict

    // Any `byte[]` field anywhere in the verdict graph would render F# byte literals (`0x1Fuy`).
    // This assertion therefore fails the moment key material or signature bytes are added back.
    Assert.DoesNotContain("uy", rendered, StringComparison.Ordinal)
    Assert.DoesNotContain(Convert.ToBase64String(a.Public), rendered, StringComparison.Ordinal)
    Assert.DoesNotContain(Convert.ToBase64String(sigA), rendered, StringComparison.Ordinal)
    // ... while the teaching content (identities, counts) IS present.
    Assert.Contains("\"A\"", rendered, StringComparison.Ordinal)
    Assert.Contains("\"X\"", rendered, StringComparison.Ordinal)

// ---------------------------------------------------------------------------------------------
// R1 — the verdict explains itself in typed values a caller can branch on.
// ---------------------------------------------------------------------------------------------

[<Fact>]
let ``R1 reasons are matchable values, and the five denial classes are separable`` () =
    let a, b, c, x = ecdsaKey (), ecdsaKey (), ecdsaKey (), ecdsaKey ()
    let toyA = toyKey "A"

    // Three distinct rostered signers (A, B, C) so threshold 3 is a legal configuration; A is
    // additionally pre-staged under the toy scheme, which this policy does not accept.
    let v =
        { Roster =
            [ entry ecdsaId "A" a
              entry ecdsaId "B" b
              entry ecdsaId "C" c
              entry toyId "A" toyA ]
          Threshold = 3
          Policy = ecdsaOnly }

    let tampered =
        let s = Array.copy (b.Sign message)
        s[2] <- s[2] ^^^ 2uy
        s

    let verdict =
        okVerdict (
            verify
                [ ecdsaP256; toyDigest ]
                v
                (request
                    0L
                    [ submission ecdsaId "A" (a.Sign message)
                      submission ecdsaId "A" (a.Sign message)
                      submission ecdsaId "B" tampered
                      submission ecdsaId "X" (x.Sign message)
                      submission toyId "A" (toyA.Sign message) ])
        )

    let reasons = denialReasons verdict

    // A caller can dispatch on each class without parsing a string.
    let classes =
        reasons
        |> List.map (fun r ->
            match r with
            | InvalidSignaturesPresent _ -> "invalid"
            | UnknownSignersPresent _ -> "unknown"
            | DuplicateSignersPresent _ -> "duplicate"
            | UnacceptedSchemesPresent _ -> "unaccepted-scheme"
            | InsufficientVerifiedSigners _ -> "insufficient")

    shouldEqual [ "invalid"; "unknown"; "duplicate"; "unaccepted-scheme"; "insufficient" ] classes
    shouldEqual [ sid "B" ] verdict.InvalidSignatureSigners
    shouldEqual [ sid "X" ] verdict.UnknownSigners
    shouldEqual [ sid "A" ] verdict.DuplicateSigners
    shouldEqual [ toyId ] verdict.UnacceptedSchemes
    shouldEqual [ sid "A" ] verdict.VerifiedSigners

[<Fact>]
let ``R3 an off-roster signer never contributes to the count, even with a perfectly valid signature`` () =
    let a, b, x = ecdsaKey (), ecdsaKey (), ecdsaKey ()
    let schemes = [ ecdsaP256 ]

    let v =
        { Roster = [ entry ecdsaId "A" a; entry ecdsaId "B" b ]
          Threshold = 2
          Policy = ecdsaOnly }

    // X's signature is cryptographically perfect over exactly the right message — and irrelevant.
    let verdict =
        okVerdict (verify schemes v (request 0L [ submission ecdsaId "A" (a.Sign message); submission ecdsaId "X" (x.Sign message) ]))

    Assert.False(isAuthorized verdict)
    shouldEqual [ sid "A" ] verdict.VerifiedSigners
    shouldEqual [ sid "X" ] verdict.UnknownSigners
    Assert.True(denialReasons verdict |> List.contains (InsufficientVerifiedSigners(2, 1)))
