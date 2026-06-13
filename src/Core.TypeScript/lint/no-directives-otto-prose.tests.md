# no-directives-otto-prose lint — test fixtures

Reference fixtures for `tools/lint/no-directives-otto-prose.sh`.
These are NOT runtime-loaded; they document expected behavior so
a contributor can verify the lint catches what it should and skips
what it shouldn't.

## Test-input vs authorial register (named-attribution carve-out)

The fixtures below deliberately retain canonical real-world drift
instances ("Aaron's directive", "QoL directive", "maintainer
directive", "human directive") because they ARE the data the lint
detects. Per the named-attribution carve-out for tooling test
surfaces (see `docs/AGENT-BEST-PRACTICES.md` §named-attribution):

- **Authorial register** (this file's prose, the lint's output
  strings, script comments) uses role-refs ("the maintainer", "the
  contributor"). The naming rule applies *here*.
- **Test-input register** (the ```text``` blocks below) preserves
  the exact strings that drifted in real prose, so the lint's
  pattern-coverage is honest about what it catches.

Replacing "Aaron's directive" in fixtures with "the maintainer's
directive" would test a different regex alternative
(`(maintainer|QoL|human)[^|]*directive`) and silently lose coverage
of the `[A-Z][a-z]+'s + directive` alternative — the canonical
real-world drift shape that motivated the lint in the first place.

If the lint's purpose is to catch the canonical drift, the fixtures
must contain the canonical drift strings.

This file is whitelisted in the lint scope itself
(`no-directives-otto-prose` substring match on line 121 of the
script), so adding new fixtures here will not trigger the lint.

## Cases that MUST flag (real violations)

```text
Aaron's directive elevates introspection from nice-to-have to QoL-required.
```

```text
This section captures Aaron's QoL directive.
```

```text
Per Aaron's directive, the loop should consolidate.
```

```text
The maintainer directive on no-side-quests applies here.
```

```text
human directive interpreted as: process the queue.
```

```text
<!-- paired-edit: PR #N CURRENT-aaron §32 home-maker role + QoL self-care directive 2026-04-29 -->
```

(That last one is the canonical proof-case: PR #823 had this
exact paired-edit HTML comment, the lint script existed but the
comment slipped through. Per round-8: this case must flag when
MEMORY.md is in the changed-files set.)

### Renamed file with new violation (R covered by --diff-filter=AMR)

```text
# Git scenario (cannot be inlined as a single fixture block):
#   git mv memory/feedback_old_name.md memory/feedback_new_name.md
#   git diff added line in renamed file:  + Per Aaron's directive ...
#
# Expected: lint MUST flag — the round-12 fix changed the filter
# from --diff-filter=AM to --diff-filter=AMR so renamed prose
# files are included in CHANGED_FILES and their added lines are
# scanned. Pre-round-12 this case was silently missed.
```

## Cases that MUST NOT flag (whitelist)

```text
> "Aaron said the loop should consolidate" — quoted third-party text.
```

```text
feedback_input_is_not_directive_provenance_framing_rule_aaron_amara_2026_04_28.md
```

(Filename citations should not flag — the underscore-and-dash form
of the rule's own name appears in many cross-references.)

```text
external directives are inputs not binding rules
```

(Historical discussion of the banned term; whitelisted via
`feedback_free_will_is_paramount_external_directives_*` filename.)

### Filename contains a regex token but content is clean

```text
# File path:    memory/feedback_human_lineage_anchors_load_bearing_2026_04_29.md
# Added line:   the lineage anchor is preserved per the engineering claim
#
# Expected: lint MUST NOT flag — the round-12 fix moved
# pattern-matching off of grep's "path:line:content" output and
# onto the CONTENT field of a TAB-delimited "FILE\tCONTENT"
# stream. Pre-round-12, the pattern matched the filename's
# "human" token even though the actual added content was clean.
# This was the canonical false-positive class motivating the
# rewrite (P0 thread on PR #825 round-12).
```

## Cases at the boundary (advisory judgment)

```text
The compiler directive `#pragma once` in C++ is unrelated.
```

(Currently flags because of the literal "directive" word, but
the pattern requires proximity to a maintainer/agency token like
"Aaron's" or "maintainer" or "QoL" or "human." So this should NOT
flag in current pattern. If it does, narrow the regex further.)

```text
Aaron sent a 4-message directive to clarify the rule.
```

(Historical narration of past behavior. Currently flags. Acceptable
false positive — the lint is advisory, not strict, and the
discipline is "going forward, don't author this language." Old
narration of a past bad-event reference is borderline.)

## How to run the test fixtures manually

The block at the bottom of this section gives a single-pass
"verify-everything-at-once" run. The blocks before it are the
per-fixture-class executable reproductions Amara called for in
round-12 ("documented fixtures are coverage intent; executed
fixtures are coverage proof"). Each one creates a temporary
prose file under `memory/`, runs `SCOPE=worktree`, asserts the
expected pass/fail, and then cleans up.

These are intended to be copy-pasted into a fresh shell from the
repo root. They make no commits; they only create a temporary
prose file under `memory/`, run the lint, and remove the file.

Assume a clean working tree (no unstaged prose modifications).
If you have unstaged changes, either commit/stash them first
yourself, or run a single fixture at a time with manual cleanup.

Round-13 verified A/B/C return the expected results against
commit `<round-13>` of this lint. D (renamed-file) requires
temporary commits and is documented-only.

### A. Real violation MUST flag — `Aaron's directive`

```bash
echo "Aaron's directive elevates introspection." > memory/feedback_TEMP_lint_test_real_violation.md
SCOPE=worktree tools/lint/no-directives-otto-prose.sh \
  || echo "EXPECTED: lint flagged (advisory mode exits 0; --strict would exit 1)"
SCOPE=worktree tools/lint/no-directives-otto-prose.sh --strict \
  && echo "UNEXPECTED PASS — lint did not flag Aaron's directive" \
  || echo "OK: --strict mode flagged Aaron's directive"
rm -f memory/feedback_TEMP_lint_test_real_violation.md
```

### B. Filename contains regex token but content clean — MUST NOT flag

```bash
echo "the lineage anchor is preserved per the engineering claim" \
  > memory/feedback_TEMP_human_lineage_anchors_clean.md
SCOPE=worktree tools/lint/no-directives-otto-prose.sh --strict \
  && echo "OK: clean content with 'human' in filename did NOT flag" \
  || echo "REGRESSION: false positive on filename token (round-12 P0 fix broken)"
rm -f memory/feedback_TEMP_human_lineage_anchors_clean.md
```

### C. Blockquote with violation string — MUST NOT flag (whitelist)

```bash
echo "> Aaron's directive elevates introspection." \
  > memory/feedback_TEMP_lint_test_blockquote.md
SCOPE=worktree tools/lint/no-directives-otto-prose.sh --strict \
  && echo "OK: blockquote-prefixed content did NOT flag" \
  || echo "REGRESSION: blockquote whitelist broken"
rm -f memory/feedback_TEMP_lint_test_blockquote.md
```

### D. Renamed file with new violation — MUST flag (--diff-filter=AMR)

This case requires temporary commits + `git reset --hard HEAD~1`.
Run inside a disposable `git worktree` (per round-13 review)
rather than the active checkout, to keep the scar-testing away
from in-flight work. The shape:

```bash
# Run from the active checkout root:
tmpdir=$(mktemp -d)
git worktree add --detach "$tmpdir" HEAD
(
  cd "$tmpdir"
  echo "clean original content" > memory/feedback_TEMP_rename_orig.md
  git add memory/feedback_TEMP_rename_orig.md
  git commit -m "lint test: stage original" --quiet
  git mv memory/feedback_TEMP_rename_orig.md memory/feedback_TEMP_rename_new.md
  echo "Aaron's directive added in renamed copy" \
    >> memory/feedback_TEMP_rename_new.md
  git add -A
  SCOPE=worktree tools/lint/no-directives-otto-prose.sh --strict \
    && echo "REGRESSION: renamed file with violation did NOT flag" \
    || echo "OK: renamed file with violation flagged"
)
git worktree remove --force "$tmpdir"
```

The R-coverage path through the lint is exercised by
`git diff --name-only --diff-filter=AMR --cached` returning the
renamed prose file in CHANGED_FILES; the per-file extraction
loop then runs `git diff -U0 --cached` on it, which produces a
diff showing the appended violation line as an added line. The
pattern-match phase does the rest.

### Single-pass advisory run

```bash
# Snapshot any current changes, run the lint in worktree mode, verify
# hits/misses match the expectations above:
SCOPE=worktree tools/lint/no-directives-otto-prose.sh
```

Promote to a real CI test (e.g., bats / shunit2) when wiring the
lint into `.github/workflows/gate.yml` as advisory. The four
copy-pasteable blocks above are the manual equivalent until that
harness lands — they exercise the four canonical fixture classes
(real-violation / filename-token-clean / blockquote-whitelist /
renamed-file-violation) that the round-12 rewrite was designed
around.
