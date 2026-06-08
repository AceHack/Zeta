namespace Zeta.Core

/// **The `key` noun-class — keys travel with identity, captured as events, stored in a pluggable key store.**
///
/// Same shape as `Db` (#6996): keys-as-events on the ONE DBSP Z-set stream (#6997/#7000), folded into a
/// keyring; pluggable backend (#6995). Aaron (#7001): *"all my keys for all my accounts should travel with my
/// identity so I don't have to re-login everywhere; every chance to capture my keys should be taken and saved
/// to a key manager/store — local / Vault / cloud KeyVault / a manager like LastPass or the CLI-friendly one —
/// again, all events."*
///
/// **Reference-not-copy is load-bearing here.** The event stream is text, diffable, DST-replayable, and part of
/// the proof lineage — so it MUST NOT carry secret material (no-binary-in-proof-lineage; reference-not-copy,
/// #6925). An event therefore carries a `KeyRef` — an opaque *pointer* to where the secret lives in a backend —
/// never the secret bytes. The backend holds the material; the stream holds the address. This is the same
/// discipline as ROM/song-lyric ZetaId pointers (#6987/#6925).
///
/// **Consent-gated (manifesto §6).** "Every chance to capture" is opt-in, granular, revocable — this module
/// models the *event/abstraction* layer only (a pure, tested F# oracle); it performs NO actual credential
/// capture, reads no real secret store, and forwards nothing. A live capturer/forwarder needs explicit consent
/// gating and a security review (Nazar) before it touches a real keychain. `KeyRevoked` is the consent-
/// withdrawal event and cascades (removes the key and every forward of it). F# reference oracle; ports follow.
module KeyStore =

    open ZetaCli

    /// Pluggable secret-store backend — WHERE the secret material lives (#6995, mirrors `Db.Backend`). The
    /// stream never holds the secret; only a `KeyRef` into one of these.
    type Backend =
        | LocalFile // local encrypted file / OS keychain (DEFAULT)
        | Vault // HashiCorp Vault
        | CloudKeyVault // Azure Key Vault / AWS Secrets Manager / GCP Secret Manager
        | PasswordManager // LastPass / Bitwarden (`bw`, the CLI-friendly one) / 1Password (`op`)
        | HardwareEnclave // TPM / secure element / USB hardware crypto — encrypted, keyed to creator identity
        | GitHubSecrets // GitHub Actions secrets — scoped repo/account · org · enterprise · environment (#7005)

    /// Local by default; the others are opt-in by criteria (team sharing? cloud? CLI workflow? hardware-rooted?).
    let defaultBackend = LocalFile

    /// Hardware devices a credential can be pushed DOWN to on USB install (#7002). The push is bidirectional:
    /// down to the host PC's hardware AND back into the USB's own hardware — both encrypted, keyed to the
    /// identity of the human who CREATED the USB.
    [<Literal>]
    let PcHardware = "pc-hardware"

    [<Literal>]
    let UsbHardware = "usb-hardware"

    /// GitHub Actions secret scope levels (#7005), most-specific → broadest. They form a **push-down cascade**
    /// (cf. `Db.PushDown`): a secret resolves from the most specific scope and falls back up — `environment`
    /// overrides `repo`, which overrides `org`, which overrides `enterprise`. Encode the scope in a `KeyRef`
    /// (e.g. `Handle = "env:prod/GITHUB_TOKEN"`) under the `GitHubSecrets` backend.
    let gitHubSecretScopes = [ "environment"; "repo"; "org"; "enterprise" ]

    /// A POINTER to a secret in a backend — NOT the secret (reference-not-copy). `Handle` is an opaque address
    /// within the backend (a path / name / id); the secret bytes never enter the stream.
    type KeyRef =
        { Backend: Backend
          Handle: string }

    /// An event (`+1` delta) on the one stream (#6997/#7000). All events carry identity/account/ref pointers,
    /// never secret material.
    type KeyEvent =
        | KeyCaptured of identity: string * account: string * ref: KeyRef // a key became available → stored
        | KeyForwarded of identity: string * account: string * target: string // grant travel (SSO) to a target
        | KeyRevoked of identity: string * account: string // consent withdrawn (cascades to forwards)
        // USB install pushes the credential DOWN to hardware (#7002): the secret on `device` is encrypted
        // keyed to `creator` (the identity of the human who created the USB). Hardware = the ultimate push-down
        // (below the OS, #7000). The event records the binding (creator, account, device) — never the material.
        | KeyHardwareBound of creator: string * account: string * device: string

    /// The keyring = fold over the stream. Keys are keyed by `(identity, account)` so they **travel with the
    /// identity** (the ZetaId) — fold the stream anywhere and the same keyring follows. Backend-invariant.
    type KeyRing =
        { Backend: Backend
          Keys: Map<string * string, KeyRef> // (identity, account) → where the secret lives
          Forwarded: Set<string * string * string> // (identity, account, target) grants
          HardwareBindings: Set<string * string * string> } // (creator, account, device) hardware-rooted, keyed to creator

    let empty backend =
        { Backend = backend
          Keys = Map.empty
          Forwarded = Set.empty
          HardwareBindings = Set.empty }

    /// Apply one event. Capture = upsert (idempotent by (identity, account), #6); forward = set-add
    /// (idempotent); revoke = remove the key AND every forward of it (consent withdrawal cascades, §6).
    let apply (kr: KeyRing) (ev: KeyEvent) : KeyRing =
        match ev with
        | KeyCaptured(id, acct, r) -> { kr with Keys = Map.add (id, acct) r kr.Keys }
        | KeyForwarded(id, acct, tgt) ->
            { kr with
                Forwarded = Set.add (id, acct, tgt) kr.Forwarded }
        | KeyHardwareBound(creator, acct, device) ->
            { kr with
                HardwareBindings = Set.add (creator, acct, device) kr.HardwareBindings }
        | KeyRevoked(id, acct) ->
            { kr with
                Keys = Map.remove (id, acct) kr.Keys
                Forwarded = kr.Forwarded |> Set.filter (fun (i, a, _) -> not (i = id && a = acct))
                HardwareBindings = kr.HardwareBindings |> Set.filter (fun (c, a, _) -> not (c = id && a = acct)) }

    /// Fold a whole stream into a keyring — deterministic, replayable (DST §7), backend-INVARIANT (same stream
    /// → same Keys on any backend; only durability differs).
    let fold backend (events: KeyEvent list) : KeyRing =
        List.fold apply (empty backend) events

    /// The keys that **travel with** an identity (SSO — don't re-login everywhere; the keyring moves with you):
    /// the keyring scoped to one identity, `account → KeyRef`.
    let travelWith (identity: string) (kr: KeyRing) : Map<string, KeyRef> =
        kr.Keys
        |> Map.toSeq
        |> Seq.choose (fun ((i, acct), r) -> if i = identity then Some(acct, r) else None)
        |> Map.ofSeq

    /// Install mode (#7004). `Live` = non-destructive (boot without wiping the host) — the **DEFAULT**, since
    /// erase-by-default is too aggressive. `Erase` = wipe-and-install, opt-in only (must be explicitly chosen).
    /// Orthogonal to the credential push below (a Live boot still pushes/binds keys); it governs whether the
    /// host is wiped.
    type InstallMode =
        | Live // non-destructive — DEFAULT
        | Erase // destructive — opt-in only

    /// Live by default (#7004): never wipe the host unless `Erase` is explicitly chosen.
    let defaultInstallMode = Live

    /// Install-from-medium (#7002/#7003): push the credential DOWN to the host PC's hardware, and — ONLY if the
    /// boot medium is **writable** (a USB, not a read-only ISO) — back into the medium's own hardware too. A
    /// read-only ISO boot can't be pushed back to (#7003), so it yields the PC binding ONLY. Both bindings are
    /// encrypted keyed to `creator` (the human who created the medium). Returns the stream events; fold them
    /// like any others.
    let installMediumEvents (creator: string) (account: string) (writable: bool) : KeyEvent list =
        [ yield KeyHardwareBound(creator, account, PcHardware)
          if writable then
              yield KeyHardwareBound(creator, account, UsbHardware) ]

    /// Convenience: a writable USB install → the bidirectional push (PC + USB hardware), both keyed to creator.
    let installUsbEvents (creator: string) (account: string) : KeyEvent list =
        installMediumEvents creator account true

    [<Literal>]
    let SeamName = "key"

    /// Is this command on the `key` seam (`zeta key <verb> <noun>`)?
    let isKeyCommand (cmd: ZetaCommand) = cmd.Seam = Some SeamName
