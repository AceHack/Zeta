# The free-runner dependency-update escalation ladder — most of what looked semantic was mechanical and merely unimplemented

**Status:** design + one check shipped. Deliberately NOT wired into CI or `.github/dependabot.yml`.
**Register:** the counts and diffs below are `metered`; the routing policy is `toy`; the tier-2 claims are `speculative` and labelled where they appear.
**Occasion:** Aaron — *"this deps updates is one thing we need our free AI society on github runners to do much better and automatically than dependabot, only deps that break things get routed for more intelligence off the free runners."*

> **Lint caveat, stated because an rc=0 here would be vacuous.** `markdownlint`'s
> profile excludes `docs/research/2026-*-*.md`. This file is not lint-checked, and
> no claim below rests on its having passed.

## 0. The measurement, first, because it is the whole argument

Every number in this section was counted from the GitHub check-runs API (not
`statusCheckRollup`, which under-reports), over **27 Dependabot PRs created
2026-08-24T00:00Z → 2026-08-26**. The `author:app/dependabot` search and the
`label:dependencies` search return the identical set of 27, so the denominator is
not a partial read.

`cancelled` was counted as *a check that never ran*, never as a failure.

| root cause | PRs | mechanically decidable? |
|---|---|---|
| **EXPORT_SURFACE** — a named export was removed or moved | **7** | yes — set difference between two published `.d.ts` |
| **PEER_DEP** — a peer range is unsatisfied | **1** | yes — two registry fields and a semver test |
| **VERSION_ORDER** — the proposal moves backwards | **1** | yes — an ordering comparison |
| **TOOLCHAIN_COUPLING** — an out-of-ecosystem pin disagrees | **1** | yes, and **already shipped**: `audit-dotnet-pin-parity.ts` |
| cross-PR merge conflict between two open bumps | 1 | not attempted here |
| **total with a real dependency problem** | **11 / 27 (41%)** | |
| infra only (flake / cancel / push contention) | 3 | — |
| no failure at all | 13 | — |

Secondary causes riding on those same PRs, **none** of which the checks above
catch: **TYPE_SIGNATURE ×1** (`@types/bun` widened `FFIType.ptr` from
`Pointer|null` to `Pointer|bigint|null` — the *name* survives, its *type* moved)
and **LINT_FORMAT ×2** (`ruff` 0.15→0.16 widened its default rule set 59→413
rules; `eslint-plugin-sonarjs` 4.0→4.2 added 18 findings — both produced errors
with no source change).

**So: 10 of the 11 real dependency problems are reachable by a mechanical check,
and 7 of 11 by a single one.** The claim in the brief holds — most of what looked
like "needs intelligence" was mechanical and merely unimplemented.

### 0.1 The sharper number: CI's blind spot is exactly the mechanical set

Of the ten version-break PRs, **CI caught five and missed four**. This is the
result that should drive the design, because it says the free-runner tier is not
merely cheaper than escalation — it sees things the gate structurally cannot.

| PR | the break | what CI said | the mechanical fact that was available |
|---|---|---|---|
| #14563 | `sympy 1.14.0 → 1.14.0rc1` in `uv.lock` | green on the downgrade itself | `VersionOrderRegression` |
| #14571 | `react-dom@19.2.8` (peers `react ^19.2.8`) against `react ^18.3.1` | **all 42 checks green** | `PeerRangeUnsatisfied` |
| #14579 | `react-resizable-panels` v4 | only `archive` red — push contention, infra | `ExportRemoved` |
| #14583 | `react-resizable-panels` v4 | **0 failures across 45 checks** | `ExportRemoved` |

**Four out of four.** A numerator built from "did CI go red" reports 5; the true
count of breaks needing a source fix is 10.

PR #14583 is the one to sit with. `src/Renderers/website` has no `gate.yml` job,
no committed lockfile, and an unappliable `patchedDependencies` patch. **Its 45 green
checks are 45 checks that do not look at it.** That is the vacuity class operating
at the level of CI topology rather than of a single assertion, and it is why
"route only what breaks" cannot be the whole rule.

### 0.2 Two claims in the brief needed correction

Recording both, because the brief invited verification rather than agreement.

- **`react-resizable-panels` is far larger than "removed `PanelGroup` /
  `PanelResizeHandle`."** Measured from both published tarballs: 3.0.6 exports 32
  names, 4.12.3 exports 22, and **only `Panel` and `PanelProps` survive** — 30
  removed, 20 added. It is a total API rewrite. The two named symbols are the two
  our tree happened to call.
- **The `sympy 1.14.0 → 1.14.0rc1` downgrade is real, and it is invisible at
  `origin/main`.** `git log -S '1.14.0rc1'` on `main` returns nothing and
  `git grep` at the tip finds nothing — because the PR was squashed after a fix
  commit removed it. The downgrade is in the bot's own commit,
  `da53e622f1:src/Core.Python/uv.lock:367` → `version = "1.14.0rc1"`. Two
  independent searches disagreed about this and both were right about different
  objects; the reconciliation is that a squash erases the intermediate state a
  bot actually proposed. **Any future measurement of what Dependabot proposed must
  read the PR's commits, never `main`.**

  The mechanism is worth keeping because it generalises: `sympy 1.14.0` requires
  `mpmath<1.4`, `sympy 1.14.0rc1` does not. The group's `mpmath 1.3.0 → 1.4.1`
  bump therefore made stable sympy unreachable, and the resolver silently paid for
  mpmath with a prerelease of the library the symbolic-verification lane runs on.
  **No individual package in the group went backwards. The resolution did.**

## 1. The ladder

Three tiers. Each row states what the tier can decide, what it costs, and what it
hands upward.

### Tier 0 — free runner, no model

**Decides:** install succeeds · typecheck · tests · byte-lock · **export-surface
diff** · peer-dependency consistency · version ordering · toolchain-pin parity.

**Costs:** runner-seconds on a public repo, which are free and unmetered. The
export-surface check specifically: **0.28 s / 0.37 s / 0.60 s** wall-clock for a
complete two-version capture-and-diff of `react-resizable-panels` — three samples,
warm DNS, local machine, so `consistent with` sub-second on a runner rather than
`metered` on one. Two tarball fetches and a text parse; no install, no compiler.

**Escalates:** a failure it cannot attribute, and — this is the part that is not
obvious — **a surface change nothing noticed**.

**Terminates:** most updates. 13 of 27 in the window had nothing wrong at all, and
a further 3 were pure infra.

### Tier 1 — free runner, cheap model

**Decides:** is this failure a flake or real; which symbol; which file; is this
lint delta a rule-set widening or a genuine finding.

**Costs:** a small local model on the same free runner. Still free in dollars;
costs wall-clock and honesty.

**Escalates:** anything requiring a *judgement about meaning* rather than a
*location*.

**The load-bearing asymmetry** (from the free-runner society design, #15429):
producing is hard, checking is cheap. A model too weak to write a migration can
still decide whether a candidate diff satisfies a stated rule. Tier 1 is a
`Verify`/`Refute` tier, not a `Propose` tier, and `Abstain` is a first-class
answer rather than a failure.

**Note what Tier 0 removes from Tier 1's job.** When the failure is an export
removal, Tier 0 has already named the symbol and the file — which is precisely
what Tier 1 exists to determine. So that class **skips Tier 1 entirely** and
arrives at Tier 2 with its diagnosis attached. This is the main efficiency in the
ladder and it falls out of doing the cheap check first rather than of any model
being clever.

### Tier 2 — off the free runners

**Decides:** write the migration; judge whether a semantic change is acceptable;
adjudicate a coupling no manifest expresses.

**Costs:** money. This is the only tier that does, so reaching it must be
justified by a fact, not by a score.

**Speculative, and labelled:** nothing here measures whether a Tier 2 escalation
produces a correct migration. That needs observed outcomes and there are none.

## 2. The wrinkle — escalate on break **or** unexplained surface change

*"Only deps that break things get routed"* has an inversion, and this repo
produced the case on the night the rule was proposed.

`react-resizable-panels` v4 also emits `data-group` / `data-panel` /
`data-separator` and **no direction attribute at all**. Two separate
measurements against the published bundles, stated separately because they are
separate:

| measurement | 3.0.6 | 4.12.3 |
|---|---|---|
| distinct `"data-*"` string literals | **12** | **5** (`data-disabled`, `data-group`, `data-panel`, `data-separator`, `data-testid`) |
| occurrences of `panel-group-direction` | **1** | **0** |

So every `data-[panel-group-direction=vertical]:*` Tailwind utility in the two
vendored `ui/resizable.tsx` files became **a selector that can never match**.

It passed `tsc`. It passed tests. It broke nothing observable — because
`<Calendar>` and `<ResizablePanelGroup>` have zero consumers, so nothing *could*
fail.

> **A failing test tells you where to look.**
> **A passing test after a surface change tells you the tests do not cover it.**

Hence the routing rule, stated as the design consequence:

> **"Tests pass AND the API surface changed" is more suspicious than "tests fail."**

This is implemented, not asserted. `routeUpdate` in `toy-surface.ts` refuses to
terminate at Tier 0 when a removed export is unreferenced and the build is green,
and `TestsNotRun` is a distinct value ranked strictly worse than `TestsPassed` —
a required check that never ran carries no evidence in either direction, and
collapsing it into "passed" is how a check that did not run comes to look like one
that passed.

### 2.1 The combinator is a join, for the same reason as `toy-classify.ts`

Severity is the **maximum** over (build outcome, surface facts, consumer facts).
Never a sum, never a weighted score. Under any weighted scheme a green test run
would *reduce* the total — and the case where it must not is exactly the case
where the tests do not cover what changed. A join has no exchange rate, so there
is nothing to buy with.

This is the same refusal `toy-classify.ts` makes between adherence and provenance,
and the surface diff is simply a **third signal joined the same way**. A publisher
with a spotless adherence record who removes an export we call has still removed
an export we call.

## 3. What Tier 0 cannot see. Stated plainly, because it is load-bearing.

**A dead CSS selector is not in any type system.**
`data-[panel-group-direction=vertical]:flex-col` is a well-formed Tailwind class
that compiles, ships, and matches nothing. No export list contains it. No `tsc`
run reads it. No amount of mechanical checking finds it — the fact that would have
to be compared is *"which DOM attributes does the rendered output carry"*, which
is a **runtime observation of a component nobody renders**. Catching it needs a
rendering test of an unused component, which is a coverage decision, not a
dependency check.

The shipped check does **not** claim that half. What it does instead:

- catches the **loud** half of the same update and names the symbols;
- where a removed name survives only in text no compiler reads, emits
  `RemovedExportOnlyInNonCodeText` — **the closest mechanical proxy for the silent
  half, and a proxy, not the thing.**

Three further honest gaps, each a real bucket from §0:

- **TYPE_SIGNATURE.** `@types/bun` widening `FFIType.ptr` changed no export name.
  An export-*name* diff is blind to it by construction. A type-*text* diff per
  name would see it and is strictly harder; not attempted.
- **LINT_FORMAT.** A linter shipping more default rules is not a surface change
  and not a peer range. `ruff` 59 → 413 rules is a policy change wearing a patch
  bump. Needs a per-tool rule-set snapshot, which is a different mechanism.
- **Resolution-level regressions.** The sympy case moved no package backwards;
  the *resolution* moved backwards. A per-package ordering check catches it only
  because the lockfile records the resolved version — a manifest-only check would
  not.

## 4. What shipped

`src/Core.TypeScript/dep-update/` — beside the typed transition core from #15583,
not replacing it.

| file | role |
|---|---|
| `toy-surface.ts` | **pure**: read a `.d.ts` surface, diff two package surfaces, classify consumers, route. No network, no clock, no filesystem. |
| `toy-surface.test.ts` | 16 falsifiers over **real captured surfaces**. Runs offline. |
| `testdata/surface-*.json` | four real published surfaces, each carrying the tarball integrity string it was read from — text, diffable, replayable. |
| `capture-package-surface.ts` | **the only file that touches the network.** Turns (package, version) into the text the pure module reads. Not wired to anything. |

**The fact rows name facts, never intents** — `ExportRemoved`, `ExportAdded`,
`EntryPointRemoved`, `EntryPointAdded`, `SurfaceUnreadable`. There is no
`Breaking`, no `Unsafe`, no `BadRelease`, and a falsifier pins the permitted set.

### 4.1 Two design corrections the data forced

Both were caught by running against real packages rather than by reasoning, and
both are recorded because the first versions *looked* right.

**The surface is a map, not a list.** `@noble/post-quantum`'s root `index.d.ts` is
literally `export {};` — the entire surface lives under subpaths. The first
version of the reader looked at the root, found nothing, and reported **a clean
diff of an empty surface**: a check that cannot fail wearing the costume of a
check that passed. The fix keys every fact by `(subpath, name)`. A flat union over
entry points fixes the empty-root case and introduces another: a name that *moves*
between subpaths appears in both unions, so the union reports no change while every
consumer importing it from the old path breaks.

**`\s` was the wrong character class, and lint found the bug.** The declaration
patterns were written `^\s*export\s+declare\s+…` with the `m` flag. `\s` matches
a newline, so those patterns could span lines and read a declaration that is not
there. `sonarjs/super-linear-regex` flagged them for backtracking; narrowing to
`[ \t]` fixed the performance complaint **and** the correctness defect at once —
a linter finding a real bug while complaining about something else.

**`.js` entry points must map to sibling `.d.ts`.** Modern `exports` maps point at
runtime files. Filtering for paths ending in `.d.ts` finds nothing on exactly the
packages whose surface lives under subpaths — which is how the reader initially
read `@noble/post-quantum` as exporting nothing at all.

### 4.2 It reproduces both real breaks

```
$ bun src/Core.TypeScript/dep-update/capture-package-surface.ts \
      @noble/post-quantum 0.6.1 0.7.0
{"t":"ExportRemoved","subpath":"./hybrid.js","name":"XWing"}
```

That is the exact failure that killed #14567 and its re-roll #15301:
`SyntaxError: Export named 'XWing' not found in @noble/post-quantum@0.7.0/hybrid.js`.
(`XWing` was one of seven `/** Legacy alias */` removals; the canonical
`ml_kem768_x25519` survives, so the migration is a rename, not a capability loss.)

And for `react-resizable-panels`, 30 `ExportRemoved` rows including `PanelGroup`
and `PanelResizeHandle`.

### 4.3 The consumer scan is what turns a fact into a diagnosis — and it must be import-scoped

30 removed names is a fact, not a work item. Measured at the **pre-migration
tree** (`611251197f`, the parent of #14583), across 172 code files in the two
directories that depend on the package:

| scan | hits | correct? |
|---|---|---|
| naive word-boundary grep | 3 | **no** — `PanelGroup`, `PanelResizeHandle`, `intersects` |
| scoped to names actually imported from the package | **2** | yes — `PanelGroup`, `PanelResizeHandle` |

**A 15× narrowing** (30 → 2), landing on exactly the two symbols and exactly the
two files that needed the migration. That is the difference between handing Tier 2
*"this major bump changed a lot"* and handing it two symbols and their files.

**The false positive is the instructive part.** `intersects` matched inside the
comment `// Tip has been absorbed — curve self-intersects (κ > 4 regime)` in
`OracleSLE.tsx` — a word in prose, in a file that never imports the package. Run
against the *current* tree the naive scan is worse still: **all three** hits are
comments, including the migration note in `resizable.tsx` that spells `PanelGroup`
while describing its removal.

So the same discipline the surface reader needed — **strip comments, and resolve
through imports rather than through text** — is required on the consumer side too,
and for the same reason. `classifyConsumer` therefore takes site lists rather than
computing them: a pure function cannot enforce that its caller scoped them, and
saying so is better than shipping a scanner that silently over-reports.

### 4.4 The falsifiers were mutation-checked, and two of them were vacuous

**Eleven** mutations were applied to `toy-surface.ts`; each must kill at least one
test.

| mutation | result |
|---|---|
| drop the `ExportRemoved` emission | 3 fail |
| early-return Tier 0 on `TestsPassed` | 5 fail |
| invert `raise` (`>` → `<`) | 7 fail |
| drop the `SurfaceUnreadable` escalation | 1 fail |
| collapse the two `classifyConsumer` arms | 2 fail |
| drop the `RemovedExportUnreferenced` arm | 1 fail |
| drop `EntryPointRemoved` | 1 fail |
| treat `TestsNotRun` as `TestsPassed` | 1 fail |
| `export { A as B }` records `A` instead of `B` | 1 fail |
| **drop `stripComments`** | **0 fail — SURVIVED (first run)** |
| **flatten the subpath keying** | **0 fail — SURVIVED (first run)** |

The two survivors were real defects **in the tests**, and both are the class this
repo lints for elsewhere — a check that passes because an *earlier* guard fired.

- The comment test indented its commented-out code under `*` and `//`. The
  declaration regexes anchor at the start of a line, so those lines never matched
  regardless of whether comments were stripped. Rewritten with the comment body
  starting at column 0, it now kills the mutation.
- **No captured fixture contains a moved name** — `XWing` was deleted, not
  relocated — so the real data genuinely cannot distinguish per-subpath keying
  from a flat union. That gap is now covered by an explicitly **synthetic** test,
  labelled as synthetic in the file, because pretending otherwise would be the
  citation-without-entailment failure.

After both fixes: **17 tests, 61 assertions, all twelve mutations killed, suite
green when restored.**

**And CodeQL then found a twelfth defect the mutation run could not**, because it
was in the I/O shell rather than the pure core: `pkg.replace("/", "%2f")` in the
packument URL builder escapes only the FIRST separator, since `String.replace`
with a string pattern is single-shot. It happened to be *correct* — an npm name
carries at most one `/`, separating scope from name — so it was right by accident
rather than by construction, which is the class this repo refuses everywhere
else. Fixed to `replaceAll`, and the builder was extracted and exported so it now
has a falsifier (`FALSIFIER 9`) rather than only a scanner.

The order is the point: a mutation run over the pure core cannot find a bug in
the part that was deliberately kept impure and untested. **Two different
mechanisms, two different defect classes, and neither one substitutes for the
other.**

## 5. What is deliberately NOT done

- **Not wired into `.github/dependabot.yml`.** Nothing about the bot's behaviour
  changes.
- **Not wired into CI as an auto-merging path.** Nothing auto-approves anything.
  A half-wired auto-updater that starts approving things is the worst outcome
  available here, so the wiring is absent rather than merely unfinished.
- **`capture-package-surface.ts` is called by nothing on a schedule.** Same
  discipline as #15583's `index.ts`: a decision function nobody calls is honest.
- **Marked `toy`.** The set difference is a fact and is metered against real
  bytes. The *routing policy* — that `ExportRemoved + tests-green` is worth a
  Tier 1 runner-second — has no falsifier, because that needs observed escalation
  outcomes and there are none. It sheds `toy` when there is adherence and
  provenance data and an estimator with something to be wrong about.

## 6. The honest cost of the routing rule

Escalating every unreferenced removed export is **not free of noise**, and the
noise has a measurable shape: `react-resizable-panels` alone would send 27
unreferenced removals to Tier 1 on a single PR.

Three reasons that is the right trade here, and one reason it might not be
elsewhere:

1. Tier 1 is a free runner. The marginal dollar cost is zero.
2. The alternative failed *in this window*, four times out of four.
3. The rows are batched per PR, so it is one Tier 1 call, not 27.
4. **Where Tier 1 is not free, this rule inverts** and the noise has to be priced.
   That is a real limit, not a footnote.

## 7. Anchors (Beacon)

- **Semantic versioning** (Preston-Werner) — the claim this whole apparatus tests.
  A semver range is a *claim*, not a guarantee; #15583's research doc carries that
  argument and this file is its mechanical half.
- **PEP 440** — the ordering under which `1.14.0rc1 < 1.14.0`, making the sympy
  proposal a downgrade by specification rather than by opinion.
- **Hyperproperties** (Clarkson & Schneider, CSF 2008) — the reason
  `TestsNotRun` cannot be folded into `TestsPassed`: an absent observation is not
  a negative observation, and a monitor that conflates them decides nothing.
- **Mutation testing** (DeMillo, Lipton & Sayward 1978; Jia & Harman 2011) — a
  test that survives mutation is not a falsifier. Two of these did, and were fixed.
- **Produce/verify asymmetry** — the free-runner society design (#15429, and
  `2026-08-26-the-tiny-agent-society-on-free-runners-vote-was-the-wrong-operator.md`),
  which is why Tier 1 is a checking tier rather than a voting one.

## 8. Pointers

- `src/Core.TypeScript/dep-update/toy-classify.ts` (#15583) — the two publisher
  signals this joins as a third.
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — why the routing policy
  keeps its prefix.
- `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md` — why every row
  names a fact.
- `src/Core.TypeScript/hygiene/audit-dotnet-pin-parity.ts` — the
  TOOLCHAIN_COUPLING bucket, already mechanised, and the proof that this approach
  works in this repo.
- `.github/dependabot.yml` — the `ignore:` entries are hand-written instances of
  exactly the couplings a Tier 0 check makes checkable.
