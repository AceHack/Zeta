---
id: 081M22V642T087G0R001HKHR9T
type: task
state: backlog
priority: P2
slug: adjudicate-38-dependabot-alerts-on-byte-preserved-research-r
title: "adjudicate 38 dependabot alerts on byte-preserved research requirement records nothing installs"
created: 2026-09-09T10:24:59.994Z
depends_on: []
composes_with: []
---

# adjudicate 38 dependabot alerts on byte-preserved research requirement records nothing installs

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M22V642T087G0R001HKHR9T-*.md` glob. -->

## The measurement

38 of the 44 open Dependabot alerts sit on exactly two files:

- `docs/research/2026-09-08-character-evolution/reconstruction-sources/requirements-resolved.txt.txt` (21)
- `docs/research/2026-09-08-character-evolution/triposg-sources/requirements-sg-resolved.txt.txt` (17)

They include the only open **critical** (transformers, GHSA-3863-2447-669p)
and 10 of the 13 open highs, so this one class dominates the dependency-alert
surface.

## Why they are probably not our vulnerabilities

The archive README states the convention outright: _"The historical source
snapshots preserve original bytes as `.txt` research records. Remove that
final suffix to obtain the original source filename."_ These are the
**resolved dependency sets of an external project**, captured as provenance
for a rejected character-reconstruction experiment -- not Zeta's declared
dependencies.

Nothing in the repo installs them. A search for the two filenames returns
only `reconstruction-inventory.json`, `triposg-inventory.json` and
`archive_sg.py.txt` (itself a `.txt` record). GitHub's dependency graph
matched them anyway, because the doubled suffix still ends in `.txt` and the
basename starts with `requirements`.

## Why this is not being dismissed unilaterally

`not_used` would be the accurate dismissal reason, and it is probably true.
It is still **38 dismissals on a public repository**, resting on a
grep-shaped proxy for "nothing installs this" rather than on a check that
re-runs. A dismissal is a claim, and a mass-dismissal that nothing can
falsify later is the failure this repo exists to prevent. So the alerts stay
open and the decision goes to the maintainer.

## Options, for whoever decides

1. **Dismiss as `not_used`**, 38 alerts, citing the README convention. Fast;
   permanently silent if a future file under `docs/research/` ever _is_
   installed.
2. **Rename the preserved files** so the dependency graph stops parsing them
   (for example `requirements-resolved.record`). Removes the alerts at the
   source -- but it edits a byte-preservation archive to quiet a scanner,
   which is the tail wagging the dog, and it breaks the stated
   remove-the-suffix convention.
3. **Leave them open** and accept the noise, on the grounds that a loud
   surface beats a quiet one.

Option 2 is the only one that changes the world rather than the report, and
it is also the one that damages an archive. That tension is why this is a
maintainer call.

## Related, and genuinely ours

- `src/Interp.Python/uv.lock` -- accelerate, GHSA-4j2p-28q2-5m79 (medium). A
  real lockfile in a real project. Not part of this adjudication.
- `src/Renderers/website/pnpm-lock.yaml` and
  `demo/identity-dla-site/pnpm-lock.yaml` -- qs, 2 alerts each, **runtime**
  scope. Real, and a separate pnpm change.
- `package-lock.json` -- mathjs, tracked as 081M22RGXDA087G0R0009FB070.
