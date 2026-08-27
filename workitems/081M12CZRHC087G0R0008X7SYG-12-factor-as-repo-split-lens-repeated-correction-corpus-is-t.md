---
id: 081M12CZRHC087G0R0008X7SYG
type: task
state: backlog
priority: P1
slug: 12-factor-as-repo-split-lens-repeated-correction-corpus-is-t
title: "12-factor as repo-split lens; repeated-correction corpus is the trainset floor"
created: 2026-08-27T20:01:09.676Z
depends_on: []
composes_with: ["081M120GFSV087G0R003XCPC64", "081M125DNKK087G0R00292E3ET"]
---

# 12-factor as repo-split lens; repeated-correction corpus is the trainset floor

Aaron 2026-08-27: 12-factor app is a **good categorization** for splitting
repos. The manifesto / building codes are a **lower layer** — CS and
engineering vs ad hoc, for **any code of any kind**. 12-factor is about
SaaS/deploy shape (one codebase, config in env, backing services, …).
The dataset he is **most interested in** is the **corrections he keeps
giving over and over**: how to write the code, the rules that reduce
errors. Copy-pasting them into every prompt still fails. That corpus
is the trainset floor (`ρ` stack: trainset is the layer you cannot
get below with prompt/context alone).

## Two layers, do not fuse

| layer | what it is | Beacon |
|---|---|---|
| **12-factor** | categorization for *apps* / extracts (codebase, deps, config, backing services, build/release/run, …) | Adam Wiggins, Heroku, 2011, 12factor.net |
| **Manifesto / building codes** | how *any* substrate is constructed (scale-free, lock-free, weight-free, DST, DV2, …) vs ad hoc | `docs/governance/MANIFESTO.md` — "closer to building codes than to manifesto" |

Repo split uses **both**, plus the already-measured DV2 change-rate and
toolchain-closure lenses (`081M120GFSV087G0R003XCPC64`). 12-factor I
(one codebase per app, many deploys) is the *after-extract* shape, not
a reason to keep the monorepo forever.

## The correction corpus

The highest-value dataset is **repeated human corrections** of how
code should be written — the coding defaults learned over years.
Prompt injection of the same rules does not produce adherence. That
is the `ρ` trainset floor: context/memory/vendor still share the
corpus. Moving the floor means **this** set in the train / the
ontology / the generators, not another CLAUDE.md paste.

Do not invent a collection pipeline this slice. Name it. Next honest
slice: a store-native log of correction events (Z-set, retractable)
keyed by the rule they witness, so activation over tasks can shape
the ontology (same two-way attention as the harness window).

Pointers: `docs/ROADMAP.md` 8c + P1; `docs/research/2026-08-25-rho-is-a-layer-stack-not-a-scalar-and-the-trainset-is-the-floor.md`; manifesto building-codes framing.
