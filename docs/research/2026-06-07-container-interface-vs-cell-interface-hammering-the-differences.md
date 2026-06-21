# Container interface vs cell interface — hammering down the differences

**Aaron, 2026-06-07:**

> "we can have container interface too very similar to our cell interface — we need to hammer down the differences"

Both are "another interface" on the one grammar (`[seam] verb noun [dependson]`, #6992), and they
**share the push-out / accept-in shape** — which is exactly why they feel similar and why the boundary
needs to be drawn explicitly. Here is the cut.

## One-line cut

> **A container is a *box* (isolation + content-addressed packaging, OCI). A cell is an *agent* (a
> ZetaId-addressed, consenting, mobile, yin/yang unit of agency).** A cell can *run in* a container; a
> container can be *wrapped as* a cell. Container = the durable shell (what remains, frozen); cell adds
> the engine of change (what acts) on top.

So they are **layered, not rival**: container is the lower mechanical substrate; cell is the agency the
substrate carries. Sandbox (#6992) is the container used as a sim-box.

## The specificity gradient (Aaron's generalization)

> **"cell more zeta specific, container more oci specific … like git more git specific, db more zeta
> specific."**

The cut isn't only container-vs-cell — it's a **gradient every interface sits on**: how much a
noun-class *wraps an external standard* vs *is Zeta-native synthesis*.

```
  external-standard-specific  ◀───────────────────────────▶  zeta-specific
   container (OCI)                                              cell
   git      (git)                                              db
   research (DOI/arXiv)                                        sim / sandbox
```

- **External-standard end** = the interface is mostly a faithful wrapper of a published spec — its job
  is conformance (Beacon: anchored to OCI, to git's object model, to DOI). Low novelty debt; the anchor
  *is* the external standard.
- **Zeta-native end** = the interface is our own synthesis (cell, db) — agency, consent, yin/yang,
  DBSP/Z-set semantics that no single external spec gives us. Higher novelty; must *earn* its anchors.

This is the **Mirror/Beacon register split** applied to interfaces: container/git are Beacon-first
(compress straight to an external standard); cell/db are Mirror-native (our fast substrate) that *then*
reach for anchors. Same verb grammar across the whole gradient — only the **standard it conforms to**
moves. So `container`/`cell` is one instance of a general rule: **every noun-class declares where it
sits on the external-standard ⟷ zeta-native axis**, and that placement says how much is wrapping vs
invention.

## The differences (the hammer)

| Dimension | **Container** (box) | **Cell** (agent) |
|---|---|---|
| **Primary purpose** | Isolation + packaging | Agency + identity + meeting |
| **Identity** | Content hash of the image (BLAKE3/OCI digest) — *what it is made of* | **ZetaId living address** (Reticulum) — *who it is*; address ≠ persistent heartbeat identity |
| **Consent** | None native — host **allows** declared push-downs (a manifest) | **Eve protocol**: cells **push out** / hosts **accept in** — *negotiated*, zero-trust, non-coercive, revocable (manifesto §6) |
| **Push/accept verb meaning** | `push-down` = declared dep cascade (OS/compiler/kernel pkgs, outside container); host-allowed | `push-out` = *request*; `accept-in` = *grant* — a two-party consentful crossing |
| **Liveness** | Static image + ephemeral process; no inherent change-engine | **yin/yang** = the engine of change (what acts / what remains); ephemeral (quasi-time-crystal) or durable (Landauer-erase to change) |
| **Mobility** | Placed/scheduled by an external orchestrator | **Bounded Mobility** (§4) — self-relocates within safety bounds; traveler-frame |
| **State** | Stateless by default; state is external (volumes) | Closure over **internal (yin/yang) + external** state, routed by ZetaId |
| **Spec / anchor** | **OCI image-spec** (Ace implements it; universal content-addressed Dockerfile) | Zeta-native: Reticulum routing, Eve protocol, manifesto §4/§5/§6 |
| **Death** | Stop/remove the process; image persists | **Erasure without persistence = death** (yin/yang yolo); memory-preservation guarantee §5 |
| **DV2.0 role** | **Hub** — stable, content-addressed, slow-changing (the frozen shell) | **Satellite/link** — fast-changing live state + the relationships it negotiates |

## Where they meet (the shared interface — why it's "very similar")

Both speak **push / accept** as bus/git-like verbs (#6664/081KT2T2J0008QG0R002R72323) and both are *boxes you put things in*:

- **`run` over both** — `container run <image>` and `cell run <id>` (DarkHall #6986: `isAddressed cmd
  = verb="run" && noun=cell`) look identical at the grammar surface.
- **push-out/accept-in overlaps push-down/host-allow** — same verb *family*, different *semantics*:
  container push-down is **declared** (manifest, mechanical); cell push-out is **negotiated** (consent,
  Eve). The verbs overlap; the *authority model* is the whole difference.
- **Both content-address their deps** (`dependson`), so the dependency graph (#6984) is shared.

## The clean rule (so they don't collapse into each other)

1. **Container = mechanism, no authority.** It isolates and packages. It never negotiates; it is
   *allowed* or not. (A sandbox #6992 is a container used omnisciently.)
2. **Cell = authority + identity, carried by a mechanism.** It has a ZetaId, it consents, it moves, it
   changes (yin/yang). A cell is *who*; a container is *what*.
3. **Composition:** a cell **runs in** a container (gets isolation for free); a container **becomes** a
   cell when you give it a ZetaId + a consent surface + routing. Don't give a container consent verbs
   without giving it an identity first (consent needs a *who*). Source ≠ authorization
   (`.claude/rules/no-directives.md`): a container can carry an *input*; only a cell (with identity) can
   hold *authority*.

## Honest scope (peel)

Conceptual boundary-drawing, not new code. Names the `container` noun-class alongside `cell`, and fixes
the one trap: **don't let the shared push/accept verbs erase the authority-model difference** (declared
vs negotiated). The buildable next step is small and additive: a `container:` noun-class in `ZetaCli`
(verbs build/run/push/pull, OCI-digest identity) distinct from a `cell:` noun-class (verbs
push-out/accept-in/route, ZetaId identity), sharing `dependson`. No OCI runtime is built here.

## Anchors (Beacon)

- **OCI image-spec / runtime-spec**; Docker (Hykes 2013); content-addressed layers; capability-based
  security (least-authority) — the container side.
- **Reticulum** (addressing without persistent identity); **DCOM/CORBA** (object ≡ remote interface) —
  the cell-routing side, named by Aaron ("this is just DCOM").
- **Landauer's principle** (erasure cost) — the durable-cell thermal-erase-to-change model.
- Internal: #6992 (sandbox ⊂ sim; "another interface"), #6986 (DarkHall cell `run`), #6985 (cell
  metaphor), Eve protocol 081KT2T2J0008QG0R002R72323/081KRW63S0008QG0R001Z7NYMV, manifesto §4 Bounded Mobility / §5 Memory Preservation / §6
  Consent-First, `.claude/rules/no-directives.md` (source ≠ authorization).
