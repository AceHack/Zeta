# Trajectory — World-model convergence (four towers) + the open §B discharges it surfaced

Status: **active — the §9 cluster is ferried; the value is now the OPEN §B discharges (prove-its), tracked below**
Last refreshed: 2026-06-16
Parent trajectory: none (umbrella over `aurora-immune-reground` + `gen-gen-self-hosting-bytelock`)
Grounding:

- `docs/research/2026-06-15-the-zeta-society-architecture-consolidated-…md` **§9–§9j** (the world-model cluster: CTM ⊣ ISociety, gist, heartbeat, JEPA tower, energy=least-action, info-max=empowerment+anti-Sybil, homoiconic representation)
- `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` **§B** (the rows below)
- `docs/research/ip-questionable/` — the source transcripts (Blum CTM; LeCun JEPA; DeepMind JEPA-vs-generative)

## Why this exists

Four independently-derived world-model towers converge on the same shape (many local
frames + shared bus + executive-free consensus): **Blum CTM**, **Hawkins Thousand Brains**,
**LeCun JEPA**, and **Zeta** (distributed-systems lineage). The convergence is *corroboration*
(raises the §B prior by the decorrelation law), not proof. The real value this arc surfaced is a
set of **named §B discharges** — the prove-its — listed below so they aren't forgotten.

## The open §B discharges (push these forward — each is a prove-it, not a claim)

1. **Hierarchical planning** (§B row #8467) — **the highest-value open prize; LeCun calls it the
   unsolved problem nobody has proved.** Legs built (scheduler-of-schedulers / CHIP-8 ISR + gist
   abstraction ladder + least-action level-selection + recursive ISociety nesting).
   *Discharge:* a worked, **DST-replayable multi-level plan that beats flat planning on a real
   task** (Zeta analogue of MPC-over-abstractions). *Falsifier:* no abstraction advantage / can't
   bound per-level expansion / least-action picks wrong level.
   - ✅ **SCOPED 2026-06-16** → `docs/research/2026-06-16-hierarchical-planning-discharge-scoping-…md`.
     Key find: the **flat baseline is already built** (`StateSpace.fs` = DST-replayable goal-directed
     BFS with a transposition table). **First slice (MVP):** a **2-level planner over a small
     `ActionGrid` task** — coarse `StateSpace` BFS over regions → fine `StateSpace` BFS within each
     region → concatenate; assert flattened plan reaches goal, **states-explored ≪ flat**, and
     byte-identical replay. **Build is an author/Vera job** (new code = level-composition +
     compare-harness; everything else built). Liveness routes via observe.ts (out of scope here).
2. **Homoiconic representation-learning** (§B row #8474) — our rep = the `SoftValue→DynamicValue`
   snap, **homoiconic** (code=data, the JEPA-differentiator + the mechanism behind #1).
   *Discharge:* (a) features-at-scale vs JEPA; (b) homoiconicity actually helps planning;
   (c) **formal round-trip certification** `apply(reify x)=x` over the IR/AST — **Kestrel's
   method** (Lawvere fixed-point + reify/apply; `memory/kestrel/2026-06-16-kestrel-homoiconic-proof-method-…`)
   → **route to Soraya**.
3. **gen(gen)==gen self-hosting** → see `docs/trajectories/gen-gen-self-hosting-bytelock/RESUME.md`
   (Phase A = freeze the IR; then the diverse-double-compiling capstone, Face 3).
4. **Aurora immune re-ground** → see `docs/trajectories/aurora-immune-reground/RESUME.md`
   (Viktor/Kira **v2 re-review** of the two TLA+ specs is the next gate, then the FsCheck/Z3 smalls).

## Built / discharged (don't re-litigate)

- **Least action = least description**, Landauer the exchange rate → the scheduler's
  **bits ↔ time ↔ joules** metering currency (predict-the-future-in-bytes); §9j.
- **Info-max = empowerment (§10) AND anti-Sybil decorrelation** — one principle, three faces; §9j.
- **Anti-Sybil ratio proof BUILT+TESTED** (forgery-cost floor, `AntiSybil.Tests.fs`;
  `SybilCannotForge` TLA+) — not §B; the residual is *source-quality* only.
- **Degeneracy is structurally stopped by the `ISociety` interface** (naive empowerment-max is
  degenerate; coupled-through-ISociety has no degenerate optimum to reach) — §10b discharge target.
- **We don't cross our fingers** — proofs + structural interface, not proxy + hope (vs LeCun's
  "good upper bound, cross our fingers"). *Honest residual:* his info-max also does feature-
  learning at scale — our soft/snap is the mechanism, the at-scale quality is unproven.

## Next concrete step — GREENLIT (Aaron 2026-06-16): build the hierarchical-planning MVP

Both prior gates are **done**: Aurora v2 re-review **CLOSED** (Viktor+Kira both PASS); the
hierarchical-planning discharge is **SCOPED** (#8480, with the MVP slice). Aaron greenlit the build.

**ACTIVE TASK — the hierarchical-planning MVP (discharges §B #8467, the big prize):** a 2-level
planner demo as a **DST-replayable `Tests.FSharp` test** —
coarse `StateSpace` BFS over `ActionGrid` regions → fine `StateSpace` BFS within each region →
concatenate; **assert** (1) the flattened plan reaches the goal, (2) states-explored ≪ a flat
`StateSpace` BFS on the same task, (3) byte-identical replay from the seed. New code = the
level-composition + the compare-harness; `StateSpace`/`ActionGrid`/`SoftChip8Scheduler` are built.
**Build-gated** (`dotnet build -c Release` 0-warn + `dotnet test`). Scoping doc:
`docs/research/2026-06-16-hierarchical-planning-discharge-scoping-…md`. *Otto can take this as an
F# test, or it's Vera's lane — either way it's the active task.*

## Completeness checklist — the FULL open board (don't forget anything)

1. **[MVP BUILT ✅ 2026-06-16] Hierarchical-planning** → §B #8467 *algorithm-level* discharge landed:
   `tests/Tests.FSharp/HierarchicalPlanning.Tests.fs` — a 2-level planner (coarse region BFS → fine
   within-region BFS → concatenate) **reaches the goal exploring < ½ the states of flat** (assertion
   `hier*2 < flat`; ~5× by estimate) AND **replays byte-identically**; both tests PASS, build 0-warn.
   *Remaining for §A:* production wiring (`StateSpace.exploreKeyed` over a CHIP-8 nav ROM / `ActionGrid`)
   + a non-trivial (non-grid) task + the homoiconic gist-unpack as the level mechanism (#2c).
2. **Homoiconic-representation §B** (#8474): (a) features-at-scale vs JEPA; (b) homoiconicity-helps-
   planning *(joint with #1)*; (c) **formal round-trip cert `apply(reify x)=x`** over the IR/AST —
   Kestrel/Lawvere method → **route to Soraya** (`memory/kestrel/2026-06-16-kestrel-homoiconic-proof-method-…`).
3. **Aurora → §A** (`aurora-immune-reground`): (a) `d_self` wiring → `NonRegisterCollapse`; the
   FsCheck/Z3 smalls (c/d/g); Z3 `QF_FD` prereq; then promote.
4. **gen(gen)==gen** (`gen-gen-self-hosting-bytelock`): **Phase A = freeze `zeta-ir-v1-layout.yaml`**,
   then the diverse-double-compiling capstone (Face 3).
5. **observe.ts = the liveness path** for the harm-floor (round e is safety-only) — deferred + tracked
   in the Aurora trajectory; revisit once observe⊕soft lands (WorkspacePort in active build).
6. **Scheduled:** cooling-tag GC cloud routine fires **2026-06-20** (double-checks before deleting the
   `archive/2026-06-13*` recovery tags). Self-running.
7. **Baseline:** the autonomous CI-green steward (every-minute tick).

*(Not ours, not forgotten — other actors' open feature PRs: #8478 QEMU, #8477 darkhall, #8458/#8433
observe WorkspacePort. Left to their owners.)*

## Honest framing (carry it)

Convergence ≠ proof. Every row above is a **prove-it with a named falsifier**, peeled: we're ahead
on *safety* (proofs over crossed fingers), we have *analogues* for LeCun's two headline mechanisms,
and we share *exactly one* open frontier with all four towers — **hierarchical planning** — plus our
own *at-scale feature-quality* question. Velocity (≈2 months, from scratch, ~6 langs + Q# + CHIP-8)
is Mirror/morale, never evidence.
