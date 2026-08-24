---
id: 081M0RBXF6J087G0R0023EX9X2
type: bug
state: backlog
priority: P2
slug: eslint-prettier-and-stylelint-are-configured-pinned-and-name
title: "eslint, prettier and stylelint are configured, pinned and named in CI but never invoked"
created: 2026-08-23T22:30:01.682Z
depends_on: []
composes_with: []
---

# eslint, prettier and stylelint are configured, pinned and named in CI but never invoked

> **SUPERSEDED IN PART, 2026-08-24 — read this before the finding below.** The title's "never
> invoked" was **true when filed (2026-08-23T22:30:01.682Z)** and stopped being true **54 minutes
> later**, when `b1967172d` (2026-08-23T23:24:02Z, PR #14522) put `bunx eslint
> src/apps/twitch-ai/src` into `gate.yml`. **Corrected claim: eslint runs on ONE narrow path and
> no other; prettier and stylelint still run nowhere.** The original measurement is left verbatim —
> it was accurate when made, and a measurement that the tree outran is a supersession, not an error.
> Full timeline, the repo-wide per-path measurement, and what landed: [§ SUPERSESSION
> 2026-08-24](#supersession-2026-08-24-dejan--never-invoked-anywhere-in-the-repo-was-true-when-filed-and-is-stale-now).

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0RBXF6J087G0R0023EX9X2-*.md` glob. -->

## The finding

`src/Core.TypeScript/lint/lint-typescript.ts` opens by describing itself as:

> *"Post-install orchestration of TypeScript tools (**tsc, eslint, prettier, stylelint**)"*

Its `STEPS` array, line 112, contains **exactly one entry**:

```ts
const STEPS: readonly Step[] = [{ label: "TypeScript type check: tsc", cmd: TYPESCRIPT_COMPILER_COMMAND }];
```

**Three of the four documented tools never run.** Measured on `origin/main`:

| tool | configured? | pinned? | named in CI? | **invoked?** |
|---|---|---|---|---|
| `tsc` | yes | yes | yes | **yes** |
| **eslint** | `eslint.config.ts`, strict type-checked, `**/*.ts` | `"eslint": "10.2.1"` | gate.yml step name *"…+ eslint stack"* | **NO** |
| **prettier** | `format:check` script exists | `"prettier": "3.8.3"` | — | **NO** |
| **stylelint** | `lint:css` script exists | yes | — | **NO** |

`git grep` for an actual eslint **invocation** (`bunx eslint`, `npx eslint`, `bun run …`, a `.bin` path,
a workflow `run:` line) across `*.json`, `*.yml`, `*.ts`, `*.js`, `*.toml`, `*.sh`, `*.md` returns
**only the two `package.json` dependency declarations**. No git hook, no husky, no lefthook.

## Why this is the vacuity class and not a missing feature

Everything that *looks* like the check is present — a full strict config, a pinned version, a CI step
**named** for it (`Install npm devDependencies (typescript@6.0.3 + eslint stack)`), and a step
labelled *"Run TypeScript Lint Script"* whose comment reads *"Type check **and lint checks**"*. The
one thing absent is the invocation.

> **A check that did not run must never look like a check that passed.** Here it does not merely look
> like one — the code *documents* a behaviour it does not have.

## ESCALATION — it is not an omission, it is a FALSE ASSERTION printed on every green run

Independently confirmed by Lumen 2026-08-23 and re-verified here against `origin/main`. The runner
does not merely fail to run three tools — **it announces that they passed.** `main()`, line 173,
immediately after the loop over the one-element `STEPS`:

```ts
function main(): number {
  for (const step of STEPS) {          // STEPS = [ tsc ]
    if (!run(step)) return 1;
  }
  console.log("✓ TypeScript, Prettier, and style checks passed successfully!");
  return 0;
}
```

**It names three tools and runs one.** "Prettier and style checks passed" is printed on every green CI
run, in the CI log, when neither executed.

That is a strictly worse defect than the one originally filed, and it changes the severity of the
class. A missing invocation is a **gap** — someone reading the workflow could notice it. **A runner
that states two checks passed when they did not execute actively defeats the reader**, because the
log is exactly where a person goes to confirm what ran.

**Minimum fix, independent of every other decision in this workitem:** that string must not name a
tool the runner did not invoke. Even if the answer to "should we wire eslint up" is *no*, printing an
accurate `✓ TypeScript type check passed` is a one-line change that removes a false statement from
every CI log. **Do this first; it is not coupled to the profile debate below.**

## The falsifier that exposed it (measured, not hypothetical)

PR #14501 added the first two `.ts` files to `docs/research/scripts/` (23 prior files, all `.py` and
`.fsx`). Run locally against the repo's own config, they produce:

```text
✖ 72 problems (72 errors, 0 warnings)
  41  @typescript-eslint/restrict-template-expressions
  25  @typescript-eslint/no-non-null-assertion
   1  @typescript-eslint/no-unnecessary-template-expression
   1  @typescript-eslint/no-misused-spread
```

**`lint (TS)` on that PR is `SUCCESS`.** Seventy-two errors under the repo's own committed ruleset
passed CI green, which is the discrimination proof that the check is not running.

## Scope is NOT yet measured — and that is the point of filing rather than fixing

The repo-wide error count is **unknown**. Wiring eslint on without knowing it could turn `main` red
across hundreds of files, and reddening `main` to fix a lint gap would be a worse outcome than the
gap. **Measure first.**

## MEASURED (2026-08-23, shadow) — `src/Core.TypeScript` alone: **14,218 errors**

```text
bunx eslint src/Core.TypeScript > out.txt 2>&1; echo "ESLINT_RC=$?" >> out.txt
  ✖ 14218 problems (14218 errors, 0 warnings)
    2078 errors potentially fixable with --fix
  ESLINT_RC=1
```

This is **one directory**, not the repo. `**/*.ts` also covers `demo/`, `genesis/`,
`docs/research/scripts/`, `src/apps/`, `tests/` — the true total is higher and still unmeasured.

**This settles the "measure before wiring" call decisively.** Switching eslint on would have turned
`main` red across five figures of findings.

**Top classes:**

| count | rule |
|---|---|
| 3,429 | `@typescript-eslint/no-non-null-assertion` |
| 2,810 | `@typescript-eslint/restrict-template-expressions` |
| 659 | `@typescript-eslint/no-unsafe-member-access` |
| 526 | `sonarjs/cognitive-complexity` |
| 520 | `@typescript-eslint/no-unnecessary-condition` |
| 487 | `@typescript-eslint/dot-notation` |
| **438** | **`sonarjs/no-os-command-from-path`** |
| 427 | `@typescript-eslint/no-unsafe-assignment` |
| 408 | `@typescript-eslint/array-type` |
| **331** | **`sonarjs/publicly-writable-directories`** |
| 316 | `@typescript-eslint/require-await` |

### Two classes are not style, and should be triaged separately from the bulk

- **`sonarjs/no-os-command-from-path` (438)** — a command resolved through `PATH` rather than by
  absolute path. In a repo that shells out as much as this one, `PATH` order is an injection surface,
  and it is exactly the kind of thing the security personas would want to see.
- **`sonarjs/publicly-writable-directories` (331)** — `/tmp` and friends, which are shared and
  predictable-path. Relevant here specifically: parallel agents already share `/tmp`, and this session
  ran its own work out of `/tmp` clones.

**Honestly scoped:** both rules are **heuristics with real false-positive rates**. A CI script calling
`git` from `PATH` is not a vulnerability, and a test fixture in `/tmp` is usually fine. The claim is
**"769 sites deserve a look by someone with security context"**, NOT "769 vulnerabilities". Filing
them as findings without that qualifier would be the same overclaiming this workitem is about.

### What the number implies for the fix

Enabling everything at once is off the table. The viable shape is:

1. **Enable a small rule set repo-wide** — start with the two security-shaped rules above and anything
   with near-zero false positives, since those carry real signal and low volume.
2. **Enable the full profile on a narrow path** and widen — new code held to the standard, existing
   code migrated deliberately.
3. **Never** blanket-disable to reach green. 3,429 non-null assertions is a genuine finding about the
   codebase, not noise to suppress.

## What the fix requires — a decision, not just an invocation

1. **Measure** the repo-wide count per tool (`eslint`, `format:check`, `lint:css`) and report it.
2. **Decide the profile boundary.** `eslint.config.ts` targets `**/*.ts`, which sweeps in
   `docs/research/scripts/`, `demo/`, `genesis/`. Whether research measurement scripts belong under
   the same strict type-checked ruleset as `src/` is a **judgment call**, and the concrete case is
   already on the table: are 25 `no-non-null-assertion` hits in a one-shot computation with an
   early-return guard a defect, or appropriate?
3. **Land it incrementally** — turn the tool on for a narrow path first and widen, so no single PR is
   holding hundreds of unrelated fixes.
4. **Fix the documentation either way.** If a tool is deliberately not run, the header comment and the
   CI step names must stop claiming it is. An accurate "tsc only" is strictly better than an
   aspirational four-tool sentence.

## Explicitly NOT the fix

- **Do not** delete `eslint.config.ts` or drop the dependency to make the divergence go away — the
  config encodes real standards and 72 real findings.
- **Do not** wire it in and then add blanket disables or ignore entries to get green. Widening a check
  to make it pass is forbidden here, and doing it to a check whose defect *is* that it never ran would
  be self-refuting.

## The profile question — two agents disagree, and both positions are recorded

The workitem asks whether research measurement scripts should be held to the same strict profile as
`src/`. **shadow leaned yes-with-a-carve-out; Lumen argued no carve-out at all, and supplied evidence
rather than preference.** Recorded unresolved rather than collapsed, per
`anti-babel-preserve-reconcilability` — reintegration keeps both branches with their paths, and the
decision is the human maintainer's.

**Lumen's position — same ruleset, no directory carve-out:**

1. **The "one-shot script" defence did not survive contact.** All 25 `no-non-null-assertion` hits came
   out by restructuring `combos(n,k)` (index tuples) into `combosOf(items,k)` (element tuples), output
   byte-identical, and **not one assertion turned out to be load-bearing.** Lumen states it predicted
   otherwise before doing the work — which is what makes this evidence rather than opinion.
2. **A measurement script is evidence, not tooling.** Its numbers are load-bearing, so the code sits in
   the **proof lineage**, and `no-binary-in-proof-lineage` requires evidence be auditable. A *weaker*
   profile for the code that generates evidence is backwards.
3. **`restrict-template-expressions` is not cosmetic for this file class specifically** — it is what
   stops an object rendering as `[object Object]` into a published measurement. More of a
   research-script hazard than a `src/` one.

**And a redirection worth more than the debate:** the real risk to research scripts is **bit-rot** — a
script that no longer runs — and eslint addresses none of it. *"Does every research script still
execute and reproduce its committed output"* would be worth more than any profile choice here.

**If a carve-out is ever declared: per-rule with a stated reason, never per-directory.** A
directory-shaped exemption is the shape that silently grows — which is the same mechanism as the
markdownlint research carve-out that made `rc=0` meaningless on this repo's research docs.

**Side effect worth noting:** Lumen's restructure means TS2538 **cannot recur** in that file rather
than being currently satisfied — with no index there is nothing to assert. That is the difference
between a fix and a patch, and it is the shape to prefer wherever these 3,429 assertions get touched.

## CLOSED (2026-08-23, dejan) — the false assertion, and only that

The decoupled half is landed. **The runner no longer names a tool it did not invoke, and cannot
regain the ability to.** Nothing else in this workitem moved; the numbered decisions below are open
exactly as filed.

**What changed (`src/Core.TypeScript/lint/lint-typescript.ts`):**

- `main()` printed a hardcoded `✓ TypeScript, Prettier, and style checks passed successfully!`.
  It now prints `successMessage(STEPS)` — **derived from the step list**, so the message is a
  function of what ran. Today that is `✓ 1 check passed: tsc`. A step added to `STEPS` appears in
  the message for free; a step removed cannot leave its name behind.
- `Step` gained a `tool` field — the one place a tool name may enter the success line — and `STEPS`
  is exported so a test can assert against the real list rather than a copy of it.
- The header no longer describes the file as orchestrating "tsc, eslint, prettier, stylelint". It
  states that `STEPS` holds `tsc` alone, names the three tools that are configured but **not
  invoked** as not invoked, and points here.
- **Empty `STEPS` is now a failure, not a silent pass.** Commenting the last step out would
  previously have produced exit 0 with zero checks executed — the same defect one step further
  along. `main()` returns 1 and says `NOTHING RAN`.

**What changed (`.github/workflows/gate.yml`, job `lint (TS)`):** the step named *"Run TypeScript
Lint Script"*, commented *"Type check and lint checks"*, is now *"Run TypeScript type check (tsc
--noEmit, via the orchestrator)"* with a comment saying plainly that no eslint/prettier/stylelint
runs in this job and why that is a separate decision. The job's own `name: lint (TS)` is a required
status check and was **not** touched.

**Falsifier (`lint-typescript.test.ts`, 5 new tests, 16 pass total).** The load-bearing one runs
`successMessage(STEPS)` against a roster of claimable tools and asserts that none absent from
`STEPS` appears. Discrimination proof, both directions:

| mutation | result |
|---|---|
| baseline | `TEST_RC=0` — 16 pass, 0 fail |
| message appends `, Prettier, stylelint` (the original claim) | `TEST_RC=1` — **2 fail**, offender list `["prettier", "stylelint"]` |
| message drops the roster (`✓ 1 check passed successfully!`) | `TEST_RC=1` — **2 fail**, "names EVERY tool it did run" |
| restored | `TEST_RC=0` — 16 pass, 0 fail |

The second mutation matters: a test that only forbade extra names would accept a message that says
nothing, which is how the vacuous version of this fix would look.

**`package.json` deliberately untouched.** `lint:typescript` names no tool — it is the entry point's
name, consistent with the `lint (F#) / (C#) / (TS)` family — so it asserts nothing false. Renaming it
would be churn across ~20 referencing docs for no gain in honesty.

### Still open — nothing here was decided

1. **Measure the repo-wide counts** per tool. `src/Core.TypeScript` alone is 14,218 eslint errors;
   `format:check` and `lint:css` are still unmeasured.
2. **The profile boundary** (shadow vs Lumen, above) — the maintainer's call, untouched.
3. **Wiring eslint / prettier / stylelint in.** Not done, and correctly not done here.
4. **The sweep this suggests** — the markdownlint research carve-out is the same class ("the linter
   is present and does not examine the file"); two instances in one day still argues for a sweep.

One narrow-path slice already exists independently: `lint (twitch-ai app)` does run
`bunx eslint src/apps/twitch-ai/src`. So eslint is invoked *somewhere* in CI — just not by the job
whose step name claimed it.

## Acceptance

- Repo-wide counts reported per tool, **before** any invocation is wired in.
- The profile boundary decided and written down with its reasoning.
- ~~Whatever ships, **the documentation matches the behaviour** — no tool named in the header or in a
  CI step name that is not invoked.~~ **DONE 2026-08-23 (dejan)** — header, success line and gate.yml
  step name; the success line is now derived from `STEPS` so it cannot drift back.
- Discrimination proof: introduce a deliberate violation of each newly-enforced tool, show the job go
  **RED**, then restore.

## Provenance

Found by shadow on an autonomous tick, 2026-08-23, while diagnosing `lint (TS)` on PR #14501. The
`72 errors + green CI` pair is the falsifier. Related: the same session established that
`docs/research/2026-*.md` is carved out of the markdownlint profile, so `markdownlint-cli2 <research
doc>` also exits 0 without linting — **two independent instances of "the linter is present and does
not examine the file" found in one day**, which suggests the class deserves a sweep rather than two
point fixes.

---

## SUPERSESSION 2026-08-24 (dejan) — "never invoked anywhere in the repo" was TRUE when filed and is STALE now

This workitem's central measurement was accurate for **54 minutes**, and the record should say so
rather than read as an error.

| event | timestamp (UTC) | evidence |
|---|---|---|
| this workitem filed, claiming eslint is invoked nowhere | **2026-08-23T22:30:01.682Z** | frontmatter `created:` |
| `bunx eslint src/apps/twitch-ai/src` enters `.github/workflows/gate.yml`, job `lint (twitch-ai app)` | **2026-08-23T23:24:02Z** | commit `b1967172d8f9ed95b10751756f1e95102e2c5046`, PR #14522 — *"ci(twitch-ai): the app gets a CI job — its own tsc, the repo eslint, the real vite build (D0 of #14503)"* |

So: **the finding was not wrong; the tree moved under it.** eslint now runs on exactly one path,
`src/apps/twitch-ai/src` (4 `.ts` files), and that job's own comment names this workitem as the
reason it exists. Everything else in the finding stands — the config still targets `**/*.ts`, and
everything outside that one directory is still unexamined.

The corrected claim, for the next reader: **eslint is invoked on one narrow path and no other**;
prettier and stylelint are still invoked nowhere.

**A fourth, incidental confirmation that `prettier` is not a gate — this very file:**

```text
$ git checkout -- workitems/   # pristine, exactly as it sits on origin/main
$ bunx prettier --check workitems/081M0RBXF6J087G0R0023EX9X2-*.md
$ echo "rc=$?"
Checking formatting...
[warn] workitems/081M0RBXF6J087G0R0023EX9X2-eslint-prettier-and-stylelint-are-configured-pinned-and-name.md
[warn] Code style issues found in the above file. Run Prettier with --write to fix.
rc=1
```

The workitem reporting that prettier never runs is **itself unformatted on `main`** and nothing
noticed. Left unformatted deliberately: reformatting it would put 29 lines of reflow into this diff
and edit a record this PR is only appending to. When `format:check` is eventually wired up, that is
the moment to normalise it — not before, and not as a side effect of an unrelated change.

## THE BLAST RADIUS OF ONE FALSE LOG LINE — measured, and deliberately not repaired

`✓ TypeScript, Prettier, and style checks passed successfully!` is quoted in the PR-review archive
**as evidence that a run was clean**:

```text
$ git grep -l 'Prettier, and style' origin/main -- 'docs/history/pr-reviews/*' | wc -l
23
$ git grep -l 'style checks passed successfully' origin/main -- 'docs/history/pr-reviews/*' | wc -l
15
$ git grep -l 'Run TypeScript Lint Script' origin/main | wc -l
5
```

Typical shape, from `PR-11488-feat-receipt-…md`:

```text
$ bun src/Core.TypeScript/lint/lint-typescript.ts
✓ TypeScript, Prettier, and style checks passed successfully!
```

**These are not being rewritten.** Each one is an accurate record of what the runner printed on that
day; editing them would replace a true record of a false statement with a false record of a true one.
They are left as the measurement of the defect's reach: **one wrong string in one `console.log`
propagated into 23 archived reviews before anyone read it as a claim.**

That is the argument for treating this as a *class* needing a sweep rather than two point fixes — a
false success line is not contained by the file that prints it, because the whole purpose of a CI log
is to be quoted downstream.

(The string itself is fixed in PR #14545, which derives the message from `STEPS` so it cannot drift
back. That PR is decoupled from everything below.)

## MEASURED PER-PATH 2026-08-24 (dejan) — the repo, not one directory

Method — one `eslint` invocation over every candidate root, JSON output, aggregated by directory.
Exit status captured directly, never through a pipe:

```text
$ git rev-parse HEAD
6fb8f314916d51b7cf1ac8d41b4063e58e287142
$ bunx eslint src tools tests demo docs vocab inventory infra samples genesis full-ai-cluster \
    .claude .codex .gemini .kiro eslint.config.ts \
    --no-error-on-unmatched-pattern --format json > /tmp/dejan-eslint-all.json 2> /tmp/dejan-eslint-all.err
$ echo "rc=$?"
rc=1
```

**Totals: 2,500 files linted, 19,685 errors, 1 warning.** 165 of those errors are parse failures
(`ruleId: null`) on files that `tsconfig.json` excludes but `eslint.config.ts` does not — a real
config divergence, listed below rather than fixed here.

**198 directory groups. 28 measured exactly zero. 170 did not.**

### Top rule classes, repo-wide (supersedes the `src/Core.TypeScript`-only table above)

| count | rule |
|---:|---|
| 3,922 | `@typescript-eslint/no-non-null-assertion` |
| 3,583 | `@typescript-eslint/restrict-template-expressions` |
| 988 | `@typescript-eslint/no-unsafe-member-access` |
| 679 | `sonarjs/cognitive-complexity` |
| 618 | `no-undef` |
| 593 | `@typescript-eslint/no-unsafe-assignment` |
| 586 | `@typescript-eslint/no-unnecessary-condition` |
| 527 | `@typescript-eslint/dot-notation` |
| 494 | `sonarjs/no-nested-conditional` |
| 463 | `@typescript-eslint/array-type` |
| **442** | **`sonarjs/no-os-command-from-path`** |
| 427 | `@typescript-eslint/require-await` |
| 369 | `sonarjs/no-unenclosed-multiline-block` |
| 353 | `@typescript-eslint/no-explicit-any` |
| **342** | **`sonarjs/publicly-writable-directories`** |
| 165 | *(parse errors — files outside the tsconfig project)* |

## WHICH STRATEGY THE DATA CHOSE: **the path strategy**

The workitem offered two shapes — narrow *path*, or a small near-zero-false-positive *rule set*
repo-wide. The measurement decides it, and it decides against the rule set:

1. **Clean paths exist, and there are 28 of them.** The path strategy is not a compromise here; it is
   available today at zero remediation cost, and it locks the full strict profile — every rule, no
   subsetting — in where the codebase already satisfies it.
2. **The two security-shaped rules are the wrong first move, on their own evidence.**
   `sonarjs/no-os-command-from-path` is 442 and `sonarjs/publicly-writable-directories` is 342 — 784
   sites. Both are heuristics with real false-positive rates. Enabling them repo-wide would either
   redden `main` by 784, or require 784 triage decisions before a single one lands. **Neither of those
   is a decision I get to make: triage of a security-shaped finding belongs to a security persona
   (Mateo), not to CI.** The honest claim about those 784 is *"these sites deserve review"*, never
   *"784 vulnerabilities"* — and a claim awaiting review is not a claim CI can gate on.
3. **The rule strategy is also the weaker enforcement.** A repo-wide two-rule set says nothing about
   the 3,922 non-null assertions. The path strategy says everything about 102 files and is honest
   about saying nothing about the rest.

So the rule strategy is **deferred to Mateo with the counts attached**, not rejected. It becomes
attractive the moment someone with security context has triaged the 784.

## WHAT LANDED (this PR)

`package.json` gains `lint:eslint`, and the existing `lint (TS)` gate job gains one step that runs it.
**No new job, no new runner, no new install** — `lint (TS)` already provisions bun and the eslint
stack for `tsc`. Cost measured at **~13 s** locally and **20 s** in CI for the roster (typed-linting program
load dominates, not the 102 files).

The roster is exactly the directories that measured **zero**, minus three deliberate exclusions:

| path | files |
|---|---:|
| `eslint.config.ts` | 1 |
| `src/Core.QSharp.ReferenceOracle` | 10 |
| `src/Core.TypeScript/agent-bus` | 8 |
| `src/Core.TypeScript/ansi` | 3 |
| `src/Core.TypeScript/audit-packages` | 1 |
| `src/Core.TypeScript/byte-cost` | 2 |
| `src/Core.TypeScript/claude-hooks` | 2 |
| `src/Core.TypeScript/enforcement` | 2 |
| `src/Core.TypeScript/federated-identity` | 20 |
| `src/Core.TypeScript/fuzz` | 1 |
| `src/Core.TypeScript/g-set` | 5 |
| `src/Core.TypeScript/git` | 5 |
| `src/Core.TypeScript/io-boundary` | 3 |
| `src/Core.TypeScript/lanes` | 3 |
| `src/Core.TypeScript/mixin` | 2 |
| `src/Core.TypeScript/pam` | 2 |
| `src/Core.TypeScript/persistence` | 4 |
| `src/Core.TypeScript/resource-planner` | 4 |
| `src/Core.TypeScript/splitmix64` | 2 |
| `src/Core.TypeScript/tradition-density` | 9 |
| `src/Core.TypeScript/watermark` | 2 |
| `src/Core.TypeScript/z-set` | 3 |
| `src/Core.TypeScript/zetadb` | 8 |
| **total** | **102** |

Widening is a one-token diff: add a path to `lint:eslint` once it measures zero. The same script is
what a laptop and a devcontainer run (`bun run lint:eslint`), so the three surfaces cannot drift —
there is no CI-only invocation to fall out of sync (GOVERNANCE §24).

### `infra/k8s` measured zero and was still dropped — CI caught it, on this PR

The first push of this change enrolled `infra/k8s` (5 files, 0 errors). Two gate jobs went red:

```text
lint (yaml/k8s)                                        -> FAILURE
lint (bash retirement inventory + hygiene unit tests)  -> FAILURE

cluster-tree consumers: 32 file(s) outside infra/ name infra/k8s or infra/nixos
1 finding(s):
  [unrostered-consumer] package.json
      names the stale tree (infra/k8s | infra/nixos) but is not in the roster.
```

`infra/k8s` is the **stale** cluster declaration awaiting deletion
(081M00QCHWA087G0R000GKKRXD) — it collides with `full-ai-cluster/` on
`Application/argocd/zeta-root`, and its consumer roster is designed to only ever **shrink**.

**Dropped, not rostered.** The roster offers a documented escape hatch — add the path with a
disposition and a migration target — and taking it would have been the wrong call: a lint roster is
not a reason to keep a doomed tree alive, and adding a consumer to a tree scheduled for deletion is
new coupling bought for five files. `full-ai-cluster/` is not a substitute either; it measured
dirty (portal 455, platform-controller 175, tools 73, nixos 45).

Worth stating plainly: **the failing check was right and I was wrong.** "This directory measures
zero" was a sufficient reason to enrol under my own criterion, and my criterion was incomplete — it
had no term for whether the directory should exist at all. Recorded rather than quietly fixed,
because a criterion that needed a red build to find its missing term is the interesting artefact
here, not the five files.

### Cost estimate — minutes/run x runs/month, measured after landing

Stating this properly, because "no new job, ~20 s" is a per-run number and a per-run number is not a
cost estimate.

| term | value | source |
|---|---|---|
| added wall-clock per run | **20 s** | `lint (TS)` step `ESLint over the measured-clean path roster`, run 32676220081: 00:18:19Z -> 00:18:39Z |
| runs/day | **594** and **529** on the two days sampled | `search/issues?q=repo:...+is:pr+created:>=...`, 24 h windows ending 2026-08-24T00:40Z and 2026-08-23T00:40Z |
| is `lint (TS)` path-gated? | **no** — no `if:`, no `needs:` | it runs on every gate run, plus every push that re-triggers one |
| **added runner time** | **~=3.1 h/day, ~=95 h/month** at 560 runs/day | 20 s x 560 x 30 |

**95 runner-hours a month is not a rounding error, and it should not be presented as one.** What
makes it acceptable here is that the repo is **public**, so GitHub-hosted standard runners are billed
at zero; the real cost is 20 s of added latency on a job whose `tsc` step already takes ~27 s, and
the concurrency pressure that adds to the runner pool at 560 runs/day.

**The number that should worry a future widener is the slope.** The 20 s is almost entirely
typed-linting program load, not the 102 files — the repo-wide run over 2,500 files took roughly 3-4
minutes on a developer laptop. So widening the roster is close to free until it is not, and the
inflection is somewhere well below "the whole repo". Anyone taking the roster past a few hundred
files should re-measure the step rather than assume the load term still dominates.

### Clean but deliberately NOT enrolled

| path | files | why not |
|---|---:|---|
| `docs/research/scripts` | 2 | **The profile-boundary question, and it is not mine to answer.** It measured zero — Lumen's restructure cleared all 72 — so it is *mechanically* free to enrol, which is exactly why enrolling it would silently settle the disagreement recorded above. shadow and Lumen hold different positions; the maintainer decides. Untouched. |
| `src/apps` | 5 | Already enforced by `lint (twitch-ai app)`, under the app's own context. Enrolling it here would pay for the same 4 files twice. |
| `src/Core/data`, `samples/FactoryDemo.Db` | 1 each | A single `.ts` file inside a large F#/C# tree. Enrolling a lone file makes the roster read as a file list rather than a directory policy, and its siblings in `samples/` are dirty (71 and 55). Free to add later if either tree grows TypeScript. |

## WHAT DID NOT LAND — the remaining list, with counts

Every group below is a path eslint would fail on today. This is the debt, itemised; nothing here is
disabled, ignored, downgraded, or excluded — it is simply not yet enrolled.

**73 of these 170 groups are at 15 errors or fewer** — those are the cheap next slices, and they are
visible at a glance in the table.

| `src/Core.TypeScript/hygiene` | 283 | 2107 | 4 |
| `tests/cross-verification` | 109 | 1355 |  |
| `genesis/assets` | 1 | 1348 |  |
| `src/Core.TypeScript/observe` | 168 | 1182 |  |
| `src/Core.TypeScript/ace` | 87 | 1103 |  |
| `src/Core.TypeScript/discovery` | 91 | 940 | 5 |
| `tools/setup` | 116 | 793 |  |
| `src/Core.TypeScript/zflash` | 62 | 639 | 1 |
| `src/Core.TypeScript/cluster` | 70 | 588 | 2 |
| `docs/design` | 9 | 457 |  |
| `full-ai-cluster/portal` | 33 | 455 | 3 |
| `src/Core.TypeScript/forge-host` | 52 | 455 | 10 |
| `src/Core.TypeScript/planning` | 63 | 431 |  |
| `src/Core.TypeScript/installer` | 53 | 400 |  |
| `src/Core.TypeScript/ci` | 48 | 363 |  |
| `src/Core.TypeScript/workflow-engine` | 50 | 312 | 1 |
| `src/Core.TypeScript/ferry-throttler` | 26 | 301 |  |
| `src/Core.TypeScript/algebra` | 43 | 295 |  |
| `src/Core.TypeScript/bg` | 11 | 239 | 17 |
| `src/Core.TypeScript/bus` | 9 | 216 |  |
| `src/Core.TypeScript/swarm` | 11 | 215 |  |
| `src/Core.TypeScript/backlog` | 32 | 205 | 1 |
| `src/Core.TypeScript/substrate-claim-checker` | 15 | 201 |  |
| `src/Core.TypeScript/chip8` | 20 | 196 |  |
| `full-ai-cluster/platform-controller` | 14 | 175 |  |
| `src/wasm-dla` | 12 | 171 | 4 |
| `src/Core.TypeScript/browser-node` | 107 | 162 |  |
| `src/Core.TypeScript/bayesian` | 23 | 157 |  |
| `src/Core.TypeScript/peer-call` | 15 | 153 | 3 |
| `src/Core.TypeScript/costume-rho` | 5 | 137 |  |
| `src/Core.TypeScript/inventory` | 6 | 134 |  |
| `src/Core.TypeScript/zeta-id` | 11 | 134 |  |
| `src/Core.TypeScript/shadow` | 7 | 120 | 4 |
| `src/Core.TypeScript/health` | 2 | 119 |  |
| `src/Core.TypeScript/service` | 20 | 117 |  |
| `src/Core.TypeScript/search` | 17 | 114 |  |
| `src/Core.TypeScript/file-type-plugin` | 7 | 100 |  |
| `src/Core.TypeScript/research` | 17 | 99 |  |
| `src/Core.TypeScript/agent-heartbeats` | 10 | 95 | 6 |
| `src/Core.TypeScript/oracle` | 12 | 92 |  |
| `src/Core.TypeScript/cover-acyclicity` | 6 | 85 |  |
| `docs/recovered-orphan-branches-2026-05` | 66 | 84 | 64 |
| `src/Renderers` | 7 | 78 | 6 |
| `src/Core.TypeScript/dynamic-value` | 22 | 77 |  |
| `src/Core.TypeScript/ops` | 2 | 74 |  |
| `full-ai-cluster/tools` | 5 | 73 |  |
| `samples/FactoryDemo.Api.CSharp` | 1 | 71 |  |
| `src/Core.TypeScript/drift-dashboard` | 6 | 70 |  |
| `src/Core.TypeScript/darkhall-ui` | 32 | 69 | 1 |
| `src/Core.TypeScript/chip9-cart` | 6 | 67 |  |
| `src/Core.TypeScript/resonance` | 4 | 66 |  |
| `src/Core.TypeScript/model-backend` | 43 | 60 |  |
| `inventory/lib` | 4 | 57 |  |
| `src/Core.TypeScript/arc-solver` | 3 | 57 |  |
| `src/Core.TypeScript/scaffold` | 2 | 57 | 6 |
| `samples/FactoryDemo.Api.FSharp` | 1 | 55 |  |
| `tools/Z3Verify` | 13 | 50 | 1 |
| `src/Core.TypeScript/migrations` | 4 | 47 |  |
| `src/Core.TypeScript/memory` | 3 | 46 |  |
| `full-ai-cluster/nixos` | 12 | 45 |  |
| `src/Core.TypeScript/bootstrap-razor` | 2 | 44 | 1 |
| `src/Core.TypeScript/alignment` | 21 | 41 |  |
| `src/Core.TypeScript/residual` | 10 | 41 |  |
| `src/Core.TypeScript/bonsai` | 5 | 39 |  |
| `src/Core.TypeScript/roms` | 6 | 39 |  |
| `src/Core.TypeScript/crypto` | 13 | 38 |  |
| `src/Core.TypeScript/moral-gym` | 3 | 38 |  |
| `src/Core.TypeScript/playwright` | 15 | 38 |  |
| `src/Core.TypeScript/eve-translation` | 2 | 35 |  |
| `src/Core.TypeScript/merkle` | 4 | 35 |  |
| `src/Core.TypeScript/key-custody` | 2 | 33 |  |
| `src/Core.TypeScript/shadow-outlet` | 3 | 33 |  |
| `src/Core.TypeScript/openspec` | 2 | 31 |  |
| `docs/books` | 6 | 30 |  |
| `src/Core.TypeScript/authorization` | 6 | 30 |  |
| `src/Core.TypeScript/yaml` | 8 | 30 |  |
| `tools` | 3 | 30 |  |
| `src/Core.TypeScript/indexed-z-set` | 3 | 29 |  |
| `src/Core.TypeScript/z-set-merkle` | 4 | 29 |  |
| `src/Core.TypeScript/claude-code-recovery` | 1 | 27 |  |
| `src/Core.TypeScript/save-ai-memory` | 2 | 27 |  |
| `demo/identity-dla-site` | 16 | 26 | 15 |
| `src/Core.TypeScript/dashboard` | 3 | 25 |  |
| `vocab/gen` | 6 | 24 |  |
| `src/Core.TypeScript/audit` | 4 | 23 |  |
| `src/Core.TypeScript/formal-verification` | 7 | 23 |  |
| `src/Core.TypeScript/protocol` | 6 | 23 |  |
| `src/Core.TypeScript/invariant-substrates` | 1 | 22 |  |
| `src/Core.TypeScript/tools` | 1 | 22 |  |
| `src/Core.TypeScript/accelerator` | 3 | 21 |  |
| `src/Core.TypeScript/bridge-transfer` | 4 | 20 |  |
| `src/Core.TypeScript/mesh-pong` | 3 | 18 |  |
| `src/Core.TypeScript/tri-boolean` | 5 | 18 |  |
| `inventory/proofs` | 2 | 17 |  |
| `src/Core.TypeScript/ledger` | 2 | 17 |  |
| `src/Core.TypeScript/dla` | 2 | 16 |  |
| `src/Core.TypeScript/dora-classify` | 3 | 16 |  |
| `genesis/_src` | 3 | 15 |  |
| `src/Core.TypeScript/chip9` | 7 | 15 |  |
| `src/Core.TypeScript/orchestrator-checks` | 6 | 15 | 1 |
| `src/Core.TypeScript/range-set` | 3 | 14 |  |
| `.claude/hooks` | 8 | 13 | 6 |
| `src/Core.TypeScript/bootstrap-validator` | 2 | 13 |  |
| `src/Core.TypeScript/cold-start` | 1 | 13 |  |
| `src/Core.TypeScript/four-corner` | 3 | 13 |  |
| `src/Core.TypeScript/metric` | 3 | 13 |  |
| `src/Core.TypeScript/recorded-source` | 3 | 13 |  |
| `src/Core.TypeScript/economy` | 8 | 12 |  |
| `src/Core.TypeScript/lint` | 12 | 12 |  |
| `src/Core.TypeScript/collation` | 2 | 11 |  |
| `src/Core.TypeScript/society` | 12 | 11 |  |
| `src/Core.TypeScript/work-items` | 11 | 11 |  |
| `src/Core.TypeScript/auth` | 1 | 10 |  |
| `src/Core.TypeScript/claims` | 2 | 10 |  |
| `src/Core.TypeScript/identity` | 3 | 10 |  |
| `src/Core.TypeScript/quantum` | 2 | 10 |  |
| `src/Core.TypeScript/sha256` | 3 | 10 |  |
| `src/Core.TypeScript/concordance` | 1 | 9 |  |
| `src/Core.TypeScript/durability` | 5 | 9 |  |
| `src/Core.TypeScript/orchestrator` | 1 | 9 |  |
| `src/Core.TypeScript/probability-semiring` | 2 | 9 |  |
| `src/Core.TypeScript/uncertain-clock` | 2 | 9 |  |
| `src/Core.TypeScript/verify` | 2 | 9 |  |
| `src/Core.TypeScript/perf` | 5 | 8 |  |
| `src/Core.TypeScript/riven` | 1 | 8 |  |
| `src/Core.TypeScript/routines` | 2 | 8 |  |
| `src/Core.TypeScript/braid` | 2 | 7 |  |
| `src/Core.TypeScript/skill-catalog` | 2 | 7 |  |
| `src/Core.TypeScript/soft-value` | 2 | 7 |  |
| `src/Core.TypeScript/schema-codegen` | 2 | 6 |  |
| `src/Core.TypeScript/secrets` | 5 | 6 |  |
| `src/Core.TypeScript/tick-dial` | 2 | 6 |  |
| `src/Core.TypeScript/traveler-frame` | 3 | 6 |  |
| `src/Core.TypeScript/clock` | 4 | 5 |  |
| `src/Core.TypeScript/decision-archaeology` | 1 | 5 |  |
| `src/Core.TypeScript/profile` | 2 | 5 |  |
| `src/Core.TypeScript/security` | 1 | 5 |  |
| `src/Core.TypeScript/testing` | 1 | 5 |  |
| `tools/dora` | 1 | 5 |  |
| `src/Core.TypeScript/budget` | 3 | 4 |  |
| `src/Core.TypeScript/complexity` | 2 | 4 |  |
| `src/Core.TypeScript/fastcdc` | 2 | 4 |  |
| `src/Core.TypeScript/graph-coloring` | 1 | 4 |  |
| `src/Core.TypeScript/i18n` | 1 | 4 |  |
| `src/Core.TypeScript/messagepack` | 1 | 4 |  |
| `src/Core.TypeScript/trajectories` | 2 | 4 |  |
| `src/Core.TypeScript/tri-boolean-float` | 6 | 4 |  |
| `tools/book-build` | 1 | 4 |  |
| `src/Core.TypeScript/canonical-json` | 1 | 3 |  |
| `src/Core.TypeScript/delta-log-entry` | 1 | 3 |  |
| `src/Core.TypeScript/edge-claims` | 1 | 3 |  |
| `src/Core.TypeScript/frame-delta` | 2 | 3 |  |
| `src/Core.TypeScript/mythology-resonance` | 1 | 3 |  |
| `src/Core.TypeScript/skill-carver` | 1 | 3 |  |
| `src/Core.TypeScript/blake3` | 3 | 2 |  |
| `src/Core.TypeScript/broadcast-local` | 2 | 2 |  |
| `src/Core.TypeScript/cursor` | 2 | 2 | 2 |
| `src/Core.TypeScript/economics` | 1 | 2 |  |
| `src/Core.TypeScript/experience` | 1 | 2 |  |
| `src/Core.TypeScript/resonance-schemas` | 2 | 2 |  |
| `tools/codegen` | 1 | 2 |  |
| `.kiro` | 1 | 1 | 1 |
| `genesis` | 1 | 1 |  |
| `src/Core.TypeScript/bag` | 3 | 1 |  |
| `src/Core.TypeScript/bungie` | 1 | 1 |  |
| `src/Core.TypeScript/consensus` | 2 | 1 |  |
| `src/Core.TypeScript/consistent-hash` | 2 | 1 |  |
| `src/Core.TypeScript/crc32c` | 2 | 1 |  |
| `src/Core.TypeScript/curve` | 2 | 1 |  |
| `src/Core.TypeScript/quantum-observable` | 10 | 1 |  |

### Two structural notes on that table

- **`genesis/assets` — 1 file, 1,348 errors.** A single vendored/generated asset. It is not authored
  TypeScript and should almost certainly be excluded at the `eslint.config.ts` `ignores` level the way
  `references/prior-art/**` is — but that is an ignore entry, and this PR adds none. Filed as an
  observation, not acted on.
- **165 parse errors are a config divergence, not lint findings.** `tsconfig.json` excludes
  `agentic-organization`, `docs/recovered-orphan-branches-2026-05`, `demo/identity-dla-site`,
  `full-ai-cluster/portal/web`, `src/Renderers/website`, `src/Core.TypeScript/cursor`,
  `src/Core.TypeScript/qsharp-oracle` and `src/wasm-dla`; `eslint.config.ts`'s `ignores` list does
  not. Typed linting therefore cannot parse them at all. Two exclusion lists that must agree and are
  maintained separately is its own drift surface — worth a follow-up, out of scope here.

## DISCRIMINATION PROOF — the check was seen to fail, three ways

`bun run lint:eslint`, exit status captured directly on the following line, never through a pipe.

**1 — existing file, `src/Core.TypeScript/*`** (`@typescript-eslint/no-non-null-assertion`) and
**2 — existing file, `src/Core.QSharp.ReferenceOracle`** (`sonarjs/publicly-writable-directories`), both
sabotaged at once:

```text
LINT_ESLINT_RC=1

/…/src/Core.QSharp.ReferenceOracle/generate-treaty-transcript.ts
  282:32  error  Make sure publicly writable directories are used safely here  sonarjs/publicly-writable-directories

/…/src/Core.TypeScript/splitmix64/splitmix64.ts
  23:14  error  Forbidden non-null assertion  @typescript-eslint/no-non-null-assertion

✖ 2 problems (2 errors, 0 warnings)
error: script "lint:eslint" exited with code 1
```

Restored, `git diff --stat` empty for both files, re-run:

```text
LINT_ESLINT_RC=0
```

**3 — a brand-new file in an enrolled directory.** This is the case directory-level enforcement
exists for: a file that did not exist when the roster was measured must still be caught.
a temporary file named `sabotage-new-file.ts` in the enrolled `src/Core.TypeScript/g-set/`
directory, created fresh:

```text
LINT_ESLINT_RC=1

/…/src/Core.TypeScript/g-set/sabotage-new-file.ts
  3:19  error  'value' will use Object's default stringification format ('[object Object]') when stringified  @typescript-eslint/no-base-to-string
  3:19  error  Invalid type "object" of template literal expression                                           @typescript-eslint/restrict-template-expressions

✖ 2 problems (2 errors, 0 warnings)
error: script "lint:eslint" exited with code 1
```

Deleted, re-run:

```text
LINT_ESLINT_RC=0
```

**How "does not redden main" was verified:** the roster was run against a clean checkout of
`6fb8f314916d51b7cf1ac8d41b4063e58e287142` (the `origin/main` tip at the time of writing) using the
exact command CI will run — `bun run lint:eslint` — with `rc` captured on the next line. `rc=0`, zero
bytes of output. The green state is not inferred from the absence of a failure; it is the recorded
exit status of the same command, on the same commit, against the same lockfile.

## ACCEPTANCE — status after this PR

- [x] Repo-wide counts reported per tool for **eslint** (19,685 / 2,500 files, per-path table above).
      `format:check` and `lint:css` are still **unmeasured** — out of scope for this slice, still owed.
- [ ] **Profile boundary NOT decided.** Two positions on the record; `docs/research/scripts/` left
      untouched on purpose. Maintainer's call.
- [x] Landed incrementally — 102 files, zero remediation, no PR holding unrelated fixes.
- [x] Documentation matches behaviour — the gate step is named for exactly what it runs, and the
      roster is in a script both CI and a laptop invoke.
- [x] Discrimination proof for eslint: RED → restore → GREEN, three sabotages, real output above.

## MATEO TRIAGE 2026-08-24 — the 784 deferred security-shaped sites: **2 findings, and neither rule should go in CI**

Dejan deferred `sonarjs/no-os-command-from-path` (442) and `sonarjs/publicly-writable-directories`
(342) with *"that review is Mateo's, not a CI change I get to make."* This closes it.

### 1. Re-measured, independently, at `b276dd37a5501319d85d918c76caac7ba704d2a3`

```text
$ bun install --frozen-lockfile          # install_rc=0
$ bunx eslint <dejan's 15 roots> --no-error-on-unmatched-pattern --format json > all.json
  eslint_rc=1
  2514 files, 19835 errors, 1 warning
    443  sonarjs/no-os-command-from-path
    342  sonarjs/publicly-writable-directories
```

Both counts hold (442 → **443**; 342 unchanged). Two corrections to the measurement itself:

**(a) The root list was over-narrow — 528 files went unlinted.** `git ls-files '*.ts' '*.js' …`
grouped by top-level directory shows `agentic-organization` (522 files), `.design-sync`, `db`, and
three root-level `.js` files are absent from the 15 roots. Linting them separately:

```text
  eslint_missed_rc=1 — FILES 528, ERRORS 562
  0 sonarjs/no-os-command-from-path
  0 sonarjs/publicly-writable-directories
```

So the two security counts are unaffected — but **the repo-wide total is 20,397, not 19,685**, and
the clearing-cost figure in the table above is understated by 712.

**(b) 236 sites are already suppressed and therefore not in the 443.** `eslint-disable`s naming
`sonarjs/no-os-command-from-path`: **236**; naming `publicly-writable-directories`: **0**. The
command rule's true footprint is ~679 sites, 236 of which someone has already triaged by hand.

### 2. Classified by exploitability, not by rule

| rule | total | test-only | non-test | crosses a privilege boundary |
|---:|---:|---:|---:|---:|
| `no-os-command-from-path` | 443 | 151 | 292 | **10** (all `sudo`) |
| `publicly-writable-directories` | 342 | **326** | 16 | **1** (`from-deb` → root `dpkg -i`) |

**The `/tmp` rule is 95% test fixtures.** Of the 16 non-test sites, most are the *correct* pattern
(`process.env.TMPDIR ?? "/tmp"` as a fallback), and the rule fires on the fallback.

**The command rule is dominated by toolchain:** `git` 148, `bun` 61, `gh` 39, `bash` 22, plus
`dotnet`/`cargo`/`go`/`npx`. These are true positives for the rule and **non-findings for security**:
their absolute paths genuinely vary per platform (`/usr/bin/git` vs `/run/current-system/sw/bin/git`),
pinning them would break `clone-at-tag-stays-sufficient`, and an attacker who can plant a fake `git`
on the PATH already has execution as that user — the fake buys nothing.

**`sudo` is the one class where that dismissal fails**, because `sudo` *is* the privilege boundary:
the caller does not have root, so shadowing it is the escalation rather than a consequence of one.

Filed: `docs/BUGS.md` P1 (biometric approval gate forgeable via `PATH`-resolved `sudo`, reproduced
end-to-end on the operator's host) and P2 (`from-deb` predictable temp path + no digest + root
install; latent — the manifest has zero entries).

Two things triaged and **dismissed with reasoning**, because the reflex answer is wrong both ways:

- **`/tmp` and the agent fleet.** "Single-user machine, so it's fine" is the wrong reason for the
  right conclusion. There is no second OS *user*, but there are many concurrent *agents* on one uid
  and the OS isolates them from each other not at all. What follows is not that every `/tmp` site is
  a finding — it is that path predictability grants a co-uid agent **nothing it does not already
  have**, since it can read, write and ptrace everything the user owns regardless. Predictability
  bites only where the file crosses into a privilege the attacker lacks. Exactly one site does.
  `/tmp/zeta-bus` is separately fine on its merits: `bus.ts:28` creates it `0o700`, `lstat`s it,
  contains `envelopePath` against traversal and names envelopes with `randomUUID()`. Residual (not
  filed, worth knowing): `ensureDir` accepts a **pre-existing** directory without checking its owner
  or mode, which matters on the NixOS cluster and not here.
- **`shred` in `teardown.ts:485` / `teardown-cluster.ts:547`.** Looks alarming — secure erase of key
  material via a `PATH` binary that does not exist on macOS. It is correct: the call is guarded by
  `status === 0 && !existsSync(path)` and falls back to overwrite-then-unlink, verified by a final
  `!existsSync`. Non-finding.

### 3. CI recommendation — **enable neither**; ship a targeted lint instead

The decisive evidence is **recall, not noise**. A full inventory of live `sudo` invocations
(`git grep '"sudo"' -- '*.ts'`, minus dead `docs/recovered-orphan-branches` trees and tests) finds
~15 sites across `src/Core.TypeScript/zflash/cli.ts`, `src/Core.TypeScript/zflash/setup.ts`,
`src/Core.TypeScript/zflash/flash-usb*.ts`, `tools/setup/persona-keys/biometric.ts`,
`src/Core.TypeScript/ace/install-pinned-artifact.ts`,
`src/Core.TypeScript/ace/setup-realizers/from-deb.ts`, and
`src/Core.TypeScript/cluster/runner-disk.ts`. The rule flags **10**. It misses
`src/Core.TypeScript/zflash/setup.ts:106` (suppressed — the single
most sensitive one, it `sudo tee`s `/etc/pam.d/sudo`), and it cannot see `sudo` reached through a
variable (`install-pinned-artifact.ts:85`), an array (`from-deb.ts:28`), or a `run()` wrapper
(`runner-disk.ts:315`).

> **Turning this rule on in CI would not have caught the P1 filed today.** It costs 443 triage
> decisions and has roughly two-thirds recall on the only class that matters.

And it is structurally blind to 174 `sudo` invocations across 37 `.sh` files, which eslint cannot
parse at all.

| option | clearing cost | recommendation |
|---|---:|---|
| `no-os-command-from-path` repo-wide | 443 | **No** — see above |
| `no-os-command-from-path` on the 28 clean paths | 0 | Already covered by the path strategy |
| `publicly-writable-directories` repo-wide | 342 | **No** — 326 are test fixtures; it fires on the correct `TMPDIR ?? "/tmp"` fallback |
| `publicly-writable-directories`, non-test only | 16 | **No** — 1 real site, and the rule pressures correct code |
| **new `lint-no-path-resolved-privilege-elevator.ts`** | **~15** | **Yes** — the recommendation |

The targeted lint refuses a privilege-elevating binary (`sudo`, `doas`, `pkexec`, `su`, `runas`)
invoked by bare name in any spawn form, across `.ts` **and** `.sh`, resolving through variables and
wrapper arrays. High recall on the class that matters, near-zero false positives, ~15 sites to clear,
and it fits the existing `src/Core.TypeScript/hygiene/lint-*.ts` tradition rather than adding a
repo-wide rule nobody can clear. Filing it is Dejan's call; the triage debt is discharged.

**Honest limit of this whole pass:** eslint sees TypeScript and JavaScript only. F#, C#, Python,
shell, and GitHub Actions `run:` blocks all shell out and are outside every number above.
