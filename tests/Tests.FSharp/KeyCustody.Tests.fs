module Zeta.Tests.KeyCustodyTests

open global.Xunit
open Zeta.Core

// ───────────────────────────── fixtures ─────────────────────────────

/// The line every window in these tests is stated against.
let private line = "issuer"

let private vs (n: int64) : Versionstamp = Versionstamp.ofInt64 n

/// A causal frame built through the real `TravelerFrame` API (never a hand-built map), so the tests
/// exercise the same coordinate the rest of the system agrees on.
let private frameOf (coords: (string * int64) list) : TravelerFrame.Frame =
    coords
    |> List.fold (fun f (actor, n) -> TravelerFrame.observe actor (vs n) f) TravelerFrame.origin

/// A frame in which only the grant's phase line has been observed, at `n`.
let private at (n: int64) : TravelerFrame.Frame = frameOf [ line, n ]

let private keyRef (handle: string) : KeyStore.KeyRef =
    { Backend = KeyStore.LocalFile
      Handle = handle }

let private k1 = keyRef "k1"
let private k2 = keyRef "k2"
let private k3 = keyRef "k3"
let private stranger = keyRef "not-ours"

/// A window `[10, 14)` — deliberately tiny so every boundary is checkable by hand.
let private smallWindow =
    match KeyCustody.tryWindow line (vs 10L) 4L with
    | Ok w -> w
    | Error e -> failwithf "fixture window must be constructible: %A" e

// ───────────────── R9 — expiry is decided by phase, and phase alone ─────────────────

[<Fact>]
let ``liveness is exact on both boundaries of the half-open window`` () =
    // [10, 14): 10 is in, 14 is out. An off-by-one in either direction turns this red.
    Assert.Equal(KeyCustody.Denied, (KeyCustody.livenessAt smallWindow (vs 9L)).Decision)
    Assert.Equal(KeyCustody.Live, (KeyCustody.livenessAt smallWindow (vs 10L)).Decision)
    Assert.Equal(KeyCustody.Live, (KeyCustody.livenessAt smallWindow (vs 13L)).Decision)
    Assert.Equal(KeyCustody.Denied, (KeyCustody.livenessAt smallWindow (vs 14L)).Decision)
    Assert.Equal(KeyCustody.Denied, (KeyCustody.livenessAt smallWindow (vs 15L)).Decision)

[<Fact>]
let ``the reason distinguishes not-yet from expired (R12 — never a bare deny)`` () =
    Assert.Equal<KeyCustody.LivenessReason>(
        KeyCustody.BeforeWindowOpens(vs 9L, vs 10L),
        (KeyCustody.livenessAt smallWindow (vs 9L)).Feedback
    )

    Assert.Equal<KeyCustody.LivenessReason>(
        KeyCustody.WindowExpired(vs 14L, vs 14L),
        (KeyCustody.livenessAt smallWindow (vs 14L)).Feedback
    )

    Assert.Equal<KeyCustody.LivenessReason>(
        KeyCustody.WithinWindow(vs 11L, vs 14L),
        (KeyCustody.livenessAt smallWindow (vs 11L)).Feedback
    )

[<Fact>]
let ``a principal that has never observed the phase line refuses (fail-closed), and says so`` () =
    // Note the distinction that matters: "observed at the origin" is NOT "never observed".
    let neverSeen = frameOf [ "someone-else", 500L ]
    let seenAtOrigin = at 0L
    let r1 = KeyCustody.liveness smallWindow neverSeen
    let r2 = KeyCustody.liveness smallWindow seenAtOrigin
    Assert.Equal(KeyCustody.Denied, r1.Decision)
    Assert.Equal<KeyCustody.LivenessReason>(KeyCustody.PhaseLineUnobserved line, r1.Feedback)
    Assert.Equal(KeyCustody.Denied, r2.Decision)
    Assert.Equal<KeyCustody.LivenessReason>(KeyCustody.BeforeWindowOpens(vs 0L, vs 10L), r2.Feedback)

[<Fact>]
let ``ACCEPTANCE 6 — two principals whose frames agree only on the grant's line agree on liveness`` () =
    // The two principals share nothing but the coordinate the window names: different actors,
    // different views of every other timeline, arbitrarily different local wall-clocks (which this
    // API cannot even accept — see the reflection guard below). If the implementation consulted any
    // other coordinate — a max over the frame, the frame's size, "the newest thing I've seen" — these
    // two would disagree and this test goes red.
    for phase in 0L..30L do
        let alice = frameOf [ "alice", 999_999L; line, phase; "bob", 3L ]
        let bob = frameOf [ "carol", 42L; line, phase; "dave", 7_000_000L; "alice", 1L ]
        let ra = KeyCustody.liveness smallWindow alice
        let rb = KeyCustody.liveness smallWindow bob
        Assert.Equal(ra.Decision, rb.Decision)
        Assert.Equal<KeyCustody.LivenessReason>(ra.Feedback, rb.Feedback)

    // …and the sweep is not vacuous: it really does cross from denied to live and back.
    Assert.Equal(KeyCustody.Denied, (KeyCustody.liveness smallWindow (at 0L)).Decision)
    Assert.Equal(KeyCustody.Live, (KeyCustody.liveness smallWindow (at 12L)).Decision)
    Assert.Equal(KeyCustody.Denied, (KeyCustody.liveness smallWindow (at 30L)).Decision)

[<Fact>]
let ``R9 — no entry point in this module accepts a wall-clock value`` () =
    // A structural guard, not a behavioural one: expiry must never become expressible in local time.
    // If someone later adds `liveAtTime (now: DateTimeOffset)`, this goes red.
    let moduleType = typeof<KeyCustody.Grant>.DeclaringType
    let clockish =
        [ typeof<System.DateTime>
          typeof<System.DateTimeOffset>
          typeof<System.TimeSpan> ]

    Assert.Contains("KeyCustody", moduleType.FullName)

    for m in moduleType.GetMethods() do
        for p in m.GetParameters() do
            Assert.DoesNotContain(p.ParameterType, clockish)

    Assert.False(List.isEmpty (List.ofSeq (moduleType.GetMethods()))) // the guard scanned something

[<Fact>]
let ``expiry is monotone — once expired at some phase, denied at every later phase`` () =
    // Frame coordinates only advance, so this is the "no resurrection" property: nothing a principal
    // subsequently observes can bring a dead grant back.
    let mutable sawExpiry = false

    for p in 0L..40L do
        if (KeyCustody.livenessAt smallWindow (vs p)).Decision = KeyCustody.Denied
           && p >= (KeyCustody.windowExpiry smallWindow).Version then
            sawExpiry <- true

        if sawExpiry then
            Assert.Equal(KeyCustody.Denied, (KeyCustody.livenessAt smallWindow (vs p)).Decision)

    Assert.True(sawExpiry) // the sweep actually reached expiry

// ───────────────── R8 — bounded by construction, and expiry without coordination ─────────────────

[<Fact>]
let ``R8 — the default grant is bounded, and no public constructor yields an indefinite one`` () =
    let w = KeyCustody.window line (vs 0L)
    Assert.Equal(KeyCustody.DefaultSpan, KeyCustody.windowSpan w)
    Assert.Equal(line, KeyCustody.windowLine w)
    Assert.Equal(vs 0L, KeyCustody.windowStart w)

    // Over the ceiling, at or below zero, and past the end of the coordinate are all refused.
    Assert.Equal<Result<KeyCustody.PhaseWindow, KeyCustody.WindowError>>(
        Error(KeyCustody.SpanExceedsMaximum(KeyCustody.MaxSpan + 1L, KeyCustody.MaxSpan)),
        KeyCustody.tryWindow line (vs 0L) (KeyCustody.MaxSpan + 1L)
    )

    Assert.Equal<Result<KeyCustody.PhaseWindow, KeyCustody.WindowError>>(
        Error(KeyCustody.NonPositiveSpan 0L),
        KeyCustody.tryWindow line (vs 0L) 0L
    )

    Assert.Equal<Result<KeyCustody.PhaseWindow, KeyCustody.WindowError>>(
        Error(KeyCustody.NonPositiveSpan -1L),
        KeyCustody.tryWindow line (vs 0L) -1L
    )

    Assert.Equal<Result<KeyCustody.PhaseWindow, KeyCustody.WindowError>>(
        Error(KeyCustody.PhaseOverflow(System.Int64.MaxValue - 1L, 8L)),
        KeyCustody.tryWindow line (vs (System.Int64.MaxValue - 1L)) 8L
    )

    // At the very end of the phase coordinate the default window FAILS CLOSED — it grants nothing,
    // rather than being clamped to the coordinate's maximum (which would be indefinite in a bound's
    // clothing, exactly what R8 forbids).
    let atTheEnd = KeyCustody.window line (vs (System.Int64.MaxValue - 1L))
    Assert.Equal(0L, KeyCustody.windowSpan atTheEnd)

    Assert.Equal(
        KeyCustody.Denied,
        (KeyCustody.livenessAt atTheEnd (vs (System.Int64.MaxValue - 1L))).Decision
    )

    // Exactly at the ceiling is allowed — the boundary is `>`, not `>=`.
    match KeyCustody.tryWindow line (vs 0L) KeyCustody.MaxSpan with
    | Ok w -> Assert.Equal(KeyCustody.MaxSpan, KeyCustody.windowSpan w)
    | Error e -> failwithf "MaxSpan itself must be grantable: %A" e

[<Fact>]
let ``ACCEPTANCE 1 — a grant stops granting at expiry with NO revocation message in the stream`` () =
    let grant =
        match KeyCustody.tryIssue line "amara" "auditor" (vs 100L) 10L with
        | Ok g -> g
        | Error e -> failwithf "fixture grant: %A" e

    let stream = [ KeyCustody.GrantIssued grant ]

    // The premise, asserted rather than assumed: nothing in the stream retracts anything.
    Assert.DoesNotContain(KeyCustody.GrantRetracted("amara", "auditor"), stream)

    Assert.False(
        stream
        |> List.exists (fun ev ->
            match ev with
            | KeyCustody.GrantRetracted _
            | KeyCustody.PreviousRetracted _ -> true
            | _ -> false)
    )

    let st = KeyCustody.fold stream

    // Inside the window the grant is in force…
    Assert.Equal<string list>(
        [ "auditor" ],
        KeyCustody.liveGrants (at 105L) st |> List.map (fun g -> g.Authority)
    )

    // …and at the expiry phase it grants nothing, with no message having been delivered.
    Assert.Empty(KeyCustody.liveGrants (at 110L) st)
    Assert.Empty(KeyCustody.liveGrants (at 5_000L) st)

    // The grant is still *in* the folded state — it expired, it was not deleted (§5 memory).
    Assert.True(st.Grants.ContainsKey("amara", "auditor"))

// ───────────────── R8 attached to Hat — bounded role bindings ─────────────────

let private allowA = [| true; false |]
let private allowB = [| false; true |]

let private auditorHat: Hat.Hat<int> =
    { Name = "auditor"
      Scope = Hat.GameSpecific
      Lenses = []
      Landmarks = []
      AllowedActions = [ allowA ]
      Traversals = []
      Controls = [] }

let private auditorGrant =
    match KeyCustody.tryIssue line "amara" "auditor" (vs 10L) 4L with
    | Ok g -> g
    | Error e -> failwithf "fixture grant: %A" e

[<Fact>]
let ``a hat binding authorizes inside its window and refuses outside it, explaining which`` () =
    let inside = KeyCustody.authorize auditorHat auditorGrant (at 11L) allowA
    Assert.Equal(KeyCustody.Granted, inside.Decision)
    Assert.Equal<KeyCustody.AuthzReason>(KeyCustody.PermittedByHat("auditor", vs 14L), inside.Feedback)

    let after = KeyCustody.authorize auditorHat auditorGrant (at 14L) allowA
    Assert.Equal(KeyCustody.Refused, after.Decision)
    Assert.Equal<KeyCustody.AuthzReason>(KeyCustody.GrantNotLive(KeyCustody.WindowExpired(vs 14L, vs 14L)), after.Feedback)

[<Fact>]
let ``a live grant does not widen the hat's action restriction`` () =
    let r = KeyCustody.authorize auditorHat auditorGrant (at 11L) allowB
    Assert.Equal(KeyCustody.Refused, r.Decision)
    Assert.Equal<KeyCustody.AuthzReason>(KeyCustody.ActionNotPermitted "auditor", r.Feedback)

[<Fact>]
let ``a grant for one authority does not authorize a different hat`` () =
    let otherHat = { auditorHat with Name = "treasurer" }
    let r = KeyCustody.authorize otherHat auditorGrant (at 11L) allowA
    Assert.Equal(KeyCustody.Refused, r.Decision)
    Assert.Equal<KeyCustody.AuthzReason>(KeyCustody.AuthorityMismatch("auditor", "treasurer"), r.Feedback)

// ───────────────── R5 — three slots ─────────────────

let private ring0 = KeyCustody.openKeyring "amara" "signing" line k1

[<Fact>]
let ``R5 — rotation refuses until the next key has been published`` () =
    Assert.Equal<Result<KeyCustody.Keyring, KeyCustody.RotationError>>(
        Error(KeyCustody.NextNotPublished("amara", "signing")),
        KeyCustody.tryRotateDefault (vs 100L) ring0
    )

    // Publishing before use is what makes the rotation legal.
    match KeyCustody.tryRotateDefault (vs 100L) (KeyCustody.publishNext k2 ring0) with
    | Ok kr ->
        Assert.Equal<KeyStore.KeyRef>(k2, kr.Current)
        Assert.Equal<KeyStore.KeyRef option>(None, kr.Next) // a fresh next must be published again
        Assert.True(Option.isSome kr.Previous)
    | Error e -> failwithf "rotation with a published next must succeed: %A" e

[<Fact>]
let ``R5 — the published next key is not yet valid for signing`` () =
    let published = KeyCustody.publishNext k2 ring0
    Assert.Equal<KeyCustody.Slot option>(Some KeyCustody.Next, KeyCustody.slotOf published k2)
    let r = KeyCustody.verify published (at 100L) k2
    Assert.Equal(KeyCustody.Reject, r.Decision)
    Assert.Equal<KeyCustody.VerifyReason>(KeyCustody.SignedByNextNotYetCurrent, r.Feedback)

[<Fact>]
let ``ACCEPTANCE 2 — previous-signed material verifies for exactly the stated window and not after`` () =
    let rotated =
        match KeyCustody.tryRotate (vs 100L) 8L (KeyCustody.publishNext k2 ring0) with
        | Ok kr -> kr
        | Error e -> failwithf "fixture rotation: %A" e

    // The bound is *stated*, not implied: it is readable off the keyring.
    match rotated.Previous with
    | Some(prev, w) ->
        Assert.Equal<KeyStore.KeyRef>(k1, prev)
        Assert.Equal(8L, KeyCustody.windowSpan w)
        Assert.Equal(vs 108L, KeyCustody.windowExpiry w)
    | None -> failwith "rotation must retain the previous slot"

    let accepts phase =
        (KeyCustody.verify rotated (at phase) k1).Decision = KeyCustody.Accept

    // Exactly [100, 108): the last accepting phase is 107 and the first rejecting one is 108.
    Assert.True(accepts 100L)
    Assert.True(accepts 107L)
    Assert.False(accepts 108L)
    Assert.False(accepts 109L)

    // …and the rejection explains itself as an expiry, not as an unknown key.
    let r = KeyCustody.verify rotated (at 108L) k1
    Assert.Equal<KeyCustody.VerifyReason>(
        KeyCustody.PreviousAcceptanceClosed(KeyCustody.WindowExpired(vs 108L, vs 108L)),
        r.Feedback
    )

    // The new current signs throughout, before and after the previous window closes.
    Assert.Equal(KeyCustody.Accept, (KeyCustody.verify rotated (at 100L) k2).Decision)
    Assert.Equal(KeyCustody.Accept, (KeyCustody.verify rotated (at 10_000L) k2).Decision)

[<Fact>]
let ``a key from no slot is rejected as unknown, not as expired`` () =
    let rotated =
        match KeyCustody.tryRotateDefault (vs 100L) (KeyCustody.publishNext k2 ring0) with
        | Ok kr -> kr
        | Error e -> failwithf "fixture rotation: %A" e

    let r = KeyCustody.verify rotated (at 100L) stranger
    Assert.Equal(KeyCustody.Reject, r.Decision)
    Assert.Equal<KeyCustody.VerifyReason>(KeyCustody.UnknownSigningKey, r.Feedback)
    Assert.Equal<KeyCustody.Slot option>(None, KeyCustody.slotOf rotated stranger)

[<Fact>]
let ``two rotations retire the intermediate key — only one previous slot is carried`` () =
    let once =
        match KeyCustody.tryRotate (vs 100L) 8L (KeyCustody.publishNext k2 ring0) with
        | Ok kr -> kr
        | Error e -> failwithf "fixture: %A" e

    let twice =
        match KeyCustody.tryRotate (vs 104L) 8L (KeyCustody.publishNext k3 once) with
        | Ok kr -> kr
        | Error e -> failwithf "fixture: %A" e

    Assert.Equal<KeyStore.KeyRef>(k3, twice.Current)
    Assert.Equal<KeyCustody.Slot option>(Some KeyCustody.Previous, KeyCustody.slotOf twice k2)
    // k1 is gone from every slot even though its own acceptance window had not closed — the three
    // slots are a fixed-width ladder, not a growing history of accepted keys.
    Assert.Equal<KeyCustody.Slot option>(None, KeyCustody.slotOf twice k1)
    Assert.Equal(KeyCustody.Reject, (KeyCustody.verify twice (at 105L) k1).Decision)

// ───────────────── R6 / R7 — the event stream ─────────────────

let private rotationStream =
    [ KeyCustody.KeyringOpened("amara", "signing", line, k1)
      KeyCustody.NextPublished("amara", "signing", k2)
      KeyCustody.Rotated("amara", "signing", vs 100L, 8L) ]

[<Fact>]
let ``ACCEPTANCE 5 — replaying the stream from empty reproduces the same state`` () =
    let once = KeyCustody.fold rotationStream
    let twice = KeyCustody.fold rotationStream
    Assert.Equal<KeyCustody.Custody>(once, twice)

    // …and incremental application matches the whole-stream fold (prefix + suffix = all).
    let prefix, suffix = List.splitAt 2 rotationStream
    let incremental = List.fold KeyCustody.applyEvent (KeyCustody.fold prefix) suffix
    Assert.Equal<KeyCustody.Custody>(once, incremental)

    match Map.tryFind ("amara", "signing") once.Keyrings with
    | Some kr ->
        Assert.Equal<KeyStore.KeyRef>(k2, kr.Current)
        Assert.True(Option.isSome kr.Previous)
    | None -> failwith "the fold must produce the keyring"

[<Fact>]
let ``the fold is idempotent under redelivery — replaying events already applied changes nothing`` () =
    let once = KeyCustody.fold rotationStream

    // The whole stream delivered twice (the duplicate-delivery case).
    Assert.Equal<KeyCustody.Custody>(once, KeyCustody.fold (rotationStream @ rotationStream))

    // A prefix re-sent before the rest arrives (the partial-replay case).
    Assert.Equal<KeyCustody.Custody>(
        once,
        KeyCustody.fold (List.truncate 2 rotationStream @ rotationStream)
    )

    // The cases the two above CANNOT catch, because replaying a whole stream in order happens to
    // reconstruct the same state: an OLD event redelivered *after* later events have landed.
    // Re-opening must not reset the keyring to its first key…
    Assert.Equal<KeyCustody.Custody>(once, KeyCustody.fold (rotationStream @ [ List.head rotationStream ]))

    // …and a rotation redelivered after a fresh `next` was published must not rotate a second time.
    let withFreshNext = rotationStream @ [ KeyCustody.NextPublished("amara", "signing", k3) ]

    Assert.Equal<KeyCustody.Custody>(
        KeyCustody.fold withFreshNext,
        KeyCustody.fold (withFreshNext @ [ List.item 2 rotationStream ])
    )

    // …which is only a meaningful comparison if the fresh `next` really did land.
    match Map.tryFind ("amara", "signing") (KeyCustody.fold withFreshNext).Keyrings with
    | Some kr -> Assert.Equal<KeyStore.KeyRef option>(Some k3, kr.Next)
    | None -> failwith "the fold must produce the keyring"

[<Fact>]
let ``the previous slot can also be retracted early, before its window would have closed`` () =
    let st = KeyCustody.fold (rotationStream @ [ KeyCustody.PreviousRetracted("amara", "signing") ])

    match Map.tryFind ("amara", "signing") st.Keyrings with
    | Some kr ->
        Assert.Equal<(KeyStore.KeyRef * KeyCustody.PhaseWindow) option>(None, kr.Previous)
        // Phase 101 is still inside the [100, 108) acceptance window, yet k1 no longer verifies:
        // the retraction, not the clock, is what ended it.
        Assert.Equal(KeyCustody.Reject, (KeyCustody.verify kr (at 101L) k1).Decision)
    | None -> failwith "the fold must produce the keyring"

[<Fact>]
let ``R7 — the KeyStore bridge carries references only, and only for the current slot`` () =
    let opened = KeyCustody.fold [ List.head rotationStream ]
    let published = KeyCustody.fold (List.truncate 2 rotationStream)

    Assert.Equal<KeyStore.KeyEvent list>(
        [ KeyStore.KeyCaptured("amara", "signing", k1) ],
        KeyCustody.keyStoreEvents KeyCustody.emptyCustody (List.head rotationStream)
    )

    // Publishing `next` changes no KeyStore state — publishing is not using (R5).
    Assert.Empty(KeyCustody.keyStoreEvents opened (List.item 1 rotationStream))

    // Rotating upserts the KeyRing entry to the new current, by reference.
    Assert.Equal<KeyStore.KeyEvent list>(
        [ KeyStore.KeyCaptured("amara", "signing", k2) ],
        KeyCustody.keyStoreEvents published (List.item 2 rotationStream)
    )

    // Grants are authority, not keys — they touch no key material at all.
    let grant =
        match KeyCustody.tryIssue line "amara" "auditor" (vs 0L) 4L with
        | Ok g -> g
        | Error e -> failwithf "fixture: %A" e

    Assert.Empty(KeyCustody.keyStoreEvents published (KeyCustody.GrantIssued grant))

    // Folded through KeyStore, the keyring holds the current slot at the reference the stream named.
    let ring =
        rotationStream
        |> List.fold
            (fun (st, evs) ev -> (KeyCustody.applyEvent st ev, evs @ KeyCustody.keyStoreEvents st ev))
            (KeyCustody.emptyCustody, [])
        |> snd
        |> KeyStore.fold KeyStore.LocalFile

    Assert.Equal<KeyStore.KeyRef option>(Some k2, Map.tryFind ("amara", "signing") ring.Keys)

// ───────────────── R12 — the explanations are real sentences ─────────────────

[<Fact>]
let ``every decision renders an explanation that names the phase involved`` () =
    Assert.Contains("14", KeyCustody.explainLiveness (KeyCustody.WindowExpired(vs 14L, vs 14L)))
    Assert.Contains("issuer", KeyCustody.explainLiveness (KeyCustody.PhaseLineUnobserved line))
    Assert.Contains("auditor", KeyCustody.explainAuthz (KeyCustody.ActionNotPermitted "auditor"))
    Assert.Contains("treasurer", KeyCustody.explainAuthz (KeyCustody.AuthorityMismatch("auditor", "treasurer")))
    Assert.Contains("108", KeyCustody.explainVerify (KeyCustody.SignedByPreviousWithinWindow(vs 108L)))
    Assert.Contains("current", KeyCustody.explainVerify KeyCustody.SignedByCurrent)
