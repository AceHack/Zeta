---
id: 081KRHWGX0008QG0R003XHCEXT
priority: P1
status: closed
closed: 2026-05-14
closed_by: "docs/research/2026-05-14-product-repo-naming-review-b0425.md"
title: "Naming-expert review for product repo names — KSK / wellness / civsim / AD2.0 / DIO / Aurora / Dawn"
type: design
origin: 081KRFA460008QG0R003JQ46J4 decomposition (Otto 2026-05-14)
created: 2026-05-14
last_updated: 2026-05-14
depends_on:
  - 081KRHWGX0008QG0R002B2P0K0
composes_with:
  - 081KRFA460008QG0R003JQ46J4
  - .claude/skills/naming-expert/SKILL.md
  - .claude/rules/honor-those-that-came-before.md
---

# 081KRHWGX0008QG0R003XHCEXT — Naming-expert review for product repo names

## What this row does

Run **naming-expert review** on each product name that will become a public GitHub
repo slug. Products where 081KRHWGX0008QG0R002B2P0K0 verdict is "repo-ready now" or "repo-ready later"
need this review before scaffolding begins.

The naming-expert skill (Ilyana, per `public-api-designer` agent) holds authority over
public-surface naming. Per the three-repo-split memory:
> "naming-expert (Ilyana) gate stays open for public-announce if brand-critical."

Product repos will be public from day one per glass-halo + Aaron's "all public" signal.
That makes their names brand-critical immediately.

## Depends on

**081KRHWGX0008QG0R002B2P0K0** (per-product substrate inventory) — need to know which products get repos
before reviewing which names need approval. A product staying in monorepo doesn't
need a repo name review.

## What naming-expert review evaluates per product

For each product repo name, the naming-expert skill checks:

1. **Collision risk** — does the name conflict with an established open-source project,
   NuGet package, npm package, PyPI package, or well-known brand?
2. **CLI-clean** — one word preferred; fits alongside `Zeta`, `Forge`, `ace` at the shell
3. **Adopt-existing vs invent** — per `feedback_dont_invent_when_existing_vocabulary_exists.md`,
   prefer adopting established term-of-art over coining
4. **Alignment with product identity** — name matches the product's carved-sentence
5. **Cross-linguistic resonance** — especially relevant for DIO (Indonesian/Italian/Spanish)
6. **Abbreviation safety** — KSK abbreviation already established; verify no collision

## Product names to evaluate

### Repo names to review (existing handles)

| Product | Handle in use | Repo name candidate | Review needed |
|---------|--------------|---------------------|---------------|
| KSK | "KSK" / "Kinetic Safeguard Kernel" | `ksk` or `kinetic-safeguard-kernel` | Collision check; abbreviation safety |
| Wellness | "wellness app" | `wellness` or `zeta-wellness` | Namespace collision (many wellness apps) |
| Civsim | "civsim" | `civsim` or `civ-sim` | Collision check; game-design reference |
| American Dream 2.0 | "American Dream 2.0" | `american-dream` or `ad2` | Abbreviation + trademark check |
| DIO | "DIO" | `dio` | "Dio" (musician) + "DIO" (Jojo's Bizarre Adventure) collision check |
| Aurora | "Aurora" | `aurora` | Many projects named Aurora; disambiguation needed |
| Dawn | "Dawn" | `dawn` | Common name; collision check |

### Special considerations

**DIO**: Cross-linguistic resonance (Indonesian/Italian/Spanish) is a feature per
Aaron's substrate. Verify the name works across those languages. Also: Ronnie James Dio
(rock musician) + DIO (JoJo's Bizarre Adventure villain) are notable collisions.

**Aurora**: High collision risk — Aurora is a popular name for open-source projects,
databases (Amazon Aurora), and products. May need `zeta-aurora`, `aurora-alignment`,
or another disambiguator.

**KSK**: The abbreviation is established in Aaron's substrate. Homeland-Security
context makes it important there's no conflicting government acronym in this space.
Search for "KSK" in the national-security / robotics domain.

## What the output looks like

A new file: `docs/research/2026-05-14-product-repo-naming-review-b0425.md`

Structure per product:
```
## [Product name]
Repo slug candidates: [list]
Collisions found: [list with links]
Recommended slug: [choice]
Naming-expert notes: [brief rationale]
Cross-linguistic check: [if applicable]
```

Plus a summary table of approved repo slugs.

## Definition of done

- All products with "repo-ready now" verdict (from 081KRHWGX0008QG0R002B2P0K0) have an approved repo slug
- Products with "repo-ready later" have a provisional slug (subject to re-review at
  creation time) — these do NOT block 081KRHWGX0008QG0R000F6HE6D
- Collision searches documented with dates (Otto-364 search-first-authority)
- Summary table present in output file
- 081KRHWGX0008QG0R000F6HE6D can reference the approved slugs

## Dependency graph position

```
081KRHWGX0008QG0R002B2P0K0 ──→ 081KRHWGX0008QG0R003XHCEXT (this row) ──→ 081KRHWGX0008QG0R000F6HE6D (ADR)
```
