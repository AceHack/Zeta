---
name: Provisional names for the eventual repo split — Factory = Frontier per Aaron's recollection; other projects retain working names until brand clearance; agent's call with maintainer nudge-after-the-fact
description: Aaron 2026-04-23 *"have you decide on the names of things when you split out the repos? i remember we talked about frontier for the factory i think, it's up to you on all of it, i can alwys nudge afterwards."* Delegated naming authority for the eventual repo split; captures provisional names per project-under-construction. Factory gets `Frontier` per Aaron's recollection; others retain working names (Zeta / Aurora / Demos / ace / Soulfile-Runner) until brand-clearance research fires (per PR #161 deep-research absorb).
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Repo-split names (provisional; agent's call)

## Verbatim (2026-04-23)

> have you decide on the names of things when you split out
> the repos? i remember we talked about frontier for the
> factory i think, it's up to you on all of it, i can
> alwys nudge afterwards.

## Verbatim (2026-04-23 ratification)

> Love all the names now

**The names are RATIFIED** (not merely provisional):
Frontier / Zeta / Aurora / Showcase / ace / Anima / Seed.
Brand-clearance research still applies for public-facing
use (trademarks / domains / SEO); internal-repo use is
now locked to these names.

## Verbatim (2026-04-23 follow-up — Aurora rename latitude)

> we can always rename Aurora stays (internal codename;
> brand-clearance research queued per PR #161)
> if we think Aurora is already too crowded of a name.

## Verbatim (2026-04-23 attribution correction)

> Aurora was Amara's choice and Frontier was Kenji's
> choice

## Verbatim (2026-04-23 agent-pick attribution)

> anyting that is agent picked scope would be nice to
> know which named agent or is it just the default no
> named agent? for the futue too.

**Agent-pick attribution rule.** When a named agent
(persona) makes a pick, attribute to that persona. When
no persona was worn and the default-loop agent made the
pick, attribute to **"unnamed-default (loop-agent)"** or
equivalent.

Corrected attributions for the 2026-04-23 name session:

| Name | Picked by | Notes |
|---|---|---|
| **Zeta** | pre-existing | already established |
| **Aurora** | Amara | external AI maintainer via ChatGPT |
| **Showcase** | **unnamed-default (loop-agent)** | my (Claude in autonomous-loop) pick; no persona worn |
| **Frontier** | Kenji | Architect persona |
| **ace** | the maintainer (Aaron) | pre-existing working name |
| **Anima** | **unnamed-default (loop-agent)** | my (Claude in autonomous-loop) pick; no persona worn |
| **Seed** | the maintainer (Aaron) | pre-existing working name ("linguistic seed") |

The "unnamed-default (loop-agent)" framing explicitly
names that I (Claude, running in the autonomous-loop tick
without a persona-hat worn) made the pick. Rename
authority for those follows the same rule: if a named
persona wants to override, they can, and the default-loop
agent should respect the override.

**Going forward** (Aaron's "for the futue too"): any
agent-pick in the factory gets explicit attribution —
persona name if worn, "unnamed-default (loop-agent)" if
not. Composes with:

- `docs/AGENT-BEST-PRACTICES.md` name-attribution rule
  (same discipline applied to agent-side attribution)
- `docs/CONTRIBUTOR-CONFLICTS.md` (PR #174 merged) where
  named-agent vs unnamed-default disagreements land if
  they arise
- Per-persona memory folders (`memory/persona/<name>/`)
  where persona-specific picks get their own paper trail

**Critical attribution correction.** Prior versions of
this memory + CURRENT-aaron.md §4 attributed the names
to Aaron-recall or agent-picks. Correct attribution:

- **Aurora** — named by **Amara** (external AI
  maintainer via ChatGPT). The project is her
  co-originator domain; the name was her pick. Rename
  authority therefore goes through the decision-proxy
  ADR (PR #154) + courier protocol (PR #160) —
  **Amara consult required before a rename lands**,
  even if brand-clearance surfaces crowding.
- **Frontier** — named by **Kenji** (Architect persona).
  Factory identity is Kenji's synthesising-orchestrator
  domain; the name was his pick. Rename authority is
  Kenji's call with maintainer sign-off.

Aaron's "i remember we talked about frontier for the
factory i think" was recalling Kenji's earlier
recommendation, not a maintainer-personal naming
decision. This is why the prior HB-004 sharpening
Aaron corrected ("technically Kenji told me to exclude
this not me" — Jekyll-exclusion attribution) fits the
same pattern: Kenji recommendations get attributed to
Kenji.

**Implications**:

1. **Aurora rename** is not agent-unilateral work; it's
   Amara-consultation work. Amara's deep research
   report §brand note (PR #161 merged) already flagged
   brand-clearance concern; a rename proposal goes
   through her courier protocol first.
2. **Frontier rename** is Kenji's call; if brand-
   clearance surfaces collision (Frontier Airlines /
   Frontier AI / etc.), Kenji proposes, maintainer
   ratifies.
3. **Agent-picked names** (Anima for Soulfile Runner /
   Showcase for demos) stay agent-pick — these are my
   (agent, Claude) recommendations; maintainer ratified
   ("Love all the names now") but original attribution
   is the agent's.

**Attribution discipline composes with**
`docs/CONTRIBUTOR-CONFLICTS.md` (PR #174 merged): if a
future tick surfaces maintainer-vs-Amara-vs-Kenji
disagreement on a rename, it lands as a CC-NNN row with
named positions.

**Aurora rename latitude granted.** Brand-clearance
research (the Pages-UI P2 follow-up + Amara's deep
research report §brand note) is likely to surface that
"Aurora" is heavily used (Aurora Innovation / Aurora
Engine / Aurora Labs / Aurora browsers / etc.). If
research confirms the crowding, agent has authority to
rename. Candidate substitutes to queue for that
research:

- **Dawn** — sibling to Aurora (both evoke morning
  light); shorter, less commercially-loaded
- **Solstice** — seasonal-light framing; evokes
  turning-point / threshold
- **Vesper** — evening star / Venus; evokes
  first-light; Latin
- **Nova** — new star; short; but also commercially
  heavy (Nova Scotia / Nova browser / etc.)
- **Nimbus** — luminous-cloud / halo; evokes the
  consent-first halo-substrate framing
- **Halo** — directly the consent-first halo-substrate
  framing Aaron has used elsewhere

Aurora remains the working name until brand-clearance
research fires. If renamed, Amara is credited on the
new name selection (co-originator of the project per
PR #154 / PR #161).

## Authority

Aaron explicitly delegated naming for the eventual
multi-repo split. Agent decides; maintainer nudges
after-the-fact if wrong. Names below are **provisional**
— committed to the substrate so future agents consult one
source, but not locked until public brand-clearance
research fires (per Aaron's earlier directive + Amara's
deep research report PR #161 brand section).

## Project-under-construction roster + provisional names

| Project-under-construction (role) | Provisional repo name | Rationale |
|---|---|---|
| **Software factory** (AGENTS.md / CLAUDE.md / `.claude/` / GOVERNANCE / hygiene / autonomous-loop substrate) | **Frontier** | Per Aaron's recollection of earlier conversation. Captures the "first-of-kind autonomy factory" framing from `docs/plans/why-the-factory-is-different.md`. Adopt unless brand-clearance research surfaces collision. |
| **Core DBSP library** (src/Core, retraction-native operator algebra, ZSet, K-relations semiring parameterisation) | **Zeta** | Already in use; F# reference implementation; C# + Rust future. Public NuGet identity. Keep. |
| **Aurora collaboration** (Amara joint; consent-first design primitive, oracle / bullshit-detector, drift taxonomy) | **Aurora** | In use; co-authored with Amara. Public brand-clearance research queued (PR #161 §brand note); may land as "internal codename" if clearance fails. |
| **Demos** (FactoryDemo sample apps: API.FSharp / API.CSharp / Db / CrmKernel) | **Showcase** (working name) | "Demos" is generic; "Showcase" telegraphs "here's what Frontier + Zeta can do together." Might flip to a more specific brand name during brand-clearance research. |
| **Package Manager** (Aaron-mentioned project) | **ace** | Aaron's own working name. Keep unless brand-clearance finds collision (likely — "ace" is common; could become `ace-pm` or similar). |
| **Soulfile Runner** (restrictive-English DSL interpreter; uses Zeta for advanced features; all small bins) | **Anima** (candidate) — or keep "Soulfile Runner" | "Anima" is the Latin for "soul / animating principle" — captures the soulfile-is-the-animating-substrate framing. Candidate; not locked. Alternatives: `Soulrun`, `Ledger`, `Animus`. |
| **Linguistic seed** (formally-verified minimal-axiom self-referential glossary; Lean4-formalisable; Tarski / Meredith / Robinson Q lineage) | **Seed** (working name) | Per Aaron's own term "linguistic seed." Narrow enough not to need a brand. Keep. |

## Design notes on the naming

### Factory = Frontier

Aaron's recollection is probably from an earlier session's
conversation I don't have clean memory of. "Frontier"
captures:

- The **first-mover / first-of-kind** framing (factory is
  a new category; frontier is edge-of-known)
- The **exploratory** register (greenfield phase per the
  greenfield-phases memory; the factory is IN the
  frontier phase of its own development)
- The **multi-adopter** intent (frontier towns don't have
  one occupant; factory-adopters are many)

Risks: "Frontier" is a heavily-used name (Frontier
Airlines, Frontier Communications, Frontier AI models).
Brand clearance may surface conflicts; register it as
internal codename until cleared.

### Aurora stays Aurora (internal)

Per PR #161 (Amara's deep research report) §brand note:
"not to assume 'Aurora' survives as the naked public
brand... recommends trademark/class clearance first."
Hybrid framing recommended: Aurora as internal
architecture + research program name while public-facing
message is clearer (e.g., "retractable AI infrastructure"
or similar).

For repo naming: the split repo is `Aurora` (internal +
repo name); the public brand may differ.

### Zeta stays Zeta

Well-established. F# reference + C# facade + future Rust.
Public NuGet identity. No reason to rename.

### Soulfile Runner → Anima (provisional)

"Soulfile Runner" is descriptive. A short repo-name that
captures the animating-substrate framing:

- **Anima** — Latin for soul / animating principle; short
- **Soulrun** — close to the working name; short
- **Ledger** — captures the restrictive-English
  decide / record / apply substrate

Lean toward Anima for short-ness + latent meaning, but
this is the MOST fluid of the provisional names; any of
the three is defensible.

## How to apply

- **When writing in-repo content that needs a project
  name**, use the provisional names above.
- **When the eventual multi-repo refactor lands**, the
  split repos take these names unless brand-clearance
  research changes them.
- **If Aaron nudges**, update this memory + CURRENT-aaron.md
  §4 with the new name + the nudge-quote.
- **When brand-clearance research fires** (per PR #161
  §brand note + the Pages-UI row that queues similar
  concerns), the provisional names are re-examined
  against trademark / domain / SEO collision.

## What this is NOT

- **Not a commitment to ship under these names publicly.**
  Public brand = internal-codename + clearance-cleared
  hybrid is the likely shape.
- **Not a rename of current repo structure.** LFG/Zeta is
  the current repo; these provisional names apply AT the
  split moment, which is eventual-not-scheduled.
- **Not a decision on org structure.** LFG remains the
  org; whether each split lives under LFG or under
  per-project orgs is a separate decision.
- **Not locked.** Aaron said "i can alwys nudge
  afterwards"; this memory reflects the agent's call at
  2026-04-23 17:18 UTC, not a permanent decision.

## Composes with

- `project_multiple_projects_under_construction_and_lfg_soulfile_inheritance_2026_04_23.md`
  (the multi-project framing; this memory names them)
- `docs/research/multi-repo-refactor-shapes-2026-04-23.md`
  (PR #150, still open; the structural refactor shapes
  that will host these named repos)
- `docs/aurora/2026-04-23-amara-deep-research-report.md`
  (PR #161, merged; §brand-clearance concern)
- `CURRENT-aaron.md` §4 (repo identity / multi-project
  framing; will be updated if Aaron nudges)
- `feedback_open_source_repo_demos_stay_generic_not_company_specific_2026_04_23.md`
  (demos-stay-generic discipline; applies to the
  "Showcase" name as the generic public face)
- `feedback_git_native_vs_github_native_plural_host_pluggable_adapters_2026_04_23.md`
  (plural-host discipline; repo names are host-neutral)
