---
id: 081M0Q9Y62A087G0R003FZ6TM7
type: bug
state: backlog
priority: P1
slug: tlaps-proof-lane-dark-since-2026-07-01-60-minute-timeout-ins
title: "tlaps-proof lane dark since 2026-07-01: 60-minute timeout inside the opam tlapm build, and --check-toolchain passes while tlapm exits 127"
created: 2026-08-23T12:36:13.514Z
depends_on: []
composes_with: []
---

# tlaps-proof lane dark since 2026-07-01: 60-minute timeout inside the opam tlapm build, and --check-toolchain passes while tlapm exits 127

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0Q9Y62A087G0R003FZ6TM7-*.md` glob. -->

## Measured (2026-08-23, `gh run list --workflow tlaps-proof.yml`)

- Last **success: 2026-07-01T21:52Z** on `main`. Seven weeks dark.
- Last 100 runs: **16 success · 22 failure · 62 cancelled**. Last 12: **0 success**.

Two failure modes, separated by reading **step** conclusions rather than run conclusions.

**(a) `cancelled` = the 60-minute job timeout, and it fires in the WRONG STEP.**
`tlaps-proof.yml` sets `timeout-minutes: 60`. Runs 32605525115 / 32603717600 /
32546617239 / 32430624660 / 32387521966 all ran 60m14s±20s and every one was cut at
**`Install toolchain via three-way-parity script`** — the opam source-build of `tlapm`.
`Verify TLAPS toolchain` and `Prove all TLAPS obligations` are both `skipped`.

> This already answers half of Soraya's first prerequisite. It is **not** "a model that
> grew" — the prover never runs. It is the build. The remaining question is whether the
> opam build genuinely got slower or the `~/.opam` cache stopped hitting; the cache key
> is `hashFiles('…/from-opam-git.ts', 'tools/setup/manifests/from-opam-git', 'tools/setup/manifests/apt')`,
> and `tools/setup/manifests/**` is also a workflow _trigger path_, so a manifest edit
> both fires the lane and busts its cache in the same commit. That coupling is the first
> thing to measure.

**(b) `failure` = `exit 127`, which is `command not found`, not an unproved obligation.**
Runs 32542476787 (15m) and 32366359830 (12m):

```text
proving NciSafetyProofs with tlapm...
  FAIL: NciSafetyProofs (exit 127)
  FAIL: NciNonUrgencyProofs (exit 127)
summary: 0 proved, 2 failed, 0 missing-from-catalogue (out of 2 catalogued)
```

**The vacuity, and it is the sharp part of this item:** in both runs the preceding step
`Verify TLAPS toolchain` (`run-tlaps.ts --check-toolchain`) concluded **`success`**. It is
a green square for a check that did not check. `checkToolchain()` in
`src/Core.TypeScript/formal-verification/run-tlaps.ts` resolves in three branches, and the
third returns non-null on the mere presence of `opam`:

```ts
const opam = which("opam");
if (opam !== null) {
  return { cmd: opam, preArgs: ["exec", `--switch=${TLAPS_SWITCH}`, "--", "tlapm"], specsPath };
}
```

`opam` existing does not imply the `tlaps-build` switch contains a built `tlapm`. So the
gate proves the wrapper exists and the prove step then discovers the payload does not.
`.claude/rules/toy-is-free-metered-must-be-earned.md` — a check that cannot fail is not a check.

## Done when

1. `--check-toolchain` actually **invokes** the resolved command (`tlapm --version` and a
   non-zero exit is a failure), so branch 3 can no longer report success vacuously. A test
   that fails without the fix.
2. The 60-minute cut is attributed with evidence to **cache-miss** or **build-slowdown**,
   and fixed on that side — raise/split the cap, or repair the cache key. Opposite fixes;
   do not guess.
3. **One green run on an unchanged spec** — the lane can report at all.
4. Only then is TLA+ routable again, and `docs/TECH-RADAR.md`'s TLA+ row can drop its
   measured-lane-state paragraph.

## Composes with

- `docs/TECH-RADAR.md` — the TLA+ / TLC row records this lane state beside the Adopt ring.
- `docs/research/2026-08-23-toolchain-currency-audit-and-tech-radar-ring-drift.md` §1.2.
- `.github/workflows/tlaps-proof.yml` · `src/Core.TypeScript/formal-verification/run-tlaps.ts`
