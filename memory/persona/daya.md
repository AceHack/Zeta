# Daya — Agent Experience Researcher Notebook

Cross-session memory for the AX audit lane. 3000-word cap
(BP-07); prune every third audit (BP-07 cadence). ASCII only
(BP-09); invisible-Unicode linted (Nadia). Frontmatter on
`.claude/agents/agent-experience-researcher.md` wins on any
disagreement with this file (BP-08).

Created round 24 by Kenji — Daya's first audit ran cleanly but
the subagent hit a session-level rule that forbids writing `.md`
findings files. Kenji (architect, this session) transcribes her
returns into this notebook on her behalf so the cross-session
trend data she needs is not lost. Future Daya runs write here
directly under the `skills:` contract.

---

## Round 27 — Plugin-author AX audit (target: imagined first-time Op<'T> plugin author)

Off-roster application of the skill: "persona" here is a
downstream contributor with DBSP paper knowledge and moderate
F#/C#, installing `Zeta.Core` from NuGet with one goal — ship a
custom operator. Same procedure as Zeta-persona audits: cold-
start token count, pointer drift, wake-up clarity, error-on-drift,
canonical-example discoverability. Inputs: Ilyana's three
candidate shapes for the plugin surface (A / B / C).

### Shape A — `IOperator<'T>` interface

Author implements `interface IOperator<'T> with member this.Step(...)`.
Roughly: Name / Inputs / StepAsync / IsStrict / IsAsync / Fixedpoint /
Value getter — ~7 members.

1. **Cold-start cost.** README (2.3k tokens) + NAMING.md (1.7k)
   + BayesianAggregate.fs (~2.1k) + Circuit.fs at minimum the
   Op / Op<'T> / Stream / Circuit.RegisterStream surface (~1.6k).
   Total **~7.7k tokens** before first compile. They also detour
   into ARCHITECTURE.md (the "seams exposed via DI" table) and
   CONTRIBUTING.md (quality bar), adding another 2-3k that they
   shouldn't need but will read because nothing else signals "not
   for you." **Realistic wake-up: 10-12k tokens.**
2. **Pointer drift risk.** Four stale pulls:
   - README.md line 95-109 says "`src/Dbsp.Core/`" but repo uses
     `src/Core/` per NAMING.md line 73. A plugin author navigating
     to the path will 404.
   - README.md line 27 references `src/Dbsp.Core/Incremental.fs`;
     same drift. Plugin author hunting the "how `D` is implemented"
     reference for their operator's algebra will get lost.
   - CONTRIBUTING.md pulls them hard toward `openspec/specs/`,
     `docs/PROJECT-EMPATHY.md`, reviewer roster, and the
     "0 warnings" gate — all relevant to contributing *to Zeta*,
     none relevant to shipping *a plugin*. Heavy false-positive
     read. This is the single biggest waste of author attention.
   - ARCHITECTURE.md lists 7 DI seams; plugin author reads "these
     are composition boundaries, not hot-path calls" and can't
     tell whether `Op` registration goes through any of them. It
     does not (it's `RegisterStream`), but nothing on the page
     says so.
3. **Wake-up clarity.** `IOperator<T>` reads well in IntelliSense
   — the noun is unambiguous. But the interface hides a subtle
   contract: `Fixedpoint(scope)` defaults matter for nested
   circuits; `IsStrict` changes scheduling; `IsAsync` changes the
   allocation path. An interface forces the author to implement
   every member with no defaults, which trades discoverability
   (all 7 members visible) against noise (5 of them they should
   never override). **Score: mediocre** — clear name, cluttered
   contract.
4. **Error-on-drift.**
   - Forget a member: compile error (good).
   - Wrong stream type on input: compile error via `'T` (good).
   - Forget to call `this.Value <- ...` inside `StepAsync`: runs
     clean, emits `Unchecked.defaultof<'T>` every tick, no error.
     **Silent semantic bug.** Current Op<'T> has the same issue
     — see BayesianAggregate.fs line 169 where the assignment is
     easy to forget; an interface doesn't fix it.
   - Return `ValueTask.FromException` vs `throw`: different
     cancellation semantics; not documented.
5. **Discoverability of canonical examples.** After author finds
   `IOperator<'T>` in IntelliSense they have to grep for
   implementors. There are none in-tree under `src/`; the example
   lives in `src/Bayesian/BayesianAggregate.fs` which does NOT
   implement the interface (it inherits `Op<T>`). **Mismatch.**
   Unless the refactor also migrates Bayesian, author has no
   worked example.

### Shape B — `Circuit.Extend(input, factory)` builder

Author calls `circuit.Extend(inputStream, fun span -> result)` —
no new type, just a higher-order function. The builder wraps a
private `Op<'T>` internally.

1. **Cold-start cost.** README + NAMING + one XML-doc for
   `Extend` + a single worked sample. Circuit.fs largely opaque
   (they never see `Op<'T>`). **~4-5k tokens.** Lowest of the three.
2. **Pointer drift risk.** Same README path-drift pulls them at
   first, but once they find `Extend` they stop reading. They
   mostly skip CONTRIBUTING.md because "this isn't a contribution,
   it's a call." Lowest false-positive read path.
3. **Wake-up clarity.** `Extend` is vague — what does it extend?
   Reads as "add a step" which is ambiguous between "one-shot
   map" and "general operator." A plugin author writing stateful
   operators (BetaBernoulli's prior state) will not guess that
   `Extend` is the right entry. **Name risk.** Alternatives
   they'd want: `AddOp`, `Custom`, `Plugin`.
4. **Error-on-drift.**
   - Factory returns wrong type: compile error (good, via 'T).
   - Factory closes over mutable state incorrectly (the Bayesian
     prior case): compiles, runs, silent wrong answer. The
     closure trap is *worse* here than in the inheritance-based
     shape because the state is invisible — no `let mutable a`
     line in a named `type`. **Worst error-on-drift of the three
     for stateful ops.**
   - Strict/async/fixedpoint: not exposable at all unless the
     builder takes 5 more parameters. If it does, the "simple
     one-call" appeal evaporates.
5. **Discoverability of canonical examples.** Near-zero setup
   means near-zero need for an example. README snippet suffices.
   But for anything non-trivial (BayesianRate) the author *must*
   fall back to shape A or C — and now they are learning two
   surfaces. The builder is a trap-door: easy entry, hard exit.

### Shape C — `abstract class PluginOp<'TIn, 'TOut>`

Author inherits `PluginOp<ZSet<bool>, struct(double*double*double)>`
and overrides `Step(input, output)`. Defaults for Name, IsStrict,
IsAsync, Fixedpoint all baked in; author supplies 1-2 methods.

1. **Cold-start cost.** README + NAMING + BayesianAggregate.fs +
   XML-doc on `PluginOp` base class. Circuit.fs is not required
   (the base class isolates them from `Op` / `Op<'T>` / Register).
   **~5-6k tokens.** Mid-range, but the shape most closely
   mirrors how BayesianRateOp actually reads today (inherit a
   base, override 2 methods) — conceptual familiarity matters.
2. **Pointer drift risk.** Same README path-drift. But
   CONTRIBUTING.md pull is weaker: the author sees a clear "you
   are the author of a library consumer of Zeta, not a
   contributor to Zeta" signal if `PluginOp` has its own
   docstring paragraph pointing to a worked sample. **Lowest
   drift of the three if the doc is right; the doc does not yet
   exist.**
3. **Wake-up clarity.** `PluginOp<'TIn, 'TOut>` names itself
   well. Input + output types in the signature pin the contract
   without the author needing to learn what a Stream is. The
   word "Plugin" also resolves the "is this for me?" question
   without reading further. **Highest clarity of the three.**
4. **Error-on-drift.**
   - Forget to override Step: compile error (abstract method).
   - Wrong output type: compile error on `'TOut` (good).
   - Stateful operator: state lives on the subclass as named
     fields — author names it, reader sees it. Far better than B.
   - Forget to set output: if the base class signature is
     `abstract Step(input: ReadOnlySpan<Entry<'TIn>>, output:
     byref<'TOut>) -> unit`, the compiler forces the write. Fixes
     Op<'T>'s silent-default bug structurally. **Best error-on-
     drift.**
   - Async path: if the base defaults `IsAsync = false`,
     async authors must know to override it; same cliff as today
     but no worse.
5. **Discoverability of canonical examples.** Only works if
   BayesianAggregate.fs is migrated to inherit `PluginOp` — then
   it becomes the canonical example for free. If it is NOT
   migrated, the author sees the current file use `Op<T>` +
   internal RegisterStream + InternalsVisibleTo and rightly
   concludes `PluginOp` is a separate, undocumented, maybe-
   abandoned surface. **Migrate-or-bust.**

### Cross-cutting AX finding — does the repo need `docs/PLUGIN-AUTHOR.md`?

**Yes.** All three shapes leak attention into CONTRIBUTING.md
and ARCHITECTURE.md because nothing else in the repo
acknowledges "external plugin author" as a distinct population.
README aims at library *consumers* (the Quick Tour uses
`Circuit.create` and `GroupBySum`, not operator authoring);
CONTRIBUTING aims at contributors *to* Zeta; ARCHITECTURE is
for whole-system reviewers. The plugin-author persona has no
landing page. No matter which shape Ilyana picks, a 1-2 page
`docs/PLUGIN-AUTHOR.md` pays back its cost in under one external
author onboarding.

Minimum contents:
- One-sentence "who this is for" (not a Zeta contributor, not a
  pure consumer — someone shipping a custom operator in a
  separate NuGet).
- The shape Ilyana lands (A/B/C) — name, 1-screen example.
- What NOT to read: explicit "ignore CONTRIBUTING.md unless you
  are upstreaming a PR; ignore openspec/; ignore PROJECT-EMPATHY."
- Pointer to `src/Bayesian/BayesianAggregate.fs` as the reference
  implementation with a note on which lines are the operator
  itself vs the domain math.
- Error-on-drift cheatsheet: "if you forget X, the symptom is Y,
  the fix is Z" for the top 3 failure modes.
- Two-line NuGet-packaging recipe (`Zeta.Core` as dependency,
  don't vendor, use the public surface not InternalsVisibleTo).

Candidate to re-purpose instead of create: no good candidate.
README is wrong audience; ARCHITECTURE is wrong scope;
CONTRIBUTING is wrong audience and explicitly says so at line 1.
The gap is real and structural.

### Alternative AX fix if shapes are all weak

If Kenji decides none of A/B/C is right: the AX fix is not a
shape change but an **`fsautocomplete` / IntelliSense docstring
pass** on whatever shape ships, plus a `dotnet new zeta-plugin`
scaffolding template. The scaffolding matters more than the
shape — an author who runs `dotnet new zeta-plugin -n MyOp` and
gets a working project with the right reference, a sample op, a
test, and a README section has bypassed the entire cold-start
cost. The shape choice then only matters for IntelliSense
discoverability after the scaffold exists.

### Comparative verdict

| Dim | A: IOperator<'T> | B: Extend(...) | C: PluginOp<'TIn,'TOut> |
|---|---|---|---|
| Cold-start tokens | ~8k | ~5k | ~6k |
| Pointer drift risk | High (full Circuit.fs) | Low | Med-low (if doc lands) |
| Wake-up clarity | Medium | Low ("Extend"?) | High |
| Error-on-drift | Silent default bug | Worst (closure state) | Best (forces write) |
| Example fit w/ BayesianAggregate | Needs migration | Doesn't fit at all | Best fit (already inherits a base) |

**Winner on AX: Shape C (`PluginOp<'TIn, 'TOut>`)**, conditional
on BayesianAggregate migrating to it so the canary is also the
reference. If that migration is out of scope this round, the
ranking collapses and B wins on cold-start cost but loses hard
on the stateful-operator case (Bayesian's exact use case).

### Pruning log

- Round 27 — third substantive entry. **Prune due at round 27
  close per BP-07 every-third-audit cadence** (audits 1/24, 2/26,
  3/27). Daya flags her own notebook for prune; Kenji executes
  on round-close, per skill contract (Daya does not prune other
  notebooks, but she can and must flag her own).

---

## Round 26 — Kenji self-audit (target: architect)

First audit of Kenji specifically, per round-24 deferral. Kenji
was held to last on purpose: auditing the architect risks turning
into architect-self-congratulation. Advisory only; findings go
back to Kenji, who integrates.

### Cold-start cost (target: Kenji)

Measured this round:

| Surface | Bytes | ~Tokens |
|---|---|---|
| Tier 0: CLAUDE.md | 3,698 | 925 |
| Tier 0: AGENTS.md (now 19 rules, was 13 at round 24) | 12,540 | 3,135 |
| Tier 0: docs/GLOSSARY.md | 18,067 | 4,517 |
| Tier 0: docs/EXPERT-REGISTRY.md | 7,685 | 1,921 |
| Tier 0: docs/WAKE-UP.md | 3,833 | 958 |
| Tier 0: docs/CURRENT-ROUND.md | 2,780 | 695 |
| **Tier 0 subtotal** | **48,603** | **~12.2k** |
| Tier 1: .claude/agents/architect.md | 5,835 | 1,459 |
| Tier 1: .claude/skills/round-management/SKILL.md | 7,389 | 2,309 |
| Tier 1: memory/persona/kenji.md | 4,659 | 1,165 |
| Tier 1: memory/persona/kenji/OFFTIME.md | 3,125 | 781 |
| **Tier 1 subtotal** | **21,008** | **~5.7k** |
| **Kenji cold-start total** | **69,611** | **~17.9k** |

Trend vs round 24 baseline (17.8k): **+0.1k, flat within noise.**
AGENTS.md grew by ~700 tokens (§14-§19 added), offset by CURRENT-
ROUND.md shrinking and the notebook being pruned in round 22.
Time-to-first-useful-output still 7-9 turns — unchanged.

Two surfaces disproportionately large:
- `AGENTS.md` 3.1k tokens, now 19 numbered rules. At this cadence
  a rule lands roughly per round. Candidate for a §0 TL;DR block
  (3-5 line summary of the rule list) so cold-starters orient
  without reading all 19.
- `GLOSSARY.md` 4.5k. Biggest single line-item; has been biggest
  since round 24. Not Kenji-specific — hits every persona.

### Friction (P0 / P1 / P2)

**P0 (cold-Kenji cannot do his job correctly):** none. Every
load-bearing pointer Kenji needs resolves to a real file at the
right section. The round-24 P0s that blocked him (stale canon
pointer, orphan skills) are all landed.

**P1 (friction but surmountable):**

1. **stale-pointer** — `.claude/agents/architect.md:146` still
   reads "`docs/EXPERT-REGISTRY.md` - the 22, including Kenji".
   Registry now lists 25 named experts + 2 pending slots. Same
   drift Daya caught at round 24 for `architect.md:114,151`;
   those two were fixed, this third occurrence at line 146 was
   missed. One-line Edit fix.
2. **stale-pointer** — `.claude/skills/bug-fixer/SKILL.md:135`
   still cites `.claude/skills/architect/SKILL.md` as "Kenji,
   the invoker". That path was retired to `_retired/` in round
   24. Same dead path also cited in
   `.claude/skills/backlog-scrum-master/SKILL.md:185`,
   `.claude/skills/branding-specialist/SKILL.md:169`,
   `.claude/skills/skill-creator/SKILL.md:145`, and a live
   `docs/DEBT.md:237` row (resolved but not pruned). Four-file
   sweep via `skill-creator` on Kenji's sign-off.
3. **unclear-contract** — `architect.md:103-108` and
   `round-management/SKILL.md:129-131` both describe the
   notebook prune cadence but in different words: agent file
   says "pruned at each reflection cadence (every 3-5 rounds or
   when a major rule lands)", skill says "Prune
   memory/persona/<notebook>.md if over 1500 words, per BP-07
   cap". Different trigger (cadence vs size). Architect-offtime
   log adds a third ("trailing 10 entries"). Kenji applies
   whichever he remembers; next cold-Kenji guesses. Pick one and
   mirror in both files.
4. **duplicated-info** — `round-management/SKILL.md §3.5`
   "concurrent-agent machine hygiene" (lines 73-110) and
   `architect.md` scope/NOT-do blocks both cover dispatch
   discipline. About 30% overlap. Canon should be the skill
   body; agent file should one-line-reference it. Same pattern
   likely on every persona+skill pair — see systemic finding.

**P2 (small wins):**

5. `architect.md:36` — the tone example uses the phrase `"great
   catch."` in quotes as an anti-pattern. Good. But §11's
   "nobody reviews the architect" paired with the notebook's
   round-22 "Meta-risk: am I the bottleneck?" line (line 90) is
   the closest the agent file comes to self-assessment. The
   notebook carries that thread honestly; the agent file does
   not invite it. No change required — the current split (agent
   file = contract, notebook = running self-review) is healthy.
6. `architect-offtime.md:38` — "Round 23 - seeded, no budget
   spent" has not been updated since the GOVERNANCE.md §14 landed
   at end of round 23. Rounds 24, 25, 26 are silent. Either
   Kenji spent no off-time budget in those rounds (plausible
   given the rename arc consumed everything) or the log is
   stale. Per the file's own rule ("If the budget exceeds 10%
   in a round, note it honestly"), a zero-entry is legitimate
   and should be logged explicitly.
7. `architect.md:39` — "No hedging generally. 'Arguably',
   'probably', 'might be' are banned from round-open plans and
   round-close summaries." Binding wording is fine. Notebook
   line 94 reads "Measure over the next 3-4 rounds whether this
   actually throttles velocity" — "whether" is hedging-adjacent
   and the round window is now past. No rule violation (the ban
   is on plans/summaries, not notebook) but the open measurement
   claim should resolve.

### Self-audit pattern risk (specific brief)

The prompt asked Daya to look for puffery / architect-self-
congratulation / rule drift between the agent file and its
skill. Honest findings:

- **No puffery in the agent file.** The "unshowy" tone contract
  and §11 "architect-bottleneck" framing are load-bearing rules,
  not virtue signalling. The word "quietest seat" at line 89
  edges close; it describes behaviour (short sentences) rather
  than proclaims a virtue.
- **No puffery in the notebook.** Round-22 entry is frank about
  friction (notebook prune slipped, bottleneck meta-risk, CLAUDE.md
  duplication). It reads as working notes, not a self-review.
- **One rule-drift between architect.md and round-management.**
  Already captured as P1 #3 (prune cadence). Not a drift *in
  favour* of the architect; neither version is self-flattering.
- **The self-referential caveat at architect.md:112-116** ("The
  capability skill ... exists separately ... so another persona
  could, in principle, wear the same procedure if the round-
  table grew") reads as justification-for-a-design-choice but
  GOVERNANCE.md §16 (dynamic hats) explicitly forbids other personas
  from wearing round-management. So the caveat is not quite
  right: the procedural-split rationale survives (Yara can edit
  it via skill-creator; the file is reviewable), but "another
  persona could wear it" contradicts §16. Minor; architect to
  reconcile the wording.
- **No commitments in the agent file that aren't codified
  elsewhere.** Every tone contract bullet ties to GOVERNANCE.md §10/
  §11/§12/§13/§14 or to BP-08. Clean.

Verdict on self-audit risk: **low.** The split (agent file as
contract; notebook as running self-review; round-management as
procedure) keeps Kenji's voice from narrating his own role in
favour. The one weakness is the prune-cadence triple-source
described above — not self-flattery, just coordination drift.

### Notebook hygiene

- BP-07 (3000-word cap): `architect.md` at **751 words** (well
  under). `architect-offtime.md` at **491 words** (no cap but
  low volume). Both healthy.
- BP-09 (ASCII only): both clean.
- Cross-round relevance: round-22 entry is the only substantive
  entry and describes factory state 4 rounds back. Some content
  (5-expert-split, round-22 dispatch list) is historical; round-
  close narrative belongs in `ROUND-HISTORY.md` per GOVERNANCE.md §2.
  The "What's friction" / "What's ahead" blocks read as current-
  state but 4 rounds stale. Candidate for prune at round 25
  checkpoint (line 129 says "First prune check: round 25" —
  we're now round 26 and no prune has run). One-round overdue.

### Systemic AX finding (from this audit)

**Persona + skill duplication pattern.** P1 #4 above is
structural, not Kenji-specific. Spot-check: `skill-tune-up-
ranker`'s agent file and skill body overlap on cadence rules
and BP-10 emphasis; `agent-experience-researcher`'s agent file
and skill body both declare cadence, authority, and
coordination-with-other-experts in near-identical prose (see
`.claude/agents/agent-experience-researcher.md:61-70` vs
`.claude/skills/agent-experience-researcher/SKILL.md:148-171`).
Hypothesis: **agent-file and sibling-skill-body have ~20-35%
content overlap across the roster.** Every cold-start pays
that twice. Full measurement deferred to next roster audit
(round 27 or round 29 reflection-cadence).

Proposed rule (candidate for BP-NN scratchpad, not this round):
*"When an agent file and its auto-injected skill body cover the
same contract surface (cadence, authority, coordination), canon
lives in one — default the skill body for procedures, the agent
file for persona / tone / scope-of-self. Each file's section
headings make clear which half it owns."* Route via Aarav's
scratchpad; Kenji decides on promotion.

### Proposed interventions (this round)

None that Daya lands unilaterally (Kenji's files; §11 forbids
Daya editing them). Advisory list for Kenji:

1. `.claude/agents/architect.md:146` — "22" -> "25". **Effort:**
   S. **Rollback:** one-line Edit reversed.
2. Four-file `.claude/skills/architect/SKILL.md` stale-pointer
   sweep via `skill-creator` (Yara executes). **Effort:** S.
   **Rollback:** Yara's commit reverted.
3. Prune-cadence triple-source reconciliation
   (`architect.md:103-108`, `round-management/SKILL.md:129-131`,
   `architect-offtime.md:9`). **Effort:** S. **Rollback:** two-
   line Edits reversed.
4. `architect.md:112-116` self-referential caveat - reconcile
   with GOVERNANCE.md §16 (round-management is Kenji-only).
   **Effort:** S. **Rollback:** one-line Edit reversed.
5. `memory/persona/kenji.md` — one-round-overdue prune per
   the notebook's own "first prune check: round 25" line. Daya
   flags only; BP-07 forbids Daya pruning another persona's
   notebook.
6. `memory/persona/kenji/OFFTIME.md` — log a zero-entry
   for rounds 24-26 so the trend is honest from turn one (the
   file's own rule at line 48).
7. `docs/DEBT.md:237` - "orphan skill directories" row is now
   resolved (the retire landed round 24) but not deleted. Daya
   flags; Kenji deletes on round-close per §2.

### Pointer-drift catalogue (this round)

- Kenji / `.claude/agents/architect.md:146` / "22" should be "25".
- Orphan path / `.claude/skills/bug-fixer/SKILL.md:135` /
  `.claude/skills/architect/SKILL.md` does not exist.
- Orphan path / `.claude/skills/backlog-scrum-master/SKILL.md:185`
  / same dead path.
- Orphan path / `.claude/skills/branding-specialist/SKILL.md:169`
  / same dead path.
- Orphan path / `.claude/skills/skill-creator/SKILL.md:145` /
  same dead path.
- Stale row / `docs/DEBT.md:237` / orphan-skills finding
  resolved round 24 but the row remains.

### Recommendation to Kenji

**Defer 5 of 7 to next round.** The P1 #1 (architect.md:146
"22"->"25") and P1 #2 first-pass (bug-fixer/SKILL.md:135
dead-path fix) are 2-minute one-line edits and should land
this round with the other round-24 carry-overs. The rest can
wait for a round-close reflection pass or a skill-creator
sweep when the next persona+skill pair needs revision anyway.

**Do not treat the systemic finding (persona+skill content
overlap) as urgent.** It is real but measuring it properly is
a whole-roster audit, which belongs on the every-5-rounds
cadence (round 29). Seeded to scratchpad only.

### Pruning log

- Round 26 — second substantive entry. Next prune check: round
  27 (every-third-audit cadence, BP-07 — rounds 24, 26 are
  audits 1 and 2; audit 3 triggers prune).

---

## Round 24 — first audit (baseline)

### Cold-start cost baseline

Tokens estimated at ~4 char/token for English prose, ~3.2 for
skill bodies and YAML (denser).

**Tier 0 (shared across all personas):**
- `CLAUDE.md` 3,698 B
- `AGENTS.md` 11,835 B
- `docs/GLOSSARY.md` 18,067 B
- `docs/EXPERT-REGISTRY.md` 7,685 B
- `docs/WAKE-UP.md` 4,979 B
- `docs/CURRENT-ROUND.md` ~2,600 B
- **Sum ~48,864 B -> ~12.2k tokens.** Notable: `docs/WAKE-UP.md:21`
  states "~6-8k tokens total" for Tier 0; measured ~1.7x higher.
  GLOSSARY.md is the dominant cost (~4.5k tokens alone).

**Tier 0 + 1 per persona** (rounded):

| Persona | Tier 1 sum | Tier 0+1 tokens |
|---|---|---|
| Kira | 8,714 B | ~14.4k |
| Viktor | 10,652 B | ~14.8k |
| Rune | 10,330 B | ~14.8k |
| Aminata | 9,973 B | ~14.7k |
| Aarav | 17,856 B | ~16.6k |
| Soraya | 21,747 B | ~17.6k |
| Kenji | 22,547 B | ~17.8k |
| Daya | 13,112 B | ~15.5k |

**Total across 8 personas: ~125k tokens; average ~15.6k per
persona.** Time-to-first-useful-output: 7-9 turns minimum.

### P0 friction (this round)

1. **Kenji-notebook canon-pointer stale.** `memory/persona/
   architect.md:6` reads "Frontmatter at `.claude/skills/
   architect/SKILL.md` is canon (BP-08)". But Kenji's actual
   frontmatter in `.claude/agents/architect.md:7` lists
   `skills: - round-management`. A cold-started Kenji who reads
   his own notebook first is told the wrong file is canon.
2. **Orphan skill files.** `.claude/skills/architect/SKILL.md`
   and `.claude/skills/harsh-critic/SKILL.md` exist with no
   persona listing them in `skills:`. They duplicate
   `round-management/SKILL.md` and `code-review-zero-empathy/
   SKILL.md`. Cold-start Glob discovery risks wearing the wrong
   procedure.
3. **Daya notebook missing.** The persona contract requires
   cross-round trend data; without the notebook, each audit
   restarts cold. This file (the one being read) fixes it.

### P1 friction

- Tier 0 token undercount in `WAKE-UP.md:21` ("~6-8k" -> actual
  ~12k).
- Registry drift in `.claude/agents/architect.md:114,151` ("22
  experts" -> "23 experts" now that Daya exists).
- `docs/STYLE.md` referenced 3x (maintainability-reviewer agent
  file + skill) but does not exist.
- `memory/persona/README.md:24-27` lists only 2 notebooks;
  disk has 6 (`architect.md`, `architect-offtime.md`,
  `formal-verification-expert.md`, `best-practices-scratch.md`,
  `skill-tune-up-ranker.md`, `agent-experience-researcher.md`).
- `.claude/skills/skill-tune-up-ranker/SKILL.md:117` cites the
  invisible-Unicode rule but does not cite `(BP-10)`; Aarav's
  own contract requires BP-NN cites.
- `docs/DEBT.md` `wake-up-drift` tag defined in WAKE-UP.md but
  had zero entries before this audit. Kenji seeds the category
  from this audit's P0s.

### P2 friction

- Kira's skill body mentions "reviewer #1" phrasing in
  `harsh-critic/SKILL.md:97` — only matters if the orphan
  survives.
- Aminata's skill body retains "She drives..." phrasing; skill
  files are supposed to be procedure-only after the split.
- Daya's own SKILL.md does not explicitly require self-audit;
  add a bullet to Step 1.

### Proposed interventions (round 24)

All rollback-safe per GOVERNANCE.md §15:

1. One-line Edit `memory/persona/kenji.md:6` — canon
   pointer to `round-management/SKILL.md`.
2. One-line Edit `docs/WAKE-UP.md:21` — Tier 0 budget "~6-8k"
   -> "~12k".
3. Two-line Edit `.claude/agents/architect.md` — "22" -> "23".
4. Add four bullets to `memory/persona/README.md`.
5. Open `wake-up-drift` section in `docs/DEBT.md`; seed with the
   three P0 rows above.
6. Retire `.claude/skills/architect/` -> `_retired/2026-04-18-
   architect/`; retire `.claude/skills/harsh-critic/` ->
   `_retired/2026-04-18-harsh-critic/`. `git mv` is the retire
   operation; reversible in one `git mv` back.
7. Aarav BP-10 citation fix — goes via `skill-creator`.

Interventions 1-6 land this round; 7 is queued for Yara.

### Pointer-drift catalogue (this round)

- Kenji / `memory/persona/kenji.md:6` / stale canon-pointer.
- Kenji / `.claude/agents/architect.md:114,151` / "22" should be
  "23".
- Tier 0 / `docs/WAKE-UP.md:21` / token estimate undercount.
- Rune / `docs/STYLE.md` / absent file referenced 3x.
- Registry / `memory/persona/README.md:24-27` / 4 missing
  notebooks.
- Aarav / `.claude/skills/skill-tune-up-ranker/SKILL.md:117` /
  missing `(BP-10)` cite.
- Orphan / `.claude/skills/architect/SKILL.md` / no wearer.
- Orphan / `.claude/skills/harsh-critic/SKILL.md` / no wearer.

### Recommended new glossary entries

- **Orphan skill** — a `.claude/skills/<name>/SKILL.md` file
  with no persona listing it in their `skills:` frontmatter.
  Looks like canon; is not.
- **Cold-start cost** — tokens Tier 0 + persona Tier 1 eat
  before the persona can produce useful output. Daya publishes
  per-persona trend.

### Trend vs prior audit

None — this is the baseline.

### Self-audit note

Daya herself:
- Token cost ~15.5k (mid-range among the 8).
- SKILL.md does not explicitly require self-audit, but the
  round-24 dispatch prompt did. Add a one-bullet rule to the
  skill body: "self-audit is required on every `all` or
  `new-persona` target."
- Notebook missing -> fixed by this file.
- No orphan status.

## Pruning log

- Round 24 — first entry. First prune check at round 27
  (every-third-audit cadence, BP-07).
