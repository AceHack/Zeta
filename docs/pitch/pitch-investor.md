# Zeta — pre-seed ($1M) · investor one-pager

**Zeta started as a kids' storybook flashlight** — a spatially-aware light that kept the picture *steady on the wall no matter how you moved it*, using sensor fusion and an uncertainty ledger. Fifteen years later, that exact invariant — **keep the output consistent no matter how fast it changes** — is the answer to the problem every engineering team now has: **AI writes code faster than they can keep it in sync.** Zeta ships the *generator*, not the output, so every copy regenerates locally and **self-heals** instead of drifting. We're raising **$1M pre-seed**.

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

Wedge: **AI dev-tooling** (every team shipping AI-generated code). Expansions: **regulated / safety-critical** (deterministic+auditable+reversible), **education** (Craft School — a new programming on-ramp, descended directly from the storybook flashlight), **personal-data ownership** (user-owned Memex). Land on the dev-tooling pain; expand into assurance and education.

## Founder

This isn't a 2-year pivot — it's a **15-year through-line.** It began (~2010) as the storybook flashlight above, Aaron's first sensor-fusion + uncertainty-ledger project, while in **Microsoft BizSpark** and in **licensing talks with the Kinect team** for their sensor tech. The same two ideas in that flashlight — *kids-first* and an *uncertainty ledger* — are the core of Zeta today. Background: distributed systems + **15 years utility-grade metering (Itron-class AMI)** — the metering/uncertainty substrate *is* the architecture's core loop.

Across those years (and the names RizeIdol → Bombrock → AlephZ → Zeta), with a team of **~20 people**, Aaron **self-funded ~$1M** of his own capital and **never stopped building** — through two divorces, a **wrongful imprisonment over a legal product** (fully exonerated, all charges dismissed, ~$1M and a year lost, a heavy toll on his family), and being **fired for open-sourcing this work.** The commit history shows it didn't even slow down. Proven right, proven unstoppable, building in the open the entire time.

## The ask — $1M pre-seed

To convert the open-source proof into a product the first teams deploy: harden the self-healing distribution layer, sign 3–5 design partners, and ship the deploy/assurance tooling. Use of funds: core engineering, design-partner delivery, runway to a usage milestone.

*Technical deep-dive: `docs/research/2026-06-14-zeta-complete-vision-synthesis-*.md`. Built in the open — the repo is the proof.*
