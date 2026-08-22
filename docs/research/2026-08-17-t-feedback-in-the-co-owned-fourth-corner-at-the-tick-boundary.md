# `T Feedback In` — the co-owned fourth corner at the tick boundary

**Date:** 2026-08-17 · **Work item:** `081M08WE9R3087G0R003PAK63F` ·
**Predecessor measurement:** `977575b2fe` (PR #11660, register row R-1a) ·
**Open decision it feeds:** `workitems/081M08S4DQC087G0R002SH0C88-…`

Aaron 2026-08-17: *"we should make research, architecture plans, and code moving towards combining
these — this is important."* Order kept: research first, then the plan, then the smallest code that
carries a falsifier.

---

## 0. What was already measured (verified, not re-derived)

Every claim in this section was re-read against the tree at `88c91695bb`, not taken from the brief.

| claim | verified where |
|---|---|
| the four-corner object is real code, four languages, byte-locked `fourcorner1` codec | `src/Core/FourCorner.fs:91` `toLine`, `tests/Tests.FSharp/FourCornerTreaty.Tests.fs`, `src/Core.TypeScript/algebra/wset-four-corner-trace.ts` |
| `WSet.FourCornerTrace` is the traced-monoidal form with laws tests | `src/Core/WSet.fs:152-433`, `tests/Tests.FSharp/Formal/WSet.FourCornerTrace.Laws.Tests.fs` |
| `toFourCorner` has **test callers only** | `grep` for `toFourCorner`: definition at `WSet.fs:425`, one call at `WSet.FourCornerTrace.Laws.Tests.fs:247`. Zero `src/` callers. |
| a tick boundary runs three corners | `SoftScheduler.fs:110-113` — `RunK: InterruptKind -> ISR<'S,'S>`; `ISR<'A,'B> = IntrCtx -> 'A -> Task<Result<'B, InterruptFeedback>>` (`IntrCtx.fs:76`) |
| the crossing inventory is four declared channels and the closure is not among them | `SoftScheduler.fs:121-148` + `TickBoundaryProbe.fs:15-20` |
| `onReceipt` is a `-> unit` hole fired inside the loop | `ReceiptScheduler.fs:87` / `:118`, fired at `:100-102` / `:131-133` |
| the docstring claims the corner it does not have | `ReceiptScheduler.fs:11-14` — *"The four-corner closure … Feedback (backward): the `ComputeReceipt`"* |
| `CelegansController.BeliefEstimator` is not a function of its arguments | `CelegansController.fs:243`, exhibited by TICK-5 |

One correction to the brief's framing, offered as a peel rather than a quibble, because the design
turns on it: the brief calls the missing corner *"the consumer's response to the previous result."*
`FourCorner.fs:27-29` says something stronger — `TInFeedback` is **co-owned, BOTH sides contribute**,
*"each side's contribution is the other side's backpressure"*. A corner that only the consumer writes
is a second input, not the fourth corner. That distinction is what forces the algebra in §3.

---

## 1. Research — what does `T Feedback In` mean at a tick boundary?

### 1a. The three corners that are there

Taking the **room** as the near side of the boundary:

| corner | at the tick boundary today | status |
|---|---|---|
| **T In** | the matched `InterruptKind` from the injected `Source` | present since `HandlerK` (2026-06-11) |
| **T Out** | the new `'S`, in `Result`'s Ok position | present |
| **T Out Feedback** | `InterruptFeedback`, in `Result`'s Error position | present, but **short-circuits rather than carries** — `driveK` stops the run on the first `Error` |
| **T In Feedback** | — | **absent** |

`T Out Feedback` deserves the qualifier. `IntrCtx.fs:48-52` is explicit that interrupts live in the
error position *and short-circuit under `>=>`*. So the room can author exactly one piece of feedback
per run, and authoring it ends the run. A channel with a capacity of one final message is a channel;
it is not a feedback loop.

### 1b. What already flows backward, through something other than a corner

This is the survey the brief asked for. These are the candidates the corner would legitimise — every
one is shipped code, none is hypothetical.

1. **The receipt.** `ReceiptScheduler.wrapHandler{,K}`'s `onReceipt : (Receipt -> unit) option`. The
   room computes a `ComputeReceipt` (IV, ΔJ, ΔU, entropy) and has no channel to return it on, so it
   is handed to a callback whose type guarantees the effect cannot come back. Confirmed carrying
   information by TICK-3.

2. **A distress signal that must not ride the performance channel.**
   `TelemetrySource.signalIfOverloaded : float -> float -> InterruptKind option` (`TelemetrySource.fs:137`).
   Read its type: it **returns an `InterruptKind`** — a value that only the `Source` is allowed to
   produce. The room has authored feedback and the only shape available for it is *a would-be
   arrival*, which some caller must then smuggle into the input stream. This is the missing corner in
   its plainest form, and the module docstring names the requirement out loud: *"a system under
   pressure needs a signal channel that is NOT its performance channel."* Today it has no such
   channel; it has a constructor.

3. **A budget revision.** `SoftThrottle` pressure / `Tank`. Inside `PredictionScheduler.Planned` the
   tank is threaded in `'S` and that is correct — but it works only because the room is both the
   producer and the consumer of its own pressure. When the pressure originates *outside* the room —
   `TelemetrySource.pressureOf` over a scraped `Body` — it has to arrive disguised as an
   `OperatorMessageArrived "metric:…"` payload, i.e. as data on the T-In corner, because there is no
   corner for a control value the other side owns.

4. **A retraction of a prior emission.** `WSet.negate`, the DBSP `−1`. `FourCornerTrace.step` is
   exactly this operation and it is fully implemented with laws — it is simply not what a tick runs.

5. **A memo from a previous run.** `Chip8CrossRunStore.Reader`. This one is the **positive control**
   and the model to copy: it is a genuine backward flow (run 1's computed trajectory read at run 2's
   step 0) and it is *not* a hole, because it reaches the room as an **injected parameter** and the
   module performs zero file IO (`Chip8CrossRunStore.fs:37-39`). A declared backward channel is
   unremarkable. That is the whole point.
   Then `Chip8ConsultCensus.observing` (`Chip8ConsultCensus.fs:136-143`) wraps that reader with
   `record : Verdict option -> unit` and re-opens the hole — a second live instance of the same shape
   as `onReceipt`, in a module whose own docstring says *"The sink is INJECTED (SS13): this module
   opens no channel of its own."* Injecting a `-> unit` sink declares **who** may write; it does not
   make the write a channel, because nothing can read it back through the type.

6. **A late or corrected input.** The GGPO rollback case `IntrCtx.fs:54-63` reasons about at length:
   speculate an input, run forward, re-run from a saved observation when the true input arrives. The
   correction is co-owned by construction — the remote peer authors it, the local room consumes it —
   and it is the case that most obviously needs a corner rather than an arrival, because it refers to
   a tick that has already happened.

### 1c. The answer

> **`T Feedback In` at a tick boundary is a value that BOTH sides of the boundary write to and both
> read, carried across ticks by the driver instead of by a closure.**

Not "the consumer's reply". The receipt (room → consumer), the budget revision (consumer → room), and
the ack/retraction (either) are all the *same corner*, seen from different frames — which is exactly
what `FourCorner.fs:11-12` means by *"co-owned … frame-relative, no absolute backpressure."*

And that immediately fixes the algebra, which is the one real constraint the design has:

> **If both sides write, neither may overwrite.** The corner's type needs an **associative merge with
> an identity** — a monoid — or the last writer of the tick silently wins and the corner becomes a
> race dressed as a channel.

### 1d. Anchors (Beacon), checked rather than cited

- **Hughes (2000), *Generalising Monads to Arrows*; Paterson (2001), `ArrowLoop`.** `loop :: a (b,d) (c,d) -> a b c`
  — an arrow whose input and output both carry an extra `d`, with `d` tied back. That is the shape of
  the proposed handler exactly. **Checked, and the difference named:** `ArrowLoop` ties `d` *within a
  single invocation* (a value-recursive knot needing laziness); the design below ties it *across
  successive ticks* (a fold). So the anchor supplies the shape and not the semantics — this is the
  sequential tie, not the recursive one.
- **Mealy (1955).** The sequential tie's own name: output and next state as functions of (input,
  state), with an accumulating output monoid. This — not `ArrowLoop` — is what `driveF` implements.
- **Joyal, Street & Verity (1996), traced monoidal categories.** Already `FourCornerTrace`'s anchor
  (`WSet.fs:113-117`). The trace is *bending the feedback arrow back around the loop*; §4 is about
  keeping the tick boundary's bend and the `WSet` bend one object.
- **Kahn (1974), process networks.** Determinism of a dataflow network with feedback requires every
  channel — including the feedback ones — to be part of the declared graph. The reason a hole is a
  correctness defect and not only an aesthetic one.
- **Goguen & Meseguer (1982), noninterference.** Manifesto §13; `TickBoundaryProbe`'s anchor.
- **Shapiro, Preguiça, Baquero & Zawirski (2011), CRDTs.** If the corner's merge is additionally
  *commutative and idempotent*, the corner is a join-semilattice and the tick boundary becomes
  reorder- and redelivery-safe. The design **requires associativity and declares the rest** rather
  than assuming it (DV2 #6).
- **Wiener (1948).** Feedback as governor — already cited by `TelemetrySource`.

---

## 2. Why a type and not another lint

Recorded because the justification is the load-bearing part and it is not the obvious one.

`tests/Tests.FSharp/DeterminismLint.Tests.fs` bans eleven ambient-entropy tokens across all of
`src/Core`, comments included, with occurrence counts pinned. Ambient entropy **is** enforced, and the
sweep is maintained rather than lucky. So the repo already refuses wall clocks — and both confirmed
gaps survived it.

They survived because **closure-carried state has no token to grep for.** `let mutable osc` is
eleven characters that appear legitimately everywhere; `receipts.Add` is a method call on a
collection. There is no lexeme whose presence is the defect. The defect is a *shape*: information
leaving a scope by a route the scope's type does not mention.

A type is the instrument that matches that shape, because a type is precisely a claim about what a
scope may do. That asymmetry — enforceable-by-token vs enforceable-only-by-type — is the entire
argument for spending a type here, and it is why "add a twelfth token" is not an alternative.

---

## 3. The proposed type

Three additions to `SoftScheduler`, all **additive**; `Handler`, `HandlerK`, `drive`, and `driveK`
are untouched. The precedent for additive extension at this exact seam is in the file already
(`SoftScheduler.fs:104-107`, the 2026-06-11 `HandlerK` note).

```fsharp
/// The co-owned corner's algebra. Weight-free: no instance state, nothing to capture.
type CoOwnedCorner<'F> =
    { Empty: 'F
      Merge: 'F -> 'F -> 'F }   // MUST be associative

/// A four-corner handler. `'F` is the co-owned corner.
type HandlerF<'S, 'F> =
    { Name: string
      Matches: InterruptKind -> bool
      RunF: InterruptKind -> 'F -> ISR<'S, 'S * 'F> }

val driveF : CoOwnedCorner<'F> -> HandlerF<'S,'F> list -> Source -> ISoftScheduler<'S * 'F>
```

**A record and not an `interface`, recorded because the rule says otherwise by default.**
`interfaces-free-classes-earned-under-rules` puts the interface first and this design started there —
`ICoOwnedCorner<'F>` with `abstract Empty: 'F`. F# rejects it: *"`unit` can't be used as return type
of an abstract method parameterized on return type"* (`FS0017`), which kills `unitCorner` and with it
the entire opt-in migration path of §6. The record is the same weight-free shape — no instance state,
nothing captured, exactly what `Handler` and `HandlerK` already are two screens up in the same file —
so no class is earned here and none is introduced. The constraint is the compiler's, not a preference.

Reading the corners off the signature, which is the point of writing it this way:

| corner | where it is in `RunF` |
|---|---|
| **T In** | the `InterruptKind` argument |
| **T In Feedback** | the `'F` argument — the corner **as it stands on entry**, carrying the other side's contributions |
| **T Out** | the `'S` in the returned pair |
| **T In Feedback** (the room's half) | the `'F` in the returned pair — **this tick's own contribution**, merged in by the driver |
| **T Out Feedback** | `InterruptFeedback`, unchanged, still short-circuiting |

Four design decisions, each with its reason:

1. **`driveF` returns `ISoftScheduler<'S * 'F>`, not a new port.** The corner rides in the existing
   port's state slot. Consequence that matters more than the tidiness: the corner lands inside the
   value `TickBoundaryProbe` compares, so a receipt travelling on the corner is *observable to the
   instrument*, which is exactly what TICK-4's blind spot #1 says an unread sink is not.
2. **The initial corner value is a parameter** (it arrives as the `'F` half of `initial`). The
   consumer's opening contribution is therefore declared, and is reset per run by construction. This
   is what collapses TICK-3's divergence *for the right reason* rather than by silencing the sink.
3. **The merge is injected, not fixed.** A `List.append` monoid gives a receipt log; `WSet.plus` +
   `consolidate` over a ring gives a corner that carries **retractions**; `max` gives a high-water
   pressure mark. The driver must not pick.
4. **No class is earned** (`interfaces-free-classes-earned-under-rules`). `CoOwnedCorner` is a record
   of two functions with no instance state — see the `FS0017` note above for why it is not an
   interface.

### The seven disciplines, walked

| # | | |
|---|---|---|
| 1 | scale-free | DoP=1 loop unchanged; `driveF` adds no coordination |
| 2 | lock/wait-free | no locks, no `Task.Run`; the corner is a threaded value, not shared memory |
| 3 | weight-free | interface only; the merge is the caller's, so no authority is captured by the driver |
| 4 | DST | the corner is initialised from a parameter and folded deterministically ⇒ same seed, same corner |
| 5 | DV2.0 | `'S` is the fast-changing satellite; `'F` is the cross-boundary link. Splitting them by owner is the change-rate split |
| 6 | **idempotency** | **named, not claimed:** `Merge` is required associative. Commutativity and idempotence are *optional properties a caller may have*; the `WSet` instance has them, the `List.append` instance does not. A non-idempotent corner is not reorder-safe and this plan says so rather than papering over it |
| 7 | noninterference | the whole purpose: the corner is the declared channel the hole was standing in for |

---

## 4. Reconciliation with `WSet.FourCornerTrace` — one object, and where the identity stops

The brief is right that introducing a second four-corner notion would be a failure. Two claims here,
kept at different strengths on purpose.

**Claim A — the corner is literally the same object. Compiler-checked.**
`FourCornerTrace.toFourCorner` (`WSet.fs:425`) returns
`FourCorner.FourCornerOwnership<'H, WSet<'K,'W>, unit, 'F>`. The tick-boundary packager returns
`FourCorner.FourCornerOwnership<InterruptKind, 'S, InterruptFeedback, 'F>`. Same type constructor,
two instantiations. Nothing new is defined; `SoftScheduler.toFourCorner` is a projection into the
existing record, and if anyone later forks the shape the F# compiler says so.

**Claim B — the corner's algebra is the trace's emission monoid. Behaviourally checked.**
`ICoOwnedCorner` instantiated at `Empty = []`, `Merge = fun a b -> WSet.plus a b |> WSet.consolidate ring isZero`
is a lawful corner *and* is exactly the operation `FourCornerTrace.step` uses to fold a delta into
`Emitted` (`WSet.fs:293`). So a handler can contribute `[k, −w]` and annihilate a previous
contribution *in the corner*, which is the retraction arriving at the tick boundary — the thing that
did not previously have a route. Tested, not asserted (§7).

**Where the identity stops, stated plainly.** The tick boundary is **not yet** a `FourCornerTrace`.
The trace's invariant is `Emitted = consolidate (gen after history)` — the cumulative emission is
always the *current reading of a retained history*, because feedback moves an interpretation `'I` and
the generator re-reads the same `'H`. A room's `'S` is not a `('I, 'H)` pair; it is a state advanced
forward. Instantiating the trace at the tick boundary therefore requires splitting room state into
interpretation and history, which is a real design step and not a rename.

So: **one corner object, shared today; one trace law, not yet instantiated at the tick boundary.**
Anything stronger would be the failure mode `numerology-vs-number-theory` names — two things sharing
a shape reported as one thing sharing a mechanism.

---

## 5. What happens to `onReceipt`

The work item states, and this plan agrees, that closing `onReceipt` is a **metering decision**
belonging to Aaron: delete it, type it as a real corner, or meter the roster.

**This plan does not settle it.** What it does is remove the reason the decision was hard. The work
item's own note says option 2 was not taken *"because changing a shipped signature is a bigger move
than the measurement warranted."* With `HandlerF` in place, option 2 costs no signature change:
`wrapHandlerF` is a **new** function beside `wrapHandler`/`wrapHandlerK`, and the existing callback
keeps working untouched.

So the decision surface Aaron actually faces becomes:

| option | cost after this plan |
|---|---|
| 1 — delete the callback | unchanged; still loses streaming telemetry |
| 2 — type the egress as a corner | **already available and tested**; the question narrows to whether the `-> unit` overloads get *retired*, which is a deprecation decision, not a design one |
| 3 — leave it and meter it | unchanged, and still insufficient alone (blind spot #1) |

The falsifier the brief set — *"if your proposed `T Feedback In` corner does not make `onReceipt`
typeable as a corner instead of a hole, it is the wrong design"* — is met by `wrapHandlerF`, whose
receipt reaches the caller through the returned `'F` and through nothing else. §7 measures it with
the same instrument that convicted the callback.

**`CelegansController` is deliberately not touched.** The work item's ordering is right: the room
does not tick, so threading the oscillator through `'S` would be an unfalsifiable change. The corner
does not help here either — an oscillator is room-private state, so it belongs in `'S`, not in a
co-owned channel. Naming that is part of keeping the corner from becoming a junk drawer.

---

## 6. Migration path for the `RunK` sites

`grep -rl "RunK\|handlerK" src --include=*.fs` returns **13 files** — of which `SoftScheduler.fs` is
the definition and `ReceiptScheduler.fs` is the site adopted here, leaving **11 rooms/wrappers on the
shape**: `Chip8Arcade`, `Chip8Citizen`, `Chip8CrossRunStore`, `Chip8PredictionRoom`,
`DarkHallScheduler`, `MeshPong`, `PredictionScheduler`, `SoftChip8Flux`, `SwarmBoard`,
`TelemetrySource`, `Vision`. (Plus 8 test files.) **None of them has to move**, and that is a property
of the design rather than a promise:

```fsharp
val unitCorner  : CoOwnedCorner<unit>           // Empty = (); Merge = fun _ _ -> ()
val ofHandlerK  : HandlerK<'S> -> HandlerF<'S, unit>
```

`HandlerK<'S>` is `HandlerF<'S, unit>` — a handler with the trivial corner is a handler with no
corner. The law that makes this a migration path rather than a hope:

> `driveF unitCorner (List.map ofHandlerK hs) source` produces, for every seed / budget / initial
> state, the same outcome as `driveK hs source`, modulo the `* unit`.

That is testable and is tested (§7, FIN-2). With it, migration is **opt-in per site**, in this order:

1. **Now (shipped):** the type, the trivial embedding, `ReceiptScheduler.wrapHandlerF`.
2. **Next, one site:** `TelemetrySource.signalIfOverloaded` — the clearest case in §1b, because it
   currently *returns* an `InterruptKind` it has no way to deliver. Its natural corner is
   `InterruptKind list` under `List.append`.
3. **Then:** `SourceF<'F> = int -> 'F -> InterruptKind list`, so the *environment* can read the room's
   contribution mid-run and revise what it sends. This is what makes the corner genuinely co-owned
   rather than room-write/consumer-read-at-the-end. It is deliberately **not** in this increment:
   `Source` is used by every room and by `RecordedSource`, so extending it is the move that needs its
   own falsifier and its own review.
4. **Only if a room needs it:** the `('I, 'H)` state split that would make a tick a literal
   `FourCornerTrace` (§4). Speculative; listed so it is not mistaken for shipped.

---

## 7. Falsifiers — shipped and measured

`tests/Tests.FSharp/FourCornerTickBoundary.Tests.fs`, 8 tests, all passing:

- **FIN-1 — the falsifier the brief set.** The TICK-3 room rebuilt on the corner. The corner version
  reports `DeclaredOnly` **while the reader handler still reads the receipts** — so it is not TICK-4's
  blindness. The assertions pin that the receipts genuinely arrived (`Tick = 3`, corner length 3,
  `Inner.N = 9` = the counter's 3 increments plus 1+2+3 read off the corner).
- **FIN-1b — the control.** The identical room on `onReceipt` is *still convicted*. Without it, FIN-1
  would only show that some room does not diverge.
- **FIN-2 — the migration law.** `driveF unitCorner (map ofHandlerK hs)` ≡ `driveK hs`, measured on a
  three-handler room over five ticks (`Ok { N = 555 }` both ways).
- **FIN-2b — the error position is unchanged.** `driveF` stops on the first `Error` and returns it,
  not a partial corner.
- **FIN-3 — co-owned, not last-writer-wins.** Two handlers contribute on the same tick; both survive
  in order.
- **FIN-4 — Claim B of §4.** The `WSet` corner carries a retraction: a `[7, −1]` contribution
  annihilates an earlier `[7, +1]` and the corner consolidates to **empty**, not to a zero row.
- **FIN-5 — the opening contribution is declared.** A non-empty initial corner is visible to the first
  handler on tick 0.
- **FIN-5b — one object, not two.** `SoftScheduler.toFourCorner` returns the very
  `FourCorner.FourCornerOwnership` record, with the tick's values in the right slots, and the `Error`
  case filling `TOutFeedback` with no `TOut`.

### Mutation results — 8 mutants, 8 killed

| # | mutation | killed |
|---|---|---|
| M1 | `coOwned <- corner.Merge coOwned contribution` → `coOwned <- contribution` | FIN-1, FIN-3, FIN-4 |
| M2 | handler receives `corner.Empty` instead of the live corner | FIN-1, FIN-5 |
| M3 | `Ok(state, coOwned)` → `Ok(state, corner.Empty)` | FIN-1, FIN-3, FIN-4 |
| M4 | `appendCorner` merge → last-writer-wins | FIN-1, FIN-3 |
| M5 | `toFourCorner` drops `withInFeedback` | FIN-5b |
| M6 | `driveF` swallows `Error` instead of stopping | FIN-2b |
| M7 | `driveF` runs only the first handler | FIN-1, FIN-2, FIN-2b, FIN-3 |
| M8 | `onReceipt` silenced (`\| Some cb -> cb receipt` → `\| Some _ -> ()`) | FIN-1b, **and TICK-3 + TICK-4** |

M8 is worth its own line: it is the work item's own stated mutation, and it re-kills the *predecessor*
measurement's tests as well as this increment's control. The two measurements agree about what
`onReceipt` does.

---

## 8. `clis/Verbs.fs` — do the two converge?

A sibling agent is typing the verb family as a **free structure** (free monoidal category, earned
quotients) on branch `shadow/compile-clis-verbs-surface`. Nothing under `clis/` is touched here.

The honest answer is **related, not the same, and not currently checkable**:

- The relationship *if both land* is a named one: a **traced** monoidal category is a monoidal
  category **with added structure** (a trace operator), not a quotient of one. So the verb family's
  free monoidal category would be the object the tick boundary's four corners add a trace **to**.
  Free → traced is a real arrow between them; it is not an identity.
- Which means the two do **not** unify into one object, and a plan that claimed they did would be
  asserting a structural identification on the strength of a shared word. Per
  `numerology-vs-number-theory`, "both are monoidal" is a count, not an invariant.
- And the practical blocker, which outranks the theory: `clis/Verbs.fs` is in no project and does not
  compile (§3 of `docs/research/2026-08-17-sim-as-the-room-runner-…md`). No compiler can check any
  claim about it today, so any convergence statement is unfalsifiable until the sibling's branch
  lands. Recorded as a **coincidence with a register attached**, not as a belief.

---

## 9. Not settled here — deliberately

- The `onReceipt` metering decision (§5) is Aaron's. This plan changes its cost, not its answer.
- §10 of `docs/research/2026-08-17-sim-as-the-room-runner-…md` holds four open questions for Aaron.
  None is answered here. Question 1 (`clis/Verbs.fs` compile-or-retire) is *touched* by §8 only to
  the extent of saying the convergence cannot be checked while it does not compile — that is a
  restatement of the question, not an answer to it.
- Extending `Source` to `SourceF` (§6 step 3) is the move that completes co-ownership and it is not
  taken.

## 10. What is left undone

- The corner is adopted at **one** call site (`ReceiptScheduler.wrapHandlerF`). The other eleven
  `src/` `RunK` rooms are unchanged and do not even carry the trivial corner — they still use
  `driveK`, which is untouched.
- **The byte-lock was not extended.** `fourcorner1` is a codec for the *string-quad* instantiation;
  the tick instantiation is `<InterruptKind, 'S, InterruptFeedback, 'F>` and has no wire form. Nothing
  in this increment touches `FourCorner.fs`, `FourCornerOwnership.cs`, or the TS oracle (`git diff`
  over those three paths is empty), so the treaty is unchanged rather than conformed-to. Giving the
  tick corner a treaty line is a separate piece of work with separate golden vectors.
- `Chip8ConsultCensus.observing`'s `record : Verdict option -> unit` is a second live instance of the
  hole (§1b.5) and is **not** closed. It is on the read path rather than the tick path, so it wants
  its own measurement first.
- `CelegansController`'s oscillator is unchanged, for the reason in §5.
- The trace law is not instantiated at the tick boundary (§4).
- No `Source` change, so the corner is currently room-write / consumer-read-at-the-boundary. Calling
  it fully co-owned today would be an overstatement.

## 11. Pointers

- `src/Core/SoftScheduler.fs` — the seam · `src/Core/FourCorner.fs` — the corner object
- `src/Core/WSet.fs:152` `FourCornerTrace` — the traced form · `src/Core/ReceiptScheduler.fs` — the adopted site
- `src/Core/TickBoundaryProbe.fs` + `tests/Tests.FSharp/TickBoundaryProbe.Tests.fs` — the instrument and TICK-1…6
- `workitems/081M08S4DQC087G0R002SH0C88-…` — the metering decision this feeds
- `docs/research/2026-08-17-sim-as-the-room-runner-…md` — §10's open questions, untouched
