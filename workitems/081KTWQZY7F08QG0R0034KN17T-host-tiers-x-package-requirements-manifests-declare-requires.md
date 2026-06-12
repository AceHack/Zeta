---
id: 081KTWQZY7F08QG0R0034KN17T
type: task
state: backlog
priority: P2
slug: host-tiers-x-package-requirements-manifests-declare-requires
title: "Host tiers x package requirements — manifests declare requires, hosts declare capabilities, the installer matches (the cap/support pattern applied to setup)"
created: 2026-06-12T01:43:52.303Z
depends_on: []
composes_with: []
---

# Host tiers x package requirements — manifests declare requires, hosts declare capabilities, the installer matches (the cap/support pattern applied to setup)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTWQZY7F08QG0R0034KN17T-*.md` glob. -->

## Origin (Aaron 2026-06-12, verbatim)

> "maybe we should start having category or tier or something when we add a tier or packages can
> declare their requirements and os declare their capablities and that's how wo know not to
> install on small/slow runner"

Triggered by the low-memory wedge (#7865): `dotnet workload update` downloading every advertising
manifest on a constrained runner. The shape is EXACTLY the capability-ledger pattern
(db/capabilities: cap rows declare, support rows place) applied to setup — packages = cap rows
(declare requirements), hosts = support rows (declare capabilities), the installer is the
resolver. Prior art in-repo: one-liner-tools.sh ZETA_INSTALL_FULL opt-in (a 2-tier special case).

## Slice 1 (landed with this workitem)

- Manifest token `tier=<slim|standard|full>` (untagged = slim = required everywhere);
  `ZETA_HOST_TIER` declares the host (default full — dev machines get everything; the low-memory
  workflow declares slim). slim < standard < full; install when host ≥ requirement; skips are
  LOUD (named tool + both tiers).
- Applied in dotnet-tools.sh; the diagnostics suite + stryker + fsharp-analyzers tagged standard
  (build/test on slim lanes need none of them; gate lanes default to full).

## Remaining

- Auto-detect host capabilities (mem/cores) instead of/alongside the env declaration.
- Extend to brew/mise/one-liner manifests (fold ZETA_INSTALL_FULL into the same tiers).
- Unify with db/capabilities resolver wiring (one cap/support vocabulary across setup + runtime).
