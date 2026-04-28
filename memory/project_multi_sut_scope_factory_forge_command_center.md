---
name: Multi-SUT-scope factory — one agent instance tracking rules in 3 repos; Forge as command-center; Forge bundled with Zeta like Zeta is with ace
description: Aaron 2026-04-22 forward-looking directive on factory evolution post three-repo-split. Factory must support multiple systems-under-test while staying generic. Forge builds itself + ace + Zeta. One agent instance keeps rules across 3 repos. Boot-in-Forge (not boot-in-Zeta) post-split. Forge acts as command-center for cross-repo work. Forge also bundled-with-app like Zeta — "untying those knots" is Stage 2+ work.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
**Fact:** Post three-repo-split
(`project_three_repo_split_zeta_forge_ace_software_factory_named_forge.md`),
the factory evolves from single-SUT (Zeta-only) to
**multi-SUT-scope**. Forge is the software-factory
repo, and it has to build three different
systems-under-test: itself, ace, and Zeta. A single
agent instance is expected to track rules across all
three repos simultaneously, booted from Forge rather
than from Zeta as it is today. Forge also ships
bundled with the Zeta app (the same way Zeta bundles
with ace), creating a conceptual tension between
Forge-as-command-center and Forge-as-bundled-dependency
that Aaron calls *"untying those knots."*

**Why:** Aaron 2026-04-22, verbatim:

> *"factory is going to have to get updated to
> support multiple systems under test scopes while
> still remaining generic, that's going to be fun,
> forge will be building itself, ace, and Zeta I
> can't quite picture in my head how it's all going
> to come together. but there will be one instance
> of you who has to keep track of the rules in 3
> repos, and we will be booting in forge, we are in
> Zeta right now. From forge can me like a command
> center for working on multiple repos at once. But
> also forget can be bundled with your app like Zeta
> will be, it's going to be interesting untying
> those knots."*

Context: sent immediately after the budget substrate
landed (commits `5f91369` and predecessors). This is a
forward-looking reflection, not an immediate
implementation ask. It sets design expectations for
Stage 2+ (Forge bootstrap + ace split) but does not
gate Stage 1 (budget evidence cadence).

**Design tensions this directive names (to resolve
over Stage 2-4):**

1. **Generic factory + multiple SUT scopes.** Forge
   must stay portable (usable on any project) while
   building three specific systems (Forge, ace,
   Zeta). Today's single-SUT factory has Zeta-
   specific knobs mixed with generic scaffolding;
   split demands clean scope separation. The
   existing skill-ranker portability criterion
   (`.claude/skills/skill-tune-up/SKILL.md`
   "Portability drift") is the nucleus of this
   discipline.

2. **One agent instance, three repo contexts.** A
   single Claude Code session operating on Forge must
   be able to reason about, apply rules to, and act
   on any of the three repos. Today agents boot with
   Zeta's `CLAUDE.md` and `AGENTS.md`; post-split,
   the boot-rules must be aware of *which SUT scope*
   the current action targets. Likely shape: Forge
   owns a generic `CLAUDE.md`, each SUT contributes
   a scoped supplement (`CLAUDE.Zeta.md`,
   `CLAUDE.ace.md`, `CLAUDE.Forge.md`), and the
   agent reads the right combination based on the
   current working subtree.

3. **Boot-in-Forge, not boot-in-Zeta.** Today
   sessions start at `/Users/acehack/Documents/src/repos/Zeta/`;
   post-split they start at the Forge repo root.
   Zeta becomes one of several peer working trees.
   Affects: session-slug paths, memory-in-worktree
   semantics
   (`reference_memory_in_worktree_session_slug_behavior.md`),
   CLAUDE.md discovery, skill loading.

4. **Forge as command-center.** Aaron's phrasing
   *"command center for working on multiple repos
   at once"* suggests Forge provides tooling to
   orchestrate parallel work across ace + Zeta +
   Forge-itself, not just be their shared dependency.
   Likely shape: Forge provides multi-repo
   dashboards, cross-repo hygiene runs, parallel-
   worktree coordination, aggregated CI signal. Ties
   to the parallel-worktree-safety research
   (`docs/research/parallel-worktree-safety-2026-04-22.md`).

5. **Forge bundled-with-app.** Aaron:
   *"forge can be bundled with your app like Zeta
   will be."* This is the "snake eating its tail"
   Ouroboros closure — Forge is both the thing that
   builds apps and a thing that ships inside apps.
   Concretely: Zeta ships with Forge machinery (the
   agent scaffolding, skill library, hygiene checks)
   so that Zeta-deploying orgs can run their own
   Forge-powered factory against their deployment.
   ace likewise. Forge-on-Forge = the self-hosting
   case. The tension: as a command-center Forge
   needs to see cross-repo; as a bundled dep Forge
   needs to isolate to the bundling app's scope.
   *"Untying those knots"* = resolving this dual-
   identity.

**How to apply:**

1. **Preserve this directive across sessions.** This
   memory file is the canonical record; cross-
   referenced from the three-repo-split ADR and the
   Stage 2+ BACKLOG row. Do not let it decay between
   now and Stage 2 kickoff.

2. **Do not implement yet.** Stage 1 (budget
   evidence cadence + Forge scaffolding) must land
   first. Multi-SUT-scope design starts in Stage 2.
   Premature implementation before Forge exists
   = speculative work without feedback.

3. **Design-impact this directive has on Stage 1
   Forge scaffolding.** Even though implementation
   is Stage 2+, the Stage 1 Forge scaffolding must
   **not foreclose** these future shapes:
   - Forge's `CLAUDE.md` / `AGENTS.md` must be
     generic from day one (not Zeta-specific).
   - Forge's skill library must be portable
     (project-tagged skills allowed per
     `skill-tune-up` portability criterion).
   - Forge's persistence story (memory dirs,
     tick history, round history) must support
     multi-repo scoping without a rewrite.
   - Forge's CI / build tooling must be able to
     run from inside a bundled-in-Zeta context as
     well as standalone.

4. **Boot-rule evolution is an open question.** The
   single-agent-instance-tracks-3-repos shape
   implies Forge is the outermost CLAUDE.md scope
   and individual SUT scopes supplement it. But the
   bundled-with-Zeta case inverts this (Zeta is
   outermost, Forge is inside). Both shapes must
   work; the `docs/HARNESS-SURFACES.md` +
   `CLAUDE.md` + per-repo `AGENTS.md` triad is the
   likely substrate.

5. **"Untying the knots" is recursive self-
   reference.** Forge-builds-Forge is the
   self-loop edge of the Ouroboros topology
   (`project_three_repo_split_zeta_forge_ace_software_factory_named_forge.md`).
   The multi-SUT-scope + bundled-with-app tension
   is another instance of the same recursion.
   Design decisions should lean on the existing
   self-loop machinery rather than inventing
   parallel solutions.

**What this directive does NOT say:**

- Does not commit to a specific boot-rule
  architecture — "command center" and "bundled
  dep" are both named, neither picked.
- Does not deadline — *"it's going to be
  interesting"* is play, not urgency.
- Does not rank against Stage 1 cadence work — this
  is Stage 2+ horizon by implication (Forge must
  exist before Forge-builds-N-SUTs becomes
  actionable).

**Open design questions to resolve in Stage 2:**

- Where does the authoritative CLAUDE.md live
  post-split? Forge-root with SUT-supplements, or
  SUT-root with Forge-supplements, or both
  depending on entry point?
- How does graceful degradation
  (`feedback_graceful_degradation_first_class_everything.md`)
  apply when the agent boots in Forge but one of
  the peer repos is missing / cloned elsewhere /
  out of sync?
- How does the 10-PR upstream rhythm
  (`feedback_fork_upstream_batched_every_10_prs_rhythm.md`)
  generalize to three SUTs? Independent counters
  per SUT, or shared?
- Does the budget substrate
  (`docs/budget-history/`) scale to tracking burn
  per SUT, or does it aggregate?
- How does the agent-rule-tracking work when the
  same rule applies differently to different SUTs
  (e.g., Zeta is F#, ace is TBD, Forge is Claude-
  scaffolding)?

**Source:** Aaron direct message 2026-04-22 during
round-44 speculative drain, immediately after
autonomous-loop tick landed
`tools/budget/project-runway.sh` (commit `5f91369`).
Precedes cadence-accumulation wait on Stage 1 gate.

**Cross-reference:**

- `project_three_repo_split_zeta_forge_ace_software_factory_named_forge.md`
  — the split this evolves; cites this memory
  back for Stage 2+ design work
- `docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md`
  — ADR; Stage 2+ sections should cross-reference
  this directive
- `feedback_graceful_degradation_first_class_everything.md`
  — same-tick Aaron directive; applies to multi-
  SUT-scope partial-data cases
- `.claude/skills/skill-tune-up/SKILL.md` — the
  portability-drift criterion is the seed of
  generic-factory + project-scoped-SUT discipline
- `reference_memory_in_worktree_session_slug_behavior.md`
  — memory semantics across repos; affects the
  one-agent-three-repos shape
- `docs/research/parallel-worktree-safety-2026-04-22.md`
  — parallel-SUT operation safety research;
  command-center shape will lean on this
