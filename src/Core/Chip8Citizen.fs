namespace Zeta.Core

open System.Threading.Tasks
open Zeta.Core.FSharp.ZetaId

/// Chip8Citizen — **the C in the citizenship quartet: cryptographic identity as an INJECTED §13 effect**
/// (the ratified verdict, Aaron 2026-06-11 "this is perfect": vanilla CHIP-8 — 4KB, no MUL — cannot hold
/// Ed25519/ChaCha20/SHA-256 in-VM; *the primitives cross the membrane*; the VM carries the HANDLE).
///
/// The shape (all existing substrate, composed):
/// - **Address** = a governed Bus-category ZetaId destination (`ReticulumLink.mint`) — deterministic in
///   (timestamp, seed, location): the room's identity is minted from its seed (DST; same seed ⇒ same
///   citizen). The VM never sees key material — it sees its ADDRESS, delivered as a crossing.
/// - **`ISigner`** = the injected boundary (interfaces are free; the rules of the game). The HOST holds
///   it; per KeyStore discipline the signer holds a `KeyRef`-shaped secret, the stream/VM holds none.
/// - **Crossings** (text, treaty register): `whoami` → `ident:<hex>` (self-knowledge crosses IN);
///   `sign:<payload>` → `signed:<payload>:<sig>` (the signature comes BACK as a crossing). The membrane
///   is the API; the §13 quarantine is exactly "entropy/keys only through the injected effect."
///
/// **Honest scope (peel):** `simSigner` is NOT cryptography — it is a deterministic keyed hash
/// (SplitMix64-folded) giving the *protocol shape* for DST tests. A real signer binds Ed25519 in a
/// host-side implementation of the SAME interface (Nazar review before any live key touch). The
/// interface is the treaty; the sim impl is the test oracle.
[<RequireQualifiedAccess>]
module Chip8Citizen =

    /// A citizen: a name + its governed Reticulum address. The WHOLE identity the VM ever holds —
    /// no key material (reference-not-copy: the address is a pointer to an identity, not its secret).
    type Citizen =
        { Name: string
          Address: ReticulumLink.Destination }

    /// Mint a citizen from the room's seed (deterministic — DST: same seed, same citizen).
    let mint (name: string) (ts: Versionstamp) (seed: int64) (location: Location) : Citizen =
        { Name = name
          Address = ReticulumLink.mint ts seed location }

    /// The citizen's address on the wire (lowercase hex of the 128-bit ZetaId).
    let addressHex (c: Citizen) : string =
        let hi = uint64 (c.Address.Id >>> 64)
        let lo = uint64 c.Address.Id
        sprintf "%016x%016x" hi lo

    // ── the injected signing boundary (interface = free; the host implements; the VM only converses) ──

    /// The signer the HOST injects. Implementations hold the secret (KeyStore `KeyRef` discipline);
    /// nothing above this interface ever sees key bytes.
    type ISigner =
        abstract Sign: payload: string -> string
        abstract Verify: payload: string -> signature: string -> bool

    /// A deterministic SIMULATION signer — **not cryptography** (peel above): a keyed SplitMix64 fold
    /// giving stable, tamper-evident tags for DST tests. The key stays inside the closure (the VM-side
    /// cannot reach it — least privilege by construction).
    let simSigner (key: uint64) : ISigner =
        let mix (z0: uint64) : uint64 =
            let z = (z0 + 0x9E3779B97F4A7C15UL)
            let z = (z ^^^ (z >>> 30)) * 0xBF58476D1CE4E5B9UL
            let z = (z ^^^ (z >>> 27)) * 0x94D049BB133111EBUL
            z ^^^ (z >>> 31)

        let tag (payload: string) : string =
            let mutable h = mix key
            for ch in payload do
                h <- mix (h ^^^ uint64 (int ch))
            sprintf "%016x" h

        { new ISigner with
            member _.Sign payload = tag payload
            member _.Verify payload signature = tag payload = signature }

    // ── the crossings (text — the treaty register) ──

    /// `ident:<hex>` — the citizen's own address arriving as a crossing (self-knowledge crosses IN).
    let encodeIdent (c: Citizen) : string = "ident:" + addressHex c

    /// Parse an ident crossing (None = not an ident / malformed — honest refusal).
    let parseIdent (payload: string) : string option =
        if payload.StartsWith "ident:" && payload.Length = 38 then Some(payload.Substring 6) else None

    /// `signed:<payload>:<sig>` — a signature coming back over the membrane.
    let encodeSigned (payload: string) (signature: string) : string =
        sprintf "signed:%s:%s" payload signature

    /// Parse a signed crossing into (payload, signature). The payload itself may contain ':' — the
    /// SIGNATURE is the fixed-width last segment (16 hex chars), so split from the right.
    let parseSigned (s: string) : (string * string) option =
        if s.StartsWith "signed:" then
            let body = s.Substring 7
            let i = body.LastIndexOf ':'
            if i > 0 && body.Length - i - 1 = 16 then Some(body.Substring(0, i), body.Substring(i + 1)) else None
        else
            None

    // ── the citizen-side mailbox room: identity conversation folded as state ──

    /// What the citizen-side room knows from its identity conversation (all learned via crossings):
    /// its own address (after `ident:` arrives) and the signatures it has received back.
    type Mailbox =
        { KnownAddress: string option
          Signatures: (string * string) list }

    /// A fresh mailbox — knows nothing; everything it will know arrives over the membrane.
    let emptyMailbox: Mailbox = { KnownAddress = None; Signatures = [] }

    /// The citizen-side handler: folds `ident:` (learn own address) and `signed:` (receive a signature)
    /// crossings into the mailbox. All other traffic passes by unchanged.
    let mailboxHandler: SoftScheduler.HandlerK<Mailbox> =
        SoftScheduler.handlerK
            "citizen-mailbox"
            (function
            | OperatorMessageArrived _ -> true
            | _ -> false)
            (fun intr _ctx (m: Mailbox) ->
                match intr with
                | OperatorMessageArrived p ->
                    match parseIdent p with
                    | Some addr -> Task.FromResult(Ok { m with KnownAddress = Some addr })
                    | None ->
                        match parseSigned p with
                        | Some (payload, signature) ->
                            Task.FromResult(Ok { m with Signatures = (payload, signature) :: m.Signatures })
                        | None -> Task.FromResult(Ok m)
                | _ -> Task.FromResult(Ok m))

    /// The HOST-side effect: answer a `sign:<payload>` request with the `signed:` crossing (the one
    /// place key material is exercised — behind the injected ISigner; §13: entropy/keys only through here).
    let answerSignRequest (signer: ISigner) (request: string) : string option =
        if request.StartsWith "sign:" then
            let payload = request.Substring 5
            Some(encodeSigned payload (signer.Sign payload))
        else
            None
