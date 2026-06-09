module Zeta.Tests.GameFingerprintTests

open global.Xunit
open Zeta.Core

// the committed fixtures' bytes (roms/chip8/) — fingerprints must match roms/chip8/MANIFEST.md (#7112),
// which were computed independently by shasum / python zlib. Cross-validates our F# CRC32 + SHA-256.
let private arith = [| 0x6Auy; 0x05uy; 0x7Auy; 0x03uy; 0x60uy; 0x02uy; 0x8Auy; 0x04uy; 0x12uy; 0x00uy |]
let private selfloop = [| 0x12uy; 0x00uy |]

[<Fact>]
let ``zeta-arith fingerprint matches the manifest (size + crc32 + sha256)`` () =
    let fp = GameFingerprint.fingerprint arith
    Assert.Equal(10, fp.Size)
    Assert.Equal(0xec8dfc2fu, fp.Crc32)
    Assert.Equal("ec8dfc2f", GameFingerprint.crc32Hex arith)
    Assert.Equal("0f372e55432c6101b6f326d9224f0491e44df6bb9330c783393ccc2288d677be", fp.Sha256)

[<Fact>]
let ``zeta-selfloop fingerprint matches the manifest`` () =
    let fp = GameFingerprint.fingerprint selfloop
    Assert.Equal(2, fp.Size)
    Assert.Equal(0x392d622cu, fp.Crc32)
    Assert.Equal("08da7c45cb204377e7e42249cda5713fa865116ddbb4cb5a1949b2e5b438a6ab", fp.Sha256)

[<Fact>]
let ``key is the SHA-256 hex (the canonical external-index key) and is deterministic`` () =
    Assert.Equal(GameFingerprint.sha256Hex arith, GameFingerprint.key arith)
    Assert.Equal(GameFingerprint.key arith, GameFingerprint.key arith) // deterministic
    Assert.NotEqual<string>(GameFingerprint.key arith, GameFingerprint.key selfloop) // distinct games -> distinct keys

[<Fact>]
let ``empty rom fingerprints cleanly (crc32 0, known empty sha256)`` () =
    let fp = GameFingerprint.fingerprint [||]
    Assert.Equal(0, fp.Size)
    Assert.Equal(0u, fp.Crc32)
    Assert.Equal("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", fp.Sha256) // sha256("")
