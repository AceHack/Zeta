# Complete GitHub merge observations before authorization

Date: 2026-09-07
Author: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade
Lifecycle: active
Work item: 081M1Y58Y72087G0R003820K4Q

## Defect and observed impact

At baseline `9fae5f8c3c499d424bc773fa4a13c057d7990495`,
`github-merge-observe.ts` requested only the first 100 check contexts and first
100 review threads, without connection counts or continuation metadata. Its
receipt is consumed by `observe/run-loop-real.ts`, `observe/merge-receipt.ts`
and the executor's merge authorization. A prefix could therefore be treated
as the complete reason to approve or refuse a merge.

The retained read-only [PR #16928](https://github.com/Lucent-Financial-Group/Zeta/pull/16928)
observation names head `f3bd1347e490084f411198dc8abff197c817eb1b` in both
sequential pages: 100 contexts plus 71, with `totalCount=171`. The prefix
contains 90 successful/neutral/skipped contexts, one running context and nine
failure-class contexts. The complete concatenated observation contains 148,
six and 17 respectively. The omitted rows include current running platform,
TypeScript and full-verification checks as well as failed historical checks.
The PR was `OPEN/BLOCKED`; both projections recommended fixing failed checks.
**This establishes live truncation, not an observed unsafe live merge.**

Separate deterministic executions of the unchanged mapper and real
`authorizeMerge` consumer establish the possible decision error. With a
`CLEAN` receipt, 100 resolved threads permitted authorization; including an
unresolved thread 101 refused it. A running check 101 likewise changed a
permitted prefix into a refusal. A `BLOCKED` fixture with failure 101 changed
`nextAction` from `none` to `fix-failed-checks`, while both versions refused
authorization. These executions performed no forge mutation. They do not
claim that GitHub's own required-check or branch protection was bypassed.

The [validation index](merge-observe-pagination-validation/2026-09-07/README.md)
retains the exact API bytes, original audit script/output and a reduced
witness summary. The first diagnostic query did not request auto-merge or
merge-commit metadata: the old mapper's defaults for those fields in the raw
audit output are not observations. The reduced summary deliberately retains
only the observed count/state/action fields.

## Repair and admission boundary

The observer now traverses both connections independently, in the same
bounded sequence of GraphQL requests. Each response binds the requested PR,
its head and the selected last commit; PR state, merge state and merge metadata
must remain consistent. Each connection must retain its total count, supply
advancing nonrepeated cursors, and contain valid unique node IDs. An interior
page has 100 nodes; the final cumulative cardinality equals the declared
total. A finished connection omits node selection while the other continues,
but its count and continuation metadata are still checked.

Incomplete/malformed pages, GraphQL partial errors, transport failures,
changed identity/counts and exhausted resource bounds return `Result` errors.
The pure mapper also refuses a prefix marked as incomplete. It cannot turn a
missing or duplicate node identity into a smaller actionable blocker count.
An explicitly null check rollup represents zero checks; an absent rollup is
refused. The query permits at most 100 requests and 10,000 nodes per
connection, and the reader caps cumulative response text at 33,554,432 JavaScript UTF-16
code units. These are refusal limits, not truncation
limits. The injected transport retains its own network timeout/retry policy;
this collector adds no retry or end-to-end wall-clock bound.

The paging scheme follows GitHub's documented 1-100 page-size boundary and
`pageInfo.endCursor`/`hasNextPage` continuation contract. See the
[primary pagination guide](https://docs.github.com/en/graphql/guides/using-pagination-in-the-graphql-api).
Sequential same-head reads are not an atomic snapshot of mutable check or
thread status. They also do not lock a future push or subsequent merge.
The existing merge executor and its arguments remain unchanged.

The existing conservative policy remains: `requiredChecks` contains all
observed checks; this patch does not discover a required-name roster, discard
optional or superseded checks, or change `classifyChecks`, `classifyGate` or
`computeNextAction`. A separate name-presence detector was repaired in
[PR #16912](https://github.com/Lucent-Financial-Group/Zeta/pull/16912); that fix
did not cover this helper. Inspection of `poll-pr-gate.ts` and
`health/factory-health-monitor.ts` found their `gh pr checks --required
--json name` calls used only to collect names. An exit-zero command containing
a failed check is not itself evidence of a misuse in those two call sites.

## Independent review and validation

The independent protocol-review agent found an admission/normalization
mismatch: a valid `CheckRun` failure carrying a foreign `context` string was
admitted by `__typename` but then normalized as a legacy status. Its failure
could disappear. The correction makes normalization follow the admitted
union discriminator. A regression passes that mixed fixture through the
actual observer and authorization consumer and requires refusal. The obsolete
post-admission thread-dropping filter was also removed.

The reviewer accepted source `e5b6bf5b1913f3df1cf55d1dd4c608fbfd5376fd`
on read-only inspection, including
both cursor traversals, stable identities/counts, refusal behavior and the
unchanged conservative policy. Attribution: Vera, OpenAI Codex using GPT-6
Astra, independent protocol-review agent. The reviewer did not run tests,
builds or forge mutations; owner-run checks and source fingerprints are
recorded separately in the validation index.

The exact candidate query was also accepted by live GitHub. At 15:05:08-09 UTC,
PR #16928 had advanced to `f99c9f4e2502263943d899ec7a506aa287f76558` and returned
94 contexts in one complete page, with five running checks and armed
auto-merge. At 15:05:21-23 UTC, merged
[PR #16925](https://github.com/Lucent-Financial-Group/Zeta/pull/16925) at head
`038ff0e3c854d6757dce08252ee9c15e5105429c` returned 107 contexts over two actual
requests, 100 plus seven. Both identities, counts and skipped finished-thread
selection were admitted. These are distinct observations from the earlier
171-context witness. All reads left the PRs untouched.

The final focused forge-host and merge-receipt suite passes 502 tests with
1,306 assertions. Its new fixtures include both tail blockers, different
connection lengths, legacy status contexts, null rollups, the 100-page limit,
changed head/count/cursor, duplicate IDs, malformed/partial replies, and
transport failure. The original fixture-number mismatch and the first
ad-hoc tsc invocation's missing `.ts` import option are retained as failed
attempts; their bounded corrections did not change scientific source or
measurements. Final static/preflight and publication status are recorded in
the validation index. This TypeScript tooling change uses the scope-aware
[build gates](../BUILD-GATES.md); no .NET suite or experiment was rerun here.
