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

```bash
# Snapshot fixtures into a scratch file in the changed-files scope,
# run the lint in worktree mode, verify hits/misses match the
# expectations above:
SCOPE=worktree tools/lint/no-directives-otto-prose.sh
```

Promote to a real CI test (e.g., bats / shunit2) when wiring the
lint into `.github/workflows/gate.yml` as advisory.
