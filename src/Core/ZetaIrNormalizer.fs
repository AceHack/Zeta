namespace Zeta

/// Verified normalizer for the zeta-ir grammar.
/// Lowers any v1-v4 IR into the minimal generating set (the "core four"):
/// { Mul, Add, XShrXor, XRotXor }.
/// 
/// Reductions:
/// - `XorShr s` -> `XShrXor [s]`
/// - `Rotl r` -> `XRotXor [0; r]` (via self-cancellation: x ^ x ^ rotl(x,r) = rotl(x,r))
/// - All other ops are preserved as they are already in the core four.
namespace Zeta.Core

module ZetaIrNormalizer =
    open Zeta.Core

    /// Returns true if the op is one of the core four (Mul, Add, XShrXor, XRotXor).
    let isCoreOp (op: ZetaIrV4.Op) : bool =
        match op with
        | ZetaIrV4.Mul _ -> true
        | ZetaIrV4.Add _ -> true
        | ZetaIrV4.XShrXor _ -> true
        | ZetaIrV4.XRotXor _ -> true
        | ZetaIrV4.XorShr _ -> false
        | ZetaIrV4.Rotl _ -> false

    /// Normalizes a single operation into the core four.
    let normalizeOp (op: ZetaIrV4.Op) : ZetaIrV4.Op =
        match op with
        | ZetaIrV4.XorShr s -> ZetaIrV4.XShrXor [ s ]
        | ZetaIrV4.Rotl r -> ZetaIrV4.XRotXor [ 0L; r ]
        | coreOp -> coreOp

    /// Normalizes an entire IR program into the core four.
    let normalize (ir: ZetaIrV4.Ir) : ZetaIrV4.Ir =
        { ir with Ops = ir.Ops |> List.map normalizeOp }

    /// Evaluates a single v4 op over uint64, for denotation testing.
    let evalOp64 (op: ZetaIrV4.Op) (state: uint64) : uint64 =
        let rotl64 (x: uint64) (k: int) =
            let k = ((k % 64) + 64) % 64
            if k = 0 then x else (x <<< k) ||| (x >>> (64 - k))
        match op with
        | ZetaIrV4.Mul k -> state * uint64 k
        | ZetaIrV4.Add k -> state + uint64 k
        | ZetaIrV4.XorShr s -> state ^^^ (state >>> int s)
        | ZetaIrV4.Rotl r -> rotl64 state (int r)
        | ZetaIrV4.XRotXor rs ->
            let folded = rs |> List.fold (fun acc r -> acc ^^^ rotl64 state (int r)) 0UL
            state ^^^ folded
        | ZetaIrV4.XShrXor ss ->
            let folded = ss |> List.fold (fun acc s -> acc ^^^ (state >>> int s)) 0UL
            state ^^^ folded

    /// Evaluates a single v4 op over uint32, for denotation testing.
    let evalOp32 (op: ZetaIrV4.Op) (state: uint32) : uint32 =
        let rotl32 (x: uint32) (k: int) =
            let k = ((k % 32) + 32) % 32
            if k = 0 then x else (x <<< k) ||| (x >>> (32 - k))
        match op with
        | ZetaIrV4.Mul k -> state * uint32 k
        | ZetaIrV4.Add k -> state + uint32 k
        | ZetaIrV4.XorShr s -> state ^^^ (state >>> int s)
        | ZetaIrV4.Rotl r -> rotl32 state (int r)
        | ZetaIrV4.XRotXor rs ->
            let folded = rs |> List.fold (fun acc r -> acc ^^^ rotl32 state (int r)) 0u
            state ^^^ folded
        | ZetaIrV4.XShrXor ss ->
            let folded = ss |> List.fold (fun acc s -> acc ^^^ (state >>> int s)) 0u
            state ^^^ folded
