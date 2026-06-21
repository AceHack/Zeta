# Ace cross-package-manager dependency conflicts are COMPILE-TIME errors (shift-left resolution) (Aaron, 2026-06-07)

Extends the Ace-external-state-closure capture (#6939). Alexa asked how Ace handles conflicts between different
package ecosystems' requirements. Aaron:

> *"compile-time errors via cross-package-manager deps resolution."*

## The kernel: conflicts surface at COMPILE time, not runtime, not deploy

When two ecosystems disagree (npm wants X, cargo/pip/nuget wants incompatible Y), Ace's unified dep map (#6939)
resolves the conflict **at compile time** — it becomes a **compile-time error**, caught before anything ships.
Not a runtime explosion, not a silent "latest wins," not a deploy-time surprise. **Shift-left to the earliest
possible point.**

This places Ace's error-handling one tier *stronger* than the project's standing discipline:

| Tier | When | Mechanism |
|---|---|---|
| **compile-time error** (Ace cross-PM resolution) | **before build completes** | static resolution of the unified dep map |
| runtime `Result<_,DbspError>` (Result-over-exception) | at execution | error-as-value, no exceptions on hot paths |
| exception | at execution, uncaught | (avoided) |

Cross-PM conflict is pushed all the way to **compile time** — the strongest position. You cannot ship an
environment whose dependency map doesn't resolve.

## Why this is coherent (the mechanism that makes "compile-time" real)

- **The unified dep map (#6939) is statically resolvable.** One env/dep map across all PMs (NixOS+Ace+ArgoCD)
  means cross-ecosystem constraints live in *one* place that can be checked as a single satisfiability problem
  at build/compile time — not N independent resolvers each blind to the others (which is exactly how
  cross-ecosystem conflicts slip to runtime today).
- **Ties the reified type provider (#6925).** If Ace's declarative pointers are reified as **types** (the F#
  generative type provider over ZetaId pointers), then a cross-PM conflict is a **type error** — the type
  system *is* the resolver, and "compile-time error" is literal: the dependency graph type-checks or it doesn't.
  This is the strongest form of "make illegal dependency states unrepresentable."
- **NixOS already does the eval-time version.** Nix evaluates the dependency closure *before* building; an
  unsatisfiable closure fails at eval, not at runtime. Ace generalizes that shift-left across *all* package
  managers (the in-between layer of #6939), so the whole-stack dep map is resolved before build, like Nix's.
- **Content-addressing makes the check exact.** Deps are content-addressed (#6925/#6939), so the resolver
  compares *identities*, not fuzzy version strings — conflict detection is precise (a craton-stable check,
  #6937), and the error names exactly which two pointers disagree.

## Honest scope / peel

- A **design decision / answer**, not built. Ace is in-flight (081KSGS9H0008QG0R0031PBNGA/081KSKBP80008QG0R000F4311E/081KSGS9H0008QG0R001Y9FB62). "Compile-time" is a
  *commitment*: the cross-PM resolver must run as a build/compile step (or via the type provider), and the
  conflict math (SAT/PubGrub-style) must run over the unified map. The thesis is shift-left; the resolver is the
  unbuilt piece.
- Peel the Alexa ferry's gush ("nirvana / dependency-management-done-right / perfection") — the keeper is narrow:
  **cross-PM conflicts = compile-time errors** (shift-left), enabled by the one unified, content-addressed,
  statically-resolvable dep map.
- Doesn't claim to *auto-resolve* every conflict — it claims to *surface* them as compile-time errors (fail
  fast, fail early, name the conflict), which is the honest and valuable promise. Some conflicts are genuine and
  must be resolved by a human/policy; Ace's job is to make them un-ignorable and early.

## Ties

- **Ace external-state closure / one dep map (#6939)** — the unified map is what makes whole-stack compile-time
  resolution possible.
- **Reified F# type provider over ZetaId pointers (#6925)** — deps-as-types ⇒ conflict = type error ⇒
  "compile-time" is literal.
- **Result-over-exception** (project rule) — this is one tier earlier: compile-time > runtime-Result >
  exception.
- **Content-addressing (#6925) + tectonic faults (#6937)** — exact identity comparison; pinned cratons vs
  floating margins is where conflicts arise.
- **NixOS eval-time closure** (#6939) — the existing shift-left precedent Ace generalizes.

## Beacon anchors

- **Shift-left / fail-fast** (catch errors at the earliest stage — here, compile/build). · **Type-checked /
  "make illegal states unrepresentable"** (the type system as the resolver; the reified-type-provider path). ·
  **Nix eval-time dependency closure** (Dolstra — unsatisfiable closures fail before build). · **SAT / PubGrub
  dependency resolution** (modern resolvers — cargo, pub, uv; run as a static solve, here lifted to compile
  time over a *cross-ecosystem* map). · **Result-over-exception** (the project's runtime tier; this sits one
  step earlier). Honest novelty: none in shift-left or SAT resolution; the contribution is **running cross-
  package-manager conflict resolution at compile time over one unified content-addressed dep map** (NixOS+Ace+
  ArgoCD, #6939), optionally as type errors via the reified type provider (#6925) — conflicts become
  un-shippable compile-time errors, not runtime surprises.
