namespace Zeta.Core

/// **The `crypto` noun-class — cryptographic operations as events, over a pluggable hexagonal provider.**
///
/// Same shape as `Db` (#6996) and `KeyStore` (#7001): operations-as-events on the ONE DBSP Z-set stream,
/// folded into a crypto context; a pluggable backend chosen at the edge (Aaron 2026-06-08: *"we need a crypto
/// noun on our zeta interface … hexagonal SSH and some libssh or something and replace it later … we can plug
/// in ssh or Windows crypto on Windows, both work … we should support both."*).
///
/// **Why it exists now:** it is the missing rung for the Eve-protocol transport (081KT2T2J0008QG0R002R72323) — the on-wire
/// key-exchange + authenticated-encryption that lets two strangers who share nothing but the wire establish a
/// secure channel. The BFT transport (mux-WS) can be written *before* this is wired (build-not-deploy), but it
/// must not carry stranger traffic until this provides the encryption rung.
///
/// **Reference-not-copy is load-bearing (no-binary-in-proof-lineage; #6925).** The stream is text, diffable,
/// DST-replayable, part of the proof lineage — so it MUST NOT carry private keys, shared secrets, or
/// plaintext. Events carry **public** material (public keys, signatures — safe), **hashes** of payloads
/// (commitments, not content), and **`CryptoRef` pointers** to where private/secret material lives in a
/// backend. Secret bytes never enter the stream; the backend holds the material, the stream holds the address.
///
/// **Abstraction layer only (pure, tested F# oracle).** This module models the event/fold layer and the
/// provider PORT; it performs NO real cryptography, reaches no key store, opens no SSH session. The SSH /
/// Windows-CNG adapters behind `ICryptoProvider` are the I/O edge — gated behind a security review (Nazar /
/// Mateo) before they touch real key material, and they are not deterministic (so they live outside the
/// DST-replayable core). F# reference oracle; adapters follow.
module Crypto =

    open ZetaCli

    /// Pluggable crypto backend — WHICH provider performs the operation (hexagonal; replace later). Both SSH
    /// and Windows-CNG are first-class and supported (Aaron: "support both").
    type Backend =
        | Ssh // OpenSSH / libssh — cross-platform, CLI-friendly (DEFAULT; Aaron enabled ssh)
        | WindowsCng // Windows CNG / DPAPI — native on Windows
        | PqLattice // future: Zeta post-quantum lattice (081KSNY2Z0008QG0R002JKH50A) — not yet implemented

    /// SSH by default: cross-platform and CLI-friendly; Windows-CNG opt-in on Windows; PQ-lattice is future.
    let defaultBackend = Ssh

    /// Standard algorithm identifiers (Beacon — externally-anchored names, not coinages). Grouped by role.
    type Algorithm =
        // Signature / identity
        | Ed25519
        | EcdsaP256
        | RsaSha256
        // Key agreement
        | X25519
        // Authenticated encryption (AEAD)
        | Aes256Gcm
        | ChaCha20Poly1305

    /// A POINTER to private/secret material in a backend — NEVER the secret (reference-not-copy; mirrors
    /// `KeyStore.KeyRef`). `Handle` is an opaque address within the backend (a key id / path / slot).
    type CryptoRef = { Backend: Backend; Handle: string }

    /// Crypto operations as events (`+1` deltas) on the one stream. Every field is public material, a hash, or
    /// a `CryptoRef` — never a private key, shared secret, or plaintext.
    type CryptoEvent =
        /// A keypair was generated for `identity`: the PUBLIC key is recorded inline (safe); the private key is
        /// referenced, never inlined.
        | KeyPairGenerated of identity: string * algo: Algorithm * publicKey: string * privateRef: CryptoRef
        /// `identity` signed a payload (recorded by its hash, not its content); the signature is public.
        | Signed of identity: string * algo: Algorithm * payloadHash: string * signature: string
        /// A verification result against a public key — a pure fact (no material).
        | Verified of identity: string * payloadHash: string * ok: bool
        /// On-wire key exchange (e.g. X25519) established a shared secret between two peers — referenced, never
        /// inlined. This is the Eve-transport key-exchange rung (081KT2T2J0008QG0R002R72323).
        | SharedSecretEstablished of peerA: string * peerB: string * algo: Algorithm * secretRef: CryptoRef
        /// AEAD-encrypted `plaintextHash` (commitment to the plaintext) → ciphertext referenced by `cipherRef`.
        | Encrypted of algo: Algorithm * plaintextHash: string * cipherRef: CryptoRef
        /// AEAD-decrypted `cipherRef` → recovered plaintext recorded by hash (must match the original).
        | Decrypted of algo: Algorithm * cipherRef: CryptoRef * plaintextHash: string

    /// The crypto context = fold over the stream. Public keys are kept inline (public, safe); private keys and
    /// shared secrets are kept as pointers. Keyed by identity / peer-pair so material **travels with identity**.
    type CryptoState =
        { Backend: Backend
          PublicKeys: Map<string, string> // identity → public key (public)
          PrivateRefs: Map<string, CryptoRef> // identity → pointer to private key (never the key)
          SharedSecrets: Map<string * string, CryptoRef> } // (peerA, peerB) normalized → pointer to shared secret

    let empty backend =
        { Backend = backend
          PublicKeys = Map.empty
          PrivateRefs = Map.empty
          SharedSecrets = Map.empty }

    /// Normalize a peer pair so `(a,b)` and `(b,a)` key the same shared secret (ordinal order, culture-
    /// invariant — `culture-invariant-by-default`).
    let private pair (a: string) (b: string) : string * string =
        if System.String.CompareOrdinal(a, b) <= 0 then (a, b) else (b, a)

    /// Apply one event. Keypair-gen = upsert by identity (idempotent, #6); shared-secret = upsert by
    /// normalized pair; sign/verify/encrypt/decrypt carry no durable state into the context (they are facts on
    /// the stream — the proof lineage — verifiable on replay).
    let apply (st: CryptoState) (ev: CryptoEvent) : CryptoState =
        match ev with
        | KeyPairGenerated(id, _, pub, priv) ->
            { st with
                PublicKeys = Map.add id pub st.PublicKeys
                PrivateRefs = Map.add id priv st.PrivateRefs }
        | SharedSecretEstablished(a, b, _, r) ->
            { st with SharedSecrets = Map.add (pair a b) r st.SharedSecrets }
        | Signed _
        | Verified _
        | Encrypted _
        | Decrypted _ -> st

    /// Fold a whole stream into a crypto context — deterministic, replayable (DST §7), backend-INVARIANT (same
    /// stream → same public keys / refs on any backend; only where the material lives differs).
    let fold backend (events: CryptoEvent list) : CryptoState =
        List.fold apply (empty backend) events

    /// The public key registered for an identity, if any.
    let publicKeyOf (identity: string) (st: CryptoState) : string option = Map.tryFind identity st.PublicKeys

    /// The shared-secret pointer for a peer pair, if a key exchange has completed (order-insensitive).
    let sharedSecretOf (a: string) (b: string) (st: CryptoState) : CryptoRef option =
        Map.tryFind (pair a b) st.SharedSecrets

    /// **The hexagonal provider port** — the operations a backend (SSH / Windows-CNG / PQ-lattice) implements.
    /// Returns the `CryptoEvent`(s) to fold onto the stream; the actual bytes stay in the backend behind the
    /// returned `CryptoRef`s. Implementations are the I/O edge (gated: Nazar/Mateo review before real material).
    ///
    /// Hexagonal so we can "replace it later" (Aaron): start on SSH/CNG, swap in `PqLattice` (081KSNY2Z0008QG0R002JKH50A) behind
    /// the same port without touching callers.
    type ICryptoProvider =
        abstract Backend: Backend
        abstract GenerateKeyPair: identity: string * algo: Algorithm -> CryptoEvent
        abstract Sign: identity: string * algo: Algorithm * payloadHash: string -> CryptoEvent
        abstract Verify: identity: string * payloadHash: string * signature: string -> CryptoEvent
        abstract KeyExchange: peerA: string * peerB: string * algo: Algorithm -> CryptoEvent
        abstract Encrypt: algo: Algorithm * plaintextHash: string -> CryptoEvent
        abstract Decrypt: algo: Algorithm * cipherRef: CryptoRef -> CryptoEvent

    [<Literal>]
    let SeamName = "crypto"

    /// Is this command on the `crypto` seam (`zeta crypto <verb> <noun>`)?
    let isCryptoCommand (cmd: ZetaCommand) = cmd.Seam = Some SeamName
