---
id: 081M0QRP9JY087G0R00146V04J
type: task
state: backlog
priority: P2
slug: arc-rung-b-arctransport-arcenvelope-over-the-toolkit-s-liste
title: "ARC rung B - ArcTransport + ArcEnvelope over the toolkit's listen_and_serve REST server; one real step in a real ARC-AGI-3 environment"
created: 2026-08-23T16:54:03.614Z
depends_on: ["081M0QRP3XR087G0R001NCFG83"]
composes_with: []
---

# ARC rung B - ArcTransport + ArcEnvelope over the toolkit's listen_and_serve REST server; one real step in a real ARC-AGI-3 environment

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QRP9JY087G0R00146V04J-*.md` glob. -->

**Register: `proposed`.** Design: `docs/design/2026-08-23-arc-agi-3-integration-design-chip8-chip9-atari-and-the-arena.md` §3.

The ARC-AGI Toolkit (`arc-agi`, MIT) ships `Arcade.listen_and_serve` — a blocking Flask server
exposing the toolkit's REST API, documented as existing _to allow local execution for interactions
with languages other than Python_. That is the topology; subprocess-driving and protocol
reimplementation are both rejected in §3.1 with reasons.

Do: `src/Arc.Python/` as its OWN uv project (`pyproject.toml` + `uv.lock`), never a dependency added
to `zeta-core` — `zeta-core` pins `requires-python = ">=3.14"` and `arcengine` documents >=3.12, so a
resolver failure must not be able to reach `uv sync --project src/Core.Python` on the gate. Then a
thin `ArcTransport` (versioned, replaceable) and an `ArcEnvelope` that is OURS and is TEXT
(64x64 palette indices as hex-in-JSON, per no-binary-in-proof-lineage).

**Constraints, all three required:** no gate job may depend on this lane (`workflow_dispatch` only);
nothing in `lint-clone-at-tag-is-sufficient.ts`'s `BOOTSTRAP_SURFACES` may reference it; the lane must
run with NO credential (anonymous key, or `OFFLINE` mode) and only widen when
`op://Lucent/ARCPrize API Key/credential` is present.

**Known unverified:** whether `arc-agi` installs under Python 3.14 at all. The separate-project
constraint exists because that was not checked.
