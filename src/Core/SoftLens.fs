namespace Zeta.Core

/// SoftLens — **the soft-lensing sweep, implemented** (filed in the naming doc; Aaron: "a soft lensing
/// technique for finding fingerprints — or more solid ground").
///
/// The composition, exactly as named: a WINDOW (the lens focus) swept over a field, each focus scored
/// two ways — **similarity** against a needle (the soft prism's MinHash kernel: fingerprint peaks =
/// FOUND structure) and **confidence** (the PixelLens uncertainty channel: certainty peaks = SOLID
/// GROUND). Same sweep, two channels; the output is a heat map of recognition and a ground map of
/// where to stand. Deterministic, total, zero clocks (every window scores independently — the
/// infinite-draw-threads property holds for ANALYSIS too).
[<RequireQualifiedAccess>]
module SoftLens =

    /// One scored focus: where the lens was, how strongly the needle matched, how certain the ground.
    type Focus =
        { X: int
          Y: int
          Similarity: float
          Confidence: float }

    /// Extract a w×h window's bytes from a field reader (row-major; the reader is any (x,y) → byte —
    /// a trace frame's colorAt, a sub-pixel payload sheet, a masked ROM rendered to cells).
    let window (read: int -> int -> byte) (x0: int) (y0: int) (w: int) (h: int) : byte[] =
        [| for dy in 0 .. h - 1 do
               for dx in 0 .. w - 1 -> read (x0 + dx) (y0 + dy) |]

    /// THE SWEEP: slide a w×h lens over a fieldW×fieldH field (stride 1), scoring each focus —
    /// similarity = soft-prism MinHash vs the needle; confidence = the mean confidence the
    /// `conf` reader reports over the window (1.0 where the field carries no uncertainty channel).
    let sweep
        (read: int -> int -> byte)
        (conf: int -> int -> float)
        (needle: byte[])
        (fieldW: int)
        (fieldH: int)
        (w: int)
        (h: int)
        : Focus list =
        let needleSketch = FingerprintPrism.softBytes needle

        [ for y0 in 0 .. fieldH - h do
              for x0 in 0 .. fieldW - w do
                  let bytes = window read x0 y0 w h
                  let sim = FingerprintPrism.softBytesSimilarity needleSketch (FingerprintPrism.softBytes bytes)

                  let c =
                      let mutable acc = 0.0
                      for dy in 0 .. h - 1 do
                          for dx in 0 .. w - 1 do
                              acc <- acc + conf (x0 + dx) (y0 + dy)
                      acc / float (w * h)

                  yield { X = x0; Y = y0; Similarity = sim; Confidence = c } ]

    /// FINGERPRINT peaks: the foci whose similarity clears the threshold, best first.
    let fingerprints (threshold: float) (foci: Focus list) : Focus list =
        foci |> List.filter (fun f -> f.Similarity >= threshold) |> List.sortByDescending (fun f -> f.Similarity)

    /// SOLID-GROUND peaks: the foci whose confidence clears the threshold, best first — where to stand.
    let solidGround (threshold: float) (foci: Focus list) : Focus list =
        foci |> List.filter (fun f -> f.Confidence >= threshold) |> List.sortByDescending (fun f -> f.Confidence)
