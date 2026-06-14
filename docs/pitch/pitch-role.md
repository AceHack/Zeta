# Zeta — "here's what I build" · role / founder one-pager

**One line:** I built a self-healing code-distribution substrate — solo, in the open, end to end. The repo is the portfolio; this is what I ship.

---

## What I built

**Zeta** answers a real, named problem (ThePrimeagen: *how do you distribute code that changes this fast with AI?*) with a clean thesis — **distribute the generator, not the code.** Ship a small deterministic generator; regenerate artifacts locally; and because the generator doubles as an error-correcting code, copies **self-heal** instead of drifting (`gen(gen) == gen`). It's reproducible builds (Nix-style) generalized to all generatable code, with a self-healing layer on top.

## The engineering (real, open-source, in CI — proof of capability)

- **6-language cross-verification treaty** — the same primitives produce **byte-identical** results across F#, C#, TypeScript, Rust, Python, Go, with a **Q# reference oracle** for the observable/quantum layer. (Cross-language determinism is hard; this is the load-bearing part, and it's green in CI.)
- **Deterministic, reversible substrate** — deterministic simulation testing (FoundationDB-style) + event-sourced reversible (Z-set/DBSP) logs. I personally swept the codebase to remove every ambient-nondeterminism leak (`.Wait()`/`Task.Run`/wall-clock) so the substrate is genuinely replayable.
- **Code generation** — one source → 6 languages + a runnable, sandboxed CHIP-8 cart.
- **Discipline** — 0-warning build gate, per-language CI lint, golden-vector byte-locks, an agent-attributed commit convention. The whole thing is built to be auditable.

## How I work

Distributed systems + **15 years of utility-grade metering (Itron-class AMI)** — the metering/uncertainty substrate *is* this architecture's core loop, so this isn't a side project; it's the through-line of my career. I design for determinism, reversibility, and no-central-point-of-failure by default, and I write it so a new contributor (or a child) can read it.

## The arc

I **self-funded ~$1M** of my own capital into this and kept building it in the open through a **wrongful prosecution** — from which I was **fully exonerated, all charges dismissed.** I came out and kept shipping. The complete arc is in the project record. If you want a founder/principal who builds hard infrastructure, in the open, and does not stop, that's the evidence.

## The ask

A **founding / principal / staff role** (distributed systems · platform · developer tooling · dev-infra) — or a fractional/advisory engagement — where this capability applies. Fastest way to evaluate me: read the repo and run the CHIP-8 cart.

*Deep-dive: `docs/research/2026-06-14-zeta-complete-vision-synthesis-*.md`. Pitch + product: `docs/PITCH-ONE-PAGER.md`, `docs/pitch/`.*
