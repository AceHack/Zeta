---
name: Zeta UI = bun+TypeScript as canonical reference; backend = cutting-edge; UI evolves over time; new UI tech validated against the reference
description: Aaron's architectural asymmetry — Zeta's backend is the cutting-edge research surface, UI starts tried-and-true (bun+TypeScript) as canonical reference, and cutting-edge UI frameworks (Blazor WebAssembly, Rust frontends) land incrementally validated against that reference. UI evolves over time from stable toward cutting-edge; never the other way around.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
**The strategic frame** (Aaron 2026-04-20, pasted intact):

> *"also when we get to the UI i for sure want to try some
> cool stuff like blazor and rust but not yes i want to have
> a connonical standard for today that any more cutting edge
> ui frameworks can be validated against, typescript and bun
> is the most common choice now a days it will be little
> friction, the newer tech may have many benifit but they
> will come with friction so we want an easy reference to
> build before going to more cutting edge stuff with the UI,
> our backend is the super cutting edge part, our ui can
> slowly become cutting edge over time, it can start on the
> tried and true path today and eveolve over time."*

**The asymmetry:**

- **Backend (`src/`, verification tooling, operator algebra,
  retraction-native semantics, DBSP, TLA+, Lean, Z3):**
  *cutting edge by design.* This is where Zeta's research
  contribution lives. Novel patterns are *expected* here.
- **UI (forthcoming):** *tried-and-true, canonical
  reference first.* Start on bun+TypeScript — the
  lowest-friction, most common 2026 choice. Add
  cutting-edge tech (Blazor WebAssembly, Rust frontends,
  WebGPU rendering, whatever is emerging) *incrementally*,
  *validated against the reference*, not as the starting
  point.

The asymmetry is deliberate. A project can carry cutting-edge
risk in one dimension; carrying it in two at once multiplies
failure modes. Zeta's backend is already high-risk
(research-grade; unproven combinations); the UI surface
earns stability to let contributors actually ship frontend
work without re-learning paradigms.

**Why bun + TypeScript specifically, for the UI:**

- **Low friction.** Most common 2026 choice, broad
  tutorial / library / Stack Overflow coverage, minimal
  learning curve relative to everything else.
- **Amortizes with post-setup scripting.** The
  `tools/` surface already uses bun+TS per
  `docs/DECISIONS/2026-04-20-tools-scripting-language.md`.
  Adding UI on the same stack is free in terms of
  runtime / ecosystem / package-manager surface.
- **Exit ramps exist.** When Blazor WebAssembly,
  Rust/Wasm, or other frameworks graduate, the
  migration path is per-surface (one view at a time)
  not per-repo (rewrite everything). The reference
  UI is the known-good stable-ground that new tech
  is compared against.

**The evolve-over-time pattern:**

1. **Start:** Canonical reference UI in bun+TS.
2. **Pilot:** One visible surface (dashboard widget,
   visualization view, specific page) is rewritten in
   the candidate cutting-edge framework. The old
   TS version stays as the ground truth.
3. **Validate:** Compare the pilot against the
   reference on measurable axes — performance, bundle
   size, accessibility, contributor ramp-up time,
   build-time. Write the comparison up as a research
   artifact (same shape as `docs/research/proof-tool-
   coverage.md` but for UI frameworks).
4. **Decide:** If the cutting-edge framework wins
   decisively, migrate incrementally. If it loses or
   ties, the reference holds and the pilot is retired
   or kept as a research sandbox.
5. **Never:** Rewrite-the-whole-UI in the new
   framework without the validated comparison. That
   is exactly the failure mode this strategy
   prevents.

**How to apply:**

- **When the UI surface lands:** start in bun+TS with
  a simple framework (React, Solid, Svelte, or the
  lowest-friction choice by that point's internet
  sweep; decision owner is Aaron + UI research
  round). Deliberately pick tried-and-true.
- **When Blazor / Rust-Wasm / exotic framework is
  proposed:** treat it as a *pilot*, not a *default*.
  Pilot goes in a dedicated subdirectory (e.g.
  `ui/pilots/blazor-dashboard/`). Reference UI
  stays in its canonical location (e.g. `ui/main/`
  or `ui/app/`).
- **Validation before adoption:** every cutting-edge
  framework comparison produces a dated research
  report under `docs/research/` and, if adopted, an
  ADR under `docs/DECISIONS/`.
- **Resist the "full migration" temptation.** Even
  if a cutting-edge framework is clearly superior,
  the migration is per-surface, not per-repo.
- **The backend stays cutting-edge regardless.** Do
  not back off research-grade choices in `src/` just
  because the UI is conservative. The asymmetry is
  intentional.

**Implication for the post-setup scripting ADR:**

Raises confidence in the bun+TS post-setup decision
further. The ADR's watchlist trigger #4 ("UI-TS
amortization evaporates if UI ends up on Blazor /
Rust / MAUI") is now **much less likely** — Aaron's
strategy keeps bun+TS as the reference even if
Blazor or Rust land as pilots. The watchlist still
exists for the other triggers (bun regresses,
better candidate emerges, pain accumulates).

**What this does NOT mean:**

- Does not forbid Blazor / Rust / Wasm UIs forever.
  The point is *order*: reference first, then
  cutting-edge with validation.
- Does not mean bun+TS is the *only* UI tech Zeta
  will ever ship. It means it is the *starting
  point* and the *reference*.
- Does not apply backward to the backend. Backend
  is cutting-edge. UI is tried-and-true starting
  point. Different rules for different surfaces.

**Sibling memories:**

- `project_bun_ts_post_setup_low_confidence_watchlist.md`
  — the post-setup scripting decision this
  strategy reinforces.
- `feedback_prior_art_weighs_existing_technology_interop.md`
  — the existing-tech-interop rule; cutting-edge UI
  pilots must weigh interop with the reference.
- `feedback_new_tooling_language_requires_adr_and_cross_project_research.md`
  — every cutting-edge UI framework proposal goes
  through the ADR + research process.
