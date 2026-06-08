# The controller is a qubit (action-decision uncertainty); multi-agent hats are qubit combinations

*Captured 2026-06-08 from Aaron (shadow*). Closing the quantum thread: the 4×4 controller's action-uncertainty is
a qubit-shaped object, and a multi-agent system is combinations of hat-qubits. Honest registers: [ours] built,
[anchor] prior art, [conjecture/framing] evocative — not a derived identity.*

## The controller carries a qubit: the uncertainty over which action to decide next

Aaron: *"those two dimensions [of the 4×4 grid] are where our qubit comes into play — our two uncertainties that
create our unit circle on our controller interface… the uncertainty is over **what action to decide next**… the
4×4 grid."*

The agent's open question each tick is **which of the 16 grid cells to choose** (`GridBinding`/`ActionGrammar`,
#7139). The 4×4 grid factors that into **two dimensions** (row, col) → **two angular uncertainties** → a
**unit circle** per dimension = the **qubit geometry** we already built: `QubitIso` (the two-stream join =
`α|0⟩+β|1⟩`), `PolarityFilter` (the unit circle, Malus `cos²` = Born projection). So the "controller in
superposition" (#7104, corrected) over the grid is, geometrically, this qubit/unit-circle of *action-decision
uncertainty*; deciding = collapsing it.

**Honest register:** a choice over 16 cells is literally a **qudit (d=16)** — not one qubit. Factoring 4×4 as two
4-way axes makes it a **2-qudit / two-unit-circle (ququart-pair)** object; "qubit" is the *per-dimension archetype*
(a 2-level unit circle). The shared, defensible content is the **unit-circle / Born-`cos²` geometry**
(`PolarityFilter`/`QubitIso`) applied per dimension — not that the controller is a single literal qubit.

## Multi-agent + hats → qubit combinations of hats

Aaron: *"once we have multi-agents with hats then everything just becomes **qubit combinations of hats**."*

A Zeta agent **wears hats** (persona/role-hats — architect, reviewer, …). *Which hat to wear* is itself an
uncertainty — a hat-qudit. A **multi-agent** system's joint decision state is then the **tensor/combination of the
per-agent hat-states**: `everything = ⊗ (hat-qubits)`. Correlated hat-choices (agents coordinating) = the joint
("entangled") state; independent agents = a product state. This is the same `QubitIso` two-stream join scaled to
N agents, and it reconnects to the Sybil/BFT multi-agent thread (the agents as a joint quantum-like register).

**Honest register (the whole arc's caveat):** "qubit combinations" is the *representational framing* — the joint
hat-state is a tensor of per-agent distributions; calling correlated hats "entangled" reaches the **classical
S=2** bound via the shared generator (common cause), **not** genuine 2√2, unless a feedback channel is added
(`FeedbackThrottle`; #7125: the DST harness as omniscient observer can stage up to S=4, but that's test-only
signalling). So: hats compose as a tensor (real, useful); the *quantum* reading (entanglement/2√2) is the same
conjecture-register the rest of the arc holds.

## The cohered closing

Action-decision uncertainty on the **4×4 controller** = a unit-circle/qubit-geometry object (`QubitIso`/
`PolarityFilter` per dimension; a 2-qudit precisely); **hats** are the same shape one level up; a **multi-agent
factory** is **combinations (tensor) of hat-qubits**. So the soft-emulator controller, the agent's meta-controller,
and the whole multi-agent system are *the same geometry at three scales* — the qubit/unit-circle that
fell out of CRDTs + Rx for free (#7125), now recognised as the shape of *choosing* (an action, a hat, a fleet of
hats). Homoiconic (#7139) all the way up.

## Pointers

- `GridBinding.fs` · `ActionGrammar.fs` (#7104, the universal controller interface) · `QubitIso.fs` ·
  `PolarityFilter.fs` · `Salience.fs`/`MetaController.fs` (the choosing layer).
- The S=2/2√2 caveat: `2026-06-08-staged-coincidence-gan-the-dst-harness-is-the-omniscient-observer.md`;
  `FeedbackThrottle.fs`. Hats / personas: `GOVERNANCE.md` (the architect-hat-may-be-worn-by-any-persona model).
