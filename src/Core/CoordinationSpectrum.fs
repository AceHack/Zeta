namespace Zeta.Core

open Zeta.Core.Optics

/// **`CoordinationSpectrum` — the S-spectrum as a soft-rainbow fingerprint (Aaron 2026-07-02:**
/// "forgery is detectable as a cost signature — this signature becomes a kind of
/// replication-of-identity fingerprint, some sort of prism/refraction effect").
///
/// The CHSH probe battery (`AntiSybil.chshS`) is a **prism**: push a set of claimed identities
/// through it and one source wearing many faces DISPERSES into a characteristic pairwise-S
/// spectrum (Kirchhoff–Bunsen for entities — the lines tell you what is really burning). That
/// spectrum is a fingerprint a soft `FingerprintPrism.Rainbow` can recognize across attempts, so
/// a repeat source is known by its refraction even under fresh names. Anchor: Pappu 2002,
/// *Physical One-Way Functions* — the original PUF read identity from laser speckle through a
/// scattering medium (identity-by-refraction, literally, in Science).
///
/// **DUAL USE — NAMED IN THE INTERFACE, NOT BURIED (Aaron 2026-07-02: "always treat things like
/// forgery as dual use, there may be legitimate use cases").** Recognizing "this is the same
/// source we saw before" is ONE mechanism with (at least) two honest readings, and the mechanism
/// does NOT choose between them — the oracle does (Multi-Oracle Principle, manifesto §11):
///   • **REUNION** — an honest identity that lost its key/name is recognized as its returning self
///     and reconnected (the good case; consent-first, the returner WANTS to be found).
///   • **SYBIL** — a forger minting fresh names is recognized as one source and its collapse is
///     priced (the adversary case).
/// `SpectrumMatch` reports the recognition as the neutral fact it is (`SameSourceAsKnown of label`);
/// whether that fact means "welcome back" or "caught" is a policy decision the caller owns. Pure
/// (no classes — meta-rule); deterministic (DST §7).
[<RequireQualifiedAccess>]
module CoordinationSpectrum =

    /// A claimed-identity set's coordination spectrum: the SORTED vector of pairwise |CHSH S| over
    /// the claimants (sorted ⇒ permutation-invariant — the spectrum is a property of the SET, not
    /// the order it was listed in). One conducted (shared-source) pair pushes a line toward 4; a
    /// fully-independent set sits near 0. Empty/singleton sets ⇒ empty spectrum.
    let ofClaims (streams: AntiSybil.ChshRound list list) : float[] =
        let arr = List.toArray streams
        // chshS is argument-asymmetric (CHSH's −E(a,b') term), but coordination between two
        // sources is a property of the UNORDERED pair — symmetrize to the brighter reading so
        // the spectrum depends only on the SET, not the listing order.
        let line a b = max (abs (AntiSybil.chshS a b)) (abs (AntiSybil.chshS b a))
        [| for i in 0 .. arr.Length - 1 do
               for j in i + 1 .. arr.Length - 1 do
                   yield line arr.[i] arr.[j] |]
        |> Array.sort

    /// Spectral similarity in [0,1]: 1 − (normalized L1 distance / 4), clamped. Spectra of
    /// different lengths are compared on their shared leading lines (the brightest coordination
    /// lines dominate the signature); disjoint lengths beyond the overlap count as full distance.
    /// 1.0 = identical dispersion, 0.0 = maximally different. Used as the soft-rainbow distance.
    let similarity (a: float[]) (b: float[]) : float =
        let n = max a.Length b.Length
        if n = 0 then 1.0
        else
            let at i = if i < a.Length then a.[i] else 0.0
            let bt i = if i < b.Length then b.[i] else 0.0
            let l1 = Seq.sumBy (fun i -> abs (at i - bt i)) [ 0 .. n - 1 ]
            max 0.0 (1.0 - l1 / (4.0 * float n))

    /// A labeled known source: a coordination spectrum plus the label the caller uses to name it
    /// (an honest identity's handle, a flagged-forger tag — the label is the caller's, neutral here).
    type KnownSource = { Label: string; Spectrum: float[] }

    /// The neutral recognition verdict — the FACT, not its moral reading (dual use: the caller's
    /// policy decides whether `SameSourceAsKnown` means reunion or conviction).
    type SpectrumMatch =
        | SameSourceAsKnown of label: string * similarity: float
        | NoKnownSource

    /// Build a soft rainbow over known sources' spectra. The fingerprint is the spectrum itself
    /// (identity on `float[]`); the soft prism matches by `similarity ≥ threshold`.
    let rainbow (known: KnownSource list) : FingerprintPrism.Rainbow<KnownSource, float[]> =
        (FingerprintPrism.empty (fun k -> k.Spectrum), known)
        ||> List.fold (fun r k -> FingerprintPrism.add k r)

    /// Recognize a claimed-identity set's spectrum against known sources at `threshold`. Returns the
    /// most-similar known source clearing the bar (the neutral fact); the caller's oracle decides
    /// what to DO with a match (reunion vs Sybil — both legitimate).
    let recognize (threshold: float) (known: KnownSource list) (probe: float[]) : SpectrumMatch =
        let table = rainbow known
        let sim = FingerprintPrism.soft (fun x y -> similarity x.Spectrum y.Spectrum) threshold table
        // wrap the probe spectrum as an unlabeled KnownSource so the prism can compare it
        match sim.Match { Label = ""; Spectrum = probe } with
        | Some k -> SameSourceAsKnown(k.Label, similarity probe k.Spectrum)
        | None -> NoKnownSource
