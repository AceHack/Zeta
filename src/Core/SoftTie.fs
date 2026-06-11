namespace Zeta.Core

open Zeta.Core.Optics

/// SoftTie — the concrete `tie` verb (Aaron 2026-06-10, shadow*): "wire `tie` to `FingerprintPrism.soft`."
///
/// `tie` is the soft-topology link: it soft-links two strands `a` and `b` into a **soft tie** — present
/// iff they soft-match (similarity ≥ threshold), carrying the match *strength* as its weight. The tie is
/// SOFT (weighted, not crisp) — "even our tie is soft, for our soft topology" (Aaron). It is wired
/// THROUGH `FingerprintPrism.soft`: a one-element soft rainbow keyed by `b`, with `a` matched against it
/// (a ties to b iff a soft-recognizes b). The 2-strand base of the bob/weave/braid/tie ladder.
///
/// Pure module, no classes. The strength is the soft weight (ties to `WeightedSet` soft links / the
/// soft-topology capture).
[<RequireQualifiedAccess>]
module SoftTie =

    /// A soft tie between two strands — present only when they soft-match; `Strength` ∈ (0,1] is the
    /// similarity that bound them (the soft weight on the link).
    type SoftTie<'w> = { Left: 'w; Right: 'w; Strength: float }

    /// `tie similarity threshold a b` — soft-link `a` to `b` via `FingerprintPrism.soft`. Builds a
    /// one-element soft rainbow {b} (the hard fingerprint is irrelevant for the soft path) and Matches
    /// `a`: `Some` tie (with strength = similarity a b) if they clear the threshold, `None` if not (no
    /// tie). This is the `tie` verb made concrete on the existing soft-fingerprint machinery.
    let tie (similarity: 'w -> 'w -> float) (threshold: float) (a: 'w) (b: 'w) : SoftTie<'w> option =
        let rainbow = FingerprintPrism.empty (fun (_: 'w) -> 0) |> FingerprintPrism.add b
        let p: IPrism<'w, 'w> = FingerprintPrism.soft similarity threshold rainbow
        match p.Match a with
        | Some matched -> Some { Left = a; Right = matched; Strength = similarity a b }
        | None -> None

    /// `tie` over raw bytes — the concrete MinHash soft tie: similarity = Jaccard of the two
    /// `FingerprintPrism.softBytes` sketches (insertion-robust). The default `tie` for byte strands.
    let tieBytes (threshold: float) (a: byte[]) (b: byte[]) : SoftTie<byte[]> option =
        let sim (x: byte[]) (y: byte[]) =
            FingerprintPrism.softBytesSimilarity (FingerprintPrism.softBytes x) (FingerprintPrism.softBytes y)

        tie sim threshold a b

    /// Whether two strands are tied at the threshold (the boolean face of `tie`).
    let tied (similarity: 'w -> 'w -> float) (threshold: float) (a: 'w) (b: 'w) : bool =
        (tie similarity threshold a b).IsSome
