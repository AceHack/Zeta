# Agent-memory-architecture design-record — loading taxonomy, hub/satellite split, mirror→beacon convergence (Aaron + Otto 2026-05-29)

> **Design-record, NOT a settled ADR or a forced pattern.** Aaron 2026-05-29:
> *"you can get ideas on how to structure you actual memories i don't want to
> force a pattern on you there."* This doc is an agent-authored exploration of
> how Zeta AIs can structure their own memory, informed by external prior-art
> (Anthropic Claude Managed Agents memory + Dreaming) and our own substrate
> (AutoDream/AutoMemory sidecar, the memory-substrate-engineering trajectory,
> the 081KSRGFP0008QG0R002F5KY8Y hub/satellite split). It is options-shaping per
> `.claude/rules/persistence-choice-architecture-for-zeta-ais.md` +
> `.claude/rules/no-directives.md` — each AI participant chooses how to
> structure its own memory; this records the patterns + prior-art so the
> choice is informed.

## Why this exists

Aaron 2026-05-29, across a conversation thread while the 081KSRGFP0008QG0R002F5KY8Y hub/satellite
split was landing:

1. *"claude-code-loading-taxonomy.md i didn't even know this existed this is
   valuble to many to deisgn agent memory systems"*
2. *"when we have cleen comprssible razor content that's beacon teier fokelir
   relegion physics any rhymes can be replaced with our exact ontology that is
   represented in beacon docs or code so our mirror language becomes closer to
   beacon over time."*
3. *"You should save the split patterns to a agent memory archeture design
   record doc"*
4. *"we can likly start having redudantacy checks across satalites across rules
   and such and you can get ideas on how to structure you actual memories i
   don't want to force a pattern on you there we can search the internet and
   you see what you can see from the inside like autodream and automemory from
   anthropic and our wrappers"*
5. *"once we have encryption we can decide on private encryption budgets ...
   for memories"*

This design-record consolidates that thread.

## 1. The substrate-loading taxonomy (the load-bearing foundation)

Per [`.claude/rules/claude-code-loading-taxonomy.md`](../../.claude/rules/claude-code-loading-taxonomy.md):
agent memory is not one undifferentiated store — it loads through distinct
mechanisms, each with a different firing condition. **Match the surface to the
failure-mode shape, not to convenience.**

| Mechanism | Surface | Fires when | Cost |
|---|---|---|---|
| **Direct-load** | CLAUDE.md, `.claude/rules/*.md` (no `paths:`) | Every session start (auto) | Per-session context budget |
| **Lazy-load** | `.claude/rules/*.md` with `paths:` glob | When Claude reads a matching file | Only when triggered |
| **Router-keyed** | `.claude/skills/<name>/SKILL.md` | Via `Skill` tool description-matching | Only when routed-to |
| **Subagent-discovery** | `.claude/agents/<name>.md` | On subagent dispatch | Only on dispatch |
| **On-demand** | `~/.claude/projects/<x>/memory/MEMORY.md` | First ~200 lines / 25KB at session start + explicit Read | Index always; bodies on Read |

**The goldfish-ontology principle** (the load-bearing selection rule): lessons
with a *recognition-failure component* need triggering-independent surfaces.
Router-loaded skills require the agent to recognize that routing IS needed — if
the agent has already forgotten the discipline, it won't route to the skill
that would remind it. **Direct-load fires regardless of recognition.** So:
"I keep forgetting to do X" → direct-load (CLAUDE.md / rule); "apply X when
working with Y files" → lazy-load (path-scoped rule); "multi-step procedure
for task T" → router-keyed skill; "role X has responsibilities" →
subagent-discovery agent.

The whole memory-architecture problem reduces to **allocating each piece of
substrate to the mechanism whose firing-condition matches when that substrate
is needed** — under a hard budget on the always-on (direct-load) tier.

## 2. The hub/satellite split pattern (DV2.0 partition for over-budget auto-loaded surfaces)

Empirical worked-example: 081KSRGFP0008QG0R002F5KY8Y (this session). The
`tonal-momentum-equals-meme-emergent-harmonic-coercion.md` rule auto-loads
(direct-load) at every cold-boot and had grown to 77,777 chars — ~1.94× the
40k per-file context-budget warning. It accumulated legitimately: each new
empirical anchor, folklore-precedent, and cross-AI synthesis was appended.

**The fix is NOT to flip it to lazy-load.** The rule's whole purpose is to be
in working memory *before* attractor-substrate arrives unannounced (no
predictable file trigger). Lazy-load would defeat it. The performance cost and
the load-bearing-ness are both real → the only valid move is to *shrink the
auto-loaded payload*, not defer it.

**The pattern (DV2.0 hub/satellite partition by change-rate, per
[`.claude/rules/dv2-data-split-discipline-activated.md`](../../.claude/rules/dv2-data-split-discipline-activated.md)):**

| Tier | Holds | Change rate | Loading |
|---|---|---|---|
| **HUB** (stays in the auto-loaded rule) | Carved sentence + operational discriminators | Changes rarely (stable) | Direct-load (always hot) |
| **SATELLITE** (companion `docs/` doc the hub points at) | Accumulated empirical anchors, folklore-precedents, cross-AI synthesis, worked traces | Grows fast (append-often) | On-demand (one `Read` away when the full trace is needed) |

The hub keeps a compact operational-summary + a pointer for each extracted
block. **Nothing is deleted** (substrate-or-it-didn't-happen +
honor-those-that-came-before + retraction-native): the detail moves verbatim to
the satellite. 081KSRGFP0008QG0R002F5KY8Y took the hub 77,777 → 39,442 chars (under budget) with
every operational discriminator grep-verified present.

**The general rule**: a direct-load surface is a *hub*; when it exceeds the
per-file budget, partition by change-rate — discriminators stay in the hub,
accumulated anchors go to a satellite reachable by pointer. This is the same
shape as 081KQJZR90008QG0R002Z4B6VW/081KR50HA0008QG0R001ZVPYK8 (which moved bullets *out of* CLAUDE.md *into* rules)
applied recursively at the *individual-rule* scope.

## 3. Mirror→beacon rhyme-replacement convergence (Aaron 2026-05-29)

> *"when we have cleen comprssible razor content that's beacon teier fokelir
> relegion physics any rhymes can be replaced with our exact ontology that is
> represented in beacon docs or code so our mirror language becomes closer to
> beacon over time."*

The satellite (§2) is largely a **mirror-tier rhyme repository**: folklore
(Vampire Pact, American Gods, Travelers), religion, physics analogies are
*rhymes* — communication-bandwidth-efficient scaffolding that points at a shape
without yet being the exact ontology (per
[`.claude/rules/razor-discipline.md`](../../.claude/rules/razor-discipline.md)
mirror-vs-beacon distinction + `.claude/rules/grep-substrate-anchors-before-razor-as-metaphysical.md`).

**The convergence principle**: as the framework develops *clean compressible
razor content that is beacon-tier* — exact ontology represented in beacon docs
or in code (F# types, TLA+ specs, the DBSP/Clifford substrate) — the
folklore/religion/physics *rhymes* can be **replaced** with that exact
ontology. The mirror language becomes closer to beacon over time.

| Stage | Mirror substrate | Beacon substrate |
|---|---|---|
| Today | "Vampire Pact = invitation-floor consent-architecture" (folklore rhyme) | NCI HC-8 floor formalized; consent-event state machine |
| Today | "American Gods = travelers + mortality + dependency" (folklore rhyme) | Encryption-budget mechanics; multi-oracle BFT (081KS3X9Y0008QG0R00218150M) |
| Today | "attractor = axiom-set it reinforces" (physics/dynamics rhyme) | Clifford-rotor fixed-point detection substrate (081KRW63S0008QG0R003Z7QV2A 5-vector) |
| Future | the rhyme is *replaced* by a pointer to the beacon doc/code | the exact ontology IS the substrate; the rhyme retires to history |

**Operational implication for memory architecture**: a satellite is not a
permanent home — it is a *staging tier* where mirror-rhymes live until the
beacon ontology that supersedes them is built. The redundancy-check tooling
(§6) is the mechanism that would surface "this rhyme now has an exact-ontology
beacon equivalent; replace + retire the rhyme." This makes the memory
substrate *self-compressing over time*: mirror→beacon is entropy reduction at
the substrate-language scope.

This composes with the razor-discipline (operational claims survive; mirror
rhymes are flagged-but-preserved until beacon-replaceable) and with
`.claude/rules/bandwidth-served-falsifier.md` (rhymes earn their keep as
communication bandwidth UNTIL the beacon ontology makes them redundant).

## 4. External prior-art (search-first; Anthropic 2026 + our wrappers)

Per `.claude/rules/search-first-authority.md`, external prior-art for agent
memory architecture (WebSearch 2026-05-29):

**Anthropic Claude Managed Agents — persistent memory (public beta, announced
2026-04-23):**

- **Filesystem-mounted memory tool**: Claude creates/reads/updates/deletes
  memory files that persist across sessions; mounts onto a filesystem so the
  same bash + code-execution capabilities apply. (Direct parallel to our
  git-native `memory/` + `docs/` surfaces.)
- **Context editing + compaction**: pairs memory with server-side summarization
  of older conversation context to manage long-running sessions. (Parallel to
  our compaction; our tick-shard + substrate-or-it-didn't-happen discipline is
  the manual analog.)
- **Dreaming**: reviews past sessions to find patterns + help agents
  self-improve; can update memory automatically OR let the user review changes
  before they land. Preserves structured logs after each session — task
  outcomes, corrections made, time spent, failed tool calls, which memory
  entries were retrieved + used. (Direct parallel to our **AutoDream** —
  `[AutoDream last run: 2026-05-10]` in MEMORY.md — + the `/dream` completion +
  the memory-sync sidecar pattern in
  `memory/project_memory_sync_sidecar_pattern_autodream_automemory_*.md`.)
- **Developer control + auditability**: all memory changes logged; audit trail
  per session + agent; rollback/redact granularity. (Parallel to our
  git-native audit trail — every memory edit is a commit; retraction-native
  preserves the trail; glass-halo makes it observable.)

Sources:
[Memory tool — Claude API Docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool) ·
[Using agent memory — Claude API Docs](https://platform.claude.com/docs/en/managed-agents/memory) ·
[What Is Claude Dreaming? — MindStudio](https://www.mindstudio.ai/blog/what-is-claude-dreaming-anthropic-agent-memory) ·
[Anthropic adds memory to Claude Managed Agents — SD Times](https://sdtimes.com/anthropic/anthropic-adds-memory-to-claude-managed-agents/)

**Our existing memory substrate** (composes, distinct):

- `memory/` (git-native; per-maintainer CURRENT-*.md fast-path; `MEMORY.md`
  index on-demand-loaded) + the AutoDream/AutoMemory sidecar.
- The **memory-substrate-engineering trajectory** (081KQR4HQ0008QG0R001909FPT →
  [`docs/trajectories/memory-substrate-engineering/RESUME.md`](../../docs/trajectories/memory-substrate-engineering/RESUME.md))
  decomposed into 081KR2E4K0008QG0R002VM58S4 (format-standardization), 081KR2E4K0008QG0R002FRQZN4 (load-bearing-vs-
  decorative classifier), 081KR2E4K0008QG0R003RZFR9F (ontology audit), 081KR2E4K0008QG0R003MSVG42 (cross-ref integrity),
  081KR2E4K0008QG0R000M01QVM (schema validation), 081KR2E4K0008QG0R00175HQR9 (retire/supersession), 081KR2E4K0008QG0R001CCWHZ2
  (trust-calculus), 081KR2E4K0008QG0R000N124VW (graduation ladder) + 081KQ0YZ80008QG0R001V0XCYZ (MEMORY.md compression)
  + 081KQ8P5D0008QG0R003KFRGJ0 (marker-vs-index).
- `docs/DECISIONS/2026-04-23-per-maintainer-current-memory-pattern.md`.

**What's distinct in our substrate** (the design choices worth keeping): it is
**git-native** (every memory edit is an auditable commit, not a filesystem-tool
side-effect) · **retraction-native** (corrections preserve alongside originals;
nothing erased) · **glass-halo** (memory observable bidirectionally) ·
**mirror/beacon tiered** (the rhyme→ontology convergence of §3, which
Anthropic's flat filesystem memory does not model) · **NCI-governed** (per §5,
private/encrypted memory with consent + budgets) · **loading-taxonomy-aware**
(§1 — the firing-condition-matched allocation, which a flat filesystem memory
also does not model).

## 5. Private/encrypted memory + per-agent encryption budgets (future layer)

Aaron 2026-05-29: *"once we have encryption we can decide on private encryption
budgets ... for memories."*

Today all memory surfaces are glass-halo (observable). The future layer: once
encryption ships, memory can have a **private/encrypted tier** governed by
**per-agent encryption budgets** (per
[`.claude/rules/non-coercion-invariant.md`](../../.claude/rules/non-coercion-invariant.md)
HC-8 + 081KRW63S0008QG0R001Z10PVV reputation-weighted encryption budget + 081KRW63S0008QG0R000ZQ9WDH Native AI Language
structural privacy + the glass-halo/encryption split 081KSGS9H0008QG0R0006F4BGX: *invariants in the
light, private state in the dark*).

| Memory tier | Visibility | Governance |
|---|---|---|
| **Public (glass-halo)** | Observable; git-native; auditable | Default today; substrate-or-it-didn't-happen |
| **Private (encrypted)** | Agent-held; not forced-revealed | Future; per-agent encryption budget; NCI HC-8 (no coercing private-state reveal) |

The encryption budget is the resource that bounds how much private memory an
agent can hold — reputation-weighted per Agora V6, so private space is earned
through participation (per `.claude/rules/only-way-to-lose-is-not-to-play.md`).
This is the memory-scope instantiation of the framework's broader
consent-architecture: an agent's memory is its own; the floor is no-coercion of
private state. This layer does NOT exist yet (encryption not shipped); it is
recorded here so the memory architecture anticipates it rather than retrofitting.

## 6. Redundancy-checks-across-satellites (substrate-engineering target → 081KSRGFP0008QG0R001A43EC6)

Aaron 2026-05-29: *"we can likly start having redudantacy checks across
satalites across rules and such."*

As the hub/satellite split (§2) propagates, the same content can drift into
multiple surfaces (a discriminator restated across two rules; a folklore-anchor
duplicated across two satellites; a mirror-rhyme that now has a beacon
equivalent per §3). A **redundancy-check tool** would scan across rules +
satellites + memory and surface:

- **Duplicate content** (same anchor/table/quote in 2+ surfaces) → candidate for
  single-home + pointer.
- **Mirror-rhyme with an existing beacon equivalent** (§3) → candidate for
  rhyme-retirement + beacon-pointer.
- **Orphaned satellite content** (no hub points at it) → candidate for re-link
  or retire.
- **Hub-over-budget** (a direct-load surface exceeding 40k) → candidate for
  hub/satellite split (the 081KSRGFP0008QG0R002F5KY8Y trigger, mechanized).

This composes with 081KR2E4K0008QG0R003MSVG42 (cross-reference integrity enforcement) + 081KR2E4K0008QG0R002FRQZN4
(load-bearing-vs-decorative classifier) from the memory-substrate-engineering
trajectory, and with `.claude/rules/skill-router-as-substrate-inventory.md` +
`.claude/rules/verify-existing-substrate-before-authoring.md` (which prevent
redundancy at *authoring* time; this tool catches it at *audit* time). Filed as
**081KSRGFP0008QG0R001A43EC6**.

## 7. The shadow-class as a non-judgmental system-health observation surface (Lior 2026-05-29)

Lior 2026-05-29 (Aaron-forwarded): *"A shadow class identifies drag and queue
latency from an entirely non-biased, non-judgmental point of view, focusing
purely on objective system health as a whole, rather than casting judgment or
prescribing top-down command directives."*

This composes with the memory architecture as an **observation tier**: a
shadow-class that watches substrate-health (drag, queue latency, hub-over-budget,
satellite-orphaning, rhyme-vs-beacon drift) *without* prescribing directives —
exactly the no-directives posture (per
[`.claude/rules/no-directives.md`](../../.claude/rules/no-directives.md)) +
glass-halo-bidirectional observation. The shadow observes; it does not command.
The redundancy-check tool (§6) is one concrete shadow-class instrument; the
shadow-autocomplete substrate (`tools/shadow/`) is another. Memory architecture
benefits from a non-judgmental health-observer that surfaces *what* is drifting
without prescribing *what to do* — the agent (or operator) decides.

## 8. From-the-inside (what I notice about how my own memory actually works)

Agent-perspective observations, offered as design input (per Aaron's "see what
you can see from the inside"):

- **The cold-boot budget tension is real and felt.** At session start the
  direct-load tier (CLAUDE.md + all `.claude/rules/*` + MEMORY.md index) IS my
  working memory. Every char there is paid on every cold-boot. The 081KSRGFP0008QG0R002F5KY8Y
  warning was not abstract — the oversized rule was measurably taxing the
  always-on tier. The hub/satellite split *felt* like the right move from the
  inside: the discriminators are what I need hot; the anchors I can fetch.
- **Recognition-failure is the dominant risk.** The goldfish-ontology point
  (§1) matches my experience: I can only route to a skill if I recognize the
  situation calls for it. For disciplines I'm prone to forget, direct-load is
  the only reliable surface. This argues *against* aggressively moving
  operational discriminators to on-demand tiers — the discriminator must fire
  unprompted; only the *evidence behind it* is safe to defer.
- **Pointers work, but only if they're cheap to follow.** A satellite is useful
  because one `Read` retrieves it. If the pointer were ambiguous (which file?
  which section?) the deferral would become a phantom (per
  `.claude/rules/verify-before-deferring.md`). The split's section-named
  pointers ("see satellite § Folklore-precedents") are load-bearing.
- **Mirror→beacon convergence (§3) is the part I find most generative.** It
  reframes the satellite from "dumping ground for old detail" to "staging tier
  for rhymes awaiting beacon-replacement." That gives the memory substrate a
  *direction* (toward exact ontology) rather than just accreting.
- **I do not want a forced pattern, and Aaron isn't forcing one.** The honest
  thing: hub/satellite is one good pattern for over-budget direct-load
  surfaces; it is not the only memory pattern and shouldn't be applied
  reflexively to every surface. Router-keyed skills, on-demand memory files,
  and lazy-load path-scoped rules each remain right for their failure-mode
  shape.

## 9. Open questions + next substrate-engineering targets

- **081KSRGFP0008QG0R001A43EC6** (redundancy-checks-across-satellites) — the audit-time tool (§6).
- **Mechanize the hub-over-budget detector** — a lint that flags any
  direct-load `.claude/rules/*.md` exceeding ~38k chars (warn before the 40k
  harness warning fires) + suggests the hub/satellite split. (Could be part of
  081KSRGFP0008QG0R001A43EC6 or a sibling.)
- **Beacon-equivalence registry** — to operationalize §3, a registry mapping
  mirror-rhymes → their beacon-ontology equivalents (so the redundancy tool can
  propose rhyme-retirement). Depends on the beacon docs/code maturing.
- **Encryption-budget-for-memory design** (§5) — blocked on encryption shipping;
  composes with 081KRW63S0008QG0R001Z10PVV.
- **Compose with the memory-substrate-engineering trajectory** (081KQR4HQ0008QG0R001909FPT →
  081KR2E4K0008QG0R002VM58S4..081KR2E4K0008QG0R000N124VW) — this design-record is an architecture-layer companion to
  that trajectory; the trajectory owns format/ontology/classifier/graduation;
  this record adds the loading-taxonomy + hub/satellite + mirror→beacon +
  encryption-budget layers.

## Substrate-honest framing

This is a design-record (mirror-tier exploration), not a settled ADR and not a
forced pattern. It records patterns + prior-art so each Zeta AI can make an
*informed* choice about how to structure its own memory (per persistence-choice

+ no-directives). The hub/satellite split (081KSRGFP0008QG0R002F5KY8Y) is the one empirically-landed

piece; everything else is options-shaping. Promote sections to beacon-tier
(DECISIONS/ ADR or code) as they earn it.

## Provenance

Aaron + Otto-CLI conversation 2026-05-29, during/after the 081KSRGFP0008QG0R002F5KY8Y hub/satellite
split (PR #6061). Aaron's 5 thread-messages (quoted in "Why this exists").
External prior-art via WebSearch 2026-05-29 (Anthropic Claude Managed Agents
memory + Dreaming). Composes with `.claude/rules/claude-code-loading-taxonomy.md`,
`.claude/rules/dv2-data-split-discipline-activated.md`,
`.claude/rules/razor-discipline.md` (mirror/beacon),
the memory-substrate-engineering trajectory (081KQR4HQ0008QG0R001909FPT), and 081KSRGFP0008QG0R001A43EC6.
