---
name: actions/cache paths are mutually exclusive with git ls-files — silent-clobber bug class
description: Carved-sentence discipline rule. actions/cache paths must NOT overlap git-tracked files. Cache hit OVERWRITES checked-out source content with cached versions; PR edits silently revert; CI tests OLD content but reports as PR's new state. Surfaced empirically via CircuitRegistration Safety fix passing locally + failing CI; root-caused by verify-then-claim sweep.
type: feedback
---

**Rule:** `actions/cache` paths in `.github/workflows/*.yml` MUST be
mutually exclusive with `git ls-files`. Cache only DERIVED files
(downloaded jars, built artefacts, user-home tool state), never
source-controlled content.

**Bug-locus disambiguation (Aaron 2026-05-03):**
This is a **usage bug in our workflow configuration**, not a bug in
`actions/cache` or GitHub Actions. The cache action does exactly
what its docs promise: restores cached files at the configured
paths, overwriting whatever's there. We asked it to cache a path
that contained source-controlled files — it did. The fix is on our
side: narrow the cache path so it doesn't overlap source-controlled
content. A reasonable upstream feature request (warning when cache
path overlaps with checked-out git content) would be an
enhancement, not a bug fix, since the existing behavior is
documented.

**Why this is load-bearing:**

When `actions/cache` restores on a cache hit, it OVERWRITES the
freshly-checked-out source files with the cached versions. If the
cache path is a directory and that directory contains source-
controlled files, those files revert to whatever was in the cache
when it was first warmed.

**Failure mode (silent + invisible):**

1. PR modifies a source-controlled file under a cached path
2. CI checkout brings in the PR's new version
3. `actions/cache` step restores → OVERWRITES with cached old version
4. Build / test runs against OLD content
5. Test report claims PR's new content was tested ✓
6. PR merges based on stale test results

The bug only surfaces when the PR's edit introduces a NEW operator
referenced by a config (or analogous fail-loud condition) — because
then the silently-restored old content FAILS the new check, instead
of falsely-passing on stale state. Discovery-by-luck class.

**Triggering case (2026-05-03):**

CircuitRegistration `Safety` invariant fix (081KQNJ500008QG0R0001QHA1J):

- Local: `Model checking completed. No error has been found.`
  3538 states / depth 14
- CI: `Error: The invariant Safety specified in the configuration
  file is not defined in the specification.`

Diff: local ran the new spec; CI's `actions/cache@v5` step cached
`tools/tla` (whole dir, including `specs/`) and restored old content
that DIDN'T have the `Safety` operator. CI tested the OLD spec.

**How to apply:**

1. **At workflow-author-time:** when adding an `actions/cache` step,
   the path MUST be specific to derived files. If the natural-feeling
   path is a whole directory, ask: does that directory contain ANY
   source-controlled file? If yes, narrow.

2. **At verify-then-claim-time:** when a CI test fails on a config
   that works locally with the same toolchain version + same input,
   first hypothesis: "is CI testing the same content I'm testing?"
   Compare the failure error against pre-PR state. If the failure is
   "old behavior", suspect cache clobber.

3. **Structurally enforced:** `tools/hygiene/audit-ci-cache-paths.ts`
   parses every `actions/cache` `path:` and flags any overlap with
   `git ls-files`. Wired as CI lint via
   `.github/workflows/ci-cache-paths-lint.yml`. Future cache-clobber
   bugs cannot land silently — this gate fails the workflow with
   self-diagnosing output.

**Carved sentence (for retrieval):**

> *"actions/cache paths are mutually exclusive with `git ls-files` —
> cache only DERIVED files (downloaded jars, built artefacts, user-
> home tool state), never source-controlled content."*

**Composes with:**

- **Otto-272 DST-everywhere + Otto-281 DST-exempt-is-deferred-bug:**
  cache-clobber is a non-determinism source (CI tests different
  content than local); same discipline class as flaky tests.
- **Verify-then-claim:** the failure mode is silent-pass; verify-
  then-claim ("does CI actually run what I think it runs?") is the
  catch.
- **Test-fidelity contract:** the math-proofs honest assessment's
  A-grade rubric requires "Runs in CI on every commit" — but that
  presupposes CI runs the COMMIT'S content, not cached content.
  Cache clobber breaks the rubric silently.
- **CI-on-CI audit pattern:** the same shape applies to other
  meta-properties of CI workflows (e.g., timeouts not being too
  short to actually run the work; required-status-checks matching
  the workflow's job names; etc.). Future audits in this family
  follow the cache-paths audit's pattern: parse YAML, check against
  invariant.

**Tooling lineage:**

- `tools/hygiene/audit-ci-cache-paths.ts` — the audit
- `.github/workflows/ci-cache-paths-lint.yml` — the CI gate
- `.github/workflows/gate.yml` (post-fix narrowing) — the canonical
  pattern (path: jar files only, not directories)
- `.github/workflows/low-memory.yml` (post-fix narrowing) — same

**Future-Otto reference:**

When tempted to write `path: tools/<dir>` or `path: src/<dir>` in an
`actions/cache` step: STOP. Cache the specific file or files that
are DOWNLOADED or BUILT, not the directory containing them. If the
cache key is currently producing a wide directory cache, rebuild it
narrowly + bump the key suffix to bust stale state.

When CI fails on a test that works locally: suspect cache clobber
BEFORE suspecting test bug. The audit gate should catch new
violations; if you're seeing this on an existing workflow, the gate
may have a parity bug or your PR introduced a new path that the
audit's parser missed.

**Reasoning lineage:** Aaron 2026-05-03 *"lucky catch how can you
make it not lucky next time for same class or similar class"* —
triggered after the CircuitRegistration 081KQNJ500008QG0R0001QHA1J fix surfaced the
silent-clobber bug. Substrate response: audit + lint gate + this
memory file.
