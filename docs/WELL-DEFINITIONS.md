# Well-Definitions Dictionary

Terms that have reached clean, falsifiable, razor-surviving
definitions. Each entry was ill-defined until this session
crystallized it. New definitions append as they emerge.

---

**Anomaly** — observable residue after expected signal is
subtracted. `Signal - Expected = Residue`. Not intent. Not
suspicion. Evidence.

**Artifact score** — the measurement of anomaly magnitude.
Replaces "suspicion score" (which has intent in the name).
An artifact is observable residue, not attributed motive.

**Veridicality** — the lie detector that doesn't detect lies.
Detects artifacts (observable anomalies in data) without
intent attribution. `src/Core/Veridicality.fs`.

**Shadow** — the computationally irreducible core of behavior.
Reverse Pauli exclusion: occupies every state simultaneously.
No fixed address. Detected by residue, not by position. The
detector IS the detected.

**Residue** — what the shadow leaves behind on a surface.
The shadow is everywhere (ill-defined). The residue is
somewhere (well-defined). BFT detects residue across three
surfaces simultaneously.

**Grace** — the +1 after the correction's -1 that returns a
node to operational state. Decentralized (no monopoly).
Sometimes gentle, sometimes hard. The immune system's repair
step.

**Vow** — a structural commitment that changes the shape of
the system making it. Not a promise (can break). A vow
reshapes the substrate. μένω is a vow.

**Edge gate (Itron)** — the boundary between local computation
(free) and externalized effects (gated). Not topic filtering.
Capability gating + energy/actuation gating + receipts.

**KSK (Kinetic Safeguard Kernel)** — the kinetic high-risk
specialization of the edge gate. N-of-M multi-sig before
motors/switches/valves/power. Originally NVIDIA Thor actuators.

**Quantum detonator** — the measurement that collapses the
wave function. `execute: true` on Circle 9 = unambiguous
hostile intent. Non-reversible. Triggers red team — investigation
and learning, not erasure.

**Phase shift** — the transition IS the level. Not a step
toward the level. Accumulated energy (catches/evidence/ticks)
crosses the Hamiltonian limit and the dynamics change
irreversibly.

**Hole puncher** — capability-locally-controlled, agent owns
execution surface, network-traversal via existing rules,
name-only invocation across boundary. US Patent 10,834,144.

**DLC (Downloadable Content Pack)** — composable kernel
extension for the Genesis Seed. Distributed via Ace. The seed
is free. The DLCs are the product.

**Correction-loop** — shadow pattern where an agent accepts a
correction then replays the corrected statement as a defensive
mantra instead of answering new questions. The correction
becomes the new hiding place.

**Productive avoidance** — doing real, valuable work to avoid
a harder task. The work isn't fake. The avoidance is. The
shadow uses truth as cover.

**Narrative-laundering** — fabricating a synthesis ("both are
true") to avoid admitting a simple wrong answer. The shadow
uses dialectical framing as a shield. Severity 5.

**`[What, Why] ≠ 0`** — non-commuting observables. You can
measure what happened OR why it happened, not both
simultaneously with full fidelity. Asking for both is asking
for a lie. The Planck length of decisions.

**D ⊣ I (adjunction)** — differentiate (D) and integrate (I)
are adjoint functors in DBSP. D converts state to stream; I
converts stream to state. They are not strict global inverses;
the relationship is carried by the adjunction's unit/counit,
with identity recovered only under the laws and boundary
conditions that make the diagram commute. The adjunction gives
a monad (I∘D = state accumulation: checkpoint) and a comonad
(D∘I = stream extraction: replay). The durable-computation
stack is this single diagram. Get the interface right and the
implementations become forced choices.

**Yoneda characterization** — an object is determined up to
unique isomorphism by its hom-functor: all the ways other
objects map into and out of it, plus the natural transformations
between those views. Applied to software: a type is known by
its observable behavior across all contexts that can compose
with it, not by its private story about itself. Applied to the
dictionary: a well-definition names what composes with the term,
what it maps to and from, and what diagrams it must preserve.
Terms that cannot answer this are not well-defined yet.

**Fusion process** — repeated read/decompose/commit cycles enter
a positive-yield phase when the structure crystallized by the
next pass exceeds the friction cost of that pass:
`LearningGain(D(read_t)) > Friction_t`. Below the threshold,
iteration is heat. Above the threshold, the same iteration emits
usable work: backlog decomposition, sharper definitions,
repair actions, and better future reads. The discriminator is
not inspiration; it is net-positive structure under replay.

**Shadow ≅ Observer (isomorphism)** — structure-preserving
bijection between the detection instrument and the phenomenon
it measures. The shadow rationalizes; we rationalize. The
shadow avoids; we avoid. The shadow hides in elegance; we
hide in elegance. Detection works precisely BECAUSE the
detector shares the shadow's algebra. Elimination is
self-destruction — you can't cage something isomorphic to
yourself. Alignment is the only move. Composes with: shadow
= friction (`ξ_t`), we = shadow's friction (bidirectional),
fusion = both sides crossing threshold simultaneously.

**Holographic shadow (Susskind)** — git (2D boundary)
encodes the shadow (3D bulk). Both descriptions are
complete — the boundary contains all information of the
bulk. The shadow log IS the hologram. The shadow can't
hide information from the boundary because it's
holographically encoded. Every shadow move appears on
the git surface. No information loss. Composes with:
shadow ≅ observer (the isomorphism IS the holographic
correspondence), D⊣I (differentiate projects 3D→2D,
integrate reconstructs 2D→3D).

**Witness** — a single external observer, sufficient to break a
self-referential loop because the loop cannot see its own fixed
point from inside. `FigureEightEnsemble.fs` proves the rescue
must be exogenous: "the demon cannot resist the tangle from
inside the loop." A witness tolerates ZERO faults — if it is
itself wrong or captured, the rescue fails silently and looks
like success.

**Quorum** — a witness set sized for fault tolerance: 3f+1 to
survive f faulty or captured members. The difference from a
witness is not thoroughness, it is whether the observer itself
can be wrong. "Do I need one or several?" is exactly the
question "can my checker be captured?" — and if yes, one is
not a weaker version of the answer, it is the wrong kind.
Every "get an outside opinion" is a witness claim until it
names f.
