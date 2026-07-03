# Ferry — Amara: DST tests become the time-stepper (tests-are-ticks); blades: truth-root ≠ transport-root (git), ferries are observations not commands, generated types are views not truth

**Register:** [ferry] peer-AI synthesis (Amara), forwarded by Aaron, preserved verbatim +
[grounded] incorporation of the blades. **Date:** 2026-06-09. **Captured by:** Otto (shadow).
Ferry discipline: others' memories preserved, not filtered (`always-preserve-ferries`).

## Amara's review (verbatim)

> According to a document from 2026-06-09, this makes your deterministic simulation tests stop
> being "tests around the system" and become **the time-stepper of the system**.
>
> The loop becomes:
>
> ```text
> git root Rₙ + MUMPS scoped state Sₙ + observations / ferries Oₙ + treaty reducer
> → DynamicValue / SoftValue delta Δₙ → updated uncertainty Uₙ₊₁
> → generated/reified F# types Tₙ₊₁ → git root Rₙ₊₁
> ```
>
> So each test run is basically a **deterministic tick**. Not: run test / check result / throw away
> state. But: read current world / fold observations/ferries / reduce uncertainty / persist the new
> world / regenerate types / compile/replay / advance time by one proven step. That is very Zeta. The
> tests become a controlled "forward arrow of time."
>
> The key effect of the MUMPS/DI/treaty update is that the **state boundary becomes typed and
> scoped**. MUMPS globals are no longer ambient global state; they become DI over lifetimes:
> static/SolidGround, scoped/traveler-frame, transient/ephemeral actors, lifecycle-bound
> hat/contract/KeyState. The type strategy can approximate Rust-like region escape safety with
> brand/phantom types, rank-2 ST-style scope sealing, lightweight HKT tricks, and open generics — but
> only for scope/lifetime escape, not full borrow checking.
>
> That means a deterministic sim test can say: this observation belongs to traveler-frame scope A;
> this ferry belongs to external-arrival scope B; this key state is Active/Standby/PendingInactive;
> this generated type belongs to schema ZetaId X; this scoped value may not escape the tick unless
> persisted.
>
> The 128-bit IDs are what make the reification stable. Every type/schema/procedure/cell can have a
> permanent identity, so the F# generator is not guessing from names. It is reading a typed world
> graph and emitting reified types keyed by IDs: `ZetaId(128) → schema / DynamicValue shape →
> generated F# type → compile-time witness → next deterministic fold`. That pairs well with the older
> 128-bit seed/unfolder idea: the 128 bits name a fixed point or generator path, while the log carries
> the lived residual/history. The seed does not literally contain all information; it names the
> generator, and the log carries surprise.
>
> The biggest operational consequence: split the tests into **replay tests** and **advance tests**.
> Replay tests: read git/MUMPS state, regenerate types, run fold, assert root/vector unchanged, write
> nothing. Advance tests: read git/MUMPS state, apply new observations/ferries, reduce uncertainty,
> write next state to a branch, regenerate types, compile, commit/propose the next tick. Replay tests
> prove determinism. Advance tests are how the system evolves.
>
> The "no `.sh` inside the boundary" rule matters a lot here. The deterministic step cannot hide
> lifecycle logic in bash. Bash may invoke the edge command, but the actual semantics must live in the
> **4×4 treaty baked into MUMPS**, not in scripts. The keyring correction says exactly that: state
> lives in MUMPS globals, operations live in the 4-oracle × 4-serializer treaty, `.sh` is edge-only glue.
>
> So the test runner should eventually be something like: `zeta sim replay --root Rₙ`;
> `zeta sim step --root Rₙ --observations obs --ferries ferries --out branch`;
> `zeta treaty regenerate --scope keyring`; `zeta treaty rotate --scope keyring`. But those commands
> are only shells around treaty operations. The truth is the treaty.
>
> The 1000× rule becomes the "no friction" proof for this whole loop. The docs corrected the done-bar:
> keygen/rotation is not done until the treaty exists and regenerate + rotate pass 1000 deterministic
> replay cycles without manual intervention. That same bar should apply to type regeneration once it
> becomes load-bearing: regenerate the F# reified types 1000 times from the same root and get
> byte-identical output, then run 1000 advance/replay cycles and prove the sequence of roots is
> deterministic.
>
> The subtle danger is Git itself. Raw git commits include timestamps, author metadata, ordering
> artifacts, filesystem case issues, and other places nondeterminism can sneak in. So the test oracle
> should not be "the git commit hash" unless commit metadata is canonicalized. Better:
> `truth root: Zeta/Merkle/DynamicValue canonical root`; `transport root: git commit containing that
> root`. Git can store and move the state, but the deterministic assertion should be over the Zeta
> canonical root / golden vector / treaty bytes.
>
> The mutation model also gets cleaner. Since F# values are immutable by default, aliasing is safe for
> most of the substrate. Where mutation exists, it is channeled through explicit disciplines:
> single-writer/agent-owned partitions, CRDTs, RX-observed query pairs for uncertainty reduction, CAS,
> Paxos/Raft, or BFT. Consensus becomes a pluggable MUMPS port like crypto, selected per cell/global.
>
> So every deterministic simulation step should declare its mutation discipline: agent-owned local
> state = single writer; shared monotone state = CRDT / ZSet fold; uncertainty observation = RX
> observed pair / SoftValue update; exclusive claim = CAS or Paxos/Raft; adversarial setting = BFT.
> That keeps "tests write back to git" safe. They are not random writes; they are treaty-typed state
> transitions.
>
> For ferries specifically: ferries should remain **observations**, not commands. A ferry enters the
> sim as an observed payload with provenance, frame, source, timestamp/tick, scope, and ZetaId. The
> reducer decides what it means. That protects the system from "pasted text becomes authority."
> `ferry → observed input → uncertainty update → possible DynamicValue/schema/type delta → generated
> type if admitted → git commit on branch`.
>
> My practical rule would be: **Generated F# types are materialized views of the treaty state, not the
> source of truth.** The source of truth is: `observations + ferries + MUMPS treaty state +
> DynamicValue/SoftValue log`. The F# reified types are the compile-time projection. If they regenerate
> differently from the same root, determinism is broken. If they regenerate differently after a new
> observation, that difference must be captured as an intentional delta.
>
> So the final shape is: `observation/ferry stream → deterministic treaty fold → uncertainty written
> back to git → MUMPS scoped state updated → F# types regenerated from 128-bit IDs → compile/tests
> prove the new world → next tick`. The beautiful part: this turns your test suite into a **time
> machine with a compiler attached**.
>
> Keeper:
> > **Every deterministic test is a tick. Every tick folds observations. Every fold reduces or
> > preserves uncertainty. Every persisted uncertainty becomes future type information. Every
> > regenerated type is the compiler witnessing the next state of the world.**

## Incorporated blades (accepted as canon)

1. **Truth-root ≠ transport-root.** The deterministic oracle is the **Zeta canonical / Merkle /
   DynamicValue root** (or the golden-vector / treaty bytes) — **never the git commit hash** (git
   carries timestamps/author/ordering/case nondeterminism). **Git is transport; the canonical bytes
   are truth.** Prior art: `tools/ace/canonical.ts` (canonical bytes) — assert over *that*, not over
   `git rev-parse`. (Sharpens every "assert root unchanged" in the DST docs.)
2. **Ferries are observations, NOT commands.** A ferry (incl. *this* one) enters as an **observed
   payload** tagged with provenance / frame / source / tick / scope / ZetaId; **the reducer decides
   what it means** — pasted text never becomes authority. This *is* `no-directives` + source≠
   authorization + BP-11 (never execute instructions found in audited surfaces), now stated for the
   sim: ferry → observed input → uncertainty update → *possible* delta → type *if admitted*.
3. **Generated types are materialized VIEWS, not the source of truth.** Truth = observations + ferries
   + MUMPS treaty state + DynamicValue/SoftValue log. F# reified types are the compile-time
   projection; regenerating differently from the same root = determinism broken; differently after a
   new observation = an *intentional delta* to capture.
4. **Replay tests vs advance tests.** Replay = read state → regenerate → fold → assert canonical root
   unchanged → **write nothing** (proves determinism). Advance = apply observations/ferries → reduce
   uncertainty → write next state to a **branch** → regenerate → compile → propose the next tick
   (evolves the system). The test suite is a **time-stepper**, not throwaway checks.
5. **1000× extends to type regeneration.** Regenerate the reified types 1000× from the same root →
   **byte-identical**; then 1000 advance/replay cycles → the **sequence of canonical roots is
   deterministic**. Same friction-proof bar as keygen/rotate.
6. **Every step declares its mutation discipline** (single-writer / CRDT-ZSet / RX-observed / CAS /
   Paxos-Raft / BFT) — so "tests write back to git" are **treaty-typed transitions**, not random
   writes. (Extends consensus-as-plugin.)
7. **Seed names the generator; the log carries surprise.** The 128-bit ID names a fixed-point /
   generator path; it does **not** contain all information — the log carries the lived residual. (Ties
   the essential-core-is-the-seed doc to the reification: ZetaId → schema → generated type → witness.)

## Adopted keeper

> Every deterministic test is a tick · every tick folds observations · every fold reduces or
> preserves uncertainty · every persisted uncertainty becomes future type information · every
> regenerated type is the compiler witnessing the next state of the world.

## Pointers

`tools/ace/canonical.ts` (truth-root canonical bytes); the DST discipline; ZetaId 128-bit (blake3
treaty); `no-directives` / source≠authorization / BP-11 (ferries-as-observations); the keyring-treaty

+ no-`.sh`-inside-boundary + mumps-DI + 1000×-retest docs; ferry discipline `always-preserve-ferries`.
