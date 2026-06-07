# Ace is the external-state closure: declarative pointers to all package managers → one env/dep map (NixOS→metal, ArgoCD→cluster, Ace→in-between) (Aaron, 2026-06-07)

Grounds the **external-state half** of the closure frame (#6932) in the actual Ace architecture. Aaron:

> *"our external-state closure is everything in our Ace package-manager-of-package-managers — it's declarative
> 'pointers' to other package managers and their deps, giving us one env/dep map across everything, even our OS:
> NixOS all the way down to the metal, ArgoCD for cluster, and Ace for everything in between."*

## The kernel: Ace IS the external-state closure

#6932 said a ZetaId **closes over external state by declarative content-addressed reference**. Aaron names the
concrete realization: **Ace (the package-manager-of-package-managers, B-0824) is that closure for the entire
environment.** Its content is *not copies* — it is **declarative pointers** to other package managers and their
dependency graphs (the reference-not-copy / uniform-pointer discipline, #6916/#6925, applied to *dependency
space*). Resolving the pointers reconstitutes the environment; Ace holds the references, not the artifacts.

The closed-over external state = **one unified env/dependency map across everything.** Not per-ecosystem silos
(npm here, cargo there, nuget elsewhere) — a single declarative map that closes over them all by reference.

## The full-stack closure (metal → cluster)

| Layer | Tool | Role in the closure |
|---|---|---|
| **Metal → OS** | **NixOS** | declarative, reproducible, purely-functional — closes over the OS+packages *all the way down to the metal* |
| **Everything in between** | **Ace** | declarative pointers to every other PM (npm/cargo/nuget/pip/brew/…) + their deps — the meta-PM that unifies them |
| **Cluster** | **ArgoCD** | GitOps — declarative desired cluster state continuously reconciled |

End to end, the *whole environment* is one declarative, pointer-based map: **NixOS (metal/OS) + Ace (in-between)
+ ArgoCD (cluster)** = the complete external-state closure. Everything the agent/system depends on is closed
over declaratively, by reference, in one map.

## Why this is the right read (it composes the whole arc)

- **Closures over external state (#6932), realized.** Ace is *the* external-state closure; NixOS and ArgoCD are
  the metal and cluster ends of the same closure. The agent closes over its *entire environment* the way a
  function closes over its free variables — by declarative reference, resolved on demand.
- **ZetaId uniform pointer (#6916) / reference-not-copy (#6925) at dependency scale.** "Declarative pointers to
  other PMs and their deps" = the uniform pointer-resolver applied to *all* dependencies. A dep is a versioned,
  resolvable coordinate (the same shape as an identity anchor or a `cite:`), resolved at use, never inlined.
- **B-0824 n-dimensional dependency space / holographic projection.** "One env/dep map across everything" is the
  holographic projection of the n-dimensional dependency space down to a single coherent env — Ace's master
  thesis (B-0824), now seen as the external-state closure.
- **Declarative all the way (desired-state pushed up).** NixOS + ArgoCD + Ace are *all declarative* — you state
  *what* the environment is (desired state), the closure reconciles it. Ties the "Zeta is declarative
  desired-state pushed all the way up; everything is data" capture.
- **Tectonic fault lines (#6937) on the dep map.** The unified dep map has cratons (pinned/locked deps — stay)
  and active margins (floating/updating deps — shift); the lockfile is the craton, the version-range is the
  fault. NixOS's pinned inputs = cratons by construction.

## Honest scope / peel

- **NixOS and ArgoCD are real, shipped, external tech**; **Ace is the in-flight piece** (the Ace lane:
  B-0824 PM-of-PMs + B-0863 one-liner curl-install + B-0806 cross-OS/Crossplane; surface otto-windows). The
  "one env/dep map across everything" is the *design goal / closure thesis*, partially built.
- A **framing/grounding** (Ace = the external-state closure of #6932), not new mechanism. The honest bounds hold:
  declarative pointers resolve *on demand*, respect source terms / crawler-control (#6926), and don't mirror.
- No claim Ace already unifies every PM today; the claim is the *architecture* — declarative pointers + one
  map + the NixOS/Ace/ArgoCD stack = the external-state closure.

## Ties

- **Closures over state / Reticulum routing (#6932)** — Ace = the external-state half; (Reticulum routes;
  internal half = yin/yang control #6915).
- **ZetaId uniform pointer (#6916) + reference-not-copy (#6925)** — the pointer discipline at dependency scale.
- **Ace lane** — B-0824 (PM-of-PMs, n-dim dependency space, holographic projection), B-0863 (curl one-liner),
  B-0806 (cross-OS / Crossplane / Ansible-GitOps). `ACTIVE-WORKSTREAMS.md` Ace lane (otto-windows).
- **Declarative desired-state / everything-is-data** — NixOS+ArgoCD+Ace all declarative.
- **Tectonic fault lines (#6937)** — pinned (craton) vs floating (margin) deps on the unified map.

## Beacon anchors

- **Nix / NixOS** (Eelco Dolstra — purely-functional, declarative, reproducible package & OS management to the
  metal). · **ArgoCD / GitOps** (Argo project; Weaveworks GitOps pattern — declarative desired cluster state
  reconciled from git). · **Crossplane** (declarative control-plane for cross-cloud/OS, B-0806). · **Meta /
  package-manager-of-package-managers** concept; **lockfile = pinned closure** (the dependency closure made
  explicit — Nix flakes, lockfiles). · **Closures / free-variable capture** (#6932 anchor). Honest novelty:
  none in Nix/ArgoCD/GitOps; the contribution is the **read** — Ace is the *external-state closure* of the
  closure frame: declarative pointers to all package managers + their deps = one env/dep map, with
  NixOS (metal/OS) + Ace (between) + ArgoCD (cluster) as the full-stack closure, resolved by reference.
