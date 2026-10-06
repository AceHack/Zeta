---
id: 081M494MJ8D087G0R001A56D6D
type: bug
state: backlog
priority: P2
slug: ncinonurgency-witness-beforeeach-times-out-on-shallow-clone
title: "NciNonUrgency witness beforeEach times out on shallow-clone jar fetch"
created: 2026-10-06T17:37:00.685Z
depends_on: []
composes_with: []
---

# NciNonUrgency witness beforeEach times out on shallow-clone jar fetch

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M494MJ8D087G0R001A56D6D-*.md` glob. -->

## Acceptance

`nci-witness-receipt.test.ts` pays the historical TLC2 jar fetch once, in
`beforeAll` with a 30s hook budget, and caches the bytes. `beforeEach` only
copies the subject. A hung `git` fails closed at 25s. The historical pin and
the de-vendored rolling from-url row stay as they are.

Do not complete `081M23ESC5B087G0R002HJ39DG`. Do not lengthen WP11 (4500s),
apt (420s), or HungPast (2000ms).

## Measured failure

`test (TS hermetic)` on `b7c1eb26ee` (`gate (required)`):

`(fail) finite NciNonUrgency witness receipt > renders and accepts the one
pinned bounded witness [5008.77ms]`

`beforeEach` -> `copiedSubject()` -> `historicalJarBytes()` -> `git fetch
--depth 1 origin c6f83e35e20f8648a8a408d23f13ea3e42927264` for blob
`2fb671d8be5a1e137f001965d0246509e882aed3`. bun's default hook timeout is 5s.
Sibling tests in the same describe passed (one at 2910ms). 30996 pass, 1 fail.

## Prior-art search

- In-repo: `src/Core.TypeScript/hygiene/audit-scan-floor-routes.test.ts`
  measures bun `beforeAll` default 5s and uses an explicit hook budget for
  one-time I/O. Same shape here.
- In-repo: `081M23ESC5B087G0R002HJ39DG` de-vendored `tla2tools.jar` onto the
  rolling from-url row. That is why the historical blob is not in a
  `fetch-depth: 1` checkout. Do not complete that work-item.
- bun: default hook timeout is 5s; a global `--timeout` raise is the
  documented wrong answer in that floor-routes comment.

## Dependency check

`depends_on:` empty. No overlay parse joins. No USB-ladder hop. No
`081M23ESC5B` close.
