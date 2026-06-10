namespace Zeta.Core

open Zeta.Core.Optics

/// FingerprintPrism — the concrete hook from the optic `IPrism` to a fingerprint primitive (Aaron
/// 2026-06-10: "prismable ties into our rainbow table primitive for fingerprinting ... soft too not
/// just hard ... GameFingerprint and we have soft fingerprint lookup so you can switch games while
/// still staying soft").
///
/// A bare fingerprint is one-way (a Getter); a **rainbow table** (the reverse map of known wholes by
/// fingerprint) makes it a lawful **prism**: `Match` recognizes a known whole, `Build` = id (a known
/// whole is its own canonical form). Two flavors:
///   • HARD — exact fingerprint match (the crypto/exact rainbow; e.g. GameFingerprint.key byte-for-byte).
///   • SOFT — nearest known whole by similarity ≥ threshold (the soft rainbow; switch/recognize games
///            staying soft). Backed by a MinHash byte-shingle similarity (below) or any sim fn.
///
/// Pure (no classes — meta-rule). Generic over the whole 'w and fingerprint 'fp; does not touch the
/// proven-4/4 GameFingerprint.fs (the cross-language byte-lock stays intact).
[<RequireQualifiedAccess>]
module FingerprintPrism =

    /// A rainbow table: known wholes indexed by their (hard) fingerprint — the reverse map that makes a
    /// one-way fingerprint prism-able.
    type Rainbow<'w, 'fp when 'fp: comparison> =
        { Fingerprint: 'w -> 'fp
          Known: Map<'fp, 'w> }

    /// Empty table over a fingerprint function.
    let empty (fingerprint: 'w -> 'fp) : Rainbow<'w, 'fp> = { Fingerprint = fingerprint; Known = Map.empty }

    /// Register a known whole (keyed by its fingerprint).
    let add (w: 'w) (r: Rainbow<'w, 'fp>) : Rainbow<'w, 'fp> =
        { r with Known = Map.add (r.Fingerprint w) w r.Known }

    /// HARD prism — exact fingerprint match. `Match` returns the known whole with the same fingerprint
    /// (or None); `Build` = id (a known whole is its own canonical form). Lawful.
    let hard (r: Rainbow<'w, 'fp>) : IPrism<'w, 'w> =
        prism (fun w -> Map.tryFind (r.Fingerprint w) r.Known) id

    /// SOFT prism — nearest known whole by `similarity ≥ threshold` (the soft rainbow). `Match` returns
    /// the most-similar known whole if any clears the threshold; `Build` = id. Lets you recognize /
    /// switch games while staying soft (no exact hash needed).
    let soft (similarity: 'w -> 'w -> float) (threshold: float) (r: Rainbow<'w, 'fp>) : IPrism<'w, 'w> =
        prism
            (fun w ->
                r.Known
                |> Map.toSeq
                |> Seq.map (fun (_, k) -> k, similarity w k)
                |> Seq.filter (fun (_, s) -> s >= threshold)
                |> Seq.sortByDescending snd
                |> Seq.tryHead
                |> Option.map fst)
            id

    /// SOFT byte fingerprint — a MinHash sketch over byte-shingles (Broder MinHash; insertion-robust via
    /// overlapping shingles). The soft counterpart to GameFingerprint's exact SHA-256 key: near-identical
    /// byte streams get similar sketches. Reuses GameFingerprint.crc32 for the shingle hash.
    type SoftBytes = { MinHashes: uint32[] }

    [<Literal>]
    let private ShingleWidth = 8

    [<Literal>]
    let private SketchSize = 64

    /// Compute the soft byte sketch (sorted, distinct, ≤ SketchSize smallest shingle hashes).
    let softBytes (data: byte[]) : SoftBytes =
        let hashes =
            if data.Length < ShingleWidth then
                if data.Length = 0 then Seq.empty else Seq.singleton (GameFingerprint.crc32 data)
            else
                seq { for i in 0 .. data.Length - ShingleWidth -> GameFingerprint.crc32 data.[i .. i + ShingleWidth - 1] }
        { MinHashes = hashes |> Seq.distinct |> Seq.sort |> Seq.truncate SketchSize |> Seq.toArray }

    /// Soft similarity in [0,1] — Jaccard of the two MinHash sketches (1.0 = identical sketch, 0.0 =
    /// nothing shared). The soft-rainbow distance.
    let softBytesSimilarity (a: SoftBytes) (b: SoftBytes) : float =
        let sa = Set.ofArray a.MinHashes
        let sb = Set.ofArray b.MinHashes
        let u = Set.union sa sb |> Set.count
        if u = 0 then 1.0 else float (Set.intersect sa sb |> Set.count) / float u
