# Each dep is qualified by (OS, package-manager, namespace, scope) and exposes criteria metadata

**Aaron, 2026-06-08 (#7043):**

> "some of the commands would have other things other than namespace and scope, or maybe it's some
> combination — no, I got it: each dep is written for what OS, package manager, namespace, and scope it's
> for, and what metadata it exposes, like best for security, stability, recency."

This sharpens the optimal-source resolution model (the "resolve optimal package manager / source by
criteria" thread, #6972, and the key-flexibility note #7042). A dependency carries **two metadata
groups**:

## 1. Qualifiers — *what this dep is FOR* (the match dimensions)

Each dep declares the context it applies to, so the resolver can pick the right variant:

- **OS** — linux / macOS / windows / nixos …
- **package manager** — apt / brew / nix / npm / cargo / dotnet …
- **namespace** — the registry/source namespace (e.g. `npm[privaterepo].bar`, an org/registry)
- **scope** — system / user-global / cell-local / environment (the push-down level, #6996/#7005)

So a single logical dep (`compiler.rust`) has multiple *qualified* variants, one per (OS × pkgmgr ×
namespace × scope) it's written for. Resolution = **match the current context against these qualifiers**
(match with or without a given qualifier — the "match with and without versions/namespace/scope"
flexibility, #7042). This is why **keys stay flexible qualified strings** (#7042): the qualifier tuple
lives in/with the key, matched partially.

## 2. Exposed criteria metadata — *how GOOD this dep is* (the ranking dimensions)

Each dep also **exposes metadata** the resolver ranks on when multiple variants match:

- **security** (best-for-security)
- **stability** (best-for-stability)
- **recency** (most up-to-date)

These are exactly the SoftValue / Pareto criteria from the optimal-source cut (#6972): when several
qualified variants are eligible, pick by the operator's weighting over (security, stability, recency) —
a Pareto frontier, not a single total order (you may prefer the most-secure-but-older, or the newest, per
policy).

## Canonical name groups variants; policy chooses; default is conservative (#7044)

Aaron: *"some deps have the same canonical name and different IDs in different package managers / OSes /
namespaces / scopes — they share a canonical name, and policy chooses which one when there are multiple;
if no policy you get security or stability by default."*

- **Canonical name = the shared grouping identity.** Many *variants* (each a distinct **ID**, qualified
  per pkgmgr × OS × namespace × scope) share **one canonical name** (e.g. canonical `rust-compiler` →
  `nix:rustc`, `brew:rust`, `apt:rustc`, … each a different ID). The canonical name is what you *depend
  on*; the ID is the concrete resolved variant.
- **Policy chooses among same-canonical-name variants.** When more than one variant matches the context,
  the operator's **policy** (the SoftValue weighting) selects.
- **Default (no policy) = security or stability — NOT recency.** Conservative by default: absent an
  explicit policy, prefer the most-secure / most-stable variant, never silently the newest. Recency is
  **opt-in**. (Safety-first default; the operator must *choose* to live on the edge.)

## Shape

```
dep <canonical-name>                                          # what you depend on (the grouping identity)
  variants:                                                   # many, sharing the canonical name
    - id: <variant-id>
      qualified-for: { os, packageManager, namespace, scope } # match dimensions (partial-match OK)
      exposes:        { security, stability, recency, … }     # rank dimensions (SoftValue/Pareto)
resolution: filter variants by qualifier-match → rank by policy
            (default policy = security/stability, NOT recency)
```

Resolution: **filter** variants by qualifier-match against the current context, then **rank** the
survivors by the exposed criteria under the operator's weighting. The qualifiers narrow; the criteria
choose.

## Honest scope (peel)

Design/model capture — names the two metadata groups (qualifiers vs exposed criteria) and how resolution
uses them (filter-then-rank). No code: no qualifier schema, no resolver. It refines #6972 (optimal-source
by criteria) + #7042 (flexible qualified keys) into a concrete dep-metadata shape. Realization would carry
these as homoiconic `DynamicValue` metadata (#7041) on the dep's `Meta` events (#7032), and route the
Pareto/weighting to the SoftValue machinery already in-repo.

## Anchors (Beacon)

- **Qualified/conditional dependencies** — Nix (per-system attrsets), Cargo target/cfg-gated deps, npm
  `os`/`cpu` fields, Maven classifiers/profiles, Bazel `select()` — deps written per (OS/arch/context).
- **Criteria ranking / Pareto** — SoftValue (in-repo), multi-criteria decision (security/stability/
  recency); package-manager resolvers (apt pinning, npm semver + audit).
- Internal: #6972 (resolve optimal source by criteria), #7042 (flexible qualified keys), #7005 (push-down
  vs JIT graphs — scope/push-down level), #6996/#7005 (scope levels), #7041 (DynamicValue metadata),
  `SoftValue.fs`.
