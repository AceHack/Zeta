# Checked mixed-message and immutable module epochs

Date: 2026-09-08 UTC
Author: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade proposed ADR
Status: proposed; source contract requires independent review and ownership before implementation
Lifecycle: active
Work item: 081M1Z63YMC087G0R003N5FH9X

## Context

The [accepted proposal](../research/2026-09-08-mixed-message-learned-module-epoch-proposal.md)
at `9928404da6cf7ab1c5e2b251ae7afe73bbe2eda0` and
[independent review](https://github.com/Lucent-Financial-Group/Zeta/blob/6f5c62198aaee8f758d726e0c4c514f3bab57b9a/docs/research/2026-09-08-mixed-message-epoch-independent-review.md)
require a small execution boundary before the intended learned comparison.
Current `FactorGraph` already excludes the receiving factor and replaces sites.
Current checked precision kernels and scalar certification supply local rules.
They do not supply mixed scheduling, neural training epochs or a live
Python/F# certification bridge. `SoftScheduler.drive` loses its local threaded
state when it returns `Error`; the adapter must retain its own actual prefix.

## Decision proposed

Implement the single bounded slice specified in the
[source contract](../research/2026-09-08-checked-mixed-message-module-epoch-source-contract.md):

1. A typed Gaussian/Gamma adapter over existing factor-to-variable maps,
   driven sequentially by the existing `SoftScheduler.drive`.
2. One fixed point-weight neural module: 12 inputs, four tanh hidden units,
   one linear output and 57 parameters; fixed-order SGD on half squared error.
   This is a small actual learner, not a Bayesian weight posterior, a general
   autodiff framework or a SOTA baseline.
3. Immutable evidence cuts, parameter artifacts and nested-module manifests.
   Query cannot train. A training step replaces its entire vector only after
   all gradients from the same old vector and all new parameters are admitted.
4. A source-admitted async `ProjectionService`, implemented by one finite
   Python coordinator and one F# epoch peer. The coordinator invokes the
   existing native process helper and independent `certify_native`; it does
   not run the old 40-case driver. The real bridge is part of this cycle.
5. An independently retained update ledger, last committed state, explicit
   budgets and compensating revisions. No returned failure, service refusal
   or serialization failure may be replaced by an invented successful state.

The declared inference model is a Gaussian prior times zero to two Normal
precision factors with frozen feature means, Gamma priors on their precisions,
and `exp(k*z-c*exp(z))`. Zero feature factors permits the isolated unary control.
VMP reads declared other marginals; projection reads the other-factor Gaussian
base and returns a belief. Convert that belief to a site by checked quotient
by the retained base, then replace. Damping and finite reconstruction get their
own properness checks; they do not inherit the undamped minimizer certificate.

The module DAG can contain neural nodes and nested DAGs. Graph topology and
distinct producer IDs do not establish statistical independence. Frozen means
are conditional features; using them in a product model does not prove
independent expert errors. Neural modules use declared local supervised loss,
not an unaccounted normalized product likelihood. A weight artifact is state
and provenance, not another likelihood observation. The model and every
approximation remain explicit.

## Reuse and additions

Reuse `Gaussian`, `FactorGraph<'M>.FactorToVar`, checked
`PrecisionGateKernels`, `SoftScheduler.Handler`/`drive`, `IntrCtx`/`ISR`,
`prepare_native`, `launch_native`, `certify_native`, the bounded result encoder
and exclusive record store. Retain the existing exclusion/replacement laws;
do not insert unchecked VMP functions into cavity-only `ComputeMessages`.
The narrow toy ADF learner remains a useful existing example, not the chosen
12-4-1 neural implementation.

New source, after ownership, is limited to the learner, adapter, one F# peer,
one Python bridge, dedicated tests and necessary project/build wiring listed
in the companion contract. No general RPC, rule plugin loader, new scheduler,
dynamic code import, data loader, optimizer library or independent framework
is required. No existing inference API is silently upgraded by this ADR.

## Exit and consequences

All eight fixed control groups in the companion contract are required. They
include an independently checked gradient, the real scheduler error route,
one actual successful native/certificate exchange and the actual cancellation
refusal through that same bridge. Mocks alone cannot close the slice.

After one reviewed adapter cycle, proceed to one separately registered
chronological learned comparison: individual modules, flat fusion, one shallow
DAG and one deeper DAG, using one frozen compatible artifact pool. Keep
unchanged-model flattening separate from a changed-model topology ablation.
Fix feature/target availability, chronological inner fitting, embargo and final
holdout before fitting. Count failed fits, refusals and abstentions. Passing
scalar checks is not the learning result, and a negative learned result does
not authorize expanding prerequisites until a win appears.

That comparison must identify a current primary published comparator and its
feasible pinned executable implementation, in addition to individual/equal/flat
controls. If it cannot run within the declared budget, report that limitation;
do not call the small adapter learner a SOTA baseline or claim a SOTA comparison.
The existing PGE source/equation findings and separate faithful-versus-density-
consistent model identities remain binding. Reproducing all PGE/PNC work is
not an adapter prerequisite.

Full PGE reconstruction, forward positive-family projection, Bayesian NN weight
integration, learned schedules, distributed epochs and global convergence
theorems remain outside this slice. The present task executed no implementation,
training, solver, new data or old registered stream. This ADR is a proposed
decision with an exact bounded source contract, not an execution registration.
