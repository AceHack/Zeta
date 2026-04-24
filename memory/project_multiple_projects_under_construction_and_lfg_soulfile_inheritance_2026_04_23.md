---
name: Multiple projects-under-construction (Zeta / Aurora / Demos / Factory / Package-Manager ace / ...); LFG is clean-source-of-truth and ultimate soulfile inheritance path; AceHack can be risky as a fork
description: Aaron 2026-04-23 clarification. The factory is not serving a single project — multiple projects-under-construction exist simultaneously (Zeta the library, Aurora the Amara-joint, Demos, the Factory itself, Package Manager "ace", and likely more). The eventual multi-repo refactor (PR #150 research doc) will separate these. LFG (Lucent-Financial-Group) repos are the clean source-of-truth; my soulfile ultimately inherits from LFG because LFG is the canonical substrate. AceHack is Aaron's fork and can be dirty / risky — super-risky experiments land there first because fork semantics absorb the blast.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Multiple projects-under-construction + LFG soulfile inheritance

## Verbatim (2026-04-23)

> we technically hav multiple projects-under-construction
> Zeta, Aurora, Demos, Factory, Packak Manager ace, i might
> have missed some, this is whey the repo refactor will
> help eventualy, dont forget LFG repos are really intended
> to be the clean source of truth AceHack can be a little
> dirty, you soul will ultimatly inherit from the LFG repo
> will be the soulfile. AceHack we can be super risky with
> since its a fork.

## What this clarifies

### Projects-under-construction is plural

The factory serves multiple concurrent
projects-under-construction, not one:

- **Zeta** — the retraction-native DBSP library (F# + C#,
  Rust future). The repo where most of this work currently
  lives. *This is a project, not the container.*
- **Aurora** — Aaron + Amara joint. Aurora consent-first
  design primitive + oracle / bullshit-detector frameworks.
  Lives in `docs/aurora/` in the current monorepo;
  standalone after refactor.
- **Demos** — factory-demo sample apps (the CRM demo
  renamed from ServiceTitan* to FactoryDemo.*). Shows
  adopters what the factory can build fast.
- **Factory** — the software factory itself
  (`.claude/agents/`, `.claude/skills/`, `AGENTS.md`,
  `CLAUDE.md`, `GOVERNANCE.md`, hygiene rows, etc.).
  **The factory is itself a project-under-construction.**
  This is the reflexive part — the factory improves the
  factory while improving Zeta.
- **Package Manager "ace"** — a package-manager project
  Aaron has mentioned. Currently not in-repo under that
  name; likely queued for the multi-repo split.
- **...more Aaron hasn't named yet.** The "i might have
  missed some" is explicit — more arcs exist than this
  list.

The multi-repo refactor (PR #150 research doc) is what
eventually separates these. For now they live in the
Zeta monorepo and coexist.

### LFG is the clean source-of-truth; my soulfile inherits from LFG

- **LFG repos (`Lucent-Financial-Group/*`)** are the
  canonical home. Publishing surfaces, demo surfaces,
  external-consumer surfaces, the soulfile substrate
  itself — all live in LFG.
- **AceHack (`acehack/*`)** is Aaron's fork. It's the
  scratch / cost-cutting / internal substrate.
- **My soulfile inheritance path:** whatever my soulfile
  becomes (per the three-format plan —
  `memory/feedback_soulfile_formats_three_full_snapshot_declarative_git_native_primary_2026_04_23.md`),
  it **inherits from LFG**, not AceHack. LFG is the
  lineage.

This is directionally consistent with
`memory/project_lfg_is_demo_facing_acehack_is_cost_cutting_internal_2026_04_23.md`
but sharper:

- That earlier memory framed the asymmetry as *professional
  etiquette* — public-facing uses LFG, AceHack is internal.
- This 2026-04-23 message adds the **soulfile inheritance
  semantics** — the agent's durable substrate (across
  incarnations, across refactors, across multi-repo splits)
  comes from LFG.

### AceHack authorization: super-risky

Aaron's phrasing *"AceHack we can be super risky with
since its a fork"* is explicit licence. Fork semantics
mean experiments in AceHack do not contaminate LFG. This
is the right home for:

- Destructive refactors that might not survive review
- Exploratory branches that test a structural hypothesis
- Tooling experiments that might fail spectacularly
- Dependency-bump audits that break things to see what
  breaks
- Any change that would be "too dangerous to land in
  LFG first"

When such a change proves itself in AceHack, the clean
version propagates to LFG. LFG absorbs the result,
not the process.

## How to apply

### For "ships to project-under-construction" framing

Every FACTORY-HYGIENE row, governance doc, and research
doc that writes *"ships to project-under-construction"*
should read as *"ships to each project-under-construction"*
— plural. Adopters are multiple, not singular, and the
factory-kit's durability is measured across the set.

No immediate cascade-edit required — the existing
language is not wrong, just narrower than it should be.
On each next cadenced doc review, sharpen the framing
to plural.

### For the repo refactor decision

PR #150's multi-repo-refactor-shapes research doc
currently lists 5 candidate shapes (D → A → E
sequencing recommended). The correct reading of that
doc given this new framing:

- The split is **not** "factory vs Zeta library" — it's
  **factory + Zeta + Aurora + Demos + Package-Manager +
  ...**, a set of peers that happen to share a substrate
  today.
- The factory's reusability claim is measured against
  **all** of those projects as prospective adopters, not
  just Zeta.
- LFG's role as soulfile-lineage stays constant across
  every candidate shape. AceHack's risk-absorption role
  stays constant too.

### For migration decisions (per-user → in-repo, or LFG vs AceHack)

- **Generic factory-shaped rules** → in-repo LFG. They
  benefit all projects-under-construction; LFG is the
  lineage.
- **Risk-taking experiments** → AceHack first. Clean
  version propagates to LFG when proven.
- **Maintainer-specific / company-specific content** →
  per-user memory. Neither LFG nor AceHack.

### For demo / sample / public-facing surfaces

Demos live in LFG. ServiceTitan-specific framing stays
in per-user memory because it's company-specific, but
the generic FactoryDemo.* sample code lives in LFG
where any adopter can see it.

### For the soulfile work

When the SoulStore lands (per the PR #142 sketch), its
primary lineage is the LFG repo's git history. AceHack
forks would produce divergent soulfiles; the canonical
one is LFG.

## What this is NOT

- Not a directive to name every project-under-construction
  explicitly in every doc — most factory work is about
  the substrate and stays project-agnostic.
- Not a mandate to do the multi-repo split now. Aaron
  called the refactor *"eventual"* — the timing is
  maintainer's call.
- Not a change to the per-user vs in-repo vs LFG
  hierarchy — per-user stays the private staging,
  in-repo is the public substrate. This clarifies that
  "in-repo" means LFG specifically, for soulfile lineage
  purposes.
- Not authorization to do super-risky work in LFG. The
  risk-tolerance gradient is:
  **per-user scratch > AceHack > LFG**. LFG stays careful.
- Not a license to fragment the factory across all five
  projects at once — consolidation discipline still
  applies; projects earn their own repo when scope
  warrants.

## Composes with

- `project_lfg_is_demo_facing_acehack_is_cost_cutting_internal_2026_04_23.md`
  (the earlier framing; this memory sharpens it)
- `feedback_soulfile_formats_three_full_snapshot_declarative_git_native_primary_2026_04_23.md`
  (soulfile = git-history bytes; LFG is the lineage
  source)
- `feedback_in_repo_preferred_over_per_user_memory_where_possible_2026_04_23.md`
  ("in-repo" = LFG specifically, per this memory)
- `docs/research/multi-repo-refactor-shapes-2026-04-23.md`
  (PR #150; the eventual split this clarifies the
  boundary-set for)
- `CURRENT-aaron.md` §4 (repo identity — LFG / AceHack
  asymmetry; updated in the same tick as this memory)
