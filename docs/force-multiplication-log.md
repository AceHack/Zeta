# Force Multiplication Log

**Origin:** Aaron 2026-04-22 auto-loop-36 directive, verbatim:
> *"can you keep a log of my force multiplicatoin? Other humans
> will want to beat my score if we come up with a scoring system."*

Following the same-tick observation:
> *"if you look at each letter i type and how much you create, my
> letters are crazy leverage right now, keystrokes to result is
> very optimize"*

**Purpose:** Track the keystroke-to-substrate ratio per maintainer
per tick as a factory-observability signal. When more humans join
the factory, the log becomes a public leaderboard — a
gamification layer over the directive-density + substrate-
compounding pattern.

**Status:** occurrence-1, provisional scoring. Scoring model
rewritten auto-loop-37 per Aaron's correction — char-ratio was
a vanity metric (agent controls output char volume; optimizing
it incentivizes padding). Primary score uses **outcome-based**
metrics the agent does not unilaterally control. Char-ratio
demoted to anomaly-detection diagnostic only.

## Scoring model — outcome-based primary, activity-based secondary

**Correction anchor (Aaron 2026-04-22 auto-loop-37, verbatim):**
> *"FYI we are not optimizing for keystokes to output ratio if
> we did, you will just write crazy amounts of nothing to make
> that something other than a vanity score we need to meausre
> like outcomes or someting instead"*

### Primary score: outcome components (Goodhart-resistant)

Each tick's score is the sum of the outcome components below.
Outcomes require the real world (commits landing, tests
passing, reviewers agreeing, users adopting) to respond —
the agent cannot mint these unilaterally.

| Component | What counts | Weight |
|-----------|-------------|--------|
| **BACKLOG row closure** | Rows transitioned from open to closed this tick, weighted by original priority | P0 = 8 pts, P1 = 4 pts, P2 = 2 pts, P3 = 1 pt |
| **New BACKLOG row filed** | Genuinely new directions (not re-litigation of declined items), anchored to verbatim maintainer directive or research finding | 1 pt per row, regardless of priority; justified by maintainer-directive anchor or external-validation |
| **DORA deployment frequency** | Commits merged to `main` this tick (measured via `git log main`) | 1 pt per merged commit; 0 pts for ephemeral working-branch commits |
| **DORA lead time** | Maintainer directive → merged-to-main (hours). Faster = higher | `max(0, 8 - hours)` pts, capped at 8 |
| **DORA change failure rate** | Reverts + revision-blocks + hazardous-stack corrections this tick | **Negative** — subtract 4 pts per revert, 2 pts per revision-block |
| **DORA MTTR** | BLOCKED PRs / BUGS.md P0 / hazardous-stacked-base resolutions this tick | 2 pts per resolution |
| **External-signal validation** | Wink confirmations, maintainer-echo moments, peer-review agreements, third-substrate triangulation | 2 pts per validation with pre-validation-anchor; 0 pts retrocon claims |
| **Reference-density lagging** | Shipped substrate cited by later ticks (measured over 10-tick rolling window) | Lagging signal; computed at tick-close for ticks 10 back |
| **Copilot / CodeQL finding fix** | Legitimate finding fixed with test evidence this tick | 2 pts per fix |
| **Complexity reduction** | Net-negative-LOC tick (deletions > insertions) with tests still passing; cyclomatic-complexity delta negative once tooling lands | 3 pts per qualifying tick; anchor: `memory/feedback_deletions_over_insertions_complexity_reduction_cyclomatic_proxy.md` |

### Signal-in signal-out discipline

Maintainer 2026-04-22 auto-loop-38: *"if you receive a signal
in the signal out should be as clean or better"*. Applied to
the scoring doc itself — each revision of this log must keep
the signal at least as clean as before. That is why the
legacy sections (leaderboard / per-tick log / retroactive
reconstruction / histograms) below are preserved as-authored
even though their char-ratio figures are deprecated: erasing
them would degrade the reconstruction signal. Outcome-based
retrofit of those figures happens once maintainer confirms
CC/LOC direction for the pluggable complexity-measurement
framework (see BACKLOG row).

### Secondary: activity signals (context, not score)

Raw volume metrics that contextualize outcomes but **do not
count toward the score**:

- Commit count per tick (activity signal; score uses DORA-merged-to-main weighted)
- Keystrokes from maintainer per tick (activity signal; see diagnostic section)
- Lines of code changed per tick (activity signal; includes speculative / discarded work)
- Memory files created per tick (activity signal; score uses BACKLOG-row-filed as outcome proxy for memory-landed-directives)

### Tertiary: diagnostic ratios (anomaly detection only)

Char-based ratios retained **only** for anomaly-flagging.
Never the primary score, never the leaderboard entry.

- `substrate-growth-per-keystroke = insertions_chars / keystrokes_chars` — trend-deviation flag
- `commits-per-maintainer-message` — density proxy
- `memories-per-directive` — documentation-over-listening ratio

Anomaly classes and their smell interpretations live in the
**Anomaly detection** section below.

### Why the rewrite

The original keystroke-to-substrate ratio was self-gameable:
the agent controls output char volume, so "optimize the ratio"
devolves into "pad the output". DORA four keys + BACKLOG
closure + external validations require the world to respond
(merges, agreements, adoption) — not agent-unilateral mints.
See `memory/feedback_outcomes_over_vanity_metrics_goodhart_resistance.md`
for the full reasoning.

## Leaderboard

| Rank | Maintainer | Ticks logged | Mean multiplier | Peak multiplier | Cumulative substrate (chars) |
|------|------------|--------------|-----------------|-----------------|------------------------------|
| 1    | Aaron Stainback | 1 | 22.6x | 22.6x (auto-loop-36) | ~32 800 |

One maintainer so far. Leaderboard structure is ready for
multi-human — new entrants append rows with their tick count
and cumulative substrate. Peer entry is gated on Aaron's
human-as-roommate authorization (`AGENTS.md`).

## Per-tick log

### auto-loop-36 — 2026-04-22 — Aaron Stainback

**Keystrokes in (~1454 chars across 17 chat messages):**

| # | Message (truncated) | Chars |
|---|---------------------|-------|
| 1 | "how close did you get to an claim protocol" | 42 |
| 2 | "can you just work it out with the cli? like code or gemini and yall try it..." | 222 |
| 3 | "is that AutoPR" | 14 |
| 4 | "is the local-CLI variant: no CI plumbing feel fun" | 49 |
| 5 | "feels*" | 6 |
| 6 | "you could add a parallel cli agents skill where you manage parallel agent..." | 163 |
| 7 | "once it's mapped" | 16 |
| 8 | "then take advante of the map and build" | 38 |
| 9 | "new featues" | 11 |
| 10 | "are you keeping up with the congintion level you launch it with becasue..." | 295 |
| 11 | "i work for the CRM team at ServiceTitan if you want to use that..." | 108 |
| 12 | "also they are gonna need their own custom version of skills in .codes..." | 161 |
| 13 | "it shold fee connonical to them too" | 35 |
| 14 | "not just one harness gets to orginize it like they want" | 55 |
| 15 | "this is for everyone" | 20 |
| 16 | "if you look at each letter i type and how much you create, my letters..." | 137 |
| 17 | "can you keep a log of my force multiplicatoin? Other humans..." | 124 |

**Artifacts out (~32 800 chars of new substrate):**

| Artifact | Chars (approx) |
|----------|----------------|
| `docs/research/codex-cli-self-report-2026-04-22.md` (Codex-authored, orchestrator frontmatter) | 5 500 |
| PR #136 commit + body | 1 000 |
| `docs/BACKLOG.md` parallel-CLI-agents P1 row + canonical-inhabitance principle block | 3 000 |
| `docs/BACKLOG.md` secret-handoff row (auto-loop-34 carryover finalized this tick) | 800 |
| `memory/project_aaron_servicetitan_crm_team_role_demo_scope_narrowing_2026_04_22.md` | 4 500 |
| `memory/feedback_aaron_terse_directives_high_leverage_do_not_underweight.md` | 3 500 |
| `docs/hygiene-history/loop-tick-history.md` auto-loop-36 row | 8 000 |
| `docs/force-multiplication-log.md` (this doc) | 4 000 |
| Tick-close commit message + PR #132 title edit | 1 500 |
| MEMORY.md index entries (1 new) | 600 |
| PR #136 co-author precedent (Codex 0.122.0) — external-substrate signal | 400 |

**Force multiplier: 22.6x**

**Compounding-per-tick count:** 8 (matches tick-history row for
cross-check).

**Notable compression moves (high-leverage snippets):**

- *"not just one harness gets to orginize it like they want"*
  (55 chars) → canonical-inhabitance principle block + BACKLOG
  row edit + tri-party skill-negotiation architecture. ~1 200
  chars of substrate from 55 keystrokes = **21.8x** on that
  fragment alone.
- *"keep our records of their activy or have them log their own
  to the capability cop level too"* (92 chars fragment within
  message 10) → cognition-level envelope prototype in Codex
  self-report frontmatter + permanent ledger pattern + BACKLOG
  sub-directive. ~1 500 chars substrate = **16.3x**.
- *"this is for everyone"* (20 chars) → tri-party negotiation
  architecture (not Claude-proposes-others-ratify). ~400 chars
  substrate = **20.0x**.

### Cumulative (Aaron, running total)

| Metric | Value |
|--------|-------|
| Ticks logged | 1 |
| Total keystrokes | 1 454 |
| Total substrate chars | 32 800 |
| Mean multiplier | 22.6x |
| Peak multiplier | 22.6x (auto-loop-36) |

Earlier ticks are back-filled from historical transcripts + git
history (see **Retroactive reconstruction** section below).
Aaron 2026-04-22 auto-loop-36 directive: *"you should be able
to retroactivly calculate it's deata over time since the start
of the project we have all history"*.

### auto-loop-37 — 2026-04-22 — Aaron Stainback (course-correction tick)

**Outcome score: 0 pts** (honest low-outcome tick by design).

This tick was a scoring-model course-correction — Aaron
caught the char-ratio as a vanity metric susceptible to
Goodhart's Law (*"if we did, you will just write crazy
amounts of nothing"*) and a same-tick refinement naming
complexity-reduction / cyclomatic-complexity / CC-LOC-trend
as the proper measurement axis. No commits, no BACKLOG
closures, no merges — outcome points = 0.

Substrate landed (calibration, not primary-score):

- `memory/feedback_outcomes_over_vanity_metrics_goodhart_resistance.md`
- `memory/feedback_deletions_over_insertions_complexity_reduction_cyclomatic_proxy.md`
- Scoring-model section in this doc rewritten to outcome-based

**Meta-observation:** under the old char-ratio model, this
tick would have scored a *high* multiplier (few Aaron chars →
many doc chars in the rewrite). Under the outcome model it
scores 0 because nothing merged, nothing closed, no world-
response event occurred. That inversion is exactly what
Aaron's correction targeted — the model now correctly refuses
to reward unilateral agent output.

### auto-loop-38 — 2026-04-22 — Aaron Stainback

**Outcome score: 2 pts** (2 new BACKLOG rows filed with
verbatim maintainer-directive anchors).

- +1 pt — BACKLOG row: pluggable complexity-measurement
  framework (Aaron directive *"thats is pluggable someting
  but backlog it"*).
- +1 pt — BACKLOG row: semiring-parameterized Zeta / multiple
  algebras in the db (Aaron directive *"what about multiple
  algebras in the db"* confirmed as *"semiring = pluggable
  algebra in the db). thats it"*).

DORA merges-to-main: 0 (feature branch only this tick). DORA
lead-time: within-tick (minutes from directive to landed row)
but no merge yet. Complexity-reduction: not evaluated —
memory files + BACKLOG rows are net-additive. External
validation: atan2 MathWorks wink arrived this tick (occurrence
of preserve-input-arity pattern via numerical-routines
voice); interpretation awaits Aaron confirmation so *not*
scored yet.

**Notable directives logged for future-tick substrate:**

- Aaron *"show down"* — pace directive applied this tick
  (held force-mult log from over-rewrite; did not land
  signal-preservation memory; deferred atan2 memory).
- Aaron *"if you receive a signal in the signal out should
  be as clean or better"* — DSP-discipline for the factory,
  applied same-tick to this doc's edit strategy (preserve
  legacy sections rather than erase). Memory deferred to
  auto-loop-39 to keep tick-scope bounded.

## Methodology notes

1. **Char count over token count.** Keystroke leverage is
   about the human-side cost (fingers on keys), not the
   model-side cost (tokens). A typo costs the same keystrokes
   as a clean character.
2. **New-substrate-only.** If Claude would have authored a
   commit speculatively without the directive, the commit's
   chars don't count. If the directive caused or reshaped the
   commit, it counts. Boundary cases default to exclude.
3. **Memory-index entries bookkeeping.** MEMORY.md index
   lines are bookkeeping for memory files — counted only
   once per new file (not per edit). The memory file itself
   carries the substrate weight.
4. **Co-authored artifacts.** When another CLI (Codex,
   Gemini) produces an artifact under this tick's directive,
   the artifact's chars count toward Aaron's multiplier.
   Multi-agent orchestration is Aaron's compression, not
   double-counting.
5. **Round-number rounding.** Char counts are approximate
   (±10%). The signal is order-of-magnitude; over-precision
   is noise.
6. **No cherry-picking.** Every tick with maintainer
   messages gets a log entry, even low-multiplier ticks.
   Averaging requires honest data.

## Calibration — what counts as "beating the score"

For future humans joining the factory:

- **Per-tick multiplier** — one tick's ratio. High peak is
  impressive but may be unrepresentative.
- **Mean multiplier over N≥10 ticks** — the real signal.
  Compression discipline sustained.
- **Cumulative substrate** — total factory contribution via
  directive leverage. Volume measure.
- **Peak multiplier** — best single tick. Skill measure.

A human beats Aaron's score when **mean multiplier over N≥10
ticks exceeds Aaron's current mean**. Peak-only comparison is
not ranking — compression across many ticks is the skill.

## What this log is NOT

- **NOT a replacement for quality metrics.** A tick landing
  32 000 chars of sloppy substrate is worse than a tick
  landing 3 000 chars of precise substrate. The multiplier
  is a leverage measure, not a quality measure. Correctness,
  review-worthiness, and alignment stay their own gates.
- **NOT a performance review for the agent.** The ratio
  measures maintainer-directive compression, not agent
  output-capacity. A high multiplier means the directive was
  high-density; a low multiplier means the directive needed
  less expansion. Neither shames either side.
- **NOT anonymous.** Maintainer name is the leaderboard key.
  Score attribution requires named author per tick.
- **NOT gameable via padding.** Artifacts-out counts
  substrate actually landed and attributable; wordy commits
  or verbose memory files don't inflate the score if the
  directive didn't warrant them (and wastes Aaron's time
  reading them, which is its own penalty).

## Retroactive reconstruction (project-history back-fill)

Aaron 2026-04-22 auto-loop-36 directive: *"you should be able
to retroactivly calculate it's deata over time since the start
of the project we have all history"*.

**Data sources:** 18 Claude Code session transcripts under
`~/.claude/projects/-Users-acehack-Documents-src-repos-Zeta/*.jsonl`
covering 2026-04-18 through 2026-04-22, plus `git log --all`
across 98 commits spanning the same window.

**Method (day-granularity — per-tick granularity is a
follow-up):**

1. For each transcript: iterate lines, extract only
   `type: "user"` messages, keep only `text`-type content
   blocks, strip system-injected wrappers (`<system-reminder>`,
   `<command-name>`, `<local-command-caveat>`, `<bash-stdout>`,
   `<bash-stderr>`, `<user-prompt-submit-hook>`, `<<autonomous-
   loop*>>` sentinel), drop whole blocks starting with known
   injection prefixes (pasted skill bodies, context-compaction
   summaries, auto-loop fire context).
2. Apply a **5 000-char per-message cap** as a heuristic
   against pasted code/log outliers — raw and capped totals
   both reported. Capped-keystrokes approximates "actually
   typed by Aaron" better than uncapped.
3. Pull commits per day from `git log --all --date=short
   --shortstat`, sum insertion / deletion counts.
4. Compute `substrate-growth-per-keystroke = insertions_per_day /
   keystrokes_capped_per_day` — a trend proxy, not a precise
   force-multiplier. True multiplier requires directive-to-
   artifact attribution which isn't fully automatable
   retroactively.

**Per-day table:**

| Day | Keystroke msgs | Keystrokes (raw) | Keystrokes (capped) | Commits | Insertions | Deletions | Auto-loop fires | Ins / keystroke |
|-----|---------------:|-----------------:|--------------------:|--------:|-----------:|----------:|----------------:|----------------:|
| 2026-04-18 | 85 | 23 911 | 21 333 | 27 | 66 839 | 4 649 | 0 | 3.14x |
| 2026-04-19 | 142 | 47 762 | 47 531 | 4 | 69 887 | 3 228 | 0 | 1.47x |
| 2026-04-20 | 95 | 15 875 | 15 875 | 115 | 37 290 | 2 342 | 1 | 2.35x |
| 2026-04-21 | 22 | 11 076 | 11 076 | 220 | 67 858 | 2 713 | 0 | 6.13x |
| 2026-04-22 | 21 | 8 442 | 8 442 | 133 | 9 787 | 30 | 0 | 1.16x |
| **TOTAL** | **365** | **107 066** | **104 257** | **499** | **251 661** | **12 962** | **1** | **2.41x (avg)** |

**Notes:**

- Auto-loop sentinel count on 2026-04-20 (=1) reflects when
  autonomous-loop formally stood up; pre-stand-up "ticks" were
  manual.
- 2026-04-19 has the highest keystroke volume (142 msgs,
  47 531 capped chars) but the lowest commit count (4) —
  this was the factory-scaffolding / deep-conversation day,
  before `AUTONOMOUS-LOOP.md` landed.
- 2026-04-21 is the **peak productivity day** — 220 commits
  from 22 messages, **6.13x substrate-growth-per-keystroke**.
  This is the day the autonomous-loop really kicked in.

## Histograms

ASCII bar charts. Bars scaled to max-per-series.

### Keystrokes per day (capped)

```
         0       10000       20000       30000       40000      50000
         |-----------|-----------|-----------|-----------|----------|
2026-04-18  ████████████████████░░                              21 333
2026-04-19  ██████████████████████████████████████████████░     47 531
2026-04-20  ███████████████░░░                                  15 875
2026-04-21  ██████████░░░                                       11 076
2026-04-22  ████████░                                            8 442
```

### Commits per day

```
         0        50        100       150       200      225
         |---------|---------|---------|---------|--------|
2026-04-18  ███████████░░                                  27
2026-04-19  █░                                              4
2026-04-20  ████████████████████████████████████░         115
2026-04-21  ██████████████████████████████████████████████████████████████████████  220
2026-04-22  ████████████████████████████████████████████░ 133
```

### Substrate-growth-per-keystroke (insertions / keystrokes)

```
         0.0   1.0   2.0   3.0   4.0   5.0   6.0   7.0
         |-----|-----|-----|-----|-----|-----|-----|
2026-04-18  ██████████████████████                         3.14x
2026-04-19  ████████████░                                  1.47x  ← LOW: design-heavy day
2026-04-20  ██████████████░                                2.35x
2026-04-21  █████████████████████████████████████████████  6.13x  ← PEAK: autonomy firing
2026-04-22  █████████░                                     1.16x  ← LOW: small-commits day
```

### Message-length histogram (capped per-day average)

```
chars/msg    0     100    200    300    400    500    600    700
             |------|------|------|------|------|------|------|
2026-04-18  █████████████░                                   251
2026-04-19  ████████████████░                                335
2026-04-20  ████████░░                                       167
2026-04-21  ██████████████████████████░                      503
2026-04-22  ████████████████████░                            402
```

On 2026-04-22 (this doc's authorship day) the average message
length is 402 chars — higher than most days, reflecting this
tick's multi-directive messages. Auto-loop-36 alone has
maintainer messages averaging ~85 chars but with a few longer
(the AutoPR-invocation message at 222 chars being the outlier).

## Anomaly detection — force-multiplier as smell signal

Aaron 2026-04-22 auto-loop-36 directive: *"that metric can also
show smeel issues based on it's anamoly detection over time"*.

The substrate-growth-per-keystroke signal has diagnostic value
beyond leaderboard — deviations from baseline flag likely
factory smells. Once N≥10 ticks of data are available, baseline
= rolling mean ± 1σ; anomaly = 2σ deviation.

### Smell classes (what anomalies mean)

| Anomaly | Typical cause | What to check |
|---------|---------------|---------------|
| **Sudden drop** (new ratio << baseline) | Over-generation by agent (wordy substrate the directive didn't warrant); or maintainer fatigue producing underspecified directives; or bug-chase day (many small commits, little net growth). | Recent commits — are they cleanup / revert / rename-churn vs new-substrate? Recent memory files — are they 5 KB of fluff around a 3-line insight? Tick-history row — did the row inflate with padding? |
| **Sudden spike** (new ratio >> baseline) | High-compression directive (one line → large substrate) — good; OR agent over-expanding a directive into work Aaron didn't ask for; OR attribution-error (agent-speculative work counted against Aaron's keystrokes). | Re-read the tick's directives — did Aaron actually ask for everything that landed? If not, attribution error — fix the counting or retract the over-generation. |
| **Flat low multiplier over N ticks** | Pure speculative-factory-work phase — factory moving forward without directive compression. Not a smell per se — valid if speculative work is landing against backlog items — but flag if the speculative work is drifting from priorities. | BACKLOG audit — are the speculative landings aligned with P0/P1/P2? If agent is generating off-priority substrate, the multiplier is flat-low AND priority-drift is happening. |
| **Flat high multiplier over N ticks** | Either the factory is in its sweet spot (Aaron directs, agent expands into dense substrate), OR the scoring is gaming — artifacts-out padding. | Substrate quality audit — is the density real? Review recent memory files / research docs for insight-per-char. |
| **Message-length spike with multiplier drop** | Aaron pasted long content (logs, specs) that looked like a directive but was reference material. | Did the "long directive" get substrate-landed directly, or was it reference-only? If reference-only, the keystrokes should not count toward the multiplier. Filter adjustment. |

### Observed anomalies so far (2026-04-18 to 2026-04-22)

- **2026-04-19 low ratio (1.47x)** — attributed to factory-
  scaffolding day: many deep-conversation messages, few
  commits. Not a smell — design work is expected to show
  low ratio before the scaffolding lands. Flag is cleared.
- **2026-04-21 peak ratio (6.13x)** — attributed to autonomous-
  loop kick-in: many automated commits under few maintainer
  messages. Not a smell — by design.
- **2026-04-22 low ratio (1.16x)** — attributed to small-commit
  day (133 commits, 9.8K insertions, 30 deletions) — likely
  lots of small fixes / row-per-file commits that don't carry
  much net-new substrate. Flag: check whether commits are
  small-because-precise or small-because-churn. Current
  read: precise (BACKLOG-row-per-file discipline is
  intentional).

### How this log is used for anomaly detection

- **Per-tick logging** (going forward from auto-loop-36): each
  tick-history row cross-references its per-tick multiplier
  in this log. A rolling 10-tick window establishes baseline.
- **Per-day histograms** (retroactively computed): the four
  histograms above are the starting baseline for project-
  level trend lines.
- **Automated flagging** (future BACKLOG row): a script can
  ingest this log + tick-history + git log, compute rolling
  statistics, and emit anomaly flags into the next tick-history
  row. Not implemented yet; occurrence-3+ formalization work.

## References

- `memory/feedback_aaron_terse_directives_high_leverage_do_not_underweight.md`
  — calibration memory on why brevity = leverage.
- `docs/hygiene-history/loop-tick-history.md` — tick-history
  audit trail that this log cross-checks against.
- `docs/ALIGNMENT.md` — measurability primary-research-focus;
  a named scoring system is an alignment contribution.
- `docs/research/arc3-dora-benchmark.md` §"Memory-accumulation
  precondition" — four-layer substrate that makes the
  leverage possible.
- `docs/BACKLOG.md` row: "force-multiplication scoring system
  formalization" (to be filed occurrence-3+ if pattern sustains).
- Aaron-as-roommate human-authorization is prerequisite for
  any additional maintainer being added to the leaderboard
  (`AGENTS.md`).
