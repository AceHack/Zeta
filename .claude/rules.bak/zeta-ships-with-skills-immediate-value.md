# Zeta ships WITH skills — immediate value layer; F# crystallization later

Carved sentence:

> Zeta ships with the skills as we map them for our use. Immediate
> value from the skills layer; crystallized F# value ships later.
> Don't gate end-user value on full F# absorption.

## Operational content

Per the human maintainer 2026-05-13: *"zeta should ship with the
skills as we map them for our use this is immedate value and then
the crystalized value ships in f# later"* (PR #2933).

**Three-stage value delivery to end users**:

| Stage | What ships | Status |
|---|---|---|
| **Stage 1 (now)** | Zeta runtime + mapped skills | Each release |
| **Stage 2** | + first F# absorbed patterns | As patterns mature |
| **Stage 3** | + mature F# substrate (crystallized) | Multi-year horizon |

Each stage delivers value. No big-bang requirement.

## What "ship with the skills" means

End-user Zeta install includes:

- Zeta runtime (F# + dotnet substrate)
- **Skill catalog** (`.claude/skills/`) — load-bearing for value
- Memory substrate (curated `memory/persona/*/canonical/`)
- Documentation (README + ADRs + governance)

Skills are NOT decoration — they're operational substrate end
users invoke per `.claude/rules/skill-router-as-substrate-inventory.md`.

## What "F# crystallization ships later" means

The long-term substrate engineering:

- F# fork for AI safety with real HKT over Clifford (multi-year)
- Recursive Type Providers + Roslyn Source Generators
- CAN/GCAN equivariant layers in F# compiler internals

This does NOT gate immediate skill delivery. Skills ship first;
F# absorbs patterns over time.

## Maintainer-vs-end-user toolkit asymmetry preserved

Per `.claude/rules/no-directives.md` (autonomy first-class) +
PR #2930 (distributed maintainer architecture):

- **Maintainers** have rich local toolkit (SQL Server Docker
  dev-free, Postgres, DuckDB, R Provider, any DB/bus)
- **End users** get ONLY Zeta + mapped skills

Maintainer-prototyping toolkit is NOT distributed with Zeta —
it's maintainer R&D infrastructure.

## Skill-authoring discipline

Per Aaron's "skills as we map them for our use":

- Skills MUST map to operational use (not aspirational)
- Skills MUST work in Zeta runtime
- Skills CAN compose with maintainer-toolkit for prototyping
  but the SHIPPED skill works on Zeta-only target

## Composes with other rules

- `.claude/rules/skill-router-as-substrate-inventory.md`
  (skills ARE substrate; router IS the inventory)
- `.claude/rules/never-be-idle.md` (immediate value over
  big-bang)
- `.claude/rules/dont-ask-permission.md` (skill authoring
  within maintainer authority scope)
- `.claude/rules/additive-not-zero-sum.md` (immediate + later
  is ADDITIVE; both ship)
- `.claude/rules/razor-discipline.md` (substrate-honest about
  what ships when)
- `.claude/rules/dv2-data-split-discipline-activated.md`
  (DV2.0 partition: skills are stable hubs; F# crystallization
  is mature satellite)

## Composes with substrate

- PR #2933 (Zeta ships with skills correction — full memory
  substrate)
- PR #2930 (distributed maintainer architecture)
- PR #2931 (file-DB extension to maintainer toolkit)
- PR #2929 (F# storage no-binary requirement)
- PR #2928 (F# fork for AI safety strategic substrate)
- PR #2935 (F# fork concrete architecture)
- PR #2936 (Recursive Type Providers + Roslyn Source Generators)
- PR #2924 (Aurora pitch — partnership delivery includes
  Zeta+skills)
- B-0428 (DBpedia + F# fork — Path B ships as skill first;
  Path A is F# crystallization later)
- B-0429 (end-user persona mapping — skills target personas)
- B-0043 (universal company + government information substrate
  — skill-shippable substrate)

## Full reasoning

`memory/feedback_aaron_zeta_ships_with_skills_immediate_value_crystallized_fsharp_later_maintainers_just_me_and_you_aaron_otto_right_now_2026_05_13.md`
(full memory substrate; PR #2933)
