# Zeta — distribute the generator, not the code

**One line:** It began as a kids' storybook flashlight that kept the picture steady on the wall no matter how you moved it. The same invariant — *keep the output consistent no matter how fast it changes* — is now the answer to AI writing code faster than teams can keep it in sync: Zeta ships the *generator*, not the output, so every copy regenerates locally and **self-heals** instead of drifting.

> Audience-tuned variants: `docs/pitch/pitch-investor.md` ($1M pre-seed) · `docs/pitch/pitch-design-partner.md` · `docs/pitch/pitch-role.md`.

---

## The problem

AI now changes a codebase faster than the tools we use to *distribute* code can keep up. Packages, forks, branches, code review, and sync were all built for human-speed change. At AI speed they break the same way: you end up with N copies that have quietly diverged, and no cheap way to know which is right. (ThePrimeagen asked it plainly: *how do you distribute code when it changes this fast with AI?*)

## The answer

**Don't distribute the code. Distribute the generator.**

The artifact stops being the source of truth and becomes a *regenerable view*. You ship a small, stable, deterministic generator; everyone regenerates the fast-changing code locally; and — the key move — **the generator is also an error-correcting code**, so divergence self-corrects: regenerate, and copies snap back into agreement.

If you know **Nix / reproducible builds**, you already know the shape: ship the deterministic *recipe*, not the binary, and the content hash proves it rebuilt identically. Zeta generalizes that from build artifacts to *all generatable code* — and adds the self-healing layer Nix doesn't have.

## Why it's different (and defensible)

- **Self-healing distribution.** Building from the generator *is* the drift-check (`gen(gen) == gen`). Copies don't just rebuild identically — they re-converge when they drift.
- **Deterministic + reversible.** Every result is reproducible and undoable. That means you can **trust a generated artifact without reading it** (verify by re-running, not by review) and **audit/replay** any state — across machines (space) and versions (time).
- **You own it.** The generator and its output are user-owned and redistributable — not locked inside a vendor's cloud. Same capability as the AI-browser land-grab (see what you see), opposite custody (it's *yours*).
- **Built on metering, not metaphor.** The core is a real distributed-systems substrate (deterministic scheduling, event-sourced reversible logs, cross-language byte-lock), grounded in 15 years of utility-grade metering / AMI experience.

## What's real today (vs roadmap)

**Built, open-source, in CI:**

- A **6-language cross-verification treaty** — the same primitives produce byte-identical results across F#, C#, TypeScript, Rust, Python, Go, with a **Q# reference oracle** for the quantum/observable layer.
- A **deterministic, reversible substrate** (deterministic simulation testing; event-sourced Z-set logs) — the part that makes "trust without reading" true.
- Code generation that emits to all targets **plus a CHIP-8 cart** (a tiny, sandboxed, runnable, *visual* unit) from one source.
- A **mutual-verification trust instrument** — two parties (say a human operator and an AI) re-run the *same deterministic detector* on a shared record, so a hidden coordination channel leaves a fingerprint neither can hide: *"verify by re-running" applied to trust itself.* Formally verified (Z3 + property tests, four independent reviewers) with a runnable demo — the sovereignty-guardian core (on modeled data today; real-grid integration is roadmap).

**Roadmap:** the `.zeta` → IR compiler end-to-end; the visual/geometric authoring surface; Craft School (the education product, below); reversible-hardware (FPGA) experiments.

## Who pays

- **AI dev-tooling:** teams shipping AI-generated code that need it coherent across services, forks, and CI — the Primeagen problem, monetized.
- **Regulated / safety-critical:** deterministic + reversible + auditable = replay any decision, prove any build. Compliance and audit are a feature, not an afterthought.
- **Education (Craft School):** kids learn by building — each lesson ends in a playable CHIP-8 cart they can see, share, and trust. A new on-ramp to programming (and to quantum/geometry) that scales from a 5-year-old to research.
- **Personal data ownership (Memex):** a user-owned "super browser history" that remembers every page — the opposite of surveillance capture: yours, redistributable, consent-by-construction.

## The ask

*(set per audience)* — looking for **[design partners / a pre-seed raise / a founding technical role]** to take the self-healing distribution layer from open-source proof to a product the first teams can deploy.

---

*Built in the open. Founder background: distributed systems + 15 years utility-grade metering (Itron-class AMI). Technical deep-dive: `docs/research/2026-06-14-zeta-complete-vision-synthesis-*.md`.*
