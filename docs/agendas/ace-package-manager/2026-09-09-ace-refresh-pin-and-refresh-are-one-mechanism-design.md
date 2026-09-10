# `ace refresh` — pin and refresh are ONE mechanism (design)

**Work item:** 081M23NT5VX087G0R000KAFE45
**Date:** 2026-09-09
**Status:** implemented (`src/Core.TypeScript/ace/refresh-pins.ts`), 8 rows live

---

## 1. Why

The maintainer routed this, 2026-09-09:

> *"we want to keep quantum circuit … also lets come up with a refresh mechanism
> and put it in our ace package manager that's what it's for for the pinned
> dependencies."*

OpenSSF Scorecard's `PinnedDependenciesID` had **18 open alerts**, MEASURED
2026-09-09 over `repos/Lucent-Financial-Group/Zeta/code-scanning/alerts`:

| kind | count | alerts |
|---|---|---|
| `containerImage` | 8 | #888 #889 #283 #284 #238 #181 #179 #176 |
| `nugetCommand` | 3 | #890 #285 #264 |
| `downloadThenRun` | 3 | #714 #690 #570 |
| `npmCommand` | 2 | #783 #782 |
| `pipCommand` | 2 | #458 #457 |

A previous agent deliberately declined to blind-pin digests, and its reasoning is
this design's brief rather than an obstacle to it:

> pinning without a refresh mechanism freezes base images and can worsen posture.

That is correct and it is the whole point. **A pin nobody can refresh is how a
security posture rots** — a base image frozen in March keeps every CVE it shipped
with, silently. **A refresh that does not re-pin is how supply-chain integrity is
lost.** So the two are not a pin plus a habit; they are one mechanism with one
registry, and the verb does both or it does neither.

## 2. Shape

Three surfaces, and the first is the one that matters:

1. **The pin lives at the POINT OF USE.** `FROM image:tag@sha256:...`, inline in
   the Dockerfile.
2. **`tools/setup/manifests/pinned-refs`** — a text registry recording what is
   pinned, where, how to re-check it, and when it was last measured.
3. **`src/Core.TypeScript/ace/refresh-pins.ts`** — `--verify` (offline drift
   check) · `--report` (staleness) · `--resolve <ref>` · `--refresh <ref>`.

### Row format

```
<kind>  <file>  <ref>  <pin>  update=  remeasure=  horizon=  pinned=
```

`kind` is a **closed set** (`container | npm-advisory | nuget | npm-lock | pip`)
so a typo is a parse error rather than a row that silently never resolves.
`remeasure=` is **mandatory** — a row that omits it fails to parse, because a
default there would be a pin that can be bumped with nothing judging the new
bytes.

## 3. How it stands against `clone-at-tag-stays-sufficient`

This is the constraint that shaped every decision above, so it is answered
directly rather than gestured at.

> `ace` may be the good path and may accumulate any amount of use; the moment it
> becomes the ONLY path it is an appointed hub and manifesto §1 is violated. The
> discriminator is **exit, not degree**.

**The registry is a MIRROR, never a source.** Nothing in any build path reads
`pinned-refs`. `docker build` reads the digest out of the Dockerfile. Delete this
tool, delete all of `ace`, and every pinned dependency in the tree still resolves
exactly as it did — you lose only the *convenience of refreshing them*. That is
exit in the strict sense: a consumer can resolve without `ace`, so `ace` is an
oracle you chose.

**And the claim has a falsifier rather than a paragraph.** `--verify` refuses
whenever a registry row's digest differs from the digest actually written at its
point of use. If the registry ever quietly became the source of truth, the inline
pin would drift and that check would go red. It runs in the `gate` job **directly
beside `lint-clone-at-tag-is-sufficient.ts`**, which is where it belongs: same
invariant, one layer down.

`refresh` is deliberately **not** added to that lint's resolver verb list
(`pull|install|restore|resolve|fetch|sync|add|bootstrap`), and that is a statement
about what it does, not an evasion. Refreshing *rewrites a committed pin so a
human can read the diff*; it never resolves a dependency at build time. Measured
after the change: `lint-clone-at-tag-is-sufficient.ts` exits 0 over 7 surfaces.

## 4. The four required properties, and the mechanism for each

| property | mechanism |
|---|---|
| **pin + refresh are one verb** | one registry; `--report` and `--refresh` read the rows `--verify` polices |
| **refresh is a reviewable diff** | `--refresh` edits the point of use in the working tree and stops. Never commits, never pushes, touches only lines carrying the ref |
| **re-verify on refresh** | every row's `remeasure=` must exit 0 or the new digest is NOT kept and the file is restored |
| **staleness is observable** | `--report` classifies fresh / moved / past-horizon / **unknown**, and exits non-zero on a finding |

**UNKNOWN IS NOT FRESH.** A resolver that could not run — no network, an
unimplemented kind, an HTTP error — yields `unknown`, printed as its own class and
never folded into the fresh count. `classify()` decides `unknown` *first*, before
the horizon, because calling an unresolvable row `past-horizon` would imply we know
the pin is behind, and we do not.

## 5. What "checked" means per kind — they differ, and that is the design

| kind | the pin is | "checked" means | resolver |
|---|---|---|---|
| **container** | the registry manifest digest for the tag | the Dockerfile still **builds** on the new base — weak but real; it catches a base whose toolchain or layout moved | **implemented** (Registry HTTP API v2, `Docker-Content-Digest`) |
| **npm-advisory** | the latest version whose declared range still excludes the patched major | upstream still publishes **no** release admitting the fix | **implemented** (npm registry) |
| **nuget** | `packages.lock.json` contentHash | `dotnet restore --locked-mode` | **none — reports `unknown`** |
| **npm-lock** | `package-lock.json` integrity | `npm ci` | **none — reports `unknown`** |
| **pip** | the PyPI artifact hash | `pip install --require-hashes` | **none — reports `unknown`** |
| **downloadThenRun** | — | — | **no kind at all — see §6** |

The three unresolvable kinds are **named, not stubbed**. Their pin lives in a
lockfile rather than at a digest-bearing point of use, so their registry row shape
is a separate design. A kind with an honest "no resolver, reports unknown" is worth
strictly more than a stub that returns fresh, which would be a check that cannot
fail wearing a green tick.

**So this change closes 8 of the 18 alerts and says exactly which.** The other 10
get a documented remediation route and no false claim.

## 6. Where it composes rather than collides

A concurrent work item (**081M23ESC5B087G0R002HJ39DG**, branch
`agent/rolling-tag-pin-tla2tools-…`, not on `main` at time of writing) built a
`rolling=` regime for `tools/setup/manifests/from-url` plus
`tools/setup/repin-rolling.ts` and an append-only re-measure receipts ledger. That
mechanism owns every **fetched file** (jars, tarballs, installer scripts).

**`downloadThenRun` therefore gets no kind here.** A `curl … | sh` alert is fixed
by becoming a `from-url` row with a mandatory sha256 and refreshed by
`repin-rolling.ts`. Building a second mechanism for the same subject is exactly
the duplication a registry is supposed to prevent.

Deliberate borrowings from that design, so the two read as one system:

- `remeasure=` as colon-encoded argv, mandatory, and refusing to write a digest
  whose re-measure did not pass.
- An **append-only receipts ledger** (`pinned-refs-receipts`) with the same stated
  honest limit: a hand-written row passes, and nothing can distinguish an earned
  receipt from a typed one. What it buys is that laundering stops being a one-line
  digest diff and becomes a second, explicit, reviewable assertion.
- The **two-source digest cross-check** discipline of `refresh-ollama-pin.ts`. All
  eight container digests below were resolved by `--resolve` against the registry
  API *and* compared against Scorecard's independently computed remediation
  digests. All six distinct refs agreed byte for byte.

`src/Core.TypeScript/ace/pinned-artifact.ts` stays untouched: it owns
fetch→verify→prove for one named binary. Same discipline, different subject.

## 7. Where this DISAGREES with what is already written

Stated because the ask was to add a verb in the shape the existing design implies,
and two places do not fit cleanly.

**(a) `ace update` already exists, and it is a different subject.** The blueprint's
verb grammar has `update <url-or-path>` — *"re-solve the graph and rewrite the
lockfile; installs nothing (lock-only)"*. That operates on **ace packages** in
`ace.lock`. `refresh` operates on **external pins written into arbitrary committed
files** that ace neither installs nor owns. Same instinct, disjoint domains. The
alternative — folding external pins into `ace.lock` — was rejected precisely
because it would make `ace.lock` the source of truth for a Dockerfile's base image,
which is the appointed-hub failure §3 exists to prevent.

**(b) `slice 5.3`'s lockfile guarantee does not extend here, and should not.** The
lockfile design pins url + integrity *for ace to replay*. These pins are replayed
by `docker`, `dotnet`, `npm` and `pip` — tools that have never heard of ace. The
registry can therefore only ever *describe* them. That asymmetry is the reason for
the mirror discipline rather than an inconvenience around it.

**(c) The `update=` vocabulary is new.** `tools/setup/ace-mechanism-pointers.json`
already carries `"update": "pinned"` per dependency; this registry uses
`update=follow-tag | frozen`. They are not yet unified. Recorded as a known seam
rather than silently reconciled — reconciling them is a change to the pointer
schema and belongs in its own diff.

## 8. The `quantum-circuit` disposition (Dependabot alert #15)

Kept, per the maintainer. The dismissal's premise is enforced by
`src/Core.TypeScript/hygiene/lint-mathjs-dismissal-premise.ts` (offline) plus the
`npm:quantum-circuit!mathjs@7` row here (upstream expiry). **The first premise
offered was false** — "nothing imports it"; four files do — and the full corrected
account, with measurements, is in that lint's header.

## 9. Honest limits

- **The horizon is a policy number, not a measurement.** 60 days for a base image
  is a judgement about how long an unexamined pin may sit, not a claim about
  anyone's rebuild cadence.
- **`docker build` is a weak re-measure.** It proves the image still builds, not
  that it behaves. It is the strongest thing available for a base-image bump and
  is named as weak rather than sold as strong.
- **A hand-written receipt passes.** Stated in the ledger header too.
- **The Windows row can only be refreshed on a Windows docker host**, where
  `docker build` for a servercore base can actually run. Elsewhere the refresh
  REFUSES. That is fail-closed on the machine that cannot do the re-measure, which
  is correct, and it means that row will be refreshed rarely.
- **`--report` needs the network**, so it is a maintenance command and not a gate
  step. Only the offline `--verify` runs in `gate`.
- **AND NOTHING RUNS `--report` ON A SCHEDULE YET — the one real gap in this
  change.** Staleness is *observable*; it is not yet *observed*, and a reporter
  nobody runs is a silence wearing a mechanism's clothes: the same defect class the
  rest of this design exists to prevent. Left out deliberately rather than
  overlooked — the runner pool is measurably saturated, and adding a cron workflow
  is a fleet-resource decision that should be visible rather than slipped in beside
  a security change. The follow-up is one scheduled job running
  `refresh-pins.ts --report` and opening an issue (or a `--refresh` PR) on any
  `moved` or `past-horizon` row.

## 10. Falsifiers

`src/Core.TypeScript/ace/refresh-pins.test.ts` — 43 tests, **11 mutants applied
and all 11 killed**, with two declared CONTROLS that survive (a green happy-path
test proves nothing on its own). `lint-mathjs-dismissal-premise.test.ts` — 17
tests, **6 mutants, all killed**. Mutation logs are in each test file's header.

Both suites and both lints run in the `gate` job beside
`lint-clone-at-tag-is-sufficient.ts`.
