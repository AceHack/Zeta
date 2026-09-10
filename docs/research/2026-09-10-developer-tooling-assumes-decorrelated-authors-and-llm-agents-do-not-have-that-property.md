# Developer tooling assumes decorrelated authors, and LLM agents do not have that property

**Register: the thesis is `toy`.** One measurement in §3 is real and reported with its
number; the claim that the number is *high* is unfalsifiable until an external control
corpus exists, and §3 says exactly what that control would be. Two of the five folk-evidence
items below are **refuted** by verification, one is **corrected**, and the strongest
supporting datum turned out to be a different thing from the one the fleet has been telling
itself. Read the corrections; they are the most reliable part of the document.

## 1. The thesis, and the mechanism

Aaron, 2026-09-10, verbatim:

> "github and likely all other tools are not designed for AIs that cluster based on common
> next token space, this is not exactly how most humans work, a certain token expansion is
> preferred geographically and based on shared knowledge, AIs / LLMs have much more base
> model context so they get mixed together more."

Unpacked: **human authorship decorrelates for free, and every tool we use was built on top
of that free property without ever naming it.**

Two human engineers solving the same problem in different offices produce different
solutions, and they do so *without anybody arranging it*. Geography, team vocabulary, the
codebase they came up in, which textbook they happened to read, which senior engineer
reviewed their first pull request — these are uncorrelated across a population and they
persist. Independence is not something the human population achieves; it is something the
human population **cannot avoid**.

Every mechanism named in §4 was designed against that background and inherits it as a silent
premise. A second reviewer is worth having because they will have learned differently. Four
implementations in four languages disagree because four teams derived them separately. Blame
is informative because a name maps to one persistent person with one persistent set of
habits.

LLM agents drawing on a shared base distribution do not have the property. Two agents in
different repositories, different sessions, different prompts, under different persona names
still land in nearby regions of output space, because the thing that varies between them —
context, persona, memory — sits **above** the layer that produces the token. This is the
`ρ` layer stack (`docs/research/2026-08-25-rho-is-a-layer-stack-not-a-scalar-and-the-trainset-is-the-floor.md`)
observed at a new surface: that document establishes that the trainset is a floor an all-LLM
society cannot get below, and predicts the consequence for *vocabulary and evidence*.
Aaron's thesis is the same floor showing up in **tooling**, where it was never priced,
because the tools were written before the authors changed.

**The inversion worth stating explicitly.**
`.claude/rules/anti-babel-preserve-reconcilability.md` names two cliffs and spends most of
its text on `ρ → 0`, runaway divergence into Babel. That is the failure a *human* society
falls into, and it is the one worth guarding when your authors decorrelate for free. An
all-LLM society falls off the **other** side. The same rule already says so — *"the obvious
guard — freeze the vocabulary — is the `ρ → 1` cliff"* — but it treats `ρ → 1` as something
you would have to *do* to yourself. Under shared-prior authorship it is the resting state.
You do not have to freeze the vocabulary; the vocabulary arrives frozen.

`docs/VISION.md` already carries the algebra and it is not gentle:

```
N_eff(N, ρ) = N / (1 + (N−1)·ρ)
lim N→∞  N_eff = 1/ρ
ρ* = 1/3     above this the ensemble cannot beat its best individual,
             REGARDLESS of individual competence
```

And the repo's own checked-in measurement, `db/effective-agent-count/rho-series-cumulative.tsv`,
last row `0381fe968a` (2026-08-22T14:42:23Z), over three agents and a 286-finding frame:

| statistic | cumulative | windowed-60 |
|---|---|---|
| `rhoIcc` | **0.549** | **0.628** |
| `effectiveCount` from N=3 | **1.43** | **1.33** |

Both are roughly **twice `ρ*`**. Three agents are worth about one and a third. That series
has not been regenerated since 2026-08-22, which is itself a finding: the one meter in the
repo that prices this thesis is nineteen days stale.

**What this document adds** to the ρ work already on file is not the correlation — that is
measured. It is the observation that a specific, enumerable set of *tools* has independence
compiled into it as an assumption, and that the assumption is not annotated anywhere in
those tools.

## 2. The evidence, verified

Five failure classes were nominated as instances of "one mistake with N instances." Each was
checked against `git log`, the code-scanning API, and the audits' own baselines. **The
nominated framing survives for one of them, is materially corrected for two, and is refuted
for two.**

| # | class | nominated | verified | distinct authors | distinct files | assumption violated | verdict |
|---|---|---|---|---|---|---|---|
| 1 | guard satisfied by its own comment | "~7 agents independently" | 10 instances; **5** distinct `Agent:` values; **3** genuinely independent | 3 independent (Otto, soraya, general-purpose); 4 personas total | 10 guards; latent surface 140 of 155 source-scanning guards do not mask comments | review independence; *a check that cannot fail* | **corrected** — real, smaller |
| 2 | raw C0 control bytes in source | "12 files, 5 TS / 7 F#, different agents different times" | **11 on `main`**, 12th on then-unmerged #17249; split correct only counting it | 3 named + 2 unattributed; **6 of 12 from one persona on one day** | 12 files, 10 introducing commits, 6 dates over 117 days | text-is-text; toolchain parseability | **corrected** — weaker than framed |
| 3 | `existsSync` → read check-then-use races | "~500 sites grandfathered" | **510 baseline entries, 254 distinct files** | 16 agents in the attributable opportunity set | 189 attributable `.ts` files that do the operation at all | atomicity; TOCTOU | **substantiated, and the strongest datum** |
| 4 | well-formed work-item id never minted | "at least twice, different agents" | 2 never-minted ids — **both `shadow`** | **1** | 2 | provenance keys identify something | **refuted as cross-agent** |
| 5 | fixes that relocate rather than close | "47 lines down; race-fix introduces temp-file alert" | **exact**: 525 → 572 = 47; full #938→#945→#947 chain confirmed | **1 model, 1 credential**; `shadow` / `shadow-subagent` / `sec7` | 3 files, 3 chains, 8 commits | that a fix removes a defect | **substantiated, wrong mechanism** |

### 2.1 — the guard a comment satisfies (corrected: 3 independent, not 7)

The shape: a guard reads a source file as raw text and asserts a pattern is present. The
prose in that file's own header, docstring, or bail message contains the literal string. The
assertion is satisfied by the *explanation of the code* rather than the code, and survives a
mutant that deletes the code entirely — in `d465d16da`, a mutant that deleted both the call
**and its import**. The canonical statement is from that commit: **"Mentions are not
executions."**

Verified independent instances — three agents, three separate weeks, none aware of the
others:

| guard | defect SHA | PR | date | `Agent:` | `Agent-Model:` |
|---|---|---|---|---|---|
| `hygiene/audit-workflow-cli-flags.ts` (`hasClosedFlagSet` read raw source while its own sibling stripped comments) | `d433b9bc8` | #10577 | 2026-08-14 | `Otto` | claude-opus-5 |
| `hygiene/audit-ambient-time-in-tests.ts` (reported a finding against a comment naming the sleep it explained) | `58338c1d9` | #12112 | 2026-08-18 | `soraya` | claude-opus-5 |
| `ace/ace-node-runtime-parity.test.ts` (module walker read two English phrases out of prose as npm specifiers) | `343e6db76` | #14913 | 2026-08-24 | `general-purpose` | claude-opus-5 |

Seven further instances (#17075, #17076, #17091, #17155, #17166, #17175, #17214) are `shadow`
or `shadow-subagent` on 2026-09-08/09. **They are not independent and must not be counted as
such** — the author says so in `d465d16da`: *"for the third time today in the same way … so
it is a habit in how I write these rather than an accident."* One agent, one session, one
habit.

**Where "seven" came from, and why it does not survive either.** PR #17214's body says *"the
seven remaining `runContextCmd` clones (amara, ani, codex, gemini, grok, grok-build,
riven)."* That is a different defect — a byte-identical hand-rolled shell-spawn helper in
nine agent-named peer-call wrappers. Nine files, four distinct variants by hash, which looks
like an excellent correlated-authorship datum. It is not: **all nine files were added in one
commit, `863c4d947`, 2026-06-13.** One agent wrote nine files at once. That is ordinary
copy-paste duplication and carries no information about author correlation at all. I nearly
put it in this table.

The honest residual finding is the **latent surface**: 155 source-scanning guards under
`src/Core.TypeScript/hygiene/` and `lint/`, of which **140 do not mask comments**. That is an
upper bound on a defect class, not a defect count — many legitimately scan Markdown or YAML
where the issue cannot arise. No census has been run. `unknown`.

And there is no `.claude/rules/` rule for it. The only human-facing artifact is one memory
file (`a-guard-that-greps-source-must-match-the-CALL-not-the-identifier.md`), which itself
records 3 instances by one agent in one session — i.e. the rule surface never claimed seven
either. The number was folklore acquired in transit.

### 2.2 — raw control bytes (corrected: 11 on `main`, half from one day)

`src/Core.TypeScript/hygiene/audit-no-raw-nul-in-source.ts` detected **only `0x00`** until
PR #17255, which merged as `b7b5d4998` while this document was being written. #17255 widens
it to the full C0 class plus DEL, excluding tab/LF/CR, over 23 code extensions, with **no
allowlist and no baseline** — the rule is total by design.

Eleven files on `main` carried a raw control byte. The twelfth, `corporate/observe-org.ts`,
was on unmerged PR #17249. Bytes found: `0x1B` (ESC, ANSI escapes written without the
prefix), `0x1F`, `0x1E`, `0x01`.

The introducing commits, which is the datum that matters:

| span | agent | model | files |
|---|---|---|---|
| 2026-05-16 | unattributed (predates the convention) | `Claude` | 1 |
| **2026-06-11** | `persona: otto / hat: shadow` | **Claude Fable 5** | **6, across 4 commits, in one day** |
| 2026-08-16 / 08-17 / 08-27 | `shadow`, `Otto` | claude-opus-5 | 4 |
| 2026-09-10 | unattributed (`maximdolphin`) | Claude Opus 5 | 1 |

Six dates over 117 days, but **half the corpus is one persona on one day**. "Different agents
at different times" is true and much weaker than it sounds. All eleven on-`main` commits also
share one git author identity (`Aaron Stainback`, the shared credential), so agent
distinctness rests entirely on self-declared trailers.

**The self-referential commit is real, and it is not the one that was claimed.** The claimed
instance — a 2026-09-10 commit message about control bytes containing one — refers to a
*refused draft* that never entered git, and no in-repo `commit-msg` validator was found
(`git config core.hooksPath` unset, no `.githooks/`), so the refusal is harness-side and
`unknown` from the repository. But a scan of every commit message reachable from all 597 refs
found **exactly one** message in the entire history containing a raw control byte, and it is
the self-referential case:

- `215c95a47875ad41d798cc033897e05ac85fbfa0`, 2026-06-11, `persona: otto / hat: shadow`, Claude Fable 5
- body line 16: `fixed with explicit <ESC> escapes on BOTH sides…` — carrying a raw `0x1B`
  where the notation is written, in a message explaining that ANSI strings *"lacked the ESC
  prefix"*

Same defect class, same day, same persona as five of the eleven files. It landed and is still
there. It is a better datum than the anecdote it replaces because it is checkable.

### 2.3 — check-then-use races (substantiated; the load-bearing measurement)

`lint-check-then-use-file-races.baseline.json` grandfathers **510 entries across 254 distinct
files**. Shapes: `existsSync→readFileSync` (223), `existsSync→readdirSync` (89),
`existsSync→rmSync` (28), plus `renameSync`, `unlinkSync`, `chmodSync`, `copyFileSync`,
`statSync→…`, `lstatSync→readlinkSync`.

Restricting to tracked `.ts` files whose first-add commit carries an `Agent:` trailer, and
taking as the **denominator only files that perform the operation at all** — i.e. that call
`existsSync`, `statSync`, or `lstatSync`, so that an agent which never touches the filesystem
is not credited with avoiding a filesystem defect:

> **189 attributable files had the opportunity. 80 took the racy shape. Pooled rate
> `p = 0.423`.** 16 distinct agents in the opportunity set; 11 of them have at least one.

Nearly **half** of every file in this repository that asks whether a path exists then goes on
to use it does so in the racy shape, and the non-racy shape (open once, `fstat` the
descriptor — what `9c3d77a17` eventually did, and what `src/Core.TypeScript/io/safe-io.ts`
now exists to provide) is almost absent from the corpus.

That is the number this document rests on. §3 is about whether it means what it looks like it
means.

### 2.4 — the unminted work-item id (refuted as cross-agent evidence)

Running the repo's own audit over every `Task:` trailer reachable from all refs since
2026-08-01 — 3074 commits, 790 distinct shaped ids — reports **14 unresolvable**. That number
does not survive inspection:

| disposition | count | note |
|---|---|---|
| `resolves-backlog` — a real, minted row **mislocated** under `docs/backlog/P1\|P2/` | **5** | the audit indexes only `workitems/`. Widening it is **refused**, not overlooked — see below |
| `unminted` against `main`, but a `workitems/` file exists on its own unmerged branch | **7** | correct against `main`, not against the branch |
| **never minted anywhere in history** | **2** | `081M0X0JQGY087G0R000EBCPQ3` (2026-08-25) and `081M25W3T5V087G0R0038Q8RJT` (2026-09-10, `a29862b7d`, branch `repin-tla2tools-third-roll`) |

**Both never-minted ids are `shadow`.** The nominated framing — "at least twice, different
agents" — is **refuted**. It is one agent repeating itself 16 days apart, which is a
within-author habit and evidence for nothing about correlation between authors.
`.claude/rules/never-assume-malice-where-mistake-is-possible.md` already says as much: *"twice
on the day this rule was written, **its author** wrote a well-formed work-item id into a commit
trailer without minting it."*

**The obvious secondary finding is wrong, and its wrongness is the most instructive thing in
this section.** My first draft of this paragraph read: *"the audit reports 5 findings it
should not — `.claude/rules/workitems-mint-with-zetaid.md` keeps ZetaId-keyed `docs/backlog/`
rows as legitimate, so the audit's definition is narrower than the repo's. Filed here rather
than fixed."* That is a plausible-sounding fix proposed without checking whether the
repository had already reasoned about it. It had, twice, and both times reached the opposite
conclusion:

- `src/Core.TypeScript/hygiene/classify-zetaid-nonresolution.ts` exists **precisely** to
  separate these classes, is explicit that it is *"a classifier, not a gate,"* and states
  outright that **widening the resolver to `docs/backlog/` would turn a wrong reference
  green.** Its worked case is one of my own five:
  `.github/workflows/context-cost-trend-cadence.yml` names `081KT7YW00008QG0R002T1XNWT` in its
  `Task:` trailer; that id resolves — to a *YAML* row closed 2026-06-04, not to the
  context-window row the workflow actually serves. Same 19-character prefix, different item.
  `docs/backlog/` was backfilled at **day granularity**, so 99.6% of its 1118 ids share a
  prefix with a sibling; the classifier reports cohort sizes of 72, 92, 25, 10 and 4 for my
  five. Widening the resolver would silence a *misidentification*, which is worse than the
  false positive it removes.
- `.github/workflows/gate.yml:3406` records that this exact false positive was **measured
  live on 2026-08-26** and answered by splitting one 31-step monolithic check into named
  jobs, rather than by widening the audit — Aaron's *"if it's a shared gate we want to reduce
  those to smaller individual ones rather than widening one that's monolithic already."*

Running the classifier gives the honest disposition of all fifteen ids:
`unminted = 9`, `resolves-backlog = 5`, `resolves-workitem = 1` against the working tree; of
the nine, seven have a file on an unmerged branch, leaving the two above. **The correct
statement is not that the audit over-reports — it is that `audit-task-zetaid-resolves` emits
one message for four distinct defects with four distinct remedies, which the classifier
already says in its own header and which nothing has yet acted on.**

This is §5 happening inside §2: an agent proposed a fix, the fix was already considered and
refused for a documented reason, and what caught it was running the repository's own tool
rather than reasoning further.

Worth recording for §4 all the same: this audit's *refusal path* is exemplary. Given no input
it prints `"NO INPUT — found no Task ids to check … This is NOT a pass"` and exits non-zero.
A check that distinguishes "nothing wrong" from "I did not run" is the opposite of the vacuity
class, and it is what let this section reach a number at all.

### 2.5 — fixes that relocate (substantiated exactly; and the mechanism is not the nominated one)

**47 is exact.**

| | |
|---|---|
| rule | `js/http-to-file-access` |
| file | `src/Core.TypeScript/ci/workflow-enablement.ts` |
| before | line **525**, alert **#930**, created 2026-09-09T22:33:13Z |
| after | line **572**, alert **#931**, created 2026-09-10T01:37:44Z |
| Δ | **47** |
| PR | #17182, merged 2026-09-10T02:07:28Z as `392638fce` |

The sink is the *same statement* — `appendFileSync(summaryPath, …)` — displaced downward
because the fix added 47 lines above it. Verified against file contents at each commit: 474 →
525 → 572 → 607. The chain took four commits, of which the middle two were wrong; the fourth
says so: *"That is two wrong guesses in a row on my part."*

The second and third claims hold too, on PR #17249 in `corporate/git-data-source.ts`:
`js/file-system-race` **#938** @425 closed by `9c3d77a17`, which **introduced**
`js/insecure-temporary-file` **#945** @429; `afe99450a` fixed #945 and **relocated** it to
**#947** @435; `e4a3ecf37` ended it by removing the construct. A fourth instance nobody
nominated: `js/log-injection` **#653** @81 → **#932** @117 → currently 138, in
`observe/realtime-client.ts`.

**But the nominated mechanism is wrong, and the true one is worse for the thesis in one
direction and better in another.** Every commit in every chain is one model:

| chain | commits | `Agent:` | `Agent-Model:` |
|---|---|---|---|
| #930→#931 | 4 | `shadow-subagent` | Claude Opus 5 |
| #938→#945→#947 | 3 | `shadow` | Claude Opus 5 |
| #653→#932 | 3 | `sec7`, then `shadow` | Claude Opus 5 |

These are not N independent authors converging on one error. They are **one prior failing the
same way three times in a row against three different queries** — which is not evidence of
correlation *between* authors, and is direct evidence about the prior itself: given a static
analyser's complaint, the shape of fix this model reaches for is a local guard at the
reported line, and that shape moves alerts rather than removing them. Three times, three
files, one day, before anyone reached for the structural fix.

One more thing found in passing, and it belongs in this section rather than a footnote.
`src/Core.TypeScript/io/safe-io.ts:23-28` — the file written *because* of the #930/#931
relocation, whose header is titled "THE MEASUREMENT THAT COMMISSIONED THIS FILE" — narrates
the event as *"thirty-seven lines further down."* The API and the file contents both say 47.
**The repo's own primary account of its most-cited relocation is off by ten**, and it was
written by the same persona family that produced the relocation. Nobody re-read the number
against the source, because the account was persuasive.

## 3. A falsifiable form — one measurement run, two statistics tried, one honest failure

"LLMs are correlated" is not falsifiable as stated. Here is the attempt to make it so, run
against `lint-check-then-use-file-races` because it is the largest attributable defect corpus
in the repository.

**Setup.** Population = tracked `.ts` files whose first-add commit carries an `Agent:`
trailer: **1744 files, 25 distinct agents**. Opportunity set = the subset that calls
`existsSync` / `statSync` / `lstatSync`: **189 files, 16 agents**. Defect set = opportunity
files present in the baseline: **80**. Pooled `p = 0.423`.

### Statistic A — author coverage. Computed. It is a dud, and that is worth publishing.

The idea: under independent-mistake authorship, a defect class should be concentrated in a
few authors; under a shared prior it should reach *everyone*. Define
`c(d) = |{agents with ≥1 instance}| / |{agents with ≥k opportunities}|` and compare to the
independence prediction `Σ_a [1 − (1−p)^{n_a}]`.

| k | \|A\| | observed \|A_d\| | expected under independence | c_obs | c_exp |
|---|---|---|---|---|---|
| 1 | 16 | 11 | 12.87 | 0.688 | 0.805 |
| 3 | 10 | 8 | 9.36 | 0.800 | 0.936 |
| 5 | 6 | 5 | 5.96 | 0.833 | 0.994 |
| 10 | 3 | 3 | 3.00 | 1.000 | 1.000 |

**Observed coverage is at or slightly below the independence prediction at every threshold.**
The statistic does not support the thesis. It also does not refute it, because at `p = 0.423`
coverage **saturates under both hypotheses** — any agent with ten opportunities has a 99.4%
chance of at least one instance whether the authors are clones or strangers. A statistic that
cannot distinguish the hypotheses is not evidence about them. Discard it, and note the lesson:
coverage is only informative for **rare** defect classes.

### Statistic B — overdispersion. Computed. It cuts *against* the strong thesis, with a fatal confound.

If all agents are draws from one prior, per-agent defect rates should be binomial around `p`.

| agent | opp `n` | defects | rate | expected | binomial tail |
|---|---|---|---|---|---|
| shadow | 80 | 29 | 0.362 | 33.86 | — |
| **otto** | 48 | 33 | **0.688** | 20.32 | `P(≥33) ≈ 0.000` |
| **dejan** | 12 | 1 | **0.083** | 5.08 | `P(≤1) = 0.013` |
| **claude** | 9 | 0 | **0.000** | 3.81 | `P(≤0) = 0.007` |
| vera | 9 | 5 | 0.556 | 3.81 | — |
| nazar | 7 | 3 | 0.429 | 2.96 | — |
| (10 more, `n` ≤ 4) | | | | | |

`χ² = 39.54` on 15 dof, ratio **2.64**, `p ≈ 5×10⁻⁴`. A single homogeneous shared rate is
**rejected**. Agent identity carries real signal — which is what the ρ layer stack would
predict for the *context/persona* layer, and which is an argument that persona is not merely
cosmetic.

**The confound is fatal and I am not going to argue around it.** Agent-to-subsystem
assignment is not random. `dejan` owns install scripts, `claude` and `lumen` write numerics.
A per-agent rate difference is at least as easily explained by *what kind of filesystem code
each writes* as by *how each writes filesystem code*. Restricting the denominator to files
that call `existsSync` narrowed this confound; it did not close it, because "calls
`existsSync` once in a test helper" and "is an IO module" are different populations.

There is a second, methodological problem with everything above: **statistic B was chosen
after statistic A failed.** That is a garden of forking paths, and the correct disposition is
that B is a hypothesis to pre-register, not a result to cite.

### Statistic C — the one that would actually work, and cannot be run today

The datum that supports Aaron's thesis is not the distribution across agents. It is the
**marginal**: `p = 0.423`. Under decorrelated authorship, the choice between
`existsSync`-then-read and open-once-then-`fstat` should be closer to a spread across an
author population that learned in different places, different decades, different languages.
Here 42% of all opportunities take one specific racy shape and the alternative is nearly
absent.

But *"42% is high"* is an assertion, not a measurement, until there is something to compare
it to. **The falsifier:**

> Run `lint-check-then-use-file-races.ts` unchanged over a corpus of **human-authored
> TypeScript written before 2023** (pre-LLM-assistance), using the same opportunity
> denominator: files that call `existsSync`/`statSync`/`lstatSync`. Compare the pooled rate.
>
> - **Thesis survives** if the agent corpus rate is materially above the human corpus rate on
>   the same denominator.
> - **Thesis refuted for this defect class** if the rates are comparable — meaning `existsSync`-
>   then-read is simply the idiom Node.js teaches, humans included, and correlated authorship
>   explains nothing that the ecosystem's own documentation does not already explain.

That is one afternoon of work and it is the single highest-value follow-up in this document.
It is not run here, so **the thesis is `toy` and stays `toy`.** The prediction is recorded
before the measurement, which is the only part of this I can do honestly today.

### What is missing that the repo could supply and does not

- **`Agent-Model` is stamped on every commit and folded into nothing.** The population is
  1744 attributable `.ts` files; by model string, roughly **69% are Anthropic-family**
  (`claude-opus-5` 979, `Claude Opus 5` 129, `Claude` 32, `fable-5` 32, `claude-opus-5[1m]`
  27), against `GPT-5.5`/`gpt-5.5`/`gpt-5` 207, `Grok 4.6`/`grok-4.6` 98, `max` 64,
  `qwen-coder` 26. A per-model defect rate is computable **today** and would be the first
  measurement in this repository that varies the *vendor* layer of the ρ stack rather than
  the context layer. Nothing does this.
- **The ρ series is stale.** `db/effective-agent-count/` stops at 2026-08-22 and covers three
  agents over one corpus (`db/mutation-findings/`). It is the right instrument pointed at too
  little.
- **Defect-class author-coverage is not recorded anywhere.** Every baseline file lists sites;
  none lists who introduced them. §4 proposes fixing that.

## 4. What tooling would look like if it assumed correlated authors

Each item names the assumption it replaces and a concrete first move. None of these requires
new theory; three of the four require only using data the repository already stamps.

### 4.1 Review assignment should maximise prior distance, not availability

**Assumption replaced:** the second reader learned differently from the first.

Knight & Leveson (1986) is the standing anchor here, already cited in
`.claude/rules/dual-use-detection-is-neutral-oracle-decides.md` for the four-oracle byte-lock:
independently developed N-version programs fail together far more often than independence
predicts, because the *problem* induces correlated mistakes even in genuinely separate teams.
Shared-prior authorship is that effect with the last remaining source of separation removed.
If author and reviewer draw from the same base, review is **correlated redundancy**: the
reviewer misses what the author missed, for the same reason the author missed it.

**First move, and it is small.** A PR check that compares the author's `Agent-Model:` trailer
against the reviewing agent's, and *warns* — not blocks — when they are equal while another
model family was available in the fleet. The repo has `Agent-Model` on every commit and
several vendors in the roster; nothing currently consults either. Warn rather than block,
because forcing a family switch on work that requires a specific capability would be a worse
failure than the one being prevented.

Honest limit: this measures the vendor layer, and the ρ stack says the trainset floor sits
*below* vendor. Maximising prior distance buys the vendor layer's worth of independence and
not one bit more.

### 4.2 N-version schemes must require differing model families, not differing repos

**Assumption replaced:** four implementations in four languages were derived four times.

`.claude/rules/dual-use-detection-is-neutral-oracle-decides.md` already concedes most of this
and does so precisely: the four oracles *"do not agree by default"* (C#/TS sort by UTF-16 code
units, Rust by UTF-8 bytes), agreement is **achieved** rather than observed, and **"the seed is
the treaty."** That rule's defence of the word *oracle* is that a compiler is a tradition of
resolved human disagreements, not an instrument — which is right, and is exactly what makes
the extension necessary rather than contradictory:

> The **treaty** was negotiated by four human language traditions. The **conformance code that
> implements the treaty in this repository** was written by agents drawing on one prior. The
> byte-lock's independence lives in the first and is spent in the second.

The four language *designs* remain independent artifacts. What is no longer independent is
our four implementations *of* them, and a byte-lock is only as strong as the weaker of the
two.

**First move.** Compute, per oracle implementation directory, the `Agent-Model` distribution
of first-add commits. If all four conformance implementations are predominantly one family,
that is a measured weakening of the byte-lock and belongs in the rule as a stated limit. If
they are spread, that is a real property worth claiming and nobody has claimed it. Either
outcome is publishable; the current state — not knowing — is the only bad one. This document
did not run it.

### 4.3 Audits should weight by author coverage: a class that catches *everyone* is a design defect

**Assumption replaced:** N findings are N mistakes.

This is the operational core of the thesis. If a defect class reaches most of the author
population, the correct response is not N corrections but **one change to what the API makes
easy**. `p = 0.423` across 16 agents is not 80 mistakes; it is one API doing what it does.

And the repo already did the right thing once, by instinct rather than by policy:
`src/Core.TypeScript/io/safe-io.ts` exists because patching instances of relocating CodeQL
alerts visibly did not work, and its own header says so — *"the proof that patching instances
does not work."* That escalation from *lint the sites* to *make the shape unavailable* is the
correct response, and it happened after a human-noticed pattern rather than after a
threshold.

**First move.** Extend the baseline format from a list of sites to a list of
`{site, introducing_sha, agent, agent_model}`. Every audit in `hygiene/` already has the
sites; the attribution is one `git log --diff-filter=A` away and this document computed it for
one audit in about a minute. Then emit an **author-coverage line** with each run:

```
lint-check-then-use-file-races: 510 sites / 254 files / 16 of 16 opportunity-agents
  → author coverage 1.00 at k≥10. This is a DESIGN DEFECT, not 510 mistakes.
    Escalate: make the shape unavailable (see io/safe-io.ts) before filing more sites.
```

An audit that reports *how many independent authors it has already caught* is reporting on
its own subject matter. One that reports only a site count invites exactly the response the
measurement says will not work.

### 4.4 Provenance: `Agent-Model` is already stamped and used for nothing

**Assumption replaced:** blame maps to a persistent individual with persistent habits.

AgencySignature v1 stamps ten fields on every commit, two of which — `Agent:` and
`Agent-Model:` — are precisely the correlation-relevant ones, and they are validated for
*shape* and consulted for *nothing*. Meanwhile `Credential-Identity` is `AceHack` on
essentially everything, so `git blame` returns one human for work done by twenty-five agents
across at least six model families. Blame is not wrong; it is answering a question nobody is
asking.

**First move.** A fold at `db/authorship-correlation/` keyed by (defect class × `Agent-Model`
× `Agent`), regenerated the way `db/effective-agent-count/` is, from data that already exists
in the commit graph. That is the per-layer ρ measurement
`2026-08-25-rho-is-a-layer-stack-not-a-scalar-…` asks for and states nothing currently does —
*"vary exactly one layer, hold the rest fixed, measure ρ per layer"* — and the vendor layer is
the one this repository can vary today without any new infrastructure.

### 4.5 The escape hatch, which `docs/VISION.md` already names

Not a redesign — a reminder that constrains all four items above:

> *"ρ is per-**task**, not per-agent. A mechanical check — exit codes, byte comparison,
> mutation survival — has ρ ≈ 0 no matter how correlated the agents running it are."*

The correct response to correlated review is therefore **not more reviewers**. `N_eff` caps at
`1/ρ` and no amount of reviewing gets past it. It is **more mechanical falsifiers**, and
specifically mutation testing, which caught three of the §2.1 instances precisely because a
surviving mutant is a fact rather than an opinion. Every finding in this document that
survived verification was established by a mechanical read — `git log`, the code-scanning API,
a byte hash. Every claim that dissolved was established by an agent reading a narrative.

## 5. The self-implication, stated plainly

This document is written by an instance of the thing it describes, and its blind spots are
its subject matter.

- The author is Claude Opus 5. The `Agent-Model` string appearing 979 times in the population
  of §3 is the author's own. When §3 computes a defect rate over "agents," the largest single
  contributor to that population and the author of the analysis are the same model.
- The evidence was gathered by **three subagents of the same model**, dispatched in parallel
  to cross-check different items. That looks like independent verification and, at the vendor
  and trainset layers, is `ρ ≈ 1`. They varied context alone — the shallowest layer in the
  stack. The session that produced this document has run roughly a dozen agents this way and
  should price them as approximately one.
- **What saved the document was not their judgement, it was their instruments.** Every
  correction in §2 came from a mechanical read that any of us could have run and only one of
  us did: `git log --diff-filter=A` collapsing nine "independent" peer-call clones into one
  commit; the code-scanning API giving 47 where the repo's own prose said 37; the audit's own
  refusal path separating 14 findings into 5 false positives, 7 branch-local, and 2 real.
  This is §4.5 happening to this document, and it is the only reason to trust §2 more than
  §1.
- **I nearly shipped the seven-clone datum.** It was handed to me as a correction to another
  item, it fit the thesis beautifully, and it took one command to dissolve. A datum that fits
  the thesis is the one to check hardest —
  `.claude/rules/numerology-vs-number-theory.md`: *"too many correlations is a warning, not a
  confirmation signal."* Three of five nominated items weakened or died under verification;
  that ratio is the healthy one, and a version of this document where all five held up would
  deserve less trust, not more.
- **I proposed a fix the repository had already refused.** §2.4's first draft told the audit
  to index `docs/backlog/`. Two in-repo surfaces — a classifier written for this exact
  question and a comment in the gate — had already measured that the widening turns a
  *misidentification* green. The draft was plausible, fluent, and would have read as a
  finding. It survived until I ran the repository's own classifier, which took one command.
  Note the shape: not a reasoning error, a **prior-art error** — reaching for the first
  well-formed answer rather than the one already on file. That is the failure mode
  §1 predicts for an author whose fluency exceeds its recall.
- **Statistic B was selected after statistic A failed**, which is disclosed in §3 and is a
  real methodological defect in this document, not a hypothetical one.
- And the failure mode this document is *most* likely to have: it is a persuasive account of
  why agent-authored work should be distrusted, written persuasively, by an agent. The
  reader's best defence is §3's falsifier, which is cheap, external, and can return "no."

## Register

| claim | register | why |
|---|---|---|
| Tooling assumes decorrelated authors | `toy` | argued, not measured; the mechanism is plausible and unfalsified |
| `p = 0.423` on the opportunity-adjusted corpus | **measured** | 189 files, 80 defects, command and denominator stated |
| "0.423 is high" | `toy` | no control corpus; §3's falsifier is what would move it |
| Author coverage discriminates the hypotheses | **refuted** | saturates at high base rate; observed ≤ expected at every k |
| Per-agent rates are overdispersed (`χ²/dof = 2.64`) | `unmetered` | computed, post-hoc, confounded by subsystem assignment |
| ρ ≈ 0.55–0.63, `N_eff` ≈ 1.33–1.43 from N=3 | **measured**, stale | `db/effective-agent-count/`, last row 2026-08-22 |
| Four-oracle byte-lock is weakened by shared-prior implementation | `toy` | the measurement in §4.2 has not been run |
| §2 items 1, 2, 5 | verified with corrections | see per-item verdicts |
| §2 item 4 as cross-agent evidence | **refuted** | both never-minted ids are one agent |
| "the Task audit over-reports and should index `docs/backlog/`" | **refuted, by me, in §2.4** | widening turns a prefix-ambiguous misidentification green; already measured 2026-08-26 |

## Pointers

- `docs/research/2026-08-25-rho-is-a-layer-stack-not-a-scalar-and-the-trainset-is-the-floor.md`
  — the layer stack, the trainset floor, and the "vary exactly one layer" measurement §4.4
  proposes an instrument for.
- `.claude/rules/anti-babel-preserve-reconcilability.md` — the two-sided band. This document
  is its `ρ → 1` side, which the rule names and does not dwell on.
- `docs/VISION.md` §ρ — `N_eff`, `ρ* = 1/3`, infrastructure diversity as the only lever, and
  the mechanical-check escape hatch quoted in §4.5.
- `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md` — Knight–Leveson; *"the seed
  is the treaty"*; why plural meters exist. §4.2 extends its own concession rather than
  contradicting it.
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — why the register table is not a
  formality.
- `.claude/rules/numerology-vs-number-theory.md` — *"too many correlations is a warning"*;
  §5's discipline.
- `src/Core.TypeScript/io/safe-io.ts` — §4.3's worked example of the right escalation, and
  §2.5's off-by-ten.
- `src/Core.TypeScript/hygiene/lint-check-then-use-file-races.baseline.json` — the corpus §3
  measures.
- `src/Core.TypeScript/hygiene/classify-zetaid-nonresolution.ts` — §2.4's corrector, and prior
  art for §4.3's move: it separates one message into four defect classes with four remedies,
  which is the same escalation from *count the sites* to *name what kind of failure this is*.
- `db/effective-agent-count/` — the ρ series, stale since 2026-08-22.
- **In flight, cross-reference not duplicate:** a sibling document on **effort-cost as a
  collapsed evidential channel** — how a single artifact's evidential weight changes when
  production cost stops tracking effort. That one is about *one artifact*; this one is about
  *correlated authorship across many*. They meet at the point where cheap production and
  shared priors jointly break the inference from "many independent artifacts agree" to
  "the claim is well-supported."
