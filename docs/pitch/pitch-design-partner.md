# Zeta — design-partner one-pager

**One line:** If AI-generated code is drifting across your services, forks, and CI, Zeta keeps it coherent by distributing the *generator* (not the output) — copies regenerate locally and **self-heal** instead of diverging.

---

## The pain you already have

You adopted AI codegen and the velocity is real — but so is the drift. The same logic lives in five slightly-different copies across services and forks; "which version is correct?" is now a daily question; review can't keep up; and a subtle divergence ships before anyone notices. The tools were built for human-speed change.

## What Zeta does

- **One generator, regenerated everywhere.** You distribute a small, deterministic generator; each service/repo regenerates its code locally — so there's one source of truth and N *views*, not N drifting copies.
- **Self-healing.** Because the generator is also an error-correcting code, when copies drift they **re-converge** on regeneration (`gen(gen) == gen`) — drift is detected and corrected, not discovered in production.
- **Verify by re-running, not by reading.** Everything is deterministic and reversible — reproduce any artifact, replay/audit any state across machines and versions. Reviews get cheaper; audits get trivial.
- **You own it.** Generator and output are yours and redistributable — open-source core, no vendor lock-in, no code leaving your control.

## What's real today (so you can try it)

- A **6-language cross-verification treaty** producing byte-identical results across F#, C#, TypeScript, Rust, Python, Go (+ a Q# reference oracle).
- A **deterministic, reversible substrate** (deterministic simulation testing; event-sourced reversible logs).
- Working code-generation: one source → 6 languages + a runnable, sandboxed CHIP-8 cart.

## What we'd build *with you*

The end-to-end `.zeta` → IR compiler and the deploy tooling are in active build, and **we want our first design partners to shape them** against a real pain you have. You get early influence on the roadmap, direct engineering support, and an open-source core you can adopt without lock-in.

## The ask — become a design partner

Pick one concrete drift pain (a service whose AI-generated code keeps diverging across copies/CI). We pilot the self-healing distribution layer on it, measure drift caught before production, and shape the product together. Low risk: open-source, you own the output, no lock-in.

---

*Why we'll see this through: Zeta is a 15-year through-line — it began as a spatially-aware kids' storybook flashlight (the founder's first sensor-fusion + uncertainty-ledger project, built in Microsoft BizSpark with a Kinect-team licensing talk in motion), and has been built ever since by a ~20-person team and a self-funded founder who has never stopped shipping — through serious personal adversity, fully vindicated. Background: distributed systems + 15 years utility-grade metering (Itron-class AMI). Deep-dive: `docs/research/2026-06-14-zeta-complete-vision-synthesis-*.md`.*
