---
id: 081M0Q9Y658087G0R002ZWZNSF
type: task
state: backlog
priority: P1
slug: net-sdk-pin-10-0-302-is-one-security-servicing-roll-behind-1
title: ".NET SDK pin 10.0.302 is one security servicing roll behind 10.0.303 (runtime 10.0.11, 10 CVEs, 2026-08-11)"
created: 2026-08-23T12:36:13.608Z
depends_on: []
composes_with: []
---

# .NET SDK pin 10.0.302 is one security servicing roll behind 10.0.303 (runtime 10.0.11, 10 CVEs, 2026-08-11)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0Q9Y658087G0R002ZWZNSF-*.md` glob. -->

## Measured (2026-08-23, `dotnet/core` release-notes JSON)

|                             | value                                                |
| --------------------------- | ---------------------------------------------------- |
| `global.json`               | SDK `10.0.302`, `rollForward: latestPatch`           |
| `.mise.toml`                | `dotnet = "10.0.302"` — an **exact** pin             |
| 10.0.302 shipped with       | runtime **10.0.10**, 2026-07-14                      |
| latest in the same 3xx band | **10.0.303**, runtime **10.0.11**, 2026-08-11        |
| latest overall              | 10.0.400 (4xx feature band, same 2026-08-11 release) |

The 2026-08-11 release is `"security": true` and carries **10 CVEs**:
CVE-2026-62898, -62899, -62900, -62901, -62886, -62871, -70354, -62902, -62897, -62909.

## The subtlety worth naming — `rollForward: latestPatch` is inert here

`global.json` says roll forward to the latest patch, which _would_ pick up 10.0.303 on a
machine that has it. But `.mise.toml` pins `dotnet = "10.0.302"` exactly and mise is what
installs the SDK on dev laptops and CI. So mise installs exactly one SDK and `rollForward`
has nothing to roll to. **The `.mise.toml` line, not `global.json`, is the effective pin.**
Bumping only `global.json` would change nothing.

Corroborating: `Directory.Packages.props` already pins
`Microsoft.Extensions.DependencyInjection` / `System.IO.Hashing` / `System.Numerics.Tensors`
at **10.0.11** — the runtime the _newer_ SDK ships. The libraries moved; the SDK did not.

## Done when

- `.mise.toml` and `global.json` both move to `10.0.303` **in one commit** (three-way parity
  per GOVERNANCE §24 — also check `full-ai-cluster/nixos/` and `tools/setup/` for the same
  string), and `dotnet build -c Release` + `dotnet test Zeta.sln -c Release` are green.

Staying inside the **3xx** band is deliberate: 10.0.400 is a feature-band move that also
implies `FSharp.Core 10.1.400 → 11.0.100`. That is a separate, larger change.

## Not a Dependabot gap

Dependabot has no ecosystem for `global.json` or `.mise.toml`. This class of pin is
**invisible to every bot we run** — see the sibling item on Dependabot ecosystem coverage.
