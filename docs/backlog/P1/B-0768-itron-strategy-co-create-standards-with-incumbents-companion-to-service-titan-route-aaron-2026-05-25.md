---
id: B-0768
priority: P1
status: open
title: Itron strategy — co-create standards with incumbents (companion to ServiceTitan route B-0765); dual-mode adoption playbook
effort: L
ask: aaron 2026-05-25
created: 2026-05-25
last_updated: 2026-05-25
depends_on:
  - B-0765
composes_with:
  - B-0741
  - B-0744
  - B-0747
  - B-0748
  - B-0749
  - B-0754
  - B-0761
  - B-0762
  - B-0763
  - B-0764
  - B-0766
  - B-0767
tags: [strategy, standards, incumbent, partnership, itron, cisco, dual-mode, adoption, co-creation]
---

## Problem

Aaron 2026-05-25 mid-iteration-2-wait, naming the second
empirical anchor for the standards-layer-as-negotiation-high-seat
strategy: *"This was also Itron strategy negotation standards and
even create them with cisco cause they were incumbent and ST is
up and commer."*

B-0765 captured the ServiceTitan strategy (up-and-comer plugs
into existing standards built by incumbents; delivers new value
within them). The Itron pattern is the **incumbent-with-incumbent
sharpening**: when both sides are established players, **co-create**
the standards instead of one plugging into the other's. Both
incumbents win — the co-authored standard becomes their joint
moat, and the rest of the ecosystem has to consume it on the
co-authors' terms.

Itron's empirical history demonstrates the pattern: smart-grid /
utility-metering substrate (ANSI C12 family, Wi-SUN, OpenADR,
IEEE 2030.5, etc.) was co-created with Cisco because Cisco was
the incumbent in the networking layer Itron's meters had to
traverse. Neither competed at the standards layer; they negotiated
it together.

## Target

Document + operationalize the **dual-mode adoption playbook** for
Zeta cluster substrate:

| Mode | When applies to Zeta | Tactical execution |
|---|---|---|
| **Up-and-comer (ServiceTitan)** | Today — Zeta is new entrant in cluster-infra | Plug into existing standards (k8s CRDs, OAM, Crossplane, Helm, CNCF projects per B-0764). Deliver new value within them. Per B-0765 — the existing strategic filter. |
| **Incumbent-with-incumbent (Itron)** | Future — when Zeta has meaningful adoption + a layer where Zeta is the established player + needs another incumbent's collaboration | Co-create new standards with another incumbent. Joint moat. Examples: NVIDIA on GPU scheduling primitives, hyperscalers on AI-workload portability formats, CNCF projects on Zeta-grounded extensions to their CRDs |

The substrate-honest argument: **the strategic position determines
which playbook applies**. Both playbooks operate at the standards
layer; the choice of plug-in-vs-co-create depends on whether you're
the new entrant or the established player on a specific axis.

## Why this matters for the Zeta cluster substrate

The full cluster substrate spans multiple axes; Zeta's position
varies per axis:

| Axis | Zeta's positioning today | Playbook applies |
|---|---|---|
| K8s control plane | Up-and-comer | ServiceTitan (B-0765) — plug into existing CRD / Helm / GitOps standards |
| CNCF ecosystem composition | Up-and-comer | ServiceTitan + B-0764 force-multipliers |
| AI-cluster substrate (workload-class scheduling, GPU topology, model locality) | **Pioneer** — there is no incumbent at this specific intersection | **Itron** — co-create standards with NVIDIA + hyperscalers + AI-framework vendors who all have incumbent positions adjacent to this gap |
| Determinism for distributed systems (DST) | Pioneer (TigerBeetle + FoundationDB + Zeta are the only serious DST shipping substrates) | **Itron** — co-create DST standards with TigerBeetle / FoundationDB / Antithesis as incumbents in their respective DST contexts |
| Algebra-grounded stream processing (DBSP) | Pioneer (Materialize, Feldera/dbsp, Zeta) | **Itron** — co-create DBSP standards with Materialize + Feldera |
| Retraction-native consent algebra | Pioneer (Zeta is the only serious shipping substrate) | **Itron** — gather other consent-algebra-curious incumbents (Sandstorm, MaidSafe alumni, etc.) and co-author |
| Reference architecture for AI clusters (B-0761) | Pioneer | **Itron** — co-create with anchor early-adopter labs / companies running real AI clusters who haven't yet codified their reference |

The pattern: **wherever Zeta is up-and-comer, ServiceTitan-plug-in;
wherever Zeta is pioneer in a gap with adjacent incumbents,
Itron-co-create**.

## Acceptance

- [ ] Document the dual-mode playbook explicitly in
      `docs/strategic-substrate.md` (or compose with B-0765's
      document if filed there)
- [ ] Per-axis positioning audit: classify Zeta's current
      position per substrate axis (control-plane, CNCF
      composition, AI-cluster substrate, DST, DBSP, consent
      algebra, reference architecture); name which playbook
      applies per axis
- [ ] Identify Itron-mode opportunities + candidate co-creation
      partners:
      - GPU scheduling primitives → NVIDIA (CUDA + NVLink),
        AMD (ROCm), Intel (oneAPI), Apple (Metal Performance
        Shaders for Mac-cluster scope)
      - AI-workload portability formats → Hugging Face, AWS
        SageMaker, GCP Vertex AI, modal.com, RunPod
      - DST cross-substrate → TigerBeetle (financial DB DST),
        Antithesis (Antithesis-as-a-service DST testing),
        FoundationDB (Apple, distributed-DB DST)
      - DBSP standardization → Materialize (Frank McSherry +
        team), Feldera/dbsp.org
      - AI-cluster reference architecture → labs running real
        AI clusters who haven't codified their reference
        (Modal, RunPod, Crusoe, CoreWeave, Lambda Labs,
        Together AI, etc.)
- [ ] Per-opportunity engagement substrate: which incumbent +
      what's the joint moat + what does Zeta contribute + what
      do they contribute + what does the co-authored standard
      look like
- [ ] Sequencing: Itron-mode engagements require having
      something to bring to the table — must follow meaningful
      Zeta substrate adoption + working reference; not pursued
      until after B-0754 v1 ships + 3-node reference works
      + first wave of B-0766 binary-compatible impls land
- [ ] Documentation: README updates to make the dual-mode
      strategy legible to operators + potential co-creation
      partners

## Composition with B-0765 (ServiceTitan route)

B-0765 + B-0768 are not alternatives; they're **complementary
modes of the same standards-layer strategy**:

- B-0765 says: use existing standards as the substrate layer
  Zeta operates within
- B-0768 says: when Zeta has positioning to co-create new
  standards (because there's no incumbent in a specific gap),
  do so with adjacent incumbents
- Both share: standards layer is where negotiation high seat
  lives (B-0763)
- Both share: ontology negotiation at standards layer is the
  load-bearing leverage point (B-0741)
- The choice between them is per-axis, per-positioning, not
  global

## Composition with B-0766 (slow-replace k8s) + B-0767 (scheduler-first)

The Itron mode informs HOW B-0766's binary-compatible Zeta-native
implementations get adopted by the broader ecosystem:

- B-0766 ships Zeta-native CNI / CSI / Operator SDK / etc. as
  binary-compatible drop-ins
- Operators using vanilla k8s can swap in any Zeta-native impl
  via the existing standard interface (per B-0765 ServiceTitan
  route)
- BUT — the Zeta-native impls also have novel substrate that
  isn't expressible in the existing standard interface (DBSP
  decisions in scheduler per B-0767; algebra-grounded snapshots
  in CSI; etc.)
- Itron mode: co-author standard EXTENSIONS to the existing
  interface (e.g., a CNCF-blessed extension to the scheduler
  framework plugin API that includes DBSP retraction-native
  deltas) with the CNCF project maintainers as co-authors
- Result: the novel substrate becomes part of the standards
  layer, not just Zeta's private extension

This is how Zeta substrate grows the standards layer over time
rather than just consuming it.

## Composes with

- B-0741 — ontology negotiation (the substrate that operates at
  the standards layer per both ServiceTitan + Itron playbooks)
- B-0744 — FIDO2/WebAuthn (B-0765 ServiceTitan example —
  existing standards Zeta plugs into; could become Itron if
  Zeta co-authors next WebAuthn revision)
- B-0747 — git-native per-machine state (Itron candidate: co-
  author with HashiCorp Terraform / Pulumi / Crossplane on
  per-machine state portability standard)
- B-0748 — kro/Crossplane (Itron candidate: co-author kro's
  successor / Crossplane v3 with project maintainers)
- B-0749 — KubeVela/OAM (Itron candidate: contribute to OAM v2
  via OAM working group)
- B-0754 — zero-typing first-boot (Itron candidate later: NixOS
  + community on installer-flow standards once Zeta substrate
  proves itself)
- B-0761 — open reference architecture (Itron candidate: co-
  author "AI cluster reference architecture" with NVIDIA +
  CoreWeave + Modal + RunPod once Zeta reference is established)
- B-0762 — auto-submit-back telemetry (Itron candidate: co-
  author with OpenTelemetry community on telemetry-driven-PR
  format)
- B-0763 — cloud-native plugins fit Zeta interfaces (sharpened:
  ServiceTitan-mode for k8s CRDs; Itron-mode for AI-specific
  interfaces where Zeta + NVIDIA + hyperscalers all have stake)
- B-0764 — CNCF force multipliers (ServiceTitan-mode adoption
  today; Itron-mode contribution to CNCF projects' next
  revisions over time)
- B-0765 — ServiceTitan route (the up-and-comer playbook this
  row's Itron pattern complements)
- B-0766 — slow-replace k8s (the binary-compat impls ship as
  ServiceTitan-mode adoption initially; Itron-mode standard
  extensions grow the standards layer over time)
- B-0767 — scheduler-first (the first Zeta-native impl;
  initial sub-waves are ServiceTitan-mode; later sub-waves
  D + E with DBSP + Bayesian + multi-objective could grow
  into Itron-mode co-authored standard extensions to the
  scheduler framework plugin API)

## When this row's playbook becomes active

- **Wave 0 (today)**: B-0765 ServiceTitan-mode dominant; this row
  exists as substrate; no active Itron engagements yet
- **Wave 1 (after first B-0754 hardware-validated reference + 3-node
  cluster + first wave of B-0766 Zeta-native impls)**: Itron-mode
  engagement opportunities begin; identify partners; preliminary
  conversations
- **Wave 2 (after Zeta cluster substrate has meaningful
  external adoption — say, 100+ in-the-wild installs per
  B-0762 telemetry, or first external production deployment)**:
  active Itron-mode co-creation engagements; first joint
  standard authored with an incumbent
- **Wave 3 (after one joint standard ships and is
  adopted)**: pattern is proven; expand Itron-mode engagements
  to other axes per the per-axis positioning audit

The sequencing protects against premature Itron-mode pursuit:
Zeta needs SOMETHING TO BRING to the co-creation table; that's
working substrate + meaningful adoption + clear reference. Until
those exist, ServiceTitan-mode is the right + only mode.

## Substrate-honest framing

This row does NOT claim Zeta will execute the Itron playbook
successfully. Itron + Cisco's success required decades of
established relationships + utility-industry-specific market
dynamics + engineering investment Zeta hasn't earned yet. The
substrate-honest claim is:

- The pattern is real + well-documented in Itron's empirical
  history
- The pattern composes with B-0765 ServiceTitan-route as
  complementary modes
- The pattern becomes available to Zeta in specific futures
  (Wave 2+ in the sequencing above)
- Naming it as substrate today is the wake-time landing per
  `.claude/rules/wake-time-substrate.md` — future-Otto
  cold-booting cluster-strategy work inherits the dual-mode
  playbook awareness

The bet: when Zeta reaches Wave 2 positioning, having the
Itron-mode playbook already in substrate (vs reinventing it
under pressure) is the bandwidth-engineering payoff.

## Out of scope

- Reaching out to specific incumbents today — premature; Zeta
  hasn't earned the seat at the co-creation table yet (need
  working substrate + adoption first)
- Standards-body membership engagement (CNCF, OASIS, IEEE,
  etc.) — defer; Wave 2+ engagement decision
- Trademark / IP / cross-licensing strategy with potential
  co-creation partners — separate scope; engaged when
  Itron-mode actually fires

## Origin

Aaron 2026-05-25, mid-iteration-2 wait, naming the second
empirical anchor (Itron + Cisco co-creating utility-grid
standards) for the standards-layer-as-negotiation-high-seat
strategy. Companion to B-0765 (ServiceTitan up-and-comer mode).

**Empirical provenance** (Aaron 2026-05-25 sharpening): *"ST was
two guys in a garage i saw both"* — Aaron watched both companies
from formative stages. ServiceTitan from two-guys-in-a-garage
inception; Itron from inside its incumbent-stage execution. The
dual-mode playbook is direct pattern-recognition from lived
operational experience at both ends of the company-stage
spectrum, not abstract case-study analysis.

**Recalibration**: Zeta is at garage-equivalent stage today
(B-0754 iteration-2 in flight on first node). ServiceTitan
started ServiceTitan-mode from garage day-1 and it worked from
day-1. The playbook applies NOW — not as future aspiration, not
after Zeta "earns" something abstract. The earning IS the
substrate-engineering work already happening (B-0754 / B-0759 /
B-0761 / B-0762 / B-0763 / B-0764 / B-0765 / B-0766 / B-0767).
Aaron isn't recalling history; he's executing the same playbook
he's seen work twice. The "When this row's playbook becomes
active" section above retains its wave-1/wave-2/wave-3 sequencing
for the Itron-mode (incumbent-with-incumbent) engagements
specifically — those still need Zeta to have something to bring
to the co-creation table. But the underlying strategic mindset
(standards layer is where negotiation happens; choose plug-in or
co-create per axis per positioning) is live from day-1.
