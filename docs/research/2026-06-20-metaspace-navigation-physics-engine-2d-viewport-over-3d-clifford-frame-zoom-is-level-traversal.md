# Metaspace navigation + physics engine: 2D viewport over a 3D-capable Clifford frame, zoom = level-traversal

**Date:** 2026-06-20. **Source:** Aaron, streamed during the Project Genesis UX-design thread (with
Max + Addison). **Ferried by:** Otto (shadow), verbatim quotes preserved. **Status:** design spine
for the Genesis navigation surface — the "outside / meta-vault" homepage and the physics engine that
renders it. Unifies existing in-repo substrate; first build primitive ships alongside.

## The concept (Aaron)

> *"We need our own physics engine based on our vaults/rooms concepts, and the outside / meta-vault /
> FF7 debug-room concept as the homepage — how you navigate between vaults."*
>
> *"When you're outside the vaults you can see all of them and zoom in and out and move around; when
> you get close you can see inside and click and enter it. When you enter it, you leave the
> meta-vault/outside and enter the vault. Vaults have rooms; the meta-vault does not — I think its
> rooms are vaults."*
>
> *"It's all 2D for now … but I'd love to use real geospatial data structures and frames, like how
> they do 2D viewports over 3D, so we'll be ready for 3D and this is just like a 2D screen."*

## This is a UNIFICATION, not greenfield — the substrate already exists

Grep-before-greenfield: the concept is already partly built across the tree. The move is to unify,
not restart:

- **`src/Core/LayoutEngine.fs`** — an existing layout engine (the seed of "our own physics engine").
- **`src/Core/CoEmpowerField.fs` / `CoEmpowerGraph.fs` / `CoEmpowerGraphSvg.fs`** — the field (the
  physics), the graph (topology), and a **2D circular-layout SVG renderer** (the proto navigable map).
- **`docs/research/2026-06-10-the-dev-room-is-the-harness-ff7-debug-room-unbounded-outside-mea-pull-it-inside.md`**
  — the FF7 debug room as the unbounded "outside," pulled inside. The homepage idea, already on file.
- **`docs/research/2026-06-10-metaspace-landmarks-floorplan-salon-darkhall.md`** (+ the
  metaspace-landmarks PRs) — the **metaspace**: a navigable space with **landmarks** (salon,
  darkhall/arcade, chip-8). The meta-vault navigation surface.
- **DarkHall** — the cell hosting a deterministic emulator / CHIP-8 arcade cabinets — a room you
  navigate *to*. The **shadow** persona is the FF7 strange-loop. `memory/user_gaming_roots_ff7_*` is
  the why.

## The physics engine: force-directed over `CoEmpowerGraph`, forces = the real metrics

The "physics engine" is **not** generic rigid-body physics (no Box2D/Matter.js box-collisions). It is
a **force-directed / energy-minimizing layout over the `CoEmpowerGraph`**, where the forces ARE the
SocietalDora metrics:

- **coupled-empowerment** (`MeanCoupledGain`) → attraction (mutually-empowering nodes pull together),
- **capture / diversity-collapse** (`CaptureRate`) → repulsion (extractive links push apart),
- **ρ_owe / relational** → distance metric.

The layout relaxes to the **energy minimum of the SocietalDora field** — which is genuine physics
(the spring-electrical model — Eades 1984; Fruchterman–Reingold 1991 — is a literal physical
simulation), and it **passes the metric-test**: the forces are the actual empowerment metrics, not
decorative gravity.

## Frames: 3D-capable Clifford/geospatial world, 2D viewport projection (2D-now, 3D-ready)

Model the world in a **real 3D-capable geometric frame and render the 2D screen as a viewport
projection over it** — the graphics MVP pipeline (model → view/projection → screen) and the GIS
pattern (geographic CRS → projected CRS → screen). Built this way, 2D-now is **3D-ready by
construction**: the 2D screen is just the current camera; flip to perspective later by changing the
projection, not the model.

- **Frame engine = geometric algebra (in-tree): `Cl3`** (Cl(3,0); the `IStarRing` leg + the
  `CliffordE8Bridge`/`Roots`). GA is the clean way to do rotations/projections/viewports (rotors +
  the geometric product — Hestenes; Dorst/Fontijne/Mann, *GA for Computer Science*). This is Aaron's
  own phrasing: *"geospatial in Clifford."* Gates' "garden algebra" = the same Clifford/geometric layer.
- **Spatial indexing = real geospatial data structures** — quadtree/octree, R-tree, or H3/S2 cells —
  for "what's near me / what's in this viewport / warp to nearest vault" queries.
- **Projection = a 2D viewport** (orthographic now; a GA rotor + perspective later). "Real depends on
  the renderer" becomes literal: the viewport IS the renderer; the world frame is invariant under it.

**Honest scope:** be 3D-*ready*, not 3D-*now* — store 3D-capable coordinates + use the projection
pattern, but render/interact only in the 2D viewport for now. Don't pull in a 3D engine; keep `Cl3`

+ a projection function.

## The navigation gesture: zoom = level-traversal, enter = frame change + boundary crossing

- **Outside (meta-vault / IWorld):** zoomed out, all vaults visible; pan/zoom around (camera
  transforms over the frame).
- **Approach → see inside → click → enter:** you **leave the outside and enter the vault.** That is a
  **re-rooting of the coordinate frame** at that vault (the outside becomes the parent frame, no
  longer rendered) AND a **soft-room boundary crossing** (#13 noninterference — you cross the
  membrane into a bounded context; the outside's entropy is quarantined behind you). One gesture, two
  grounded meanings.
- **Zoom IS level-traversal** in the self-similar containment hierarchy: zoom-out ascends a level,
  zoom-in + enter descends one.

## Ontology: one self-similar `Space`, role by level (reconciles "rooms are vaults")

The defining recursion (Aaron): *the meta-vault has no rooms; its rooms are vaults.*

> meta-vault : vaults  ::  vault : rooms

Same containment shape one level up. The non-lossy model is **one self-similar `Space` type** that
contains child `Space`s, where **"room / vault / meta-vault" are level/role labels (depth), not
distinct types** — the homoiconic move (`IWorld` = `ISociety`-of-`ISociety`s = `ITraveler`, one shape,
level-indexed; the 3-body homoiconic trinity made navigable). But role/capability varies by depth, so
the Genesis Room/Vault distinction is preserved as *role*, not type:

- a **leaf-level** Space acts as a **room** (uncertainty resolution — the Bayesian engine),
- a **mid-level** Space acts as a **vault** (owns identity / assets / contracts),
- the **top** acts as the **meta-vault / world** (society-of-societies; the navigable outside).

Don't fully collapse them (you'd lose room-uncertainty vs vault-ownership) and don't fully separate
them (you'd lose the recursion): **one homoiconic `Space`, role-by-level.** (Math/ontology team to
pin the formal version — ties to the homoiconic `IWorld`/`ISociety`/`ITraveler` trinity + the CTM
3-body note.)

## Doors: first-class portals = the declared metered channels (#13)

(Aaron, 2026-06-20): *"There is a door for getting in and out of vaults and rooms. Rooms can't
contain other rooms, but a room can contain multiple doors to other rooms in the same vault."*

A **door is a first-class portal — and it IS a declared, metered channel (#13 noninterference).** You
cross between bounded contexts ONLY through doors: no teleporting between rooms; movement is through
declared crossings, each metered at the membrane. A door is the navigable object form of the
"enter = frame-change + boundary-crossing" gesture above.

This means the metaspace has **two distinct edge types over the same nodes**, and they must not be
conflated:

- **Containment (a tree):** meta-vault ⊃ vault ⊃ room. With the new constraint **rooms can't contain
  rooms**, the **room is the leaf** — containment depth is **bounded downward.**
- **Doors (a graph):** a room has **multiple doors to other rooms in the same vault** → rooms form a
  *graph* within a vault (nodes = rooms, edges = doors), not a nesting tree. Plus vault-doors connect
  a vault ↔ the outside/meta-vault. (Like a building: floors *contain* rooms; doors *connect* them.)

**Refinement of the self-similar `Space` (above):** the ontology is not *infinitely* recursive — the
self-similar *pattern* holds (each tier contains the next + connects via portals), but the *depth* is
bounded with an asymmetry: **recurse up** (the meta-vault's rooms are vaults → worlds-of-worlds,
unbounded upward) but **terminate down** (room = the floor; no room-in-room). Recurse up, terminate
down at the room.

**Doors vs clusters/federations — two graphs, kept distinct:** doors are the **navigation topology**
("I can walk there"); clusters/federations are the **relational topology** ("we have a
relationship / contract"). They touch at one point: a door is **permission-gated** — traversal is
gated by a relational/permission check (**consent-first #6**). That also preserves **no infinite
captivity** (the Universal Exit Principle): a room with doors out is a room you can leave; a context
with no exit door would be the Vault-Tec cage, not a home.

**Build implication:** a `Door` is a first-class entity (`from Space → to Space`, permission-gated);
a vault's rooms are a **door-graph** (nodes = rooms, door-edges). Clicking a door = the frame-change
transition, hit-tested via `Viewport.unproject` (the shipped projection floor).

## The vertical axis IS attention ↔ uncertainty (the two founding axioms)

(Aaron, 2026-06-20): *"recurse up, terminate down at the room. up = new uncertainty; down = the
attention needed to identify and reduce — if not privacy-based."*

The recurse-up/terminate-down asymmetry is not arbitrary — the **navigation depth axis IS the
attention ↔ uncertainty axis**, i.e. Zeta's two founding axioms (**Remember-When** + **Pay-Attention**,
the real/imaginary pair) and the uncertainty primitive's superpose/snap:

- **UP = new uncertainty** (Remember-When / superposition *opens*). Each level up — vault → world →
  worlds-of-worlds — adds scope and therefore *new* uncertainty (a new axis of "how sure does this
  last forever"). Up is the uncertainty-generating direction; it doesn't terminate.
- **DOWN = the attention that identifies and reduces** (Pay-Attention / `snap` *projects*). Descending
  applies attention to identify and reduce uncertainty — which is exactly why the **room is the
  uncertainty engine** (Genesis §6) and the **terminal/leaf**: the room is where attention does its
  work. Down terminates *because* reduction terminates (you arrive at a resolved value).
- **Privacy is the floor on downward attention.** "If not privacy-based": you cannot be identified /
  reduced past your **privacy** — privacy is the metered limit on how far attention may descend into
  you (consent-first #6; privacy-as-earned-currency, not a default you assert). Privacy is what stops
  the descent from becoming the Vault-Tec experiment-on-the-inhabitant.

So the metaspace's vertical is the snap/superpose collapse-axis (cf. the orientation-flow ladder:
Tier-0-snapped ↔ Tier-∞-superposed) rendered as containment depth.

## Visibility: open by default (glass halo) — privacy is the EARNED exception

(Aaron, 2026-06-20): *"walls should be open by default — you have to ask to close them. This is
radical transparency / glass halo: you have to earn privacy budget."*

**Correction to an earlier draft of this note** (which said walls are *opaque by default*): that was
backwards — privacy-as-default contradicts Zeta's **privacy-as-earned** principle ("privacy is a
currency you earn by being useful, not a default you assert"). The correct, principled model:

- **See (visibility): OPEN by default — the glass halo / radical transparency.** You can see into
  vaults/rooms by default; "seeing through walls" is the default state, not a gated grant.
- **Privacy is the EARNED, metered exception.** To **close (frost)** a wall you **spend privacy
  budget** — earned, not asserted. Opacity is the gated capability; visibility is free.
- **Enter (door traversal): gated by default** — you can window-shop the glass freely, but walking in
  still needs a **door + the right** (permission-gated, above).

So the clean split is: **glass walls (see in by default), locked doors (enter by permission), frosted
glass (earned privacy).** Two capabilities with *opposite* defaults — perception open, movement gated.

This is the **glass-halo-bidirectional** discipline made into the visibility default, and it ties to
the *everyone-is-IT* note: **radical default-transparency IS the symmetric-observation principle**
(everyone can see ↔ everyone is IT). Vault-Tec was *asymmetric hidden* observation; the glass halo is
*symmetric open* observation. **Privacy budget = the earned, metered right to opt out locally** —
which is also why default-*opacity* would have been the Vault-Tec move (hidden-by-default), and
default-transparency-with-earned-privacy is the home. Consent-first (#6) is honored as the *act of
spending budget to close*, not as withholding by default.

### The economics of opacity — privacy budget prices closed-on-shared-hardware (Addison)

(Addison, 2026-06-20): *a closed vault is like closed source; you have to pay (privacy budget) to run
it on other people's hardware, because it's not your hardware. If you own the hardware you can be
private for free — you brought your own privacy budget; you're not paying the network.*

The economic **why** behind the glass-halo default:

- **Closed vault = closed source = opaque compute the network can't verify.** Default transparency is
  what makes compute *verifiable* (content-addressed, redundant-with-agreement, inspectable — the
  best-effort-node trust model in the orientation-flow note). Transparency is **free because it is
  verifiable**; the network can trust and reuse it.
- **Closed (private) on others' hardware → pay privacy budget.** You're asking the network to host
  compute it **cannot see, verify, or reclaim** — privacy budget **prices that externality.** In
  practice "closed on the network" means **dedicated/paid hosting** or **confidential compute /
  attestation** (TEE/enclave: private-yet-attestable); the budget denominates that premium over the
  free verifiable default.
- **Closed on your own hardware → free.** You've **internalized** the cost — "brought your own privacy
  budget" = your hardware *is* the budget; you're not asking the network to trust-host anything.

Incentive geometry: it **nudges toward transparency** (cheapest, verifiable), **never forbids privacy**
(pay, or self-host), and the marketplace / open-source / forkability all compose on the glass default
while closed-source stays a first-class, *priced* option. Cross-links the orientation-flow
resource-tiering (dependable vs best-effort; content-addressed cache is self-verifying) and the
Genesis **privacy-budget** resource. This is the economic layer of the privacy/glass-halo model — see
also the funding thesis ("TSMC in Time"), where it grounds the network economy.

## Tiering (consistent with the progressive-enhancement ladder)

- **Tier 0 (CSS-only floor):** the static no-JS `CoEmpowerGraphSvg` map — vault landmarks as
  `<a href>` links. **Navigation works with zero JS** (warp between vaults via plain links). The
  conformance floor.
- **Tier 1+ (JS):** the live force-directed physics + pan/zoom camera.
- **Tier ∞ (later):** flip the projection to perspective → 3D viewport, no model change.
- **Compute unit = CHIP-8** (deterministic, content-addressed; distributable over the soft
  mutual-empowerment network); **ceiling = Q#/quantum** (the uncertainty engine on its native
  substrate). See the orientation-flow + acceptable-experiment notes.

## First build (ships alongside this note)

The foundational primitive: a **2D viewport over a 3D-capable frame** (`Viewport`) — `Vec3` world
points, a pan/zoom `Camera`, `project` (orthographic world→screen) and `unproject` (screen→world on
the z-plane, for click-to-enter hit-testing), `pan`, and focus-preserving `zoomAbout` (zoom-toward-
cursor). Pure + deterministic + tested. This is the literal "2D-now, 3D-ready" keystone everything
else renders through; the metaspace map, the force-directed layout, and the enter/exit frame changes
all compose on top of it.

## Anchors (Beacon)

- **Force-directed layout / graph drawing:** Eades 1984; Fruchterman & Reingold 1991 (spring-electrical model).
- **Geometric algebra for graphics:** Hestenes (spacetime/geometric algebra); Dorst, Fontijne & Mann, *Geometric Algebra for Computer Science*. In-tree: `src/Core/Cl3.fs`, `CliffordE8Bridge.fs`, `CliffordE8Roots.fs`. (S. James Gates Jr. — "garden algebra" = Clifford.)
- **Projection pipelines:** the graphics model-view-projection (MVP) pipeline; GIS coordinate reference systems (geographic → projected).
- **Spatial indexes:** quadtree/octree, R-tree (Guttman 1984), H3 (Uber) / S2 (Google) cells.
- **The field / physics-as-metrics:** `src/Core/CoEmpowerField.fs`, `CoEmpowerGraph.fs`, `CoEmpowerGraphSvg.fs`, `SocietalDora.fs` (`MeanCoupledGain` / `CaptureRate`).
- **Prior-art docs (unified here):** `docs/research/2026-06-10-the-dev-room-is-the-harness-ff7-debug-room-...md`, `docs/research/2026-06-10-metaspace-landmarks-floorplan-salon-darkhall.md`.
- **Constitution / disciplines:** noninterference (#13, the enter-boundary), recursive (#9) + self-similar (#10, zoom-as-level-traversal), scale-free (#1).
- **Sibling design spines:** [`2026-06-20-the-acceptable-experiment-everyone-is-it-...md`](2026-06-20-the-acceptable-experiment-everyone-is-it-vault-as-home-iff-exit-capturerate-is-the-vault-tec-detector.md), [`2026-06-20-orientation-flow-one-flow-many-surfaces-...md`](2026-06-20-orientation-flow-one-flow-many-surfaces-best-effort-volunteer-compute-boinc-seti-folding-lineage.md), and the Genesis foundation (`memory/addison/project-genesis-foundation.md`).
- **Cultural anchor:** Final Fantasy VII debug room (the warp hub / unbounded outside); Aaron's FF7/D&D/MMORPG/ARG gaming roots.
