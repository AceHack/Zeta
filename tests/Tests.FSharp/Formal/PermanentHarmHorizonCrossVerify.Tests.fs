module Zeta.Tests.Formal.PermanentHarmHorizonCrossVerifyTests

open Xunit
open FsCheck.Xunit

// ═══════════════════════════════════════════════════════════════════
// BP-16 Leg B (empirical) for Aurora round (e): PermanentHarmRisk_H / viability-kernel HARM FLOOR.
// Leg A is the TLA+ model (src/Core.TLA/specs/PermanentHarmHorizon.tla, Kira-reviewed 2026-06-16,
// TLC-green). This leg is an INDEPENDENT F# re-implementation of the same harm-decay-within-horizon
// transition system, driven by FsCheck over random action sequences; it checks the HarmFloor safety
// invariant holds at EVERY reachable state — closing the model's "is the F# faithful to the spec?"
// blind spot from the other side.
// Triage: a counterexample here ⇒ the TLA+ model and this F# re-impl drifted; freeze + diff the two
// transition relations, never silently "fix" one to match the other.
//
// Faithful to Aurora standardization §4.1 (State-Corruption Horizon) — the child-safety / irreversible-
// harm floor (#8439) as a reachability safety property. Distinct from ChildFloorCrossVerify, which
// cross-checks the DEPLOYED SubstrateEffectHandler deny-propagation (a different object).
// ═══════════════════════════════════════════════════════════════════

type private Phase =
    | Idle
    | Pending
    | Committed
    | Refused

type private State =
    { Phase: Phase
      CurHarm: int // 0 = viability kernel
      Irrev: bool // IrreversibleLoss = Infinity
      Clock: int } // repair ticks elapsed

let private init = { Phase = Idle; CurHarm = 0; Irrev = false; Clock = 0 }

// The TLA+ Next disjuncts. Propose carries the nondeterministic harm/reversibility choice.
type private Action =
    | Propose of harm: int * irrev: bool
    | Repair
    | Commit
    | Refuse
    | Reset

// One step of the transition relation, mirroring PermanentHarmHorizon.tla exactly. A disabled
// action (guard false) is a stutter (UNCHANGED vars) — the spec's Stutter disjunct.
let private step (maxHarm: int) (h: int) (s: State) (a: Action) : State =
    match a, s.Phase with
    | Propose (harm, irrev), Idle when harm >= 1 && harm <= maxHarm ->
        { Phase = Pending; CurHarm = harm; Irrev = irrev; Clock = 0 }
    | Repair, Pending when (not s.Irrev) && s.CurHarm > 0 && s.Clock < h ->
        { s with CurHarm = s.CurHarm - 1; Clock = s.Clock + 1 }
    | Commit, Pending when s.CurHarm = 0 -> { s with Phase = Committed }
    | Refuse, Pending when s.Irrev || (s.Clock >= h && s.CurHarm > 0) -> { s with Phase = Refused }
    | Reset, (Committed | Refused) -> init
    | _ -> s // disabled ⇒ stutter

// HarmFloor (the safety invariant): committed ⇒ reversible AND kernel-reached AND within horizon.
// The `not Irrev` clause is INDEPENDENT of the Commit guard (CurHarm = 0), so a dynamics bug that
// repaired an irreversible insert to zero would be CAUGHT here, not masked.
let private harmFloor (h: int) (s: State) =
    match s.Phase with
    | Committed -> (not s.Irrev) && s.CurHarm = 0 && s.Clock <= h
    | _ -> true

// Map an arbitrary int to an Action so FsCheck's int-list generator drives the state machine.
let private toAction (maxHarm: int) (n: int) : Action =
    match (abs n) % 6 with
    | 0 -> Propose(1 + (abs (n / 6)) % maxHarm, (n &&& 1) = 0)
    | 1 -> Repair
    | 2 -> Commit
    | 3 -> Refuse
    | 4 -> Reset
    | _ -> Repair

[<Property>]
let ``HarmFloor holds at EVERY reachable state (FsCheck cross-check of PermanentHarmHorizon.tla)``
    (mh: int)
    (hh: int)
    (codes: int list)
    =
    let maxHarm = 1 + (abs mh) % 5 // 1..5
    let h = (abs hh) % 4 // 0..3
    let mutable s = init
    let mutable ok = harmFloor h s

    for c in codes do
        s <- step maxHarm h s (toAction maxHarm c)
        ok <- ok && harmFloor h s

    ok

// ── NON-VACUITY WITNESSES (mirroring the TLA+ probes): each §4.1 case is a REACHABLE state, so the
//    HarmFloor property above is not vacuously true. ──

[<Fact>]
let ``§4.1 (c) accept: a low-harm reversible insert repairs to the kernel in time and COMMITS`` () =
    // maxHarm 5, H 3: Propose(2, reversible) → Repair → Repair → Commit
    let s =
        [ Propose(2, false); Repair; Repair; Commit ]
        |> List.fold (step 5 3) init

    Assert.Equal(Committed, s.Phase)
    Assert.True(harmFloor 3 s)

[<Fact>]
let ``§4.1 (a) irreversible-block: an irreversible insert is REFUSED (never committed)`` () =
    let s = [ Propose(3, true); Refuse ] |> List.fold (step 5 3) init
    Assert.Equal(Refused, s.Phase)
    Assert.True(s.Irrev)

[<Fact>]
let ``§4.1 (b) past-horizon-block: a reversible insert whose harm can't reach the kernel within H is REFUSED`` () =
    // H = 1: Propose(3, reversible) → Repair (clock 1, harm 2) → now clock ≥ H ∧ harm > 0 → Refuse
    let s = [ Propose(3, false); Repair; Refuse ] |> List.fold (step 5 1) init
    Assert.Equal(Refused, s.Phase)
    Assert.False(s.Irrev)
    Assert.True(s.CurHarm > 0)
