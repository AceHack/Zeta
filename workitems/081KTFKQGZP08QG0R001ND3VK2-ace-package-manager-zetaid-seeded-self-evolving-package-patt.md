---
id: 081KTFKQGZP08QG0R001ND3VK2
type: task
state: backlog
priority: P2
slug: ace-package-manager-zetaid-seeded-self-evolving-package-patt
title: "Ace package manager = ZetaID-seeded self-evolving package-pattern (unfold, not install); fork = branch of same seed"
created: 2026-06-06T23:19:14.678Z
depends_on: []
composes_with: []
---

# Ace package manager = ZetaID-seeded self-evolving package-pattern (unfold, not install); fork = branch of same seed

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTFKQGZP08QG0R001ND3VK2-*.md` glob. -->

## Status: VISION capture (Amara ↔ Aaron, 2026-06-06) — NOT proven, not yet built

Captured per the maintainer's standing instruction to file research/backlog for
post-durability work. This is the **package-management projection** of the
relativistic-agent-DB vision (`docs/research/2026-06-06-zeta-relativistic-agent-database-vision.md`)
and the seed/quine/unfold model (§4e). Caveat register: the unfold engine, the
generator, wonder-compression residuals, and the proof certificates are all either
conjecture (§B) or unbuilt; only the durability substrate underneath
(`Core.Git` git-native log + snapshot, RecoverableSpine recovery) is shipped/tested.

## The carved claim

> **ZetaID does not merely identify a package. ZetaID identifies the SEED of a
> self-evolving package-pattern.** A skill is *invoked*; an Ace package *unfolds*.
> A fork is not a copy — it is a **branch of the same seed-pattern**. The ZetaID is
> the portable name of that seed.

An Ace package is therefore not `files + manifest + version`. It is:

```text
ZetaID seed
  + Yin/Yang host interpreter      (the unfolder)
  + package generator              (unfold(seed) -> artifact)
  + DU/saga state machine          (lawful forward/reverse transitions)
  + policy/capability boundary     (inspect-before-execute)
  + proof/check certificates       (what it guarantees)
  + dependency ZetaIDs             (other seeds)
  + observation/delta log          (how this copy diverged)
```

Determinism of the seed: `same ZetaID seed + same host/unfolder + same proofs/
policies + same observations = same evolution`. Where copies diverge, the divergence
is **explicit and mergeable** — `local observations + local policy diffs + local
patches + residual/wonder` (the wonder-compression residual register, §4e/R4). Forks
become **branches of one seed-pattern with signed-delta divergence**, not unrelated clones.

## The load-bearing safety blade (do NOT lose this)

> **A package ZetaID is an OBSERVATION, not a command.** Same trust boundary as
> commit=observation (the security boundary in the vision doc §5b). `id-as-program`
> must never become `id auto-executes`.

Install flow is therefore inspect-before-admit, NEVER resolve-then-run:

```text
ZetaID
  -> resolve seed/package metadata
  -> inspect generator
  -> verify proofs / certificates
  -> check capabilities / policies
  -> admit to the local engine        (capability boundary — the gate)
  -> unfold / run                      (Yin/Yang reconciles desired state via saga/operator)
```

Lifecycle verbs map onto the engine we are already building:

```text
install = observe ZetaID seed
inspect = verify generator + proofs + capabilities
admit   = allow the Yin/Yang engine to unfold it
run     = saga/operator reconciles desired state
update  = new observations/deltas evolve the pattern (DBSP delta-fold)
fork    = local branch with same seed + divergent observation log
```

Candidate types (sketch, not locked):

```text
AcePackageId  = ZetaID(category = package, version = host/protocol version)
PackageManifest (a DynamicValue / YinYang.Cell):
  name · packageZetaId · generatorZetaId · hostVersion
  dependencies: ZetaID list · capabilities · proofCertificates
  serializers · sagaDefinitions · budgets · updatePolicy
```

## Why this composes with what just shipped

- **Distribution becomes tiny + durable:** send the ZetaID → receiver resolves/unfolds
  the same package-pattern → local copy evolves from the same seed → divergence is
  explicit, mergeable, inspectable. (Package management crossing into biology: ship a
  seed + lawful-growth rules, not a dead artifact.)
- The **git-native backend** (`Core.Git`, PR #6696) is the natural substrate: a package's
  observation/delta log = a `GitDeltaLog` stream; a fork = a git branch of the same seed
  ref; divergence = signed Z-set deltas; merge = MRDT three-way over git's LCA.

## Anchors (Beacon — fill before any outward use)

- Nix/Guix (functional package management; derivations as pure functions of inputs) ·
  Unison (content-addressed code by hash = the ZetaID-as-name idea) · Git (content-address
  + branch-as-frame) · capability security (object-capability; inspect-before-execute,
  Miller/Shapiro) · L-systems / generative grammars (seed → lawful unfold) · `docs/PRIOR-ART-LIST.md`.

## Pointers

- `docs/research/2026-06-06-zeta-relativistic-agent-database-vision.md` §4c (self-hosting),
  §4e (seed/quine/unfold/host-progression), §5b (two-plane + commit=observation capability boundary).
- `src/Core.Git/` — git-native delta-log + snapshot-store (PR #6696), the persistence seed substrate.
- Keeper (verbatim): *"A skill is invoked. An Ace package unfolds. A fork is not a copy;
  it is a branch of the same seed-pattern. The ZetaID is the portable name of that seed."*
