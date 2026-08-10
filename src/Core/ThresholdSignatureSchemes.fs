namespace Zeta.Core

/// **Adapters behind the `ISignatureScheme` port** (R6 of the threshold-verification spec).
///
/// These are the ONLY places in the tree that name a concrete algorithm. `verify` never sees
/// them; a composition root picks the list and hands over a `SchemeRegistry`, which is what
/// makes a post-quantum swap a registry edit rather than a migration event.
///
/// Two are the platform's own (`System.Security.Cryptography`) — **no bespoke primitive is
/// implemented here**, per the spec's non-goals. The third is an explicitly-labelled **toy**
/// double (`.claude/rules/toy-is-free-metered-must-be-earned.md`): it provides no security at
/// all and exists so that window/registry behaviour can be exercised without key generation.
module ThresholdSignatureSchemes =

    open System.Security.Cryptography
    open Zeta.Core.ThresholdSignatureVerification

    [<Literal>]
    let EcdsaP256Sha256Id = "ecdsa-p256-sha256"

    [<Literal>]
    let RsaPssSha256Id = "rsa-pss-sha256"

    [<Literal>]
    let ToyOpenId = "toy-open-double"

    /// ECDSA over NIST P-256 with SHA-256; public key is a DER SubjectPublicKeyInfo (hex on the
    /// roster). Anchors: FIPS 186-4 (ECDSA), RFC 5280 §4.1 (SPKI).
    let ecdsaP256Sha256: ISignatureScheme =
        { new ISignatureScheme with
            member _.Id = SchemeId EcdsaP256Sha256Id

            member _.Verify(publicKey, message, signature) =
                use ecdsa = ECDsa.Create()

                let imported =
                    try
                        ecdsa.ImportSubjectPublicKeyInfo(System.ReadOnlySpan<byte>(publicKey)) |> ignore
                        true
                    with :? CryptographicException ->
                        false

                if not imported then
                    Error MalformedPublicKey
                else
                    // A wrong-length / non-IEEE-P1363 signature is a *bad signature*, which
                    // VerifyData reports as false rather than throwing.
                    Ok(ecdsa.VerifyData(message, signature, HashAlgorithmName.SHA256)) }

    /// RSA-PSS with SHA-256; public key is a DER SubjectPublicKeyInfo (hex on the roster).
    /// Anchors: RFC 8017 (PKCS#1 v2.2, PSS).
    let rsaPssSha256: ISignatureScheme =
        { new ISignatureScheme with
            member _.Id = SchemeId RsaPssSha256Id

            member _.Verify(publicKey, message, signature) =
                use rsa = RSA.Create()

                let imported =
                    try
                        rsa.ImportSubjectPublicKeyInfo(System.ReadOnlySpan<byte>(publicKey)) |> ignore
                        true
                    with :? CryptographicException ->
                        false

                if not imported then
                    Error MalformedPublicKey
                else
                    Ok(rsa.VerifyData(message, signature, HashAlgorithmName.SHA256, RSASignaturePadding.Pss)) }

    /// **TOY — NOT A SIGNATURE SCHEME.** The "signature" is `SHA-256(publicKey || message)`,
    /// which anyone holding the public key can produce; it authenticates nothing. It exists to
    /// exercise the port, the registry and the migration window deterministically. Never
    /// register it in anything that decides a real authorization.
    let toyOpenDouble: ISignatureScheme =
        { new ISignatureScheme with
            member _.Id = SchemeId ToyOpenId

            member _.Verify(publicKey, message, signature) =
                if signature.Length <> 32 then
                    Error MalformedSignature
                else
                    let expected = SHA256.HashData(Array.append publicKey message)
                    Ok(CryptographicOperations.FixedTimeEquals(System.ReadOnlySpan<byte>(expected), System.ReadOnlySpan<byte>(signature))) }

    /// The toy double's "signing" side — test-fixture convenience, same warning applies.
    let toyOpenSignature (publicKey: byte[]) (message: byte[]) : byte[] =
        SHA256.HashData(Array.append publicKey message)
