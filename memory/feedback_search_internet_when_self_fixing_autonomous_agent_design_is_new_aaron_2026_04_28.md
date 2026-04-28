---
name: When self-fixing, search the internet — autonomous agent design is new field; others may have tried this
description: Whenever fixing my own behaviour, harness, or autonomous-loop discipline, WebSearch for prior art first. Autonomous agent design is a new field (2024-2026); other practitioners are working the same problems and may have already discovered the patterns / pitfalls / solutions worth borrowing. Generalises Otto-247 (version-currency, always WebSearch first) from "version numbers" to "any self-fixing rule." Aaron 2026-04-28 framing: *"atunomous agent design is sooo new whenever you are fixing yourself you should probalby search the internet and see if you can find anyone trying to do the same thing an what they tried, probalby a lot of good harness information too that you can't directly sense yourself because it's the harness."* Includes a source-quality discipline (Anthropic published docs canonical, public community refs first-class evidence, no source-level vendoring from any third-party harness mirror) reconciling permissive maintainer framing with the factory's stricter copyright/integration policy.
type: feedback
---

# When self-fixing, search the internet first — agent design is new

**Rule:** every time the work-stream is "fix my own
behaviour," "fix the harness experience," "improve the
autonomous-loop discipline," or "design a new self-
governance rule," **WebSearch for prior art first**. The
field of autonomous agent design is new (2024-2026); other
practitioners are working the same problems in parallel,
and what they've tried — including failures — is signal we
should not throw away by re-deriving from scratch.

This generalises Otto-247 (version-currency: always
WebSearch first because training-data is stale) from "any
version number" to "any self-fixing rule." The mechanism is
the same: training-data has a cutoff, the practitioner
community evolves continuously, and reflexively asking "has
someone else tried this?" beats reflexively assuming I'm
the first to encounter the problem.

**Why** (Aaron 2026-04-28):

> *"atunomous agent design is sooo new whenever you are
> fixing yourself you should probalby search the internet
> and see if you can find anyone trying to do the same
> thing an what they tried, probalby a lot of good harness
> information too that you can't directly sense yourself
> because it's the harness."*

Two distinct payloads in that one signal:

1. **Behavioural discipline** — pre-commit research before
   landing a self-fixing rule. Composes with Otto-247
   version-currency.

2. **Harness-as-blind-spot** — the harness layer (Claude
   Code itself, the SDK, the autonomous-loop runtime) is a
   black box from inside. I cannot directly observe my own
   harness; reading external sources about it is the only
   way to learn how it actually behaves.

**How to apply:**

1. **Trigger** — work-stream involves: my own behaviour
   discipline, autonomous-loop ergonomics, harness
   troubleshooting, multi-Claude coordination, agent
   memory architecture, prompt-injection defence, or any
   "should I encode this as a rule?" question.
2. **Search** — issue 2-4 WebSearch queries targeted at
   the problem class. Examples:
   - *"autonomous agent self-correction discipline 2026"*
   - *"Claude Code harness session compaction trigger"*
   - *"autonomous loop tick discipline LLM"*
   - *"agent memory cadenced re-read"*
3. **Read prior art** — skim the top 3-5 results. Look for
   patterns named, mistakes documented, conventions
   converged on.
4. **Compose, don't import naively** — adopt patterns that
   compose with Zeta's substrate (HC-1..HC-7, Otto-NN,
   BP-NN). Don't import patterns that conflict with
   Glass Halo, retraction-native discipline, or the no-
   directives invariant.
5. **Cite in the memory / ADR** — when filing the rule,
   cite what prior art was found and why this version of
   the rule is the one we're landing.

**Diagnostic tell:** if I'm about to write a memory file
named `feedback_<self-improvement>_*.md` and I haven't
searched the internet first, that's the trigger to pause
and search.

## Reference: community sources for harness troubleshooting

Per the human maintainer 2026-04-28, the search-internet
discipline above can apply to harness-level troubleshooting
too: when an issue with my own behaviour or my harness
surfaces, public community sources (Anthropic's published
Claude Code documentation, blog posts, GitHub discussions,
RFCs, Stack Overflow) are first-class evidence to consult.

**Source-quality discipline (informed by PR #72 review on
leaked-source-mirror provenance):**

- **Anthropic's published Claude Code documentation is
  authoritative.** When an Anthropic-published doc covers
  the question, that doc wins.
- **Reading public community references is fine.** Blog
  posts, public discussions, RFCs, Stack Overflow,
  conference talks. Reading-for-understanding is not
  source-level integration.
- **No source-level extraction or vendoring from any
  third-party Claude Code mirror.** Even if a repository
  claims to mirror harness internals, copying code or
  transcribing identifiers from it into Zeta is
  forbidden — both because the factory's general policy
  treats leaked-but-copyrighted material as unusable
  regardless of on-internet availability, and because
  Anthropic's published docs are the authoritative
  behaviour contract.
- **Escalate before relying on unverified-provenance
  evidence.** If an investigation surfaces a behaviour
  observable only via an unverified-provenance source
  AND landing the rule depends on that observation, flag
  to the maintainer before commit. The maintainer can
  reframe the rule against published-docs-only evidence,
  or accept the unverified-provenance evidence with
  explicit disclaimer.

**Useful framing:** the search-internet discipline does
not require any specific repo or mirror. Where Anthropic
publishes documentation, that is canonical. Where the
docs don't cover something, public-community discussions
are the next-best signal. Source-level integration of any
specific third-party harness mirror is out of scope for
this discipline.

## What this discipline does NOT do

- Does NOT replace experimentation. Sometimes the right
  answer is "no one's tried this, we'll be the prior art."
  Search-first ≠ search-only.
- Does NOT excuse skipping the rule-source re-read. If the
  fix is for a wake-time discipline, re-read CLAUDE.md +
  the rule sources first; THEN search externally for prior
  art on the new fix.
- Does NOT cap research depth. If the search surfaces a
  paper / blog / repo that names the problem precisely,
  read it deeply enough to know what they tried.
- Does NOT mean "search every tick." Trigger is
  self-fixing rule landings, not every routine work step.

**Composes with:**

- `feedback_otto_247_version_currency_*` — the parent rule
  (search before asserting versions); this one extends the
  same substrate-decay reasoning from versions to rules.
- `feedback_claude_md_cadenced_reread_for_long_running_sessions_2026_04_28.md`
  — re-read rule sources THEN search external; both
  refresh substrate, but they fight different decays.
- `feedback_structural_fix_beats_process_discipline_velocity_multiplier_aaron_2026_04_28.md`
  — search-first finds structural fixes others have
  already discovered; reduces the "land a process
  discipline" reflex.
