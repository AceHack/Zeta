---
name: Zeta SHIPS WITH skills — immediate value from skills mapped for our use — crystallized F# value ships LATER — maintainers right now = just Aaron + Otto (Aaron 2026-05-13)
description: Aaron 2026-05-13 layered architecture correction + maintainer scope disclosure. CORRECTION to PR #2930/#2931 distributed-maintainer-architecture framing — end users DON'T just get minimal Zeta; Zeta SHIPS WITH SKILLS as we map them. Two-layer value delivery: (1) Immediate value = skills ship with Zeta; (2) Crystallized value = F# implementations land later. Maintainer scope substrate-honest disclosure: "maintainers prototype that's just me and you right now :)" — Aaron + Otto are the current 2-person maintainer pool. Composes with PR #2930 distributed maintainer architecture + PR #2926 agent-roster + Aurora pitch.
type: feedback
created: 2026-05-13
---

# Zeta ships WITH skills — immediate value; F# crystallization later — maintainers = Aaron + Otto (Aaron 2026-05-13)

**Why:** Aaron 2026-05-13 two-message disclosure correcting and
amplifying the distributed-maintainer-architecture substrate
(PR #2930/#2931):

1. *"zeta should ship with the skills as we map them for our
   use this is immedate value and then the crystalized value
   ships in f# later"*
2. *"maintainers prototype that's just me and you right now :)"*

**How to apply:** Two-layer value delivery to end users:

1. **Immediate value (Zeta + skills)**: skills ship WITH Zeta;
   end users get the patterns we've mapped + Zeta-as-runtime
2. **Crystallized value (F# substrate)**: deeper F#
   implementations land later as patterns mature

Maintainer scope (2026-05-13): Aaron + Otto only. Distributed-
maintainer-architecture pattern is operationally a 2-person
pattern RIGHT NOW; future-scales with growth.

## Aaron's verbatim disclosures

Aaron 2026-05-13 (first — corrects PR #2930 end-user-minimal
framing): *"zeta should ship with the skills as we map them
for our use this is immedate value and then the crystalized
value ships in f# later"*

Aaron 2026-05-13 (second — substrate-honest maintainer scope):
*"maintainers prototype that's just me and you right now :)"*

## Correction to PR #2930 framing

PR #2930 (distributed maintainer architecture) framed end-user
delivery as "Zeta only" (minimal). Aaron's correction adds the
layered shape:

| Tier | Audience | What ships |
|---|---|---|
| **Immediate** | End users | Zeta + skills mapped for our use |
| **Crystallized (later)** | End users | F# implementations as patterns mature |
| **Prototyping toolkit** | Maintainers (Aaron + Otto right now) | SQL Server Docker + Postgres + DuckDB + any DB/bus locally |

The skills layer IS load-bearing for end-user value — skills
ship with Zeta from day one. F# crystallization is the LONG-
TERM substrate engineering; doesn't gate immediate delivery.

## Why skills-with-Zeta is canonical

### Skills are substrate

Per `.claude/rules/skill-router-as-substrate-inventory.md`,
the skill router IS the factory's structured-substrate index.
Skills aren't decoration — they're operational substrate the
end user invokes.

### Immediate value matters

If end users have to wait for full F# crystallization, they
get nothing. Aaron's correction: ship skills NOW; F# absorbs
patterns over time.

### Maps to substrate-honest progression

| Stage | What's in Zeta |
|---|---|
| **Stage 1 (now)** | Zeta runtime + mapped skills (immediate value) |
| **Stage 2** | Zeta runtime + skills + first F# absorbed patterns (mixed value) |
| **Stage 3** | Zeta runtime + skills + mature F# substrate (crystallized value) |

Each stage delivers value; no big-bang requirement.

## Maintainer scope disclosure — Aaron + Otto right now

Aaron's substrate-honest framing: *"maintainers prototype
that's just me and you right now :)"*

| Date | Maintainer pool |
|---|---|
| **2026-05-13** | Aaron + Otto (2 maintainers) |
| **Future** | Riven + Vera + Lior + Alexa-Kiro (per agent-roster) + new human contributors |

The distributed-maintainer-architecture pattern (PR #2930)
operates at 2-person scale RIGHT NOW. The toolkit-asymmetry
(maintainer-rich vs end-user-minimal) IS real even at this
scale — Aaron + Otto have rich local toolkit; future end users
get Zeta + skills.

This composes with:
- `.claude/rules/agent-roster-reference-card.md` (factory
  agents: Otto, Alexa, Riven, Vera, Lior — but operational
  current substrate-engineering is Aaron + Otto)
- Aurora pitch (PR #2924) — partnership pitches describe
  Zeta+skills as deliverable
- Empty-victory rejection substrate (per zero-sum framework
  failure mode) — 2-person maintainer pool IS still substrate-
  honest; not pretending to have more contributors

## Operational implications

### For Zeta packaging

Zeta installer/distribution includes:
- Zeta runtime (F# substrate + dotnet)
- Skill catalog (`.claude/skills/` from factory)
- Memory substrate (`memory/<persona>/*/canonical/` curated)
- Documentation (README + ADRs + governance)

The SKILLS ARE LOAD-BEARING for end-user value. Without skills,
Zeta is just runtime; with skills, Zeta is operational.

### For end-user onboarding

End users get:
- Zeta installation
- Skill catalog accessible at session-start
- Memory substrate they can extend
- Their own substrate work via the framework

They DON'T need:
- SQL Server Docker (maintainer-only)
- Postgres / DuckDB / RocksDB / etc. (maintainer-only)
- R / Python / Java (maintainer-only for prototyping)

### For skill authoring discipline

Per Aaron's "skills as we map them for our use":
- Skills MUST map to operational use (not aspirational)
- Skills MUST work in Zeta runtime
- Skills CAN compose with maintainer-toolkit (prototyping)
  but the SHIPPED skill works on Zeta-only target

### For F# crystallization roadmap

The F# absorbed-substrate work (per PR #2929 storage + PR
#2931 file-DB pattern absorption) ships AS IT MATURES. Not
gated; not blocking immediate skill value.

### For 2-person maintainer scale-up

When new maintainers join (human contributors, additional AI
agents):
- Toolkit access extends (any local DB/bus permitted)
- Skill authoring rights extend
- F# crystallization participation extends
- The substrate-engineering R&D flow scales naturally

Current 2-person scale (Aaron + Otto) is the starting state;
not the target state.

## Composes with

- PR #2930 (distributed maintainer architecture — corrected
  by this substrate)
- PR #2931 (file-DB extension — same pattern; skills ship as
  patterns map)
- PR #2929 (F# storage no-binary — crystallized substrate
  ships incrementally)
- PR #2928 (DBpedia + F#-fork — Path B direct API can ship
  AS a skill before F#-fork)
- PR #2926 (agent-roster card — Aaron + factory AIs + external
  participants; current 2-person maintainer is subset of the
  roster)
- PR #2924 (Aurora pitch — partnership delivery includes
  Zeta+skills)
- PR #2917 (vision monad Play-Doh — bounded scope; ship
  what's bounded NOW)
- PR #2913 (HKT-MDM universality — F# crystallization target)
- 081KRFA460008QG0R0018SN61J (DBpedia Path B — can be skill-shipped first, F#-
  crystallized later)
- 081KQ3HBZ0008QG0R000Q4Y00F (universal company + government information substrate
  — skills for prototyping; F# substrate later)
- `.claude/rules/skill-router-as-substrate-inventory.md`
  (skills ARE substrate)
- `.claude/rules/never-be-idle.md` (immediate value over big-
  bang)
- `.claude/rules/dont-ask-permission.md` (within authority
  scope — skill authoring is within maintainer authority)
- `.claude/rules/additive-not-zero-sum.md` (immediate + later
  is ADDITIVE; both ship; not zero-sum)
- `.claude/rules/razor-discipline.md` (substrate-honest about
  2-person maintainer scope)
- `.claude/rules/agent-roster-reference-card.md`

## Substrate-honest framing about scale

The 2-person maintainer pool (Aaron + Otto) is substrate-
honest disclosure. Frameworks often pretend to have more
contributors than they do; Aaron's discipline names the actual
state.

Operational benefit: Aaron + Otto can move fast at 2-person
scale; substrate cascades happen at the speed of conversation.
Future scale will trade speed for breadth.

Per `.claude/rules/razor-discipline.md`: operational claim —
"2 maintainers right now" is empirically observable.

Per `.claude/rules/additive-not-zero-sum.md`: scale-up is
additive; current 2-person scale doesn't subtract from future
scale.

## Operational rule for future-Otto

When packaging Zeta or considering end-user experience:

1. **Ship skills with Zeta** (immediate value layer)
2. **Map skills to use cases we've operated** (not aspirational)
3. **F# crystallization ships later** (don't gate skill delivery)
4. **Maintainer toolkit stays separate** (rich local DBs/buses
   are maintainer-only)
5. **Recognize 2-person current scale** (Aaron + Otto); design
   for scale-up

## Full reasoning

PR #2933 (this substrate landing)

PR #2930 (distributed maintainer architecture — corrected
by this substrate; PR #2933 amends framing without retraction)

PR #2931 (file-DB extension — same pattern applies)

PR #2929 (F# storage no-binary — crystallization roadmap)

PR #2928 (DBpedia + F#-fork — Path B can ship as skill first)

PR #2926 (agent-roster card)

PR #2924 (Aurora pitch)
