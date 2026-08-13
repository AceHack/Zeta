---
id: 081KZYAGTB6087G0R002W8CWQK
type: bug
state: backlog
priority: P2
slug: pnpm-tarball-extraction-flake-hit-ci-3x-in-one-day-root-devd
title: "pnpm tarball extraction flake hit CI 3x in one day; root devDependency paid by all 15 workflows"
created: 2026-08-13T19:45:23.302Z
depends_on: []
composes_with: []
---

# pnpm tarball extraction flake hit CI 3x in one day; root devDependency paid by all 15 workflows

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZYAGTB6087G0R002W8CWQK-*.md` glob. -->

## Evidence — three failures, one cause, 2026-08-13

```
error: Fail extracting tarball for "pnpm"
error: Fail extracting tarball from pnpm
##[error]Process completed with exit code 1.
```

| Time | Where |
|---|---|
| ~18:16 | `test` job on PR #10353 |
| 19:10 | `Deploy to GitHub Pages` on main |
| 19:40 | `drift-sweep` on main |

Each was re-run and passed, so this is transient extraction/fetch failure, not a bad
lockfile. But three in one day across unrelated workflows is a pattern, not noise.

## Why every workflow pays for it

`pnpm@10.15.1` is in the **root** `devDependencies` (`package.json:50`), while the repo's
own `packageManager` is `bun@1.3.13`. **15 workflows run `bun install`**, so all fifteen
fetch and extract the pnpm tarball on every run.

**The dependency is NOT accidental — do not simply delete it.** It is genuinely used:

- `src/Core.TypeScript/discovery/identity-dla-pages-build.ts:13` resolves
  `join(repoRoot, "node_modules", ".bin", "pnpm")`
- `:20-21` throws a teaching error if it is missing
- `:24-25` runs `pnpm install --frozen-lockfile` then `pnpm check` inside
  `demo/identity-dla-site`, which is a real pnpm project with its own `pnpm-lock.yaml` and
  `packageManager: pnpm@10.4.1`

So exactly **one consumer** needs it, and **fifteen** pay for it.

## Fix shape (ranked)

1. **Move the cost to the consumer.** Drop `pnpm` from root `devDependencies` and have only
   the Pages-build path provide it (a dedicated install step, or corepack). Fourteen
   workflows stop fetching a tarball they never use, and the flake surface shrinks by ~93%.
   *Risk: the Pages build breaks if the resolution path is missed — `identity-dla-pages-build.ts:13`
   hardcodes `repoRoot/node_modules/.bin/pnpm`, so it must be updated in the same change.*
   This is the Rodney's-Razor answer: the dependency is essential **to one consumer**, so it
   should not be a root cost.
2. **Retry wrapper** on `bun install`. Cheap and safe, but 15 edit sites and it treats the
   symptom — every workflow still downloads pnpm.
3. **Better cache keying** so the tarball is not re-fetched. Helps only on cache hits.

## Not the cause

The failures are unrelated to the GH013 ruleset regression that is also currently reddening
`drift-sweep` and friends (that one is `Required status check "gate (required)" is expected`).
Two distinct problems on the same workflows — worth keeping separate when triaging.


## Split framing (Aaron, 2026-08-13) — better than "move it to the Pages path"

> *"can we can split this out to different workflows and have one use the result of the
> other if needed or different routes, we can also do different repos if needed, whatever
> is best — we are working on splitting out to multi repo over time, this is going to be a
> long migration."*

**The split is already latent in the structure, and the flake is the seam showing.**
`demo/identity-dla-site` is not a directory with an odd dependency — it is a **separate
project**: its own `pnpm-lock.yaml`, its own `packageManager: pnpm@10.4.1`, distinct from
the root's `bun@1.3.13`. Two projects currently share one root install, and that sharing is
exactly what makes fifteen workflows pay for one consumer's toolchain.

Three routes, in increasing order of how much migration they represent:

1. **Separate workflow, same repo.** A `pages-site` workflow that installs pnpm itself,
   path-filtered to `demo/identity-dla-site/**`. The other 14 workflows stop fetching the
   tarball. Cheapest, reversible, and available today.
2. **Job-to-job artifact handoff** — the *"one uses the result of the other"* shape. Build
   the site in one job, upload the artifact, let deploy consume it. Worth it when the build
   is expensive; **here it is cheap**, so this mostly buys isolation rather than time and
   adds an artifact hop without removing the coupling. Probably skip.
3. **Separate repo.** `identity-dla-site` arguably already *is* one — own lockfile, own
   package manager, own toolchain. A clean early candidate for the multi-repo migration
   precisely *because* it is small and its seam is already visible as a CI flake.

**Recommendation: (1) now, (3) when the migration reaches it.**

**And there is a DV2.0 argument for (3) independent of the flake.** The site changes at a
different rate than the core, has different dependencies, and different reviewers — that is
a change-rate boundary, which is this repo's own stated criterion for where a split belongs
(`.claude/rules/dv2-data-split-discipline-activated.md` §5). The flake is not the reason to
split; it is the symptom that reveals a boundary that was already there.
