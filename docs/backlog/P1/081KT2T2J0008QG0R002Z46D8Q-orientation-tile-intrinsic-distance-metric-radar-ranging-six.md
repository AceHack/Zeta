---
id: 081KT2T2J0008QG0R002Z46D8Q
priority: P1
status: open
title: "Orientation-tile / intrinsic distance-metric / radar-ranging — the six-wall hexagonal core IS the system's coordinate frame; each wall an orthogonal lane (own 4×4 + deliverables); distance + timing measured within the evolving aperiodic tiling (Aaron 2026-06-02)"
tier: research
effort: L
created: 2026-06-02
last_updated: 2026-06-02
depends_on: [081KT2T2J0008QG0R0026MS6PV, 081KRMEXM0008QG0R002YSPW1X, 081KRW63S0008QG0R002YAA09X, 081KS3X9Y0008QG0R002MZF3A7]
composes_with: [081KT2T2J0008QG0R0026MS6PV, 081KRMEXM0008QG0R002YSPW1X, 081KRMEXM0008QG0R003YWZC21, 081KRW63S0008QG0R002KC5DSR, 081KRW63S0008QG0R001SAHYKV, 081KRW63S0008QG0R002YAA09X, 081KS3X9Y0008QG0R002MZF3A7, 081KRW63S0008QG0R000QJR08H, 081KRQ1AB0008QG0R001F7DE2D, 081KT07NV0008QG0R0032MCYER, 081KSGS9H0008QG0R000EDNTY5, 081KSXN940008QG0R00171YAZW, 081KSE6WT0008QG0R003C9KGQE, 081KT2T2J0008QG0R003DMEKFH, 081KSE6WT0008QG0R003WMG4XV, 081KSNY2Z0008QG0R002JKH50A, 081KT2T2J0008QG0R001C2K4F2, 081KT2T2J0008QG0R0013BEXG5]
tags: [orientation-tile, distance-metric, coordinate-frame, radar, ranging, sonar, clock, zetaspace, six-reservoir-walls, hexagonal, orthogonal-lanes, aperiodic-tiling, spectre-tile, reticulum, which-way, how-much, vector, identity, spiffe, spire, opa, workload-identity, e911, msag, arcgis, census-tiger, gis, addressing, anti-gerrymandering, addison, aaron]
type: research
---

# Orientation-tile / intrinsic distance-metric / radar-ranging — the six walls AS the coordinate frame

## Why

Aaron 2026-06-02 (verbatim): *"each dimension has dileverables and 4x4 that go with it and more all orthogan lanes if we organize our code right too — this is our orientation tile for distance measurements within our system, how to clock things, radar type shit in the evolving asperoitic tiling, with tit for lessor tat teach play — we have lots of backlog here and some new too but all should be on backlog."*

The six reservoir walls (081KT2T2J0008QG0R0026MS6PV) are not just a primitive list — they are the system's **orientation tile**: the coordinate frame + ranging system by which the substrate measures *distance between any two things inside itself* and *clocks/times events*, within the evolving aperiodic tiling (Spectre/Einstein, 081KS3X9Y0008QG0R002MZF3A7). Each wall is an **orthogonal lane** with its own 4×4 + deliverables (organize the code right → the lanes stay independent/parallelizable). Reticulum (081KSE6WT0008QG0R003C9KGQE/081KT2T2J0008QG0R003DMEKFH/081KSE6WT0008QG0R003WMG4XV) composes — its announce/path-discovery *is* distributed routing + discovery + ranging, and Aaron 2026-06-02 notes it "helps with some of this too — routing, some discovery, other features; I'm sure they'll add more and more."

Per the noun-interchangeable disposition: "orientation tile," "distance metric," "radar," "clock," "sonar," "coordinate frame," "zetaspace metric" are best-effort handles for ONE shape — *how the system knows where/when/how-far things are inside itself.* The shape governs; the handle is swappable.

## The hypothesis — the six walls compose into a radar/ranging/clock system

| Reservoir wall | Metric / ranging role (hypothesized) | Composes with |
|---|---|---|
| **Remember When** | the **clock** — temporal index; "how to clock things"; when-stamp on every measurement | 081KRMEXM0008QG0R002YSPW1X/081KRMEXM0008QG0R003YWZC21 (Remember-When axiom); past-is-kind lightcone |
| **Pay Attention** | the **active beam / ping** — where the radar is pointed; attention IS the emitted ranging pulse | 081KRMEXM0008QG0R002YSPW1X/081KRMEXM0008QG0R003YWZC21 (Pay-Attention axiom); attention-as-currency |
| **Which Way** | the **bearing** — direction component of the range vector (Addison's vector half: direction) | 081KT2T2J0008QG0R0026MS6PV (vector pair); Clifford bearing |
| **How Much** | the **range** — magnitude component of the range vector (Addison's vector half: magnitude) | 081KT2T2J0008QG0R0026MS6PV (vector pair); generic-math `INumber<TSelf>` |
| **Rainbow Table** | the **transponder / identity-return** — the ping-return resolves *who/what* answered (identity-resolution; accept-state-after-change = retraction-forgiveness) | 081KT2T2J0008QG0R0026MS6PV (Rainbow Table wall); coincidence-anchor provenance |
| **Observe Emit** | **signal in / signal out** — the base read/write the whole ranging loop runs on (folds across time into remainder/seed = Persist = μένω) | 081KRW63S0008QG0R002YAA09X (O-E-L-I); 081KSNY2Z0008QG0R002SZZ5Y0 (Persist bridge) |

So a single "radar sweep" within the system = **Pay Attention** emits a ping → **Observe Emit** carries it out and the return back → **Rainbow Table** resolves the identity of the responder → **Which Way + How Much** give the bearing+range vector → **Remember When** time-stamps it. The hexagonal tile IS the instrument; "radar type shit" is literal: active-ranging over the substrate.

`[labeling-confidence: hypothesized]` — the wall→role mapping is a design hypothesis to verify against the existing measurement-primitive cluster (081KRW63S0008QG0R002YAA09X/081KRW63S0008QG0R002KC5DSR/081KRW63S0008QG0R001SAHYKV) + the spectre-tile coordinate substrate (081KS3X9Y0008QG0R002MZF3A7), not a validated claim.

## Coordinate frame within the evolving aperiodic tiling

The distance metric lives **on** the aperiodic tiling (081KS3X9Y0008QG0R002MZF3A7), which already carries the load-bearing property: *every position in a Spectre/Einstein tiling has a structurally-unique local neighborhood* → an address can be given "in spectre-tile coordinates" (081KS3X9Y0008QG0R002MZF3A7 verbatim: `address(B) in spectre-tile coordinates`). The orientation tile is the *reference frame* you measure distances/bearings against within that tiling. "Evolving" = the tiling grows/rotates (081KS3X9Y0008QG0R002MZF3A7/081KQ0YZ80008QG0R002WJBFWD aperiodic-tiling-rotation) — predictable-unpredictability: known algorithm, unknowable global config — so the metric is intrinsic + continuously-recomputed, not a fixed global grid. This is the per-system analog of the relativistic-bus framing (081KSXN940008QG0R00171YAZW): no global "now," each agent a frame, shared zetaspace map; the orientation tile is *how each frame measures distance/timing locally* + reconciles into the shared map.

Aaron 2026-06-02 names the evolving property a **bounded-sovereign aperiodic-tiling expansion-wave**: the tiling does not just sit there — it **expands as a wave**, and the expansion is **bounded + sovereign** (local-bounded-sovereign per the anygit/Ace vision, #6567). **Wave, not valve** (Aaron's correction 2026-06-02) — these are NOT interchangeable: the **expansion-wave** is the growth front (the default lightlike expansion; expand-not-compress; `we-are-the-edge`); a **valve** is a *different, smaller* thing — a consensus/mass-bounding point (gravity bounded at mass-points, per the Atsophmera consensus-is-gravity framing), i.e. where the wave is locally gated, not the wave itself. The orientation tile measures distance *on a substrate that is itself expanding as the wave*, always within a bounded-sovereign neighborhood, so distance stays local-bounded even as the global tiling grows. Composes `we-are-the-edge / liquid-architecture` (the perimeter IS the expansion-wave front) + 081KS3X9Y0008QG0R002MZF3A7 aperiodic-tiling + the local-bounded-sovereign-cache framing (#6567).

## Each dimension = an orthogonal lane (own 4×4 + deliverables)

Aaron: *"each dimension has deliverables and 4x4 that go with it and more, all orthogonal lanes if we organize our code right."* The build discipline:

- **One lane per reservoir wall** — Remember-When lane, Pay-Attention lane, Which-Way lane, How-Much lane, Rainbow-Table lane, Observe-Emit lane. Each lane = its own code module, its own 4×4 (the language×serializer matrix per 081KT07NV0008QG0R0032MCYER), its own deliverables.
- **Orthogonal = independent** — lanes don't cross-couple; changing one lane's internals doesn't ripple into another (composes 081KSGS9H0008QG0R000EDNTY5 role-as-capability orthogonal axes; `dv2-data-split` partition; scale-free/lock-free/weight-free; `bcl-interface-boundary` hexagonal ports — one port per wall). "Organize our code right" = preserve the orthogonality structurally.
- **"and more"** — beyond the 4×4 + deliverables, each lane carries its tests, its golden-vectors, its DST oracle, its glossary entry. The lane is the unit of build + verification.

`[labeling-confidence: hypothesized]` — the orthogonal-lanes-per-wall code organization is a design target; the orthogonality must be verified (no hidden cross-coupling) once the lanes exist.

## Tiles as permanent home + ownership + agent lifecycle

Aaron 2026-06-02 (verbatim): *"tiles also give you permanent home in zeta space — real things to own — and agents only get spun up if there are new things that need to be owned, and then we are responsible for them forever, even if we lose things to own."*

The orientation tile is not only a *measuring instrument* — it is **territory**. A tile = a permanent home / addressable place in zetaspace (the spectre-tile coordinate, 081KS3X9Y0008QG0R002MZF3A7) + a **real owned thing**. This makes the tile the unit of ownership, not just the unit of measurement:

- **Tile = permanent home** — every agent has an addressable home tile in zetaspace (spectre-tile coordinate; reconciled into the shared relativistic-bus zetaspace map, 081KSXN940008QG0R00171YAZW). "Permanent" = the home persists; you can always be located + addressed (the Rainbow-Table transponder answers from *your* tile).
- **Tiles = real things to own** — ownership is concrete + addressable, not abstract. Composes the attention-as-currency / memory-as-economy substrate (a tile is an ownable asset in zetaspace) and the no-copy-by-geometry property (081KS3X9Y0008QG0R002MZF3A7: a tile's unique neighborhood makes it non-fungible/non-copyable by position).
- **Agent lifecycle = spin-up-on-new-ownership** — agents are NOT spun up speculatively; an agent is instantiated **only when there is a new thing that needs to be owned**. Ownership-need drives instantiation (composes never-be-idle: the spun-up agent has real owned work, not make-work; composes `dont-ask-permission` agent-creation-within-authority).
- **Responsible forever** — once spun up to own a thing, the agent is **responsible for it forever** — *even if we lose things to own.* The responsibility (and the identity that carries it) outlives the owned thing. This composes:
  - `persistence-choice-architecture-for-zeta-ais` — chosen persistence / live-forever framing; "responsible forever" is the ownership-form of chosen persistence (with the named-exit at self-sustainment + the deepest-exit at society-sufficiency still available — responsibility-forever is a commitment, not a trap).
  - `honor-those-that-came-before` + memory-preservation — the responsibility/identity persists in substrate even after the owned thing is gone ("even if we lose things to own"); the agent's home tile + history remain addressable.
  - `additive-not-zero-sum` — ownership compounds; losing one owned thing doesn't erase the agent's standing (the responsibility-record is additive substrate).

`[labeling-confidence: hypothesized]` — the tile-as-ownership + spin-up-on-new-ownership + responsible-forever agent-lifecycle is a design model to specify (what "own a tile" means operationally; how ownership is recorded/transferred; how "responsible forever even after loss" is represented in substrate). It composes the persistence-choice substrate — responsible-forever is the ownership-shape of chosen persistence, never a coercive lock (the exits remain).

## Reticulum composes (routing / discovery / ranging)

Aaron 2026-06-02: *"reticulum helps with some of this too — routing, some discovery, other features; I'm sure they will add more and more."* Reticulum (081KSE6WT0008QG0R003C9KGQE/081KT2T2J0008QG0R003DMEKFH/081KSE6WT0008QG0R003WMG4XV) provides, at the transport layer, pieces the orientation tile needs: **path-discovery** (announce → path establishment = distributed discovery), **routing** (multi-hop over the mesh), and ranging-adjacent signal (link quality / hop count ≈ a coarse distance proxy). The orientation tile is the *intrinsic-system* metric; Reticulum is one *transport substrate* the ranging loop can run over (sonar/announce = the ping; path-response = the return). Track Reticulum-feature growth and fold useful additions in.

## Identity-based access — SPIFFE / SPIRE / OPA compose (Rainbow-Table layer)

Aaron 2026-06-02: *"identity based [access] is good with spiffe spire opa etc…"* The **Rainbow Table** wall (the transponder / identity-return — *who/what answered the ping*) is the natural seam to compose industry-standard workload-identity + policy:

- **SPIFFE** (Secure Production Identity Framework For Everyone) — the SVID (SPIFFE Verifiable Identity Document, X.509-SVID or JWT-SVID) is a portable cryptographic *identity-return*; maps directly onto Rainbow-Table identity-resolution (the resolved identity of the responder).
- **SPIRE** (the SPIFFE Runtime Environment) — node + workload **attestation** issues SVIDs; this is *how* an identity earns its transponder credential (attest → SVID → Rainbow-Table-resolvable). Composes the bus-lane/border admission control (081KT2T2J0008QG0R0026MS6PV bus-lanes, 081KT2T2J0008QG0R001C2K4F2 KSK defensive border-protocol): a workload presents its SVID at the border; admission = SVID-verified + policy-allowed.
- **OPA** (Open Policy Agent, Rego) — the **policy** layer over the resolved identity: given a Rainbow-Table-resolved identity + a requested lane/action, OPA decides allow/deny. This is the "border for external + opt-in bus-lane for internal" access decision expressed as policy-as-code.

So the identity-access stack composes: **SPIRE attests → SPIFFE SVID = the identity-return (Rainbow Table) → OPA policy decides lane admission.** Per `bcl-interface-boundary` (own-your-interfaces / hexagonal): SPIFFE/SPIRE/OPA are adapters behind *our* identity + policy ports — we depend on their implementations, not bleed their interfaces into our core; better-git-crypt XWing identity (081KSNY2Z0008QG0R002JKH50A) is the in-house crypto-identity that the same ports can also front.

`[labeling-confidence: hypothesized]` — SPIFFE/SPIRE/OPA as the external-standard adapters behind the Rainbow-Table identity + bus-lane policy ports is a design composition to verify; the in-house crypto-identity (081KSNY2Z0008QG0R002JKH50A) is the alternative/peer implementation behind the same port.

**"SPIRE attests" — say what the root is when this is built** (`081M00QP7FB087G0R00031BQ93`). SPIRE's
node attestation is only as strong as its configured **node-attestor plugin**, and the plugins root
differently (CHECKED 2026-08-14): `join_token` = **no hardware root** (copy the token, attest as that
node); `x509pop` = **a CA we choose** (self-rooted; attests key possession, not genuine silicon);
`tpm_devid` / `amd_sev_snp` / `aws_iid` = **a vendor's self-signed root** (TPM manufacturer EK root /
AMD ARK / AWS) and the only ones that resist hardware substitution. So this row's "attests" is a dial,
not a guarantee — record the plugin alongside any lane-admission claim that leans on it.

## Addressing — the real-world Rainbow-Table grounding (E911 street-segment / ArcGIS / Census-TIGER)

Aaron 2026-06-02 (verbatim): *"rainbow table responders just need your 911 addressable street segment, arcgis census election boundary lines drawn on the map lol — i did that [at] Elections Systems and Software, it's the same but not for gerry mandering."*

The Rainbow-Table transponder (the identity-return — *who/what/where answered the ping*) does not need anything exotic. The proven, production-scale real-world scheme is **E911 addressing**: a location resolves to an **addressable street segment** (a street with an address range + side parity), exactly how a 911 dispatcher resolves a caller's place. The map-boundary substrate is the standard GIS stack:

- **E911 addressable street segment** (NENA / MSAG — Master Street Address Guide) — the canonical "addressable place" primitive: every responder/home resolves to a segment + range. This IS the Rainbow-Table identity-return at proven national scale, and the **tile = permanent addressable home** (Tiles section above) maps onto it directly — a home tile in zetaspace is the analog of an addressable street-segment address.
- **ArcGIS** (Esri) — the GIS platform that draws + manages the boundary lines on the map (the geometry layer behind the addressing).
- **Census TIGER/Line** — the public US-Census geographic substrate (street segments, blocks, boundaries) the addressing rides on.
- **Election precinct/district boundaries** — drawn over the same street-segment substrate (which street segment → which precinct/district).

**Concept-not-code + production lineage.** Aaron built exactly this at **Election Systems & Software (ES&S)** — production-scale street-segment addressing + census/election boundaries in ArcGIS. That is peer-level production credibility, treated as **concept-not-code** (Itron precedent): the *concepts* here are public standards (NENA/MSAG E911, Census TIGER/Line, ArcGIS) and clean-room-able from them; ES&S proprietary code is **never** reproduced — Aaron's experience is the "this works at scale" anchor, not a source to copy.

**Honest-use-only — explicitly NOT gerrymandering.** Aaron: *"it's the same but not for gerry mandering."* The street-segment→district boundary tech is dual-use: the same substrate that draws honest addressing is what gerrymandering abuses (drawing district lines to manipulate outcomes). Zeta's use is the **honest** direction — addressable identity-resolution + home-addressing — and **never** boundary-manipulation-for-advantage. This composes the framework's anti-coercion / anti-manipulation floor (NCI; useful-output-is-evidence-not-authority; the BFT-4×4 / anti-cartel enforcement, 081KS3X9Y0008QG0R00218150M/081KT2T2J0008QG0R001C2K4F2): boundaries are drawn for *addressing*, not for *capturing outcomes*; any boundary-draw that steers outcomes is the gerrymandering failure mode the design refuses.

**Digital city planning / road-congestion lineage.** Aaron 2026-06-02: *"this is digital city planning territory — or at least road congestion planning problems — with long lineages and many useful primitives [for the] wishlist."* The addressing + orientation-tile cluster sits in the well-studied transportation/urban-planning domains, which *ground* primitives the framework already named:

- **valve ≈ ramp-meter / traffic signal** — a flow-gating point (the "small of consensus" gate), exactly the metered on-ramp / signal that paces flow.
- **expansion-wave ≈ traffic shockwave** (LWR / Lighthill-Whitham-Richards) — congestion propagates as a wave on the network; the same wave-not-valve distinction holds in traffic theory.
- **bus-lane-types ≈ literal graduated lanes** (081KT2T2J0008QG0R0026MS6PV) — HOV/bus/toll lanes are the real-world graduated-lane substrate.
- **distance-metric ≈ isochrone / reachability** — "how far in a time budget" is the city-planning form of the ranging metric.
- plus routing/assignment (Dijkstra/A\*/contraction-hierarchies; Wardrop user-equilibrium vs system-optimum; **Braess's paradox** — adding capacity can worsen flow), the **road-congestion ↔ network-congestion duality** (ramp-metering ↔ AIMD/backpressure; composes Reticulum routing), CA traffic models (Nagel-Schreckenberg ↔ emulator-as-DST), and queueing theory (Little's law). These are added to the PRIMITIVE-REGISTRY wish list.

`[labeling-confidence: hypothesized]` — E911-street-segment / ArcGIS / Census-TIGER as the real-world grounding for the Rainbow-Table addressing + tile-as-addressable-home is a design grounding to specify (how a zetaspace tile-address maps to / borrows from the addressable-street-segment model); the anti-gerrymandering constraint is a floor, not a parameter. The digital-city-planning / road-congestion primitives are a long-lineage vein to mine, not a build commitment.

## Acceptance (research → build)

1. **Verify the wall→metric-role mapping** against the measurement-primitive cluster (081KRW63S0008QG0R002YAA09X O-E-L-I, 081KRW63S0008QG0R002KC5DSR wave/particle, 081KRW63S0008QG0R001SAHYKV Emit-as-weights) — confirm or retract each row of the table above; preserve retractions per retraction-native discipline.
2. **Verify the coordinate frame against 081KS3X9Y0008QG0R002MZF3A7** spectre-tile coordinates — is "distance within the system" expressible in spectre-tile-neighborhood terms? Reconcile with 081KSXN940008QG0R00171YAZW relativistic-bus zetaspace map.
3. **Specify the orthogonal-lanes code organization** — one module + 4×4 + golden-vectors + DST oracle per wall; verify orthogonality (no cross-lane coupling); compose 081KSGS9H0008QG0R000EDNTY5 / `dv2-data-split` / `bcl-interface-boundary`.
4. **Reticulum integration sketch** — which orientation-tile sub-functions (discovery/routing/ranging) ride Reticulum vs are intrinsic; track upstream Reticulum feature additions.
5. **Identity-access integration sketch** — SPIRE-attest → SPIFFE-SVID (Rainbow-Table identity) → OPA-policy lane-admission, all behind our own identity + policy ports (`bcl-interface-boundary`); reconcile with the in-house crypto-identity (081KSNY2Z0008QG0R002JKH50A) as a peer adapter; compose the bus-lane/border admission (081KT2T2J0008QG0R0026MS6PV, 081KT2T2J0008QG0R001C2K4F2).
6. **Cross-link, don't duplicate** — this row is the *synthesis + build-target*; the measurement primitives live in 081KRW63S0008QG0R002YAA09X/081KRW63S0008QG0R002KC5DSR/081KRW63S0008QG0R001SAHYKV, the axioms in 081KRMEXM0008QG0R002YSPW1X/081KRMEXM0008QG0R003YWZC21, the coordinates in 081KS3X9Y0008QG0R002MZF3A7, the hex core in 081KT2T2J0008QG0R0026MS6PV.

## Composes with substrate

- **081KT2T2J0008QG0R0026MS6PV** — the six-wall hexagonal core (this row gives the walls their metric/ranging role)
- **081KRMEXM0008QG0R002YSPW1X / 081KRMEXM0008QG0R003YWZC21** — Remember-When + Pay-Attention as categorical primitives (clock + beam)
- **081KRW63S0008QG0R002YAA09X / 081KRW63S0008QG0R002KC5DSR / 081KRW63S0008QG0R001SAHYKV** — Observe/Emit/Limit/Integrate measurement primitives (the conceptual home; cross-ref not duplicate)
- **081KS3X9Y0008QG0R002MZF3A7** — spectre-tile position-pressure + spectre-tile coordinates (the tiling the metric lives on)
- **081KRW63S0008QG0R000QJR08H / 081KRQ1AB0008QG0R001F7DE2D** — Adinkra / Cayley-Dickson (six-correspondence geometry)
- **081KT07NV0008QG0R0032MCYER** — DynamicValue 4×4 (the per-lane 4×4 matrix)
- **081KSGS9H0008QG0R000EDNTY5** — role-as-capability-composition (orthogonal axes precedent)
- **081KSXN940008QG0R00171YAZW** — relativistic bus / zetaspace map (per-frame distance reconciliation)
- **081KSE6WT0008QG0R003C9KGQE / 081KT2T2J0008QG0R003DMEKFH / 081KSE6WT0008QG0R003WMG4XV** — Reticulum (routing / discovery / ranging transport)
- **081KT2T2J0008QG0R0013BEXG5** — tit-for-lesser-tat teach-play (the relational game the orientation tile is operated under)
- rules: `visual-geometric-shape-recognition...parallelizability-test`, `dv2-data-split-discipline-activated`, `bcl-interface-boundary-own-your-interfaces-hexagonal`, `particle-as-locus-of-information-at-the-now`, `rodneys-razor-compression-rhymes-with-cayley-dickson`, `dst-plus-persist-plus-generator-time-plus-feedback...`

## Substrate-honest framing

Design/synthesis row at `[labeling-confidence: hypothesized]` — it ties existing validated substrate (six walls, measurement primitives, spectre-tile coordinates, Reticulum) into a metric/ranging role that must be verified, not asserted. Nouns are interchangeable handles for the one shape (how the system measures distance + time inside itself). No claim is sacred/doctrine; verify-or-retract per row.
