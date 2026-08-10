module Zeta.Tests.KskAuthorizationTests

open global.Xunit
open Zeta.Core.Consent.KskAuthorization

let private signer id : Signer = { Id = id; PublicKey = [| 1uy |] }
let private sig' id : string * byte[] = (id, [| 0uy |])

/// One traveler's own roster — there is no global one.
let private rosterOf ids threshold : KskConfig =
    { Signers = ids |> List.map signer
      Threshold = threshold
      Scope = "kinetic-override" }

let private request sigs : KskAuthorizationRequest =
    { Scope = "kinetic-override"; Signatures = sigs }

// ───────────────── the bug: off-roster signers must not count ─────────────────

[<Fact>]
let ``BUG 081KZMGZTB5 — unknown signers never reach Authorized`` () =
    // Three fabricated identities, threshold 2, roster size 3. Before the fix this returned
    // Authorized: the count fit and nothing checked WHO signed.
    let cfg = rosterOf [ "amara"; "otto"; "soraya" ] 2
    let r = checkKskAuthorization cfg (request [ sig' "mallory"; sig' "eve"; sig' "trudy" ])
    Assert.Equal<Result<KskCheckResult, string>>(Ok(UnknownSigners [ "mallory"; "eve"; "trudy" ]), r)

[<Fact>]
let ``a single off-roster signer spoils an otherwise sufficient set`` () =
    // Two genuine signers meet the threshold, but the third is unknown — reported, not ignored,
    // because silently dropping it would hide an attempted forgery.
    let cfg = rosterOf [ "amara"; "otto"; "soraya" ] 2
    let r = checkKskAuthorization cfg (request [ sig' "amara"; sig' "otto"; sig' "mallory" ])
    Assert.Equal<Result<KskCheckResult, string>>(Ok(UnknownSigners [ "mallory" ]), r)

[<Fact>]
let ``rostered signers meeting the threshold authorize`` () =
    let cfg = rosterOf [ "amara"; "otto"; "soraya" ] 2
    Assert.Equal<Result<KskCheckResult, string>>(
        Ok(Authorized(2, 2)),
        checkKskAuthorization cfg (request [ sig' "amara"; sig' "otto" ]))

[<Fact>]
let ``one signer submitted twice is not two signers`` () =
    let cfg = rosterOf [ "amara"; "otto" ] 2
    Assert.Equal<Result<KskCheckResult, string>>(
        Ok(DuplicateSigners [ "amara" ]),
        checkKskAuthorization cfg (request [ sig' "amara"; sig' "amara" ]))

[<Fact>]
let ``too few rostered signers is insufficient, and says by how much`` () =
    let cfg = rosterOf [ "amara"; "otto"; "soraya" ] 3
    Assert.Equal<Result<KskCheckResult, string>>(
        Ok(InsufficientSigners(2, 3)),
        checkKskAuthorization cfg (request [ sig' "amara"; sig' "otto" ]))

[<Fact>]
let ``a request for another scope never authorizes`` () =
    let cfg = rosterOf [ "amara"; "otto" ] 2
    let r = checkKskAuthorization cfg { Scope = "some-other-scope"; Signatures = [ sig' "amara"; sig' "otto" ] }
    Assert.Equal<Result<KskCheckResult, string>>(Ok(ScopeMismatch("some-other-scope", "kinetic-override")), r)

// ───────────────── per-traveler rosters: disagreement is CORRECT ─────────────────

[<Fact>]
let ``R11 — two travelers with different rosters legitimately disagree on one request`` () =
    // The same request, evaluated by two travelers who trust different people. Neither is wrong;
    // a single mandatory roster would be the hub this substrate refuses.
    let req = request [ sig' "amara"; sig' "otto" ]
    let travelerA = rosterOf [ "amara"; "otto"; "soraya" ] 2   // trusts both
    let travelerB = rosterOf [ "soraya"; "lumen" ] 2           // trusts neither

    Assert.Equal<Result<KskCheckResult, string>>(Ok(Authorized(2, 2)), checkKskAuthorization travelerA req)
    Assert.Equal<Result<KskCheckResult, string>>(Ok(UnknownSigners [ "amara"; "otto" ]), checkKskAuthorization travelerB req)

[<Fact>]
let ``a traveler may set a stricter threshold over the same roster`` () =
    // Trust is per-principal in degree as well as membership.
    let req = request [ sig' "amara"; sig' "otto" ]
    Assert.Equal<Result<KskCheckResult, string>>(Ok(Authorized(2, 2)), checkKskAuthorization (rosterOf [ "amara"; "otto"; "soraya" ] 2) req)
    Assert.Equal<Result<KskCheckResult, string>>(Ok(InsufficientSigners(2, 3)), checkKskAuthorization (rosterOf [ "amara"; "otto"; "soraya" ] 3) req)
