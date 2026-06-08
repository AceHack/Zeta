module Zeta.Tests.KeyStoreTests

open global.Xunit
open Zeta.Core
open Zeta.Core.KeyStore

let private refOf backend handle = { Backend = backend; Handle = handle }

[<Fact>]
let ``capture then travelWith: the key follows the identity (SSO, no re-login)`` () =
    let r = refOf LocalFile "vault/github"
    let kr = fold defaultBackend [ KeyCaptured("aaron", "github", r) ]
    let travelling = travelWith "aaron" kr
    Assert.Equal(r, travelling.["github"])

[<Fact>]
let ``idempotency: capturing the same key twice == once`` () =
    let r = refOf LocalFile "vault/github"
    let once = fold defaultBackend [ KeyCaptured("aaron", "github", r) ]
    let twice = fold defaultBackend [ KeyCaptured("aaron", "github", r); KeyCaptured("aaron", "github", r) ]
    Assert.Equal<Map<string * string, KeyRef>>(once.Keys, twice.Keys)

[<Fact>]
let ``default backend is LocalFile`` () =
    Assert.Equal(LocalFile, defaultBackend)

[<Fact>]
let ``backend-invariance: same stream folds to the same Keys on every backend`` () =
    let stream = [ KeyCaptured("aaron", "github", refOf LocalFile "h1"); KeyCaptured("aaron", "aws", refOf LocalFile "h2") ]
    let keys b = (fold b stream).Keys
    for b in [ LocalFile; Vault; CloudKeyVault; PasswordManager; HardwareEnclave; GitHubSecrets ] do
        Assert.Equal<Map<string * string, KeyRef>>(keys LocalFile, keys b)

[<Fact>]
let ``revoke cascades: removes the key AND its forwards AND its hardware bindings (consent withdrawal)`` () =
    let kr =
        fold
            defaultBackend
            [ KeyCaptured("aaron", "github", refOf Vault "h")
              KeyForwarded("aaron", "github", "peer-ci")
              KeyHardwareBound("aaron", "github", PcHardware)
              KeyRevoked("aaron", "github") ]
    Assert.False(kr.Keys.ContainsKey("aaron", "github"))
    Assert.Empty(kr.Forwarded)
    Assert.Empty(kr.HardwareBindings)

[<Fact>]
let ``revoke is idempotent: revoking an absent key is a no-op`` () =
    let kr = fold defaultBackend [ KeyRevoked("ghost", "none"); KeyRevoked("ghost", "none") ]
    Assert.Empty(kr.Keys)

[<Fact>]
let ``writable USB install: bidirectional push (PC + USB hardware), both keyed to creator`` () =
    let kr = fold defaultBackend (installUsbEvents "aaron" "github")
    Assert.True(kr.HardwareBindings.Contains("aaron", "github", PcHardware))
    Assert.True(kr.HardwareBindings.Contains("aaron", "github", UsbHardware))

[<Fact>]
let ``read-only ISO boot: PC binding only — can't push back to a non-writable medium`` () =
    let kr = fold defaultBackend (installMediumEvents "aaron" "github" false)
    Assert.True(kr.HardwareBindings.Contains("aaron", "github", PcHardware))
    Assert.False(kr.HardwareBindings.Contains("aaron", "github", UsbHardware))

[<Fact>]
let ``install mode defaults to Live (non-destructive) — erase is opt-in`` () =
    Assert.Equal(Live, defaultInstallMode)

[<Fact>]
let ``erase preserves config to hardware first, USB fallback when no enclave`` () =
    Assert.Equal<string list>([ PcHardware ], preserveTargets true)
    Assert.Equal<string list>([ UsbHardware ], preserveTargets false)

[<Fact>]
let ``erase-preserve flow is preserve -> use-before-format -> format -> repersist`` () =
    Assert.Equal<string list>([ "preserve"; "use-before-format"; "format"; "repersist" ], erasePreserveFlow)

[<Fact>]
let ``GitHub secret scopes cascade most-specific to broadest`` () =
    Assert.Equal<string list>([ "environment"; "repo"; "org"; "enterprise" ], gitHubSecretScopes)

[<Fact>]
let ``reference-not-copy: the stream/keyring carries only KeyRef pointers, never secret material`` () =
    // A KeyRef is (Backend, Handle) — an address, not the secret. The keyring exposes only that.
    let r = refOf CloudKeyVault "kv://prod/github-token"
    let kr = fold defaultBackend [ KeyCaptured("aaron", "github", r) ]
    let got = (travelWith "aaron" kr).["github"]
    Assert.Equal("kv://prod/github-token", got.Handle) // a pointer, not the token
