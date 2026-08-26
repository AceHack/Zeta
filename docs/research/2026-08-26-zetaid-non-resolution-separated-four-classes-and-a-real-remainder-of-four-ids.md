# ZetaId non-resolution separated: four classes, and a real remainder of four ids

**Date:** 2026-08-26 · **Author:** shadow · **Tree:** `a573aa324377143cd75a665239429667bfbd80e0`
**Classifier:** `src/Core.TypeScript/hygiene/classify-zetaid-nonresolution.ts` (+ `.test.ts` — 20 falsifiers, 10 mutations, all kill)

Register: **metered** (falsifier exists and was run) · **consistent with** (measurement compatible,
competitors not excluded) · **speculative** (hypothesis).

---

## 0. The result, and the part of it that is a retraction

I was asked to separate the failure classes behind `audit-task-zetaid-resolves.ts` (AH006) before
proposing any fix. Four separable classes exist. **Three of the four counts I would have reported
were inflated by artifacts, and the honest remainder is four ids.**

1. **The population was misdefined.** The audit is fed **PR bodies only** (`gate.yml:2793`), and
   `extractTaskIds` falls back to scanning all text when no `Task:` line yields an id — which
   `Task: none` triggers. So **cited** ids are promoted to **declared** ones. That bug is real,
   found independently, and fixed in flight by **PR #15607**; I did not touch it. **On the 15 open
   PRs, it accounts for 2 of the 4 live failures.**
2. **The denominator was wrong.** "647 vs 1138 rows ⇒ 64% cannot resolve" is arithmetically true and
   operationally irrelevant: **1 of those 1118 backlog rows is declared by a live PR.** The rest
   were never asked to resolve.
3. **Nobody failed to follow the layout.** Aaron's hypothesis was that non-resolvers *"didn't follow
   the ZetaId layout."* **Zero structural deviations in 1790 ids.** But the *second* half of his
   hypothesis — *"earlier bits determine later bits and are more just random"* — is **exactly right
   and is the load-bearing finding**, in a place neither of us was pointing: **99.6% of the
   `docs/backlog/` corpus shares its first 19 characters with a sibling (largest cohort: 98 ids)**
   against **0.3%** for `workitems/`. That has already produced one live misattribution.
4. **Structure cannot detect fabrication.** The labeled positive is byte-perfect. That null result is
   what forces a protocol rather than a detector.

**#15607 merged at 2026-08-26T11:54:28Z, while this was being written.** The misread class is
closed; the entire remaining live failure is **one mislocated id**. §7.1 records the before/after
on one input — and the fact that this document's own central claim went stale in four hours.

---

## 1. The layout, established rather than assumed

From `zeta-id.gen.ts` (`BIT_MASKS`) and `new-workitem.ts` (`mintWorkItem`) — not from ULID by analogy.

| field | bits | width | what the canonical WorkItem mint writes |
|---|---|---|---|
| `version` | 123..127 | 5 | `1` |
| `timestamp` | 75..122 | 48 | `Date.now()` ms |
| `chromosome` | 70..74 | 5 | `0` (MetaCoherence) |
| `category` | 65..68 | 4 | `8` (WorkItem) |
| *reserved* | 64 | 1 | never written (ex-Firefly, reclaimed NO-SHIFT 2026-08-11) |
| `authority` | 59..63 | 5 | `15` (Standard) |
| `persona` | 51..58 | 8 | `0` |
| `momentum` | 43..50 | 8 | `96` (Normal) |
| `location` | 35..42 | 8 | `0` |
| *unassigned gap* | 32..34 | 3 | no field covers these — `pack` cannot set them |
| `randomness` | 0..31 | 32 | `nextInt64() & 0xffffffff` |

**Metered.** A canonical WorkItem ZetaId has **exactly 32 free bits of 128**. Encoding is MSB-first
Crockford base32, so character *i* covers bits `129−5i .. 125−5i`; the first character carrying any
randomness is index **19**. Therefore:

> **Characters 0..18 are a pure function of the mint timestamp. All entropy is in characters 19..25.**

Pinned by a test that fails if the constant moves one character in *either* direction (M2/M3).

---

## 2. The corpus, measured

`workitems/**` and `docs/backlog/**`, ZetaId-prefixed `.md` filenames.

| | `workitems/` | `docs/backlog/` |
|---|---|---|
| ZetaId-keyed rows | **672** | **1118** |
| structurally valid mints | 672 (100%) | 1118 (100%) |
| deviations in the seven constant fields | **0** | **0** |
| bits 32..34 nonzero · implausible timestamps | 0 · 0 | 0 · 0 |
| **midnight-exact timestamps** | **1** | **1105 (98.8%)** |
| reserved bit 64 set | 165 of 672 | **1118 of 1118** |
| **share first 19 chars with ≥1 sibling** | **2 (0.3%)** | **1113 (99.6%)** |
| largest 19-char cohort | 2 | **98** |
| distinct 7-char tails | 672 of 672 | 1118 of 1118 |

**Metered: nobody failed to follow the layout.** The `docs/backlog/` population came from a
*different minter* — `legacy-b-id-zetaid.ts` `legacyZetaIdFromBId`, whose `timestampForLegacyBId`
parses the row's `created:` frontmatter, which is a **date, not a datetime**, yielding midnight UTC;
its randomness is a deterministic FNV-1a→splitmix64 hash of the `B-NNNN` id rather than crypto. Same
`pack`, same signature, **day granularity**.

**This is Aaron's hypothesis, with its mechanism corrected.** "Earlier bits determine later bits" is
true *by design* — it is what makes `ls workitems/` chronological. The defect is that when those
earlier bits are quantised to a day, **98 items collapse onto one visual prefix** and all
discriminating information sits in the last 7 characters, where a human eye — and an LLM copying
from a directory listing — is weakest.

---

## 3. Class separation

### 3.1 First, the input-surface class — and why it changes every count

`gate.yml:2793` pipes **`$PR_BODY`** into the audit. Nothing else. So the population is *PR bodies*,
and the question "was this id **declared** or merely **cited**?" must be answered before "does it
resolve?" — the line `.claude/rules/workitems-mint-with-zetaid.md` already draws for the legacy
scheme: *"naming an existing legacy id in prose is not minting."*

**Live surface — all 15 open PRs:**

| | count |
|---|---|
| bodies carrying `Task: none` | **12** |
| bodies with a real ZetaId `Task:` declaration | 3 (2 distinct ids) |
| **would fail the audit today** | **4** |
| **would fail reading declarations only** | **2** |
| ⇒ failures attributable to the misread | **2 of 4** |

**Counterfactual replay over 400 merged PR bodies:** 283 `Task: none` · 107 real declarations (75
distinct) · 7 bodies where citations are promoted · 16 would fail today vs 15 declarations-only ·
**exactly one distinct declared non-resolving id.**

**Latent blast radius, on a surface the audit does *not* currently read.** Over all 15861 commit
messages on `main`: 176 carry a declared ZetaId `Task:` (62 distinct), but **1451 (9.1%) contain ids
the audit would see and git's trailer parser does not** — **458 distinct promoted ids, 48 of them
non-resolving.** If the audit's input were ever widened from PR bodies to commit messages, the
misread class would go from a minority of failures to **94% of them (48 of 51)**. Recorded because
it prices the bug rather than merely naming it.

*My merged-history census used `git log --format=%(trailers:key=Task,valueonly)` — git's own trailer
parser — so the 62/59/3 split below was never contaminated by the misread. That was luck in method,
not foresight.*

### 3.2 The remaining classes, and their total population

Over the 62 distinct ids ever **declared** in a merged commit trailer, plus the live PR-body
declarations:

| class | ids | remedy |
|---|---|---|
| `resolves-workitem` — the gate's accept set | **59** | none |
| `resolves-backlog` — **mislocated**, correct row, wrong folder | **3** | resolver, or move the file |
| **misattributed** — resolves, to the **wrong** row | **1** (also counted above) | correct the source |
| `unminted` — structurally perfect, no file anywhere | **1** | **not a resolver problem** |
| `malformed` — cannot have come from `pack()` | **0** | — |

**The complete real population, four ids, one per class:**

| id | class | note |
|---|---|---|
| `081KSKBP80008QG0R001KK9WV6` | mislocated | **the live one.** Declared by the heartbeat flush lane (#15550/#15551); resolves to `docs/backlog/P1/…-agent-heartbeat-folder-direct-to-main-zetaid-filenames-no-pr.md` — *exactly the right row*, wrong folder. |
| `081KS923C0008QG0R002BKAC95` | mislocated | manifesto-citation cron lane; correct row. Declared 2026-07-01 → 2026-08-13 (43 commits). |
| `081KT7YW00008QG0R002T1XNWT` | **misattributed** | see §3.3. Declared 2026-06-22 → 2026-08-13 (53 commits). |
| `081M03CKBBX087G0R003M24FGG` | unminted | one commit, `f0ee2ef19e`. See §4. |

Both cron lanes stopped declaring a ZetaId after **2026-08-13** and now emit `Task: none`, so their
53+43 commits are historical, and #15607 has now merged. **The live failure is one id:**
`081KSKBP80008QG0R001KK9WV6`.

### 3.3 The misattribution — the finding that bounds the fix

**Metered.** `.github/workflows/context-cost-trend-cadence.yml` names
`081KT7YW00008QG0R002T1XNWT` in its header comment (line 3), its roster (line 24), its commit subject
(line 154), and — until 2026-08-13 — its `Task:` trailer. That id **resolves**: to
`docs/backlog/P1/081KT7YW00008QG0R002T1XNWT-canonical-yaml-never-collapse-empty-collections…`, a row
closed 2026-06-04 about YAML encoding. The row the workflow describes itself as serving is:

```
docs/backlog/P0/081KT7YW00008QG0R003JV9D4J-context-window-minimization-as-most-rigorous-proof-nci-bound.md
```

```
081KT7YW00008QG0R00 2T1XNWT   ← stamped   (canonical-YAML, closed 2026-06-04)
081KT7YW00008QG0R00 3JV9D4J   ← intended  (context-window minimization, P0)
└──── 19 identical ────┘         both minted "2026-06-04T00:00:00Z" by the backfill
```

This is **orthogonal** to the resolution classes, because **misattribution is a property a RESOLVING
id can have.** It is also the class the gate is *structurally blind to*, and it got worse when the
lane switched to `Task: none`: the wrong reference is still in the subject line and the comments, and
now nothing looks at it at all.

> **Therefore widening the resolver to `docs/backlog/` would turn this reference GREEN while it stays
> wrong.** A gate that accepts a wrong answer is strictly worse than one that rejects a right answer.
> This is the measured reason the brief's bound holds — not a stylistic preference.

The classifier reports the 19-character cohort for **resolving** ids precisely so this stays visible;
it surfaces the intended row automatically, and a test pins it.

---

## 4. The null result — structure cannot detect fabrication

Labeled positive: `081M0X0JQGY087G0R000EBCPQ3`, written into a trailer by the shadow on 2026-08-25
without being minted. **Verified rather than assumed:** it appears in **zero** merged commit trailers
on `main` — it was caught before merge, exactly as the audit's own header records. It is a labeled
positive *from the incident record*, not from history. The on-main instance of the same class is
`081M03CKBBX087G0R003M24FGG`, which **is** a genuine merged declaration.

**Metered — every structural test returns clean on both:**

| test | `081M0X0JQGY087G0R000EBCPQ3` |
|---|---|
| canonical 26-char Crockford | ✅ |
| the seven constant fields | ✅ all exact |
| bits 32..34 zero | ✅ |
| timestamp | `2026-08-25T17:48:07.582Z` — **the day it was written** |
| granularity | **millisecond** — not the backfill's midnight |
| reserved bit 64 | **CLEAR** — the post-2026-08-11 epoch |
| nearest known id (Hamming, 1918 ids incl. alias map) | **9 of 26** |

Two of these are stronger than "no signal", and point the same way:

1. **Bit 64 is clear.** All 1118 backlog ids and 165 of 672 `workitems/` ids carry it **set**. Any id
   copied from a visible pre-reclaim template would read `QG0R`; this reads `7G0R`. It matches the
   *minority, current* epoch.
2. **No near neighbour.** Minimum Hamming distance 9 (and 10 for `081M03CKBBX087G0R003M24FGG`). The
   transcription-error hypothesis is **falsified** for both.

> **Consistent with** (competitors not excluded): the id was produced by `pack()` — a mint that ran
> whose file was never written or committed — rather than composed character by character. A
> hand-composed string agreeing with seven constants, a zero gap, a millisecond wall-clock *and* the
> minority epoch bit is a coincidence I cannot price, so this stays out of the metered register.

**The load-bearing conclusion is negative:**

> **No structural test separates an unminted id from a genuine one, and this analysis suggests none
> can** — the unminted id appears to be *the real minter's own output*. A detector would have to
> distinguish two strings from the same function. **The protocol cannot rest on detection.** It rests
> on the one surviving asymmetry: a minted id has a **file**, and a file is a fact about the tree
> rather than a property of the string.

Pinned as a live falsifier (`the labeled fabricated id is structurally PERFECT`). If a structural
detector ever becomes possible that test goes red and this section must be rewritten — which is why
a null result is worth more as a test than as a sentence.

### 4.1 The attribution — budget, not deceit

`.claude/rules/never-assume-malice-where-mistake-is-possible.md` uses this exact defect as its
canonical example, and the measurement supports its diagnosis rather than restating it. Both unminted
ids sit at the end of long, dense sessions, and both name work that **genuinely existed** —
`081M03CKBBX087G0R003M24FGG`'s commit reasons in detail about "gap (2)" of a real item and even
self-reports a separate methodological error in the same message. That is an intelligence at the edge
of an allocated budget producing *incomplete-but-plausible* output: the trailer was reached for, the
mint command was not run.

**Name the defect precisely and attribute it to the budget — both halves.** The defect: *a well-formed
key that identifies nothing is the vacuity class in code.* It is still wrong and still gets fixed. It
is not evidence about anyone's intent.

---

## 5. The ZetaId mistake-resolution protocol

**Proportionality first, because the measurement demands it.** The real population is **four ids**.
Do **not** build machinery for that. What follows is deliberately the *cheapest thing that could
work*: a convention that reuses enforcement the repo already runs, plus an order of remedies. No new
gate, no new index, no new tool. If the protocol ever needs more than this, the population changed
and that is the trigger to revisit it.

**Constraints, from the rules rather than invented.** A trailer in a merged commit is a **fact**;
correcting it is an **additional record**, never an edit. History is never rewritten. The shape
exists: `<!-- b-ref-adjudicated: … -->` in `.claude/rules/workitems-mint-with-zetaid.md`, whose
vocabulary is *closed* and whose evidence is **checked, not trusted** (`b-ref-resolve.ts`: path must
exist, may not be the annotating file, unknown disposition refused, and an annotation whose ref later
resolves fails as **STALE**).

### 5.1 The annotation

```
<!-- zetaid-adjudicated: <id> <disposition> <evidence-path> -->
```

The same five machine-checked conditions, carried over unchanged: (1) the line must also mention
`<id>` **outside** the comment; (2) `<disposition>` ∈ the closed vocabulary; (3) `<evidence-path>`
must exist; (4) a document may not be its own evidence; (5) an annotation whose id **now resolves**
fails as **STALE** — it expires when reality changes.

### 5.2 The disposition vocabulary — one row per class actually measured

| disposition | when | evidence | worked instance |
|---|---|---|---|
| `mislocated` | resolves under `docs/backlog/`, and it is the **right** row | the row's path | `081KSKBP80008QG0R001KK9WV6` |
| `misattributed` | resolves, to the **wrong** row | **both** paths, intended first | `081KT7YW00008QG0R002T1XNWT` |
| `remint-forward` | referent real and identifiable; a fresh id was minted | the new row's path | — |
| `retired` | the work is gone, done, or moot | what makes it moot | — |
| `unknowable` | referent unrecoverable from any surviving record | the audit that searched | `081M03CKBBX087G0R003M24FGG` |

`misattributed` is the one worth having built even at this population size: **it is the only class
that is green today.**

### 5.3 The four remedies, in the order they are tried

Cheapest and most reversible first; **stop at the first that holds.**

**(1) Annotate in place.** Always safe. One line, rewrites nothing, adds a record. For `mislocated`
and `misattributed` this may be the whole remedy.

**(2) Correct the SOURCE, never the history.** The misattribution is *three hardcoded strings in one
workflow file*. Fixing them touches no past commit. **This, not a resolver change, is the actual fix**
— and it is now the only fix, because the lane no longer emits a `Task:` trailer at all, so no gate
change could reach it.

**(3) Remint and forward-map.** Referent real, no id: mint a new work-item and record the mapping
keyed by the dead id, as `b-to-zetaid-map.json` already does for 1251 `B-NNNN` ids. **Forward only:**
the dead id is never reused, reassigned, or removed from the commit carrying it. Resolution then means
*"this id maps to that item"* — a weaker claim than *"this id is that item"*, and the map says which.

**(4) Retire.** Annotate with evidence and stop. **Retiring is not deleting:** id and annotation both
stay auditable forever.

### 5.4 When the referent is genuinely unknowable

§4 guarantees this case occurs: an unminted id is *a function's output*, so there may be no record of
what it was for.

**`unknowable` is a MEASURED verdict, not a shrug.** Admissible only with evidence that a search **ran
and came back empty** — minimum, the classifier's output (class, structural verdict, nearest
neighbours, prefix cohort) plus the carrying commit. `081M03CKBBX087G0R003M24FGG` is the worked case:
its commit describes the work in detail while the id names nothing, so `unknowable` means *"the
trailer's referent is unrecoverable"*, not *"the work is unknown"*.

**What must never happen — the reason the whole exercise exists:** the id must not be quietly deleted
from the trailer's authored copy, and the gate must not be widened until the id happens to fall inside
the accept set. Both make the ledger *look* clean by destroying the evidence that it is not. **Let
unknown be unknown.** The count of `unknowable` adjudications is a **metric of budget exhaustion in
the fleet**, and it is worth more as a number that goes up than as a mess that got tidied.

### 5.5 Guards against the protocol becoming a laundry

1. **Checked, not trusted** — all five conditions machine-verified, as `b-ref-adjudicated` already is.
2. **STALE is a failure** — an adjudication that outlives its cause goes red.
3. **Adjudication never counts as resolution.** An adjudicated id is *accounted for*, not *resolved*.
   Keep them separately countable or the adjudication becomes the vacuity it exists to record.

---

## 6. What Aaron must decide

Nothing below was done. The deliverable is a classifier and this document.

1. **Nothing blocks on the resolver.** **#15607 has merged** (2026-08-26T11:54:28Z) and two of the
   four live failures went with it — verified as an A/B on one input in §7.1. What remains is **one
   mislocated id**, `081KSKBP80008QG0R001KK9WV6`, declared by the heartbeat flush lane and resolving
   to exactly the right row in the wrong folder. **My read: re-measure now that it has landed;
   only the mislocated id is left, and decision 4 is what settles it.**

2. **Widen AH006 to `docs/backlog/`?** The measurement does **not** support it on the brief's terms:
   the mislocated class is 3 ids, and the widening would turn the *misattribution* green. **My read:
   no — or not alone.** If widened, pair it with the prefix-cohort warning so a
   resolving-but-ambiguous id stays visible.

3. **Or move one file?** `081KSKBP80008QG0R001KK9WV6` is the heartbeat lane's own work item. Moving
   that single row into `workitems/` clears the live failure, touches no gate topology, and keeps the
   audit's scope honest. Out of my bounds (the brief forbids moving files), and the narrowest option
   on the table.

4. **The question underneath 2 and 3, which only Aaron can answer:** **is `docs/backlog/` a live index
   or an archive?** If live, the audit's scope is a defect. If archive, it is correct and the three
   mislocated ids are the ones out of place. Everything else follows from this and nothing else
   should be decided before it.

5. **Fix the misattributed workflow strings?** Three lines in
   `context-cost-trend-cadence.yml` point at a closed YAML row instead of the P0 context-window row.
   No gate can catch this now. A one-line-per-site correction.

6. **Adopt `zetaid-adjudicated`?** It extends an already-enforced mechanism, and enforcement can be
   added to `lint-b-refs-resolve.ts` rather than as a new gate. **Honest counter-argument: the
   population is four.** Adopt it for the `misattributed` class or defer entirely; do not adopt it as
   general infrastructure.

7. **Mint granularity, for the future.** No re-minting (that would violate every rule in sight), but
   a future bulk mint should be told: **a day-granular timestamp throws away 7 of the 19 determined
   characters and makes misattribution near-certain at scale.** Worth a line in `new-workitem.ts`'s
   header if Aaron agrees.

---

## 7. Falsifiers and honest limits

**20 tests, 56 assertions.** Ten mutations applied to the classifier, suite re-run each time, each
mutation asserted to have actually applied before the run:

| # | mutation | result |
|---|---|---|
| M1 | drop `momentum` from `MINT_SIGNATURE` | 1 fail ✅ |
| M2 / M3 | `DETERMINED_PREFIX_CHARS` 19 → 18 / → 20 | 1 fail / 3 fail ✅ |
| M4 | delete the bits-32..34 zero-gap check | 1 fail ✅ |
| M5 | `structuralViolations` always clean | 6 fail ✅ |
| M6 | `classify` collapses `resolves-backlog` into `unminted` | 2 fail ✅ |
| M7 | delete the timestamp-era check | 1 fail ✅ |
| M8 | `declaredTaskIds` accepts any `Task:` value | 3 fail ✅ |
| M9 | `declaredTaskIds` scans all text (reintroduces the #15607 bug) | 4 fail ✅ |
| M10 | `declaredTaskIds` always returns nothing | 1 fail ✅ |

Control after restore: **20 pass, 0 fail.**

**Owned errors, recorded because they are the defects this repo keeps catching:**

- **A mutation that never ran, reporting as one that was survived.** M6's first attempt used a
  multi-line `perl -0pi` substitution that silently matched nothing; the suite stayed green and I
  nearly recorded "M6 survives" as a finding about the tests. Re-run with an `assert pattern in
  source` guard, it kills 2. That guard then caught two *more* vacuous mutations (M8/M9 under shell
  escaping) before they could be misreported. Every row above passed the guard.
- **A check that never ran, reporting rc=0.** I read `npx tsc`'s exit code through a pipe and got 0;
  the real exit was 1, and the real message was *"This is not the tsc command you are looking for"* —
  TypeScript is not installed in this worktree. **No local typecheck was performed.** CI is the check.
- **`git stash -u` in a worktree.** I ran it reflexively; it stashed all three deliverable files into
  the *shared* stash index that `.claude/rules/shared-checkout-is-view-only.md` warns is racy across
  worktrees. Verified by content and popped immediately, nothing lost. It should not have been run.

### 7.1 This document's own PR was an instance of the bug — and the claim went STALE while I wrote it

**This section is a correction, and the correction is the finding.** The PR carrying this document
cites all six ids named above in prose and carries `Task: none` — exactly the shape §3.1 describes.
Measured at the tree this document was written against (`a573aa3243`, before #15607), piping its body
into the audit as `gate.yml:2793` does:

```
task-zetaid-resolves: UNRESOLVABLE — 6 of 6 Task id(s) against 672 work-item(s).      exit 1
```

All six are citations. **Zero are declarations.** So I predicted `cross-verify` would be red on this
PR for the reason this PR documents.

**It was green.** #15607 merged at **2026-08-26T11:54:28Z**, before this PR's checks ran, so CI built
a base containing the fix. Re-running the *identical* body against the audit as merged to `main`:

```
task-zetaid-resolves: no Task ids in the input (index: 672 work-items).                exit 0
```

**A/B on one input across one commit: 6-of-6 UNRESOLVABLE → 0 ids seen.** That is a stronger result
than the prediction was, and it is the measurement §3.1 deserved rather than the counterfactual I had
to settle for. It also independently confirms #15607's fix on a body neither of us constructed for
the purpose.

**The methodological point, which is the reason this section was rewritten rather than deleted.** The
claim was TRUE when written and FALSE four hours later, because the defect it described got fixed.
That is precisely the **STALE** condition §5.1(5) imposes on adjudications — *an annotation whose id
now resolves fails as stale* — applied to a research claim instead of a comment. A finding about a
live defect carries an expiry date it does not print, and the honest handling is to re-run it before
publishing and record both readings, not to quietly drop the one that stopped holding. Exit codes
here were read **directly**; reading this one through `grep` reports 0 in both arms, which is the same
defect in a third costume.

**Limits:**

- `markdownlint` ignores `docs/research/2026-*-*.md`; an rc=0 there is **vacuous** and is not claimed.
- The 400-merged-PR replay is a **counterfactual** — those PRs merged before AH006 existed. It
  measures the predicate's behaviour on real bodies, not observed failures.
- The 62/59/3 merged-history split covers **merged commit trailers only**. PR-body declarations are a
  separate surface, which is where `081KSKBP80008QG0R001KK9WV6` lives.
- "Consistent with `pack()` produced it" (§4) is deliberately **not** metered.
- The classifier **is not wired into CI** and exits 0 unconditionally. A classifier that can redden a
  gate is a gate, and the argument here is that the gate must not move until decision 4 is made.

---

## 8. Anchors (Beacon)

- **Crockford base32** — Douglas Crockford, *Base32* (2002). The `I/L/O/U`-free, ASCII-ascending
  alphabet whose monotonicity makes string sort ≡ numeric sort, and therefore makes the 19-character
  determined prefix a *provable* rather than incidental property.
- **ULID** (Alizain Feerasta, 2016) — the timestamp-high-bits + entropy-low-bits construction this
  layout follows. Its known, accepted trade-off is exactly §2's measurement: **monotonic sortability
  is bought with prefix similarity**, which becomes a human-factors hazard at coarse granularity.
- **Hanlon's razor**, in the sharper form carried by
  `.claude/rules/never-assume-malice-where-mistake-is-possible.md`: the diagnosis is *missing
  context* — here an exhausted budget — not deficient character. §4.1 applies that rule to its own
  canonical example with a measurement attached.
- **Data Vault 2.0 hub-key scope** (Dan Linstedt) — *"a hub is only as stable as the SCOPE of the key
  you chose."* ZetaId is globally unique and therefore top-of-scale by that ranking; §2 shows a key
  can still be *operationally* weak when the **generator's input** is quantised. Scope and resolution
  are different properties of a key, and only the first was being reasoned about.
- **Mention vs use** (Quine, *Mathematical Logic*, 1940) — §3.1's distinction is the use/mention
  distinction in a linter: `extractTaskIds` reads a *mentioned* id as a *used* one. Naming it that way
  is what makes it a category error rather than an off-by-one.
- **Neutral detection** — the classifier reports the fact (`unminted`, `prefix-cohort=4`) and never
  the verdict, per `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md`. Whether an
  unminted id is carelessness or exhaustion is not something a measurement can say, so it does not.
