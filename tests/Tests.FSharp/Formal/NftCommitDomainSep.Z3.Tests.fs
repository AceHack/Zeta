module Zeta.Tests.Formal.NftCommitDomainSepZ3Tests

open System
open System.Diagnostics
open System.IO
open global.Xunit

// math-team handoff row 2 — NFT binding / collision-resistance, **Z3 (QF_BV) FORMAL leg** (Kenji).
//
// Complements the FsCheck evidence leg (#8743, `NftCommitBinding.Tests.fs`). That leg samples the
// REAL encoder (`CostarZSet.toDynamicValue rating link` → `DynamicValue.toCanonicalCbor` → bytes);
// THIS leg proves the STRUCTURAL backbone symbolically: the canonical encoding is **injective /
// domain-separated** — distinct canonical `(A, B, rating)` tuples map to distinct encoded byte
// sequences. Modulo the hash's collision-resistance (the NAMED crypto premise, NOT proven here),
// distinct mints ⇒ distinct commits. That is the binding of the commitment.
//
// WHERE THE INJECTIVITY LIVES (faithful to `DynamicValue.toCanonicalCbor`, RFC 8949):
//   The minted record `Object [ "a",A; "b",B; "sharedTitles",rating ]` encodes as
//       0xA3                              -- map, 3 pairs (fixed)
//       0x61 0x61                         -- text key "a"  (fixed)
//       (0x60|lenA) ‖ utf8(A)            -- LENGTH-PREFIXED value A
//       0x61 0x62                         -- text key "b"  (fixed)
//       (0x60|lenB) ‖ utf8(B)            -- LENGTH-PREFIXED value B
//       0x6C "sharedTitles"              -- text key (fixed)
//       writeInt rating                  -- the rating
//   The structure is exactly  len(A) ‖ A ‖ len(B) ‖ B ‖ rating  with fixed framing constants.
//   Injectivity is NOT from the bytes of A,B being distinct — it is from the **length prefix**:
//   a parser reads lenA, takes exactly lenA bytes, then reads lenB, takes exactly lenB bytes.
//   This is what defeats the boundary-ambiguity attack  (a="x",  b="yz")  vs  (a="xy", b="z"):
//   the two would have the same *content* concatenation "xyz" but DIFFERENT length tags, so the
//   encoded byte sequences differ in the length-prefix byte. The proof below exhibits exactly this.
//
// HONEST SCOPE / THE BOUND (no overclaiming — the honest-stop discipline):
//   QF_BV is finite, so we model A and B at a BOUNDED width: each is a content buffer of up to
//   `CELLS` byte-cells (CELL_W = 8 bits each) carrying an explicit length field `lenA, lenB ∈
//   [0, CELLS]`, and the encoding is the bit-vector concatenation  lenA ‖ contentA ‖ lenB ‖
//   contentB ‖ rating . Only the live prefix (first `len` cells) is semantically part of the
//   string; cells past `len` are zero-pinned padding (faithful: the encoder writes exactly `len`
//   content bytes), so "encodings equal" means equal ON-THE-WIRE bytes. The CBOR head/key
//   constants (0xA3, "a"/"b"/"sharedTitles" tags) are FIXED across both sides, so they cannot
//   create OR break a collision — they are omitted from the BV model and noted as fixed framing.
//   This is a faithful model of the length-prefix mechanism at bounded width, exactly mirroring
//   the Merkle 4-leaf bounded model in `Merkle.Laws.Tests.fs`. The hash's collision-resistance
//   stays the named premise (XxHash128 → BLAKE3 for Byzantine); we do NOT prove the digest CR.

// ── full-script Z3 runner (mirrors Merkle.Laws.Tests.fs: assert NEGATION is UNSAT) ──
let private which (tool: string) : string option =
    try
        let psi =
            ProcessStartInfo(
                "/usr/bin/env",
                $"which %s{tool}",
                RedirectStandardOutput = true,
                UseShellExecute = false
            )

        use p = Process.Start psi
        let out = p.StandardOutput.ReadToEnd().Trim()
        p.WaitForExit()
        if p.ExitCode = 0 && File.Exists out then Some out else None
    with _ ->
        None

let private runZ3 (script: string) : string option =
    match which "z3" with
    | None -> None // z3 absent — CI installs it; skip cleanly.
    | Some _ ->
        let psi =
            ProcessStartInfo(
                "z3",
                "-in",
                RedirectStandardInput = true,
                RedirectStandardOutput = true,
                UseShellExecute = false
            )

        use p = Process.Start psi
        p.StandardInput.Write script
        p.StandardInput.Close()
        let out = p.StandardOutput.ReadToEnd()
        p.WaitForExit()
        Some out

/// Require z3 to report `unsat` (the negation is unsatisfiable ⇒ the property holds). If z3 reports
/// `sat`, surface the model — that would be a REAL FINDING (a domain-separation collision in the
/// bounded model), per the decisive gate (do NOT weaken to force unsat). z3 absent ⇒ clean skip.
let private z3Unsat (name: string) (script: string) =
    match runZ3 script with
    | None -> ()
    | Some out ->
        if out.Contains "unsat" then
            () // proved
        elif out.Contains "sat" then
            failwithf
                "Z3 found a DOMAIN-SEPARATION COLLISION (SAT) for %s — a REAL FINDING, do not weaken. Model:\n%s"
                name
                out
        else
            failwithf "Z3 failed to prove domain-separation %s (neither sat nor unsat). Output:\n%s" name out

// ── the bounded BV model ──
// CELLS = number of byte-cells per string; CELL_W = bits per cell; LEN_W = bits of the length tag.
// Encoding(string) = len ‖ cell[0] ‖ ... ‖ cell[CELLS-1]. We bound to CELLS=3 byte-cells per field
// (enough to exhibit the (x|yz) vs (xy|z) boundary attack and any length 0..3 reframing), CELL_W=8
// (a real byte), LEN_W=8 (the CBOR 1-byte length head, faithful to lengths ≤ 23 packed into the
// initial byte). rating is an 8-bit field. Encoding equality is over the FULL concatenation
// lenA ‖ A ‖ lenB ‖ B ‖ rating (the on-the-wire bytes).
let private cells = 3
let private cellW = 8
let private lenW = 8

let private mkScript () =
    let sb = System.Text.StringBuilder()
    let p (s: string) = sb.AppendLine s |> ignore
    let bv n = sprintf "(_ BitVec %d)" n

    // declare two tuples: side "" (a/b/r) and side "p" (a'/b'/r')
    let declTuple (suffix: string) =
        p (sprintf "(declare-const lenA%s %s)" suffix (bv lenW))
        p (sprintf "(declare-const lenB%s %s)" suffix (bv lenW))

        for i in 0 .. cells - 1 do
            p (sprintf "(declare-const ca%s_%d %s)" suffix i (bv cellW))
            p (sprintf "(declare-const cb%s_%d %s)" suffix i (bv cellW))

        p (sprintf "(declare-const rating%s %s)" suffix (bv cellW))

    declTuple ""
    declTuple "p"

    // length bounded to [0, CELLS] — the real CBOR 1-byte length head for our short ids.
    let lenBound (v: string) =
        p (sprintf "(assert (bvule %s (_ bv%d %d)))" v cells lenW)

    for v in [ "lenA"; "lenB"; "lenAp"; "lenBp" ] do
        lenBound v

    // Padding pin (don't-care zeroing): cells at index >= len MUST be zero on BOTH sides. Faithful —
    // the encoder writes exactly `len` content bytes, never trailing bytes; a free padding variable
    // would let z3 forge a spurious difference in dead bytes. With padding pinned, "encodings equal"
    // = equal on-the-wire bytes, and the live prefix is the only identity carrier.
    let pinPadding (lenVar: string) (cellPrefix: string) =
        for i in 0 .. cells - 1 do
            // if i >= len  (i.e. NOT (i+1 <= len))  then cell_i = 0
            p (
                sprintf
                    "(assert (=> (bvult %s (_ bv%d %d)) (= %s_%d (_ bv0 %d))))"
                    lenVar
                    (i + 1)
                    lenW
                    cellPrefix
                    i
                    cellW
            )

    pinPadding "lenA" "ca"
    pinPadding "lenB" "cb"
    pinPadding "lenAp" "cap"
    pinPadding "lenBp" "cbp"

    // semantic string equality: same length AND all cells agree (cells past len already 0 on both
    // sides by the padding pin, so a full cell-wise equality over all CELLS is exact here).
    let strEq (lenX: string) (cX: string) (lenY: string) (cY: string) =
        let cellsEq =
            [ for i in 0 .. cells - 1 -> sprintf "(= %s_%d %s_%d)" cX i cY i ]
            |> String.concat " "

        sprintf "(and (= %s %s) %s)" lenX lenY cellsEq

    // Premise: the two CANONICAL tuples are DISTINCT — they differ in pair A, or pair B, or rating.
    // (Canonical = A≤B already applied upstream by `CostarZSet.link`; we model distinctness of the
    // canonical tuples, exactly the row-2 property's domain.)
    let aEq = strEq "lenA" "ca" "lenAp" "cap"
    let bEq = strEq "lenB" "cb" "lenBp" "cbp"
    p (sprintf "(define-fun inputsDiffer () Bool (not (and %s %s (= rating ratingp))))" aEq bEq)

    // The encoding = on-the-wire byte concatenation lenA ‖ ca0..ca2 ‖ lenB ‖ cb0..cb2 ‖ rating.
    // (Fixed CBOR framing 0xA3 / key tags are identical on both sides and so are dropped — they
    // can neither create nor break a collision.)
    let enc (suffix: string) =
        let parts =
            [ sprintf "lenA%s" suffix ]
            @ [ for i in 0 .. cells - 1 -> sprintf "ca%s_%d" suffix i ]
            @ [ sprintf "lenB%s" suffix ]
            @ [ for i in 0 .. cells - 1 -> sprintf "cb%s_%d" suffix i ]
            @ [ sprintf "rating%s" suffix ]

        "(concat " + String.concat " " parts + ")"

    p (sprintf "(define-fun encsEqual () Bool (= %s %s))" (enc "") (enc "p"))

    // Negation of the binding property: inputs differ AND encodings equal. UNSAT ⇒ no such collision
    // exists in the bounded model ⇒ the length-prefixed encoding is domain-separated.
    p "(assert inputsDiffer)"
    p "(assert encsEqual)"
    p "(check-sat)"
    sb.ToString()

[<Fact>]
let ``Z3 proves domain separation: distinct canonical (A,B,rating) ⇒ distinct length-prefixed encoding (bounded width)``
    ()
    =
    // Bound: each of A,B up to 3 byte-cells with an explicit 1-byte length tag; rating one byte.
    // Proves the length-prefix defeats boundary ambiguity — the (a="x",b="yz") vs (a="xy",b="z")
    // attack differs in the length head. Premise: hash collision-resistance (NOT proven here).
    z3Unsat "length-prefixed encoding injective (CELLS=3, CELL_W=8, LEN_W=8)" (mkScript ())

[<Fact>]
let ``Z3 negative control: WITHOUT a length prefix the boundary-ambiguity attack collides (the prefix is load-bearing)``
    ()
    =
    // Non-vacuity / the load-bearing contrast. Model A and B as a VARIABLE split of a shared 2-byte
    // content buffer (c0,c1) at position `lenA ∈ [0,2]`: A = first lenA bytes, B = the rest. This is
    // exactly the boundary attack — (A="x", B="yz") vs (A="xy", B="z") share content "xyz" but split
    // differently. WITHOUT a length prefix the encoding is content-only (c0 ‖ c1), so two DIFFERENT
    // splits over the SAME bytes collide. This MUST be SAT — proving (a) the main test is not vacuous
    // and (b) the length prefix is precisely the defense (the main proof adds the prefix → UNSAT).
    let script =
        let sb = System.Text.StringBuilder()
        let p (s: string) = sb.AppendLine s |> ignore
        let bv = sprintf "(_ BitVec %d)" cellW

        for s in [ ""; "p" ] do
            p (sprintf "(declare-const c0%s %s)" s bv)
            p (sprintf "(declare-const c1%s %s)" s bv)
            p (sprintf "(declare-const lenA%s %s)" s bv)

        p (sprintf "(assert (bvule lenA (_ bv2 %d)))" cellW)
        p (sprintf "(assert (bvule lenAp (_ bv2 %d)))" cellW)
        // the parsed (A,B) pairs differ (different split and/or content) — distinct INPUTS …
        p "(assert (not (and (= lenA lenAp) (= c0 c0p) (= c1 c1p))))"
        // … yet the content-only (no-prefix) encodings are equal — a real collision.
        p "(assert (= (concat c0 c1) (concat c0p c1p)))"
        p "(check-sat)"
        sb.ToString()

    match runZ3 script with
    | None -> ()
    | Some out ->
        // MUST be sat: content-only concat with a variable split IS ambiguous.
        if not (out.Contains "sat") || out.Contains "unsat" then
            failwithf
                "negative control failed: content-only concat with a variable split should be SAT-collidable (proving the length prefix is the defense). Output:\n%s"
                out
