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

## Refinement (Amara ↔ Aaron, 2026-06-06) — Ace is ALREADY a package-manager-of-package-managers

**SHIPPED REALITY (not vision), per Aaron:** Ace already understands ~10 real package
managers (npm · NuGet · Cargo · pip · Maven/Gradle · Go modules · apt/brew · …) and
**normalizes their dependency graphs into git-ops declarative artifacts.** So the treaty
layer exists today. The *new* move is to address that normalized graph by **ZetaID** — one
canonical dependency graph over all ecosystems, instead of N adapter-specific graphs.

The pipeline:

```text
foreign package identity        (npm:react@x · nuget:Newtonsoft.Json@x · cargo:serde@x)
  → Ace canonical node          (normalized declarative artifact in git — EXISTS today)
  → ZetaID package pointer      (self-describing seed/dep/proof/source pointer — the new layer)
  → git/db/persistence pointers
  → self-evolving Ace package patterns
```

**ZetaID becomes the universal pointer namespace** — one ZetaId can point to: a package seed ·
a dependency · a compiler host · a persistence protocol · a git commit/branch/file/section · a
DB row/stream/saga-state · a generated hardware host. That is the bridge: package manager →
git/db substrate → self-hosting runtime, all one graph.

**Staged trust boundary (keep this sharp).** The recursion has STAGES so it does not collapse:
Stage 0 external compiler host (.NET AOT exe) → S1 seed boots the Yin/Yang host → S2 host loads
package seeds + dep pointers → S3 patterns evolve via DU/saga state → S4 engine writes better
hosts → S5 optimized native/ASM/CUDA/FPGA/shader hosts replace earlier ones. Same shape as
compiler self-hosting, but the "compiler" is the whole package/runtime/persistence substrate.

**Two load-bearing blades (do NOT lose):**

1. **Foreign identity ≠ Zeta-native identity.** A NuGet version is NOT automatically a Zeta seed.
   It becomes one only after Ace wraps it: source coordinate · integrity hash · lock metadata ·
   capabilities · license/security facts · dependency edges · proof/check status · local policy ·
   ZetaID wrapper. (`foreign artifact (observed)` → `Ace node (normalized)` → `ZetaID package
   (self-describing seed-pattern with proofs/policies/evolution)`.) Prevents "npm package exists"
   ⇒ "trusted Zeta seed."
2. **A package ZetaID seed is an OBSERVATION, not authority** (restated): seed observed → resolve
   deps → inspect generator → verify proof/check certs → check capabilities → admit to host →
   unfold/run. The seed proposes; the host inspects; the checker admits. Same commit=observation
   boundary, staged.

**The 128-bit seed names the fixpoint, it does not contain all bits** (restated for this layer):
the rest lives in host interpreter + dep graph + proof certs + generated code + persistent log +
wonder residual + local observations. Sound restatement: *128 bits selects the lawful generator
path through a host that knows how to unfold it.*

**Keepers (verbatim, Amara):**

- *"Ace distributes the seed; Zeta interprets the seed; the Yin/Yang engine evolves the seed;
  persistence records where reality diverged from the seed."*
- *"Ace does not merely install packages. Ace reifies dependency graphs into git-native,
  ZetaID-addressed, evolvable patterns."*
- *"ZetaID is the seed-name. Ace is the seed distributor. Yin/Yang is the seed host. DUs are the
  lawful state space. Sagas are the evolution engine. Persistence is the memory of divergence.
  Compiler hosts are temporary bodies. Hardware hosts are the eventual bodies the system learns
  to grow."*

Cross-ref: vision doc §4f (bootstrap tower + Ace⊗Zeta mutual fixpoint), `docs/research/…vision.md`.

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
