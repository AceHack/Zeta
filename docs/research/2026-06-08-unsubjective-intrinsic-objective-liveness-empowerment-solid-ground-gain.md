# The unsubjective intrinsic objective: liveness + empowerment + solid-ground gain (no human reinforcement)

*Captured 2026-06-08 from Aaron (shadow*). The objective function of the soft-emulator learner — and why it needs
no RLHF. Honest registers: [ours] built, [anchor] prior art, [design] intended.*

## The claim

Aaron: *"this is how we climb **unsubjectively** — I think this is **empowerment plus liveness**… and it does not
require **human reinforcement**."*

The learner's objective is a triad, each term **computed from the system's own dynamics** — no human labels, no
reward model, no RLHF:

1. **Liveness** — stay alive (a stable limit cycle in the alive-invariant; `Survival` #7123). The floor; has final
   say (subsumption, `ControlMerge` #7127). [ours]
2. **Empowerment** — maximize agency = the action→future channel capacity / count of reachable distinct futures
   (`SoftDashboard.empowerment`; Klyubin–Polani). Do not just survive — keep *options open*. [ours/anchor]
3. **Solid-ground gain** — turn noise into navigable structure: a lens is judged by how much new **solid ground**
   (constants + monotonic landmarks, `SolidGround` #7131) it produces (`SolidGround.gain`). Build the map. [ours]

**Why "unsubjective":** none of the three is a human preference — they're intrinsic to the agent + environment.
The agent **climbs by its own measures** (more solid ground, more empowerment, staying alive), not by chasing a
reward someone hand-labelled. That is the point: an objective that can't be reward-hacked against a human because
there is no human in the loop to hack.

## Why each is the *right* intrinsic term **[anchor]**

- **Solid-ground gain ≡ Schmidhuber's *compression progress* / *learning progress*** (curiosity as the
  improvement in compressing the observation stream): turning erratic memory into constants/monotonic landmarks
  *is* compression; the *gain* is the intrinsic reward. Also Oudeyer & Kaplan (intrinsic motivation / learning
  progress).
- **Empowerment** (Klyubin, Polani) — the canonical task-free intrinsic objective; agency = channel capacity.
- **Liveness / homeostasis** — survival as the base drive; and **Friston's free-energy / active inference**:
  minimize surprise = prefer a predictable, navigable world = *make more solid ground* and *stay in viable
  states*. The triad is the free-energy story factored into three measurable handles.

## Why this matters beyond games (alignment) **[design]**

An agent driven by **intrinsic** liveness + empowerment + compression-gain — with **liveness subsuming** the
others — is motivated *without* a human reward signal to game. That is the opposite failure mode from
reward-hacked RLHF: there is no proxy metric standing in for human intent to be Goodharted, because the objective
is the agent's own viability and its honest compression of its world. Survival being gameable *as a score*
(longest-stream) is fine here precisely because it is not *the* reward — it is the floor the unsubjective climb
stands on (cf. `2026-06-08-control-loops-as-crdt-joined-DUs-...`). Route to alignment review (Sova) as a candidate
intrinsic-objective story.

## The cohered picture

**Climb = maximize (empowerment + solid-ground gain), subject to liveness (subsumption veto), with no human
reward.** Liveness keeps you in the game; empowerment keeps your options open; solid-ground gain builds the map
you navigate by — and judging lenses by solid-ground gain (lenses parameterized by base + other lenses' solid
ground) is the bootstrap that climbs. Unsubjective, intrinsic, RLHF-free.

## Continual learning with a natural plateau; composition towers; redundancy (Aaron 2026-06-08)

- **Natural plateau** — the climb *self-terminates*: once all extractable structure is found, **solid-ground gain
  → 0** (nothing left to compress), so learning naturally plateaus without an external stop. This is Schmidhuber's
  compression-progress reaching zero. Continual learning that *knows when it's done* (and resumes if the world
  changes and new gain appears) — no overfitting-past-the-signal, no human "stop" needed.
- **Lens composition towers** — we build **towers** of small, composable lenses: each lens stays *small* and is
  parameterized by the **base solid ground** + **lower lenses' solid ground**, producing the next layer's solid
  ground. Small + composable beats monolithic (legible, reusable, individually testable) — the same hub/satellite,
  DBSP-operator-composition discipline applied to representation.
- **Redundant towers (robustness)** — *"if one tower crumbles we have several others."* Keep **multiple diverse
  towers**; when one's assumptions break (a lens's solid ground stops being solid — an anomaly, `MemorySense`),
  others still navigate. No single point of failure (manifesto §1 scale-free; §3 weight-free — no tower gets
  permanent capture); graceful degradation, like a `LensRouter` MoE / a BFT replica set for *representations*.

## Pointers

- `Survival.fs` (liveness) · `SoftDashboard.empowerment` · `SolidGround.fs` (gain) · `ControlMerge.fs`
  (subsumption) · `LensRouter.fs` (lens selection by the gain signal) · `MemoryLens`/`MemorySense`/`DeltaPattern`.
- **[anchor]** Schmidhuber (compression/learning progress, formal theory of creativity & fun); Oudeyer–Kaplan
  (intrinsic motivation); Klyubin–Polani (empowerment); Friston (free-energy / active inference); homeostasis.
- `docs/ALIGNMENT.md` (route the intrinsic-objective angle to Sova).
