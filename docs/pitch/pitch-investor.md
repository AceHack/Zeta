# Zeta — pre-seed ($1M) · investor one-pager

**One line:** AI writes code faster than teams can keep it in sync. Zeta ships the *generator*, not the output — so every copy regenerates locally and **self-heals** instead of drifting. We're raising **$1M pre-seed** to take the self-healing distribution layer from open-source proof to a deployable product.

---

## Problem (why now)

AI changed the *rate* of code change; it did not change how code is *distributed*. Packages, forks, branches, review, and sync were built for human-speed change and break at AI speed — you get N copies that have quietly diverged and no cheap way to know which is right. Every team adopting AI codegen is walking into this wall in 2025–26. (ThePrimeagen named it publicly: *how do you distribute code that changes this fast with AI?*)

## Product

**Distribute the generator, not the code.** Ship a small, stable, deterministic generator; regenerate the fast-changing code locally; and because **the generator is also an error-correcting code**, divergence self-corrects — regenerate and copies snap back into agreement (`gen(gen) == gen`). It's **Nix / reproducible builds generalized to all generatable code, plus a self-healing layer Nix doesn't have.**

## Why it wins (moat)

- **Self-healing distribution** — building from the generator *is* the drift-check. Not just reproducible; re-convergent.
- **Deterministic + reversible** — verify by re-running, not by reading; replay/audit any state across machines and versions. Compliance and audit become features.
- **User-owned** — generator and output are redistributable, not locked in a vendor cloud (the opposite custody to the AI-browser land-grab).
- **Open-source flywheel** — the substrate is public; adoption compounds; the company sells the deploy/scale/assurance layer on top.

## Traction (real, open-source, in CI)

- **6-language cross-verification treaty** — identical primitives produce byte-identical results across F#, C#, TypeScript, Rust, Python, Go, with a **Q# reference oracle** for the observable layer.
- **Deterministic, reversible substrate** — deterministic simulation testing + event-sourced reversible logs (the part that makes "trust without reading" true).
- **One source → 6 languages + a runnable CHIP-8 cart.** Working code-generation today.

## Market

Wedge: **AI dev-tooling** (every team shipping AI-generated code). Expansions: **regulated / safety-critical** (deterministic+auditable+reversible), **education** (Craft School — a new programming on-ramp), **personal-data ownership** (user-owned Memex). Land on the dev-tooling pain; expand into assurance and education.

## Founder

Distributed systems + 15 years utility-grade metering (Itron-class AMI) — the metering/uncertainty substrate *is* the architecture's core loop. **Self-funded ~$1M of personal capital into this.** Built it in the open, through significant adversity, and emerged fully vindicated. <!-- founder story (self-funded $1M; wrongful prosecution → fully exonerated, all charges dismissed; built in the open, kept building) — wording is Aaron's to set; verbal in the room may be stronger than in print. -->

## The ask — $1M pre-seed

To convert the open-source proof into a product the first teams deploy: harden the self-healing distribution layer, sign 3–5 design partners, and ship the deploy/assurance tooling. Use of funds: core engineering, design-partner delivery, runway to a usage milestone.

*Technical deep-dive: `docs/research/2026-06-14-zeta-complete-vision-synthesis-*.md`. Built in the open — the repo is the proof.*
