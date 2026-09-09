---
id: 081M23ESC5B087G0R002HJ39DG
type: task
state: backlog
priority: P2
slug: pin-tla2tools-under-a-reusable-rolling-tag-regime-de-vendor
title: "Pin tla2tools under a reusable rolling-tag regime; de-vendor the jar"
created: 2026-09-09T16:07:33.803Z
depends_on: []
composes_with: []
---

# Pin tla2tools under a reusable rolling-tag regime; de-vendor the jar

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M23ESC5B087G0R002HJ39DG-*.md` glob. -->

`src/Core.TLA/tla2tools.jar` stops being committed and moves onto a
digest-pinned `from-url` row carrying a new, **reusable** `rolling=` regime —
built as a general mechanism rather than a TLA special case, because the
maintainer's framing was explicit: *"we might need an exception like this in the
future again."*

## What a rolling row is

An upstream that **replaces the asset behind a URL**. `tlaplus` tags `v1.8.0` as
a prerelease and republishes `tla2tools.jar` onto it. The digest stays mandatory
and still **fails closed** on every rebuild — the point of a pin under a mutable
tag is DETECTION, never permission. What `rolling=` adds is:

| surface | what it adds |
|---|---|
| `tools/setup/manifests/from-url` | `rolling=` · `identity=` · `remeasure=` · `pinsurfaces=` on one row |
| `setup-realizers/from-url.ts` | a diagnosis that names the rebuild, prints both digests, and gives the re-pin command |
| `from-url-rolling-receipts` | the pinned digest must NAME the run that judged it |
| `tools/setup/repin-rolling.ts` | one command: fetch → rewrite every pin surface → re-measure → receipt |
| `lint-verifier-jar-provenance.ts` | a third regime, `fetched-rolling`, with the receipt + pin-surface checks |

## Why the rolling tag and not immutable v1.7.4

Maintainer, 2026-09-09: *"the updates may find new cases."* v1.7.4 is immutable
and passes only **51/52** gate models — it prints the generic `Temporal
properties were violated.` where 1.8.0 names *which* property, and the registry
pins that discrimination as `QuorumCollateralDeterrenceR2`'s `expectDetail`.
tla2tools is not on Maven Central (`numFound: 0` for both `a:tla2tools` and
`g:org.lamport`, measured 2026-09-09), so there is no immutable coordinate for a
recent build.

## The cost, measured rather than estimated

`tlaplus` republishes the asset from its CI, and CI runs on pushes to `master`.
On 2026-09-09 the asset moved **three times in four hours**:

| time (UTC) | rev | sha256 | gate models |
|---|---|---|---|
| 12:48:04 | 65fbace | (not measured) | — |
| 15:25:40 | 4ad12e8 | `82cc5759…` | **52/52** |
| 16:25:36 | 4ad12e8 | `bb82311b…` | **52/52** ← pinned |

The last two share a rev — same source, different bytes, no new master commit
between them, consistent with several matrix legs of one long CI run each
uploading the artefact. **So a rebuild is often not a new checker at all, and
the digest cannot tell the difference.** That is the argument for making the
re-measure mechanical rather than a judgement call. Over the preceding 180 days
`master` had commits on **24 distinct days**.

Both measured builds were swept end to end: `82cc5759` by hand
(`docs/cross-verify/2026-09-09-tla2tools-82cc5759-gate-sweep.md`) and `bb82311b`
by `repin-rolling.ts` itself
(`docs/cross-verify/2026-09-09-tla2tools-bb82311b-remeasure.md`) — which is also
the tool's end-to-end dogfood. No registry expectation moved under either.

So the pin is stable on quiet days and can move several times inside one upstream
CI burst. Every move fails `install.sh` closed until someone re-measures and
re-pins.

## OPEN: the mirror question, for the maintainer

The measurement above is worth a decision that was not available when the routing
call was made. A third path exists and is not taken here because it is a
publication decision, not an engineering one:

> **mirror the measured bytes to an immutable coordinate we control** — one
> release asset under this org, never re-uploaded — and pin *that*. It keeps
> every property the maintainer asked for (no jar in git, newest checker, `git
> clone` at a tag still sufficient) and removes the fleet-wide breakage window
> entirely, at the cost of becoming a redistributor of an MIT-licensed
> third-party binary.

`repin-rolling.ts --check` remains the drift detector either way.

## Also fixed here

- **The from-url wedge.** An on-disk file whose digest no longer matched made the
  realizer THROW, and `from-url` is not best-effort, so `install.sh` aborted
  fleet-wide with no remedy printed and no way out but a hand `rm`. It now
  discards the stale bytes and re-fetches; fail-closed is untouched because the
  replacement is verified before it lands. This is what makes caching the jars
  safe.
- **`install.ps1` drove no Bun realizer at all**, so a Windows box never got
  `alloy.jar` — masked because Alloy's gate leg only asserts the jar on
  Linux-x64 CI. It now runs `setup-realize.ts from-url`, that one mechanism only.
- **25 `actions/cache` steps said "verifier jars" and cached neither.** Both jars
  are now in the path list (and two further steps that cache the same install.sh
  outputs were renamed to say so).
- **`doctor.sh`** told a user to `git checkout --` a file git no longer tracks.

## Not done, deliberately

`nci-witness-receipt.ts` stays pinned to TLC2 2026.05.18.174321. That receipt is
a **dated claim about which checker produced a witness**, so advancing it would
have republished a 2026-09-06 research artefact to match a newer build. Its test
now reads those exact bytes back out of git by blob id
(`2fb671d8be5a1e137f001965d0246509e882aed3`), which keeps the historical witness
reproducible forever without re-committing a binary.

