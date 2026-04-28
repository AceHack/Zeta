---
name: GENERAL RULE — always prefer SYMMETRY in naming / structure / conventions unless you explicitly opt out with a reason; PR-preservation example: `docs/pr-preservation/` (LFG canonical) mirrors `forks/AceHack/pr-preservation/` (AceHack stored in LFG) — same last-segment name, different roots; applies to folder names, file names, frontmatter schemas, test-file naming, subagent-dispatch templates, cross-repo paths; asymmetry requires justification not the reverse; Aaron Otto-255 2026-04-24 "why not make the folder names the same you should always prefere symmetry when possible unles you explitly opt out" + "AceHack itself holds nothing; will have forks/AceHack"
description: Aaron Otto-255 general discipline. Caught me on asymmetric naming (pr-preservation vs pr-reviews) during retroactive-backfill topology discussion. The rule is load-bearing: symmetry is cheap, asymmetry is expensive in cognitive overhead + Copilot-surprise + future-subagent confusion. Save short + durable.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
## The rule

**Default: symmetric names. Exception: opt-out with a
stated reason.**

Direct Aaron quote 2026-04-24:

> *"why not make the folder names the same you should
> always prefere symmetry when possible unles you
> explitly opt out"*

Plus the immediate companion:

> *"AceHack itself holds nothing; will have forks/AceHack"*

## The specific case

Retroactive PR-review backfill topology:

- **LFG canonical PRs** → `docs/pr-preservation/PR-<N>-*.md`
  (existing pattern; the name has been "pr-preservation"
  since Otto-150..154 + PR #335 + #357)
- **AceHack PRs (stored in LFG)** →
  `forks/AceHack/pr-preservation/PR-<N>-*.md`
  (same last segment: `pr-preservation`, not
  `pr-reviews` which is what I initially proposed)
- **AceHack the fork repo** — holds nothing. All
  preservation flows to LFG. The AceHack repo is
  a review surface (Otto-223 two-hop post-drain),
  not a storage surface.

Symmetry here is load-bearing: `grep -r pr-preservation
.` finds both corpora; `find forks/ -name
'pr-preservation'` works; the last-segment is the
conceptual key, the root ancestry is the attribution.

## Applies to (non-exhaustive)

- **Folder names** across repos / forks / trees —
  `pr-preservation` everywhere, not three flavours
- **File names** for same-purpose artifacts across
  different directories — `PR-<N>-drain-log.md`
  wherever a PR's drain trail lives
- **Frontmatter schemas** — same field names across
  memory / skill / persona files for same concept
- **Test-file naming** — `Foo.Tests.fs` everywhere,
  not `FooTests.fs` sometimes and `Foo.Tests.fs`
  other times
- **Subagent-dispatch templates** — same constraint
  blocks phrased the same way across dispatches
- **Cross-repo paths** — same tree shape on both
  sides of a fork relationship when purpose is
  the same
- **CI workflow names** — same job name for same
  check across matrices / repos
- **Branch-protection rulesets** — same rule set
  name (e.g. "Default") across repos that share
  a policy

## When "explicit opt-out" applies

Narrow carve-out only when symmetry would actively
harm. Examples:

- **Platform limits** — LFG can have a merge queue,
  personal forks can't (platform-level asymmetry
  not my choice)
- **Role difference** — canonical repo vs fork repo
  hold different privileges; a "merge queue" name
  on the fork side would lie about the shape
- **Pre-existing convention that's cheap to keep** —
  if the rest of the ecosystem uses asymmetric
  names and renaming is expensive, stay asymmetric
  with a note; don't partial-rename
- **Security / redaction** — sometimes the
  asymmetry is a firewall on purpose

Each opt-out carries a one-line explanation
(`# asymmetric-on-purpose: <reason>`).

## Why symmetry is default

- **Grep-ability** — one name works everywhere
- **Subagent onboarding** — they don't have to learn
  N variants for one concept
- **Human cognitive load** — same shape = same
  role; mismatched shapes require a lookup
- **Copilot-surprise minimization** — mechanical
  reviewers flag asymmetry as suspicious
- **Cross-cutting refactors** — mass moves / renames
  / schema migrations work on uniform names

## Composition with prior memory

- **Otto-252** LFG central aggregator — Otto-255
  adds: the AGGREGATE paths under the LFG tree for
  fork signal must be SYMMETRIC to the canonical
  paths, just rooted under `forks/<fork-name>/`
- **Otto-253** AceHack-touch-timing — Otto-255 is
  the paths principle; Otto-253 is the timing
  principle; they compose (wait until drain done,
  then land symmetric paths)
- **Otto-254** roll-forward default — Otto-255 is
  the NAME default; Otto-254 is the ACTION default;
  they compose (when correcting an asymmetric
  name, roll forward to the symmetric one rather
  than reverting to old state)
- **Otto-171** queue-saturation — Otto-255 doesn't
  change throttle cadence; it changes the names
  used in the work that flows through the throttle

## What this memory does NOT say

- Does NOT forbid asymmetry. Explicit opt-out with
  a reason is real.
- Does NOT require retroactive renames of every
  pre-existing asymmetry in the repo. Roll forward:
  use symmetric names in NEW work; asymmetric rename
  of old paths is a separate discretionary task.
- Does NOT apply to project-specific vocabulary —
  `ZSet` vs `Spine` vs `BackingStore` aren't "the
  same concept with different names", they're
  different concepts. The rule is about SAME
  concept across different locations, not
  vocabulary harmonization.

## Direct Aaron quotes to preserve

> *"why not make the folder names the same you
> should always prefere symmetry when possible unles
> you explitly opt out"*

> *"AceHack itself holds nothing; will have
> forks/AceHack"*

Future Otto: when naming a new folder / file /
schema / job / branch / ruleset that parallels an
existing one, DEFAULT TO THE SAME NAME. If you
deviate, write the opt-out reason inline.
