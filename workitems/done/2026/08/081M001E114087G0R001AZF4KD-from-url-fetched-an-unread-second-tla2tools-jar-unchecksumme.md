---
id: 081M001E114087G0R001AZF4KD
type: bug
state: done
priority: P2
slug: from-url-fetched-an-unread-second-tla2tools-jar-unchecksumme
title: "from-url fetched an unread second tla2tools.jar unchecksummed and the docs named a version nothing runs"
created: 2026-08-14T11:45:03.524Z
completed: 2026-08-14T12:02:12.305Z
depends_on: []
composes_with: []
---

# from-url fetched an unread second tla2tools.jar unchecksummed and the docs named a version nothing runs

Surfaced by #10548 while pinning the TLC invocation. Two artefacts read as
authoritative and were not.

## 1. An unchecksummed fetch of a jar nothing loads

`tools/setup/manifests/from-url` downloaded `tla2tools.jar` to
`tools/tla/tla2tools.jar` and `alloy.jar` to `tools/alloy/alloy.jar`. Every
runner loads the COMMITTED jars instead:

- `src/Core.TypeScript/formal-verification/run-tlc.ts:160` -> `src/Core.TLA/tla2tools.jar`
- `tests/Tests.FSharp/Formal/Tlc.Runner.Tests.fs:63` -> `src/Core.TLA/tla2tools.jar`
- `src/Core.TypeScript/formal-verification/run-alloy.ts:90` -> `src/Core.Alloy/alloy.jar`
- `tests/Tests.FSharp/Formal/Alloy.Runner.Tests.fs:44` -> `src/Core.Alloy/alloy.jar`

No workflow and no devcontainer referenced `tools/tla/` or `tools/alloy/`. The
only consumer of the downloaded path was `tools/setup/doctor.sh`, which checked
that the download had happened -- a check on the installer's own output, closing
a loop nothing else entered.

Neither row carried a `sha256=`, though `from-elan` and
`from-autotools-tarball` both require one.

## 2. The URL was a mutable pointer

`https://github.com/tlaplus/tlaplus/releases/download/v1.8.0/tla2tools.jar` is
tagged `v1.8.0` but the release is a rolling `prerelease` ("The Clarke
release", created 2026-07-15) whose assets are re-uploaded in place. Measured
2026-08-14:

| | sha256 | bytes | banner |
|---|---|---|---|
| committed `src/Core.TLA/tla2tools.jar` | `71546dff...` | 4,357,353 | `TLC2 Version 2026.05.18.174321 (rev: 8ba1027)` |
| same URL fetched today | `ab323b79...` | 4,486,193 | `TLC2 Version 2026.08.11.125311 (rev: 0894c34)` |

Same URL, different bytes, three months apart. `@v4`-shaped mutability one
layer down from the actions.

## 3. The docs asserted a version nothing runs

`docs/dependency-status.md` and `docs/INSTALLED.md` claimed `tla2tools.jar
v1.8.0`. TLC reports date-stamped builds and never reports `1.8.0`, so the
claim could not have been true of any jar. `docs/INSTALLED.md` additionally
credited the manifest with installing `src/Core.TLA/tla2tools.jar`, a path the
manifest never wrote.

Alloy's claim was accurate by contrast: the committed `alloy.jar` hashes
`6b8c1cb5...`, byte-identical to upstream `org.alloytools.alloy.dist.jar` from
the immutable v6.2.0 release (published 2025-01-09, never re-rolled).

## Fix

Delete the rows rather than checksum them (nothing reads the destinations, and
a digest on a re-uploaded asset would fail on upstream's schedule, not ours);
make `sha256=` mandatory in the from-url realizer so no future row can skip it;
repoint `doctor.sh` at the committed jars; and derive the documented version
from the jar's own `META-INF/MANIFEST.MF` under a lint so the claim cannot
drift from the binary again.

Distinct from `registry/smt2-solver-floor.json`: z3/cvc5 arrive from the
runner's apt with an ambient version, so they need a floor. These jars are
committed, so they need provenance that matches the bytes.
