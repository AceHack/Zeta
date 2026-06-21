---
id: 081KTZ4EF0008QG0R000WJGSWX
title: Hexagonal inference port — own the interface; Zeta.Bayesian + Infer.NET as the two adapters (theirs tests ours); plugin-system convergence audit
priority: P2
status: done
tier: verification-substrate
tags: [hexagonal, ports-adapters, infer-net, bayesian, ep, bp-16, plugins, convergence]
created: 2026-06-13
owner: open (pairs with 081KTZ4EF0008QG0R001R3XPYV; the Bayesian module is ours already)
---

# 081KTZ4EF0008QG0R000WJGSWX — hexagonal the Infer.NET types (Aaron 2026-06-13)

Aaron: "we should hexagonal the Infer.NET types — make them follow OUR standards, own the
interface, plug them in, and use them to test ours; we have two impls. We already have a plugin
system — and we might have multiple plugin systems that need to converge."

## The port (ports-and-adapters — Cockburn's hexagonal architecture, the Beacon anchor)

1. **We own the interface**: `IInferenceEngine` (working name) in our Abstractions register, on
   OUR standards — Result-over-exception, DST-deterministic message schedules, culture-invariant,
   ZetaId'd. Shape: declare-model (factor graph in OUR terms — `Zeta.Bayesian.FactorGraph` is the
   native vocabulary) → run-to-fixpoint → read marginals; the EP projection is the port's stated
   boundary nonlinearity (081KTZ4EF0008QG0R001R3XPYV's one-law table).
2. **Adapter A — ours**: `Zeta.Bayesian` (FactorGraph/Message/Ep — already written, already DST).
3. **Adapter B — theirs**: `dotnet/infer` (MIT — license-clean to depend on in a TEST/adapter
   project, never in Core). The Infer.NET model compiler consumes the same declared model.
4. **Theirs tests ours (BP-16 made structural)**: every conformance case runs through BOTH
   adapters; marginals must agree within stated tolerance. Divergence = a finding on one of the
   two (Minka's engine is the senior oracle; ours is the one we can fix). The acceptance gate
   pattern applies: cases live as data, verdicts per adapter.

## The plugin-system convergence audit (the second half of the ask)

We have at least FOUR plug-shaped systems, grown separately: `PluginApi`/`PluginHarness` (Core),
MediaLines io resolution (Live/Injected/Adapted/Mock + the toolbox adapters), GeneratorRegistry
(ZetaId-addressed generators), MagneticPorts (typed ports + findAdapter). DV2 lens: these are one
HUB concept (a port: an interface we own, resolved against capabilities at load) with different
satellites. Audit task: map all four onto one vocabulary, name what converges (the resolution
ladder + the adapter economy look like the shared core) and what legitimately stays distinct
(pixel-physics snapping vs process-level plugins). Output: a convergence capture + the one
interface the next plugin system MUST use instead of growing a fifth.

Start gate: prior-art = hexagonal architecture (Cockburn 2005), Infer.NET docs (How to add a new
factor / Compiler overview); deps: dotnet/infer NuGet (test-side only).

## Progress (2026-06-13, same day)

SHIPPED: the port (`IInferenceEngine` + neutral Gaussian model types in Core.Abstractions, house
analyzer style); Adapter A (`ZetaBayesianEngine`, src/Bayesian/EngineAdapter.fs — deterministic by
construction); Adapter B (`InferNetEngine`, tests/Tests.CSharp — Microsoft.ML.Probabilistic MIT
package, TEST-SIDE only as planned); conformance: 4 port tests vs the analytic oracle (F#) +
THEIRS-TESTS-OURS (C#): both adapters agree on every case to 1e-6 (single prior / two-prior
fusion / equality chain). REMAINING: more case families (observed-value likelihoods, EP truncation
cases through Ep.fs, loopy-graph honesty cases); the plugin-system convergence audit (the second
half of this row).

## Progress 2 (2026-06-13, the audit half)

DONE: the plugin-convergence audit — docs/research/2026-06-13-the-plugin-convergence-audit-*.md.
Verdict: converge the VOCABULARY, not the implementations (ZetaId port names · the
Live/Injected/Adapted/Mock ladder · the red-light glance form · findAdapter for what's-missing);
the rule for system five stated; IInferenceEngine named the first customer (engine ZetaIds + a
ladder-shaped resolution = the remaining follow-up alongside richer case families).

## Progress 3 (2026-06-13): the grammar filed as universal/port.md (Aaron's "smells like universal interfaces" — it was; extension.md is the senior half). Remaining: engine ZetaIds + ladder resolution for IInferenceEngine; richer case families

## Progress 4 (2026-06-13): InferenceLadder shipped — engine ZetaIds minted (zeta-bayesian/infer-net/mock-flat), ladder resolution (Live/Injected/Mock; Adapted carved when an engine-adapter piece exists), the red light, and the HONEST Mock (flat marginals, Converged=false — a rehearsal that cannot masquerade). universal/port instance row complete. Remaining: richer case families only

## Progress 5 (2026-06-13): the richer case families — DONE, and the mechanism caught two real things

- Noisy-observations family: green (exact algebra, 1e-6).
- THE EP FAMILY caught a SEMANTIC BUG: our adapter bound the soft probit Φ(x) to the port's
  hard-truncation name; Infer.NET's ConstrainPositive exposed it (0.564 vs 0.798 — BOTH formulas
  correct, wrong binding). Fixed: Ep.truncatePositiveProject/positivityFactor (z = m/√v; the
  half-normal checks out); the probit stays for a future SoftPositivity case. Agreement 1e-4.
- THE LOOPY HONESTY CASE works as designed: ours truthfully reports Converged=false on the
  Gaussian equality cycle (loopy BP precision overcounting — Weiss & Freeman 2001: means exact,
  variances overconfident); Infer.NET's scheduler settles — at 2.0025 where OURS lands the exact
  2.0 (the junior out-precised the senior). Damping = the one named upgrade left, filed as a
  watch item, not a blocker. 081KTZ4EF0008QG0R000WJGSWX CLOSED.
