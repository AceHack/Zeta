namespace Zeta.Core

/// **k-of-n MULTI-signature verification.**
///
/// `B1` — this module was called "threshold signature verification" and that name was **wrong**.
/// "Threshold signature" is the term of art for the Desmedt–Frankel / Shamir construction: an
/// *aggregated single signature* verified against *one group key*. What this does — count distinct
/// signers, de-duplicate submissions, report unknown ones — is only meaningful for **k-of-n
/// multi-signature**, where each party signs separately.
///
/// The N=3 run caught it: all three derivations built multi-signature because the requirements
/// forced it, so the spec was internally coherent and externally misnamed. **A cryptographer
/// reading only the old title would have built the wrong primitive.**
///
/// Synthesised from derivation A, with amendments B1–B9 from the combine applied.
///
/// Answers one question: *from the perspective of ONE verifying party, did at least `Threshold`
/// distinct signers on THAT party's roster produce a cryptographically valid signature over this
/// request's scope and payload, under a signature scheme that party currently accepts?*
///
/// The verdict is a value that explains itself: every submission that did **not** count says why,
/// in a discriminated union a caller can `match` on. Nothing secret ever enters a verdict — only
/// signer identities, scheme identifiers and counts.
///
/// **Purity.** `verify` is a total function of `(schemes, policy, request, epoch)`. No wall clock
/// (the migration window is compared against a caller-supplied *logical epoch*), no I/O, no global
/// mutable state, no ambient configuration. Repeated invocation, and any permutation of the
/// submission list or roster insertion order, produce a structurally identical verdict.
///
/// **The algorithm is a port, not a choice** (`ISignatureScheme`). No function in this module names
/// a concrete algorithm; the caller supplies the implementations it is willing to run. Two
/// implementations ship in `Schemes`: a platform ECDSA one and an explicitly-`toy` test double.
///
/// Anchors (Beacon): Desmedt & Frankel, *Threshold cryptosystems* (CRYPTO '89) — the k-of-n
/// authorization shape; Shamir, *How to share a secret* (CACM 1979) — the threshold idea itself;
/// Douceur, *The Sybil Attack* (2002) — why an off-roster identity must never contribute to a
/// count; Goguen & Meseguer (1982) noninterference — why the clock is a parameter and not ambient.
/// Note this module verifies a **multi-signature over a shared roster** (n independent signatures,
/// k required), *not* a single aggregated threshold signature; that distinction is deliberate — see
/// the derivation report.
module MultiSignatureVerification =

    open System
    open System.Security.Cryptography

    // ---------------------------------------------------------------------------------------------
    // Identities and scheme tags
    // ---------------------------------------------------------------------------------------------

    /// A signer's identity as the verifying party knows it. Compared **ordinally** (F# structural
    /// comparison on `string` is `String.CompareOrdinal`), never culture-sensitively.
    [<Struct>]
    type SignerId =
        | SignerId of string

        /// The underlying identity string. Safe to surface: it is caller-supplied, never key material.
        member this.Value = let (SignerId v) = this in v

    /// The tag of a signature scheme (algorithm + parameters + encoding), e.g. a URN a deployment
    /// agrees on. Opaque to this module and compared ordinally.
    [<Struct>]
    type SchemeId =
        | SchemeId of string

        /// The underlying tag string.
        member this.Value = let (SchemeId v) = this in v

    /// A public key *as the scheme in question encodes it*, tagged with that scheme. Public keys are
    /// not secret, but they are still never echoed into a verdict — see `Verdict`.
    type PublicKey =
        { /// The scheme this key material is an input to.
          Scheme: SchemeId
          /// Scheme-defined encoding of the public key.
          Material: byte[] }

    // ---------------------------------------------------------------------------------------------
    // R6 — the port
    // ---------------------------------------------------------------------------------------------

    /// Why a scheme implementation could not *reach* a yes/no answer. Distinct from "the signature
    /// did not verify": a malformed key is an input defect, not a forgery. Carries no material.
    type SchemeFault =
        /// The public-key bytes were not a well-formed key for this scheme.
        | MalformedPublicKey
        /// The signature bytes were not a well-formed signature for this scheme.
        | MalformedSignature

    /// **The port (R6).** A signature scheme is an interface, never a hard-coded choice: a
    /// post-quantum migration must be expressible by supplying a different implementation, with no
    /// change at any call site. Implementations MUST be stateless and deterministic.
    /// `B7` — **the port's contract, and R9's purity guarantee extends THROUGH it, not up to it.**
    ///
    /// All three N=3 derivations independently declared R9 (`verify` is a pure function) `partial`,
    /// and one named the reason: the original port permitted an adapter that read a clock or did
    /// I/O, so R9 was **unachievable through a conforming implementation** — a hole in the port's
    /// design rather than in anyone's tests. An implementation of this interface therefore MUST be:
    ///
    /// * **pure** — no clock, no I/O, no global mutable state, no randomness. The same
    ///   `(publicKey, message, signature)` yields the same answer on every machine, forever.
    /// * **total** — it MUST NOT throw. A fault is a *returned value* (`Error SchemeFault`), never
    ///   an exception.
    ///
    /// `verify` deliberately does **not** wrap adapters in `try/with`. Catching here would turn an
    /// adapter bug into a silent per-submission denial — a verifier that quietly stops authorizing
    /// while every test still passes. A throwing adapter is a defect that must surface loudly.
    type ISignatureScheme =
        /// The tag this implementation answers to. Two implementations in one registry must not
        /// share an `Id`.
        abstract Id: SchemeId

        /// `true` iff `signature` is a valid signature by `publicKey` over exactly `message`.
        /// Returns `Error` only when an input could not be interpreted at all; a signature that is
        /// well-formed but wrong is `Ok false`, never an error.
        abstract Verify: publicKey: byte[] * message: byte[] * signature: byte[] -> Result<bool, SchemeFault>

    // ---------------------------------------------------------------------------------------------
    // Requests and the canonical signed bytes
    // ---------------------------------------------------------------------------------------------

    /// One signer's submitted signature. `Scheme` states which implementation the bytes are under —
    /// it is *asserted by the submitter* and therefore checked against the verifier's accepted set.
    type SignatureSubmission =
        { /// Who claims to have signed.
          Signer: SignerId
          /// Which scheme the bytes are under, as claimed by the submitter.
          Scheme: SchemeId
          /// The signature bytes, in that scheme's encoding.
          Signature: byte[] }

    /// The thing being authorized: a scope (what class of action) plus a payload (the specifics),
    /// together with the signatures submitted for it.
    type Request =
        { /// What is being authorized — the domain of the request.
          Scope: string
          /// The request's specifics; opaque bytes to this module.
          Payload: byte[]
          /// Submitted signatures, in any order. Order does not affect the verdict.
          Submissions: SignatureSubmission list }

    /// Domain-separation tag prefixed to every signed message so that a signature produced for a
    /// Zeta threshold request can never be replayed as a signature for anything else.
    [<Literal>]
    /// `B2` — the domain tag is FIXED by the amended spec, not chosen per implementation. The N=3
    /// run produced three different encodings from three correct readings, so no two derivations
    /// could verify each other while every derivation's own tests passed.
    ///
    /// Domain separation is REQUIRED, not merely nice: length-prefixing alone gives injectivity —
    /// which is all the original rationale argued for, and is why one derivation correctly omitted
    /// the tag — but injectivity does not prevent **cross-protocol reuse**, a signature valid in
    /// another Zeta context being replayed into this one.
    let SigningDomain = "zeta.multisig.v1"

    /// The canonical byte string a signer signs: `domain ‖ len(scope) ‖ scope ‖ len(payload) ‖ payload`
    /// with UTF-8 scope bytes and 4-byte **big-endian, unsigned** length prefixes (`B2` fixes the wire
    /// order; endian-explicit so the bytes are identical on every machine, per `R9`). Length prefixing
    /// makes the encoding injective — no two distinct `(scope, payload)` pairs share signed bytes, so
    /// a signature cannot be moved from one request to another by re-splitting the boundary.
    let signingBytes (scope: string) (payload: byte[]) : byte[] =
        let domain = Text.Encoding.UTF8.GetBytes SigningDomain
        let scopeBytes = Text.Encoding.UTF8.GetBytes scope
        let payload = if isNull (box payload) then Array.empty else payload
        // `B2` — 4-byte BIG-endian, written explicitly rather than via BitConverter. A host-endian
        // call with a swap guard is correct but reads as if it could vary; the spec now fixes the
        // wire order, so the code states it directly and cannot drift with the platform.
        let len (n: int) =
            let u = uint32 n
            [| byte ((u >>> 24) &&& 0xFFu)
               byte ((u >>> 16) &&& 0xFFu)
               byte ((u >>> 8) &&& 0xFFu)
               byte (u &&& 0xFFu) |]
        Array.concat [ domain; len scopeBytes.Length; scopeBytes; len payload.Length; payload ]

    // ---------------------------------------------------------------------------------------------
    // R2 / R7 / R8 — the verifying party's own policy
    // ---------------------------------------------------------------------------------------------

    /// Whether a scheme is the one a verifier wants used going forward, or one it still tolerates
    /// while the network migrates.
    type SchemeStatus =
        /// Accepted at every epoch.
        | Current
        /// `B9` — **HALF-OPEN**: accepted while `epoch < FirstRejectedEpoch`, matching `PhaseWindow`
        /// in `KeyCustody`. Inclusive vs half-open diverges at exactly one epoch, silently, mid-cutover,
        /// and no implementation's own tests can catch the difference — so the spec pins it and the
        /// field is named for the first REJECTED epoch rather than the last accepted one, which makes
        /// the boundary unambiguous at the call site.
        ///
        /// `B3` — the window is **ADVISORY, not enforcing**. Nothing in the signed material commits to
        /// a time, so this bounds what THIS verifier chooses to accept; it cannot bind a signer and it
        /// does not prevent a retired-scheme signature from existing. The epoch is supplied by the
        /// verifier and never read from the request — taking it from the request would be a downgrade
        /// attack, since the adversary would choose the value that admits their own signature.
        /// The bound lives **in the data**; nothing
        /// about the window is implied by code or by a clock.
        | Retiring of firstRejectedEpoch: int64

    /// One row of a verifier's accepted-algorithm set.
    type SchemePolicy =
        { /// The scheme tag.
          Scheme: SchemeId
          /// Current, or retiring with an explicit last accepted epoch.
          Status: SchemeStatus }

    /// **A verifying party's own trust configuration (R2).** There is no global roster: a verdict is
    /// always *this party's* verdict, and two parties holding different policies may legitimately
    /// disagree about the identical request.
    type VerifierPolicy =
        { /// Signer → the public keys this party accepts for that signer, at most one per scheme.
          Roster: Map<SignerId, PublicKey list>
          /// How many **distinct rostered signers** must produce a valid signature.
          Threshold: int
          /// The schemes this party will run, and each one's migration status.
          AcceptedSchemes: SchemePolicy list }

    /// A policy that could never authorize anything, or that is internally contradictory. Reported as
    /// a configuration error rather than as a permanent silent denial (R8).
    type ConfigError =
        /// `Threshold < 1`: a gate that authorizes with zero consent is not a gate.
        | ThresholdBelowOne of threshold: int
        /// `Threshold > |roster|`: unsatisfiable no matter who signs.
        | ThresholdExceedsRosterSize of threshold: int * rosterSize: int
        /// `B8` — the threshold exceeds the number of signers who could ever contribute. A rostered
        /// signer holding no key under any ACCEPTED scheme can never produce a countable signature,
        /// so a policy may pass every other check and still be unable to authorize. Rejecting only
        /// `threshold > rosterSize` misses this: the roster is large enough and the eligible subset
        /// is not.
        | ThresholdExceedsEligibleSigners of threshold: int * eligible: int
        /// No signer is rostered, so nothing can ever count.
        | EmptyRoster
        /// No scheme is accepted, so no signature can ever be checked.
        | NoAcceptedSchemes
        /// The same scheme tag appears twice in `AcceptedSchemes` with conflicting status.
        | DuplicateSchemePolicy of scheme: SchemeId
        /// A rostered signer holds two keys for the same scheme — which key is authoritative is undefined.
        | AmbiguousKeyForSigner of signer: SignerId * scheme: SchemeId
        /// The policy accepts a scheme for which the caller supplied no implementation. Verification
        /// would silently reject every signature under it, which is exactly the silent-denial R8 forbids.
        | UnimplementedScheme of scheme: SchemeId
        /// Two supplied implementations answer to the same `Id`; which one runs would be arbitrary.
        | DuplicateSchemeImplementation of scheme: SchemeId

    // ---------------------------------------------------------------------------------------------
    // R1 — the verdict explains itself
    // ---------------------------------------------------------------------------------------------

    /// Why a signer did not contribute to the count. Ordered as a DU so a caller may `match`; the
    /// cases are mutually exclusive per signer *per submission*, and a signer's reasons are reported
    /// as a sorted, de-duplicated set.
    type RejectReason =
        /// **R3** — the identity is absent from *this* verifier's roster. Reported, never silently dropped.
        | NotOnRoster
        /// The submitter named a scheme this verifier does not accept at all.
        | SchemeNotAccepted of scheme: SchemeId
        /// **R7** — the scheme is accepted but retiring, and the supplied epoch is past its window.
        | RetiringSchemeExpired of scheme: SchemeId * firstRejectedEpoch: int64
        /// The signer is rostered but holds no key for the scheme they signed under.
        | NoKeyForScheme of scheme: SchemeId
        /// **R5** — the bytes are well-formed and did not verify against the rostered key.
        | SignatureDidNotVerify
        /// The scheme implementation could not interpret an input. Not the same as a failed verification.
        | InputRejectedByScheme of fault: SchemeFault

    /// The self-explaining result of one verifying party's evaluation of one request.
    ///
    /// Every list is **sorted and de-duplicated** so the verdict is invariant under permutation of the
    /// submissions (R9). Nothing here is secret: identities, scheme tags, epochs and counts only (R10).
    type Verdict =
        { /// `CountedSigners.Length >= Threshold`.
          Authorized: bool
          /// The threshold this verdict was measured against — restated so the verdict is self-contained.
          Threshold: int
          /// Distinct rostered signers with at least one valid, in-window signature. Sorted ordinally.
          CountedSigners: SignerId list
          /// **R4** — signers who submitted more than once. Each counts once; the surplus is reported here.
          DuplicateSigners: SignerId list
          /// Why each non-counting signer did not count. Sorted by signer; reasons sorted and distinct.
          Rejections: (SignerId * RejectReason list) list }

        /// How many distinct signers counted.
        member this.CountedTotal = List.length this.CountedSigners

    // ---------------------------------------------------------------------------------------------
    // Policy validation (R8)
    // ---------------------------------------------------------------------------------------------

    /// Check a verifying party's policy against the supplied implementations. Returns the first error
    /// in a fixed inspection order, so the result is deterministic.
    let validate (schemes: ISignatureScheme list) (policy: VerifierPolicy) : Result<unit, ConfigError> =
        let implDuplicate =
            schemes
            |> List.countBy (fun s -> s.Id)
            |> List.filter (fun (_, n) -> n > 1)
            |> List.map fst
            |> List.sort
            |> List.tryHead
        let policyDuplicate =
            policy.AcceptedSchemes
            |> List.countBy (fun p -> p.Scheme)
            |> List.filter (fun (_, n) -> n > 1)
            |> List.map fst
            |> List.sort
            |> List.tryHead
        let implemented = schemes |> List.map (fun s -> s.Id) |> Set.ofList
        let unimplemented =
            policy.AcceptedSchemes
            |> List.map (fun p -> p.Scheme)
            |> List.filter (fun id -> not (Set.contains id implemented))
            |> List.sort
            |> List.tryHead
        let ambiguousKey =
            policy.Roster
            |> Map.toList
            |> List.collect (fun (signer, keys) ->
                keys
                |> List.countBy (fun k -> k.Scheme)
                |> List.filter (fun (_, n) -> n > 1)
                |> List.map (fun (scheme, _) -> signer, scheme))
            |> List.sort
            |> List.tryHead
        match implDuplicate, policyDuplicate, unimplemented, ambiguousKey with
        | Some s, _, _, _ -> Error(DuplicateSchemeImplementation s)
        | _, Some s, _, _ -> Error(DuplicateSchemePolicy s)
        | _, _, Some s, _ -> Error(UnimplementedScheme s)
        | _, _, _, Some(signer, scheme) -> Error(AmbiguousKeyForSigner(signer, scheme))
        | None, None, None, None ->
            let rosterSize = Map.count policy.Roster
            if List.isEmpty policy.AcceptedSchemes then Error NoAcceptedSchemes
            elif rosterSize = 0 then Error EmptyRoster
            elif policy.Threshold < 1 then Error(ThresholdBelowOne policy.Threshold)
            elif policy.Threshold > rosterSize then Error(ThresholdExceedsRosterSize(policy.Threshold, rosterSize))
            else
                // `B8` — a config that can NEVER authorize is an error, not a silent permanent denial.
                // Eligibility is per-signer: at least one key under a scheme this verifier accepts.
                let accepted = policy.AcceptedSchemes |> List.map (fun p -> p.Scheme) |> Set.ofList
                let eligible =
                    policy.Roster
                    |> Map.filter (fun _ keys -> keys |> List.exists (fun k -> Set.contains k.Scheme accepted))
                    |> Map.count
                if policy.Threshold > eligible then
                    Error(ThresholdExceedsEligibleSigners(policy.Threshold, eligible))
                else
                    Ok()

    // ---------------------------------------------------------------------------------------------
    // Verification (R5, R9)
    // ---------------------------------------------------------------------------------------------

    /// Outcome of evaluating a single submission, before per-signer aggregation.
    type private SubmissionOutcome =
        | Valid
        | Rejected of RejectReason

    let private evaluateSubmission
        (implOf: Map<SchemeId, ISignatureScheme>)
        (statusOf: Map<SchemeId, SchemeStatus>)
        (roster: Map<SignerId, PublicKey list>)
        (message: byte[])
        (epoch: int64)
        (sub: SignatureSubmission)
        : SubmissionOutcome =
        match Map.tryFind sub.Signer roster with
        | None -> Rejected NotOnRoster
        | Some keys ->
            match Map.tryFind sub.Scheme statusOf with
            | None -> Rejected(SchemeNotAccepted sub.Scheme)
            | Some(Retiring firstRejected) when epoch >= firstRejected ->
                Rejected(RetiringSchemeExpired(sub.Scheme, firstRejected))
            | Some _ ->
                match keys |> List.tryFind (fun k -> k.Scheme = sub.Scheme) with
                | None -> Rejected(NoKeyForScheme sub.Scheme)
                | Some key ->
                    // `validate` has already established that every accepted scheme has an implementation.
                    match Map.tryFind sub.Scheme implOf with
                    | None -> Rejected(SchemeNotAccepted sub.Scheme)
                    | Some impl ->
                        let signature = if isNull (box sub.Signature) then Array.empty else sub.Signature
                        match impl.Verify(key.Material, message, signature) with
                        | Ok true -> Valid
                        | Ok false -> Rejected SignatureDidNotVerify
                        | Error fault -> Rejected(InputRejectedByScheme fault)

    /// **Verify a request from one party's perspective.**
    ///
    /// `schemes` are the implementations the caller is willing to run; `policy` is *this* party's
    /// roster / threshold / accepted-scheme set; `epoch` is the caller-supplied logical time the
    /// migration windows are measured against (there is no clock in here).
    ///
    /// Returns `Error` only for a configuration defect (R8). A request that simply fails to muster
    /// enough consent is `Ok` with `Authorized = false` and reasons attached.
    let verify
        (schemes: ISignatureScheme list)
        (policy: VerifierPolicy)
        (request: Request)
        (epoch: int64)
        : Result<Verdict, ConfigError> =
        match validate schemes policy with
        | Error e -> Error e
        | Ok() ->
            let implOf = schemes |> List.map (fun s -> s.Id, s) |> Map.ofList
            let statusOf = policy.AcceptedSchemes |> List.map (fun p -> p.Scheme, p.Status) |> Map.ofList
            let message = signingBytes request.Scope request.Payload
            let evaluated =
                request.Submissions
                |> List.map (fun sub -> sub.Signer, evaluateSubmission implOf statusOf policy.Roster message epoch sub)
            // Aggregate per signer. Sorting by signer makes the verdict invariant under any permutation
            // of `Submissions` — the discriminating property behind acceptance criterion 7.
            let bySigner =
                evaluated
                |> List.groupBy fst
                |> List.map (fun (signer, rows) -> signer, rows |> List.map snd)
                |> List.sortBy fst
            let counted =
                bySigner
                |> List.filter (fun (_, outcomes) -> outcomes |> List.exists (fun o -> o = Valid))
                |> List.map fst
            let duplicates =
                bySigner
                |> List.filter (fun (_, outcomes) -> List.length outcomes > 1)
                |> List.map fst
            let rejections =
                bySigner
                |> List.filter (fun (_, outcomes) -> outcomes |> List.forall (fun o -> o <> Valid))
                |> List.map (fun (signer, outcomes) ->
                    let reasons =
                        outcomes
                        |> List.choose (function
                            | Rejected r -> Some r
                            | Valid -> None)
                        |> List.distinct
                        |> List.sort
                    signer, reasons)
            Ok
                { Authorized = List.length counted >= policy.Threshold
                  Threshold = policy.Threshold
                  CountedSigners = counted
                  DuplicateSigners = duplicates
                  Rejections = rejections }

    // ---------------------------------------------------------------------------------------------
    // R6 — two implementations of the port
    // ---------------------------------------------------------------------------------------------

    /// Signature-scheme implementations. Nothing outside this sub-module names an algorithm; callers
    /// pass a list of `ISignatureScheme` and the rest of the module is algorithm-blind.
    module Schemes =

        /// Tag of the platform ECDSA implementation below.
        let EcdsaP256Sha256Id = SchemeId "ecdsa-p256-sha256"

        /// Tag of the toy test double below.
        let ToyDigestId = SchemeId "toy-digest-sha256"

        /// **Platform ECDSA over NIST P-256 with SHA-256.** Public key material is a
        /// SubjectPublicKeyInfo (`ExportSubjectPublicKeyInfo`); signatures are IEEE-P1363 `r ‖ s`,
        /// which is what `ECDsa.SignData`/`VerifyData` use by default. No bespoke primitive: the
        /// arithmetic is entirely `System.Security.Cryptography`'s.
        let ecdsaP256Sha256: ISignatureScheme =
            { new ISignatureScheme with
                member _.Id = EcdsaP256Sha256Id

                member _.Verify(publicKey, message, signature) =
                    use ecdsa = ECDsa.Create()
                    let imported =
                        try
                            ecdsa.ImportSubjectPublicKeyInfo(ReadOnlySpan<byte>(publicKey)) |> ignore
                            true
                        with
                        // Deliberate: the platform reports malformed key material by throwing, and the
                        // house rule is that this path surfaces a `Result`, never an exception.
                        | :? CryptographicException -> false
                        | :? ArgumentException -> false
                    if not imported then
                        Error MalformedPublicKey
                    else
                        try
                            Ok(ecdsa.VerifyData(message, signature, HashAlgorithmName.SHA256))
                        with
                        | :? CryptographicException -> Error MalformedSignature
                        | :? ArgumentException -> Error MalformedSignature }

        /// **A TOY test double — not a signature scheme.** "Signing" is `SHA-256(key ‖ message)`, so
        /// the verifying key is also the signing key: anyone who can verify can forge. It exists only
        /// to demonstrate that the port (R6) admits a second implementation with no call-site change,
        /// and it is named `toy` so it can never be mistaken for a security claim
        /// (`.claude/rules/toy-is-free-metered-must-be-earned.md`).
        let toyDigest: ISignatureScheme =
            { new ISignatureScheme with
                member _.Id = ToyDigestId

                member _.Verify(publicKey, message, signature) =
                    if isNull (box publicKey) || publicKey.Length = 0 then
                        Error MalformedPublicKey
                    elif isNull (box signature) || signature.Length <> 32 then
                        Error MalformedSignature
                    else
                        let expected = SHA256.HashData(Array.append publicKey message)
                        Ok(CryptographicOperations.FixedTimeEquals(ReadOnlySpan<byte>(expected), ReadOnlySpan<byte>(signature))) }

        /// The bytes the toy double accepts for `key` over `scope`/`payload`. Present so tests (and
        /// only tests) can produce a valid toy signature without reaching into the implementation.
        let toyDigestSign (key: byte[]) (scope: string) (payload: byte[]) : byte[] =
            SHA256.HashData(Array.append key (signingBytes scope payload))
