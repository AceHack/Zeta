module Zeta.Tests.KskAuthorizationTests

open global.Xunit
open Zeta.Core.MultiSignatureVerification
open Zeta.Core.Consent.KskAuthorization

// GOLDEN VECTORS — real ECDSA P-256 signatures over the canonical bytes for (Scope, Payload) under
// the fixed encoding. The previous suite used `[| 0uy |]` as a stand-in "signature" and passed,
// because nothing was verified. That it passed is the whole point: a gate that verifies nothing
// cannot be distinguished from a gate that verifies everything, by any test that only supplies
// well-formed-looking input.
let private hex (s: string) = System.Convert.FromHexString s

let private Scope = "ksk.override"
let private Payload = System.Text.Encoding.UTF8.GetBytes "halt=actuator-7"

let private amaraKey = hex "3059301306072a8648ce3d020106082a8648ce3d0301070342000433fa6a35fd84875136b13b2056118fea7fd3b29969c396461548a50a2a1b41957082e05396ed9f64b086a1912400ecbf4ae7d6d3854732f3ca4ecfb0c65a8969"
let private amaraSig = hex "05c2fcfa838f17b66e7fd2a02da55aef095531ac3220630c0268da189996b8f1a3bd5f0b61b6454d40d7ad60d457e57053bdcef09f4e3c867f2eb3e08c4fd089"
let private ottoKey = hex "3059301306072a8648ce3d020106082a8648ce3d03010703420004aef3e3474d963acdb7a92487a0674339c28ed0361cdbc119cf99cbda22f5da6378b2633c3f1bc1a5d5cc62f4f6fd895f2b7992f9013612c8680d36bb3bd716d6"
let private ottoSig = hex "b42698af219444aadb41ee49052614391a6068166668b008be42e6af54f2138b7cd6b985d862b9f0816c40803bdaebe7fe78bc2d59b715a60a5146adc90b140f"
let private sorayaKey = hex "3059301306072a8648ce3d020106082a8648ce3d0301070342000402ed0b98eeb81aadc37926f05af899bb7fce0f63e2f0342b113a0bde4a5e21c04807f4a891fe229c4d108285b27fab929972a1962156d3c3dd954d272c2606e9"
let private sorayaSig = hex "092e121ba536703e6c2169bba2ab2201636842468c7edc9e650a5716060a62423a0432d157746de10f218d3d84b6e15fc284caec832f240f244cc3281054911d"

let private ecdsa = "ecdsa-p256-sha256"
let private schemes = [ Schemes.ecdsaP256Sha256 ]
let private accepted = [ { Scheme = SchemeId ecdsa; Status = Current } ]

let private signer id key : Signer = { Id = id; Scheme = ecdsa; PublicKey = key }

/// One traveler's own roster — there is no global one.
let private rosterOf entries threshold : KskConfig =
    { Signers = entries; Threshold = threshold; Scope = Scope; AcceptedSchemes = accepted }

let private req sigs : KskAuthorizationRequest =
    { Scope = Scope; Payload = Payload; Signatures = sigs }

let private check cfg r = checkKskAuthorization schemes cfg r 0L

// ───────────────── the hole this closes ─────────────────

[<Fact>]
let ``THE FIX: fabricated signature bytes from rostered signers never authorize`` () =
    // Before this wiring, the gate counted distinct rostered names and verified nothing, so this
    // exact input returned Authorized. Two genuinely rostered signers, garbage bytes.
    let cfg = rosterOf [ signer "amara" amaraKey; signer "otto" ottoKey ] 2
    let r = check cfg (req [ "amara", ecdsa, Array.create 64 0uy; "otto", ecdsa, Array.create 64 0uy ])
    Assert.Equal<Result<KskCheckResult, string>>(Ok(InvalidSignatures [ "amara"; "otto" ]), r)

[<Fact>]
let ``genuine signatures from rostered signers authorize`` () =
    // The discriminator for the test above: identical shape, real signatures.
    let cfg = rosterOf [ signer "amara" amaraKey; signer "otto" ottoKey ] 2
    Assert.Equal<Result<KskCheckResult, string>>(
        Ok(Authorized(2, 2)),
        check cfg (req [ "amara", ecdsa, amaraSig; "otto", ecdsa, ottoSig ]))

[<Fact>]
let ``one bit flipped in a valid signature is rejected as invalid, not as a short count`` () =
    let tampered = Array.copy amaraSig
    tampered.[0] <- tampered.[0] ^^^ 1uy
    let cfg = rosterOf [ signer "amara" amaraKey; signer "otto" ottoKey ] 1
    Assert.Equal<Result<KskCheckResult, string>>(
        Ok(InvalidSignatures [ "amara" ]),
        check cfg (req [ "amara", ecdsa, tampered ]))

[<Fact>]
let ``a valid signature for a DIFFERENT payload does not authorize this one`` () =
    // The signature is genuine — over a different payload. Binding scope+payload into the signed
    // bytes is what stops an override being replayed onto another action.
    let cfg = rosterOf [ signer "amara" amaraKey ] 1
    let other = { Scope = Scope; Payload = System.Text.Encoding.UTF8.GetBytes "halt=actuator-9"; Signatures = [ "amara", ecdsa, amaraSig ] }
    Assert.Equal<Result<KskCheckResult, string>>(Ok(InvalidSignatures [ "amara" ]), check cfg other)

// ───────────────── properties preserved from the roster fix ─────────────────

[<Fact>]
let ``off-roster signers never count, even with valid signatures`` () =
    // soraya's signature is genuine; this traveler simply does not trust her.
    let cfg = rosterOf [ signer "amara" amaraKey; signer "otto" ottoKey ] 1
    Assert.Equal<Result<KskCheckResult, string>>(
        Ok(UnknownSigners [ "soraya" ]),
        check cfg (req [ "soraya", ecdsa, sorayaSig ]))

[<Fact>]
let ``one signer submitted twice is not two signers`` () =
    let cfg = rosterOf [ signer "amara" amaraKey; signer "otto" ottoKey ] 2
    Assert.Equal<Result<KskCheckResult, string>>(
        Ok(DuplicateSigners [ "amara" ]),
        check cfg (req [ "amara", ecdsa, amaraSig; "amara", ecdsa, amaraSig ]))

[<Fact>]
let ``too few valid signers is insufficient, and says by how much`` () =
    let cfg = rosterOf [ signer "amara" amaraKey; signer "otto" ottoKey; signer "soraya" sorayaKey ] 3
    Assert.Equal<Result<KskCheckResult, string>>(
        Ok(InsufficientSigners(2, 3)),
        check cfg (req [ "amara", ecdsa, amaraSig; "otto", ecdsa, ottoSig ]))

[<Fact>]
let ``a request for another scope never authorizes`` () =
    let cfg = rosterOf [ signer "amara" amaraKey ] 1
    let other = { Scope = "ksk.something-else"; Payload = Payload; Signatures = [ "amara", ecdsa, amaraSig ] }
    Assert.Equal<Result<KskCheckResult, string>>(Ok(ScopeMismatch("ksk.something-else", Scope)), check cfg other)

[<Fact>]
let ``R11: two travelers with different rosters legitimately disagree on one request`` () =
    // The same request and the same genuine signatures. Neither verdict is wrong — a single
    // mandatory roster would be the hub this substrate refuses.
    let r = req [ "amara", ecdsa, amaraSig; "otto", ecdsa, ottoSig ]
    let trusts = rosterOf [ signer "amara" amaraKey; signer "otto" ottoKey ] 2
    let doesNot = rosterOf [ signer "soraya" sorayaKey ] 1

    Assert.Equal<Result<KskCheckResult, string>>(Ok(Authorized(2, 2)), check trusts r)
    Assert.Equal<Result<KskCheckResult, string>>(Ok(UnknownSigners [ "amara"; "otto" ]), check doesNot r)

[<Fact>]
let ``a policy that can never authorize is a configuration error, not a silent denial`` () =
    let cfg = rosterOf [ signer "amara" amaraKey; signer "otto" ottoKey ] 3
    match check cfg (req [ "amara", ecdsa, amaraSig ]) with
    | Error _ -> ()
    | Ok v -> failwithf "expected a configuration error, got %A" v
