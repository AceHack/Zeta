---
id: 081KRHWGX0008QG0R00394BM1G
priority: P1
status: closed
closed: 2026-05-14
closed_by: "docs/DECISIONS/2026-05-14-product-repo-glue-mechanism.md"
title: "Product-repo cross-ref glue mechanism design — how product repos reference Zeta/Forge/ace"
type: design
origin: 081KRFA460008QG0R003JQ46J4 decomposition (Otto 2026-05-14)
created: 2026-05-14
last_updated: 2026-05-14
depends_on:
  - 081KRHWGX0008QG0R002B2P0K0
composes_with:
  - 081KRFA460008QG0R003JQ46J4
  - 081KRFA460008QG0R001H98EXJ
  - 081KRFA460008QG0R0007RWSN1
  - 081KRFA460008QG0R000VKJF0H
  - memory/project_three_repo_split_zeta_forge_ace_software_factory_named_forge.md
  - docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md
---

# 081KRHWGX0008QG0R00394BM1G — Product-repo cross-ref glue mechanism design

## What this row does

Design the **cross-repo reference mechanism** for product repos — how product repos
(KSK / wellness / civsim / etc.) reference Zeta, Forge, and ace as upstream deps.

This is the product-side equivalent of the peer-repo cross-referencing already
designed for Zeta ↔ Forge ↔ ace in the three-repo split ADR. Products are CONSUMERS
of the factory-infrastructure repos, not peers in the Ouroboros cycle.

## Depends on

- **081KRHWGX0008QG0R002B2P0K0** — need to know which products get repos; design must work for all of them
- **081KRFA460008QG0R001H98EXJ** — the established glue pattern (peer repos, version-pin files,
  `repository_dispatch` CI triggers) must be understood before extending it

## The design problem

The three-repo split (Zeta + Forge + ace) uses **peer repos with cross-referencing**
to handle the Ouroboros cycle. Product repos have a simpler, one-directional
relationship: they consume Zeta/Forge/ace but don't need to be consumed back.

Key questions this row resolves:

1. **Version pinning**: Do product repos pin to a Zeta semver, a git SHA, or a
   future `ace pull zeta@<ver>` command?
2. **CI triggers**: When Zeta ships a breaking change, which CI signal updates
   product repo dependencies? Is there a `repository_dispatch` pattern from Zeta
   to product repos? Or do products use Dependabot / Renovate?
3. **Agent/factory colocation**: Product repos likely need `.claude/` configuration.
   Does each product repo get its own agent persona stack, or does it reference
   Forge for factory tools?
4. **Testing across repos**: Does KSK (robotics) need to run Zeta integration tests
   against its own actuator-control substrate? How does that CI work?
5. **Branch protection parity**: Same pattern as Forge/ace? Or lighter weight for
   products?

## Design options

### Option A — Version-pin files (same as Zeta ↔ Forge today)

Product repos get a `.zeta-version` file pinning a Zeta git SHA or semver tag.
CI in the product repo reads the pin on install. Forge CI publishes a
`repository_dispatch` event when a new Zeta release tags.

**Pros**: consistent with existing 081KRFA460008QG0R001H98EXJ pattern; no new tooling needed  
**Cons**: manual pin-file bumps until ace ships; may diverge across 7 products

### Option B — Dependabot / Renovate tracking NuGet/npm packages

Products consume Zeta via a NuGet package (`Zeta.Core.*`). Dependabot auto-bumps
the package reference. No bespoke pin-file mechanism needed.

**Pros**: industry-standard; zero bespoke tooling  
**Cons**: requires NuGet publish cadence for Zeta; product repos can't use unreleased
Zeta features

### Option C — ace mediation (target state)

`ace pull zeta@<ver>` is the canonical version-pin mechanism once ace ships.
Product repos get an `ace.toml` + lockfile instead of a `.zeta-version` pin file.

**Pros**: Ouroboros bootstraps at product scope; ace becomes the universal glue  
**Cons**: ace doesn't exist yet (081KRFA460008QG0R001H98EXJ Stage 3 is multi-year deferred)

### Recommended path: Option A now → Option B for packaged releases → Option C when ace ships

Default to **both** (per `.claude/rules/default-to-both.md`): product repos that
are product-deliverable use NuGet references (Option B); repos that track Zeta's
development edge use version-pin files (Option A). Option C is the long-term target.

## Output format

A new design section in `docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md`
(extend the existing ADR, or create a companion ADR):
`docs/DECISIONS/2026-05-14-product-repo-glue-mechanism.md`

Structure:

- Decision context (product-vs-factory-repo shape difference)
- Three options evaluated (A/B/C)
- Decision: recommended staged approach
- Per-product notes (KSK CI/CD has special actuator-control considerations;
  civsim's strategic encryption composes with the pin mechanism; etc.)
- "When ace ships" migration path

## Definition of done

- Decision document created
- Three options documented with pros/cons
- Recommended staged approach chosen with rationale
- Per-product notes for any special cases (KSK robotics CI, civsim encryption)
- 081KRHWGX0008QG0R000F6HE6D (ADR) can reference this decision

## Dependency graph position

```
081KRHWGX0008QG0R002B2P0K0 ──→ 081KRHWGX0008QG0R00394BM1G (this row) ──→ 081KRHWGX0008QG0R000F6HE6D (ADR)
081KRFA460008QG0R001H98EXJ ──→ 081KRHWGX0008QG0R00394BM1G (this row)
```
