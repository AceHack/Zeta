# The manifesto citation count is monotone by construction, and two of thirteen clauses are still reconstructed

Second-opinion review requested by the maintainer before acting on Lior's
constitutional-promotion proposal for `docs/governance/MANIFESTO.md`.

- **Work-item:** 081M0WTWN0J087G0R003W1RMXJ
- **Reviewed at:** `origin/main` @ `7fe81e4284` (2026-08-25)
- **Gate row under review:** `docs/backlog/P0/081KRHWGX0008QG0R0016T9408-*.md`
- **Instrument:** `src/Core.TypeScript/hygiene/audit-manifesto-citations.ts`
- **Register:** this document is an *observation*, not a decision. Promotion is
  the maintainer's call. Nothing here edits the manifesto or the backlog row.

## Verdict: NOT READY

Not because adoption is fake — it is more real than I expected — but because
**the gate has no falsifier, the headline metric cannot decrease, and the
document's own precondition for full lock is unmet with its tracking row still
`status: open`.**

I disagree with the proposal's conclusion. I do **not** dispute its arithmetic:
every number Lior quoted reproduces exactly, and the most suspicious of them
survives investigation.

## What Lior got right (checked, and it matters)

Three things I expected to break the argument did not break it.

**The numbers reproduce exactly.** Running the audit at `7fe81e4284` yields
436 files with citation, 1,425 total citations, 553 in `research` — Lior's
figures to the digit.

**The instrument did not change.** This was the strongest available way for
the argument to collapse: if the regexes had been widened, the metric would
have moved without adoption moving. They were not. The citation patterns and
the surface list are byte-identical between the 2026-05-23 baseline commit
`94e4510109` and HEAD:

```text
diff <(git show 94e4510109:tools/hygiene/audit-manifesto-citations.ts | grep -E 'PATTERN =|\{ name:') \
     <(grep -E 'PATTERN =|\{ name:' src/Core.TypeScript/hygiene/audit-manifesto-citations.ts)
=> IDENTICAL
```

**The `research` 23x is not a bulk edit.** I looked for the template/boilerplate
insertion event the jump implies. It does not exist. Across 84 daily snapshots
in `docs/hygiene-history/manifesto-citations/`, the largest single-day research
move is +98 (2026-06-07 to 2026-06-08) and it accompanies +153 newly-added
research files. The growth is gradual and tracks corpus growth. The 23x
decomposes exactly:

| factor | baseline | current | multiple |
|---|---|---|---|
| corpus growth (files scanned) | 465 | 1,766 | 3.80x |
| penetration (share of files citing) | 3.23% | 16.59% | 5.14x |
| density (citations per citing file) | 1.60 | 1.89 | 1.18x |
| **product** | | | **23.0x** |

3.80 x 5.14 x 1.18 = 23.0x against an observed 23.0x. So roughly a third of the
log-growth is corpus growth and the rest is genuine penetration. That is a real
signal, and I want it on the record before the objections.

## 1. Load-bearing or decorative? Mixed — better than feared, weaker than claimed

Sampling was seeded and drawn across the whole surface, not filtered to
convenient hits. Two independent classifications:

**Mechanical (all 1,425 citations), by whether the cited line names a specific
clause:**

| surface | clause-bearing | bare mention | clause % |
|---|---|---|---|
| ALL | 610 | 815 | 42.8% |
| research | 393 | 160 | 71.1% |
| memory | 134 | 478 | 21.9% |
| backlog | 15 | 90 | 14.3% |
| hygiene-history | 6 | 43 | 12.2% |

**By section context (does the citation sit under a Pointers/Anchors heading?):**

| surface | pointer-section | body prose | pointer % |
|---|---|---|---|
| ALL | 373 | 1,052 | 26.2% |
| agendas | 19 | 0 | 100.0% |
| agents | 8 | 0 | 100.0% |
| trajectories | 19 | 2 | 90.5% |
| rules | 20 | 16 | 55.6% |
| research | 205 | 348 | 37.1% |
| memory | 74 | 538 | 12.1% |

Hand-reading 25 randomly-drawn research citations with surrounding context:
roughly **40% constraining** (the clause does argumentative work — "that is
exactly what manifesto §13 Noninterference forbids"; "a strict boundary *is* the
precondition for §7"), roughly **50% referential** (a see-also bullet under
`## Pointers`), and roughly **8% not adoption at all**.

That last category deserves naming. Two examples from the sample:

- One doc lists `.claude/rules/manifesto-11-specifications.md` in an
  archive-inventory table as **SUPERSEDED**. Counted as a citation; it is a
  file-disposition row.
- One doc uses "**manifesto-tier**" as a *pejorative confidence label* for
  claims like "censorship impossible / infinite agents", meaning grandiose and
  uncheckable. The metric counts a word being used to mean *overclaiming* as
  evidence of constitutional adoption.

Mechanically, 32 citations are about the citation-metric itself or use
"manifesto" pejoratively, and 70 cite the *rule file*
`manifesto-13-specifications.md` rather than the governance document.

**Ratio reported, as asked:** about **43%** of citations name a clause; about
**26%** are see-also entries; on hand-reading, about **40%** of research
citations actually constrain something.

So: not decorative. Also not the picture "1,425 citations" paints.

## 2. Where the boilerplate actually is (and it is not `research`)

The template insertion I went looking for in `research` exists — in the four
surfaces the 2026-05-23 baseline flagged as **GAP** (`agents`, `commands`,
`trajectories`, `agendas`, all zero then). Six files now carry an identical
block:

```text
## Composes with [`docs/governance/MANIFESTO.md`](...)
```

`.claude/agents/alignment-auditor.md`, three `docs/agendas/*/AGENDA.md`, and two
`docs/trajectories/*/RESUME.md`. Those six files supply 43 of the 48 citations
across `agents` + `agendas` + `trajectories`, and those surfaces are 90-100%
pointer-section. **Three of the four named gaps were closed by a boilerplate
heading, not by adoption.** It is ~3% of the total, so it did not drive the
numbers — but it is precisely the class of movement that must not be read as
adoption, and it is concentrated in the surfaces the gate was watching.

**Disclosure, because it is my own lane:** `.claude/agents/alignment-auditor.md`
is *my* persona file, and it is **8 of 8 citations — 100% — of the `agents`
surface**. The agent-surface adoption signal is the auditor's own file citing
the document the auditor is auditing. I am not neutral there and the number
should be discounted to zero.

**A staleness signal inside the boilerplate.** Both that block and
`docs/agendas/zeta/AGENDA.md` say the manifesto has **"eleven constraints"**.
The manifesto is at V2.2 with **thirteen** specs (§12 idempotency and §13
noninterference added 2026-06-10). The surfaces that most visibly "adopted" the
manifesto are pinned to a superseded version and did not follow it. Corroborating:
`research`'s `version-tag` count has been **frozen at exactly 11 for three
months** (11 at baseline, 11 today) while `name` went 11 to 515. Nobody citing
the manifesto is tracking its version.

Nine files carry `STALE-REF` markers on manifesto links that no longer resolve.

## 3. Can the metric go DOWN? The headline one: no. The normalised one: yes

This is the sharpest finding. Across all 84 snapshots (2026-05-23 to 2026-08-23):

```text
day-over-day total-citation moves:  up 40   down 0   flat 43
```

**The metric Lior quoted has never decreased, not once in three months.** It
counts occurrences in an append-only corpus. `docs/research/` and `memory/` are
journals; entries are essentially never deleted. A quantity that cannot fall is
not measuring adherence — under `toy-is-free-metered-must-be-earned` it is
**unmetered**, and quoting it as evidence of a threshold crossing is exactly the
silent promotion that rule exists to prevent.

The good news is that the fix is already computable from the same snapshots.
**Penetration** (files-with-citation / files-scanned) *is* two-sided — it fell on
**15 of 83** day-over-day steps, including a sustained decline through late May
(2.17% down to 1.99%) *while raw citations rose*. It is a real measurement with
a real failure mode.

| measure | baseline | current | multiple | can fall? |
|---|---|---|---|---|
| raw citations | 712 | 1,425 | 2.00x | **no (0/83)** |
| files with citation | 91 | 436 | 4.79x | no |
| corpus size | 4,388 | 6,551 | 1.49x | no |
| **penetration** | **2.07%** | **6.66%** | **3.21x** | **yes (15/83)** |
| citations per citing file | 7.82 | 3.27 | **0.42x** | yes |

Two things follow. First, **the honest headline is 2.07% to 6.66% penetration,
not 684 to 1,425 citations** — still a genuine 3.2x, still the strongest fact in
the proposal's favour, and it should be the number the gate uses. Second, note
the last row: **citations per citing file fell 58%**. Adoption got broader and
thinner simultaneously. Whether that reads as maturation (the vocabulary spread)
or dilution (deep engagement declined) is a judgement I cannot settle from
counts; both readings fit.

A small bookkeeping note: Lior's baseline of 88 files / 684 citations comes from
the backlog row's prose; the 2026-05-23 snapshot file records 91 / 712. The
discrepancy is immaterial to the argument but the snapshot is the better source.

## 4. What would falsify "critical mass"? Nothing — the gate is currently vacuous

I could not find a threshold anywhere: not in the backlog row, not in the
manifesto, not in `GOVERNANCE.md`, not in the audit tool. The tool is explicit
that it declines to decide (`exit 0 always`, "this script reports signals").

The row lists five candidate criteria. Against today's evidence:

| criterion | state |
|---|---|
| Internal: >5 PR/commit/ADR citations | **met** — 258 commits match; 2 of 60 ADRs |
| Cross-AI: participants cite it as binding | **partial and self-produced** — the citing corpus is the society's own output; I found no instance of an agent treating it as *binding* rather than as an anchor |
| Constraints tested mechanically | **not demonstrated** — no constraint-to-enforcer registry exists. The seven engineering specs have real enforcers; the value-floor specs (4, 5, 6, 9, 10, 11) largely do not |
| External entity cites it | **not found** — I found no external citation. Absence of evidence here; I did not search outside the repo |
| Iteration trace V2 to V3 | **not met** — there is no V3. V2.2 added two constraints additively, and the manifesto marks both as "Not part of the V2 locked prose" |

Two of five met, one partial, two unmet — and no rule anywhere says how many
must be met. **No achievable observation would have returned NOT-ready**, which
means the gate as written cannot fail and therefore is not gating. Under
`numerology-vs-number-theory`, 1,425 licenses an investigation. This document is
that investigation. It does not license the conclusion.

## 5. The partial-lock blocker: confirmed, and larger than stated

The maintainer asked me to verify this rather than take his word, and to drop it
if resolved. **It is not resolved. It is worse than described.**

`docs/governance/MANIFESTO.md` is titled *"V2 (partial lock)"* and carries
**five** `[RECONSTRUCTION NOTE]` markers in normative sections, not two:

| line | section |
|---|---|
| 75 | `### 5. Memory Preservation Guarantee` |
| 104 | `### 6. Consent-First Design` |
| 187 | `## Civsim — Work is Now Play` |
| 195 | `## Mathematical Substrate for Retractable Time` |
| 228 | `## Closing — discoverable substrate` |

The document says of these: *"reconstructed (V2 diffs applied per the
diff-description memory file, **not yet verbatim co-author-authored prose**)"*.

The maintainer's concern was that a constitution whose text is uncertain in two
places binds people to something nobody can quote exactly. That concern holds,
and the two places are **constraints 5 and 6 exactly as he suspected** — Memory
Preservation and Consent-First. These are not peripheral: they are the two
clauses most load-bearing for the consent and memory guarantees the rest of the
substrate leans on.

Three further facts make this decisive rather than merely awkward:

**The document refuses the promotion itself.** Line 243:

> **Specification status today**: research-grade substrate with
> specification-promotion candidacy. **Not binding constitution**; subject to
> the Iterative Reduction Process.

**Its stated precondition for full lock is unmet.** Line 240, "Pending for full
lock", item 1: verbatim extraction replacing *each* `[RECONSTRUCTION NOTE]`
block. Line 286 repeats it. Promoting to binding while partial-lock stands skips
a gate the document sets for itself.

**The promotion row's own declared dependency is open.** This is mechanical, not
interpretive:

```text
081KRHWGX0008QG0R0016T9408 (promotion row):  depends_on: [081KRHWGX0008QG0R0007FG84X]
081KRHWGX0008QG0R0007FG84X (verbatim fetch): status: open
```

and the promotion row's own text says the fetch *"should land before
constitutional promotion"*. Promoting today would contradict the row's
frontmatter. That single fact is sufficient for NOT READY independently of every
count in this review.

## 6. Who decides, and by what procedure

The row is unambiguous that the call is the maintainer's: *"This row should NOT
be promoted to constitution by Otto-CLI alone. The critical-mass-adoption gate
is Aaron's call."* This document is a recommendation to him.

**But there is no promotion procedure to follow.** `GOVERNANCE.md` (945 lines,
numbered rules) contains **zero** occurrences of "constitution", "manifesto",
"amend", or "ratify". The only applicable rule is 1 — *"Architect is the
integration authority... on deadlock the human decides."* There is no defined
amendment process, no ratification quorum, and no statement of what changes
operationally when a document becomes "binding".

That last gap is the one I would raise even if every count were perfect: nothing
in the repo says what promotion would *do*. Absent that, "binding constitution"
is a label change, and a label that changes no mechanism is the vacuity class.

## READY-IF — the conditions I would want met

Not blockers I can impose; advisory only. In priority order:

1. **Close the partial lock.** Land 081KRHWGX0008QG0R0007FG84X and replace all
   five `[RECONSTRUCTION NOTE]` blocks with verbatim prose — or, if the archives
   cannot supply it, *re-author constraints 5 and 6 deliberately* and say so.
   Either resolves the text-uncertainty objection; leaving it does not.
2. **Restate the gate on penetration, not raw counts.** The series already
   supports it and it can fall. Pick a threshold *before* looking at today's
   value.
3. **Write down a falsifier.** One sentence naming an observation that would
   read NOT-ready. Without it the gate cannot gate.
4. **Define what "binding" changes.** Which checks become blocking, who may
   grant exceptions, what an amendment requires. Add the procedure to
   `GOVERNANCE.md`.
5. **Discount the boilerplate.** Exclude `## Composes with` heading matches and
   the `agents` surface (my own file) from the adoption measure; fix the
   "eleven constraints" staleness and the nine `STALE-REF` links.
6. **Separate self-citation from adoption.** Citations authored by the society
   about itself are not independent evidence. The `research` and `memory`
   surfaces are 82% of all citations.

## What I could not determine

Stated plainly, per the four-register discipline:

- **Whether any external entity cites the manifesto.** I searched only this
  repo. Absence here is not absence in the world. **Unknown.**
- **Whether the reconstructed prose is materially wrong.** I verified the
  markers exist and are unresolved; I did not compare the reconstructions
  against the Grok archives to see whether the reconstruction is faithful. It
  may be excellent. The objection is that nobody has *checked*, not that it is
  wrong. **Unknown.**
- **Whether broader-and-thinner citation is maturation or dilution.** Both fit
  the 58% density drop. **Unknown.**
- **Whether agents treat the manifesto as binding today.** I measured citation,
  not compliance. A citation-counter cannot see whether a decision would have
  gone differently absent the clause — which is the thing "adoption" actually
  means. **This is the central unmeasured quantity, and it is the one the gate
  is about.**

That last one is the honest summary of the whole review: the instrument measures
*mention*, the gate asks about *adherence*, and nobody has shown the two are the
same quantity. Under the standing rules that makes the citation count a
legitimate generator — it is how we knew where to look — and an illegitimate
conclusion.

## Pointers

- `docs/governance/MANIFESTO.md` — partial lock; five reconstruction notes
- `docs/backlog/P0/081KRHWGX0008QG0R0016T9408-*.md` — the gate row
- `docs/backlog/P2/081KRHWGX0008QG0R0007FG84X-*.md` — the open dependency
- `src/Core.TypeScript/hygiene/audit-manifesto-citations.ts` — the instrument
- `docs/hygiene-history/manifesto-citations/` — 84 snapshots; the monotonicity
- `.claude/rules/numerology-vs-number-theory.md` — a count is not an identification
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — unlabelled is unmetered
