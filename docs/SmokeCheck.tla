---------------------------- MODULE SmokeCheck ----------------------------
(* Trivial TLA+ module used by the TLC test harness to verify the
   Java + tla2tools.jar toolchain is wired correctly. Catches
   "TLC can't even parse a spec" regressions. *)
EXTENDS Naturals

VARIABLES x

Init == x = 0
Next == x' = x + 1 /\ x < 3
Spec == Init /\ [][Next]_x

Invariant == x <= 3

THEOREM Spec => []Invariant
====
