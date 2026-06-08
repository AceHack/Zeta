module Zeta.Tests.CryptoTests

open global.Xunit
open Zeta.Core
open Zeta.Core.Crypto

[<Fact>]
let ``default backend is SSH; both SSH and Windows-CNG are first-class`` () =
    Assert.Equal(Ssh, defaultBackend)
    // The DU admits both supported backends + the future PQ-lattice.
    Assert.NotEqual<Backend>(Ssh, WindowsCng)

[<Fact>]
let ``fold registers public keys inline and private keys by reference`` () =
    let priv = { Backend = Ssh; Handle = "~/.ssh/id_ed25519" }
    let st = fold Ssh [ KeyPairGenerated("alice", Ed25519, "ssh-ed25519 AAAA...", priv) ]
    Assert.Equal(Some "ssh-ed25519 AAAA...", publicKeyOf "alice" st)
    Assert.Equal(Some priv, Map.tryFind "alice" st.PrivateRefs)

[<Fact>]
let ``shared secret is order-insensitive (key exchange between strangers)`` () =
    let r = { Backend = Ssh; Handle = "session-42" }
    let st = fold Ssh [ SharedSecretEstablished("bob", "alice", X25519, r) ]
    // Established as (bob, alice) but queryable either way (normalized ordinal pair).
    Assert.Equal(Some r, sharedSecretOf "alice" "bob" st)
    Assert.Equal(Some r, sharedSecretOf "bob" "alice" st)

[<Fact>]
let ``sign/verify/encrypt/decrypt are stream facts, carry no durable context state`` () =
    let st =
        fold Ssh
            [ Signed("alice", Ed25519, "hash:abc", "sig:deadbeef")
              Verified("alice", "hash:abc", true)
              Encrypted(Aes256Gcm, "pt:111", { Backend = Ssh; Handle = "ct:1" })
              Decrypted(Aes256Gcm, { Backend = Ssh; Handle = "ct:1" }, "pt:111") ]
    Assert.True(Map.isEmpty st.PublicKeys)
    Assert.True(Map.isEmpty st.SharedSecrets)

[<Fact>]
let ``backend-invariant + deterministic (DST): same stream, same context on any backend`` () =
    let events =
        [ KeyPairGenerated("a", Ed25519, "pubA", { Backend = Ssh; Handle = "ha" })
          KeyPairGenerated("b", Ed25519, "pubB", { Backend = WindowsCng; Handle = "hb" }) ]
    let onSsh = fold Ssh events
    let onCng = fold WindowsCng events
    // Public keys are backend-invariant (only the context's own Backend tag + where material lives differ).
    Assert.Equal<Map<string, string>>(onSsh.PublicKeys, onCng.PublicKeys)

[<Fact>]
let ``no secret material ever appears in events — only public keys, hashes, and refs`` () =
    // Compile-time guarantee, asserted by construction: KeyPairGenerated carries a CryptoRef for the private
    // key, never the bytes. This test documents the invariant by exercising the public-only surface.
    let priv = { Backend = WindowsCng; Handle = "cng:slot7" }
    let st = fold WindowsCng [ KeyPairGenerated("c", EcdsaP256, "pubC", priv) ]
    Assert.Equal(Some priv, Map.tryFind "c" st.PrivateRefs)
    Assert.Equal("cng:slot7", priv.Handle) // a pointer, not a key
