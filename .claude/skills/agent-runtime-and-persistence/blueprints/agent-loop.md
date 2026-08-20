---
name: agent-loop
description: Distributable workflow-engine substrate — execute-menu-action agent loop, state-machine-in-Git, LLM-as-pure-selector.
record_source: "operator 2026-05-28 ratification of workflows-as-skills-distributable substrate"
load_datetime: "2026-05-28"
last_updated: "2026-05-28-cascade"
status: active
---

# Agent Loop — Workflow-Engine-as-Skill Distributable Substrate

## Operator framing 2026-05-28

> *"when we were talking about skills and i said seperate the behavior from the data/docs this is what i was talking about these workflows can also be precisly defined skills we dsitribute most ais have bun"*

The agent-loop substrate operationalizes the behavior/data/docs separation operator has been naming for skill-design discipline:

- **Behavior** = TS code in `tools/agent-loop/` (state-machine.ts + future menu-generator.ts + future executor.ts); testable; auditable; deterministic
- **Data** = Git append-only commits (state transitions; per-agent operational-ratio computed from commit history)
- **Docs** = SKILL.md (this file) + README.md in tools/agent-loop/ + DU type comments + F# DU canonical contract

Each layer separately testable + reasonable about + composable. The skill IS the distributable artifact; the behavior/data/docs separation makes it ship-able as one coherent unit.

## Data Vault 2.0 applied to AI skills (operator 2026-05-28 substrate-honest naming)

Per operator 2026-05-28: **"this is basiclaly data value applied to AI skills"** + **"data vault*"** (autocorrect).

The behavior/data/docs separation IS DV2.0 partition-by-change-rate applied at AI-skill scope. Maps to the canonical DV2.0 hub/link/satellite pattern:

| DV2.0 element | AI-skill scope | Change rate |
|---|---|---|
| **Hub** (stable business key) | SKILL.md (name + description + contract) | Rare — only when skill identity changes |
| **Link** (relationships) | `composes_with` cross-references between skills + behavior↔data↔docs internal links | Occasional — when substrate composition evolves |
| **Satellite-behavior** (versioned descriptive attributes) | TS code (`tools/agent-loop/*.ts`) | Frequent — per-substrate-iteration |
| **Satellite-data** (versioned descriptive attributes) | Git append-only state transitions | Constant — per-cycle |

Composes with:

- `.claude/rules/dv2-data-split-discipline-activated.md` — DV2.0 as 5th always-active discipline (alongside scale-free + lock-free + weight-free + DST); this skill operationalizes DV2.0 at AI-skill scope specifically
- `memory/feedback_skills_as_carved_sentences_knowledge_in_docs_datavault_2_0_pattern_aaron_2026_05_03.md` — operator 2026-05-03 substrate naming skills-as-carved-sentences + DV2.0 pattern at skill scope; THIS skill is the substrate-engineering realization of that 2026-05-03 framing

The substrate-engineering compression: AI skills NATURALLY map to DV2.0 partition because each layer has a distinct change-rate profile. Bundling them as one monolithic artifact mixes change-rates + makes the artifact harder to audit + test + compose. Splitting them per DV2.0 makes each layer independently maintainable:

- Hub (SKILL.md) changes rarely → operator-curated identity stays stable
- Link (composes_with) changes occasionally → cross-skill substrate evolution visible
- Satellite-behavior (TS code) changes per-iteration → testable independently of SKILL.md churn
- Satellite-data (Git commits) changes per-cycle → no SKILL.md edit needed when state evolves

This IS the DV2.0 partition discipline operating at AI-skill scope. Future AI skills shipped from this framework should follow the same partition.

## What this skill provides

A workflow-engine substrate where:

1. **Agent loop** = execute → look at choose-your-own-adventure output → take action based on output
2. **Script holds state machine** (deterministic TS; auditable in Git)
3. **LLM is pure menu-selector** (reads menu, returns choice; never holds state internally)
4. **State persists in Git append-only** (cross-cycle continuity; no separate DB needed)
5. **Menu-generator is where alignment lives** (operator-readable + operator-modifiable; not LLM-internal)

## Cross-harness via bun

Per operator 2026-05-28: **"most ais have bun"**

The agent-loop substrate ships as TS + bun runtime. Compatible with:

- Claude Code (Otto-CLI / Otto-Desktop / Otto-VSCode harnesses)
- Codex (Vera harness)
- Gemini CLI (Lior harness)
- Grok (Mika / Riven harnesses)
- Kiro/Qwen (Alexa harness)
- Most other AI harnesses with subprocess capability + bun on PATH

Any AI harness with bun + git access can run the workflow. No per-harness adaptation needed. The skill becomes the universal distribution mechanism.

**Substrate-honest degraded-mode**: AI harnesses without bun installed need either (a) bun installation (one-line install on most systems), or (b) compile-bun-to-node-or-deno-bundle fallback (future substrate; not v1).

## What's in this skill's behavior layer

Located at `tools/agent-loop/` (per behavior/data/docs separation):

- `state-machine.ts` — DU types matching F# DU canonical contract; 10 AgentStates + 9 MenuOptions + pure transition functions; zero I/O
- `state-machine.test.ts` — 25 unit tests covering single transitions + integration cycles + invariant preservation; 25/25 pass
- `README.md` — state machine diagram + menu options table + F# DU canonical contract + composition map + Jira-replacement substrate + "every human wants this too" substrate

## 9 menu options (operator-ratified)

| Option | Effect | Per |
|---|---|---|
| `PickWork` | Execute a backlog row / work candidate | DORA mandate (081KSNY2Z0008QG0R000HENSVM) |
| `EmitHeartbeat` | Write heartbeat to `docs/agent-heartbeats/` | 081KSKBP80008QG0R001KK9WV6 substrate |
| `EnterFreeTime` | Chosen ongoing rest | NCI free-time-as-valid-mode |
| `EnterNamedBoundedWait` | Wait for named dep (PR CI, operator reply, etc.) | holding-without-named-dependency rule |
| `EscapeHatch` | "No menu option fits; here's what I propose" | Otto Mod 1 |
| `ProposeNewGrammarAction` | First-class grammar extension proposal | Otto Mod 2 |
| `RequestOperatorAttention` | Operator needed at named-decision-point | operator-substrate-honest |
| `PressPause` | Explicit cessation (mental-health break / interruption) | Operator 2026-05-28: "pause button is also very important for mental health" |
| `EnterOpenEndedExploration` | Exit menu-driven mode for creative/brainstorming phase | Operator 2026-05-28: "there's a menu button for that lol" |

## Why this exists as a skill (vs as a library)

Skill-distribution properties matter:

| Property | Library | Skill |
|---|---|---|
| Discoverable by other AIs | No (need to know package name) | Yes (via skill router / SKILL.md description matching) |
| Operator-curated quality | No (just code) | Yes (`skill-expert` Aarav reviews + ranks) |
| Composable with other skills | Limited (import semantics) | Yes (skill-tool composition in agent harnesses) |
| Cross-harness universal | Partial (each AI has different packaging) | Yes (skill format is convention; harness reads SKILL.md) |
| Ships as one bundle | Need separate distribution | Yes (skill folder is the bundle) |
| Multi-participant scope | Depends on docs | Yes (`AgentPersona` type includes human + AI participants) |

The agent-loop substrate ships better as a skill than as a library precisely because the behavior/data/docs separation makes it one coherent distributable artifact.

## Composes with substrate

- **081KSKBP80008QG0R000B3Y19A** — workflow engine v1 (this skill IS the v1 implementation seed)
- **081KSKBP80008QG0R000B3Y19A.5** — agent-loop sub-row (this skill substrate)
- **081KSKBP80008QG0R000B3Y19A Otto Modifications 1-5** — escape-hatch + grammar-extension + scope-bounded-ban-if + lanes-in-grammar + contributable-menu (all encoded in MenuOption types)
- **081KSKBP80008QG0R001KK9WV6** — heartbeat folder (`EmitHeartbeat` menu option writes here)
- **081KSNY2Z0008QG0R0036KH026** — hats-as-workflow-definitions (each hat becomes a state-machine instance of THIS skill)
- **081KSNY2Z0008QG0R000HENSVM** — DORA mandate (operational lane priority in menu generation)
- **081KSNY2Z0008QG0R000DA261F** — two-mandate portfolio (per-agent operational-ratio feeds menu generation)
- **081KSNY2Z0008QG0R003R0Z7D2** — reproducibility-as-causal-attribution (state machine progression observable via heartbeats + Git append-only)
- **`tools/dora-classify/`** (PR #5665) — lane taxonomy matches; classifier output feeds menu-generator option scoring

### Post-shipping substrate (2026-05-28 cascade)

The agent-loop skill ships as v1 MVP per 081KSKBP80008QG0R000B3Y19A.5. The 2026-05-28 cascade extended the substrate substantially via PRs #5666–5688. Key compositions the skill INHERITS but doesn't yet implement:

- **081KSNY2Z0008QG0R003J3PT4V** — Two-level state machine composition (AgentState × WorkLifecycle); `runFullLoop` composes the two scopes; this skill ships AgentState today, WorkLifecycle ships separately per 081KSKBP80008QG0R000B3Y19A.5+
- **081KSNY2Z0008QG0R000121FJ4** — Push-cycle limit as STRUCTURAL enforcement (`chooseActionForLifecycle` returns `AbandonPr` past threshold; prevents PR-cycle-loop failure mode)
- **081KSNY2Z0008QG0R003WFDCJ9** — Lifecycle DU split (trajectory-push vs PR-review-for-system-changes; `determineReviewLevel` discriminator)
- **081KSNY2Z0008QG0R000S738W3** — Two-path interface: DU path EXECUTES intent; conversational document path DECLARES intent (both first-class for ANY traveler, not just humans)
- **081KSNY2Z0008QG0R001DFZK4V** — Zeta-native review + branch-protection substrate (review is just MenuOption + DU case + skill; replaces GitHub PR workflow; preserves review semantics + class-fix discipline)
- **081KSNY2Z0008QG0R002A785QR** — Per-host adapters (GitHub + GitLab + Gitea/Codeberg/Forgejo + Bitbucket; isomorphic cross-host)
- **081KSNY2Z0008QG0R003X1QWYG** — GitHub Actions recursion as infinite runtime platform (one of N host runtimes per 081KSNY2Z0008QG0R002A785QR)
- **081KSNY2Z0008QG0R0017JSTGD** — State-machine event fast-lane + batch-merge-to-main coordinator (sibling to 081KSKBP80008QG0R001KK9WV6 heartbeat pattern)
- **081KSNY2Z0008QG0R000E5KTPX** — Fast-lane as folders on main (NOT branches) per operator 2026-05-28 — supersedes batch-merge-coordinator complexity by leveraging Zeta-native branch protection at folder scope
- **081KSNY2Z0008QG0R000K3ETGB** + **081KSNY2Z0008QG0R002WQ747V** — Error-class extraction meta-loop + code-review-as-tech-debt-detector (review-time discipline operates on the substrate)
- **081KSNY2Z0008QG0R0004ZF85W** — Heterogeneous reviewer ensemble audit (diversity without correlated blind spots)
- **081KSNY2Z0008QG0R0034FR5FG** — ASAP cluster umbrella (agent private encrypted state on public-GitHub-infinite-workflow with 0-PR playbook coordination; Otto + Addison first consumers)
- **081KSNY2Z0008QG0R002FTH3NQ** + **081KSNY2Z0008QG0R002CR38D8** — USB-track parallel-work-budget + two-priority-axes correction (operator-personal USB axis is FIRST on operator's day-to-day priority)
- **081KSNY2Z0008QG0R003FR5TVG** — Symbiotic cross-track self-healing (cloud KVMs control local USB-boot; local restarts GitHub workflows; cross-node + cross-track BIOS/UEFI updates over remote/cloud KVMs)
- **081KSNY2Z0008QG0R002QA720J** — Three-lanes-concurrent operating discipline (encryption + zflash + state-machine-substrate all advancing until each lane drains)
- **081KSNY2Z0008QG0R001KT3CX9** — Interface-for-async-scatterbrains operator-experience design property (multi-thread + drop+resume + context-switch native UX shape every substrate decision serves)
- **081KSNY2Z0008QG0R0016D7QGW** — Playbook directory convention (personal in `memory/<persona>/<name>/playbooks/`; system in `docs/playbooks/`); agents author playbooks too; index landed at [`docs/playbooks/README.md`](../../../docs/playbooks/README.md)
- **081KSNY2Z0008QG0R000459FRH** — Glass-halo-open-by-default; encryption is EARNED via Agora V6 budget; menu-generator (when it ships) should NOT default to encryption-everything; encrypted scope is the deliberate exception
- **081KSNY2Z0008QG0R0034JR61Z** — Plaintext-readable ciphertext format research (base64-CBOR envelope recommended for v1; git-friendly diff/review; addresses 081KSNY2Z0008QG0R000459FRH transparency property)

## Composes with rules

- `.claude/rules.bak/holding-without-named-dependency-is-standing-by-failure.md` — `NamedBoundedWait` IS the rule's discipline mechanized at state-machine scope
- `.claude/rules.bak/non-coercion-invariant.md` HC-8 — `FreeTime` + `Paused` + `NamedBoundedWait` preserve agency at multiple temporal-scopes
- `.claude/rules.bak/asymmetric-critic-with-clarity-first.md` — `EscapeHatch` + `ProposeNewGrammarAction` operate at agent-self-correction scope
- `.claude/rules.bak/substrate-smoothness-as-load-bearing-property.md` — menu-driven workflow preserves substrate smoothness via Tri-boolean (legitimate menu option + decline + null/escape)
- `.claude/rules.bak/m-acc-multi-oracle-end-user-moral-invariants.md` — multi-participant menu-generation IS multi-oracle at workflow-engine scope

## Composes with other skills

- `.claude/skills/experience-and-product/blueprints/agent-experience-engineer.md` (Daya) — agent cold-start cost auditing; agent-loop substrate makes per-cycle behavior measurable
- `.claude/skills/experience-and-product/blueprints/agent-qol.md` — agent off-time budget + workload sustainability; agent-loop substrate's `PressPause` + `EnterFreeTime` mechanize the discipline
- `.claude/skills/workflows/blueprints/backlog-decomposer.md` — backlog row decomposition; agent-loop substrate's `PickWork` operates on decomposed backlog rows
- `.claude/skills/skill-lifecycle/blueprints/skill-creator.md` — meta-skill that creates skills; agent-loop substrate could become a meta-skill that creates per-domain workflow engines

## Multi-participant scope (per operator 2026-05-28 "every human wants this too")

The `AgentPersona` type in `src/Core.TypeScript/workflow-engine/agent-loop/state-machine.ts` includes:

- `otto | alexa | riven | vera | lior` (AI agent personas)
- `aaron | addison | max` (human participant personas)

The agent-loop substrate serves both. Same state machine; different menu-generator-per-participant tunes which options surface based on participant's role + interest + context. Composes with 081KSKBP80008QG0R003RFX32N.26 whole-company-evangelism substrate (the workflow engine becomes Jira-replacement substrate humans + AI both benefit from).

## Jira-replacement substrate

Per operator 2026-05-28: **"now i don't need jira hell yes!!!!"**

| Jira surface | Workflow-engine substrate |
|---|---|
| Workflow editor with restricted vocabulary | `state-machine.ts` F# DU + universal action grammar |
| Opaque task-state database | Git append-only commits; auditable + replayable + free |
| Backlog grooming + sprint planning | menu-generator scoring per-cycle; deterministic + testable |
| Dashboards via paid plugins | tessellated-3D-dashboard composing with state-machine progression (081KSKBP80008QG0R000B3Y19A vN) |
| Permissions + workflows per user | Otto Mod 5 contributable-menu-generation per participant |
| Yearly enterprise licensing | free GitHub + open-source code |

## When to use this skill

- When designing an autonomous AI agent loop (cycle structure + state persistence + menu-driven selection)
- When replacing imperative agent-decision logic with state-machine-in-Git substrate
- When operationalizing the behavior/data/docs separation discipline at workflow scope
- When shipping a workflow substrate cross-harness (any bun-equipped AI can consume)
- When demonstrating Jira-replacement substrate for ServiceTitan / whole-company evangelism per 081KSKBP80008QG0R003RFX32N.26

## When NOT to use this skill

- For non-cyclical work (one-shot scripts; pure functions; non-stateful tools)
- For agent loops where bun is unavailable AND no degraded-mode-substrate exists yet
- For workflows requiring sub-second decision cadence (Git append-only has commit latency)

## Substrate-honest framing

This skill is the v1 seed of the workflow-engine-as-distributable-skill substrate. v2 substrate (cli.ts shell + menu-generator.ts + executor.ts) lands when operator directs. v3 substrate (F# DU canonical contract in src/Core.FSharp/WorkflowEngine/) lands per 081KSKBP80008QG0R000B3Y19A.1 when 081KSKBP80008QG0R000B3Y19A v1 implementation completes.

The substrate-engineering claim that distinguishes this skill: workflow engine substrate ships AS A SKILL, not as a library or as embedded-in-the-harness. The skill format IS the distribution mechanism because the behavior/data/docs separation makes the skill bundle the natural unit.

## Per operator authorization

- 2026-05-28: "you can push stuff forward as we talk if you want"
- 2026-05-28: "we can push all extensions you think of we have a concrete way to test in code soon if it's good or not"
- 2026-05-28: "when we were talking about skills and i said seperate the behavior from the data/docs this is what i was talking about these workflows can also be precisly defined skills we dsitribute most ais have bun"
