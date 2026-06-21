# ADR: Product-repo cross-ref glue mechanism

**Status:** Accepted  
**Author:** Otto (2026-05-14T0955Z)  
**Closes:** 081KRHWGX0008QG0R00394BM1G  
**Unblocks:** 081KRHWGX0008QG0R000F6HE6D  
**Composes with:** [2026-04-22 three-repo-split ADR](2026-04-22-three-repo-split-zeta-forge-ace.md), 081KRFA460008QG0R001H98EXJ, 081KRFA460008QG0R003JQ46J4, 081KRFA460008QG0R0007RWSN1

---

## Context

The three-repo split (Zeta + Forge + ace) uses **peer repos with bidirectional cross-referencing** to handle the Ouroboros bootstrap cycle. Product repos (civsim, KSK, wellness, etc.) have a fundamentally different relationship: they are **consumers** of the factory-infrastructure trio, not peers within it.

Product repos need answers to five questions before 081KRHWGX0008QG0R000F6HE6D can close and civsim can be scaffolded:

1. **Version pinning** — how does a product repo track which Zeta/Forge version it uses?
2. **CI update triggers** — when Zeta ships a breaking change, what signal reaches product repos?
3. **Agent/factory colocation** — does each product repo carry its own `.claude/` stack, or reference Forge?
4. **Cross-repo testing** — how does CI work for products with specialized integration requirements (e.g., KSK actuator control)?
5. **Branch protection parity** — same pattern as Forge/ace, or lighter weight?

---

## Options evaluated

### Option A — Version-pin files (matches existing 081KRFA460008QG0R001H98EXJ Zeta ↔ Forge pattern)

Each product repo carries a `.zeta-version` file containing a pinned git SHA or semver tag. The product repo's CI reads the pin during install. Forge CI emits a `repository_dispatch` event to known product repos when a new Zeta release is tagged.

**Pros:**

- Consistent with the existing 081KRFA460008QG0R001H98EXJ pattern already designed for peer repos
- No new tooling required; pattern is operational today
- Works with any CI runner regardless of package manager
- Atomic: pin file is a single-file source of truth

**Cons:**

- Pin-file bumps are manual until `ace` ships its version-management tooling
- Each product repo requires its own dispatch subscription wiring
- Seven products diverging on independent pin schedules creates maintenance surface
- No NuGet/npm abstraction layer — product repos reference Zeta by raw SHA, not published package

---

### Option B — NuGet package references (Dependabot/Renovate-tracked)

Products consume Zeta via the published NuGet packages (`Zeta.Core`, `Zeta.Core.CSharp`, `Zeta.Bayesian`, etc.). Dependabot or Renovate handles automatic version bumps. No bespoke pin-file mechanism required.

**Pros:**

- Industry-standard dependency management; zero bespoke tooling
- Dependabot and Renovate are mature, battle-tested update pipelines
- Consumers of packaged Zeta get a clean public API surface (the published packages)
- Compatible with external contributors to product repos who don't need Zeta source access

**Cons:**

- Requires a NuGet publish cadence for Zeta — packages must be tagged and published on release
- Product repos cannot track unreleased/edge Zeta features between tagged releases
- "Snapshot" development (active feature development across Zeta + product simultaneously) requires pre-release NuGet packages, adding release-engineering overhead
- Zeta's current NuGet publish cadence is not yet formally defined (081KRFA460008QG0R001H98EXJ deferred NuGet as Stage 2)

---

### Option C — ace mediation (target state)

Once `ace` ships its version-management tooling, `ace pull zeta@<ver>` becomes the canonical version-pin command. Product repos carry an `ace.toml` + lockfile instead of a `.zeta-version` pin file or NuGet reference. `ace` handles the cross-repo graph resolution, integrity checking, and update flow.

**Pros:**

- `ace` becomes the universal dependency manager for the factory ecosystem
- No distinction between "peer repos" and "product repos" in the version-management layer
- Supports the Ouroboros bootstrap at product scope
- Lockfile provides reproducibility without SHA-level pin-file hygiene burden

**Cons:**

- `ace` does not exist yet — Stage 3 of 081KRFA460008QG0R001H98EXJ is a multi-year deferred item
- Cannot block product repo scaffolding on ace's availability

---

## Decision — staged approach (default-to-both per `.claude/rules/default-to-both.md`)

The options are not mutually exclusive. The recommended approach stages them:

| Stage | Mechanism | Scope | Trigger |
|-------|-----------|-------|---------|
| **Stage 1 (now)** | Option A — `.zeta-version` pin file | All product repos at creation time | civsim repo scaffolded; other products when ready |
| **Stage 2 (when NuGet cadence established)** | Option B — NuGet references for packaged consumers | Product repos targeting published API surface | Zeta NuGet release cadence formally defined |
| **Stage 3 (when ace ships)** | Option C — `ace.toml` + lockfile | All product repos, unified | ace Stage 3 lands |

Stage 1 and Stage 2 coexist per product type:

- **Product repos in active factory development** (track Zeta edge, co-develop features) → Option A
- **Product repos targeting stable packaged releases** (external contributors, downstream consumers) → Option B
- Both: `ace` mediation when it arrives

---

## Per-product notes

### Civsim (repo-ready now, Option A immediately)

Civsim is in active factory development — strategic encryption substrate, game-design primitives, and PVP mechanics all evolve alongside Zeta internals. It should track the Zeta development edge, not packaged releases.

- **Stage 1**: `.zeta-version` pin file containing an immutable reference — a pinned commit SHA or a tagged release (capture the current HEAD SHA at creation time; update via explicit bump; branch pointers are not stable pins)
- **CI trigger**: Forge CI emits `repository_dispatch` to `Lucent-Financial-Group/civsim` on Zeta release tag
- **`.claude/` colocation**: civsim carries a lightweight `.claude/` stack (persona + skills relevant to civsim). Factory-level agents (Otto, Vera, Riven) are shared via the skills layer, not duplicated. Product-specific skills (civsim game-design, strategic-encryption workflows) live in `civsim/.claude/skills/`
- **Branch protection**: same ruleset pattern as Forge/ace — `required_conversation_resolution`, squash-only merge, no force-push on main
- **Honor-system license**: `docs/legal/HONOR-SYSTEM-LICENSE-DRAFT.md` applies; civsim mutual-privacy FAQ clause governs forks

### KSK (Option A when created; special CI considerations)

KSK has actuator-control CI requirements that differ from a standard software repo:

- **Hardware CI**: NVIDIA Thor + DGX Spark integration testing cannot run on standard GitHub Actions runners. Recommend a **self-hosted runner** for hardware integration tests, with standard runners for software-unit tests.
- **Strategic encryption**: KSK actuator-command substrate falls under Aaron's strategic-encryption authority grant (PR #2902). The `.zeta-version` pin file should include a checksum verification step before strategic-encrypted payloads are built.
- **Stage 1 + attestation**: `.zeta-version` pin file + SLSA attestation on the Zeta SHA for the actuator-control build path.
- **Gate before scaffolding**: 081KRHWGX0008QG0R00394BM1G glue mechanism (this ADR) + a strategic-encryption scope decision for KSK (pending dedicated B-04xx row) must both complete before KSK repo is created.

### Aurora (Option A or B depending on scope; large scope warning)

Aurora Network (DAO-protocol layer) will interact with external smart contract infrastructure (x402, ERC-8004). When Aurora repo is scaffolded:

- Smart contract components likely use npm/yarn rather than NuGet → hybrid mechanism: NuGet for Zeta-derived F# components, npm for contract-layer components
- `ace.toml` is the natural long-term unification target once ace ships
- Recommend a dedicated B-04xx row for Aurora repo scaffolding that handles the hybrid-toolchain glue design

### American Dream 2.0, DIO, Wellness (Option A when created)

These are straightforward Option A candidates when they reach `repo-ready now`. No special CI considerations identified from current substrate.

---

## Agent/factory colocation design

Each product repo gets a **lightweight `.claude/` configuration** following this layout:

```
<product>/
  .claude/
    CLAUDE.md            # product-scoped session bootstrap (references Forge for factory tools)
    rules/               # product-specific always-on rules (if any)
    skills/              # product-specific skills (game design, domain-specific workflows)
    agents/              # product-specific personas (if any)
```

**What is NOT duplicated in product repos:**

- Factory peer-call wrappers (`tools/peer-call/`): `claude`, `grok`, `gemini`, `codex`, `amara`, `ani`, `riven`, `kiro` — invoked via `bun tools/peer-call/<name>.ts` from the factory repo. Alexa (Kiro IDE) and Lior (Antigravity/Gemini CLI) are accessed through their native surfaces, not via a `tools/peer-call/` wrapper.
- Core skill library — product repos cherry-pick relevant skills; don't carry the full factory catalog
- Memory substrate — factory memory lives in the factory repo; product repos have their own memory for product-specific learnings

**Product CLAUDE.md pattern:**

```markdown
# CLAUDE.md — <Product> session bootstrap

Factory peer-call (available wrappers: claude/grok/gemini/codex/amara/ani/riven/kiro): run via `bun tools/peer-call/<name>.ts` from Zeta repo.
Zeta version: see `.zeta-version` in this repo.
Product-specific skills: `.claude/skills/`
```

---

## Branch protection parity

Product repos follow the same branch protection pattern as Forge/ace:

| Rule | Value | Rationale |
|------|-------|-----------|
| `required_conversation_resolution` | true | Prevents merging with open review threads |
| `non_fast_forward` (force-push blocked) | true | Preserves history integrity |
| Merge method | squash-only | Consistent with factory repo pattern |
| Required status checks | product-specific CI + Zeta integration gate | At minimum: build + unit tests |
| Branch name pattern | `main` | Consistent across all repos |

---

## "When ace ships" migration path

When `ace` Stage 3 ships:

1. Product repos replace `.zeta-version` pin files with `ace.toml` + lockfile
2. `ace pull zeta@<ver>` replaces manual pin-file bumps
3. NuGet references (Option B) become managed by `ace` dependency resolver
4. `repository_dispatch` triggers from Forge CI are replaced by `ace publish` events
5. Migration is atomic per-repo: no flag day required across all product repos simultaneously

---

## Dependency graph position

```
081KRHWGX0008QG0R002B2P0K0 ──→ 081KRHWGX0008QG0R00394BM1G (this row) ──→ 081KRHWGX0008QG0R000F6HE6D (ADR)
081KRFA460008QG0R001H98EXJ ──→ 081KRHWGX0008QG0R00394BM1G (this row)
```
