---
id: 081M23Q73MC087G0R000BZ38BZ
type: bug
state: backlog
priority: P2
slug: predictable-temp-paths-in-the-z4-discharge-and-esp-inject-te
title: "predictable temp paths in the z4 discharge and ESP inject tests"
created: 2026-09-09T18:34:52.428Z
depends_on: []
composes_with: []
---

# predictable temp paths in the z4 discharge and ESP inject tests

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M23Q73MC087G0R000BZ38BZ-*.md` glob. -->

## The alert class

CodeQL `js/insecure-temporary-file`, 4 open alerts. They are not one finding —
they split two-and-two, and the split is the point.

| alert | site | verdict |
|---|---|---|
| 641 | `verify/z4-sle-harmonic-discharge.ts:118`, reached from its test | **genuine** — hard-coded `/tmp/z4-test-cert` |
| 260, 261 | `zflash/esp-inject.test.ts:65,72` | **genuine** — `esp-inject-test-<pid>.iso` in `/tmp` |
| 224 | `hygiene/divergence-shard.ts:359` | **false positive**, and the caller is now identified |

## 641 — a hard-coded path in world-writable /tmp, for a DISCHARGE CERTIFICATE

The test used the literal `/tmp/z4-test-cert`, three times. `runZ4Discharge`
then does `mkdirSync(dir, { recursive: true })` followed by
`writeFileSync(join(dir, "z4-discharge-certificate.json"))`.

Three separate problems, none of them scanner pedantry:

- `mkdirSync` with `recursive: true` SUCCEEDS on a directory that already exists
  and belongs to another user. On a shared runner the first user to create the
  path owns it, and can then read or replace anything written there.
- `writeFileSync` FOLLOWS SYMLINKS. A pre-planted
  `/tmp/z4-test-cert/z4-discharge-certificate.json -> <target>` is an
  arbitrary-file overwrite running as the test user.
- the directory was never removed, so it persisted across runs and users.

The artifact makes it worse, not better. A **discharge certificate** is a
proof-lineage artifact; whoever can replace one can assert that a conjecture was
discharged. That is the broken-meter shape — an instrument that presents as
frozen and is actually writable by someone else.

Fix: one `mkdtempSync(join(tmpdir(), "z4-discharge-cert-"))` for the file, torn
down in `afterAll`. 0700, unpredictable suffix, created atomically — none of the
three holds against it.

## 260 / 261 — a pid is not a secret

`join(tmpdir(), \\`esp-inject-test-${process.pid}.iso\\`)`. A pid is small,
guessable and REUSED, so the full path is predictable to any local user. Both
`copyFileSync` and `openSync(.., "r+")` follow symlinks, so a link planted at
that path is again an arbitrary-file overwrite as the test user.

Fix: `mkdtempSync` for the directory, the ISO inside it, `rmSync(dir,
{ recursive: true })` on the way out.

## 224 — the caller, at last

This alert was carrying a correction that named the open question rather than
answering it: the query "is following a caller that has not been identified".

**It is the test.** `divergence-shard.test.ts:39`:

```ts
const root = mkdtempSync(join(tmpdir(), "diverge-test-"));
```

`withTempRoot` hands that `root` to `writeShardAtPath(join(root, ...))` and to
`writeDivergenceShard(root, INPUT)`, which reaches `openSync(absPath, "wx")`.
That is the only flow: `divergence-shard.ts` never calls `tmpdir()`, and the
production entry point takes `--repo-root` defaulting to `"."`
(`review-thread-observations.ts:548`) — a checkout, never a temp dir.

On the merits the flow is benign twice over: `mkdtempSync` is the SECURE idiom
(0700, unpredictable) rather than the predictable name the query is about, and
the create is `O_CREAT|O_EXCL`.

**The alert is NOT closed here and this work-item does not claim it is.** What
changed is that the flow can be argued about instead of guessed at. Disposition
is *false positive with a named flow* — a judgement for the architect and the
maintainer, not one to enact from this lane.

## Falsifiers

The 224 comment rests on one load-bearing premise — that `divergence-shard.ts`
never reaches for a temp dir itself — and a comment cannot keep a premise true.
Two new tests in `divergence-shard.test.ts` do:

- `divergence-shard.ts never calls tmpdir() outside its comments`, reading a
  COMMENT-STRIPPED copy of the source.
- `the stripper actually strips`, which pins both directions: the real file
  mentions `tmpdir()` in prose (so a no-op stripper would fail the first test),
  a commented call is stripped, and a real call with a trailing comment is not.

Mutations run:

| mutation | outcome |
|---|---|
| add a real `tmpdir()` call to divergence-shard.ts | **killed** |
| add a COMMENT mentioning `tmpdir()` and `mkdtempSync()` | **survives, correctly** — 43 pass |

The second row is the one that matters: a source-grepping guard that trips on
its own prose is the failure mode this repo has hit four times.
