# Ace also resolves the optimal source/ecosystem/registry per OS by criteria; per-repo one-liner registries are ZetaId/git-ref pointers (Aaron, 2026-06-07)

A second resolution dimension on top of version resolution (#6974). Aaron:

> *"you will also have to resolve optimal package-manager based on criteria — security / stability / up-to-date —
> per OS. So the package is what you mention in Ace by default and it figures out what ecosystem or one-liner
> registry to use. Each git repo can have its own one-liner registries, and we can point to those like a git-ref
> / ZetaId pointer — basically without the drama."*

## The kernel: resolve the SOURCE, not just the version

In an `.ace` file you name the **package** (the noun, e.g. `foo`) — the *what*. Ace resolves the ***how/where***:

- **Which source/ecosystem/registry** delivers `foo` — an OS package manager (apt/brew/winget/…), a language
  ecosystem (npm/cargo/pip/…), or a **one-liner registry** (a curl-install repo). 
- **Per OS** — the optimal source differs by OS (apt on Debian, brew on macOS, winget on Windows, a one-liner
  elsewhere); Ace picks per target OS (feeds the cross-OS patch sets, #6960).
- **By criteria** — a **multi-criteria optimization**: security (signed? CVEs? provenance?), stability
  (maturity, breakage history), up-to-dateness (freshness vs the upstream), and more. Ace ranks candidate
  sources and picks the optimum per OS.

So Ace resolution now has (at least) **three axes**, all bounded by the template graph (#6972) ∩ niches
(#6974):

1. **version** — which version (the lockfile, #6974);
2. **source/ecosystem** — which PM/registry delivers it (this), per OS, by criteria;
3. (both within) the **defined template** (#6972) — the closed universe resolution searches.

The noun stays minimal (`foo`); the `namespace[source].package` form (#6959) is the **explicit override** —
omit the `[source]`/namespace and Ace *resolves* the best one.

## Per-repo one-liner registries as ZetaId/git-ref pointers ("without the drama")

- **Each git repo can expose its own one-liner registry** — its install/ensure entries (an `.ace`/`.a` file,
  #6973; seams-are-Ace-files #6961). A repo ships how-to-install-me as data.
- **Ace points to those like a git-ref / ZetaId pointer** (#6916/#6925, reference-not-copy): the registry is a
  pointer-addressable noun resolved on demand — content-addressed, versioned, no vendoring.
- **"Without the drama"** = the ZetaId pointer replaces the pain of **git submodules / raw git-refs**
  (detached HEADs, recursive submodule init, ref drift). A ZetaId is a clean, content-addressed handle to the
  repo's registry — git-ref-like *indirection* with none of the submodule mess. (The pointer/resolver discipline
  #6925: respect source terms, on-demand, no mirror.)

## Why criteria-resolution + pointer-registries matter

- **`ace ensure foo` becomes portable.** You declare intent (`foo`); Ace picks the best, safest, freshest source
  per OS — the same `.ace` file works everywhere because source selection is resolved, not hardcoded.
- **Criteria as SoftValue (uncertainty-aware).** "Best source" is a judgment under uncertainty (security/
  stability/freshness scores are estimates) — a natural **SoftValue / Bayesian ranking** (the soft layer):
  resolution carries the residual ("npm has it fresher but apt is more stable"), and the choice is a soft
  optimum, auditable.
- **Decentralized sources.** Per-repo registries mean any repo can be a source without a central registry —
  Ace's pointer model federates them (the seam/adapter set, #6961), pre-visible in the template (#6972) so
  conflicts/choices surface statically (#6940).

## Honest scope / peel

- **Design, not built.** The multi-criteria per-OS source resolver, the criteria scoring (security/stability/
  freshness — needs concrete definitions + data sources), and per-repo pointer registries are to spec; the
  pieces (pointer/resolver #6916/#6925, cross-OS #6960, template #6972) exist or are scoped.
- **Criteria need real signals** — "security/stability/up-to-date" are only as good as their inputs (CVE feeds,
  release cadence, signatures/SLSA). Don't hand-wave the scoring; it's a data + policy problem (and the choice
  should be overridable — the explicit `[source]` #6959 is the manual pin).
- **Multi-objective ⇒ no single optimum in general** (Pareto front: security vs freshness can trade off). So
  "optimal" = per a *stated weighting/policy*, not absolute; surface the trade-off (SoftValue), let policy/human
  pick on the front. (Same honesty as the lockfile being a bounded solve, #6974.)
- Pointer-registries must respect source terms + the on-demand/no-mirror crawler discipline (#6925/#6926).

## Ties

- **Version/lockfile resolution (#6974)** — this is the *source* axis alongside the version axis; both iterate
  over the template ∩ niches.
- **ace ensure / namespace[source].package (#6959)** — `[source]` is the explicit override; omitting it triggers
  criteria-resolution.
- **ZetaId uniform pointer / reference-not-copy (#6916/#6925)** — per-repo registries as pointers, "without the
  drama" (vs git submodules/refs).
- **Cross-OS patch sets (#6960)** — per-OS source selection feeds the per-OS realization.
- **Template / temple of everything (#6972) + compile-time conflicts (#6940)** — sources are nodes in the
  defined graph; selection conflicts pre-visible.
- **SoftValue / Bayesian (the soft layer)** — criteria scoring under uncertainty = a soft optimum.
- **081KSGS9H0008QG0R0031PBNGA n-dim dependency space / holographic projection** — source/ecosystem/OS is a dimension; resolution =
  multi-criteria optimization over the n-dim space.

## Beacon anchors

- **Cross-ecosystem package index** — **Repology** (maps a package across *every* package manager/distro — the
  canonical "which ecosystem has `foo`, at what version" lookup). · **Per-OS package managers** (apt/dnf/brew/
  winget/pacman) + **one-liner installers** (rustup/nvm/Homebrew-tap/`curl | sh`) + **per-repo registries**
  (custom taps, install scripts). · **Multi-criteria / multi-objective optimization & Pareto fronts** (no single
  optimum; weighted policy). · **Supply-chain signals** (CVE/OSV feeds, SLSA provenance, signatures) for the
  security criterion. · **git submodule/ref pain** (the "drama" the ZetaId pointer #6916 avoids). Honest
  novelty: none in the primitives; the contribution is making **source/ecosystem/registry selection a resolved,
  per-OS, multi-criteria (security/stability/freshness, SoftValue) dimension** of `ace ensure <noun>` (intent
  declared, source resolved), with **per-repo one-liner registries as ZetaId/git-ref pointers** (reference-not-
  copy, no submodule drama) — bounded by the template (#6972) ∩ niches (#6974).
