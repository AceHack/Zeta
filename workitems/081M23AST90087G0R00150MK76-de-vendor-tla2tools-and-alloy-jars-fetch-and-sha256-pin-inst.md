---
id: 081M23AST90087G0R00150MK76
type: task
state: backlog
priority: P2
slug: de-vendor-tla2tools-and-alloy-jars-fetch-and-sha256-pin-inst
title: "de-vendor tla2tools and alloy jars: fetch and sha256-pin instead of committing"
created: 2026-09-09T14:57:53.952Z
depends_on: []
composes_with: []
---

# de-vendor tla2tools and alloy jars: fetch and sha256-pin instead of committing

Aaron, 2026-09-09: *"are we using features from the rolling prerelease? if not
maybe we could pin the version before, if we are then we are going to need a way
to reference the rolling tag for a while until they stop rolling. i really prefer
not to have committed jars."* And: *"also for alloy make sure we are on the
latest version there too."*

## Alloy — DONE. De-vendored, and it was already the latest.

| measured 2026-09-09 | value |
|---|---|
| latest Alloy release | **v6.2.0**, published 2025-01-09 (`releases/latest` returns it; the only newer tag is `v6.3.0-begin`, with no release) |
| committed `src/Core.Alloy/alloy.jar` | sha256 `6b8c1cb5bc93bedfc7c61435c4e1ab6e688a242dc702a394628d9a9801edb78d` |
| upstream v6.2.0 `org.alloytools.alloy.dist.jar` | sha256 `6b8c1cb5bc93bedfc7c61435c4e1ab6e688a242dc702a394628d9a9801edb78d` — **byte-identical** |
| asset mutability | `created_at == updated_at == 2025-01-09T08:18`, untouched since. No rolling hazard. |

So the de-vendoring changed the verifier by exactly nothing, and "make sure we're
on the latest" is answered by digest rather than by release notes. All three
catalogued specs (`Spine`, `InfoTheoreticSharder`, `ThreeColoring`) plus
`IdentityReissuable` and `TrustGraph` run clean against the fetched jar; no
expectation moved, because no byte moved.

## TLA+ — NOT de-vendored, and the reason is a measurement

Aaron's question splits in two and both halves have answers.

**(1) Do we use features only the rolling prerelease has? YES — one, and it is
load-bearing.** All 52 gate-tier models in `registry/tlc-models.json` were run
under three jars on 2026-09-09 (`workers=1`, the pinned invocation):

| jar | banner | verdict |
|---|---|---|
| committed (control) | `TLC2 Version 2026.05.18.174321 (rev: 8ba1027)` | **52/52 agree with the registry** |
| v1.7.4 (last immutable release) | `TLC2 Version 2.19 of 08 August 2024 (rev: 5a47802)` | **51/52** |
| v1.8.0 as re-uploaded today | `TLC2 Version 2026.09.09.124804 (rev: 65fbace)` | **52/52** |

The single v1.7.4 failure is `QuorumCollateralDeterrenceR2`. The registry pins
`expectDetail: "Temporal property Deterrence was violated"`; 1.7.4 prints only
the generic `Temporal properties were violated.` It still finds the violation and
still exits 13 — what it loses is *which* temporal property broke, and
`QuorumCollateral` has more than one. Under 1.7.4 a witness that started
violating a **different** temporal property would pass. That is precisely the
discrimination `judgeTlcRun` exists to keep, so this is a real loss, not
formatting.

(State counts are version-stable: `BftConsensus` gives the same exhaustive
4665495 distinct states under all three jars.)

**(2) Can we pin the rolling tag by digest? Yes mechanically — but the bytes we
run are gone.** The v1.8.0 tag is a genuine rolling prerelease and its
`tla2tools.jar` asset was re-uploaded on 2026-09-09 at 12:52 UTC. Three builds
observed on one unchanged URL: 2026-05-18, 2026-08-11, 2026-09-09. Our
`71546dff…` is no longer obtainable anywhere: not from the tag, and not from
Maven Central (`search.maven.org?q=a:tla2tools` → `numFound 0`).

So a from-url row for TLA is **not** a de-vendoring; it is a verifier version
change, and it costs one of two things:

- **v1.7.4** — immutable, no maintenance tax, loses the diagnostic above.
- **v1.8.0 rolling** — keeps everything (52/52 measured), and the digest pin
  fails install.sh **closed** on the next upstream rebuild. On the observed
  cadence that is roughly monthly, and each one needs 53 models re-measured plus
  a re-pin of the NCI witness receipt (`nci-witness-receipt.ts` `PIN`, the
  independent Python oracle `nci_witness_receipt_oracle.py`, and the registry
  digest they both carry) — an artefact whose entire purpose is to make a
  verifier change loud.

Both are Aaron's call, not a hygiene decision. Left committed pending it; the
manifest carries the same note so nobody re-derives it.

## Defect found and fixed on the way

`Alloy.Runner.Tests.fs` had `if File.Exists alloyJarPath then … else ()` —
a missing jar made `toolchainReady ()` false, every `assertSpecValid` return
unit, and the whole Alloy suite report green having checked nothing. Harmless
while the jar was in git; armed the moment it started being fetched. Replaced by
`the Alloy gate leg actually carries the gate on CI`, mirroring the TLA+ sibling:
off the gate leg a skip is honest de-duplication, on it a missing toolchain is a
failure.

## Named gap: Windows dev laptops

`tools/setup/install.ps1` does not drive the Bun setup realizers at all — only
`linux.sh` and `macos.sh` call `realize_mechanisms`. While the jar was committed
a Windows clone simply had it; now a Windows dev gets no Alloy jar and the Alloy
suite skips there. **Not a CI regression**: `toolchainReady ()` already filtered
Alloy to Linux x64 on CI, and the new gate-leg assertion skips off that leg by
construction. Not a silent one either — `run-alloy.ts` exits 2 naming the missing
jar. Wiring `from-url` into the PowerShell install graph is its own change;
recorded here so it is a known gap rather than a discovered one.

## Not done, reported instead

- **The fetched jar is not in the `actions/cache` blocks** (17 of them across
  `gate.yml`, `arc-lane.yml`, `installer-unit-tests.yml`). Their step name has
  said "verifier jars" since before this change while listing no jar path, which
  was already stale. Adding it would save ~21 MB per job, and would also mean a
  corrupt cache entry wedges install.sh until the key rotates — `from-url`
  re-verifies a present file and **throws**, it does not discard and re-fetch.
  That trade wants its own change.
