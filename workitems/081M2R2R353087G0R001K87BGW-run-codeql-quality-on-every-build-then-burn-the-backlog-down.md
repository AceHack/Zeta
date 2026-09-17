---
id: 081M2R2R353087G0R001K87BGW
type: task
state: backlog
priority: P2
slug: run-codeql-quality-on-every-build-then-burn-the-backlog-down
title: "run codeql quality on every build then burn the backlog down then make it required"
created: 2026-09-17T16:21:11.971Z
depends_on: []
composes_with: []
---

# run codeql quality on every build then burn the backlog down then make it required

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M2R2R353087G0R001K87BGW-*.md` glob. -->

## Where this stands (2026-09-17, PR #17437)

**Step 1 — quality pack on every event.** DONE. `queries:
security-extended,security-and-quality` is unconditional; it used to be
event-conditional, which is why the count oscillated daily (353 alerts left the
API entirely between nightly runs rather than moving to `fixed`, so the number
could not function as a work queue).

**Step 2 — a stable number to aim at.** DONE. Measured locally with CodeQL CLI
2.27.0 over 4,443 TS/JS files: **243 results**, of which

- 18 excluded, both under distinctions already drawn in the repo (the
  recovered-branch quarantine, and our own custom query's deliberate
  bad-input fixture -- the artifact-under-test line);
- 69 in `docs/design/root-site-iris/*.html`, **deliberately kept**: I looked
  for a generation marker so I could class them with the `_ds/**` entries
  already excluded as generated, and there is none. They are authored;
  excluding them would have been an invented premise;
- 38 in `.test.ts`;
- **118 on the authored non-test production surface** — the real queue.

Two of the 118 were genuine defects and are fixed here: `observe.ts` rendering
two executed action kinds as "(unrecognized action)", and a `=== undefined`
branch in `goal-cascade.ts` that could never be taken. The error-severity
remainder (`js/call-to-non-callable` on `stripRemotePrefix(...)`,
`js/property-access-on-non-object` on `error?.code`, `js/index-out-of-bounds`
on a guarded retry loop) are CodeQL type-resolution false positives, each
checked individually and each left VISIBLE rather than excluded.

**Step 3 — make it required.** Blocked on one observation, not on work.

The naive form is unsafe and the measurement says so: **15 of the 25 most
recent merged PRs carried no `CodeQL` check at all (60%)**, verified against a
control (those SHAs carried 96 and 99 other check-runs, so the absence is
real). A required check that is ABSENT never resolves — the PR blocks forever
with nothing red to point at. Never require the per-language `Analyze (...)`
legs either; they skip per-language, and `codeql.yml`'s own cadence note
records the merge gate stuck on "Code quality results are pending for 4
analyzed languages."

What shipped instead: `paths-ignore` moved down into `path-gate` (so the
workflow always RUNS while `analyze` still skips, keeping the 605 job-seconds
measured on #16143), plus a `codeql (required)` sentinel with `if: always()`
that reports on the real jobs' results. Falsifier:
`src/Core.TypeScript/hygiene/codeql-gate-decision.test.ts`, which executes the
shell extracted from the workflow rather than a transcription of it.

### The flip, when its precondition is met

Precondition — **observe, do not assume**: after this merges, confirm
`codeql (required)` is PRESENT on a PR that changes no code (a telemetry or
docs-only diff). Those are exactly the PRs that carry no check today, and the
sentinel's presence there is the property the whole change exists to establish.
It cannot be observed before it ships, which is why the flip is not in #17437.

```bash
# 1. the check must be present on a NO-CODE PR, not merely passing on this one
gh api repos/Lucent-Financial-Group/Zeta/commits/<no-code-pr-head>/check-runs \
  --paginate --jq '[.check_runs[]|select(.name=="codeql (required)")]|length'
# expect 1. Compare against `.check_runs|length` as a control: a zero that is
# really a broken query looks identical to a zero that is real.

# 2. only then add it beside the one check that is required today
#    (`gate (required)` is currently the ONLY entry in CI Gate, id 16134995)
```

Scope note worth keeping straight: this sentinel gates on **whether the
analysis ran**, not on alert counts. It stops unanalysed code reaching `main`.
Gating on *new alerts* is a different switch (code scanning's own merge
protection) and needs the 118 near zero first — it would block on the resolver
false positives deliberately left visible above.

### What the 118 actually are — 54% is one modelling gap, not 64 defects

Followed up on the largest group and the number changes meaning. All **64**
`js/implicit-operand-conversion` findings on the production surface are the
same root cause: **CodeQL's JavaScript extractor does not model BigInt.** It
reads `(a + b) & MASK64` over `bigint`-typed operands as an implicit conversion
from `undefined` to number.

Checked rather than assumed. 58 of the 64 sit on a line naming a BigInt
literal or mask outright; the remaining 6 were run down individually and are
the same thing one hop away -- `M64 = 0xffffffffffffffffn`,
`MASK = (1n << 64n) - 1n`, `PRIME = 0x100000001b3n`,
`u64 = (x: bigint): bigint => x & MASK`.

The 18 in `merkle/xxh3.ts` were worth the most attention, because "implicitly
converted from undefined to number" inside a hash would mean `NaN` reaching a
Merkle root. They are `add64` / `sub64` / `mul64` / `neg64` / `not64` /
`xorshift64`, every one declared `(a: bigint, b: bigint): bigint`. TypeScript
enforces the types and BigInt arithmetic is exact. Not a defect.

So the honest production backlog is **~54, not 118**, and it is dominated by
`note`-severity unused locals rather than anything load-bearing.

NOT suppressed, and deliberately. An inline `// lgtm[...]` on 64 lines, or a
repo-wide exclusion of the rule, would also hide the implicit conversions this
query exists to catch in the code that is NOT BigInt arithmetic. A false
positive class that is understood and written down costs a reader one
paragraph; a suppressed one costs the next real finding.
