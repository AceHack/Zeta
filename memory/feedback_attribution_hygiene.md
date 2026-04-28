---
name: Attribution hygiene — credit people / projects / patterns / characters at author-time; missing attribution is a tracked hygiene class (FACTORY-HYGIENE #42)
description: Aaron 2026-04-22 "missing attribution hygene" — when naming external people, patterns, projects, plugins, or characters in docs / memory / skills, include URL + author + organization; don't rely on audience recognition. Analogous to filename-content-match hygiene — opportunistic-on-touch + cadenced retrospective sweep. Missing-hygiene-class itself was the gap (no row / no skill until R44). FACTORY-HYGIENE row #42.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

**Rule.** When naming an external person, project, pattern,
technique, plugin, library, or fictional character in any
factory artifact (docs, memory, skills, ADRs, ROUND-HISTORY
rows, BACKLOG rows), include attribution at author-time:

- **Person** — findable URL if one exists (blog, profile,
  publication, GitHub page). "Geoffrey Huntley" → "Geoffrey
  Huntley (<https://ghuntley.com/ralph/>)".
- **Pattern / technique** — originator + source (blog post,
  paper DOI, tweet URL). Not just the pattern name.
- **Project / plugin / library** — author / maintainer
  organization (per the plugin's `plugin.json`, the repo's
  `package.json`, the paper's authors). "ralph-loop plugin"
  → "ralph-loop plugin (author: Anthropic per
  `.claude-plugin/plugin.json`)".
- **Fictional character** — creator (author) + publisher.
  "Ralph Wiggum" → "Ralph Wiggum (character by Matt Groening,
  *The Simpsons*, Fox Broadcasting)".
- **Related work** — link community implementations,
  forks, derivative projects. "Huntley's Ralph Loop" →
  "Huntley's Ralph Loop + related community impl
  `mikeyobrien/ralph-orchestrator`".

**Why.** Aaron 2026-04-22: *"missing attribution hygene"* +
*"like the other hygene this one is missing a skiil/row"*.
The catch came after `docs/AUTONOMOUS-LOOP.md` named
"Geoffrey Huntley's bash-wrapper", "Ralph Wiggum pattern",
"ralph-loop@claude-plugins-official plugin" without URLs,
without plugin authorship, without character attribution.
Audiences rotate, memory rots, and unattributed names
become orphaned claims — a name without attribution is a
claim someone-somewhere-said-this, unprovable and
unreviewable. Attribution at author-time is cheap; attribution
at retrospective audit is expensive. The real gap Aaron
flagged wasn't the one-off — it's that the factory had *no
hygiene row* catching this class, unlike filename-content-match
(#39), declarative-manifest-boundary, or the other on-touch
disciplines.

**How to apply.**

- **Every time an external name gets typed**, pause and ask:
  "Would a future contributor reading this cold know who
  this is, where to verify it, and what organization stands
  behind it?" If no, inline the URL / author / org now, not
  later.
- **Bias toward over-citing.** A URL that turns out to be
  redundant is cheaper than a name that turns out to be
  orphaned. "Anthropic's Claude Code" is fine for a
  one-sentence mention; "the factory's self-direction
  mechanism is native Claude Code scheduled tasks" in a
  load-bearing doc gets the URL.
- **Character / cultural references get creator+publisher.**
  "Ralph Wiggum" alone is not attribution; "Ralph Wiggum
  (Matt Groening, *The Simpsons*, Fox Broadcasting)" is.
  The test: can a reader who has never heard of the
  reference look it up with what you wrote?
- **Plugin / library authorship beats plugin name.** A
  plugin is named by whoever typed the name; the author
  lives in `plugin.json` / `package.json` / similar. Cite
  the author, not just the plugin name.
- **Retrospective sweep is a separate cadence.** Don't let
  the retrospective sweep become the primary enforcement
  surface — on-touch is cheap, on-sweep is expensive. The
  sweep is a safety net, not the default mechanism.

**How enforced.**

- `docs/FACTORY-HYGIENE.md` row #42 — opportunistic on-touch
  (every agent, self-administered) + cadenced retrospective
  sweep every 5-10 rounds (TBD skill, queued in BACKLOG P1).
- Candidate skill name: `attribution-auditor` (to be decided
  by Architect + Aaron). Candidate owner: Daya (AX) for
  retrospective sweep, since this is an adopter-experience
  concern too.
- Ships to project-under-construction — adopters citing
  external patterns inherit the discipline.

**Companion rules.**

- `feedback_filename_content_match_hygiene_hard_to_enforce.md`
  — analogous hygiene class: opportunistic-on-touch + cadenced
  retrospective sweep, exhaustive not budget-viable.
- `feedback_imperfect_enforcement_hygiene_as_tracked_class.md`
  — meta-insight that non-exhaustive hygiene rules form a
  tracked class; attribution hygiene is a new member of that
  class.
- `feedback_missing_hygiene_class_gap_finder.md` — Aaron's
  2026-04-22 clarification confirms this row's utility:
  whole CLASSES of hygiene the factory didn't know it was
  missing get surfaced by specific corrections.
- `feedback_crystallize_everything_lossless_compression_except_memory.md`
  — honest labels + compressed bodies are diamond repo
  surface; attributed names are honest labels.
- `feedback_preserve_original_and_every_transformation.md` —
  this memory preserves the original catch (Aaron's exact
  words) and the original unattributed snippet that
  triggered the rule.

**Triggering incident (verbatim, preserved per
preserve-original rule).**

2026-04-22, during round 44 autonomous-loop work, I committed
edits to `docs/AUTONOMOUS-LOOP.md` (d076fbe / d954681) +
`docs/research/meta-wins-log.md` that named:

- "Geoffrey Huntley's bash-wrapper" — no URL to his blog,
  no confirmation that this is the same Geoffrey Huntley
  who writes about agentic coding.
- "Ralph Wiggum pattern" — no creator (Matt Groening), no
  show (*The Simpsons*), no publisher (Fox Broadcasting).
- "`ralph-loop@claude-plugins-official` plugin" — no
  author (Anthropic per the plugin's `plugin.json`), no
  note that the plugin README credits Huntley as the
  technique's originator.
- "A/B isolation" pattern in the meta-wins row — no nod
  to the experimental-science lineage (R.A. Fisher and the
  20th-century statistical-methodology literature).

Aaron's response, verbatim: *"missing attribution hygene"*
followed by *"like the other hygene this one is missing a
skiil/row"*. The second message is the load-bearing one:
the issue isn't that I missed *this one* attribution set —
the issue is that the factory had no row / no skill catching
this class, so the same gap could re-surface next round.

**First-pass fix (2026-04-22):**

1. `docs/AUTONOMOUS-LOOP.md` edit replacing the terse
   three-pattern block with a properly attributed numbered
   list (uncommitted at memory-write time; commits in the
   same bundle as this memory).
2. This memory.
3. `docs/FACTORY-HYGIENE.md` row #42.
4. MEMORY.md pointer.
5. Retrospective sweep deferred to a cadenced skill
   (`attribution-auditor`) queued in BACKLOG.
