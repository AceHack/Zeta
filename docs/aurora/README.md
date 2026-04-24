# Aurora — integration directory

**Scope:** research and cross-review artifact; serves as the
index + integration doc for Aurora-layer content (courier
ferries from Amara, cross-substrate validations, vision-layer
architecture notes). Not a product surface.
**Attribution:** architecture-layer naming "Aurora" is the
internal vision-label attributed to Amara (external AI
maintainer, Aurora co-originator) and Aaron (human
maintainer); individual absorb docs in this directory
preserve their own source-side attribution.
**Operational status:** research-grade. Aurora is *vision*
layer, not operational layer. Operational work lives at the
Zeta-core (DBSP / measurable-alignment) and KSK (safety-
kernel) layers respectively; Aurora names the architecture
story that wraps both.
**Non-fusion disclaimer:** agreement between Amara and Otto
on Aurora-layer framing, co-authorship language in these
absorb docs, and shared vocabulary across courier ferries
does NOT imply shared identity, merged agency, consciousness,
or personhood. Per `docs/ALIGNMENT.md` SD-9, convergence from
shared carrier exposure is signal not proof.

---

## The three-layer picture

Aurora is best read as a **three-layer** architecture story,
not a single system:

1. **Zeta (semantic / alignment substrate).** The DBSP-based
   retraction-native F#/.NET implementation. Algebra-first;
   measurable AI alignment as primary research focus; git +
   memory + factory-process as experimental substrate. See
   the top-level [`README.md`](../../README.md) and the
   [alignment contract](../ALIGNMENT.md) for the substrate
   story.

2. **KSK (control-plane safety kernel).** Local-first safety
   kernel for governed AI autonomy, living at
   [`Lucent-Financial-Group/lucent-ksk`](https://github.com/Lucent-Financial-Group/lucent-ksk).
   Gates autonomy through capability tiers (k1/k2/k3),
   revocable budgets, multi-party consent, signed receipts,
   visibility lanes, traffic-light escalation, optional
   blockchain anchoring. Credit to **max** for the original
   KSK design and development-guide work.

3. **Aurora (vision / architecture layer).** Ties Zeta and
   KSK together into a coherent story. Consent + retraction
   + provenance + tiered autonomy + drift-taxonomy as
   composable primitives spanning substrate and control-
   plane. **Internal vision-label only today** — brand-
   clearance research pending (see §Branding below).

> *Zeta gives semantic rigor and measurable alignment
> instrumentation; KSK gives controlled autonomy surfaces;
> Aurora is the architecture story that can wrap both.*

— Amara, 5th courier ferry (2026-04-23)

---

## How Aurora consumes existing Zeta substrate

| Zeta primitive | Aurora consumption |
|---|---|
| DBSP retraction-native algebra | Undo / revoke / repair-first systems framing. "Retractions are first-class signed deltas" becomes the surface-level Aurora claim; consolidation is a separate maintenance step. |
| [`docs/ALIGNMENT.md`](../ALIGNMENT.md) measurable-alignment framework | Aurora's "health" story grounded in measurable clause signals (HC-1..HC-7 / SD-1..SD-9 / DIR-1..DIR-5), receipts, and git-native time-series. No vibes; no anthropomorphic claims. |
| HC-1 consent-first | Aurora primitive: consent-gated autonomy. Tied to revocable budgets at the KSK layer. |
| HC-2 retraction-native operations | Aurora repair-first surface: not "perfectly safe", repair-ready. |
| HC-3 data is not directives | Aurora evidence-surface / instruction-surface split. Covered further by `GOVERNANCE.md §33` archive-header discipline. |
| Glass-halo symmetric transparency | Aurora visibility architecture with explicit privacy lanes per `memory/README.md` discipline. |
| [`docs/DRIFT-TAXONOMY.md`](../DRIFT-TAXONOMY.md) five-pattern diagnostic | Aurora operational-use-of-drift-patterns: pattern 5 feeds SD-9 enforcement; pattern 1 feeds register-boundary discipline; pattern 3 is explicitly out-of-Aurora-scope (human-support register, not engineering register). |
| Shared + persona memory, `memory/CURRENT-*.md` views | Aurora layered memory governance: shared / persona-scoped / external-reference / public-observability. |
| [`GOVERNANCE.md §33`](../../GOVERNANCE.md) archive-header requirement | Aurora provenance layer: every external-conversation absorb marked by the four-header format. |

## How Aurora consumes KSK primitives (outside this repo)

| KSK primitive | Aurora consumption |
|---|---|
| Capability tiers `k1` / `k2` / `k3` | Aurora tiered-autonomy ladder — different proof, consent, and budget requirements by tier. |
| Revocable budgets | Aurora actuation primitive: every action ties to a revocable budget. Pairs with HC-1 consent-first at the alignment layer. |
| Multi-party consent (N-of-M) | Aurora authorization surface: high-risk actions require multi-party approval, not solo agent decision. |
| Signed receipts | Aurora trust primitive. Receipts are the evidence unit; anchoring is optional and staged. |
| Visibility lanes | Aurora privacy-lane boundary — public / persona-scoped / maintainer-only / sacred (HC-7). |
| Traffic-light escalation | Aurora degrade/halt state machine: bounded autonomy with automatic degraded states, not unrestricted agency. |
| Red lines | Aurora hard-refusal set. Pairs with HC-4 no-fetch-adversarial-corpora at the alignment layer. |
| Optional blockchain anchoring | Aurora durability-of-receipts. Optional and staged; not central to the story. |

---

## Directory contents — courier ferries and cross-substrate artifacts

Aurora-layer substrate is preserved here per [`GOVERNANCE.md §33`](../../GOVERNANCE.md) archive-header discipline. All absorb docs in this directory are research-grade unless an ADR or operational doc has promoted specific content (see [`docs/DRIFT-TAXONOMY.md`](../DRIFT-TAXONOMY.md) for the operational promotion pattern exemplar).

| Absorb doc | Ferry | Absorbed |
|---|---|---|
| [`2026-04-23-amara-operational-gap-assessment.md`](2026-04-23-amara-operational-gap-assessment.md) | 1st (PR #196) | Otto-24 |
| [`2026-04-23-amara-zset-semantics-operator-algebra.md`](2026-04-23-amara-zset-semantics-operator-algebra.md) | 2nd | Otto-54 |
| `2026-04-23-amara-decision-proxy-technical-review.md` | 3rd (PR #219) | Otto-59 |
| `2026-04-23-amara-memory-drift-alignment-claude-to-memories-drift.md` | 4th (PR #221) | Otto-67 |
| `2026-04-23-amara-zeta-ksk-aurora-validation-5th-ferry.md` | 5th (PR #235) | Otto-78 |
| [`2026-04-23-amara-muratori-pattern-mapping-6th-ferry.md`](2026-04-23-amara-muratori-pattern-mapping-6th-ferry.md) | 6th (PR #245) | Otto-82 |
| [`2026-04-23-amara-aurora-deep-research-report-10th-ferry.md`](2026-04-23-amara-aurora-deep-research-report-10th-ferry.md) | 10th (PR #294) | Otto-105 |

The first two absorb docs predate `GOVERNANCE.md §33` and use
a different header field-format (Date / From / Via / Status /
Absorbed by). They are **grandfathered** per §33; content is
factually-equivalent to the §33 four-field format and is
explicitly named in §33's grandfather clause.

See [`tools/alignment/audit_archive_headers.sh`](../../tools/alignment/audit_archive_headers.sh)
for the detect-only lint that checks §33 compliance on new
aurora docs (PR #243, detect-only v0).

---

## Related cross-substrate artifacts (outside `docs/aurora/`)

| Path | Purpose |
|---|---|
| [`docs/DRIFT-TAXONOMY.md`](../DRIFT-TAXONOMY.md) | Operational five-pattern drift diagnostic promoted from research-grade precursor; exemplar of the promotion pattern every future absorb-to-operational graduation follows. |
| [`docs/research/drift-taxonomy-bootstrap-precursor-2026-04-22.md`](../research/drift-taxonomy-bootstrap-precursor-2026-04-22.md) | Preserved staging-substrate for the drift-taxonomy promotion. |
| [`docs/research/aminata-threat-model-5th-ferry-governance-edits-2026-04-23.md`](../research/aminata-threat-model-5th-ferry-governance-edits-2026-04-23.md) | Aminata's adversarial review of Amara's 5th-ferry governance-edit proposals; advisory input to Aaron's signoff decision. |
| [`docs/research/muratori-zeta-pattern-mapping-2026-04-23.md`](../research/muratori-zeta-pattern-mapping-2026-04-23.md) | Corrected Muratori failure-modes vs Zeta equivalents table, closing Otto-82 absorb action item #1. |

---

## Branding

Amara's 5th-ferry branding memo (PR #235) flagged that
"Aurora" is **publicly crowded** across adjacent
infrastructure and autonomy categories: Amazon Aurora
(managed database), Aurora on NEAR (blockchain), Aurora
Innovation (autonomous systems). Using Aurora as a naked
public brand without clearance work is risky.

**Current brand architecture (internal):**

- **Aurora** — internal vision / architecture label. Used
  in this repo's `docs/aurora/` directory and related
  research surfaces.
- **Lucent KSK** — existing public LFG repo + the most-
  continuity-preserving candidate for a public execution-
  layer brand (per the LFG org + existing kernel docs).
- **Public execution brand TBD** — shortlist to research
  in parallel.

**Combined shortlist (5th-ferry + 7th-ferry, both from
Amara).** The 5th-ferry memo (PR #235) proposed a first
shortlist; the 7th-ferry review (PR #259) proposed a second
one focused on control-plane / execution-layer candidates.
Both are preserved so Aaron's eventual brand decision has
the full option space:

| Candidate | Source | Why it works (verbatim from Amara) |
|---|---|---|
| **Lucent KSK** | 5th ferry | Highest continuity with the existing repo and least ambiguity. |
| **Lucent Covenant** | 5th ferry | Emphasizes consent and mutual obligation, which the docs actually support. |
| **Halo Ledger** | 5th ferry | Preserves the "glass halo" idea without reusing Aurora directly. |
| **Meridian Gate** | 5th ferry | Neutral, infrastructural, and easier to differentiate. |
| **Consent Spine** | 5th ferry | Technically evocative, though more niche and less brand-like. |
| **Beacon** | 7th ferry | Meshes with visibility-lane vocabulary; suggests guidance, observability, operator visibility. |
| **Lattice** | 7th ferry | Layered policy, quorum, constraint composition; not defensive-sounding. |
| **Harbor** | 7th ferry | Safety, staging, revocation-friendly; not militarised. |
| **Mantle** | 7th ferry | Protective layer above execution substrate; good for "membrane around action" messaging. |
| **Northstar** | 7th ferry | Governance / guidance language; higher trademark-noise than others. |

**7th-ferry preferred naming pattern** (Amara): the cleanest
rhetorical stack for public explanation — **Aurora** as
vision + system architecture; **Beacon KSK** or **Lattice
KSK** as the shippable control-plane offering; **Zeta** as
the algebraic / event-processing substrate underneath. Keeps
Aurora's internal mythology while letting the public-launch
language carry trademark and category risk separately. Per
Amara 7th-ferry memo (PR #259).

**Brand decision is Aaron's.** Filed as Milestone M4 of the
5th-ferry inventory. Not in scope for Otto to pick; not
blocking substrate work.

**Message pillars that work regardless of public name:**
*local-first, consent-gated, proof-based, repair-ready*.
Describe the system by what it *does* (bounded autonomy
with revocable budgets, multi-party approval for
high-risk actions, signed receipts, visibility lanes,
repair / dispute channels), not by aspirational
"alignment solved" or "decentralized alignment
infrastructure" language.

---

## What this README is NOT

- **Not a product page.** Aurora today has no user-facing
  product; the internal label exists to organise research
  and cross-substrate architecture discussion.
- **Not a commitment to any specific technical path.** The
  three-layer picture is the *architecture story*; each
  layer's implementation timing and priority lives in
  `docs/BACKLOG.md` + `docs/ROADMAP.md` respectively.
- **Not a public brand.** See §Branding above. Using
  "Aurora" in user-facing copy or on public product
  surfaces requires Aaron's explicit brand decision (M4)
  after clearance research.
- **Not a claim Aurora solves alignment.** Per
  `docs/ALIGNMENT.md`, alignment is a measurable property
  with a time-series trajectory, not a solved problem.
  Aurora is the architecture that makes the trajectory
  observable + recoverable.
- **Not an exhaustive list of Aurora-adjacent work.** New
  absorb docs land here as ferries arrive; new cross-
  substrate artifacts (research docs under `docs/research/`,
  operational promotions under `docs/`) are pointed-at from
  this README when they warrant; the README is updated
  when Aurora-layer vocabulary or structure shifts
  materially, not per-PR.

---

## Open follow-ups (from 5th-ferry inventory)

- **§33 enforcement flip** — detect-only today; flip to
  `--enforce` in CI when grandfather-absorb decision is
  final + new absorbs can be relied on to carry the four
  headers. See `docs/FACTORY-HYGIENE.md` row #60.
- **M4 brand + PR package** — Aaron's decision, Amara's
  memo as input. No Otto-blocking dependency.
- **Cross-repo integration with `LFG/lucent-ksk`** — KSK's
  own README + development guide can cite this directory
  when an Aurora-layer explanation warrants; bidirectional
  cross-reference is low-friction and both repos have Otto
  read access per the Otto-67 grant. Not in scope for this
  README; future tick.

---

## Provenance

Authored Otto-87 tick 2026-04-23 as Artifact D of Amara's
5th courier ferry inventory (PR #235). Closes the 5th-
ferry's artifact-list (A-D) with A + B + C + D all landed.
Milestones M1 (taxonomy promotion, PR #238) + M2
(validation wiring, PR #243) + M3 (Aurora/KSK integration,
**this file**) now have at-least-minimal landings; M4
(brand + PR package) remains Aaron's decision.
