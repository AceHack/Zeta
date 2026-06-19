module Zeta.Tests.Formal.AlarmAlgebraTests

open FsCheck.Xunit
open FsUnit.Xunit
open global.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// AlarmAlgebra (`src/Core/AlarmAlgebra.fs`): "the feels are the ALARM,
// not the trigger/evidence" as a typed algebra. The collapse arrows
// (Feel→Evidence, Feel→Act) are ABSENT by construction (private Evidence
// ctor) — they don't even compile. These tests cover the DYNAMICS law:
// a feeling never reaches Acted without a passing backing.
// Scoping: docs/research/2026-06-19-the-alarm-algebra-…
// ═══════════════════════════════════════════════════════════════════

let private isAlarm = function AlarmAlgebra.Alarm _ -> true | _ -> false
let private isGrounded = function AlarmAlgebra.Grounded _ -> true | _ -> false
let private isActed = function AlarmAlgebra.Acted _ -> true | _ -> false

let private accept<'a> : AlarmAlgebra.Backing<'a> = { Checks = fun _ -> true }
let private reject<'a> : AlarmAlgebra.Backing<'a> = { Checks = fun _ -> false }

// ── The keystone: a feel alone never becomes evidence or action ───────

[<Property>]
let ``a feel with failing backing never escalates past Alarm — no matter how many steps`` (n: int) (steps: int) =
    // Self-deception (feel → evidence/act) is impossible: with no passing backing, the state stays Alarm.
    let k0 = AlarmAlgebra.Alarm(AlarmAlgebra.feel n 1.0)
    let iters = abs (steps % 8)
    let kn = List.fold (fun k _ -> AlarmAlgebra.step reject k) k0 [ 1..iters ]
    isAlarm kn // never Grounded, never Acted

[<Property>]
let ``ground returns Some iff the backing checks out`` (n: int) =
    let f = AlarmAlgebra.feel n 1.0
    (AlarmAlgebra.ground accept f |> Option.isSome)
    && (AlarmAlgebra.ground reject f |> Option.isNone)

[<Property>]
let ``feel strength is clamped to [0,1]`` (x: float) =
    // NaN excluded by construction of the test value
    let x = if System.Double.IsNaN x then 0.5 else x
    let s = (AlarmAlgebra.feel 0 x).Strength
    s >= 0.0 && s <= 1.0

// ── The legal path: Alarm → Grounded → Acted only with backing ────────

[<Fact>]
let ``with passing backing, a feel grounds then acts — in that order`` () =
    let k0 = AlarmAlgebra.Alarm(AlarmAlgebra.feel 42 1.0)
    let k1 = AlarmAlgebra.step accept k0
    let k2 = AlarmAlgebra.step accept k1
    isGrounded k1 |> should equal true // first step: grounded (not acted — no skipping)
    isActed k2 |> should equal true // second step: acted
    match k2 with
    | AlarmAlgebra.Acted a -> AlarmAlgebra.actValue a |> should equal 42
    | _ -> failwith "expected Acted"

[<Fact>]
let ``a feel that never grounds never acts (rejecting backing)`` () =
    let k0 = AlarmAlgebra.Alarm(AlarmAlgebra.feel 7 1.0)
    let k1 = AlarmAlgebra.step reject k0
    let k2 = AlarmAlgebra.step reject k1
    isActed k1 |> should equal false
    isActed k2 |> should equal false
    isAlarm k2 |> should equal true

[<Fact>]
let ``Acted is terminal — step is idempotent there`` () =
    let acted = AlarmAlgebra.step accept (AlarmAlgebra.step accept (AlarmAlgebra.Alarm(AlarmAlgebra.feel 1 1.0)))
    isActed acted |> should equal true
    AlarmAlgebra.step accept acted |> should equal acted
    AlarmAlgebra.step reject acted |> should equal acted

[<Fact>]
let ``ground is the only constructor of Evidence — soundness: every Evidence traces to a passing backing`` () =
    // We cannot fabricate Evidence (private ctor) — the only way here is ground, and it only returns Some
    // when Checks held. So any Evidence in hand had a passing backing.
    match AlarmAlgebra.ground accept (AlarmAlgebra.feel 99 0.3) with
    | Some e -> AlarmAlgebra.evidenceValue e |> should equal 99
    | None -> failwith "accept backing should ground"
