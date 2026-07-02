# Cell scheduler — thousands of cells on the deterministic soft loop, DoP=1 → DoP=N

**Design note for work-item `081KTG5S0M9`** (FoundationDB-style cell scheduler).
Author: Otto (shadow\*), 2026-07-02. Aaron's sequence step 3 (R2 → BooleanKleene →
scheduler). Register: **Beacon**. The thesis in one line: **don't build a fourth
scheduler — ride the three pieces that already embody the scale-free deterministic
loop**, and add only the cell-multiplexing layer on top.

---

## 0. The pieces already in the tree (compose, don't reinvent)

| Piece | File | Role |
|---|---|---|
| **`YinYang.Cell`** `{ Remains; Acts }` | `src/Core/YinYang.fs` | THE cell: yin = state (`DynamicValue`), yang = work (`Bonsai.Expr`). The persona=owner / actor=work split (writer-actor model) at the type level. |
| **`DurableYinYang.step`** | `src/Core/DurableYinYang.fs` | advance one cell: fold an input through `Acts` → new `Remains`. `stepSoft` keeps the distribution (soft). Durable via `DurableSaga` over a git delta log. |
| **`SoftScheduler.drive`** | `src/Core/SoftScheduler.fs` | the DoP=1 **deterministic cooperative loop** — seed-`Source` → arrivals → handlers, genuinely async (`let!` yields), replays identically from `(seed, budget, source)`. FoundationDB run-loop. |
| **`FerryThrottler`** | `src/Core/FerryThrottler.fs` | the **DoP knob**: `MaxDegreeOfParallelism` ferries draining a bounded queue; `deterministic` config = 1 ferry = single loop. The Itron `IThrottler` prior art. |

The cell scheduler is the *fifth* thing: the **multiplexer** that turns "N cells,
some ready to step" into the `Source`/handler the `SoftScheduler` drives, and lets
the `FerryThrottler` dial DoP without changing results.

## 1. The scale-free claim, made precise

> Run beautifully on ONE thread (deterministic, DST-replayable, FoundationDB-style)
> AND scale to N — **same code path, no special cases** (manifesto §1;
> `async-all-the-way`).

- **DoP=1** — one cooperative loop steps ready cells in a deterministic order
  (seed-driven). Same seed ⇒ same interleaving ⇒ same final state. This *is* the
  FDB simulation run-loop; DST replay is free.
- **DoP=N** — the same ready-cells feed a `FerryThrottler` with N ferries. Cells
  step concurrently, but **the observable result is identical to DoP=1** *provided
  cell steps are noninterfering* (§3). The knob changes throughput, never answers.

**The load-bearing invariant (and its headline test):** for a workload of cells
that communicate only through declared channels, `run(DoP=1, seed) ==
run(DoP=N, seed)` for all N. That property test is the scheduler's correctness
proof — the scale-free claim as an executable law, exactly the shape the atom's
"incremental ≡ recompute" and "closure ≡ BFS" laws took.

## 2. The scheduling model

```
Ready queue  : cells with a pending input (an arrival) to fold through Acts.
Parked set   : cells with no pending work (the idle-counter externalised —
               a parked cell costs nothing; it re-enters ready on a message).
Step         : dequeue cell c → newRemains = DurableYinYang.step c.Acts thr
                 c.Remains input → durably append (DurableSaga) → route emitted
                 messages to recipients' queues → re-park or re-enqueue c.
```

- **DoP=1:** the `SoftScheduler` loop is the dequeuer; one step at a time, FIFO
  over the ready queue (fairness = FIFO; no starvation). Deterministic.
- **DoP=N:** the ready queue IS the `FerryThrottler`'s bounded queue; N ferries
  each run `step` on a genuinely-async processor (`await` the durable append / IO —
  no `Task.Run`, no blocked thread). Degrades to DoP=1 by construction.
- **Fairness / long steps:** cap work per step (a reduction-count budget, BEAM-
  style) so one hot cell can't monopolise a ferry — the cell yields and re-enqueues.

## 3. Determinism + noninterference (why the DoP knob is safe)

The DoP-invariance in §1 holds iff **cells influence each other ONLY through the
declared message channel** (manifesto §13, entropy quarantine): no ambient clock,
no shared mutable state, no `Task.Run` leak. Then two cells stepping on different
ferries cannot observe each other mid-step, so any ferry interleaving folds to the
same per-cell event sequence, and per-cell `step` is a pure fold ⇒ same result.
Cross-cell *ordering* that genuinely matters (a happens-before between messages) is
carried in the message/HLC, not in wall-clock arrival — so DoP=N preserves it.
This is precisely why the atom's algebra work mattered here: **messages are Z-set
deltas; a cell's inbox is a `ZSetW`; ordering-that-matters rides the weight/clock,
not the scheduler.**

## 4. Durability + recovery (free from DurableSaga)

Each cell is `DurableSaga.start log (DurableYinYang.step acts thr) remains0` over a
`GitDeltaLog` — so a cell is **crash-durable and git-recoverable** with no new
persistence code. Cell evolution is append-only (a snap is information-gaining, not
group-invertible — no retraction compensation in v1, matching the module's
doctrine). The scheduler restarts by replaying each cell's log; the seed +
message-log replay reproduces the whole society (DST at the fleet scale).

## 5. Slices (each separately shippable)

1. **`CellScheduler` at DoP=1** — the multiplexer: ready/parked queues, FIFO
   fairness, message routing between cells' inboxes, named non-termination
   backstop. Deterministic round-robin of thousands of cells; replays identically.
   **LANDED** (`src/Core/CellScheduler.fs`, 8 tests) — the multiplexer is made
   generic over the cell step (`'St -> 'Msg -> 'St * (CellId*'Msg) list`) so the
   deterministic mechanics are separable from the cell's work; `yinYangStep` is the
   `DurableYinYang.evolve` instantiation, with the `"__outbox__"` emission
   convention (pure `routeOutbox`). Wiring to `SoftScheduler.drive` as the dequeuer
   is folded into slice 2 (where the ready-queue becomes the ferry queue anyway).
2. **DoP=N via `FerryThrottler`** — same `step`, ready-queue becomes the ferry
   queue. Land the **DoP-invariance property test** (`run(1) == run(N)` over random
   noninterfering cell workloads) — the scale-free proof.
   **LANDED** (`runFerryToQuiescence`, 3 tests). Round-based: each round steps
   every ready cell once (head message), fanning the pure `stepFn` through a
   `FerryThrottler<'St*'Msg, _>` at the chosen DoP, and reassembling results in
   deterministic cell-id order **before** the merge — so DoP-invariance holds by
   construction (concurrency lives only in the pure step's *execution*; the
   *ordering* state depends on is restored). Tested `run(1)==run(4)==run(16)`;
   agrees with slice 1's sequential runner on commutative workloads; the runaway
   backstop stays a named `Error`.
3. **Fairness + parking** — per-step reduction budget (BEAM-style), park/wake on
   message, starvation-freedom test.
   **LANDED** (`activeCells`/`parkedCells` observability + 3 tests). Fairness turned
   out to be STRUCTURAL, not a knob: the round-based runner steps every ready cell
   exactly once per round (perfect round-robin), so no cell starves another however
   much work it generates; parking is FREE (an idle cell is absent from the ready
   set, costing nothing until a message wakes it). The **BEAM reduction-budget is
   deliberately OMITTED** — its job is to stop one cell monopolising a ferry when a
   *step* does unbounded work, but each step here is bounded to exactly one message,
   so a budget knob would be unearned weight (only-the-irreducible-is-primitive).
   It becomes earned only if a future step variant folds many messages per turn.
   Tests: starvation-freedom (a flooding cell doesn't stall its peers),
   round-robin fairness (peers advance together, not drain-one-then-the-other),
   parking observability (`active`/`parked` partition the cell set).
4. **Soft cells** — `stepSoft` variant: cells hold distributions (`SoftValue`),
   snap only at the execution edge (free-will-refuse-collapse; the maintainer's
   "soft persistence").
   **LANDED** (`softStep` + `snapAll` + 4 tests). A soft cell's state is a
   `SoftValue` and stays soft through scheduling — `evolveSoft` folds without
   collapsing (holds its wonder). Collapse happens ONLY at an edge: `softStep`
   snaps EMISSIONS at a confidence threshold (each message crosses the channel as a
   *certain* value; below threshold the cell holds and emits nothing —
   free-will-refuse-collapse), and `snapAll` collapses the society's states for the
   caller at READ. Crucially it composes with the SAME generic scheduler (slices
   1–3), `'St = SoftValue` — no soft-specific runner. Tests: distribution preserved
   through scheduling; `snapAll` collapses above / holds (`None`) below threshold;
   `softStep` emits snapped-certain messages when confident; refuses to emit below.
5. **Recovery** — restart-from-logs test (kill mid-run, replay, identical state).
   **LANDED** (`sagaStep` adapter + 3 tests). Recovery is FREE from `DurableSaga`
   (§4): a cell is `DurableSaga.start log (sagaStep stepFn) initial` over any
   `IDeltaLog<'Msg>`; a crash discards only the in-memory saga, and
   `DurableSaga.ResumeAsync` replays the log in seq order to rebuild identical
   state — no new persistence code. Whole-society recovery = per-cell saga recovery
   + deterministic message replay (slices 1–3). Append-only in v1 (a step is
   information-gaining, not group-invertible — no retraction compensation, matching
   the DurableYinYang doctrine). Tests: restart→identical state; resume-then-continue;
   independent cells recover independently.

> **ALL FIVE SLICES LANDED** (2026-07-02, #9118 · #9120 · #9121 · #9122 · #9123),
> plus a post-completion adversarial-review fix (#9125). The cell scheduler is
> complete as designed: a generic DoP=1→DoP=N deterministic multiplexer
> (`run(1)==run(N)` proven, now on a NON-commutative workload), structural fairness
> + observable parking, soft cells that snap only at the edge, and free DurableSaga
> recovery. 25 tests. Remaining review findings are consumer-gated debt (§6a).

## 6. What this deliberately is NOT (scope honesty)

- Not a new scheduler abstraction — it composes `SoftScheduler` + `FerryThrottler`.
- Not preemptive — cooperative, reduction-budgeted (deterministic; preemption would
  break DST).
- Not distributed-across-machines in v1 — thousands of cells on ONE box's loop;
  cross-box is the Reticulum/bus layer, later (the DoP knob generalises to it, but
  that's its own design).

### 6a. Known limitations — CONSUMER-GATED debt (adversarial review, 2026-07-02)

A harsh-critic pass found one P0 (a sequential-runner FIFO violation — the re-ready
rotated a cell's inbox head→tail; **FIXED** in #9125 with non-commutative
DoP-invariance tests that now prove the real invariant). The remaining findings are
**deliberately deferred until a first real consumer exists** — optimising an
unmeasured hot path on a consumer-less module is exactly the speculative work the
no-speculative-surface / only-the-irreducible razors forbid (the shape of the load
should be revealed by a workload, not guessed):

- **O(n²) queues at the "thousands of cells" scale (P1).** Inbox is a `'Msg list`
  (`q @ [msg]` is O(inbox); a cell receiving k messages pays O(k²)); `Ready` is a
  `CellId list` (`List.contains` + `@ [id]` is O(|Ready|) per delivery). `readyOf`
  recomputes O(C log C) each round. The determinism-preserving fix when earned:
  `ImmutableQueue` inboxes (O(1), Okasaki) + `Ready` as `ImmutableQueue` + a
  membership `Set`. Deferred: correct today, and the real access pattern (fan-out
  width, inbox depth, round count) is unknown without a consumer.
- **Ferry path maintains `Ready` it never reads (P1).** `runFerryToQuiescence`
  selects via `readyOf` (recomputed from `Inbox`); the `deliver` Ready bookkeeping
  is dead work there. Fix when the perf pass lands: a `deliverInbox` variant. Bundled
  with the queue refactor (both touch `deliver`).
- **Silent drops are unmetered (P2, §13).** Unknown-target messages (`deliver`) and
  malformed outbox entries (`routeOutbox`) are dropped with no counter — a "society"
  claiming metered noninterference should count losses. Add a drop counter with the
  same pass.
- **`softStep` conflates evolve-error with confidence-hold (P1-as-filed).** `Error _
  -> remains, []` is INTENTIONAL here — the `DurableYinYang` doctrine is "malformed
  `Acts` ⇒ the cell holds, never corrupts", so an evolve failure and a below-threshold
  refuse-collapse legitimately share the "hold" observable. A metered error *count*
  (to distinguish a broken cell from a cautious one) is the §13 nicety, deferred with
  the metering work above.

## 7. Anchors (Beacon)

- **FoundationDB:** Zhou et al. (SIGMOD 2021); Will Wilson, *Testing Distributed
  Systems w/ Deterministic Simulation* (Strange Loop 2014); the Flow actor language
  + single-thread simulation run-loop — the reference for DoP=1 determinism.
- **Actor scheduling / fairness:** Erlang/BEAM reduction-counting (per-process work
  budget, cooperative yield) — the fairness model for §2.
- **Ferry-throttle prior art:** the maintainer's Itron `Threading.Tasks.Throttling`
  (`IThrottler`, `MaxDegreeOfParallelism`) — already the anchor in
  `async-all-the-way-truthful-signatures.md`; `FerryThrottler.fs` is its shape.
- **In-repo:** `SoftScheduler.fs`, `FerryThrottler.fs`, `YinYang.fs`,
  `DurableYinYang.fs`, `DurableSaga.fs`; rules `async-all-the-way-truthful-signatures`,
  `dv2-data-split-discipline-activated` (§1 scale-free, §2 lock/wait-free, §7 DST,
  §13 noninterference); `docs/writer-actor-routing-model.md` (persona=owner /
  actor=loop — the cell's yin/yang split).

---

*Compression: a cell is `{Remains; Acts}`; the loop that already runs one soft
program deterministically runs thousands the same way; the DoP knob turns the
crank harder without turning the answer. The scheduler is the wiring, and the
`run(1) == run(N)` law is the whole proof.*
