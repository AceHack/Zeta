# A guard that forbids making a credential present does not forbid testing that one is ignored

**2026-08-23** · work-item `081M0QX8WQE087G0R0003N95YX` · shadow

## The measurement

`src/Core.TypeScript/hygiene/lint-no-ambient-credential-hoist.ts` reddened `main`
twice in one hour, from two independently written tests, and was narrowed once in
response:

| time (Z) | actor | event |
|---|---|---|
| ~17:0x | agent A | `measure-lane-footprints.test.ts:147,148,158,160` — hoist in a test proving a tool ignores ambient credentials |
| 17:50 | agent A | **#14330** resolves it: wire-log assertion + comment-stripped source scan. No exemption. |
| ~17:5x | agent B | `op-token-setup.test.ts:177` — the same defect, independently, in a different subsystem |
| — | agent C | builds a scoped `// hoist-guard-exempt: <reason>` mechanism with seven falsifiers for that red, then **drops it** when B fixes the red better — rather than ship a licence with zero call sites |
| 18:17 | agent D (#14353) | merging `main` into an unrelated installer PR hit B's red and **narrowed the guard**: `CREDENTIAL_NAME` now tests the assigned KEY only |
| 18:20 | agent B (#14355) | resolves its own red properly, by **deleting the env mutation** |

Two independently-written instances of one defect inside an hour — plus two more
agents pulled into resolving them, one of whom narrowed the guard — is a class,
not a run of individual mistakes.

## The shape

> The only obvious way to test that a credential is ignored is to make one
> present. A guard that forbids making one present looks like it forbids testing
> its own property.

Neither side was wrong. The guard is right: a test file runs in CI, in a process
that spawns children, with credential-shaped values in scope, and an environment
variable crosses `exec` regardless of the child's code identity — which is why
§13 noninterference names the ambient environment as the undeclared channel and
why no signature, ACL, IMA policy or TPM seal can reach it. The tests were right
too: a footprint whose verdict depends on who measured it is not a measurement.

## The resolution, and why no exemption mechanism was built

The claim under test is never about `process.env`. It is about a **function of**
an environment:

- "does `measureImage` present an ambient token on the wire?" is about
  `measureImage`, which takes its `fetch` by injection;
- "would my env assertion notice a hoist?" is about **the assertion**, which is a
  pure function of an env-shaped value.

Neither needs the ambient channel. Pass the environment as a **value**: the
hostile case becomes an object the test constructed, the detector gets its
adversarial input, and nothing crosses `exec`.

Three forms, strongest first:

1. **Inject it.** The code under test takes `env` as a parameter; the hostile
   environment is a literal. `credential.ts`'s `buildChildEnv(parentEnv, ...)`
   was already this shape — the seam pre-existed the problem, and its tests prove
   "the parent is not mutated" with no credential and no keychain in the run.
2. **Witness it.** `src/Core.TypeScript/secrets/env-witness.ts` (new):
   `withHoistedCredential` returns a copy carrying the credential;
   `envDigest` / `envDiffNames` / `envNamesCarrying` are the detector, aimed at
   whichever environment you hand them.
3. **Scan the source.** When the claim is "this module names no credential
   variable at all", assert it against comment-stripped source — #14330's form,
   including its reason for stripping comments: the module's own header names
   those variables in order to say it ignores them, so scanning prose would fail
   on the documentation of the property and pass the moment someone deleted the
   paragraph.

An annotated per-line exemption (`<!-- adjudicated: ... -->`, machine-checked,
modelled on `no-binary-in-proof-lineage`'s five conditions) was the fallback. It
was not needed. Building it anyway would have been the worse outcome: an
exemption mechanism permanently widens a guard's surface, and every later author
reaches for the annotation instead of the pattern. One agent already built and
discarded one on exactly that reasoning.

> Before adding an exemption to a guard, check whether the thing being tested is
> a **function of** the forbidden state rather than the state itself. If it is,
> pass the state as a value and the conflict dissolves.

## Two ways the value form is strictly better, not merely lint-compliant

- **`try/finally` leaves a real window.** `bun test` runs a file's tests in one
  process, so between the assignment and the `finally` any child spawned by any
  concurrently-running test inherits the credential-shaped variable — the defect,
  performed in order to test for it. A constructed object has no window.
- **The old assertion printed secrets on failure.**
  `expect(JSON.stringify(process.env)).toBe(before)` puts *both* environments in
  the failure message; on a developer machine that is a live secret in a CI log.
  `envDigest` fails as two hashes and `envDiffNames` reports which **names**
  moved. Values never reach the output.

## Two holes in the guard, measured before touching either

### Closed: a computed key walked straight past the rule

The rule's bracket branch accepted only a **quoted** key, so
`process.env[key] = secret` — the same write, one keystroke different — was
invisible. That is a hole shaped like coverage.

It is now reported unconditionally, because no name test can clear a key that is
not knowable at lint time, and resolving *unknown* as permissive is the
disposition `src/Core/DerivationProtocol.fs` refuses for licences. The escape
hatch is free and improves the code: write the key as a literal, so the guard —
and `grep`, and a reviewer — can see which variable is being set.

**Blast radius measured: 0.** There are no computed-key `process.env` writes in
the tracked tree.

The hole was found because the #14355 agent reported that *an eslint autofix
rewrote `process.env[key] = …` into the dot form after the guard had run*. That
is worth naming as its own failure mode: the check ran, and then the artifact
changed underneath it. It is a sibling of "a check run against a tree that
doesn't contain the subject is a check that did not run" — same family, later
clock. It belongs to the lint-ordering pipeline (formatters must run before the
checks that judge their output, or the checks must run on the committed tree),
not to this guard, and it is recorded here rather than absorbed.

### Reversed: the key-only narrowing let a rename evade the guard

#14353 changed `CREDENTIAL_NAME` to test the assigned KEY alone, reasoning that
"a value named `FAKE_TOKEN` is not a hoist". The general principle is sound. The
specific line it cleared was not covered by it —
`process.env.ZETA_TEST_HOIST_PROBE = FAKE_TOKEN` really was a hoist, which
**#14355 confirmed three minutes later by deleting the mutation outright**.

The cost of the narrowing is structural: the author picks the key, so a key-only
test lets *the subject choose whether it is inspected* — the same defect as
pigeonholing by self-claim. Restored to key **or** value.

**Blast radius measured: 0** (after #14355). Both readings are recorded in the
test that reverses it, rather than one silently replacing the other.

### Not done: convicting every non-literal value

The sound rule is that a value which is not a literal could be anything, so any
`process.env` write with a computed value is suspect. **It measures at 59
findings** — `process.env.HOME = tempHome`, `PATH` prepends, `ace` test
fixtures. That is a different lint, about `process.env` writes in general, and it
deserves its own decision rather than arriving inside a credential guard. Named
here so the omission is a choice on record and not an oversight.

## The other half: the error had to teach

Aaron, today: an error should give teaching and a correction to the generating
model, not a louder version of "it failed."

The old message named the rule and pointed at `credential.ts`
(`withCredential` / `spawnWithCredential`). Correct, and useless to all three
agents, because none of them was trying to *use* a credential — they were trying
to prove one was ignored, and nothing told them how to say that. Three people
needing the same missing sentence in two hours measures the message, not them.

`teachingFor(findings)` now branches: a finding in a test file gets the pattern
above; a finding in a shell script does not, because teaching that fires
everywhere teaches nothing. It is a function with its own falsifiers rather than
a string at the exit site, so the branch is checkable.

## Falsifiers run

| # | mutant | result |
|---|---|---|
| 1 | dot-form hoist re-inserted into a test file | guard rc=1, teaching printed |
| 2 | **computed-key** hoist inserted into a production file | guard rc=1 — the closed hole stays closed, and no test-teaching printed |
| 3 | credential-shaped VALUE with an innocuous key | reported again (unit) |
| 4 | the same hoist line under `.test.ts` / `.spec.ts` | still refused — no test exemption |
| 5 | the linter pointed at `env-witness.ts`'s own source | clean, and the file is **not** on `SELF_EXEMPT` — the result is earned |

All restored; guard green over **2548** tracked executable files.

## The staleness note that belongs beside all of it

The #14355 agent's post-mortem, preserved verbatim because it is the sharper half
of the lesson:

> *"It passed locally because the lint scans **tracked** files and I ran it while
> the file was untracked: a check run against a tree that doesn't contain the
> subject is a check that did not run."*

The same trap was live here — `env-witness.ts` was untracked when the guard first
reported green, and that green meant nothing. `git add` first, then re-run, then
read the file count: 2546 → 2548 is what makes the verdict about *this* tree.

## Pointers

- `src/Core.TypeScript/secrets/env-witness.ts` (+ `.test.ts`) — the helper and its falsifiers
- `src/Core.TypeScript/hygiene/lint-no-ambient-credential-hoist.ts` — `teachingFor`, `processEnvAssignment`, `SELF_EXEMPT` (exported, pinned)
- `src/Core.TypeScript/cluster/measure-lane-footprints.test.ts` — #14330, the source-scan form
- `.claude/rules/dv2-data-split-discipline-activated.md` §7 noninterference · Goguen & Meseguer 1982
- `.claude/rules/numerology-vs-number-theory.md` — three independent instances is the *warning* shape; here they share one mechanism, which is why it is a class rather than a coincidence
