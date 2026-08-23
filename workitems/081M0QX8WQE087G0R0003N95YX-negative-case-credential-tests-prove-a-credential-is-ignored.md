---
id: 081M0QX8WQE087G0R0003N95YX
type: bug
state: backlog
priority: P2
slug: negative-case-credential-tests-prove-a-credential-is-ignored
title: "negative-case credential tests: prove a credential is ignored without creating one"
created: 2026-08-23T18:14:07.342Z
depends_on: []
composes_with: []
---

# negative-case credential tests: prove a credential is ignored without creating one

## The conflict, and why it is a class rather than two incidents

`src/Core.TypeScript/hygiene/lint-no-ambient-credential-hoist.ts` refuses any
tracked executable surface that puts a credential into an environment. On
2026-08-23 it reddened `main` twice within one hour, both times against a test
whose purpose was to prove that some code **ignores** ambient credentials:

| file | lines | resolved by |
|---|---|---|
| `src/Core.TypeScript/cluster/measure-lane-footprints.test.ts` | 147,148,158,160 | #14330 — wire-log assertion + comment-stripped source scan |
| `tools/setup/op-token-setup.test.ts` | 177 | #14355 — the env mutation deleted outright |

Two more agents were pulled in: one built a scoped exemption mechanism and
discarded it when the red was fixed better; one (#14353) narrowed the guard so
the second line stopped being reported.

> The only obvious way to test that a credential is ignored is to make one
> present. A guard that forbids making one present looks like it forbids testing
> its own property.

Both sides were right. The guard is right (a test file runs in CI, in a process
that spawns children, and an environment variable crosses `exec` regardless of
the child's identity). The tests were right (a verdict that changes identity with
its author is not a measurement).

## Resolution: no exemption mechanism at all

The claim under test is never about `process.env`. It is about a **function of**
an environment. Pass the environment as a **value**: the hostile case is an
object the test constructed and nothing crosses `exec`.

- `src/Core.TypeScript/secrets/env-witness.ts` (new) — `withHoistedCredential`
  builds the hoisted environment as a value; `envDigest` / `envDiffNames` /
  `envNamesCarrying` are the detector. Pure, ambient-free, **not** on the
  linter's `SELF_EXEMPT` roster, and its own test points the linter at it.
- `teachingFor()` — a finding in a test file now prints the pattern instead of a
  louder refusal. A finding in a shell script does not.
- `SELF_EXEMPT` exported and pinned as a list in the linter's test, so the whole
  exemption surface is enumerable and an addition is a reviewable line.
- Two coverage holes closed, each measured first (see below).

## Coverage holes measured on the tracked tree

| hole | status | blast radius |
|---|---|---|
| computed key (`process.env[k] = v`) walked past the regex | **closed** — always reported; unknown must not resolve permissive | **0** occurrences |
| key-only credential-name test (#14353) is evadable by renaming | **reversed** — key OR value | **0** occurrences after #14355 |
| convict every non-literal value (the sound general rule) | **not done**, named as a choice | **59** findings — a different lint, needs its own decision |

## Follow-ups this work item does NOT do

1. **A general `process.env`-write lint.** 59 sites (`HOME`, `PATH`, test
   fixtures). Worth deciding on; not decidable inside a credential guard.
2. **Lint ordering vs formatters.** #14355 reported an eslint autofix rewriting
   `process.env[key]` into the dot form *after* the guard had run — the check ran
   and the artifact then changed underneath it. That belongs to the pipeline, not
   to this guard.

## Falsifiers (all run, all restored)

1. Dot-form hoist re-inserted into a test file: guard rc=1, teaching printed.
2. Computed-key hoist inserted into `env-witness.ts` itself: guard rc=1 — the new
   helper carries no exemption and the closed hole stays closed.
3. Credential-shaped VALUE with an innocuous key: reported again (unit).
4. The same hoist under `.test.ts` / `.spec.ts`: still refused — no test-file
   exemption.
5. The linter pointed at `env-witness.ts`'s own source: clean, and the file is
   absent from `SELF_EXEMPT`, so the result is earned rather than excused.

Guard green over 2548 tracked executable files.

## Pointers

- `docs/research/2026-08-23-a-guard-that-forbids-making-a-credential-present-does-not-forbid-testing-that-one-is-ignored.md`
- `.claude/rules/dv2-data-split-discipline-activated.md` §7 noninterference
- Goguen & Meseguer 1982 — a parameter is a declared channel; the ambient
  environment is the definition of an undeclared one.
