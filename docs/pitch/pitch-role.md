# Zeta — "here's what I build" · role / founder one-pager

**It started as a flashlight I built so my kids could see steady storybook pictures on the wall** — my first sensor-fusion and uncertainty-ledger project. Fifteen years later it's a self-healing code-distribution substrate, built solo and in the open, end to end. Same core idea — keep the output consistent no matter how it moves/changes. The repo is the portfolio; this is what I ship.

---

## What I built

**Zeta** answers a real, named problem (ThePrimeagen: *how do you distribute code that changes this fast with AI?*) with a clean thesis — **distribute the generator, not the code.** Ship a small deterministic generator; regenerate artifacts locally; and because the generator doubles as an error-correcting code, copies **self-heal** instead of drifting (`gen(gen) == gen`). It's reproducible builds (Nix-style) generalized to all generatable code, with a self-healing layer on top.

## The engineering (real, open-source, in CI — proof of capability)

- **6-language cross-verification treaty** — the same primitives produce **byte-identical** results across F#, C#, TypeScript, Rust, Python, Go, with a **Q# reference oracle** for the observable/quantum layer. (Cross-language determinism is hard; this is the load-bearing part, and it's green in CI.)
- **Deterministic, reversible substrate** — deterministic simulation testing (FoundationDB-style) + event-sourced reversible (Z-set/DBSP) logs. I personally swept the codebase to remove every ambient-nondeterminism leak (`.Wait()`/`Task.Run`/wall-clock) so the substrate is genuinely replayable.
- **Code generation** — one source → 6 languages + a runnable, sandboxed CHIP-8 cart.
- **Discipline** — 0-warning build gate, per-language CI lint, golden-vector byte-locks, an agent-attributed commit convention. The whole thing is built to be auditable.

## How I work

Distributed systems + **15 years of utility-grade metering (Itron-class AMI)** — the metering/uncertainty substrate *is* this architecture's core loop, so this isn't a side project; it's the through-line of my career, straight from that first flashlight (built while in Microsoft BizSpark, in licensing talks with the Kinect team). I design for determinism, reversibility, and no-central-point-of-failure by default, and I write it so a new contributor (or a child) can read it.

## The arc

Fifteen years, a team of **~20 people**, across the names RizeIdol → Bombrock → AlephZ → Zeta. I **self-funded ~$1M** of my own capital and **never missed a beat** — through two divorces, a **wrongful imprisonment over a legal product** from which I was **fully exonerated, all charges dismissed** (it cost me a year, ~$1M, and put my family through hell), and being **fired from my job for open-sourcing this work.** I came out and kept shipping; the commit history shows it never even slowed. If you want someone who builds hard infrastructure, in the open, and does not stop, that's the evidence — and it's all on the record.

## The ask

A **founding / principal / staff role** (distributed systems · platform · developer tooling · dev-infra) — or a fractional/advisory engagement — where this capability applies. Fastest way to evaluate me: read the repo and run the CHIP-8 cart.

*Deep-dive: `docs/research/2026-06-14-zeta-complete-vision-synthesis-*.md`. Pitch + product: `docs/PITCH-ONE-PAGER.md`, `docs/pitch/`.*
