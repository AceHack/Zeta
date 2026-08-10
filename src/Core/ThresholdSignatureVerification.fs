namespace Zeta.Core

/// **Threshold signature verification — from ONE verifier's point of view.**
///
/// Clean-room derivation B of `docs/specs/threshold-signature-verification-cleanroom-spec.md`.
/// The question this module answers is *not* "were enough names supplied" but "did enough
/// parties **this verifier trusts** actually sign **this** request, under a scheme **this
/// verifier accepts right now**".
///
/// Shape (and the requirement each shape discharges):
///
/// * There is **no global roster** (R2). A `Verifier` is a value; two verifiers may disagree on
///   the identical request and both be right.
/// * A verdict is a **structured** value (R1): a `Decision` plus a per-submission
///   `SubmissionOutcome` list, so a caller can `match` on why — never a free-form string.
/// * The signature algorithm is a **port** (R6), `ISignatureScheme`. Nothing in this file names
///   a concrete algorithm; the adapters live in `ThresholdSignatureSchemes.fs` and are chosen at
///   a composition root.
/// * Verification is **pure** (R9): no clock, no I/O, no mutable global. The logical time used
///   to evaluate a migration window is an explicit `Epoch` parameter (house rule: "no
///   wall-clock — if you need time, take it as a parameter").
/// * Nothing secret is returned (R10): outcomes carry identities, scheme ids and counts only.
///
/// Beacon anchors: Shamir, *How to share a secret* (CACM 1979) and Desmedt–Frankel,
/// *Threshold cryptosystems* (CRYPTO '89) for the k-of-n idea; Blaze–Feigenbaum–Lacy,
/// *Decentralized Trust Management* (IEEE S&P 1996) for "trust is per-principal, not global",
/// which is what R2 is; Wagner–Schneier's protocol-analysis line for why the signed message
/// must be **unambiguously framed** rather than concatenated (see `canonicalMessage`).
module ThresholdSignatureVerification =

    open System

    // ------------------------------------------------------------------ identifiers

    /// Identifier of a signature *scheme* (an opaque tag, never an algorithm this module knows).
    /// String comparison is F# structural comparison over strings, which is ordinal.
    type SchemeId = SchemeId of string

    /// Identifier of a signing party.
    type SignerId = SignerId of string

    /// Identifier of a verifying party — carried on the verdict so two verifiers' verdicts on
    /// the same request are distinguishable (R2).
    type VerifierId = VerifierId of string

    /// Logical time. NOT a wall-clock: an integer the caller supplies, so verification stays a
    /// pure function (R9) while still being able to bound a migration window (R7).
    type Epoch = Epoch of int64

    // ------------------------------------------------------------------ the request

    /// What is being authorized. `PayloadHex` is lowercase/uppercase hex (text — see
    /// `.claude/rules/no-binary-in-proof-lineage.md`); the bytes signed are derived from
    /// `Scope` + payload by `canonicalMessage`.
    type Request = { Scope: string; PayloadHex: string }

    /// One party's claim: "I, `Signer`, signed this request under `Scheme`".
    type Submission =
        { Signer: SignerId
          Scheme: SchemeId
          SignatureHex: string }

    // ------------------------------------------------------------------ the port (R6)

    /// Why a scheme could not even evaluate a submission — distinct from "evaluated, and the
    /// signature is bad". Typed rather than a string so nothing an adapter knows (key bytes,
    /// provider messages) can leak into a verdict (R1 + R10).
    type SchemeInputFault =
        | MalformedPublicKey
        | MalformedSignature
        | UnsupportedParameters

    /// **The signature-scheme port.** Implementations MUST be pure and MUST NOT throw: a bad
    /// key or a bad signature is `Error`, a well-formed-but-wrong signature is `Ok false`.
    /// (This module deliberately does not `try/with` around the call — swallowing an exception
    /// here would turn an adapter bug into a silent deny.)
    type ISignatureScheme =
        abstract Id: SchemeId
        abstract Verify: publicKey: byte[] * message: byte[] * signature: byte[] -> Result<bool, SchemeInputFault>

    // ------------------------------------------------------------------ verifier configuration

    /// One signer as this verifier knows them: their public key **per scheme** (hex). Keys are
    /// per-scheme because during a migration window (R7) the same signer may present a
    /// signature under either the retiring or the current scheme.
    type RosterEntry =
        { Signer: SignerId
          Keys: (SchemeId * string) list }

    /// A scheme this verifier accepts, and the **bounded, stated-in-data** epoch window over
    /// which it accepts it (R7). `AcceptUntil = None` means "no retirement scheduled".
    /// Both bounds are **inclusive**.
    type SchemeAcceptance =
        { Scheme: SchemeId
          AcceptFrom: Epoch
          AcceptUntil: Epoch option }

    /// The unvalidated configuration a caller writes.
    type VerifierConfig =
        { Id: VerifierId
          Roster: RosterEntry list
          Threshold: int
          Accepted: SchemeAcceptance list }

    /// A configuration that could never authorize anything is an error, not a permanent silent
    /// deny (R8).
    type ConfigError =
        | EmptyRoster
        | DuplicateRosterEntry of SignerId
        | ThresholdBelowOne of threshold: int
        | ThresholdExceedsRoster of threshold: int * rosterSize: int
        | NoAcceptedSchemes
        | DuplicateSchemeAcceptance of SchemeId
        | EmptyAcceptanceWindow of SchemeId
        | UnboundedMigrationOverlap
        | MalformedKeyMaterial of SignerId * SchemeId
        | DuplicateKeyForScheme of SignerId * SchemeId
        | DuplicateSchemeImplementation of SchemeId

    /// A validated verifier. Fields are private: the only way to obtain one is `createVerifier`,
    /// so an out-of-bounds threshold cannot exist at all (R8).
    type Verifier =
        private
            { VId: VerifierId
              Roster: Map<SignerId, Map<SchemeId, byte[]>>
              Thresh: int
              Windows: Map<SchemeId, Epoch * Epoch option> }

    /// A validated set of scheme implementations. Built once at a composition root; call sites
    /// pass it around without naming any algorithm (R6).
    type SchemeRegistry = private { Impls: Map<SchemeId, ISignatureScheme> }

    // ------------------------------------------------------------------ hex (text, not bytes)

    let private isHexDigit (c: char) =
        (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')

    /// Decode lowercase/uppercase hex, without exceptions on the path.
    let tryDecodeHex (s: string) : byte[] option =
        if isNull s || s.Length % 2 <> 0 || not (Seq.forall isHexDigit s) then
            None
        else
            Some(Convert.FromHexString(s))

    // ------------------------------------------------------------------ the signed message (R5)

    /// Why the request payload could not be read at all. Distinct from a verdict: there is no
    /// verdict to render if the request itself is unreadable.
    type RequestError = MalformedPayloadHex

    [<Literal>]
    let private DomainTag = "zeta.threshold-sig.v1"

    let private u32be (n: int) : byte[] =
        [| byte (n >>> 24); byte (n >>> 16); byte (n >>> 8); byte n |]

    /// **The bytes a signature must be over** (R5): a domain tag, then each field
    /// **length-prefixed**. Length framing, not concatenation: with `scope || payload` a signer
    /// who signs scope `"ab"` + payload `"c"` has also signed scope `"a"` + payload `"bc"`, so a
    /// naive concatenation lets an attacker move the boundary and re-scope a real signature.
    let canonicalMessage (request: Request) : Result<byte[], RequestError> =
        match tryDecodeHex request.PayloadHex with
        | None -> Error MalformedPayloadHex
        | Some payload ->
            let tag = Text.Encoding.UTF8.GetBytes(DomainTag)
            let scope = Text.Encoding.UTF8.GetBytes(request.Scope)

            Ok(Array.concat [ tag; u32be scope.Length; scope; u32be payload.Length; payload ])

    // ------------------------------------------------------------------ verdict (R1)

    /// What happened to ONE submission. Every failure class is its own case, so a caller can
    /// tell "I do not know you" from "your signature is wrong" from "that scheme is retired"
    /// without parsing prose (R1, R3, R4).
    type SubmissionOutcome =
        /// Verified, and this signer had not been counted yet.
        | Counted of SignerId
        /// This signer was already represented; counts once (R4).
        | DuplicateSubmission of SignerId
        /// Not on this verifier's roster — reported, never silently dropped (R3).
        | UnknownSigner of SignerId
        /// On the roster, but this verifier holds no key for them under that scheme.
        | NoKeyForScheme of SignerId * SchemeId
        /// The scheme is outside this verifier's acceptance window at this epoch (R7).
        | SchemeNotAccepted of SignerId * SchemeId
        /// The scheme is accepted, but no implementation was supplied in the registry.
        | SchemeUnavailable of SignerId * SchemeId
        /// The scheme evaluated the signature and it is not a signature by that key over
        /// that message (R5).
        | SignatureInvalid of SignerId * SchemeId
        /// The scheme could not evaluate the inputs at all.
        | SchemeRejectedInput of SignerId * SchemeId * SchemeInputFault

    /// The single ranked cause of a denial. The full outcome list is always present too — this
    /// is a summary, not a replacement.
    type DenialReason =
        /// At least one submission failed cryptographic verification. Ranked first: a bad
        /// signature is evidence of an attempt, and must not be reported as "not enough".
        | SignatureVerificationFailed of failedCount: int
        /// At least one submission came from an identity this verifier does not know (R3).
        | UnknownSignersPresent of unknownCount: int
        /// At least one submission could not be evaluated for a scheme/key reason.
        | SchemeUnusable of affectedCount: int
        /// Enough *submissions* arrived, but they collapsed to too few distinct signers (R4).
        | DuplicateSubmissionsCollapsed of counted: int * duplicates: int * required: int
        /// Everything supplied was fine; there simply was not enough of it.
        | InsufficientValidSignatures of counted: int * required: int

    type Decision =
        | Authorized
        | Denied of DenialReason

    /// The verdict. Carries identities, scheme ids and counts — never key material, never a
    /// signature (R10).
    type Verdict =
        { Verifier: VerifierId
          Threshold: int
          CountedSigners: SignerId list
          Decision: Decision
          Outcomes: SubmissionOutcome list }

    // ------------------------------------------------------------------ construction (R8)

    let private validateRoster (entries: RosterEntry list) =
        let rec go acc (remaining: RosterEntry list) =
            match remaining with
            | [] -> Ok acc
            | e :: rest ->
                if Map.containsKey e.Signer acc then
                    Error(DuplicateRosterEntry e.Signer)
                else
                    let rec keys km (ks: (SchemeId * string) list) =
                        match ks with
                        | [] -> Ok km
                        | (sid, hex) :: krest ->
                            if Map.containsKey sid km then
                                Error(DuplicateKeyForScheme(e.Signer, sid))
                            else
                                match tryDecodeHex hex with
                                | None -> Error(MalformedKeyMaterial(e.Signer, sid))
                                | Some bytes -> keys (Map.add sid bytes km) krest

                    match keys Map.empty e.Keys with
                    | Error err -> Error err
                    | Ok km -> go (Map.add e.Signer km acc) rest

        go Map.empty entries

    let private validateWindows (accepted: SchemeAcceptance list) =
        let rec go acc (remaining: SchemeAcceptance list) =
            match remaining with
            | [] -> Ok acc
            | a :: rest ->
                if Map.containsKey a.Scheme acc then
                    Error(DuplicateSchemeAcceptance a.Scheme)
                else
                    match a.AcceptUntil with
                    | Some until when until < a.AcceptFrom -> Error(EmptyAcceptanceWindow a.Scheme)
                    | _ -> go (Map.add a.Scheme (a.AcceptFrom, a.AcceptUntil) acc) rest

        go Map.empty accepted

    /// Validate a configuration into a `Verifier`, or say precisely why it can never authorize.
    let createVerifier (cfg: VerifierConfig) : Result<Verifier, ConfigError> =
        if List.isEmpty cfg.Roster then Error EmptyRoster
        elif List.isEmpty cfg.Accepted then Error NoAcceptedSchemes
        elif cfg.Threshold < 1 then Error(ThresholdBelowOne cfg.Threshold)
        else
            match validateRoster cfg.Roster with
            | Error e -> Error e
            | Ok roster ->
                if cfg.Threshold > roster.Count then
                    Error(ThresholdExceedsRoster(cfg.Threshold, roster.Count))
                else
                    match validateWindows cfg.Accepted with
                    | Error e -> Error e
                    | Ok windows ->
                        // R7 says the overlap window is bounded and stated in the data. Two
                        // permanently-open schemes state no window at all, so that is refused.
                        let bounded =
                            windows |> Map.exists (fun _ (_, until) -> Option.isSome until)

                        if windows.Count > 1 && not bounded then
                            Error UnboundedMigrationOverlap
                        else
                            Ok
                                { VId = cfg.Id
                                  Roster = roster
                                  Thresh = cfg.Threshold
                                  Windows = windows }

    /// Build the implementation registry. Two implementations claiming the same `SchemeId` is a
    /// configuration error, not a silent last-one-wins.
    let createRegistry (impls: ISignatureScheme list) : Result<SchemeRegistry, ConfigError> =
        let rec go acc (remaining: ISignatureScheme list) =
            match remaining with
            | [] -> Ok { Impls = acc }
            | i :: rest ->
                if Map.containsKey i.Id acc then
                    Error(DuplicateSchemeImplementation i.Id)
                else
                    go (Map.add i.Id i acc) rest

        go Map.empty impls

    /// This verifier's threshold (read-only accessor — `Verifier` is otherwise opaque).
    let thresholdOf (v: Verifier) = v.Thresh

    /// The signers on this verifier's roster, ordinal-sorted.
    let rosterOf (v: Verifier) =
        v.Roster |> Map.toList |> List.map fst |> List.sort

    /// Is `scheme` accepted by `v` at `epoch`? Both window bounds are inclusive (R7).
    let acceptsSchemeAt (v: Verifier) (Epoch e) (scheme: SchemeId) =
        match Map.tryFind scheme v.Windows with
        | None -> false
        | Some(Epoch from, until) ->
            e >= from
            && (match until with
                | None -> true
                | Some(Epoch u) -> e <= u)

    // ------------------------------------------------------------------ verification (R5/R9)

    /// Evaluate one submission in isolation — no knowledge of the other submissions, so this
    /// stays a pure function of (verifier, registry, epoch, message, submission).
    let private evaluate
        (v: Verifier)
        (reg: SchemeRegistry)
        (epoch: Epoch)
        (message: byte[])
        (s: Submission)
        : Result<unit, SubmissionOutcome> =
        match Map.tryFind s.Signer v.Roster with
        | None -> Error(UnknownSigner s.Signer)
        | Some keys ->
            if not (acceptsSchemeAt v epoch s.Scheme) then
                Error(SchemeNotAccepted(s.Signer, s.Scheme))
            else
                match Map.tryFind s.Scheme keys with
                | None -> Error(NoKeyForScheme(s.Signer, s.Scheme))
                | Some key ->
                    match Map.tryFind s.Scheme reg.Impls with
                    | None -> Error(SchemeUnavailable(s.Signer, s.Scheme))
                    | Some impl ->
                        match tryDecodeHex s.SignatureHex with
                        | None -> Error(SchemeRejectedInput(s.Signer, s.Scheme, MalformedSignature))
                        | Some sigBytes ->
                            match impl.Verify(key, message, sigBytes) with
                            | Error fault -> Error(SchemeRejectedInput(s.Signer, s.Scheme, fault))
                            | Ok false -> Error(SignatureInvalid(s.Signer, s.Scheme))
                            | Ok true -> Ok()

    /// Canonical submission order — ordinal on (signer, scheme, signature hex), lowercased so
    /// hex case cannot change the order. Makes the verdict a function of the *set* of
    /// submissions rather than of the order they arrived in (R9 / acceptance 7).
    let private canonicalKey (s: Submission) =
        let (SignerId sid) = s.Signer
        let (SchemeId sch) = s.Scheme
        (sid, sch, (if isNull s.SignatureHex then "" else s.SignatureHex.ToLowerInvariant()))

    let private denialReason (threshold: int) (outcomes: SubmissionOutcome list) (counted: int) =
        let count f = outcomes |> List.filter f |> List.length

        let verificationFailures =
            count (fun o ->
                match o with
                | SignatureInvalid _
                | SchemeRejectedInput(_, _, MalformedSignature) -> true
                | _ -> false)

        let unknown =
            count (fun o ->
                match o with
                | UnknownSigner _ -> true
                | _ -> false)

        let schemeUnusable =
            count (fun o ->
                match o with
                | NoKeyForScheme _
                | SchemeNotAccepted _
                | SchemeUnavailable _
                | SchemeRejectedInput(_, _, MalformedPublicKey)
                | SchemeRejectedInput(_, _, UnsupportedParameters) -> true
                | _ -> false)

        let duplicates =
            count (fun o ->
                match o with
                | DuplicateSubmission _ -> true
                | _ -> false)

        if verificationFailures > 0 then
            SignatureVerificationFailed verificationFailures
        elif unknown > 0 then
            UnknownSignersPresent unknown
        elif schemeUnusable > 0 then
            SchemeUnusable schemeUnusable
        elif duplicates > 0 && counted + duplicates >= threshold then
            DuplicateSubmissionsCollapsed(counted, duplicates, threshold)
        else
            InsufficientValidSignatures(counted, threshold)

    /// **The gate.** Pure: same (verifier, registry, epoch, request, submissions) ⇒ same verdict
    /// on any machine, in any submission order (R9).
    let verify
        (v: Verifier)
        (reg: SchemeRegistry)
        (epoch: Epoch)
        (request: Request)
        (submissions: Submission list)
        : Result<Verdict, RequestError> =
        match canonicalMessage request with
        | Error e -> Error e
        | Ok message ->
            let ordered = submissions |> List.sortBy canonicalKey

            let outcomes, countedSet =
                ordered
                |> List.fold
                    (fun (acc, counted) s ->
                        if Set.contains s.Signer counted then
                            (DuplicateSubmission s.Signer :: acc, counted)
                        else
                            match evaluate v reg epoch message s with
                            | Ok() -> (Counted s.Signer :: acc, Set.add s.Signer counted)
                            | Error outcome -> (outcome :: acc, counted))
                    ([], Set.empty)

            let outcomes = List.rev outcomes
            let countedSigners = countedSet |> Set.toList |> List.sort
            let n = List.length countedSigners

            let decision =
                if n >= v.Thresh then
                    Authorized
                else
                    Denied(denialReason v.Thresh outcomes n)

            Ok
                { Verifier = v.VId
                  Threshold = v.Thresh
                  CountedSigners = countedSigners
                  Decision = decision
                  Outcomes = outcomes }
