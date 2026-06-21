---
id: 081KRHWGX0008QG0R000F6HE6D
priority: P1
status: closed
closed: 2026-05-14
closed_by: "docs/DECISIONS/2026-05-14-product-repo-split-decisions.md"
title: "ADR — product-repo split decisions; closes 081KRFA460008QG0R003JQ46J4"
type: design
origin: 081KRFA460008QG0R003JQ46J4 decomposition (Otto 2026-05-14)
created: 2026-05-14
last_updated: 2026-05-14
depends_on:
  - 081KRHWGX0008QG0R000BWAXNP
  - 081KRHWGX0008QG0R002B2P0K0
  - 081KRHWGX0008QG0R003XHCEXT
  - 081KRHWGX0008QG0R00394BM1G
composes_with:
  - 081KRFA460008QG0R003JQ46J4
  - 081KRFA460008QG0R001H98EXJ
  - docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md
  - memory/feedback_aaron_honor_system_no_fork_license_public_glass_halo_but_please_dont_fork_honesty_not_enforceable_2026_05_13.md
---

# 081KRHWGX0008QG0R000F6HE6D — ADR: product-repo split decisions (closes 081KRFA460008QG0R003JQ46J4)

## What this row does

Author the **Architecture Decision Record** capturing all product-repo split decisions.
This row closes 081KRFA460008QG0R003JQ46J4 when merged.

The ADR synthesizes the outputs of all prior child rows:

- 081KRHWGX0008QG0R000BWAXNP (license language)
- 081KRHWGX0008QG0R002B2P0K0 (substrate inventory + repo-readiness verdicts)
- 081KRHWGX0008QG0R003XHCEXT (approved repo slugs)
- 081KRHWGX0008QG0R00394BM1G (cross-repo glue mechanism)

## Depends on (all four)

- **081KRHWGX0008QG0R000BWAXNP** — honor-system license language ready
- **081KRHWGX0008QG0R002B2P0K0** — per-product verdict: repo-ready now / later / stays-in-monorepo
- **081KRHWGX0008QG0R003XHCEXT** — approved repo slugs for "now" and provisional slugs for "later" products
- **081KRHWGX0008QG0R00394BM1G** — cross-repo glue mechanism decided

## ADR structure

The ADR will be created at:
`docs/DECISIONS/2026-05-14-product-repo-split-decisions.md`

### Sections

**Context**

- Two-axis split: factory-infrastructure (081KRFA460008QG0R001H98EXJ) vs product-portfolio (081KRFA460008QG0R003JQ46J4)
- Glass-halo + honor-system license design (Aaron 2026-05-13)
- Sibling of the three-repo-split ADR

**Decision**

- Which products get repos, which don't (yet), which stay in monorepo
- Repo slugs (from 081KRHWGX0008QG0R003XHCEXT)
- License applied (from 081KRHWGX0008QG0R000BWAXNP)
- Cross-repo glue mechanism (from 081KRHWGX0008QG0R00394BM1G)
- Staging timeline: "now" products vs "later" products

**Consequences**

- Factory-product separation of concerns
- Each product repo gets its own CI/CD, branch protection, CodeQL scope
- Honor-system license is a social/cultural contract; glass-halo preserved
- civsim forkable ecosystem enabled; mutual privacy at fork scope

**Open questions** (not blocking the ADR)

- When does ace ship? (determines glue mechanism migration path from pin-files
  to `ace pull`)
- Which products are ready for public-announce vs "public but not announced"?
- Strategic-encryption scope (gitcrypt): which product repos need this layer?
  (Per Otto's strategic-encryption authority, PR #2902)

**Migration path**

- Stage 1: create repos for "repo-ready now" products (scaffolding via 081KRFA460008QG0R001H98EXJ
  `create-repo.ts` pattern, adapted for product repos)
- Stage 2: move product substrate from Zeta monorepo to product repos
- Stage 3: when ace ships, migrate pin-files to `ace.toml`

**Scaffolding checklist** (per 081KRFA460008QG0R001H98EXJ's "by-default principle")

Each product repo inherits the full Zeta hard-won best-practices checklist — the ADR
records this inheritance explicitly so product repos don't need to re-justify each
item.

## Supersedes

This ADR does NOT supersede `docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md`.
It is a **companion ADR** for the product axis. The factory-infrastructure ADR and
product-portfolio ADR are sibling documents.

## Definition of done

- ADR created at `docs/DECISIONS/2026-05-14-product-repo-split-decisions.md`
- All four dependency outputs (081KRHWGX0008QG0R000BWAXNP / 081KRHWGX0008QG0R002B2P0K0 / 081KRHWGX0008QG0R003XHCEXT / 081KRHWGX0008QG0R00394BM1G) referenced
- Decision table present: which products get repos + when + what slug + what license
- Staging timeline present
- 081KRFA460008QG0R003JQ46J4 marked closed with this ADR's PR as the closing reference

## Dependency graph position

```
081KRHWGX0008QG0R000BWAXNP ──→ 081KRHWGX0008QG0R000F6HE6D (this row — closes 081KRFA460008QG0R003JQ46J4)
081KRHWGX0008QG0R002B2P0K0 ──→ 081KRHWGX0008QG0R000F6HE6D
081KRHWGX0008QG0R003XHCEXT ──→ 081KRHWGX0008QG0R000F6HE6D
081KRHWGX0008QG0R00394BM1G ──→ 081KRHWGX0008QG0R000F6HE6D
```
