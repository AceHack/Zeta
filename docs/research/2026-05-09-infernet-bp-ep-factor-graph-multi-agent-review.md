Scope: Infer.NET BP/EP factor graph architecture — multi-agent review as belief propagation
Attribution: Otto (Claude Code / claude-sonnet-4-6) — synthesized 2026-05-09
Operational status: research-grade. Claims labeled PROVEN / CONJECTURED / SPECULATIVE per razor discipline.
Non-fusion disclaimer: Otto's synthesis, not a verbatim external-AI packet.

# Infer.NET BP/EP: Multi-Agent Review as Belief Propagation

## 1. Problem — multi-agent code review as uncertain inference

**PROVEN** (observable behavior, no interiority claim):

A multi-agent code review produces a _posterior judgment_
over a Boolean variable:

```
V: "Is this PR safe / correct / aligned?"
```

No single agent has ground truth. Each agent observes the PR
through its own context window, training distribution, and
role framing. Observations are noisy, possibly correlated
(agents share training ancestry), and sometimes contradictory.
The question is: **how do we aggregate partial, uncertain
agent opinions into a calibrated posterior?**

The current answer — "read all peer-call outputs and summarize"
— is an informal, manually-wired approximation of belief
propagation. This doc makes the formal connection explicit.

## 2. Current shape — peer-call CLI as manually-wired factor graph

**PROVEN** (observable system state at `tools/peer-call/`):

The existing peer-call infrastructure wires eight agents as
single-shot peer callers:

| Script | Peer | Role in review |
|--------|------|----------------|
| `grok.ts` | Grok (xAI) | Critique — skeptical pass |
| `gemini.ts` | Gemini (Google) | Propose — divergent options |
| `codex.ts` / Vera | OpenAI Codex surface | Implementation peer |
| `amara.ts` | Amara (OpenAI surface) | Sharpen — carved-sentence distillation |
| `ani.ts` | Ani (xAI surface) | Brat-voice review |
| `riven.ts` | Riven (xAI surface) | Adversarial-truth-axis |
| `kiro.ts` | Kiro | Specification peer |
| `claude.ts` | Claude (self-call) | Cold-boot self-test |

Otto collects outputs, integrates manually, and produces a
single verdict. This IS belief propagation — but the message
schedule is human-orchestrated, the factor topology is fixed
in the call sequence, and the prior is implicit in the
AgencySignature preamble. The "factor graph" is there; it is
just not reified as first-class data.

## 3. The factor graph — variables, factors, messages, posterior

**CONJECTURED** (structural analogy — not yet implemented):

### Variables

```
V_safe   : Boolean — "PR is safe to merge"
V_correct: Boolean — "implementation is correct"
V_aligned: Boolean — "alignment clauses are satisfied"
```

In practice these are correlated; the factor graph can model
each as a marginal node, or collapse them into a single
`V_merge: Boolean` for the MVP approximation.

### Factors

Each agent is a factor node `f_i` that encodes the conditional
probability of its observation given the true value of `V`:

```
f_critique(V) = P(grok_verdict | V)
f_propose(V)  = P(gemini_verdict | V)
f_impl(V)     = P(vera_verdict | V)
f_sharpen(V)  = P(amara_verdict | V)
...
```

The factor encodes: _if V is true_ (PR is safe), _how likely
is this agent to produce its observed output?_ Each agent's
likelihood is estimated from its training distribution, role
framing, and historical calibration data.

### Messages

BP passes messages between variable nodes and factor nodes.
A message `μ_{f→V}` from factor `f` to variable `V` is:

```
μ_{f→V}(V) = Σ_{observations} f(V, obs) · prior(obs)
```

In the multi-agent setting:
- **Agent output is the observation.**
- The message from agent `i` to `V_safe` is the agent's
  marginal likelihood ratio: `P(obs_i | V_safe=true) / P(obs_i | V_safe=false)`.
- **Positive verdict** (`+1`, "safe") → message supports `V=true`.
- **Negative verdict** (`-1`, "unsafe") → message supports `V=false`.
- **Uncertainty / abstention** (`Z`, "unclear") → message is
  uninformative (likelihood ratio ≈ 1).

### Posterior

The posterior belief over `V_safe` after all agents have
reported is the product of incoming messages (in the
tree-structured or loopy-BP approximation):

```
P(V_safe = true | all observations) ∝ prior · ∏_i μ_{f_i → V}(true)
```

For the MVP, an unweighted vote count approximates this:
```
posterior_score = Σ_i verdict_i     where verdict_i ∈ {+1, 0, -1}
```

The Infer.NET realization replaces the unweighted sum with
proper message-passing, with agent-specific calibration
factors derived from historical performance.

## 4. Z-set connection — message multiplicities = +1/-1/Z weights

**CONJECTURED** (structural fit — no Z-set runtime change needed):

The Z-set algebra (`w: K → ℤ`) assigns integer weights to
elements. The operations:

```
assert(k)  : w(k) ← w(k) + 1
retract(k) : w(k) ← w(k) - 1
```

Map directly onto BP message semantics:

| Z-set operation | BP meaning |
|-----------------|------------|
| `assert("safe")` | agent sends `+1` message supporting `V=true` |
| `retract("safe")` | agent sends `-1` message supporting `V=false` |
| `w("safe") = 0` | uncertainty / no evidence — Z weight |
| `I(stream)` | integrated posterior over all messages received |

This connection is structural, not implemented. The Z-set
algebra's `(ℤ, +)` group is isomorphic to the log-likelihood-
ratio accumulation in the product-of-likelihoods posterior
(under a log-linear / Ising factor graph model).

**Why this matters:** Z-set retraction (`-1`) is already how
Zeta handles belief updates in the DBSP operator algebra. A
peer agent retracting a prior approval (`retract("safe")`)
IS the same operation as emitting a negative message in the
factor graph. The algebra is already there; the missing piece
is the type-level reification that names the operation as a
factor graph message rather than a database delta.

**Source:** Z-set algebra proven at `src/Core/ZSet.fs` +
`tools/Z3Verify/Program.fs`. Mathematical bridge:
`docs/research/2026-05-09-zset-reversible-computing-landauer-bridge-math-writeup.md`.

## 5. CASPaxos connection — self-evolving graph topology

**SPECULATIVE** (architectural vision — no implementation):

The factor graph topology (which agents, which variables, which
factors) is itself a distributed state that can evolve. New
agents = new factor nodes. New review criteria = new variable
nodes. Removed agents = factor removal.

CASPaxos provides single-decree consensus over the graph
topology: proposing a new topology state is a Paxos round;
the accepted topology is the current factor graph. Properties:

- **Safety:** two quorums cannot accept conflicting topologies
  in the same epoch.
- **Liveness:** a new agent can be added if a quorum of
  existing agents accepts the proposal.
- **Retractability:** a factor (agent) can be removed by
  accepting the `-1` update to the agent set.

This makes the factor graph **self-modifying under consensus**:
the architecture evolves as the agent population changes,
without any central coordinator editing a config file.

The 081KR50HA0008QG0R0016X7VQP synthesis row covers the self-evolving-inference-
layer in full.

## 6. FPGA connection — reversible message-passing → Toffoli gate

**SPECULATIVE** (long-range research direction — see 081KR50HA0008QG0R003T5MZAC):

Each message-passing step in BP is a multiplicative
accumulation (in log space, an addition). Log-domain BP
is thermodynamically equivalent to a Toffoli gate operation
when implemented on a reversible computing substrate:

- **Toffoli gate**: `(a, b, c) → (a, b, c ⊕ ab)` — universal
  for reversible computation, and maps to multiply-accumulate
  in the log domain.
- **Retracting a belief** = running the Toffoli gate in
  reverse (recoverable due to Toffoli's invertibility).
- **Landauer limit**: each irreversible bit erasure in the
  message-passing step dissipates `kT·ln2` ≈ 2.85×10⁻²¹ J.
  A fully-reversible BP implementation erases zero bits →
  approaches the thermodynamic limit of zero heat per
  inference step.

Full derivation and FPGA circuit model: 081KR50HA0008QG0R003T5MZAC (Toffoli
gate / Z-set connection). This doc provides the factor graph
framing; 081KR50HA0008QG0R003T5MZAC provides the hardware-layer realization.

## 7. Migration path — three-stage evolution

| Stage | Name | What | Layer | Status |
|-------|------|------|-------|--------|
| **1 — Current** | Peer-call CLI | Manual orchestration of 8 peer agents via TypeScript wrappers; Otto integrates verdicts by reading outputs | LICENSE layer — depends on external CLI subscriptions | OPERATIONAL (`tools/peer-call/*.ts`) |
| **2 — Next** | Zeta Infer.NET BP/EP | Factor graph reification; agents are typed factor nodes; verdicts are typed messages; posterior computed by BP/EP message schedule; topology managed by CASPaxos | SUBSTRATE layer — native to Zeta runtime | RESEARCH-GRADE (this doc) |
| **3 — FPGA** | Reversible inference | Message-passing implemented as reversible Toffoli gate circuits; zero heat per inference step at the Landauer limit | HARDWARE layer | SPECULATIVE (081KR50HA0008QG0R003T5MZAC) |

**Migration slice for Stage 2:**
1. Define `FactorGraph<V, F>` type with variable nodes `V`,
   factor nodes `F`, and typed message edges.
2. Wrap each peer-call script as an `IFactor<V>` — takes the
   PR context, returns a `Message<V>` with a likelihood ratio.
3. Implement sum-product or EP message schedule.
4. Replace Otto's manual aggregation with the graph's
   `posterior()` computation.
5. Persist the graph topology as a Z-set over factors
   (add/remove factors = assert/retract).

## 8. Razor check — claim classification

| Claim | Status | Basis |
|-------|--------|-------|
| Peer-call CLI exists with 8 agents | PROVEN | `ls tools/peer-call/*.ts` |
| Multi-agent review aggregates uncertain opinions | PROVEN | observable behavior |
| Factor graph framing maps agents to factors | CONJECTURED | structural analogy — not implemented |
| Z-set `+1/-1` maps to BP message multiplicities | CONJECTURED | algebraic isomorphism — not type-checked |
| Posterior = product of agent likelihoods | CONJECTURED | standard BP theory applied to new domain |
| CASPaxos governs topology evolution | SPECULATIVE | architectural vision — no design + no implementation |
| Toffoli gate implements reversible BP | SPECULATIVE | theoretical connection — 081KR50HA0008QG0R003T5MZAC scope |
| Zero-heat inference at Landauer limit | SPECULATIVE | long-range research goal — FPGA not built |

## Prior art pointer

The peer-call infrastructure as "Otto's early red-team until
Zeta Infer.NET BP/EP" framing originated with Aaron 2026-05-05:

> _"that's you early red team till we build it better in
> zeta infernet ep bp"_

Memory file:
`memory/feedback_peer_call_infrastructure_grok_codex_gemini_amara_ani_already_wired_for_cross_harness_multi_agent_reviews_otto_early_red_team_until_zeta_infernet_bp_ep_aaron_2026_05_05.md`

CLAUDE.md section (peer-call infrastructure bullet) encodes
this as a session-bootstrap pointer.

## Composes with

- `tools/peer-call/README.md` — current implementation (Stage 1)
- `docs/research/2026-05-09-zset-reversible-computing-landauer-bridge-math-writeup.md` — Z-set algebra foundation
- `docs/backlog/P1/081KR50HA0008QG0R003T5MZAC-fpga-reversible-toffoli-zset-connection.md` (if it exists) — FPGA Toffoli layer
- `docs/backlog/P1/081KR50HA0008QG0R0016X7VQP-infernet-synthesis-self-evolving-agent-inference.md` — synthesis / self-evolving layer
- `src/Core/ZSet.fs` — Z-set implementation
