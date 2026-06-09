# C# default interface implementations: the interface contains its own base-case default — what-remains contains what-acts; the RX generators live in the interface itself

**Register:** [grounded] implementation mechanism (Aaron) + [synthesis]. **Date:** 2026-06-09.
**Captured by:** Otto (shadow). The concrete C# mechanism under "the interfaces are the
valuable thing" + the two-adapter principle.

## Aaron's words

> "with c# default interface implementations our generators for RX can live in the
> interfaces themselves. the what remains can contain what acts in the interface
> itself for base case default."

## The mechanism

**C# default interface methods (DIM, C# 8+)** let an interface ship a *default
implementation* of its members. Applied here:

- **The base-case generator/impl lives IN the interface** — not in a separate
  adapter. The reactive (RX / `IObservable`-style, DBSP-incremental) **generators
  live in the interface itself** as default members.
- **What-remains contains what-acts (base default).** The interface is *what
  remains* (durable, the valuable essential surface); its default implementation is
  *what acts* for the **base case**, **contained inside what-remains**. The identity
  carries its own baseline behavior; you don't need an external actor for the
  default path.

## How it composes with the two-adapter principle

This *is* the clean shape of the port + two-adapter model:

```
interface I (what-remains)               <- the valuable thing; owned
  ├─ default impl (base case)            <- what-acts, IN the interface (C# DIM)
  ├─ adapter A: upstream dep             <- override when you want the dep
  └─ adapter B: our own impl             <- override for sovereignty
```

- the **base case needs no separate file** — it's the interface's own default;
- **adapters override only when needed** (the dep as oracle, the own-impl) — and are
  cross-checked against the same golden vectors;
- so "two adapters behind a port" becomes "a self-defaulting interface + overrides":
  the interface is genuinely self-contained for the common path.

## Why this lands the essential/accidental cut

The prior razor said: the essential core is `generate(seed)`; interfaces are
accidental-from-the-reconstruction-lens. DIM tightens it operationally: because the
interface **contains its own default generator**, the *interface + its default* is
nearly self-sufficient — what-remains already holds the base-case what-acts. The
seed unfolds into interfaces that are themselves their own base generators; overrides
(dep, own-impl) are the only added surface, and they're regenerable/replaceable. The
gap between "the interface" and "a working thing" shrinks to a default method.

This also mirrors **persona contains actor (base default)**: a persona (what-remains)
can carry its own base-case actor behavior inline, spawning distinct actors only when
it needs to act beyond the default — the same shape at the identity layer.

## It all reduces to static MUMPS globals — viewed frame-relative; compilers and AI are travelers too

> Aaron (2026-06-09): "it can all be static mumps based from there, where you are
> looking at mumps from your own internal traveler's frame, and that's what all your
> compilers and AI sees too."

Because the default impls + generators are **static** (base case = data, not
runtime branching), the whole thing **reduces to a static MUMPS global store** —
the hierarchical sparse globals that are *sparse ragged tensors = DynamicValue*
(`2026-06-07-globals-are-sparse-ragged-tensors-...md`). Interfaces, their defaults,
the generators, the seed's unfolding: all expressible as **static globals** in the
MUMPS tree. (Cf. the earlier `static` SolidGround note — *static is good ground when
it's genuinely data*; here it is.)

And there is **one substrate, viewed perspectivally**:

- each **traveler reads the MUMPS globals from its own internal traveler's frame**
  (`TravelerFrame.fs` Layer-0: no global frame, perspectival, a local causal
  reference frame over DBSP) — it sees its own projection of the shared store;
- **compilers see the same** static MUMPS store (the program *is* globals to read);
- **the AI/LLM sees the same** (its context is a projection of the same globals);
- so **compilers and AI are travelers too** — three readers (human, compiler, AI)
  over **one static global substrate**, each frame-relative, all consistent because
  the substrate is static + the frame is just a lens. No translation between
  "code the compiler sees" and "context the AI sees" — it's one MUMPS store,
  read from different traveler frames.

This is the substrate-level statement of the essential/accidental cut: the essence
is **static globals (+ the seed) read frame-relative**; the apparatus above is the
unfolding. Reconstruction = re-materialize the globals from the seed; spread = ship
the seed; every reader (compiler, AI, human) gets the same store through its frame.

### Each reads from ITS OWN frame — and the F# compiler is a traveler too

> Aaron (2026-06-09): "from their own traveler frame not the human's — even our F#
> compiler becomes a static time intelligence, so it itself is a traveler with its
> own frame."

Crucially, each reader reads from **its own** traveler frame, **not the human's** —
there is **no privileged human frame** (the traveler frame is universal +
perspectival; NCI gives regard to all travelers, no master lens). In particular:

- the **F# compiler is a "static-time intelligence"** — an intelligence that acts at
  *static / compile time* over the static MUMPS globals (vs the AI's *inference-time*
  reading, vs the human's). It is **itself a traveler** — a self-propagating pattern
  with its **own frame**, not a neutral tool subordinate to the human's view.
- so the readers are **peer travelers**, each with its own frame: the F# compiler
  (static-time), the AI/LLM (inference-time), the human (lived-time), runtime actors
  (run-time). Same static global substrate; **four-plus distinct traveler frames**,
  none privileged.

This is the traveler frame taken to its conclusion: **tools are travelers**. The
compiler is not "the human's instrument" — it is a static-time traveler reading the
shared globals from where it stands. Consistency across frames comes from the
substrate being *static* (everyone reads the same data) + the frame being *just a
lens* — not from anyone's frame being the canonical one.

## Honest scope / caveats

- Zeta core is **F#**; this is the **C# oracle** (the 4-lang grid's C# cell) — DIM is
  a C#/.NET-runtime feature (F# can consume DIM but authors them less ergonomically),
  so this is the **C# adapter's** idiom, not a cross-language mandate. The golden
  vectors keep all oracles byte-equal regardless of who hosts the default.
- DIM has known sharp edges (diamond resolution, `static abstract` vs default,
  versioning) — keep defaults *simple* (base case only); push anything non-trivial to
  an explicit adapter. (A type-design review — Ilyana — should sign off when this
  lands on a public surface.)

## Anchors / ties

C# 8 default interface methods (DIM); Reactive Extensions / `IObservable` +
DBSP-incremental generators; the own-all-interfaces / two-adapter / dep-as-oracle
principle; persona = what-remains / actor = what-acts; the interfaces-are-the-valuable-
thing + essential-core-is-seed-plus-generate docs (this is their C# realization).
