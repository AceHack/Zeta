namespace Zeta.Core

/// **Threshold signature verification, from one verifier's perspective.**
///
/// Clean-room derivation C of `docs/specs/threshold-signature-verification-cleanroom-spec.md`
/// (N-version, N=3). Derived from the specification's requirements only.
///
/// The shape in one line: `verify (schemes) (verifier) (request) : Result<Verdict, ConfigError>` —
/// a **pure function** of (the verifier's roster + threshold + scheme policy, the request, the set
/// of algorithm implementations). No clock, no I/O, no ambient state, no global roster: every
/// verdict is *some named verifier's* verdict, and two verifiers may legitimately disagree.
///
/// Registers of the result (spec R1): the verdict is a discriminated union carrying *why*, and the
/// per-signer findings (unknown / duplicate / failed-verification / unaccepted-scheme) are typed
/// values a caller can `match` on — never free-form strings.
module ThresholdVerification =

    open System
    open System.Security.Cryptography
    open System.Text

    // ----------------------------------------------------------------------------------------
    // Identities and time
    // ----------------------------------------------------------------------------------------

    /// A signing identity. Compared **ordinally** (F# structural comparison over `string` is
    /// `String.CompareOrdinal`) — `culture-invariant-by-default`.
    type SignerId = SignerId of string

    /// The name of a signature scheme. Opaque at every call site (R6: no call site names a
    /// concrete algorithm — it names a `SchemeId` that came from data, or nothing at all).
    type SchemeId = SchemeId of string

    /// A **logical** epoch. There is no wall clock anywhere in this module (R9); when the
    /// migration window (R7) needs a time coordinate, the caller supplies it as data.
    type Epoch = int64

    // ----------------------------------------------------------------------------------------
    // The request
    // ----------------------------------------------------------------------------------------

    /// One submitted signature. `Signature` is caller-supplied bytes; it is never re-emitted in a
    /// verdict (R10).
    type SubmittedSignature =
        { Signer: SignerId
          Scheme: SchemeId
          Signature: byte[] }

    /// What is being authorized, plus the submissions offered in support of it.
    ///
    /// `Epoch` is **data on the request**, not a reading of a clock — see the derivation report:
    /// the spec requires a bounded migration window (R7) but binds signatures only to *scope and
    /// payload* (R5), so the epoch is necessarily unsigned. That is a named spec defect.
    type AuthorizationRequest =
        { Scope: string
          Payload: byte[]
          Epoch: Epoch
          Signatures: SubmittedSignature list }

    /// The exact bytes a signature must cover: **length-prefixed** scope, then payload.
    ///
    /// The spec says a signature is "over the request's scope and payload" without fixing the
    /// binding. Naive concatenation is ambiguous — `("ab", "c")` and `("a", "bc")` would produce
    /// the same bytes, so a signature authorizing one would authorize the other. A 4-byte
    /// big-endian length prefix on the UTF-8 scope removes the ambiguity, and is endian-explicit
    /// so the bytes are identical on every machine (R9).
    let canonicalMessage (scope: string) (payload: byte[]) : byte[] =
        let scopeBytes = Encoding.UTF8.GetBytes(scope)
        let n = scopeBytes.Length

        let prefix =
            [| byte ((n >>> 24) &&& 0xFF)
               byte ((n >>> 16) &&& 0xFF)
               byte ((n >>> 8) &&& 0xFF)
               byte (n &&& 0xFF) |]

        Array.concat [ prefix; scopeBytes; payload ]

    // ----------------------------------------------------------------------------------------
    // R6 — the scheme PORT
    // ----------------------------------------------------------------------------------------

    /// **The port.** The algorithm is pluggable; nothing above this line knows what it is.
    ///
    /// Implementations MUST be total: a malformed key, a truncated signature, an unsupported curve
    /// — all of these are *verdicts* (`false`), never exceptions. The verification path is
    /// fail-closed and exception-free (house convention: result over exception).
    type ISignatureScheme =
        abstract Scheme: SchemeId
        abstract Verify: publicKey: byte[] * message: byte[] * signature: byte[] -> bool

    // ----------------------------------------------------------------------------------------
    // R2 / R7 / R8 — the verifier's own configuration
    // ----------------------------------------------------------------------------------------

    /// One (signer, scheme) → public key binding on *a* verifier's roster. A signer may appear
    /// under more than one scheme (that is what makes a migration possible).
    type RosterEntry =
        { Signer: SignerId
          Scheme: SchemeId
          PublicKey: byte[] }

    /// A scheme being retired, with the **bounded** window during which it is still accepted.
    /// Both endpoints are **inclusive** (`FirstEpoch <= e <= LastEpoch`).
    type RetiringScheme =
        { Scheme: SchemeId
          FirstEpoch: Epoch
          LastEpoch: Epoch }

    /// Which schemes this verifier accepts. The current scheme is unbounded; only the retiring
    /// scheme carries a window (R7 asks for the *overlap* to be bounded and stated in the data).
    type SchemePolicy =
        { Current: SchemeId
          Retiring: RetiringScheme option }

    /// **One verifying party.** There is deliberately no global instance of this and no default
    /// value (R2): a verdict is always somebody's.
    type Verifier =
        { Roster: RosterEntry list
          Threshold: int
          Policy: SchemePolicy }

    // ----------------------------------------------------------------------------------------
    // R1 — verdicts that explain themselves
    // ----------------------------------------------------------------------------------------

    /// What happened to one submission. Every case is a *fact*, not an accusation — a caller's
    /// oracle decides whether `SignerNotOnRoster` means "attempted forgery" or "stale roster"
    /// (`dual-use-detection-is-neutral-oracle-decides`).
    type SubmissionOutcome =
        /// Rostered signer, accepted scheme, signature verified against the rostered key.
        | SignatureVerified
        /// R3 — the signer is absent from *this* verifier's roster. Reported, never silently dropped.
        | SignerNotOnRoster
        /// R7 — the scheme is neither current nor inside the retiring window at this epoch.
        | SchemeNotAcceptedAtEpoch
        /// The scheme is accepted but no implementation of it was supplied to `verify`.
        | NoImplementationForScheme
        /// The signer is rostered, but not under this scheme (no key to check against).
        | NoRosteredKeyForScheme
        /// R5 — the cryptographic check ran and failed.
        | SignatureVerificationFailed

    /// One submission's finding. `Index` is the position in `AuthorizationRequest.Signatures` — a
    /// reference, so a caller can map the finding back without the verdict carrying bytes (R10).
    type SubmissionReport =
        { Index: int
          Signer: SignerId
          Scheme: SchemeId
          Outcome: SubmissionOutcome }

    /// Why a request was denied. Specific findings are listed **before** the count shortfall, so
    /// `List.head` is the most informative reason (acceptance criterion 2 asks that a forged
    /// signature be reported as a verification failure rather than as an insufficient count).
    type DenialReason =
        | InvalidSignaturesPresent of signers: SignerId list
        | UnknownSignersPresent of signers: SignerId list
        | DuplicateSignersPresent of signers: SignerId list
        | UnacceptedSchemesPresent of schemes: SchemeId list
        | InsufficientVerifiedSigners of required: int * verified: int

    type Decision =
        | Authorized
        | Denied of DenialReason list

    /// The verdict. Identities, counts and indices only — no key material, no signature bytes (R10).
    type Verdict =
        { Decision: Decision
          Threshold: int
          /// Distinct signers that contributed, ordinal-sorted.
          VerifiedSigners: SignerId list
          /// R3 — signers submitted but absent from this verifier's roster, ordinal-sorted.
          UnknownSigners: SignerId list
          /// R4 — signers that submitted more than once, ordinal-sorted. They contribute **once**.
          DuplicateSigners: SignerId list
          /// R5 — signers at least one of whose submissions failed the cryptographic check.
          InvalidSignatureSigners: SignerId list
          /// R7 — schemes offered that this verifier does not accept at this epoch.
          UnacceptedSchemes: SchemeId list
          /// Per-submission findings, in the order the submissions were supplied.
          Submissions: SubmissionReport list }

    /// R8 — a configuration that could never authorize is an error, not a permanent silent deny.
    type ConfigError =
        | EmptyRoster
        | ThresholdBelowOne of threshold: int
        | ThresholdExceedsRosterSize of threshold: int * rosterSize: int
        | DuplicateRosterEntry of signer: SignerId * scheme: SchemeId
        | RetiringSchemeIsCurrentScheme of scheme: SchemeId
        | RetiringWindowInverted of scheme: SchemeId * first: Epoch * last: Epoch
        | NoImplementationForCurrentScheme of scheme: SchemeId
        | DuplicateSchemeImplementation of scheme: SchemeId
        /// Fewer signers hold a key under an *ever*-acceptable scheme than the threshold requires,
        /// so no epoch and no set of submissions could ever reach it.
        | RosterCannotReachThreshold of usableSigners: int * threshold: int

    // ----------------------------------------------------------------------------------------
    // Ordering helpers — ordinal, never culture-sensitive
    // ----------------------------------------------------------------------------------------

    let private sortSigners (xs: SignerId list) : SignerId list =
        xs
        |> List.distinct
        |> List.sortWith (fun (SignerId a) (SignerId b) -> String.CompareOrdinal(a, b))

    let private sortSchemes (xs: SchemeId list) : SchemeId list =
        xs
        |> List.distinct
        |> List.sortWith (fun (SchemeId a) (SchemeId b) -> String.CompareOrdinal(a, b))

    // ----------------------------------------------------------------------------------------
    // R8 — configuration validation
    // ----------------------------------------------------------------------------------------

    /// Distinct signers on the roster. A signer listed under two schemes is **one** roster member,
    /// so the R8 upper bound on the threshold is a count of *people*, not of key bindings.
    let rosterSize (v: Verifier) : int =
        v.Roster |> List.map (fun e -> e.Signer) |> List.distinct |> List.length

    let private firstDuplicateEntry (v: Verifier) : (SignerId * SchemeId) option =
        v.Roster
        |> List.map (fun e -> e.Signer, e.Scheme)
        |> List.countBy id
        |> List.tryPick (fun (k, n) -> if n > 1 then Some k else None)

    let private firstDuplicateScheme (schemes: ISignatureScheme list) : SchemeId option =
        schemes
        |> List.map (fun s -> s.Scheme)
        |> List.countBy id
        |> List.tryPick (fun (k, n) -> if n > 1 then Some k else None)

    /// Schemes this verifier could accept at *some* epoch — the current one, plus the retiring one
    /// if a window is configured.
    let private everAcceptableSchemes (v: Verifier) : SchemeId list =
        match v.Policy.Retiring with
        | None -> [ v.Policy.Current ]
        | Some r -> [ v.Policy.Current; r.Scheme ]

    /// Validate a verifier against the supplied algorithm set. Pure; no state is retained.
    let validate (schemes: ISignatureScheme list) (v: Verifier) : Result<unit, ConfigError> =
        let acceptable = everAcceptableSchemes v |> Set.ofList

        let usableSigners =
            v.Roster
            |> List.filter (fun e -> Set.contains e.Scheme acceptable)
            |> List.map (fun e -> e.Signer)
            |> List.distinct
            |> List.length

        if List.isEmpty v.Roster then Error EmptyRoster
        elif v.Threshold < 1 then
            Error(ThresholdBelowOne v.Threshold)
        elif v.Threshold > rosterSize v then
            Error(ThresholdExceedsRosterSize(v.Threshold, rosterSize v))
        else
            match firstDuplicateEntry v with
            | Some(s, sc) -> Error(DuplicateRosterEntry(s, sc))
            | None ->
                match firstDuplicateScheme schemes with
                | Some sc -> Error(DuplicateSchemeImplementation sc)
                | None ->
                    let hasImpl id = schemes |> List.exists (fun s -> s.Scheme = id)

                    match v.Policy.Retiring with
                    | Some r when r.Scheme = v.Policy.Current -> Error(RetiringSchemeIsCurrentScheme r.Scheme)
                    | Some r when r.LastEpoch < r.FirstEpoch ->
                        Error(RetiringWindowInverted(r.Scheme, r.FirstEpoch, r.LastEpoch))
                    | _ ->
                        if not (hasImpl v.Policy.Current) then
                            Error(NoImplementationForCurrentScheme v.Policy.Current)
                        elif usableSigners < v.Threshold then
                            Error(RosterCannotReachThreshold(usableSigners, v.Threshold))
                        else
                            Ok()

    // ----------------------------------------------------------------------------------------
    // R7 — which schemes are live at an epoch
    // ----------------------------------------------------------------------------------------

    /// The schemes this verifier accepts **at this epoch**: the current one always, plus the
    /// retiring one while `FirstEpoch <= epoch <= LastEpoch` (both endpoints inclusive).
    let acceptedSchemesAt (policy: SchemePolicy) (epoch: Epoch) : SchemeId list =
        match policy.Retiring with
        | Some r when epoch >= r.FirstEpoch && epoch <= r.LastEpoch -> [ policy.Current; r.Scheme ]
        | _ -> [ policy.Current ]

    // ----------------------------------------------------------------------------------------
    // The verifier
    // ----------------------------------------------------------------------------------------

    /// Verify a request from **this** verifier's perspective.
    ///
    /// Pure in (schemes, verifier, request) — same inputs, same verdict, on any machine (R9). The
    /// order of `schemes`, of `verifier.Roster`, and of `request.Signatures` does not change the
    /// `Decision` or any of the ordinal-sorted signer/scheme lists; only `Verdict.Submissions`
    /// follows the input order, because its `Index` field refers back to it.
    let verify
        (schemes: ISignatureScheme list)
        (v: Verifier)
        (request: AuthorizationRequest)
        : Result<Verdict, ConfigError> =
        match validate schemes v with
        | Error e -> Error e
        | Ok() ->

        let message = canonicalMessage request.Scope request.Payload
        let accepted = acceptedSchemesAt v.Policy request.Epoch |> Set.ofList
        let rosterSigners = v.Roster |> List.map (fun e -> e.Signer) |> Set.ofList

        let keyOf (signer: SignerId) (scheme: SchemeId) =
            v.Roster
            |> List.tryPick (fun e -> if e.Signer = signer && e.Scheme = scheme then Some e.PublicKey else None)

        let implOf (scheme: SchemeId) =
            schemes |> List.tryFind (fun s -> s.Scheme = scheme)

        // Check order is fixed and documented: roster membership first (R3 is the strongest
        // "report distinctly" requirement), then scheme acceptance, then implementation
        // availability, then key availability, then the cryptographic check.
        let outcomeOf (sub: SubmittedSignature) : SubmissionOutcome =
            if not (Set.contains sub.Signer rosterSigners) then
                SignerNotOnRoster
            elif not (Set.contains sub.Scheme accepted) then
                SchemeNotAcceptedAtEpoch
            else
                match implOf sub.Scheme with
                | None -> NoImplementationForScheme
                | Some impl ->
                    match keyOf sub.Signer sub.Scheme with
                    | None -> NoRosteredKeyForScheme
                    | Some pk ->
                        if impl.Verify(pk, message, sub.Signature) then
                            SignatureVerified
                        else
                            SignatureVerificationFailed

        let reports =
            request.Signatures
            |> List.mapi (fun i sub ->
                { Index = i
                  Signer = sub.Signer
                  Scheme = sub.Scheme
                  Outcome = outcomeOf sub })

        let signersWith outcome =
            reports |> List.filter (fun r -> r.Outcome = outcome) |> List.map (fun r -> r.Signer) |> sortSigners

        // R4 — one signer cannot be many: contribution is counted per DISTINCT signer, so a signer
        // that submits ten verifying signatures contributes exactly one. Repetition is reported.
        let verified = signersWith SignatureVerified

        let duplicates =
            request.Signatures
            |> List.map (fun s -> s.Signer)
            |> List.countBy id
            |> List.filter (fun (_, n) -> n > 1)
            |> List.map fst
            |> sortSigners

        let unknown = signersWith SignerNotOnRoster
        let invalid = signersWith SignatureVerificationFailed

        let unacceptedSchemes =
            reports
            |> List.filter (fun r -> r.Outcome = SchemeNotAcceptedAtEpoch)
            |> List.map (fun r -> r.Scheme)
            |> sortSchemes

        let count = List.length verified

        let decision =
            if count >= v.Threshold then
                Authorized
            else
                let reasons =
                    [ if not (List.isEmpty invalid) then
                          InvalidSignaturesPresent invalid
                      if not (List.isEmpty unknown) then
                          UnknownSignersPresent unknown
                      if not (List.isEmpty duplicates) then
                          DuplicateSignersPresent duplicates
                      if not (List.isEmpty unacceptedSchemes) then
                          UnacceptedSchemesPresent unacceptedSchemes
                      InsufficientVerifiedSigners(v.Threshold, count) ]

                Denied reasons

        Ok
            { Decision = decision
              Threshold = v.Threshold
              VerifiedSigners = verified
              UnknownSigners = unknown
              DuplicateSigners = duplicates
              InvalidSignatureSigners = invalid
              UnacceptedSchemes = unacceptedSchemes
              Submissions = reports }

    /// Convenience predicate. Kept separate from `verify` so that the *reasons* are never dropped
    /// accidentally — R1 exists precisely because a bare boolean teaches nothing.
    let isAuthorized (verdict: Verdict) : bool =
        match verdict.Decision with
        | Authorized -> true
        | Denied _ -> false


/// **Two implementations of the R6 port.** One is the platform's real ECDSA (no bespoke primitive
/// — an explicit spec non-goal); one is a deterministic test double, named `toy*` per
/// `.claude/rules/toy-is-free-metered-must-be-earned.md` so it can never be mistaken for security.
module ThresholdSchemes =

    open System
    open System.Security.Cryptography
    open System.Text
    open ThresholdVerification

    [<Literal>]
    let EcdsaP256Name = "ecdsa-p256-sha256"

    [<Literal>]
    let EcdsaP384Name = "ecdsa-p384-sha384"

    [<Literal>]
    let ToyDigestName = "toy-digest-sha256-v1"

    /// Fail-closed ECDSA verification over a SubjectPublicKeyInfo-encoded public key. Any malformed
    /// input is a `false` verdict, never an exception: the port is total by contract, and for a
    /// *verifier* "I could not make sense of this" and "this did not verify" are the same answer.
    let private ecdsaVerify (hash: HashAlgorithmName) (publicKey: byte[]) (message: byte[]) (signature: byte[]) =
        if isNull (box publicKey) || isNull (box message) || isNull (box signature) then
            false
        else
            try
                use alg = ECDsa.Create()
                let mutable read = 0
                alg.ImportSubjectPublicKeyInfo(ReadOnlySpan<byte>(publicKey), &read)
                alg.VerifyData(message, signature, hash)
            with _ ->
                false

    let private ecdsaScheme (name: string) (hash: HashAlgorithmName) : ISignatureScheme =
        { new ISignatureScheme with
            member _.Scheme = SchemeId name

            member _.Verify(publicKey, message, signature) =
                ecdsaVerify hash publicKey message signature }

    /// Platform ECDSA P-256 / SHA-256.
    let ecdsaP256: ISignatureScheme =
        ecdsaScheme EcdsaP256Name HashAlgorithmName.SHA256

    /// Platform ECDSA P-384 / SHA-384 — a genuinely different scheme behind the same port.
    let ecdsaP384: ISignatureScheme =
        ecdsaScheme EcdsaP384Name HashAlgorithmName.SHA384

    /// **TOY.** The "signature" is `SHA-256(tag ‖ len(key) ‖ key ‖ message)`. It is deterministic
    /// and it discriminates (any bit change in key, scope, payload or signature fails), which is
    /// all a test double must do. It is *not* secret-keyed and therefore forgeable by anyone: it
    /// must never be used to protect anything.
    let toyDigestSignature (publicKey: byte[]) (message: byte[]) : byte[] =
        let tag = Encoding.UTF8.GetBytes(ToyDigestName)
        let n = publicKey.Length

        let prefix =
            [| byte ((n >>> 24) &&& 0xFF)
               byte ((n >>> 16) &&& 0xFF)
               byte ((n >>> 8) &&& 0xFF)
               byte (n &&& 0xFF) |]

        SHA256.HashData(Array.concat [ tag; prefix; publicKey; message ])

    /// The toy scheme behind the R6 port.
    let toyDigest: ISignatureScheme =
        { new ISignatureScheme with
            member _.Scheme = SchemeId ToyDigestName

            member _.Verify(publicKey, message, signature) =
                if isNull (box publicKey) || isNull (box message) || isNull (box signature) then
                    false
                else
                    let expected = toyDigestSignature publicKey message

                    CryptographicOperations.FixedTimeEquals(
                        ReadOnlySpan<byte>(signature),
                        ReadOnlySpan<byte>(expected)
                    ) }
