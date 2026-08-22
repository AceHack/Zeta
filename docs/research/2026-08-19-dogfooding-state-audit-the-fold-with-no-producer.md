# Dogfooding state audit — the fold with no producer

**Date:** 2026-08-19 · **Author:** Daya (agent-experience) · **Register:** Mirror inventory,
Beacon-anchored where load-bearing · **Authority:** advisory. Nothing below is executed here.

Carved sentence:

> Dogfooding here already has a definition, a ledger, and two audits. What it does not have
> is a **producer**: the two surfaces named as its centre — `data/zetadb/journal.json` and
> `clis/Verbs.fs` — both ship an **eliminator with no introduction form**, so the loops
> around them run on schedule and cannot change state. The smallest honest next step is not
> a new lane; it is to give one of them a writer, or stop running it.

---

## 1. What dogfooding already means here

Not proposed here — already stated, and cited rather than paraphrased.

| Source | What it fixes as the meaning |
|---|---|
| `docs/trajectories/dogfooding-the-whole-stack/RESUME.md` | The canonical definition and the 17-row ledger. Aaron 2026-08-09: *"dogfooding is our next big trajectory — we've been building to the point we can dogfood, we are there now."* Scope is explicitly **both at once**: *"on the github free workflow runners **and also on our local hardware at the same time**."* The grading vocabulary is that file's: `dogfooded` = *we run our own thing in earnest*; `partial` = *runs, but not as the real dependency*. |
| `docs/research/2026-08-16-dogfooding-gap-inventory-what-zeta-runs-on-versus-what-zeta-builds.md` §0a–0b | The two returns, kept separate: dogfooding is a **requirements source** (*"one real dependent tells you which two you actually need, and at what fidelity"*) and a **free test** supplying the non-deterministic tail DST cannot. §1 adds the honesty grades READY / PARTIAL / **STUB**, and the rule that *"a dogfooding row whose substrate is a stub is a feature request, not a switch."* |
| `docs/research/2026-08-09-zetadb-as-compiler-of-compilers-db-as-types-cells-anywhere-dogfood-audit-aaron.md` | The original six-surface audit the ledger extends. |
| `workitems/081M08VM385087G0R001DTM0K6-compile-clis-verbs-fs-*.md` | Aaron 2026-08-17: *"clis/Verbs.fs this is our ultimate dogfood surface plus our universal interfaces."* |
| `memory/feedback_workflow_engine_eventually_replaces_github_pr_process_currently_dogfooding_target_state_github_becomes_backup_fork_protection_aaron_2026_05_28.md` | The oldest statement of the target state: the workflow engine replaces the GitHub PR process; GitHub becomes backup. |

**So the definition in force is: our own substrate becomes the real dependency of our own
operation, on more than one tick substrate simultaneously, and we keep it for the
requirements and the free tests it returns.** There is no gap in the *definition*. This
audit is only about the distance between it and the observed state.

---

## 2. The measured gap

Every number below is reproducible from the command in its row. Measured on `origin/main`
at `d59cd4a` (2026-08-19T17:04Z).

### 2a. Metered — the ZetaDB row is a scheduled loop that cannot change state

This is the finding. The trajectory grades ZetaDB `partial` (row 10) and its
`journal -> fold -> checkpoint` chain `running` (row 14). Both are true as *"the code
executes."* Neither is true as *"the real dependency."*

| Fact | Value | How to reproduce |
|---|---|---|
| Fold cadence | cron `13,43 * * * *` = **48 runs/day** | `.github/workflows/zetadb-scheduled-node.yml:9` |
| Journal contents | **one** delta, `genesis/browser-node-v1`, 247 bytes | `git show origin/main:data/zetadb/journal.json` |
| Times the journal has **ever** been written | **1**, on 2026-08-09 (#10206) | `git log origin/main -- data/zetadb/journal.json` |
| Checkpoint | 480 bytes, `"revision": 1`, one entry, unchanged 10 days | `git show origin/main:data/zetadb/checkpoint.json` |
| Files referencing the journal path | **2** — the workflow that reads it, the module that folds it | `git grep -l 'zetadb/journal' origin/main` |
| Non-doc consumers of the checkpoint | **0** other than its own writer | `git grep -l 'zetadb/checkpoint' origin/main` |

So roughly **480 folds since 2026-08-09 have each printed the workflow's own
`"No new database events to checkpoint."`** (`zetadb-scheduled-node.yml:47`).

**`scheduled-node.ts` (241 lines) exports a reader and a fold and no append.** There is no
writer for this journal anywhere in the tree — not a missing caller, a missing *function*.

The cost side is what makes this worth a document rather than a note. Four commits of
engineering have landed on `src/Core.TypeScript/zetadb/`, the most recent yesterday:
**#12043, 2026-08-18, "make the journal fold commutative and the checkpoint byte-canonical."**
Commutativity and byte-canonicity are exactly the right properties for this fold to have —
and they are properties of a fold over a one-row journal that nothing writes to. The
correctness of an instrument was improved; the instrument still measures one row placed by
hand ten days ago.

Stated in the repo's own vocabulary: a loop whose output cannot differ between runs is the
**vacuity class** — `.claude/rules/toy-is-free-metered-must-be-earned.md`, and the
REFERENCE-ONLY disposition named in `no-binary-in-proof-lineage.md` ("the file is compared
to itself"). The 2026-08-16 inventory §1 already carved the rule this row fails:
*"a dogfooding row whose substrate is a stub is a feature request, not a switch."*

### 2b. Metered — the same shape, independently, on the other named dogfood surface

`workitems/081M08VM385087G0R001DTM0K6` found on 2026-08-17 that `clis/Verbs.fs` —
Aaron's *"ultimate dogfood surface"* — **"declares eliminators for `ISim<'a>` and no
introduction form."** Its documented loop `sim |> mea |> cut` does not typecheck, for two
independent reasons, both reproduced against the compiler.

Two surfaces, found by two different agents two days apart, with the identical defect:
**a consumer built before any producer.** That is not a coincidence worth one entry each;
it is a pattern worth naming once.

> **Beacon anchor:** Gentzen (1935), *Untersuchungen über das logische Schließen* — the
> harmony requirement between introduction and elimination rules. An elimination rule with
> no matching introduction rule is not *wrong*; it is **unusable**, because nothing can ever
> be in a position to be eliminated. That is precisely the state of both surfaces, and it
> explains why neither produces a failure: an unusable rule is never applied.

*Register: the anchor is checked, not decorative — the entailment is that intro-less elim
is inert, which is the measured behaviour in 2a (480 inert runs). It is a structural
analogy to natural deduction, not a claim that either surface is a proof system.*

### 2c. Metered — the trajectory's own status surface is 3 days stale in the direction that misdirects

The RESUME's `Current blocker:` says the society's tick lanes are **down** since
2026-08-15T23:06Z, and grades ledger row 1 `dogfooded but DOWN`.

Measured at 2026-08-19T17:11Z: **the lanes are up.**

| Lane | Tip |
|---|---|
| `origin/heartbeat/alexa` | 2026-08-19T17:11:19Z |
| `origin/heartbeat/otto` | 2026-08-19T17:10:54Z |
| `origin/heartbeat/soraya` | 2026-08-19T16:47:39Z |

Flushes are landing too: **2** open flush PRs out of **26** open PRs total. Row 3 (society
evolution loop) is the ledger's one genuinely-verified `dogfooded` row —
`docs/observe-events/society-index.json` carries **340** hash-chained events, latest
**2026-08-19T16:44:43Z**. Workitem `081M05G8D36087G0R0034D3QPA` is still `state: backlog`
though its symptom has cleared.

This is drift, not error — the file was accurate when written. The cost is specific: the
next cold-started agent reads *blocked* and routes elsewhere, and the one row that is
actually working reads as broken while the row that is actually inert reads as running.

### 2d. Metered — dogfooding is absent from every surface on the wake path

| Surface | Occurrences of "dogfood" |
|---|---|
| `AGENTS.md` | 0 |
| `GOVERNANCE.md` | 0 |
| `docs/BACKLOG.md` | 0 |
| `docs/ALIGNMENT.md` | 0 |
| `docs/VISION.md` | 0 |
| `docs/WAKE-UP.md` | 0 (and 0 for "trajectory") |

`CLAUDE.md` §2 routes every agent to *"active trajectories: `docs/trajectories/*/RESUME.md`"*.
That is **27 files totalling 317,831 bytes** (~310 KB, order 80k tokens), of which **26**
carry a `Status:` line reading active and **20** were last refreshed before 2026-08-01. The
dogfooding RESUME is 11,023 bytes — **3.5%** of that set, typographically indistinguishable
from the other 26.

So the trajectory the maintainer named *the next big one* costs either a 310 KB undirected
read or a `grep` to discover. No persona is failing to read it; the index does not
distinguish it.

### 2e. Metered, and it corrects a number in circulation — the closure metric disagrees with itself

The figure "8 of 277 work-items ever closed" is currently being quoted. It is an artifact of
which counter you read:

| Counter | Value |
|---|---|
| `workitems/*.md` with `state: closed` | **8** |
| `workitems/done/**/*.md` | **112** (2026/06: 28 · 07: 23 · 08: 61) |
| `workitems/*.md` total | 278 (255 backlog · 11 `in-progress` · 2 `in_progress` · 8 closed · 1 done) |

Every work-item body carries the lifecycle sentence *"completion moves the file to
`workitems/done/YYYY/MM/`"* — so the folder is the source of truth and **112** is the real
closure count. The **8** are items whose frontmatter was updated but which were never moved:
the field and the folder disagree. The two spellings `in-progress` (11) and `in_progress`
(2) are the same drift in miniature.

*Register: `metered` as counts. The interpretation — that closure is or is not healthy — is
**unmetered** and not claimed here.*

### 2f. Unmetered — where the hands are

7 days (2026-08-12 → 08-19) on `origin/main`: **1,910 commits, 20,052 file-touches.**

| Area | Touches |
|---|---|
| `docs/` | 13,391 (67%) |
| `src/` | 1,452 (7.2%) |
| — of which `src/Core.TypeScript/hygiene` | 208 |
| — of which `src/Core` (the F# substrate) | **113** |

`hygiene` alone received **1.8x** the file-touches of the entire F# core.

**This is a count of file-touches, not of value, and it does not by itself demonstrate
misallocation** — docs are cheap to touch, F# modules are not, and a 10-line correctness fix
can outweigh a thousand doc lines. What it does show is where the hands are, and it is
consistent with the ZetaDB row in 2a, where the most recent work hardened the instrument
rather than supplying the input. That consistency is a **coincidence index, not a
confirmation** (`.claude/rules/numerology-vs-number-theory.md`); it licenses looking, not
concluding.

### 2g. What I could not measure

- **Local-hardware dogfooding.** The ledger's row 2 (4 launchd cells on the maintainer's
  laptop) cannot be verified from a clone. Aaron's stated target is runners *and* local
  simultaneously; I can measure only the runner half. Anything I said about the local half
  would be inference from a filename.
- **Whether the free tests are still free.** The 2026-08-16 inventory's act-on-it item (2) —
  `workflow_dispatch` `accelerator-local-llm-validate` with `ZETA_INSTALL_FULL: "1"` — needs
  a run, not a read.
- **Whether any of this is the highest-value work.** Advisory audit; that call is Kenji's.

For the record, of that inventory's three act-on-it items: **(1) landed** (`~/.rustup` +
`~/.cargo` are in the `install-v2-*` cache paths, `gate.yml:602-607` et al., 2026-08-16);
**(2) not done** — `curl -fsSL https://ollama.com/install.sh | sh` is still live at
`mux-swarm-tick.yml:41` and `arc-swarm-fanout.yml:78`; **(3) partially moot** — `lua5.4` is
in `tools/setup/manifests/apt:121`, `golang-go` is not.

---

## 3. Smallest next step

**Constraint taken seriously:** a dogfooding proposal that adds surface without closing
anything makes the measured problem worse. So the proposal below adds **no** workflow, **no**
lane, and **no** doc surface.

### The step: give `data/zetadb/journal.json` exactly one real producer — or retire its cron

It is one choice with two acceptable answers, and either is a closing move:

**Option A — supply the introduction form.** The society heartbeat already emits real events
on a live 30-minute cron, hash-chained, 340 of them. Have that lane append one delta per
generation to the journal. ZetaDB then becomes the real store of a workload that already
exists, which is the trajectory's own row-10 criterion verbatim: *"dogfooding means being
the real dependency; a checkpoint file is not yet that."*

**Option B — stop the cron.** If nobody will write to it, 48 inert folds a day is
instrumentation with no subject, and deleting the schedule closes a row honestly.

**Cost of Option A, named rather than minimised:**

1. **It arms a known race.** Workitem `081KZM0FTJM` records that the fold has no
   cross-substrate concurrency guard. Today the race cannot fire because the fold is inert.
   A producer is what makes it live. *This is the cost, and it is also the point* — an
   unfired race is unmetered, and the trajectory already ranks `081KZM0FTJM` as its #1
   leverage item because it gates the runner+local headline goal. Option A is the thing that
   makes that item's fix testable.
2. **It touches a live cron lane.** `tick-must-never-stop` cost 12 hours once. Degrade,
   don't halt: a journal-append failure must not fail the society tick.
3. **It is genuinely new code** — `scheduled-node.ts` has no append path, so this is a
   function to write, not a caller to wire. Estimate is not offered; I have not written it.

**What it returns, if it returns anything** *(register: `unmetered` — this is a prediction,
and the honest form of the 2026-08-16 inventory's own thesis, not a measurement)*: the first
real dependent tells us which of ZetaDB's unbuilt pieces are actually needed, and the 48
daily folds stop being ceremony and start being a free test that can fail.

**Closes:** the ledger's row 10/14 ambiguity either way, and — under Option A —
`081KZM0FTJM` becomes reproducible rather than theoretical.

### Two near-zero-cost corrections, mentioned because they are cheaper than this document

Not proposed as work; they are one-line edits any agent already in those files can make.

- `docs/trajectories/dogfooding-the-whole-stack/RESUME.md` — the `Current blocker:` line and
  ledger row 1 are measurably stale (§2c). The lanes are up.
- The 8 `state: closed` work-items in `workitems/*.md` have never been moved to
  `workitems/done/` (§2e), which is what makes the closure metric quotable at 8 instead of 112.

---

## 4. Register summary

| Claim | Register |
|---|---|
| What dogfooding means here (§1) | **cited** — quoted from the files that say it, not inferred |
| §2a ZetaDB counts, §2c lane tips, §2d byte counts, §2e work-item counts, §2f touch counts | **metered** — each row carries its reproducing command |
| §2b Gentzen harmony as the shape of both defects | **metered as a structural claim** (the inertness is observed); **analogy, not identity** |
| §2f "the hands are on instrumentation" as a *diagnosis* | **unmetered** — explicitly not claimed |
| §3 "a real dependent yields requirements" | **unmetered** — a prediction, restating the 2026-08-16 thesis |
| Local-hardware half of the ledger | **unmeasured** — stated as such (§2g) |

## 5. Pointers

- `docs/trajectories/dogfooding-the-whole-stack/RESUME.md` — the ledger this audit measures against
- `docs/research/2026-08-16-dogfooding-gap-inventory-what-zeta-runs-on-versus-what-zeta-builds.md` — the prior audit; §0a/§0b are the definition, §1 the honesty grades
- `workitems/081M08VM385087G0R001DTM0K6-*` — the `clis/Verbs.fs` intro-form finding (§2b)
- `workitems/081KZM0FTJM08QG0R002675YBK-*` — the race Option A would arm
- `workitems/081M05G8D36087G0R0034D3QPA-*` — still `backlog`, symptom cleared (§2c)
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — the three registers used throughout
- `.claude/rules/numerology-vs-number-theory.md` — why §2f is a warning and not a confirmation
- `src/Core.TypeScript/zetadb/scheduled-node.ts` · `.github/workflows/zetadb-scheduled-node.yml` — the fold with no producer
