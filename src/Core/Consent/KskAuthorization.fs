module Zeta.Core.Consent.KskAuthorization

open Zeta.Core
open Zeta.Core.MultiSignatureVerification

/// # KSK override authorization — the emergency bypass of the consent gate
///
/// This is the highest-authority path in the system: it authorizes overriding a consent gate on a
/// kinetic safeguard. It is therefore the path an attacker most wants, and the one that must be
/// hardest to satisfy.
///
/// **What changed, and why it matters.** This module previously counted distinct rostered signers
/// and **verified no signatures at all** — the note in the source said verification was "deferred to
/// a follow-up slice". So the gate answered *"were enough distinct names supplied?"* rather than
/// *"did enough authorized parties consent?"*, and **any caller able to fabricate bytes passed**.
/// It now delegates every decision to `MultiSignatureVerification`, which was derived three times
/// independently under a clean-room wall and synthesised against the amended spec.
///
/// The types here remain KSK-shaped — a roster, a threshold, a scope — because that is the domain
/// vocabulary the callers speak. The *judgement* is no longer made here.
///
/// **Per-traveler rosters (`R2`/`R11`).** There is deliberately no global roster: each traveler
/// holds its own `Signers` set and decides for itself whom it trusts. Two travelers may reach
/// different verdicts on the identical request, and **both are correct**. A single mandatory roster
/// would be a hub — the same capture this substrate refuses everywhere else.

/// One signer this traveler trusts, and the key material it trusts them under. A signer may hold
/// keys under several schemes (during a migration); each is a separate entry.
type Signer =
    { Id: string
      /// Which signature scheme this key is an input to.
      Scheme: string
      PublicKey: byte[] }

/// The **evaluating traveler's own** trusted roster and policy.
type KskConfig =
    { Signers: Signer list
      Threshold: int
      Scope: string
      /// Schemes this traveler accepts, and whether each is current or retiring. Migration windows
      /// live HERE, on the verifier — never on a shared registry, which would recreate the cutover
      /// coordinator a decentralised system exists to deny.
      AcceptedSchemes: SchemePolicy list }

/// A request to exercise the override.
type KskAuthorizationRequest =
    { Scope: string
      /// What specifically is being authorized. Signed alongside the scope, so a signature for one
      /// override cannot be replayed onto another.
      Payload: byte[]
      /// `signerId * scheme * signature`.
      Signatures: (string * string * byte[]) list }

/// Result of the KSK check.
type KskCheckResult =
    | Authorized of signerCount: int * threshold: int
    | InsufficientSigners of provided: int * required: int
    | ScopeMismatch of requested: string * configured: string
    | DuplicateSigners of duplicates: string list
    /// Signers absent from this traveler's roster. Counting an unknown identity toward the threshold
    /// would let fabricated names authorize the highest-authority path in the system.
    | UnknownSigners of unknown: string list
    /// Signers whose submitted bytes are **not a valid signature** by their rostered key over this
    /// scope and payload. Previously unreachable, because nothing was verified.
    | InvalidSignatures of invalid: string list

/// Validates a KSK override **from one traveler's perspective**, against that traveler's own roster.
///
/// `epoch` is supplied by the **verifier** and never read from the request: taking it from the
/// request would be a downgrade attack, since the adversary would choose the value that admits their
/// own retired-scheme signature.
let checkKskAuthorization
    (schemes: ISignatureScheme list)
    (config: KskConfig)
    (req: KskAuthorizationRequest)
    (epoch: int64)
    : Result<KskCheckResult, string> =
    if req.Scope <> config.Scope then
        Ok(ScopeMismatch(req.Scope, config.Scope))
    else
        let roster =
            config.Signers
            |> List.groupBy (fun s -> SignerId s.Id)
            |> List.map (fun (id, entries) ->
                id, entries |> List.map (fun e -> { Scheme = SchemeId e.Scheme; Material = e.PublicKey }))
            |> Map.ofList

        let policy =
            { Roster = roster
              Threshold = config.Threshold
              AcceptedSchemes = config.AcceptedSchemes }

        let request =
            { Scope = req.Scope
              Payload = req.Payload
              Submissions =
                req.Signatures
                |> List.map (fun (id, scheme, signature) ->
                    { Signer = SignerId id
                      Scheme = SchemeId scheme
                      Signature = signature }) }

        match verify schemes policy request epoch with
        | Error configError -> Error(sprintf "KSK policy is not a valid configuration: %A" configError)
        | Ok verdict ->
            let name (SignerId s) = s
            // Classify the rejections so the caller keeps the KSK-shaped vocabulary. Order matters:
            // an unknown signer is a stronger signal than an invalid signature, and a duplicate is
            // reported even when the signer would otherwise have counted.
            let rejectedWith predicate =
                verdict.Rejections
                |> List.filter (fun (_, reasons) -> reasons |> List.exists predicate)
                |> List.map (fst >> name)

            let unknown =
                rejectedWith (function
                    | NotOnRoster -> true
                    | _ -> false)

            let invalid =
                rejectedWith (function
                    | SignatureDidNotVerify
                    | InputRejectedByScheme _ -> true
                    | _ -> false)

            if not unknown.IsEmpty then Ok(UnknownSigners unknown)
            elif not verdict.DuplicateSigners.IsEmpty then
                Ok(DuplicateSigners(verdict.DuplicateSigners |> List.map name))
            elif not invalid.IsEmpty then Ok(InvalidSignatures invalid)
            elif verdict.Authorized then
                Ok(Authorized(verdict.CountedTotal, verdict.Threshold))
            else
                Ok(InsufficientSigners(verdict.CountedTotal, verdict.Threshold))
