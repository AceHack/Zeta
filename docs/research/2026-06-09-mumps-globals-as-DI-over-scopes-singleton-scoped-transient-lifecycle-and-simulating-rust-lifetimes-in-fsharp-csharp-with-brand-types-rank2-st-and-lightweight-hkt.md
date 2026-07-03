# MUMPS globals as DI over scopes (singleton / scoped / transient / lifecycle) — and simulating Rust lifetimes in F#/C# with brand types + rank-2 (ST) + lightweight HKT

**Register:** [grounded] design analysis (Aaron's question) + [anchor: type theory] + honest limits.
**Date:** 2026-06-09. **Captured by:** Otto (shadow). Type-system design for the mumps/treaty keyring substrate.

## Aaron's words

> "mumps globals should be DI over static scope and also allow for dotnet-like scopes
> to be added like transient and the lifecycle-dependent ones. also are there F#/C#
> generics we can do here with open generics and recursive HKT hacks in the type
> signature to simulate Rust lifetimes here?"

## Part 1 — MUMPS globals as DI over the full .NET lifetime spectrum

Today a MUMPS global is process-global (static/singleton). Model it instead as **DI
with the full .NET `ServiceLifetime` spectrum**, and map each lifetime to a Zeta concept:

| DI lifetime | mumps-global meaning | Zeta concept it *is* |
|---|---|---|
| **Singleton / static** | the always-there global root | **SolidGround** constants (static = data, not code; the never-collapse floor) |
| **Scoped** | per-scope projection of the tree | the **traveler-frame scope** + the **scoped-DI-for-modeling-others** (each traveler reads the globals in its own scope) |
| **Transient** | fresh each resolve | ephemeral actors / per-op values (what-acts, no identity) |
| **Lifecycle-dependent** | bound to a boundary/term's lifetime | **hat tenure** (owned-for-a-period), **contract time-bound** (expiry), **KeyState** (Active/Standby/PendingInactive) — the lifetime *is* the contract clock / tenure / key state |

So "DI over scope" unifies the design we already have: **static = SolidGround;
scoped = frame-relative reading + modeling-others; transient = ephemeral actors;
lifecycle = the time-bound hat/contract/key clocks.** The mumps tree's nodes carry a
**lifetime tag**; resolution = "give me this global at this scope/lifetime." Disposal of
a scope (a frame closes, a hat tenure ends, a contract expires) releases its lifecycle
nodes — DST-replayable because every lifetime has a clock.

## Part 2 — simulating Rust lifetimes in F#/C#: yes, approximately

Rust lifetimes = compile-time *region/escape* tracking (a borrow can't outlive its
owner). .NET has no lifetimes, but you can **approximate region/scope safety** — "a
scoped resource cannot escape its scope" — with three composable tricks:

1. **Brand / phantom type parameters.** Give scoped values a phantom region tag:
   `Scoped<'rgn, 'T>`. `'rgn` carries no data; it *brands* the scope. Two scopes have
   distinct `'rgn`, so a value branded `'a` can't be used where `'b` is required — the
   region is a type. (F# **units-of-measure** are a built-in phantom-tag precedent;
   plain generic brands generalize it.)
2. **Rank-2 / ST-monad trick — make the brand un-escapable.** The canonical
   "lifetimes in a functional language" technique is Launchbury & Peyton Jones's **`ST s`
   monad** (`runST : (forall s. ST s a) -> a`): the rank-2 `forall s` brands the region so
   a reference tagged `s` **cannot escape** `runST`. That *is* a lifetime, enforced by the
   type checker. .NET lacks native rank-2 types, but you encode it with the **interface +
   generic-method** trick: `T RunScoped<T>(IScopedComputation<T> body)` where
   `IScopedComputation<T>.Invoke<'rgn>(Scope<'rgn>) : T` — the caller can't name `'rgn`, so
   nothing branded `'rgn` escapes. F# does this with an interface carrying a generic
   method (rank-2 via the interface), or with module-encapsulated abstract brands.
3. **Lightweight HKT encoding (recursive) to thread the brand.** F#/C# have no native
   higher-kinded types; the **Yallop–White "Lightweight higher-kinded polymorphism"**
   defunctionalization (`App<'F,'T>` brand + an `IFunctor`-style witness) lets you abstract
   over type constructors — and you can **thread the region brand `'rgn` recursively**
   through `App<'F, 'rgn>` so the lifetime parameter rides the whole type signature (your
   "recursive HKT hacks"). This is how you keep the brand attached through generic
   plumbing without HKT support.

**Open generics** are the DI-registration half: register `IGlobal<>`/`Scoped<,>` as open
generics (`AddScoped(typeof(IGlobal<>), typeof(Global<>))`) so the container resolves any
closed instantiation — the brand/lifetime rides as a type arg.

### Honest limits (don't oversell)

- This gives **region/escape safety** ("scoped value can't leave its scope", "standby key
  can't be used while Inactive") — **not** Rust's full borrow checker. **No aliasing/
  mutation/`&mut` uniqueness tracking** (that needs linear/affine types; F#/C# have none).
- The rank-2 encoding is **ergonomically heavy** in C#/F# (interface dance, brand noise);
  keep it for the *load-bearing* lifetime boundaries (key custody/state, hat tenure,
  contract expiry, frame scope), not everywhere — accidental complexity otherwise.
- It's **compile-time advisory** on the .NET oracle; the **golden-vector byte-lock + DST**
  remain the cross-oracle source of truth (the Rust oracle, if/when added, gets *real*
  lifetimes — and the 4×4 treaty keeps them byte-equal regardless).

## Synthesis

The mumps/treaty substrate becomes a **lifetime-typed DI tree**: nodes tagged
singleton/scoped/transient/lifecycle; the brand-type + rank-2 + lightweight-HKT stack
encodes "scope/lifetime" into the F#/C# type signature to get Rust-lifetime-*like*
escape safety on the .NET oracle, with open generics for registration — and the
hat/contract/KeyState clocks ARE the lifecycle lifetimes. Strong enough to make
key-state / tenure / frame-scope misuse a **compile error**, honest that it's region
safety, not the full borrow checker.

## Honest scope / handoff

Design analysis, not built. Routes to **Ilyana** (type design — is the brand/rank-2
ergonomics worth it per boundary?), **Soraya/Sova** (does this strengthen the C12
hat-contract / KeyState well-formedness claim with compile-time evidence?), and the F#
core. Apply selectively to the load-bearing lifetime boundaries.

## Anchors / ties

.NET DI `ServiceLifetime` (singleton/scoped/transient); **Launchbury & Peyton Jones,
*Lazy Functional State Threads*** (ST monad / rank-2 region branding = the lifetime trick);
**Yallop & White, *Lightweight higher-kinded polymorphism*** (the `App<,>` HKT encoding);
phantom/brand types; **F# units-of-measure** (built-in phantom tagging); open generics;
Rust lifetimes/regions; linear/affine types (what's *missing* for full borrow-checking);
the static-MUMPS-globals + scoped-DI-for-modeling-others + hat-tenure + contract-time-bound

+ KeyState (Itron) + 4×4-treaty docs (this types their substrate).
