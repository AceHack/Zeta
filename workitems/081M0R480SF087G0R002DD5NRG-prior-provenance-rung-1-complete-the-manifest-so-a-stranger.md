---
id: 081M0R480SF087G0R002DD5NRG
type: task
state: backlog
priority: P2
slug: prior-provenance-rung-1-complete-the-manifest-so-a-stranger
title: "Prior provenance rung 1 — complete the manifest so a stranger can re-derive, and record the reproducibility class"
created: 2026-08-23T20:15:58.767Z
depends_on: []
composes_with: []
---

# Prior provenance rung 1 — complete the manifest so a stranger can re-derive, and record the reproducibility class

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0R480SF087G0R002DD5NRG-*.md` glob. -->

## Ask

Make the priors manifest a **recipe**: the test is not "does it look thorough" but "can someone who
was not there use it." Add to `GamePriorsFile`: `runtime` (engine/version/os/arch),
`stepsPerTick`, `cartBuilder`, `trainerVersion` (input-closure hash), `trajectoryDigest`
(witnesses the *path*, which `obsCount` does not), and a `reproducibility` class + bound.

Pure text, no new dependency, no CI gate. Valuable alone: a complete manifest is what makes the
cheap verification sufficient and every heavier option possible.

Design: `docs/design/2026-08-23-verified-prior-provenance-prove-your-work-let-others-reproduce-exactly.md` §4, §8
