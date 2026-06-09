namespace Zeta.Core

/// **`GameFingerprint` — the first *external* index: a game's content-derived identity (Aaron 2026-06-08, shadow*).**
///
/// Aaron: *"that's the first thing we need an **external index** of in our system — everything else has been
/// internal to us… **game fingerprinting**."* Per-game uncertainty (the `GamePortfolio`/catalog) must be keyed by
/// an **identifiable location** for a game — and a game lives *outside* the agent, so this is the system's first
/// reference to an external thing. The fingerprint is **content-derived** (so it's stable, reproducible, and
/// matches third-party catalogs): **size + CRC32 + SHA-256**, the No-Intro / Redump / TOSEC **DAT** convention
/// (see `roms/chip8/MANIFEST.md` #7112 and `docs/PRIOR-ART-LIST.md`). SHA-256 is the canonical key (stronger than
/// the DAT-legacy CRC32/MD5; CRC32 kept for cross-checking against those external databases).
///
/// **Honest scope (peel):** identifies a ROM by its *exact bytes* (a byte-for-byte different dump = a different
/// fingerprint — the No-Intro reality; header/region variants are distinct entries). Pure/deterministic (DST).
/// This is the external-index *key*; the catalog that maps fingerprint → per-game uncertainty (a `SoftValue`-held
/// quantity) is the next slice.
[<RequireQualifiedAccess>]
module GameFingerprint =

    // zlib/PNG CRC-32 (polynomial 0xEDB88320), the No-Intro/DAT CRC.
    let private crc1 (n: uint32) : uint32 =
        let mutable c = n
        for _ in 0..7 do
            c <- if c &&& 1u <> 0u then 0xEDB88320u ^^^ (c >>> 1) else c >>> 1
        c

    let private crcTable = Array.init 256 (fun n -> crc1 (uint32 n))

    /// CRC-32 (zlib) of the bytes — the DAT-legacy checksum (cross-checks against No-Intro/Redump/TOSEC).
    let crc32 (bytes: byte[]) : uint32 =
        let mutable crc = 0xFFFFFFFFu
        for b in bytes do
            crc <- crcTable.[int ((crc ^^^ uint32 b) &&& 0xFFu)] ^^^ (crc >>> 8)
        crc ^^^ 0xFFFFFFFFu

    /// SHA-256 of the bytes as lowercase hex — the canonical external-index key.
    let sha256Hex (bytes: byte[]) : string =
        use h = System.Security.Cryptography.SHA256.Create()
        h.ComputeHash bytes |> Array.map (fun b -> b.ToString("x2")) |> String.concat ""

    /// A game's content-derived fingerprint (the external-index identity): size + CRC32 + SHA-256.
    type Fingerprint =
        { Size: int
          Crc32: uint32
          Sha256: string }

    /// Fingerprint a ROM's bytes (the No-Intro/DAT-style identity).
    let fingerprint (rom: byte[]) : Fingerprint =
        { Size = rom.Length
          Crc32 = crc32 rom
          Sha256 = sha256Hex rom }

    /// The canonical external-index key for a ROM (its SHA-256 hex).
    let key (rom: byte[]) : string = sha256Hex rom

    /// CRC32 as the conventional 8-char lowercase hex (matches DAT files / `MANIFEST.md`).
    let crc32Hex (rom: byte[]) : string = (crc32 rom).ToString("x8")
