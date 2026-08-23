---
id: 081M0QR4RA5087G0R00377NZV2
type: bug
state: backlog
priority: P2
slug: skill-tune-up-skill-yaml-does-not-parse-an-unquoted-colon-in
title: "skill-tune-up.skill.yaml does not parse — an unquoted colon in a contract: value (found by the image-provenance scan)"
created: 2026-08-23T16:44:28.869Z
depends_on: []
composes_with: []
---

# skill-tune-up.skill.yaml does not parse — an unquoted colon in a contract: value (found by the image-provenance scan)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QR4RA5087G0R00377NZV2-*.md` glob. -->

## The defect

`.claude/skills/skill-lifecycle/blueprints/skill-tune-up.skill.yaml` does not
parse. Measured 2026-08-23 with the repo's own `yaml` package:

```
BLOCK_AS_IMPLICIT_KEY   Nested mappings are not allowed in compact mappings   line 84, col 15
MULTILINE_IMPLICIT_KEY  Implicit keys need to be on a single line             line 84, col 15
```

Line 84 is `contract: ranker reads lint output; does not run the lint` — an
unquoted value containing `: `, which YAML reads as a nested mapping key. Fix is
to quote the value.

## How it was found

Incidentally, by `src/Core.TypeScript/cluster/image-source-provenance.ts` while
it was scanning every tracked YAML for image references. It is NOT reported by
that check: the file contains no `image` text, so the prefilter skips it, and
that check is a provenance gate rather than a general YAML lint.

## The real finding underneath

**Nothing in CI parses `.claude/skills/**/*.yaml`.** A skill blueprint that does
not parse is a file whose consumers will read an empty or truncated structure —
the "a check that did not run looks like one that passed" shape, in a directory
the fleet loads from. Whoever picks this up should decide whether a `yaml`-parses
audit over `.claude/**` earns a slot, not just quote the one line.
