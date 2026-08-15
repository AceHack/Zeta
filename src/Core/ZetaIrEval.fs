namespace Zeta.Core

/// ZetaIrEval — THE canonical evaluator for the zeta generator IR.
///
/// WHY THIS EXISTS (the finding it closes)
/// ---------------------------------------
/// Before this module the IR had **no canonical evaluator anywhere**. Op semantics lived in
/// doc comments and in ~22 independently-written interpreters:
///
///   * `ZetaIrNormalizer.evalOp64` / `evalOp32`  (F#, op-level, two separate transcriptions)
///   * `NormalizerCorrect.lean` `evalOp`         (Lean, UInt64 only)
///   * `gen-smt2-from-ir.ts` `renderOp`          (SMT-LIB, two deliberately-distinct sides)
///   * `codegen-from-ir.ts`                      (seven per-language emitters)
///   * `tests/cross-verification/*/_gen/gen.ts`  (NINE per-primitive TS interpreters)
///
/// Every one of those answers "what does `xrotxor` do" for itself, and none of them is the
/// authority. That is the root cause of both defects PR #10779 found: four of seven emitters
/// ignored `ir.Width`, and every emitter turned an op outside v1's two-op grammar into a
/// silent `xorshr undefined`. Neither is possible against a referent; both are inevitable
/// across N private answers.
///
/// WHAT IT IS — AND IS NOT
/// -----------------------
/// This is a **reference semantics**, not a runtime. It answers exactly one question:
/// *given an IR and an input word, what is the output word?* It has no state, no control
/// flow, no host interop, and it is deliberately NOT wired into any emitter — an emitter
/// that called it would stop being an independent observation and start being a tautology
/// (`.claude/rules/numerology-vs-number-theory.md`: N implementations sharing one
/// implementation agree by construction, which is one observation counted N times).
///
/// It is also NOT an (N+1)th peer in the `cross-verify-ir.ts` vote. `cross-verify-ir` asks
/// *do the generated lanes agree with each other* (consistency); `ir-vs-handwritten.ts` asks
/// *does the IR say what the published algorithm says* (adequacy, via hand ports). This
/// module is **definitional**: the thing the other lanes are checked *against*, not a ballot
/// cast alongside them.
///
/// WIDTH IS TAKEN FROM THE IR, NEVER FROM THE CALLER
/// -------------------------------------------------
/// `ir.Width` is the field four emitters ignored, so the evaluator must not merely *avoid*
/// that mistake — it must make it **detectable**. Three properties do that:
///
///   1. The width is read from the IR. There is no `run64` / `run32` pair to pick wrongly;
///      compare `ZetaIrNormalizer.evalOp64`/`evalOp32`, where a caller holding a width-32 IR
///      can call the 64-bit function and receive a plausible, silently wrong answer.
///   2. An input that does not fit the IR's width is **rejected**, not masked. A width-32 IR
///      handed 2^32 fails by name instead of quietly computing on truncated data.
///   3. A width outside {32, 64} is **rejected**. Approximating an unrepresentable width is
///      the defect, not the fallback.
///
/// TOTALITY IS ENFORCED BY THE COMPILER
/// ------------------------------------
/// The match over `ZetaIrV4.Op` is exhaustive, and this repo builds with
/// TreatWarningsAsErrors — so FS0025 (incomplete pattern match) makes "someone added a v5 op
/// and forgot the evaluator" a **build failure**, not a runtime fall-through. That is the
/// structural cure for defect 2: in a TypeScript string-union switch the `default:` throw is
/// a line you have to remember to write; here the absence of a case does not compile.
/// The JSON boundary is guarded separately by `ZetaIrV4.validate`, which already names an
/// out-of-grammar op rather than accepting it.
///
/// TIER (`.claude/rules/toy-is-free-metered-must-be-earned.md`)
/// -----------------------------------------------------------
/// **metered.** The falsifier is `ZetaIrEval.Tests`: all NINE committed IRs are folded over
/// the committed `vectors.yaml` goldens (90 vectors), and mutated IRs — transposed ops,
/// a dropped op, the wrong width — are asserted to DIVERGE from those goldens. A check that
/// cannot fail is not a check.
///
/// SCOPE / NOT CLAIMED
/// -------------------
/// Widths 32 and 64 only (the two the repo uses). Shift amounts must be in `[0, width)`:
/// a shift of `width` or more is mathematically zero but .NET masks the shift count
/// (`x >>> 64` on a uint64 is `x >>> 0`), so rather than encode a choice no committed IR
/// exercises, this module refuses it. Rotations ARE reduced mod width, which is the total,
/// unambiguous reading and matches `ZetaIrNormalizer.rotl64`.
[<RequireQualifiedAccess>]
module ZetaIrEval =

    /// The widths this evaluator defines semantics for. Anything else is REJECTED.
    let supportedWidths: int list = [ 32; 64 ]

    /// The mask selecting the low `width` bits.
    let private maskOf (width: int) : uint64 =
        if width = 64 then
            System.UInt64.MaxValue
        else
            (1UL <<< width) - 1UL

    /// Rotate-left within `width` bits. `r` is reduced mod width (total, unambiguous).
    let private rotl (width: int) (mask: uint64) (x: uint64) (r: int64) : uint64 =
        let w = int64 width
        let k = int (((r % w) + w) % w)
        if k = 0 then x &&& mask
        else ((x <<< k) ||| ((x &&& mask) >>> (width - k))) &&& mask

    /// Reinterpret a stored signed-int64 constant as an unsigned word of `width` bits.
    /// (v1..v4 store u-word multipliers/addends as their signed bit-pattern; arithmetic is
    /// mod 2^width, so the reinterpretation is bit-exact.)
    let private constOf (mask: uint64) (k: int64) : uint64 = (uint64 k) &&& mask

    /// Validate a shift amount for `width`. Refuses negatives and `>= width` — see the
    /// module header for why `>= width` is refused rather than defined.
    let private checkShift (width: int) (label: string) (s: int64) : Result<int, string> =
        if s < 0L then
            Error(sprintf "op `%s`: shift amount %d is negative" label s)
        elif s >= int64 width then
            Error(
                sprintf
                    "op `%s`: shift amount %d is not less than width %d (a shift of width-or-more is left UNDEFINED by this evaluator; .NET masks the shift count, so defining it silently would encode a divergence)"
                    label
                    s
                    width
            )
        else
            Ok(int s)

    /// Apply one op to the accumulator. Total over `ZetaIrV4.Op` — an added op is a compile
    /// error here, never a runtime fall-through.
    let private step (width: int) (mask: uint64) (z: uint64) (op: ZetaIrV4.Op) : Result<uint64, string> =
        match op with
        | ZetaIrV4.Mul k -> Ok((z * constOf mask k) &&& mask)
        | ZetaIrV4.Add k -> Ok((z + constOf mask k) &&& mask)
        | ZetaIrV4.XorShr s ->
            match checkShift width "xorshr" s with
            | Ok s -> Ok((z ^^^ (z >>> s)) &&& mask)
            | Error e -> Error e
        | ZetaIrV4.Rotl r -> Ok(rotl width mask z r)
        | ZetaIrV4.XRotXor rs ->
            if List.isEmpty rs then
                Error "op `xrotxor`: term list is empty"
            else
                Ok((rs |> List.fold (fun acc r -> acc ^^^ rotl width mask z r) z) &&& mask)
        | ZetaIrV4.XShrXor ss ->
            if List.isEmpty ss then
                Error "op `xshrxor`: term list is empty"
            else
                let rec go acc remaining =
                    match remaining with
                    | [] -> Ok(acc &&& mask)
                    | s :: rest ->
                        match checkShift width "xshrxor" s with
                        | Ok s -> go (acc ^^^ (z >>> s)) rest
                        | Error e -> Error e

                go z ss

    /// Validate that `width` is one this evaluator defines semantics for.
    let checkWidth (width: int) : Result<int, string> =
        if List.contains width supportedWidths then
            Ok width
        else
            Error(
                sprintf
                    "width %d is not supported (supported: %s) — refusing to evaluate at a width whose semantics are undefined rather than silently approximating it"
                    width
                    (supportedWidths |> List.map string |> String.concat ", ")
            )

    /// Run a v4 IR over one input word.
    ///
    /// The width comes from `ir.Width` — never from the caller. An input outside
    /// `[0, 2^width)` is REJECTED rather than truncated, which is what makes a width mismatch
    /// visible instead of merely absent.
    let run (ir: ZetaIrV4.Ir) (x: uint64) : Result<uint64, string> =
        match checkWidth ir.Width with
        | Error e -> Error e
        | Ok width ->
            let mask = maskOf width

            if (x &&& mask) <> x then
                Error(
                    sprintf
                        "input %d does not fit width %d (max %d) — a truncated input is exactly how a width mismatch hides"
                        x
                        width
                        mask
                )
            else
                let rec go z remaining =
                    match remaining with
                    | [] -> Ok z
                    | op :: rest ->
                        match step width mask z op with
                        | Ok z' -> go z' rest
                        | Error e -> Error e

                go (x &&& mask) ir.Ops

    /// Run over a sequence of inputs, failing on the first rejection.
    let runMany (ir: ZetaIrV4.Ir) (xs: uint64 list) : Result<uint64 list, string> =
        let rec go acc remaining =
            match remaining with
            | [] -> Ok(List.rev acc)
            | x :: rest ->
                match run ir x with
                | Ok y -> go (y :: acc) rest
                | Error e -> Error e

        go [] xs

    // ── the JSON entry points (validate, THEN evaluate — never evaluate unvalidated) ──
    //
    // Evaluation is only ever defined on an IR that PARSED. Routing every text entry point
    // through the corresponding `validate` is what makes an unknown op fail loudly at the
    // boundary — `ZetaIrV4.validate` names it ("op `frobnicate` is not in the v4 grammar")
    // instead of letting it reach a default branch. Defect 2 was precisely a text-shaped op
    // reaching an emitter that had no case for it.

    /// Validate canonical-JSON as a **v4** IR, then run it.
    let runCanonicalJsonV4 (json: string) (x: uint64) : Result<uint64, string> =
        match ZetaIrV4.validateCanonicalJson json with
        | Ok ir -> run ir x
        | Error e -> Error e

    /// Validate canonical-JSON under whichever schema tag it carries (v1 | v2 | v3 | v4),
    /// widen it to v4, then run it. Rejects anything that no frozen validator accepts —
    /// including an unknown schema tag and an out-of-grammar op.
    let runCanonicalJsonAny (json: string) (x: uint64) : Result<uint64, string> =
        let widened =
            match ZetaIrV4.validateCanonicalJson json with
            | Ok ir -> Ok ir
            | Error e4 ->
                match ZetaIrV3.validateCanonicalJson json with
                | Ok ir -> Ok(ZetaIrV4.ofV3 ir)
                | Error e3 ->
                    match ZetaIrV2.validateCanonicalJson json with
                    | Ok ir -> Ok(ZetaIrV4.ofV2 ir)
                    | Error e2 ->
                        match ZetaIrV1.validateCanonicalJson json with
                        | Ok ir -> Ok(ZetaIrV4.ofV1 ir)
                        | Error e1 ->
                            Error(
                                sprintf
                                    "not a valid IR under any frozen schema — v4: %s | v3: %s | v2: %s | v1: %s"
                                    e4
                                    e3
                                    e2
                                    e1
                            )

        match widened with
        | Ok ir -> run ir x
        | Error e -> Error e
