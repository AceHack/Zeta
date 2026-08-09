namespace Zeta.Core

/// **KeyCustody — bounded grants that expire against agreed PHASE, and three-slot key rotation.**
///
/// Implements the slice `R8`, `R9`, `R5` (plus the `R6`/`R7`/`R12` composition legs) of
/// `docs/specs/key-custody-and-rotation-cleanroom-spec.md`. This module is the **clean side** of a
/// clean-room wall: it was written from that specification's requirements alone, by an agent that has
/// not seen (and did not look for) any third-party implementation of similar functionality
/// (`.claude/rules/cleanroom-two-team-separation.md`).
///
/// ## The one idea
///
/// A grant of authority is a **half-open window `[Start, Expiry)` on a named phase line** — never a
/// duration in seconds, never a wall-clock instant. Liveness is then a *pure function* of
/// `(window, observed phase on that line)`:
///
///   * **`R8` — bounded by construction.** `PhaseWindow`'s representation is `private`; the only ways
///     to obtain one are `tryWindow` (bounded by `MaxSpan`) and `window` (bounded by `DefaultSpan`).
///     There is no constructor for an indefinite grant, so an unbounded grant is not *expressible* —
///     which is what §3 weight-free asks for (an unbounded grant accumulates authority).
///   * **`R8` — no message required.** Nothing revokes a grant. A grant stops granting the moment the
///     evaluator's own observation of the phase line reaches `Expiry`. The event stream contains no
///     retraction and none is needed; `liveGrants` at a later phase simply returns less.
///   * **`R9` — agreed phase, never local wall-clock.** No function here takes a `DateTime`,
///     `DateTimeOffset`, or `Stopwatch`; there is no ambient clock read. The phase comes from a
///     `TravelerFrame.Frame` coordinate — the causal, order-independent coordinate two principals
///     agree on — so two principals with arbitrarily skewed local clocks that have observed the same
///     phase return the *same* decision. This is
///     `.claude/rules/local-time-never-enters-the-shared-fold.md` applied to expiry: local wall-clock
///     may drive *local* actions (when to ask for a fresh grant, when to retransmit), never the
///     shared judgement of whether a grant is live.
///
/// ### Honest residual (named, not hidden)
///
/// Expiry is **monotone and eventual, not simultaneous**. Liveness reads one coordinate of the
/// evaluator's frame, and frame coordinates only ever advance (`TravelerFrame.observe` is a `max`),
/// so once a principal sees a grant expired it can never see it live again — there is no
/// resurrection, and no revocation message is ever required. But a principal whose observation of the
/// phase line is *stale* keeps granting for longer than one whose observation is current. Bounding
/// that staleness (so expiry fires within a known bound of the agreed phase even under partition) is
/// a **separate requirement that the specification does not state** — see the clean-side report. What
/// is guaranteed here is the property the specification does ask for: *same observed phase ⇒ same
/// decision, whatever the clocks say*.
///
/// ## Three slots (`R5`)
///
/// A `Keyring` carries `Previous` (accepted from peers that have not yet observed the rotation, for a
/// **bounded** window — the same `PhaseWindow` machinery, so `R8` covers it), `Current` (signs), and
/// `Next` (published *before* it is used; `tryRotate` refuses when `Next` is absent). The acceptance
/// window is stated as `DefaultPreviousAcceptanceSpan` phase units by default and is always explicit
/// in the `Keyring`, satisfying `R5`'s "the bound MUST be stated".
///
/// ## Events (`R6`/`R7`)
///
/// Custody changes are `CustodyEvent`s folded from empty — append-only, deterministic (`DST`, §7), and
/// carrying `KeyStore.KeyRef` **references only, never key material** (`R7`, reference-not-copy). The
/// fold composes with `KeyStore` rather than replacing it: the `KeyRing`'s `(identity, account)` entry
/// holds the **current** slot; `Previous`/`Next` are custody-layer slots whose lifecycle is this
/// stream. `keyStoreEvents` is the bridge.
///
/// The fold is **idempotent under redelivery** (§12): opening is open-once, publishing a key that
/// already signs is a no-op, and a rotation carries its phase as its natural dedup key — so folding a
/// stream that repeats events lands on the state the de-duplicated stream would.
///
/// ## Decisions explain themselves (`R12`)
///
/// Every answer is a `Policy.PolicyResult<'decision, 'reason>` — the typed decision *and* the why —
/// built on the `Policy` kernel. `explainLiveness` / `explainAuthz` / `explainVerify` render the why
/// as a teaching line. A bare deny is not available from this module.
///
/// **Deferred (not in this slice):** `R1`–`R4` (ownership as an entity, key classes, two-sided
/// transfer, the custody fork over `DagFs`), `R10` (staking witness), `R11` (per-principal issuance).
[<RequireQualifiedAccess>]
module KeyCustody =

    open Zeta.Core

    // ────────────────────────────── Phase windows (R8 + R9) ──────────────────────────────

    /// The default span of a grant, in phase units. Bounded — an omitted duration is never indefinite.
    [<Literal>]
    let DefaultSpan = 256L

    /// The hard ceiling on any single grant's span, in phase units. `tryWindow` refuses more; a longer
    /// authority must be *re-granted* (a fresh, observable event) rather than granted once forever.
    [<Literal>]
    let MaxSpan = 65536L

    /// The default bound on how long `previous`-signed material stays acceptable after a rotation
    /// (`R5`: the window "MUST be bounded and that bound MUST be stated"). Deliberately much shorter
    /// than `DefaultSpan`: too short re-opens the no-coordinator verification gap, too long extends
    /// acceptance of a possibly-compromised key.
    [<Literal>]
    let DefaultPreviousAcceptanceSpan = 64L

    /// Why a window could not be constructed. There is no "unbounded" case because there is no
    /// unbounded window.
    type WindowError =
        /// A span of zero or less grants nothing; it is a caller bug, not a valid "expired" grant.
        | NonPositiveSpan of span: int64
        /// Longer than `MaxSpan` — re-grant instead of granting once forever (§3 weight-free).
        | SpanExceedsMaximum of span: int64 * maximum: int64
        /// `Start + span` would overflow the phase coordinate.
        | PhaseOverflow of start: int64 * span: int64

    /// A **half-open** window `[Start, Expiry)` of phase on one named line. The representation is
    /// `private`: the only ways in are `tryWindow` / `window`, both of which bound the span. That is
    /// how `R8`'s "the default MUST be bounded" is made structural rather than conventional.
    type PhaseWindow =
        private
            { Line: string
              Start: Versionstamp
              Expiry: Versionstamp }

    /// The phase line this window is stated against (which timeline's coordinate decides it).
    let windowLine (w: PhaseWindow) : string = w.Line

    /// The phase at which the window opens (inclusive).
    let windowStart (w: PhaseWindow) : Versionstamp = w.Start

    /// The phase at which the window closes (**exclusive** — at exactly this phase it no longer grants).
    let windowExpiry (w: PhaseWindow) : Versionstamp = w.Expiry

    /// The window's span in phase units.
    let windowSpan (w: PhaseWindow) : int64 = w.Expiry.Version - w.Start.Version

    /// Construct a bounded window `[start, start + span)` on `line`, or explain why not.
    let tryWindow (line: string) (start: Versionstamp) (span: int64) : Result<PhaseWindow, WindowError> =
        if span <= 0L then Error(NonPositiveSpan span)
        elif span > MaxSpan then Error(SpanExceedsMaximum(span, MaxSpan))
        elif start.Version > System.Int64.MaxValue - span then Error(PhaseOverflow(start.Version, span))
        else
            Ok
                { Line = line
                  Start = start
                  Expiry = Versionstamp.ofInt64 (start.Version + span) }

    /// The default-bounded window `[start, start + DefaultSpan)`. Total, and **fail-closed**: if `start`
    /// is within `DefaultSpan` of the end of the phase coordinate the result is the EMPTY window
    /// `[start, start)`, which grants nothing. Deliberately not clamped to the coordinate's maximum —
    /// that would be an indefinite grant wearing a bound, which is exactly what `R8` forbids.
    let window (line: string) (start: Versionstamp) : PhaseWindow =
        match tryWindow line start DefaultSpan with
        | Ok w -> w
        | Error _ -> { Line = line; Start = start; Expiry = start }

    /// Is a grant live? Two-valued; the *why* travels beside it (`R12`).
    type Liveness =
        | Live
        | Denied

    /// Why a liveness decision came out the way it did — the teaching surface (`R12`).
    type LivenessReason =
        /// Inside `[Start, Expiry)` at the observed phase.
        | WithinWindow of observed: Versionstamp * expiry: Versionstamp
        /// The observed phase has not reached `Start` yet (a future grant, or a fail-closed unknown).
        | BeforeWindowOpens of observed: Versionstamp * opens: Versionstamp
        /// The observed phase reached `Expiry`. **No revocation message was involved** (`R8`).
        | WindowExpired of observed: Versionstamp * expiry: Versionstamp
        /// This principal has never observed the phase line the window is stated against, so it cannot
        /// judge liveness — and therefore refuses (fail-closed).
        | PhaseLineUnobserved of line: string

    /// Render a liveness reason as a line a caller can act on (`R12`).
    let explainLiveness (r: LivenessReason) : string =
        match r with
        | WithinWindow(o, e) -> sprintf "live: observed phase %d is inside the window, which closes at %d" o.Version e.Version
        | BeforeWindowOpens(o, s) -> sprintf "not yet: observed phase %d, the window opens at %d" o.Version s.Version
        | WindowExpired(o, e) ->
            sprintf "expired: the window closed at phase %d and the observed phase is %d (no revocation was needed)" e.Version o.Version
        | PhaseLineUnobserved line ->
            sprintf "cannot judge: phase line '%s' has never been observed here, so the grant is refused" line

    /// Liveness at an explicitly supplied phase — the whole rule, in one total function of
    /// `(window, phase)`. Nothing else is consulted: no clock, no ambient state, no other coordinate.
    let livenessAt (w: PhaseWindow) (observed: Versionstamp) : Policy.PolicyResult<Liveness, LivenessReason> =
        if observed.Version < w.Start.Version then
            Policy.result Denied (BeforeWindowOpens(observed, w.Start))
        elif observed.Version < w.Expiry.Version then
            Policy.result Live (WithinWindow(observed, w.Expiry))
        else
            Policy.result Denied (WindowExpired(observed, w.Expiry))

    /// This principal's observation of a phase line, or `None` if it has never observed that line.
    /// (`TravelerFrame.coord` reports the origin for an unseen actor; for authorization the difference
    /// between "at the origin" and "never seen" is load-bearing, so it is preserved here.)
    let observedPhase (line: string) (frame: TravelerFrame.Frame) : Versionstamp option =
        Map.tryFind line frame.Coords

    /// Liveness as judged by a principal holding causal frame `frame`. Reads **exactly one** coordinate
    /// — the one named by the window — and nothing else about the frame, which is what makes two
    /// principals with different local clocks (and different views of every other timeline) agree.
    let liveness (w: PhaseWindow) (frame: TravelerFrame.Frame) : Policy.PolicyResult<Liveness, LivenessReason> =
        match observedPhase w.Line frame with
        | None -> Policy.result Denied (PhaseLineUnobserved w.Line)
        | Some observed -> livenessAt w observed

    /// The same rule as a `Policy` value, so it composes with the kernel's `map` / `contramap` /
    /// `firstMatch` like any other decision-with-feedback.
    let livenessPolicy (w: PhaseWindow) : Policy.Policy<TravelerFrame.Frame, Liveness, LivenessReason> = liveness w

    // ────────────────────────────── Grants (R8, attached to Hat) ──────────────────────────────

    /// A time-bounded grant of one named authority to one principal. `Authority` is a `Hat` name: a
    /// hat says *what* a role may do, a grant says *who* wears it and *until when*.
    type Grant =
        { Principal: string
          Authority: string
          Window: PhaseWindow }

    /// Issue a grant with an explicit span, or explain why the span is not grantable.
    let tryIssue
        (line: string)
        (principal: string)
        (authority: string)
        (start: Versionstamp)
        (span: int64)
        : Result<Grant, WindowError> =
        tryWindow line start span
        |> Result.map (fun w ->
            { Principal = principal
              Authority = authority
              Window = w })

    /// Issue a grant with the default bound. There is deliberately no `issueForever`.
    let issue (line: string) (principal: string) (authority: string) (start: Versionstamp) : Grant =
        { Principal = principal
          Authority = authority
          Window = window line start }

    /// The outcome of an authorization check.
    type AuthzDecision =
        | Granted
        | Refused

    /// Why authorization came out the way it did (`R12`) — never a bare deny.
    type AuthzReason =
        /// The grant itself is not live at the observed phase; the liveness reason is carried through.
        | GrantNotLive of LivenessReason
        /// The grant names a different authority than the hat presented.
        | AuthorityMismatch of granted: string * presented: string
        /// The grant is live and names this hat, but the hat's action restriction excludes the action.
        | ActionNotPermitted of hat: string
        /// Live grant, matching hat, permitted action.
        | PermittedByHat of hat: string * expiry: Versionstamp

    /// Render an authorization reason as a line a caller can act on (`R12`).
    let explainAuthz (r: AuthzReason) : string =
        match r with
        | GrantNotLive lr -> "refused — " + explainLiveness lr
        | AuthorityMismatch(granted, presented) ->
            sprintf "refused: the grant is for authority '%s', not '%s'" granted presented
        | ActionNotPermitted hat -> sprintf "refused: hat '%s' does not permit that action" hat
        | PermittedByHat(hat, expiry) ->
            sprintf "granted: hat '%s' permits the action, until phase %d" hat expiry.Version

    /// Authorize one action for a principal wearing `hat` under `grant`, as judged at `frame`.
    ///
    /// Three gates, in order: the grant must name this hat; the grant must be live at the observed
    /// phase (`R8`/`R9`); the hat must permit the action (`Hat.permits` — an empty allow-list is
    /// unrestricted). The window is what stops a hat binding from becoming permanent authority.
    let authorize
        (hat: Hat.Hat<'r>)
        (grant: Grant)
        (frame: TravelerFrame.Frame)
        (action: bool[])
        : Policy.PolicyResult<AuthzDecision, AuthzReason> =
        if grant.Authority <> hat.Name then
            Policy.result Refused (AuthorityMismatch(grant.Authority, hat.Name))
        else
            let live = liveness grant.Window frame
            match live.Decision with
            | Denied -> Policy.result Refused (GrantNotLive live.Feedback)
            | Live ->
                if Hat.permits action hat then
                    Policy.result Granted (PermittedByHat(hat.Name, grant.Window.Expiry))
                else
                    Policy.result Refused (ActionNotPermitted hat.Name)

    // ────────────────────────────── Three key slots (R5) ──────────────────────────────

    /// The three slots a principal holds at once (`R5`).
    type Slot =
        /// Superseded, still accepted from peers that have not yet observed the rotation — for a
        /// bounded, stated window.
        | Previous
        /// The slot that signs.
        | Current
        /// Published before it is used; not yet valid for signing.
        | Next

    /// One principal's key slots for one account, plus the phase line its windows are stated against.
    /// `Previous` carries its own bounded acceptance window, so `R5`'s bound is always *stated*, never
    /// implied.
    type Keyring =
        { Principal: string
          Account: string
          Line: string
          Current: KeyStore.KeyRef
          Previous: (KeyStore.KeyRef * PhaseWindow) option
          Next: KeyStore.KeyRef option }

    /// Open a keyring with a current key and neither a previous nor a published next.
    let openKeyring (principal: string) (account: string) (line: string) (current: KeyStore.KeyRef) : Keyring =
        { Principal = principal
          Account = account
          Line = line
          Current = current
          Previous = None
          Next = None }

    /// Publish the next key **before** it is used (`R5`). Idempotent in effect: re-publishing the same
    /// reference leaves the keyring identical.
    let publishNext (next: KeyStore.KeyRef) (kr: Keyring) : Keyring = { kr with Next = Some next }

    /// Why a rotation could not be performed.
    type RotationError =
        /// `R5`: `next` must be published before it is used. Rotating without it would create exactly
        /// the window in which two honest peers cannot verify each other.
        | NextNotPublished of principal: string * account: string
        /// The acceptance window for the retiring key was not constructible.
        | AcceptanceWindow of WindowError

    /// Rotate at phase `at`: `next` becomes `current`, `current` becomes `previous` with a bounded
    /// acceptance window `[at, at + acceptanceSpan)`, and `next` is emptied (a fresh one must be
    /// published before the following rotation).
    let tryRotate (at: Versionstamp) (acceptanceSpan: int64) (kr: Keyring) : Result<Keyring, RotationError> =
        match kr.Next with
        | None -> Error(NextNotPublished(kr.Principal, kr.Account))
        | Some next ->
            match tryWindow kr.Line at acceptanceSpan with
            | Error e -> Error(AcceptanceWindow e)
            | Ok w ->
                Ok
                    { kr with
                        Current = next
                        Previous = Some(kr.Current, w)
                        Next = None }

    /// Rotate with the default, stated acceptance bound.
    let tryRotateDefault (at: Versionstamp) (kr: Keyring) : Result<Keyring, RotationError> =
        tryRotate at DefaultPreviousAcceptanceSpan kr

    /// Which slot a reference occupies, if any. `Current` wins if a reference occupies more than one
    /// slot (rotating back to a key you already hold).
    let slotOf (kr: Keyring) (r: KeyStore.KeyRef) : Slot option =
        if kr.Current = r then Some Current
        elif kr.Next = Some r then Some Next
        else
            match kr.Previous with
            | Some(p, _) when p = r -> Some Previous
            | _ -> None

    /// The outcome of verifying material against a keyring.
    type VerifyDecision =
        | Accept
        | Reject

    /// Why verification came out the way it did (`R12`).
    type VerifyReason =
        /// Signed by the slot that signs.
        | SignedByCurrent
        /// Signed by the superseded key, still inside its stated acceptance window — the peer has not
        /// yet observed the rotation, and neither party is wrong (`R5`).
        | SignedByPreviousWithinWindow of expiry: Versionstamp
        /// Signed by the superseded key after its stated acceptance window closed.
        | PreviousAcceptanceClosed of LivenessReason
        /// Signed by the published-but-not-yet-current key. Publishing is not using (`R5`).
        | SignedByNextNotYetCurrent
        /// The reference occupies no slot in this keyring.
        | UnknownSigningKey

    /// Render a verification reason as a line a caller can act on (`R12`).
    let explainVerify (r: VerifyReason) : string =
        match r with
        | SignedByCurrent -> "accepted: signed by the current key"
        | SignedByPreviousWithinWindow expiry ->
            sprintf
                "accepted: signed by the previous key, whose acceptance window closes at phase %d (the peer has not yet observed the rotation)"
                expiry.Version
        | PreviousAcceptanceClosed lr -> "rejected — previous-key acceptance " + explainLiveness lr
        | SignedByNextNotYetCurrent -> "rejected: signed by the next key, which is published but not yet current"
        | UnknownSigningKey -> "rejected: that key occupies no slot in this keyring"

    /// Verify material signed with `signedWith` against a keyring, as judged at `frame`.
    ///
    /// `previous`-signed material is accepted for **exactly** the stated window and not after; the
    /// window is judged by the same phase rule as every other grant, so `R9` holds here too.
    let verify
        (kr: Keyring)
        (frame: TravelerFrame.Frame)
        (signedWith: KeyStore.KeyRef)
        : Policy.PolicyResult<VerifyDecision, VerifyReason> =
        match slotOf kr signedWith with
        | Some Current -> Policy.result Accept SignedByCurrent
        | Some Next -> Policy.result Reject SignedByNextNotYetCurrent
        | Some Previous ->
            match kr.Previous with
            | Some(_, w) ->
                let live = liveness w frame
                match live.Decision with
                | Live -> Policy.result Accept (SignedByPreviousWithinWindow w.Expiry)
                | Denied -> Policy.result Reject (PreviousAcceptanceClosed live.Feedback)
            | None -> Policy.result Reject UnknownSigningKey
        | None -> Policy.result Reject UnknownSigningKey

    // ────────────────────────────── The event stream (R6 + R7) ──────────────────────────────

    /// Custody changes as append-only events. Every payload is a **reference or metadata** — no key
    /// material ever enters the stream (`R7`), so the stream stays text, diffable, and replayable.
    ///
    /// Events are produced by the validating command functions above (`tryRotate`, `tryIssue`); the
    /// fold below trusts them and is total, leaving state unchanged for a transition that the commands
    /// cannot produce. That is the usual command-validates / fold-applies split, and it is what keeps
    /// replay deterministic.
    type CustodyEvent =
        | KeyringOpened of principal: string * account: string * line: string * current: KeyStore.KeyRef
        | NextPublished of principal: string * account: string * next: KeyStore.KeyRef
        | Rotated of principal: string * account: string * atPhase: Versionstamp * acceptanceSpan: int64
        /// The **retraction** of the superseded slot (`R6`): the previous key stops being accepted
        /// early, before its window would have closed. Not required for expiry — expiry needs no event
        /// at all — this is for a key known to be compromised.
        | PreviousRetracted of principal: string * account: string
        | GrantIssued of grant: Grant
        /// Early retraction of a grant (`R6`). Also not required for expiry.
        | GrantRetracted of principal: string * authority: string

    /// The folded custody state: keyrings by `(principal, account)`, grants by `(principal, authority)`.
    type Custody =
        { Keyrings: Map<string * string, Keyring>
          Grants: Map<string * string, Grant> }

    let emptyCustody: Custody =
        { Keyrings = Map.empty
          Grants = Map.empty }

    /// Apply one event. Upsert-keyed throughout, so replaying a prefix twice lands on the same state
    /// (idempotency, §12).
    let applyEvent (st: Custody) (ev: CustodyEvent) : Custody =
        match ev with
        // Open-once: re-opening an existing keyring would silently discard its slots, so a redelivered
        // `KeyringOpened` is a no-op rather than a reset.
        | KeyringOpened(principal, account, line, current) ->
            if st.Keyrings.ContainsKey((principal, account)) then
                st
            else
                { st with
                    Keyrings = Map.add (principal, account) (openKeyring principal account line current) st.Keyrings }
        // A key that already signs is not a candidate `next`; that shape only arises from redelivery of
        // a publication the rotation already consumed.
        | NextPublished(principal, account, next) ->
            match Map.tryFind (principal, account) st.Keyrings with
            | None -> st
            | Some kr when kr.Current = next -> st
            | Some kr ->
                { st with
                    Keyrings = Map.add (principal, account) (publishNext next kr) st.Keyrings }
        // The rotation phase is the natural dedup key: a rotation at or before the one already recorded
        // in the previous slot has been applied, so redelivering it rotates nothing.
        | Rotated(principal, account, at, acceptanceSpan) ->
            match Map.tryFind (principal, account) st.Keyrings with
            | None -> st
            | Some kr ->
                let alreadyApplied =
                    match kr.Previous with
                    | Some(_, w) -> w.Start.Version >= at.Version
                    | None -> false

                if alreadyApplied then
                    st
                else
                    match tryRotate at acceptanceSpan kr with
                    | Error _ -> st
                    | Ok kr' ->
                        { st with
                            Keyrings = Map.add (principal, account) kr' st.Keyrings }
        | PreviousRetracted(principal, account) ->
            match Map.tryFind (principal, account) st.Keyrings with
            | None -> st
            | Some kr ->
                { st with
                    Keyrings = Map.add (principal, account) { kr with Previous = None } st.Keyrings }
        | GrantIssued grant ->
            { st with
                Grants = Map.add (grant.Principal, grant.Authority) grant st.Grants }
        | GrantRetracted(principal, authority) ->
            { st with
                Grants = Map.remove (principal, authority) st.Grants }

    /// Fold a whole stream from empty — deterministic and replayable (`R6`, §7 DST).
    let fold (events: CustodyEvent list) : Custody =
        List.fold applyEvent emptyCustody events

    /// The grants that are **live** at the phase this principal has observed. Note what is absent: no
    /// retraction event is consulted, because expiry does not need one (`R8`). Folding the same stream
    /// at a later phase simply returns fewer grants.
    let liveGrants (frame: TravelerFrame.Frame) (st: Custody) : Grant list =
        st.Grants
        |> Map.toList
        |> List.map snd
        |> List.filter (fun g -> (liveness g.Window frame).Decision = Live)

    /// The `KeyStore` events a custody event implies — **references only** (`R7`). This composes with
    /// `KeyStore` rather than replacing it: a `KeyRing`'s `(identity, account)` entry holds the
    /// **current** slot, so opening and rotating are upserts of that entry, while the `Previous`/`Next`
    /// slots live only in this module's stream. `PreviousRetracted` therefore emits nothing to
    /// `KeyStore` — the keyring never held that slot — and `GrantRetracted` is an authority event, not
    /// a key event.
    let keyStoreEvents (before: Custody) (ev: CustodyEvent) : KeyStore.KeyEvent list =
        match ev with
        | KeyringOpened(principal, account, _, current) -> [ KeyStore.KeyCaptured(principal, account, current) ]
        | Rotated(principal, account, _, _) ->
            match Map.tryFind (principal, account) before.Keyrings with
            | Some kr ->
                match kr.Next with
                | Some next -> [ KeyStore.KeyCaptured(principal, account, next) ]
                | None -> []
            | None -> []
        | NextPublished _
        | PreviousRetracted _
        | GrantIssued _
        | GrantRetracted _ -> []
