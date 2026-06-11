namespace Zeta.Core

/// SpectralPivot — **the soft and hard FFT: fingerprinting into spectral, a pivot in phase spaces**
/// (Aaron 2026-06-11: "since we have audio we probably need some sort of soft and hard FFT — it's
/// kind of like fingerprinting into spectral; it's like a pivot in phase spaces").
///
/// Exactly the rainbow-table shape, in frequency:
/// - **HARD** — the exact DFT (O(n²), honest — the n·log n fast factorization is the named upgrade):
///   the full spectral fingerprint, the lossless PIVOT between phase spaces — time↔frequency are two
///   bases for one signal, and the pivot is invertible (the inverse round-trip is a TEST).
/// - **SOFT** — the probe (Goertzel-shaped): evaluate just k chosen bins — the spectral MinHash: a
///   cheap fingerprint that answers "is THIS pitch in there?" without paying for the whole spectrum
///   (the soft prism pointed at frequency space).
/// Both run on the Cayley complex we already have (the twiddle factors are rotor applications —
/// the same algebra that draws spirals and interferes waves now hears pitch).
[<RequireQualifiedAccess>]
module SpectralPivot =

    let private tau = 2.0 * System.Math.PI

    /// HARD: the exact DFT of a real signal — bin k's phasor (Cayley complex), for all n bins.
    let dft (signal: float[]) : Complex[] =
        let n = signal.Length
        [| for k in 0 .. n - 1 ->
               let mutable acc = Doubled.make 0.0 0.0
               for t in 0 .. n - 1 do
                   let ang = -tau * float k * float t / float n
                   let tw = Doubled.make (cos ang) (sin ang)
                   let s = Doubled.make signal.[t] 0.0
                   acc <- ImaginaryStack.complex.Add(acc, ImaginaryStack.complex.Mul(s, tw))
               acc |]

    /// The inverse pivot: back from frequency to time (the round-trip proves the pivot loses nothing).
    let idft (spectrum: Complex[]) : float[] =
        let n = spectrum.Length
        [| for t in 0 .. n - 1 ->
               let mutable acc = Doubled.make 0.0 0.0
               for k in 0 .. n - 1 do
                   let ang = tau * float k * float t / float n
                   let tw = Doubled.make (cos ang) (sin ang)
                   acc <- ImaginaryStack.complex.Add(acc, ImaginaryStack.complex.Mul(spectrum.[k], tw))
               acc.Real / float n |]

    /// A bin's energy (the fingerprint's coordinate).
    let energy (c: Complex) : float = c.Real * c.Real + c.Imag * c.Imag

    /// SOFT: probe ONE bin (Goertzel-shaped, O(n)) — the spectral soft-prism: "is this pitch there?"
    let probe (signal: float[]) (k: int) : float =
        let n = signal.Length
        let mutable acc = Doubled.make 0.0 0.0
        for t in 0 .. n - 1 do
            let ang = -tau * float k * float t / float n
            acc <- ImaginaryStack.complex.Add(acc, Doubled.make (signal.[t] * cos ang) (signal.[t] * sin ang))
        energy acc

    /// The soft FINGERPRINT: k probe bins (the spectral MinHash — cheap, comparable, honest about
    /// what it didn't look at).
    let fingerprint (bins: int list) (signal: float[]) : (int * float) list =
        bins |> List.map (fun k -> k, probe signal k)
