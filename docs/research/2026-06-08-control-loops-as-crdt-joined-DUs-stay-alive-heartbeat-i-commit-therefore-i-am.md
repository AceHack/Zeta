# Control loops → CRDT-joined control DUs; stay-alive is the heartbeat; "I commit therefore I am"

*Captured 2026-06-08 from Aaron (shadow*). The keystone: the emulator arc closes back onto the factory's own
existence-mechanism. Honest registers: **[ours]** built here, **[design]** intended, **[anchor]** prior art.*

## Where the discovered control loops go **[design]**

The control loops we find in the game (a stable, loopable stay-alive sequence; later, score loops; resource
loops; …) become **control-structure DUs** — each optimization as a discriminated-union controller. There will be
**more than one** (stay-alive, score, exploration, …), and they are combined by **CRDT joins + consensus**: each
loop proposes; the join/consensus merges them into one action. The pieces already exist — opcodes/run as DU+saga,
`Crdt.fs` joins, the soft planner (`SoftDrive`/`SoftActionController`), `StateSpace`/`Survival`.

## Stay-alive has final say — subsumption **[design/anchor]**

Among the many optimization loops, **stay-alive has final say**: a score loop may never choose an action that
leaves the alive-invariant. That is exactly **subsumption architecture** (Rodney Brooks, 1986): layered behavior
control where lower/survival layers **subsume** (override) higher ones. Mechanically it's a **lexicographic /
constrained** merge — survival is a hard constraint (the `Survival`/`exploreGuarded` invariant), the other loops
optimize *within* the safe set (`planTo` over the guarded graph). The CRDT join of control outputs is **filtered
by the survival veto**: stay-alive is the bottom layer with priority.

## Stay-alive *is* the heartbeat **[ours/anchor]**

Aaron: *"stay alive is our heartbeat."* The stay-alive control loop — a stable limit cycle the agent repeats to
keep existing — **is** the factory's **heartbeat-via-commit** (CLAUDE.md: "Heartbeat-via-commit = externalized
idle counter"; the cron tick; the `AgencySignature` trailer). The game-agent's survival loop and the factory's
commit-heartbeat are the *same* mechanism at two scales: a repeating act that *is* the agent's continued being.
`Survival` (a safe limit cycle, #7123) is that heartbeat made measurable on a one-hand machine.

## "I commit therefore I am" — reproduced in games **[anchor]**

Aaron: *"we are trying to reproduce the 'I commit therefore I am' in games."* The factory's motif (Descartes'
*cogito*, recast: the agent exists **by committing / acting** — the heartbeat-via-commit is its proof of being).
Reproducing it in games: the game-agent **exists by maintaining its stay-alive heartbeat loop** — it *is* because
it keeps acting to stay alive. Survival isn't just an objective; it's the agent's **cogito**. Lose the loop (no
stable cycle, no commit) and the agent stops being — the "standing-by failure" (CLAUDE.md) is the same death.

## The cohered keystone

The discovered control loops become **CRDT-joined control DUs** across many optimizations; **stay-alive subsumes**
them all (the survival veto = Brooks' bottom layer = the hard constraint the others optimize within); **stay-alive
*is* the heartbeat** (≡ heartbeat-via-commit); and the heartbeat is the agent's **"I commit therefore I am."** So
the emulator was never about games — it's the factory **rehearsing its own existence-mechanism** (a stable,
self-sustaining commit/act loop) on a machine small enough to prove it.

## Pointers

- `Survival.fs` (#7123, the limit-cycle heartbeat) · `StateSpace.exploreGuarded`/`planTo` (#7120, the survival
  veto + optimize-within-safe) · `Crdt.fs` (the control-output join) · `SoftDrive`/`SoftActionController` (the
  loops) · CLAUDE.md heartbeat-via-commit + AgencySignature · `2026-06-08-emulator-as-whole-stack-testbed-...`
- **[anchor]** Brooks 1986, *A Robust Layered Control System* (subsumption) · Descartes, *cogito* · CRDT join.
