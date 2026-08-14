---
id: 081KZYXRYR8087G0R003E6JZA4
type: bug
state: backlog
priority: P2
slug: unexecuted-test-files-checker-walks-gitignored-dist-so-it-ex
title: "unexecuted-test-files checker walks gitignored dist so it exits 1 on any built dev machine"
created: 2026-08-14T01:21:52.904Z
depends_on: []
composes_with: []
---

# unexecuted-test-files checker walks gitignored dist so it exits 1 on any built dev machine

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZYXRYR8087G0R003E6JZA4-*.md` glob. -->

## The defect

`src/Core.TypeScript/hygiene/unexecuted-test-files.ts` (shipped in #10473) walks the **working tree**,
which includes `dist/` — a **gitignored** build-output directory (`.gitignore:7`, **0 files tracked**).
`dist/` contains copies of `docs/recovered-orphan-branches-2026-05/**` test files, so the checker reports
them as un-executed and **exits 1**.

**CHECKED**: on unmodified `origin/main`, on a machine that has built, `bun
src/Core.TypeScript/hygiene/unexecuted-test-files.ts` → **exit 1** with four `dist/...` complaints.

## Why it passes in CI and fails locally

CI checks out clean and does not have a populated `dist/` at check time. A developer who has run a build
does. So the checker is **green in CI and red on the machines of everyone who might fix what it finds** —
which is the worst polarity for an adoption-dependent tool. A checker people learn to ignore locally is a
disabled checker.

## The fix, and it is a lesson already learned in this repo

Walk the **tracked** file set (`git ls-files`), not the working tree. This is exactly the reasoning
already written into `src/Core.TypeScript/ace/build-graph.ts` (#10395):

> evidence derived from the **tracked** set, so `derive` is identical on every checkout — a working-tree
> walk would have picked up caches and made it machine-dependent

Same defect, same fix, one subsystem over. Worth noting as an instance of a lesson not travelling: the
build-graph work found and documented this, and the next checker built repeated it.

## Acceptance

- Checker exits 0 on a built working tree with no other findings.
- The discovered set is a pure function of the tracked files, so it is identical on every checkout.
- A regression test that plants an untracked `*.test.ts` and asserts the checker ignores it.

