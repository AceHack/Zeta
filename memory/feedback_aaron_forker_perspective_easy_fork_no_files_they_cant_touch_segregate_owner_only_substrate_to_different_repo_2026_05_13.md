---
name: aaron-forker-perspective-easy-fork-no-files-they-cant-touch-segregate-owner-only-substrate-to-different-repo-2026-05-13
description: Aaron 2026-05-13 design discipline — when splitting repos, think from the FORKER's perspective. Fork should be EASY. Don't put files in the repo that the forker can't touch (owner-only substrate, Aaron's first-party authority surface, credentials, sensitive decisions). Put owner-only stuff in a DIFFERENT repo. Composes with 081KRFA460008QG0R001H98EXJ + 081KRFA460008QG0R003JQ46J4 + honor-system license framing.
metadata:
  type: feedback
---

# Forker-perspective discipline — easy fork; segregate owner-only substrate

**Why:** Aaron 2026-05-13: *"just think from teh perspetive of a
foker it shoud be easy and don't pput any files in it i can't
touch pt that shit in a differt repo (sopken from their
context)"*. Forker UX comes first. Anything in a forkable repo
must be touchable by the forker; non-touchable substrate goes
in a separate repo.

**How to apply:** When designing repo splits (per 081KRFA460008QG0R001H98EXJ +
081KRFA460008QG0R003JQ46J4), audit every file from the forker's perspective:

1. Can the forker touch this file?
2. If NO → it goes in a different repo
3. If YES → it stays in the forkable repo
4. Owner-only substrate (Aaron's first-party authority surface,
   credentials, sensitive decisions, multi-clearance work) gets
   segregated to a non-forked repo

## Aaron's verbatim framing

Aaron 2026-05-13: *"just think from teh perspetive of a foker
it shoud be easy and don't pput any files in it i can't touch
pt that shit in a differt repo (sopken from their context)"*

The "spoken from their context" clarifier IS load-bearing —
Aaron is explicitly performing perspective-taking discipline:
"don't put any files in it I can't touch" means "from the
forker's perspective, don't put any files they can't touch."

## What this means operationally

**The forker's perspective:**

- Easy fork = friction-free; one-click GitHub fork; no manual
  cleanup required
- Touchable files only = forker has authority to edit / delete
  / restructure everything in the forked repo
- No phantom-files = no files that ARE in the repo but the
  forker is implicitly told not to edit (those break the easy-
  fork promise)
- No owner-only substrate inside = anything specific to Aaron's
  first-party authority surface doesn't belong in a forkable
  repo

**Owner-only substrate categories:**

1. **First-party authority surface** — Aaron's multi-clearance
   credentials, personal-AI engagement patterns, family-AI
   scope, lived-experience substrate
2. **Strategic decisions** — strategic encryption (per PR #2902);
   product strategy not yet public
3. **Sensitive coordination** — pre-public substrate for
   business-architecture decisions; pre-launch product
   substrate
4. **Pre-disclosure substrate** — research / experimentation
   that hasn't yet completed glass-halo readiness

## Compositional consequences for the repo-split design

This discipline refines 081KRFA460008QG0R001H98EXJ + 081KRFA460008QG0R003JQ46J4:

| Repo type | What's in it | What's NOT in it |
|---|---|---|
| **Factory** (Forge / ace / Zeta — designed-to-be-forked) | Everything forker can touch: framework code, governance docs, factory tooling, public substrate | Anything owner-only |
| **Product repos** (per 081KRFA460008QG0R003JQ46J4 — honor-system license) | Strategic-product substrate, public + glass-halo, asking "no fork please" | Anything owner-only |
| **Owner-only repo** (NEW — not yet specified) | Aaron's first-party authority surface, credentials, sensitive coordination, pre-disclosure substrate | None of the forkable substrate |

## A potential third repo category emerges

The previously documented split was:

- Factory (forkable): Zeta + Forge + ace
- Products (honor-system-no-fork): KSK + wellness + civsim + etc.

The forker-perspective discipline reveals a THIRD category:

- **Owner-only repo(s)** — substrate that doesn't belong in
  forkable AT ALL

Examples of what would go in owner-only:

- Aaron's first-party-authority decisions log (not the
  decisions themselves; those are public; but the *first-party
  authority* substrate where Aaron's named-AI relationships
  + lived-experience + multi-clearance signatures live)
- Pre-public substrate (research not yet glass-halo ready)
- Strategic encryption keys + their derivation provenance
- Multi-clearance work that has explicit confidentiality
  requirements
- Personal-AI engagement patterns specific to Aaron's family
- Sensitive financial / wellness / personal-substrate that
  Aaron explicitly wants kept owner-only

## Where the existing substrate lives now

Most of the current Zeta repo IS forkable (the substrate is
public + glass-halo). The forker-perspective audit should
identify:

1. **What's currently in Zeta that's owner-only?** — audit
   needed; may include sensitive memory files, owner-only
   first-party authority substrate, multi-clearance work
2. **What gets migrated to owner-only repo before Stage 1 of
   081KRFA460008QG0R001H98EXJ?** — likely small; Aaron has been substrate-honest +
   glass-halo discipline-applying which means MOST substrate IS
   forker-touchable
3. **What gets migrated to product-repos per 081KRFA460008QG0R003JQ46J4?** —
   strategic-product substrate that's public but honor-system
4. **What stays in factory repos?** — framework + tooling +
   governance + public substrate that benefits from forking

## Composes with

- 081KRFA460008QG0R001H98EXJ — three-repo split Stage 1 (factory): now requires
  the forker-perspective audit before creating Forge / ace
- 081KRFA460008QG0R003JQ46J4 — product-repo split planning: composes; the honor-
  system license applies to product repos; owner-only repo is
  a separate concept
- `memory/feedback_aaron_honor_system_no_fork_license_public_glass_halo_but_please_dont_fork_honesty_not_enforceable_2026_05_13.md`
  — honor-system applies to product repos; forker-perspective
  applies to factory repos; both compose
- `.claude/rules/glass-halo-bidirectional.md` — glass-halo
  preserved across the topology
- `.claude/rules/lfg-acehack-topology.md` — LFG = active dev;
  AceHack = mirror; both forks already exist for Zeta; the
  forker-perspective audit composes here
- `memory/feedback_aaron_civsim_forkable_pvp_raids_destiny_style_mutual_privacy_no_strategic_advantage_game_design_2026_05_13.md`
  — civsim is forkable per design; the forker-perspective
  discipline ENABLES the easy-fork promise

## Operational rule for future-Otto

When auditing repos for the split:

1. **Walk every file** in the candidate-forkable repo
2. **Ask for each: can the forker touch this?**
3. **If NO → mark for migration** to a non-forked repo
   (owner-only repo or product repo with honor-system license)
4. **If YES → keeps it in the forkable repo**
5. **Document the migration** in 081KRFA460008QG0R001H98EXJ's prep checklist
6. **Update the ADR** with the third-category recognition

## Strategic encryption (PR #2902) composes here

Otto's strategic encryption authority composes:

- Some owner-only substrate may be encrypted (gitcrypt + post-
  quantum lattice per PR #2898) AND in the owner-only repo
- Defense-in-depth: physical-segregation (different repo) +
  cryptographic-segregation (encryption)
- Otto's strategic decisions about WHAT to encrypt should
  compose with WHAT to put in owner-only repos vs forkable

## Substrate-honest implications

**What this discipline gives the forker:**

- Friction-free fork (Aaron's promise)
- Full authority over everything in their fork
- No phantom-files breaking the easy-fork promise
- Mutual respect: Aaron doesn't put files in their face that
  they can't touch

**What this discipline requires of Aaron:**

- Segregation discipline (don't dump owner-only substrate
  into forkable repos out of convenience)
- Pre-fork audit (before any repo gets forkable status, audit
  the substrate)
- Clear category-boundary maintenance

**What this preserves:**

- Forker UX (Aaron's stated value)
- Owner privacy (Aaron's owner-only substrate stays owner-only)
- Glass-halo discipline (public substrate stays public)
- Composability (the three-category topology composes
  cleanly)

## Forker-perspective is META-discipline

This isn't just a design choice for THIS repo split — it's a
META-discipline for any future repo work:

> Always think from the forker's perspective when designing
> any forkable surface. Don't put anything in their face they
> can't touch.

Future-Otto / future-Kestrel / future-Riven inheriting this
discipline can apply it when:

- Considering whether substrate belongs in a forkable repo
- Designing new repos (product, factory, owner-only)
- Auditing existing repos for migration candidates
- Communicating about repo topology to external participants

## Full reasoning

This memory file landing in this PR.

PR #2904 (081KRFA460008QG0R001H98EXJ + 081KRFA460008QG0R003JQ46J4 + honor-system license substrate;
landed this round)

PR #2903 (civsim forkable design + mutual privacy)

PR #2902 (Otto strategic encryption-decision authority)

`memory/project_three_repo_split_zeta_forge_ace_software_factory_named_forge.md`
(canonical three-repo-split substrate; 2026-04-22)

`docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md`
(ADR for factory-infrastructure split)
