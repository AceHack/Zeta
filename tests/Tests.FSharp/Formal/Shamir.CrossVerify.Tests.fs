module Zeta.Tests.Formal.ShamirCrossVerifyTests

open System
open System.Diagnostics
open System.IO
open System.Reflection
open System.Text.Json
open FsCheck
open FsCheck.Xunit
open FsUnit.Xunit
open global.Xunit
open Zeta.Core

// 081KVP3GYW1 BP-16 leg — Shamir k-of-n over GF(257). Three independent tools:
//   1. Z3 — field inverse + k=2 Lagrange reconstruction (symbolic, unbounded).
//   2. FsCheck — round-trip on the real Shamir module (finite samples).
//   3. Golden seed — F# agrees with tools/setup/persona-keys/shamir-golden-vectors.json
//      (TS oracle locks the same seed in shamir-golden.test.ts).

let private repoRoot () : string =
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location))
    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then failwith "Could not locate repo root (Zeta.sln)."
    dir.FullName

// ════════════════════════════════════════════════════════════════════
// 1. Z3 — GF(257) inverse + k=2 reconstruction identity.
// ════════════════════════════════════════════════════════════════════
let private which (tool: string) : string option =
    try
        let psi = ProcessStartInfo("/usr/bin/env", $"which %s{tool}",
                    RedirectStandardOutput = true, UseShellExecute = false)
        use p = Process.Start psi
        let out = p.StandardOutput.ReadToEnd().Trim()
        p.WaitForExit()
        if p.ExitCode = 0 && File.Exists out then Some out else None
    with _ -> None

let private z3Unsat (name: string) (script: string) =
    match which "z3" with
    | None -> () // z3 absent locally — CI installs it; skip cleanly.
    | Some _ ->
        let psi = ProcessStartInfo("z3", "-in",
                    RedirectStandardInput = true, RedirectStandardOutput = true, UseShellExecute = false)
        use p = Process.Start psi
        p.StandardInput.Write script
        p.StandardInput.Close()
        let out = p.StandardOutput.ReadToEnd()
        p.WaitForExit()
        if not (out.Contains "unsat") then
            failwithf "Z3 failed to prove shamir %s. Output:\n%s" name out

[<Fact>]
let ``Z3 proves k=2 Lagrange reconstruction recovers the secret byte`` () =
    // f(x) = s + c·x (mod 257). Shares y1=f(1), y2=f(2).
    // Reconstruct: 2·y1 − y2 ≡ s (mod 257). Prove ∀ s,c ∈ 0..256.
    let script =
        """
(set-logic QF_NIA)
(define-fun mod257 ((x Int)) Int (mod x 257))
(declare-const s Int)
(declare-const c Int)
(assert (and (>= s 0) (<= s 256)))
(assert (and (>= c 0) (<= c 256)))
(define-fun y1 () Int (mod257 (+ s c)))
(define-fun y2 () Int (mod257 (+ s (* 2 c))))
(define-fun reconstructed () Int (mod257 (- (* 2 y1) y2)))
(assert (not (= reconstructed s)))
(check-sat)
"""
    z3Unsat "k=2 lagrange" script

[<Fact>]
let ``Z3 proves k=3 Lagrange reconstruction recovers the secret byte`` () =
    // f(x) = s + c1·x + c2·x² (mod 257). Shares at x=1,2,3.
    // Full Lagrange at 0 — expand symbolically and assert = s.
    // Points (1,y1),(2,y2),(3,y3):
    // L0 = y1*(0-2)*(0-3)/((1-2)*(1-3)) + y2*(0-1)*(0-3)/((2-1)*(2-3)) + y3*(0-1)*(0-2)/((3-1)*(3-2))
    //    = y1*(6)/((-1)*(-2)) + y2*(3)/(1*(-1)) + y3*(2)/(2*1)
    //    = y1*(6)/2 + y2*(3)/(-1) + y3*(2)/2
    //    = 3·y1 − 3·y2 + y3  (mod 257), using inv(2)=129 since 2*129=258≡1.
    // Check: inv(2)=129, inv(-1)=256, inv(-2)= inv(255).
    // Safer: define modInv via explicit constants for the denominators used.
    let script =
        """
(set-logic QF_NIA)
(define-fun mod257 ((x Int)) Int (mod x 257))
(declare-const s Int)
(declare-const c1 Int)
(declare-const c2 Int)
(assert (and (>= s 0) (<= s 256)))
(assert (and (>= c1 0) (<= c1 256)))
(assert (and (>= c2 0) (<= c2 256)))
(define-fun f ((x Int)) Int (mod257 (+ s (+ (* c1 x) (* c2 (* x x))))))
(define-fun y1 () Int (f 1))
(define-fun y2 () Int (f 2))
(define-fun y3 () Int (f 3))
; inv(2)=129, inv(-1)=256, inv(-2)=128 (because -2*128=-256≡1 mod 257)
(define-fun inv2 () Int 129)
(define-fun invNeg1 () Int 256)
(define-fun invNeg2 () Int 128)
; denoms: (1-2)*(1-3)=(-1)*(-2)=2 → inv2
;         (2-1)*(2-3)=1*(-1)=-1 → invNeg1
;         (3-1)*(3-2)=2*1=2 → inv2
(define-fun term1 () Int (mod257 (* y1 (mod257 (* (mod257 (* (- 0 2) (- 0 3))) inv2)))))
(define-fun term2 () Int (mod257 (* y2 (mod257 (* (mod257 (* (- 0 1) (- 0 3))) invNeg1)))))
(define-fun term3 () Int (mod257 (* y3 (mod257 (* (mod257 (* (- 0 1) (- 0 2))) inv2)))))
(define-fun reconstructed () Int (mod257 (+ term1 (+ term2 term3))))
(assert (not (= reconstructed s)))
(check-sat)
"""
    z3Unsat "k=3 lagrange" script

// ════════════════════════════════════════════════════════════════════
// 2. FsCheck — round-trip on the real Shamir module.
// ════════════════════════════════════════════════════════════════════
let private secretFromSeed (seed: int) (lenRaw: int) : byte array =
    let len = (abs lenRaw % 16) + 1
    let rng = Random(seed)
    Array.init len (fun _ -> byte (rng.Next(0, 256)))

[<Property(MaxTest = 256)>]
let ``FsCheck: every nonzero GF(257) element has a multiplicative inverse`` (raw: int) =
    let a = (abs raw % 256) + 1
    (a * Shamir.modInv a) % Shamir.Prime = 1

[<Property(MaxTest = 100)>]
let ``FsCheck: 2-of-3 round-trips random secrets`` (seed: int) (lenRaw: int) =
    let secret = secretFromSeed seed lenRaw
    Shamir.roundTrip secret 2 3 (Shamir.lcg (uint32 (abs seed)))

[<Property(MaxTest = 50)>]
let ``FsCheck: 3-of-5 round-trips random secrets`` (seed: int) (lenRaw: int) =
    let secret = secretFromSeed seed lenRaw
    Shamir.roundTrip secret 3 5 (Shamir.lcg (uint32 (abs seed)))

[<Property(MaxTest = 50)>]
let ``FsCheck: any 2-subset of 4 shares reconstructs`` (seed: int) (lenRaw: int) =
    let secret = secretFromSeed seed lenRaw
    let shares = Shamir.split secret 2 4 (Shamir.lcg (uint32 (abs seed)))
    let a = Shamir.combine [| shares.[0]; shares.[2] |] 2
    let b = Shamir.combine [| shares.[1]; shares.[3] |] 2
    a = secret && b = secret

// ════════════════════════════════════════════════════════════════════
// 3. Golden seed — F# agrees with the TS-locked vectors.
// ════════════════════════════════════════════════════════════════════
[<Fact>]
let ``F# Shamir agrees with shamir-golden-vectors.json (TS seed)`` () =
    let path = Path.Join(repoRoot (), "tools", "setup", "persona-keys", "shamir-golden-vectors.json")
    use doc = JsonDocument.Parse(File.ReadAllText path)
    let root = doc.RootElement
    root.GetProperty("schema").GetString() |> should equal "zeta-shamir-golden-v1"
    root.GetProperty("prime").GetInt32() |> should equal 257
    for v in root.GetProperty("vectors").EnumerateArray() do
        let name = v.GetProperty("name").GetString()
        let threshold = v.GetProperty("threshold").GetInt32()
        let shareCount = v.GetProperty("shares").GetInt32()
        let seed = uint32 (v.GetProperty("seed").GetInt32())
        let secret =
            v.GetProperty("secret").EnumerateArray()
            |> Seq.map (fun e -> byte (e.GetInt32()))
            |> Array.ofSeq
        let subset =
            v.GetProperty("subset").EnumerateArray()
            |> Seq.map (fun e -> e.GetInt32())
            |> Array.ofSeq
        let shares = Shamir.split secret threshold shareCount (Shamir.lcg seed)
        let picked = subset |> Array.map (fun i -> shares.[i])
        let got = Shamir.combine picked threshold
        if got <> secret then
            failwithf "golden vector %s: F# reconstruct mismatch" name

[<Fact>]
let ``F# and TS LCG produce identical first coefficients for seed=1`` () =
    // Cross-check the LCG itself: first 5 draws must match the TS formula.
    let rng = Shamir.lcg 1u
    let draws = Array.init 5 (fun _ -> rng ())
    // Independently compute expected uint32 sequence.
    let mutable s = 1u
    let expected =
        Array.init 5 (fun _ ->
            s <- s * 1664525u + 1013904223u
            float s / float 0x100000000UL)
    draws |> should equal expected
