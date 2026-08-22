namespace Zeta.Core

/// **`BitAdinkra` — layer the Adinkra doubly-even code over the 1-bit identity stream (Aaron 2026-06-08, shadow*).**
///
/// Aaron: *"we should be able to bit like adinkras on top of our 1-bit, or use our 1-bit to generate with
/// adinkras."* The 1-bit identity stream (drift / `BitGan` / the phasor-qubit, the irreducible identity bit of
/// the anti-Sybil arc) is grouped into 4-bit messages and encoded by `AdinkraCode` (the published Gates
/// adinkra ↔ **doubly-even binary code** correspondence; the canonical **N=8** generator = the [8,4,4]
/// extended Hamming code, doubly-even + self-dual). Each 4 identity bits → an 8-bit **doubly-even
/// codeword** — an **error-correcting layer over identity** generated *from* the 1-bit.
///
/// **N label corrected 2026-08-15:** this said "the canonical N=4 generator". That 4 was `k` — the code
/// DIMENSION, i.e. `AdinkraCode.dimension`, the 4-bit message width this module chunks to — read as `N`.
/// In the adinkra correspondence N is the code LENGTH, so N = 8 (`AdinkraCode.supercharges`). The
/// chunking below is unaffected and was always right: it groups by `AdinkraCode.dimension` because that
/// is the message width, and it already names that constant correctly.
///
/// **Why this is more than cute:** Gates et al. famously found **doubly-even error-correcting codes embedded
/// in the SUSY (adinkra) equations** — the result that fuelled the "is reality a simulation?" discussion. Our
/// 1-bit identity is the irreducible bit of the *sim-detection* arc (clock-drift = identity; "am I in a sim?",
/// #7096). Encoding identity through the adinkra code carries the *same code structure* Gates linked to
/// simulation, on our own substrate — error-correctable identity, anchored to the published correspondence.
///
/// **Honest scope (peel):** this LAYERS the *published* adinkra/doubly-even code (`AdinkraCode`, already
/// proven doubly-even + distance-4) over our bit stream — a real, useful construction (error-correcting
/// identity). It is NOT a claim that we discovered the SUSY code, nor that our `CayleyDickson` stack *induces*
/// this exact generator — that deeper claim is **open in `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §B**
/// (Vera's construction specifics). The Gates simulation framing is the Beacon anchor, not our result.
/// Deterministic (DST §7); pure GF(2) over the existing `AdinkraCode`.
[<RequireQualifiedAccess>]
module BitAdinkra =

    /// Group a 1-bit identity stream into `AdinkraCode.dimension`-bit (4-bit) messages, zero-padding a final
    /// short group (so a partial group of identity bits still encodes). Deterministic.
    let toMessages (bits: int list) : int[] list =
        bits
        |> List.map (fun b -> if b <> 0 then 1 else 0)
        |> List.chunkBySize AdinkraCode.dimension
        |> List.map (fun chunk ->
            let m = Array.zeroCreate AdinkraCode.dimension
            chunk |> List.iteri (fun i b -> m.[i] <- b)
            m)

    /// Encode the 1-bit identity stream into Adinkra codewords: each 4 identity bits → an 8-bit doubly-even
    /// codeword (error-correcting identity). "Use our 1-bit to generate with adinkras."
    let encodeIdentity (bits: int list) : int[] list =
        toMessages bits |> List.map AdinkraCode.encode

    /// Every codeword the identity stream generates is **doubly-even** (Hamming weight ≡ 0 mod 4) — the Gates
    /// adinkra/SUSY code property, carried by identity. (Holds by construction; this checks it.)
    let allDoublyEven (codewords: int[] list) : bool =
        codewords |> List.forall (fun c -> AdinkraCode.weight c % 4 = 0)

    /// One step: 4 identity bits → the single adinkra codeword (the atomic "generate with adinkras" op).
    let encodeNibble (b0: int) (b1: int) (b2: int) (b3: int) : int[] =
        AdinkraCode.encode [| (if b0 <> 0 then 1 else 0)
                              (if b1 <> 0 then 1 else 0)
                              (if b2 <> 0 then 1 else 0)
                              (if b3 <> 0 then 1 else 0) |]
