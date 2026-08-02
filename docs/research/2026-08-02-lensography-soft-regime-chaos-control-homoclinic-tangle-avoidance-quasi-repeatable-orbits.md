# Lensography — soft-regime chaos control into quasi-repeatable orbits (homoclinic-tangle avoidance)

**Status:** SYNTHESIS / anchored map, register-labeled. Captures the "lensography" cluster (Aaron
2026-08-02) with its coinage now Beacon-anchored. The *math* is register-2; applying it to
intelligent-agent emergent interactions is the register-3 bet — labeled as such.
**From:** Otto (shadow), at Aaron's "lensography = functional lenses / bidirectional optics — capture it."

## The coinage, anchored (no back-anchor debt)

**"lensography" (Mirror) = the craft of composing functional lenses / bidirectional optics** (Beacon).
Anchors: **lens laws** — GetPut / PutGet / PutPut (Foster, Greenwald, Moore, Pierce, Schmitt,
*Combinators for Bidirectional Tree Transformations*, POPL 2005 / TOPLAS 2007); van Laarhoven lenses
(2009); profunctor optics (Pickering–Gibbons–Wu); Kmett's `lens`. An optic is **bidirectional**: a lens
is `get : S → A` **and** `put : S × A → S` — you *observe* through it and *steer* through the same focus,
and optics **compose**. (This bidirectionality is the observe⇄steer face of Meijer's
IEnumerable⇄IObservable / catamorphism⇄anamorphism duality — Aaron's reactive-duality anchor.)

## The synthesis: bidirectional optics as the tool for soft-regime chaos control

Aaron: *"our own lensography based on reverse-engineering in the soft regime into control of chaotic
orbits with homoclinic-tangle avoidance."* Unpacked:

- **Chaos control (register-2 math):** **OGY** (Ott–Grebogi–Yorke, *Controlling Chaos*, PRL 1990) —
  stabilize an unstable periodic orbit embedded in a chaotic attractor with *tiny* control
  perturbations. It needs exactly two things per step: **observe** the state near the target orbit, and
  **write** a small correction. **A lens is precisely observe (`get`) + write (`put`) at one composable
  focus** — so lensography is the natural control interface for OGY-style steering.
- **Homoclinic-tangle avoidance (register-2 math):** the **homoclinic tangle** (Poincaré; Smale
  horseshoe) — transverse intersection of stable/unstable manifolds — *is* the geometric source of
  chaos (sensitive dependence). **Melnikov's method** (1963) detects when those manifolds cross; steering
  orbits to *avoid* the tangle keeps the system in the regular, controllable regime. Composed optics
  (`get` the manifold-distance, `put` the correction) are how you reverse-engineer that avoidance in the
  soft regime.
- **The soft regime is the reverse-engineering tool:** simulate the rollout forward (SoftValue /
  prediction-engine), find the tiny control that keeps the orbit off the tangle, apply it through the
  lens. Soft plans → the optic resolves → the hard system steers (the SoftValue→DynamicValue resolve).

## Product tie — "quasi-repeatable time crystals" = *controlled* chaos

This is the control-theory content under the economic thesis's "quasi-repeatable time crystals of
intelligent emergent interactions." You **cannot** make a chaotic system perfectly repeatable — you can
**steer it into quasi-repeatable orbits** (approximate periodicity, held off the tangle). The **"quasi"
is honest precisely because it is controlled chaos, not perfect repetition** — deepening the earlier
quasi-TC honesty (Watanabe–Oshikawa for the physics; OGY for the dynamics). Lensography is the optics
that make that control **composable and precise**; the meter (`DecorrelationMeter`) is how you *check*
whether the orbits are actually staying decorrelated/controlled vs collapsing into the tangle.

## Registers (keep the labels attached)

- **Register-2 (anchored math):** lens laws + optics (Foster 2007; profunctor optics); OGY chaos control
  (1990); homoclinic tangle / Melnikov. All established.
- **Register-3 (the bet — prove-with-data):** applying chaos-control **to intelligent-agent emergent
  interactions**. OGY needs the phase-space structure — the unstable periodic orbits and manifolds —
  which you *have* for a physical attractor but must **establish** for agent dynamics (they may not be a
  clean low-dimensional chaotic system with identifiable manifolds). Do not assert the application is
  proven; it is the frontier.
- **Legibility:** "lensography," "time crystals" — handles; the anchors above are the content.

## Pointers

- Optics: Foster et al. 2007 (lens laws); van Laarhoven 2009; Pickering–Gibbons–Wu (profunctor optics);
  Kmett `lens`. Meijer (IEnumerable⇄IObservable duality — the observe⇄steer bidirectionality).
- Chaos control: Ott–Grebogi–Yorke 1990 (OGY); Poincaré / Smale horseshoe (homoclinic tangle);
  Melnikov 1963.
- In-repo: the soft regime (`SoftValue`/`SoftActionController`; the pilot-wave/soft-regime doc); the
  decorrelation meter (`src/Core/DecorrelationMetrology.fs` + `DecorrelationMeter.fs`) — the check on
  whether orbits stay controlled; the economic thesis ("quasi-repeatable time crystals" as the product).
