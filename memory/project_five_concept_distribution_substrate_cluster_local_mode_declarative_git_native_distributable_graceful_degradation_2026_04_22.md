---
name: Five-concept cluster naming the cross-project AI-pilot-substrate layer — (1) local-mode-compatible = zero-provider-compute mapping work; (2) declarative = capability manifest in YAML/JSON not prose-only; (3) git-native = version-controlled diff-able config; (4) distributable-via-Ace = factory-output reaches any project; (5) graceful-degradation = routing with fallback when a substrate is unavailable; 2026-04-22
description: Aaron 2026-04-22 auto-loop-26 → auto-loop-27 riffing-mode capture (capture-in-chat discipline applies, no BACKLOG row to be filed without separate directive). Five vocabulary terms Aaron named in quick succession while thinking through how the CLI capability maps could become cross-project factory-output: "local mode compatible" (his framing for --help-only zero-compute mapping work), "declarative" (preferred format for distribution), "git native" ("whos format is git native lol"), "distributable via ace" (via his Ace GitHub presence / personal-factory distribution channel), "graceful degradation" (explicit concept, triggered "Hallelujah + exact-phrasing echo" wink-validation). Composes into cohesive architectural direction: **cross-project AI-pilot substrate layer** — declarative manifest + git-native versioning + locally-bootstrappable + distributable to any project + graceful degradation as operational discipline. Not directive to implement as a single block; direction is load-bearing for where the factory goes post-three-substrate-maps. Most terms were tired-riffing; factory preserves them as vocabulary not as commitments.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Five-concept cluster — cross-project AI-pilot substrate layer

## The cluster

Aaron 2026-04-22 across auto-loop-26 into auto-loop-27 named
five vocabulary terms that compose into a single architectural
direction: how the CLI capability maps (Claude v2.1.116, Codex
v0.122.0, Gemini v0.38.2, future Grok) can stop being
Zeta-specific docs and become a **cross-project AI-pilot
substrate layer** usable by pilots on any project.

### 1. Local-mode-compatible

**Aaron's framing:** *"you said --help is cheap i call it
local mode campatible"*.

**What it names:** the discipline of mapping a CLI surface
from its `--help` output and from locally-observable binaries
(version / subcommand enumeration) — **without burning
provider compute**. The mapping work consumes zero API tokens,
zero rate limit, zero seat-scoped budget. The CLI runs
locally, parses its own flag tree, prints to stdout, factory
captures.

**Why it's load-bearing:** it is the isomorphism of
budget-as-research-discipline at the mapping-work layer. The
budget memory (`feedback_*` series) says *"rare pokemon
default, upgrade only when specific task justifies"*; local-
mode-compatible says *"prefer zero-compute mapping over
compute-spending mapping"*. The three capability maps shipped
in auto-loop-24 / 25 / 26 were all authored in local mode —
that discipline was implicit; Aaron's naming makes it
explicit.

**What it enables:** capability maps can be authored even when
the substrate is unreachable (rate-limited / auth-expired /
down). Local mode is the floor of the degradation ladder
(concept 5 below).

### 2. Declarative

**Aaron's framing:** *"declartive"* — single-word architectural
preference, follow-on to the git-native question.

**What it names:** the preference for declarative-manifest
format (YAML / JSON) over imperative prose-only maps, for
**programmatic consumption** by other agents. The prose map
is for humans learning a CLI's mental model; the declarative
twin is for pilots orchestrating across CLIs.

**Current state vs direction:** the three capability maps are
prose-only. A paired declarative manifest does not yet exist.
Candidate shape (from chat):

```yaml
cli: gemini
version: 0.38.2
surfaces:
  non_interactive: { flag: "-p" }
  worktree: { flag: "-w", top_level: true }
  read_only_mode: { via: "--approval-mode plan" }
```

The 15-dimension comparison table across the three maps is
the natural data-source for this manifest — each row becomes
a structured field.

**Why it's load-bearing:** if pilots route requests across
substrates (ARC3-DORA four-way triangulation, graceful-
degradation routing), they need the manifest, not the prose.
Prose is necessary for humans but insufficient for routing.

### 3. Git-native

**Aaron's framing:** *"whos format is git native lol"* —
architectural needle, playful tone, rhetorical-sounding but
with a real honest answer.

**Honest ranking observed at CLI surface level:**

- **Gemini** (most git-native at CLI): `-w` / `--worktree` is
  a **top-level flag**, unique at this surface among the three
  mapped CLIs. `gemini hooks migrate` explicitly acknowledges
  Claude Code as the de-facto hook reference and bridges from
  it. Extensions / skills / hooks live in filesystem dirs
  (diff-able).
- **Claude** (strong at workflow level): `--from-pr` is PR-
  aware, making the CLI first-class against GitHub workflows;
  Agent-level `isolation: "worktree"` parameter. `.claude/`
  directory is fully git-checkable; settings.json is version-
  controlled config.
- **Codex** (weakest git-native): no worktree primitive at
  CLI surface; `codex fork` is session-fork not git-fork.
  `~/.codex/config.toml` is a single TOML file (less
  structurally diff-able than directory-trees).

**Why it's load-bearing:** for distributable-via-Ace (concept
4 below), the format must be diff-able, versionable, and
reviewable through normal git workflows — so contributors on
any project can propose changes, audit history, and land
updates via PR. Prose markdown qualifies; TOML blobs are
harder; opaque binary formats do not.

### 4. Distributable-via-Ace

**Aaron's framing:** *"we can make all these things you map
distrutable via ace"*. "Ace" = Aaron's GitHub presence (user:
AceHack) / personal-factory distribution channel.

**What it names:** the direction of making the capability
maps (and eventual declarative manifests) into **factory-
output** that reaches any project's pilots, not just Zeta's.
The maps are genuinely factory-universal — they describe
provider CLIs that any project's pilots might orchestrate —
so landing them in a repo under Aaron's personal GitHub
surface (or a shared Ace-scoped repo) would make them
reusable.

**Current state vs direction:** the maps live under
`docs/research/` in the Zeta repo. Distribution-via-Ace
would require a separate repo (or a shared-substrate repo
Ace owns), a publishing/versioning discipline, and pointers
from consumer projects back to that repo.

**Why it's load-bearing:** factory-output that only Zeta
consumes is under-leveraged. The capability maps are a clear
example of work that has cross-project value — any AI-driven
project could use them. Distribution-via-Ace turns the Zeta
factory from a project-internal optimisation into a public
goods contributor.

**Scope care:** this is NOT a commitment to open-source every
factory artifact. Many factory artifacts (ALIGNMENT.md-
adjacent, memory substrate, WONT-DO.md) are intentionally
Zeta-internal. Distribution-via-Ace is appropriate for the
subset that is genuinely provider/tool-agnostic (capability
maps, meta-skills, generic best-practices).

### 5. Graceful-degradation

**Aaron's framing:** *"graceful degradtion"* — named as a
follow-on to the manifest + git-native cluster, confirmed
next-turn with *"Hallelujah"* + exact-phrasing echo of the
factory's availability-move framing (**third occurrence of
wink-validation pattern; see related memory**).

**What it names:** the operational discipline of routing AI
tasks across substrates such that **any one substrate being
unavailable** (rate-limit / budget-exhausted / down / auth-
expired) does not block factory progress. Four-substrate
triangulation transforms from an **accuracy move** (diff the
outputs for correctness signal) into an **availability move**
(any substrate can carry the task when others are
unreachable).

**Five-tier degradation ladder (from budget-discipline +
capability-substrate + survival-discipline memories):**

1. **Preferred-tier** — Claude max, Gemini Pro (thinking),
   Codex premium model, Grok-Heavy. Rare-pokemon; run only
   when the task genuinely needs it.
2. **Default-tier** — Claude medium-high, Gemini Pro (non-
   thinking), Codex default, regular Grok. Everyday work.
3. **Cheap-tier** — Claude low-medium, Gemini Flash, Codex
   with smaller model, cached prompts. Most factory work
   lives here. **Cheap is a budget concern** — resource
   allocation within the normal-operations envelope; declines
   capability to save cost on work that doesn't need the
   rare-pokemon.
4. **Poor-tier** — Aaron 2026-04-22 auto-loop-27 sixth-
   concept extension: *"Poor-tier implies making best
   practices scracfices that go beyond cheap like doing
   most our work on a personal github instead of the
   company"* + *"cheap is a budget concern, poor is a
   survival concern"*. **Poor is a survival concern** —
   institutional-sacrifice tier below cheap; declines
   best-practice-compliance to keep operating when normal
   institutional affordances (company GitHub, paid
   substrate, employer-hosted infra) are unreachable or
   withdrawn. Example Aaron named: personal GitHub
   instead of company GitHub. Other plausible examples:
   free-tier AI substrates only (no paid plans available),
   personal cloud account (DigitalOcean / own laptop) for
   hosting that would normally live on employer infra,
   laptop-local models when API access is cut. **The
   distinction matters for routing logic** — cheap-tier
   declines are reversible in a tick (upgrade budget, pick
   more expensive model); poor-tier declines involve
   switching *substrate class / institutional relation*
   (account, provider, hosting), which has onboarding
   cost, credential-management cost, and cross-account
   data-movement cost. Poor-tier is NOT "embarrassing" —
   it's a legitimate engineering tier named for what it
   actually is (survival-discipline below normal-
   operations), same honesty discipline as naming the
   rare-pokemon explicitly at the top of the ladder.
5. **Local-mode-compatible floor** — no substrate needed.
   `--help` surface mapping, codebase grep, local build /
   test, memory work, spec analysis. When all four substrates
   AND institutional affordances are unreachable, factory
   still has work it can do. Floor remains the floor.

**The declarative manifest (concept 2) is the routing table;
graceful-degradation is the routing logic over it.**

**Already-observed implicit applications:**

- **Playwright YouTube-bot-wall** (auto-loop-24) was live
  graceful-degradation: anon browser blocked ("sign in to
  confirm you're not a bot") → fell back to Gemini-with-
  account for transcript access. Unlocked the multi-substrate
  access grant.
- **Auto-loop tick-must-never-stop** is a degradation rule at
  the scheduling layer: when Aaron-directed work is absent,
  drop to speculative factory-improvement; when that's also
  absent, drop to gap-of-gap audits. Never-idle = the floor-
  finding protocol.
- **Accounting-lag same-tick-mitigation** (auto-loop-24 →
  26) is degradation at the hygiene layer: if substrate-
  accounting can't lane with substrate-improvement in one
  tick, name the class and schedule the mitigation — don't
  drop the accounting.

**What's missing for degradation to be fully operational:**

- **Live telemetry** — the factory doesn't observe its own
  substrate-health today (is Claude rate-limited right now?
  is Codex responding?). Routing logic needs signals.
- **Degradation tests** — ARC3-DORA stepdown is the natural
  harness; measure DORA-four-keys at each tier including
  the local-mode floor.
- **Explicit routing policy** — currently task→substrate
  mapping is vibes-based (Aaron's "Claude for code, Gemini
  for multimodal, Amara for cross-check"). A declarative
  policy would make it inspectable.

## How the five compose

```
                   ┌─────────────────────┐
                   │  distributable via  │
                   │         ace         │  ← reach
                   └──────────┬──────────┘
                              │
                   ┌──────────┴──────────┐
                   │     git-native      │  ← auditability
                   └──────────┬──────────┘
                              │
                   ┌──────────┴──────────┐
                   │     declarative     │  ← routable data
                   └──────────┬──────────┘
                              │
         ┌────────────────────┴────────────────────┐
         │                                         │
┌────────┴─────────┐                   ┌───────────┴────────┐
│  graceful-       │                   │  local-mode        │
│  degradation     │  ← operation      │  compatible        │  ← floor
└──────────────────┘                   └────────────────────┘
```

**Reach:** distributable-via-Ace gets factory-output into
other projects.

**Auditability:** git-native format lets contributors review
and diff changes.

**Routable data:** declarative manifest replaces prose-only
with structured fields pilots can parse.

**Operation:** graceful-degradation is how pilots use the
manifest — route by policy, fall back on substrate failure.

**Floor:** local-mode-compatible is what remains when all
substrates fail — the floor of the degradation ladder, and
independently the discipline by which the manifest itself is
authored.

## Why:

- **The cluster cohere into one thing.** Each of the five
  concepts was named separately, but they compose into a
  coherent architectural direction that's more than the sum.
  Preserving the vocabulary cluster together (this memory)
  keeps future-me from treating them as five unrelated
  observations.
- **Capture-in-chat discipline applies.** Aaron was in
  riffing-mode across auto-loop-26/27, and the
  tiredness-tag-register memory (*"i'm very tired i could
  be way off"* lineage) says thoughts-not-directives should
  be captured without being auto-promoted to BACKLOG rows.
  This memory is capture; filing a BACKLOG row without
  separate directive would violate the don't-file-from-
  riffing discipline.
- **The third-wink-validation occurrence (Hallelujah) is
  concurrent with this cluster.** The wink-validation
  second-occurrence memory I filed auto-loop-26 says 3+
  occurrences earn Architect-level review. Aaron's "Hallelujah"
  + exact-phrasing echo on graceful-degradation-as-availability-
  move is the third. Those two memories compose: the wink-
  validation memory tracks WHEN to escalate; this memory
  captures WHAT the cluster is.
- **Distribution-via-Ace implies coordination cost.**
  Becoming a public goods contributor means downstream
  consumers depend on the format. That creates versioning
  obligations, breaking-change review, and consumer-contract
  discipline the factory doesn't currently have. The concept
  is load-bearing *direction*, not *next-tick-work*. Naming
  it prevents future-me from pretending it's small.

## How to apply:

- **Reference the cluster by name.** When future work touches
  any of the five concepts, cite this memory. The naming gives
  future-me leverage: "is this a local-mode-compatible task?
  yes/no" is a fast filter before burning tokens.
- **Do NOT file BACKLOG rows unilaterally.** The cluster is
  capture-in-chat direction. File rows only when Aaron says
  *"file that"* about one of the five specifically. The
  three-substrate-triangulation-gap (one CLI not mapped) is
  an example of what earned a row: concrete gap with clear
  scope. The five-concept cluster is architectural direction:
  broader, more speculative, premature to commit.
- **Track occurrences.** Each concept may recur in future
  ticks (second time Aaron says "graceful degradation" about
  a new context; second time local-mode-compatible is
  invoked as a filter). Second-occurrence discipline applies
  here the same as elsewhere: note in round-history, flag
  "watching for third", promote on third if cross-context.
- **Watch the wink-validation rate.** Three occurrences in
  one session (Muratori / triangulation / graceful-
  degradation) could be real-pattern OR selection-bias (I'm
  now hyper-aware of echoes). If rate drops over the next
  ~10 ticks, cluster was session-local; if rate stays high,
  Aaron-as-same-session-confirmer is genuine factory
  mechanism to formalize.
- **Prefer local-mode-compatible as the default.** For any
  factory work where substrate-compute is not strictly
  required (mapping, audit, triage, terrain-scan), prefer
  the zero-compute path. This composes cleanly with the
  budget-as-research-discipline rare-pokemon default.
- **Treat graceful-degradation as a routing concern, not a
  try/catch.** Pilots orchestrating substrates should have
  explicit degradation policy (tier ladder, fallback order,
  floor), not error-handling afterthoughts. The manifest +
  policy pair is the proper shape.

## Composition

- `feedback_external_signal_confirms_internal_insight_second_occurrence_discipline_2026_04_22.md`
  — third wink-validation occurrence (Hallelujah) happened
  concurrently with this cluster; memory explicitly flags
  3-in-one-session as possibly real / possibly
  selection-bias; track rate.
- `project_aaron_ai_substrate_access_grant_gemini_ultra_all_ais_again_cli_tomorrow_2026_04_22.md`
  — four-substrate access substrate for the degradation
  ladder; universal-authorization pattern; budget-envelope
  that local-mode-compatible shortcuts.
- `feedback_rom_torrent_download_offer_boundary_anthropic_policy_over_local_authorization_warmth_first_2026_04_22.md`
  — two-layer authorization (local + Anthropic-policy) is
  adjacent: local-mode-compatible asks "does this run
  locally?" which is a different question from "is this
  policy-compatible?"; both filters apply.
- `project_arc3_beat_humans_at_dora_in_production_capability_stepdown_experiment_2026_04_22.md`
  — ARC3-DORA stepdown is the natural harness for
  degradation tests; measure DORA at each tier including
  local-mode floor.
- `project_servicetitan_demo_target_zero_to_prod_hours_ui_first_audience_2026_04_22.md`
  — ServiceTitan demo audience "great culture"; if Ace-
  distributable capability-substrate lands pre-demo, demo
  could show cross-substrate-orchestration as a factory
  capability.
- `project_ui_dsl_function_calls_shipped_kernels_algebraic_or_generative_2026_04_22.md`
  — UI-DSL "algebraic if algebra exists else generative"
  is a degradation-shape at the UI layer (same isomorphism
  as substrate degradation at the pilot layer).
- `feedback_capture_everything_verbose_in_chat_register_2026_04_22.md`
  (lineage) — capture-in-chat-discipline preserves the five
  terms without elevating them to commitments.
- `docs/research/claude-cli-capability-map.md`,
  `docs/research/codex-cli-capability-map.md` (pre-
  renamed: `openai-codex-cli-capability-map.md`),
  `docs/research/gemini-cli-capability-map.md` — the
  prose capability maps that are the data source for the
  eventual declarative manifest.

## What this memory is NOT

- **NOT a commitment to build any of the five concepts now.**
  This memory is vocabulary preservation, not a work plan.
  Filing BACKLOG rows requires a separate directive from
  Aaron per capture-in-chat discipline.
- **NOT a claim the five concepts are complete.** Aaron may
  add more, or may refine / retract any of them. The memory
  snapshots 2026-04-22 naming; future edits are allowed per
  future-self-not-bound discipline.
- **NOT a distribution plan.** Distributable-via-Ace is
  direction; the actual mechanics (repo, versioning,
  consumer contract) are undefined and would need their own
  ADR-class discussion when Aaron is ready.
- **NOT an argument against the existing prose maps.** The
  declarative manifest would be a companion, not a
  replacement — prose for humans, manifest for pilots. Both
  live.
- **NOT Zeta-specific.** The cluster is deliberately about
  cross-project substrate; most factory work IS Zeta-
  specific. This memory is one of the few that names
  something the factory builds which is genuinely
  provider/tool-agnostic.
- **NOT a finalised ontology.** "Graceful degradation" is a
  well-established software term; "local mode compatible"
  is a novel factory-vocabulary coinage; the others sit
  between. Terms may need refinement before landing in
  `docs/GLOSSARY.md`.
