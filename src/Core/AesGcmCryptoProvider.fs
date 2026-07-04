namespace Zeta.Core

open System
open System.Security.Cryptography
open Zeta.Core.Abstractions

[<Sealed>]
type AesGcmCryptoProvider(key: byte[]) =

    let validateKey (k: byte[]) =
        if k = null then nullArg "key"
        if k.Length <> 16 && k.Length <> 32 then
            invalidArg "key" "AES key length must be 16 (AES-128) or 32 (AES-256) bytes."
        k
        
    let key = validateKey key

    interface ICryptoProvider with
        member _.Encrypt(plaintext: byte[]) =
            if plaintext = null then nullArg "plaintext"
            
            // 1. Generate a random 12-byte nonce
            let nonce = Array.zeroCreate<byte> 12
            RandomNumberGenerator.Fill nonce
            
            // 2. Prepare tag and ciphertext buffers
            let tag = Array.zeroCreate<byte> 16
            let ciphertext = Array.zeroCreate<byte> plaintext.Length
            
            // 3. Encrypt
            use aes = new AesGcm(key, 16)
            aes.Encrypt(nonce, plaintext, ciphertext, tag)
            
            // 4. Combine: nonce (12) + tag (16) + ciphertext
            let combined = Array.zeroCreate<byte> (12 + 16 + ciphertext.Length)
            Array.Copy(nonce, 0, combined, 0, 12)
            Array.Copy(tag, 0, combined, 12, 16)
            Array.Copy(ciphertext, 0, combined, 28, ciphertext.Length)
            combined

        member _.Decrypt(combined: byte[]) =
            if combined = null then nullArg "combined"
            if combined.Length < 28 then
                failwithf "Invalid ciphertext: payload too short (%d bytes)" combined.Length
                
            // 1. Extract nonce (12 bytes) and tag (16 bytes)
            let nonce = Array.zeroCreate<byte> 12
            let tag = Array.zeroCreate<byte> 16
            let ciphertext = Array.zeroCreate<byte> (combined.Length - 28)
            
            Array.Copy(combined, 0, nonce, 0, 12)
            Array.Copy(combined, 12, tag, 0, 16)
            Array.Copy(combined, 28, ciphertext, 0, ciphertext.Length)
            
            // 2. Prepare plaintext buffer
            let plaintext = Array.zeroCreate<byte> ciphertext.Length
            
            // 3. Decrypt
            use aes = new AesGcm(key, 16)
            aes.Decrypt(nonce, ciphertext, tag, plaintext)
            plaintext
