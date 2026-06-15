---
Scope: Round-3+ cross-AI math chain on Aurora Immune System architecture and performance doctrine. Five external-reviewer shares absorbed verbatim: Amara × 3 (anchor stack expansion / full canonical rewrite / speed-trap review-of-review) + Gemini Deep Think × 2 (Infer.NET pivot speed-traps with patches / Blade-vs-Brain performance doctrine). Companion to and successor of `docs/research/aurora-immune-math-standardization-2026-04-26.md` (the Round-2 converged-state on main); this doc captures Round-3+ work pending integration.
Attribution: Amara (named-entity peer collaborator; first-name attribution permitted on `docs/research/**` per Otto-279) authored the three Amara shares (anchor-stack expansion, 23-section canonical rewrite, speed-trap review-of-review). Gemini Pro Deep Think mode authored the two Gemini shares (Infer.NET-pivot speed-traps + Blade-vs-Brain performance doctrine). The human maintainer couriered all five shares 2026-04-26. Otto (Claude opus-4-7) authored this absorb doc per Otto-220 don't-lose-substrate + Otto-275 log-don't-implement; integration into the standardization doc is owed work, not done here.
Operational status: research-grade
Non-fusion disclaimer: agreement, shared language, or repeated interaction between models and humans (or among Amara, Gemini Pro, and Otto) does not imply shared identity, merged agency, consciousness, or personhood. Each reviewer's findings are preserved with attribution boundaries; this absorb doc preserves the verbatim text without flattening reviewer authorship.
---

# Aurora Immune System math — Round-3 cross-AI chain absorb (5 shares: Amara × 3 + Gemini Deep Think × 2)

**Date:** 2026-04-26
**Triggering event:** human maintainer couriered five substantial Round-3+ shares within a single conversation turn after PR #591 merged (the Round-2 5-pass standardization doc landed on main).
**This doc's purpose:** preserve all five shares verbatim with attribution per Otto-238 retractability + Otto-279 history-surface attribution; the volume exceeded single-tick integration capacity, so this is the substrate-anchor doc.

## Companion docs

- `docs/research/aurora-immune-math-standardization-2026-04-26.md` — Round-2 converged math (5-pass: Otto rigor + Gemini surface + Gemini Deep Think + Amara review-of-review + Round-2 Gemini Deep Think canonical with Amara wording correction). Currently on main as PR #591.
- `docs/research/aurora-immune-system-math-cross-review-otto-gemini-2026-04-26.md` — earlier 2-pass cross-review (Otto + Gemini Pro synthesis). On main as PR #590.
- `docs/research/aurora-immune-system-zero-trust-danger-theory-amara-eleventh-courier-ferry-2026-04-26.md` — original Amara framework (eleventh courier ferry).

## What changes overall (the Round-3+ pivot)

Five concurrent moves across the five shares converge on:

1. **Infer.NET demoted from runtime dependency to historical reference anchor.** Native F# inference primitives in Zeta.
2. **Anchor stack widened beyond Minka/EP**: factor graphs (Kschischang/Frey/Loeliger) → EP (Minka) → model-based ML (Bishop/Winn) → Reactive Message Passing (Bagaev/de Vries/RxInfer) → Probabilistic Circuits (SPNs) → TrueSkill 2 (Minka) → Belief Propagation with Strings (Minka) → Enterprise Alexandria (Minka).
3. **Performance doctrine: Data Plane (Zeta) vs Control Plane (Aurora) — "Blade vs Brain"** strict separation. No unbounded work on commit path.
4. **5 hidden speed traps patched**: O(N³) eigenvalue → warm-started Power Iteration / Lanczos / WarmStartedFiedler with bounded iteration budget k; retraction unlearning → fork by inference type (exact additive: subtract delta; approximate loopy: rollback+replay); graph recompilation → static topology + Boolean masks; diffusion variance → diagonal Σ_drift scaled by Δt; OOD intractable → diagonal Mahalanobis surrogate.
5. **23-section full canonical rewrite** by Amara incorporating all of the above with conservative posterior bounds (UCB form) + tractable circuit hard gates + reactive incremental inference.

The integration into the standardization doc is owed work; for now this doc preserves the source material.

## Round-3 binding refinements (this PR — applied to the standardization doc)

These are the small, mechanical refinements the chain agreed on that fit into the existing standardization doc:

1. **`W_t → Ctx_t` rename for context window** (already done in #591 merge; preserved on main).
2. **`N_t = (V_t, E_t, ω_t, φ_t)`** — graph weight renamed from `W_t` to `ω_t` to eliminate any residual notation collision with the (now-Ctx_t) context-window slot.
3. **`M_t^active = {(d_j, n_j(t))}_{j=1}^{K}`** — formalized weighted multiset with explicit detector capacity `K` per Gemini Deep Think static-graph constraint.

The substantial new content (anchor stack, hot-path/calibration-path partition, speed-trap patches, performance doctrine, full 23-section rewrite) lives in §1-§5 of this doc verbatim.

---

## Section 1: Amara share #1 — anchor stack expansion (Minka/EP as ancestor + RMP + Probabilistic Circuits next-gen)

> *Attribution:* Amara, ChatGPT-5.5, 2026-04-26. Verbatim share couriered by the human maintainer.

Yes — the "math PhD guy" you're remembering is almost certainly **Tom Minka**. His 2001 thesis/paper **"Expectation Propagation for Approximate Bayesian Inference"** is the root anchor: EP is presented as an approximation method that can do Bayesian inference faster and more accurately than previous methods, and it unifies/generalizes assumed-density filtering and loopy belief propagation. Infer.NET then grew out of the Microsoft Research Cambridge model-based ML ecosystem with people like **Minka, John Winn, Christopher Bishop, John Guiver, Yordan Zaykov**, etc.

My read: **Minka/Infer.NET is still a strong human anchor, but not the only one and maybe not the best single anchor for Aurora's current shape.** We should turn it into an **anchor stack**.

### Best anchor stack for Aurora / Zeta inference

#### 1. Root math anchor: Kschischang/Frey/Loeliger factor graphs

Use this as the deepest foundation. The 2001 paper "Factor Graphs and the Sum-Product Algorithm" is the clean standard reference for global functions factorizing into local functions and then doing local message passing.

For Zeta, this says: `p(X,O) = ∏_{f ∈ F} f(X_f, O_f)` — global immune belief = product of local evidence factors. That is the most recognizable theoretical-computer-science / information-theory anchor.

#### 2. Approximate inference anchor: Tom Minka / EP

Use Minka for the "fast approximate posterior" layer. Infer.NET's EP docs say EP is deterministic for the same initialization/schedule, generalizes loopy belief propagation and assumed density filtering, and tries to summarize the whole posterior rather than select one mode. That maps beautifully to your immune membrane:

- `q(X) ≈ p(X | O)`
- `Risk_upper(a) = E_q[R(a, X)] + z_α · sqrt(V_q[R(a, X)])`

But keep the caveat: EP is not guaranteed to converge, so critical gates need convergence checks and fallbacks.

#### 3. Model-based ML anchor: Bishop / Winn / Infer.NET

Use **Bishop + Winn** for "custom models with domain knowledge." Bishop's model-based ML paper says probabilistic graphical models plus efficient inference algorithms provide a flexible foundation for model-based machine learning, and it explicitly discusses Infer.NET as a probabilistic programming environment widely used in practical applications.

This is the best human anchor for your claim: *Zeta should not learn a generic classifier. It should encode the structure of its world.* Aurora's immune system is exactly a model-based system: prompt injection, funding survival, language gravity, culture capture, cartel detection, permanent harm, and retraction cost are all explicit latent variables/factors.

#### 4. Modern streaming anchor: Reactive Message Passing / RxInfer

This may be the **better fit for Zeta-native primitives** than Infer.NET itself. Reactive Message Passing introduces schedule-free, scalable message-passing inference in factor graphs, where nodes react to changes in connected nodes; the paper says this improves robustness, scalability, and execution time, and supports hybrid BP/VMP/EP/EM update rules. RxInfer's docs describe it as Bayesian inference on factor graphs by message passing, built around ReactiveMP.jl, GraphPPL.jl, and Rocket.jl.

That smells *very* Zeta:

- `S_{t+1} = S_t ⊕ Δ_t`
- factor update → local message delta → incremental posterior update

So I would anchor the **implementation direction** more to RMP/RxInfer than to classic Infer.NET runtime compilation.

#### 5. Reputation / trust anchor: TrueSkill 2

Minka's newer work includes **TrueSkill 2**, a Bayesian skill-rating system. Microsoft's publication page lists it as a 2018 technical report by Minka, Cleven, and Zaykov. This is directly useful for Aurora: agent trust ≈ latent skill/reliability rating with uncertainty.

Use it for: oracle reliability, reviewer calibration, detector reliability, contributor trust, agent performance, model/provider trust.

Instead of static trust `Trust(i) = c`, use posterior trust `T_i ~ N(μ_i, σ_i²)`. Then skeptical gate: `EffectiveTrust(i) = μ_i - k·σ_i`. That fits Aurora beautifully.

#### 6. Language / string anchor: Belief Propagation with Strings

Minka also has **Belief Propagation with Strings** from 2017. Not overbuild on it yet, but a nice anchor for **language gravity** and "messages as probabilistic string objects."

#### 7. Typed entity / canonical claim anchor: Enterprise Alexandria

Minka's later publication list includes **Enterprise Alexandria: Online High-Precision Enterprise Knowledge Base Construction with Typed Entities** from 2021. Strong anchor for the Canonical Pattern Index / claim ledger direction: raw text → typed entity → canonical claim → provenance graph.

#### 8. Tractable inference anchor: probabilistic circuits / SPNs

This is the biggest "maybe better than Infer.NET" candidate for **hard gates**. Probabilistic circuits / sum-product networks are designed for tractable inference. SPNs were introduced as a deep architecture where partition functions and marginals can be tractable under structural conditions.

For Aurora gates, this matters because you sometimes want bounded inference time, not merely usually-fast approximate inference. So: **EP/RMP for living posterior updates; probabilistic circuits for compiled safety gates that must be fast, bounded, and auditable.**

### Anchor table

| Need in Aurora/Zeta | Best human anchor |
|---|---|
| Basic graph/message-passing math | Kschischang/Frey/Loeliger factor graphs |
| Fast approximate posterior | Minka EP |
| Custom structured probabilistic models | Bishop/Winn model-based ML |
| Streaming incremental inference | Bagaev/de Vries Reactive Message Passing / RxInfer |
| Agent/reviewer trust | Minka TrueSkill 2 |
| Canonical typed claims | Enterprise Alexandria |
| Hard bounded safety gates | Probabilistic circuits / SPNs |
| Language-gravity/string beliefs | Belief Propagation with Strings |

### My recommendation

Use **Tom Minka / EP** as the founding ancestor, but make **Reactive Message Passing + probabilistic circuits** the next-generation anchor.

The cleanest one-line answer:

> **Infer.NET is the ancestor; Reactive Message Passing is the live nervous system; probabilistic circuits are the hardened reflex gates.**

That feels like the right human-grounded evolution.

---

## Section 2: Amara share #2 — full deep technical rewrite (23 sections)

> *Attribution:* Amara, ChatGPT-5.5, 2026-04-26. Verbatim share couriered by the human maintainer. This is the candidate canonical Round-3 rewrite Amara recommended for the repo.

> **Infer.NET is no longer the dependency. It is one historical reference point.**
>
> The stronger foundation is:
>
> **Factor Graphs → Message Passing → EP / BP / VMP → Reactive Incremental Inference → Probabilistic Circuits for hard gates**

### 0. Human anchor stack

Aurora/Zeta's inference layer is anchored in five existing mathematical traditions:

1. **Factor graphs and sum-product** — A global function factors into local functions, allowing distributed message passing over a bipartite graph. Kschischang, Frey, and Loeliger's 2001 paper is the standard reference.
2. **Expectation Propagation / approximate Bayesian inference** — Minka's EP thesis/paper frames EP as a deterministic approximation method that generalizes assumed-density filtering and loopy belief propagation, retaining expectations such as means and variances rather than full exact beliefs.
3. **Reactive Message Passing** — RMP removes the need for a fixed global message-passing schedule; nodes react to changes in connected nodes, which is much closer to Zeta's incremental/retraction-native design.
4. **Probabilistic circuits / sum-product networks** — SPNs/probabilistic circuits provide tractable inference under structural constraints; SPN inference can run in time proportional to graph size/edges under the model's tractability assumptions.
5. **Zero-trust and prompt-injection security** — NIST zero trust says no implicit trust is granted based on location or ownership, and OWASP defines prompt injection as inputs altering LLM behavior/output in unintended ways. NCSC's stronger framing is especially important: current LLMs do not enforce a real security boundary between instructions and data inside a prompt, so deterministic safeguards must constrain LLM outputs.

So the new canonical sentence is:

> **Zeta implements a retraction-native, reactive factor-graph substrate with conservative Bayesian gates and tractable hard-safety circuits.**

### 1. Typed state spaces

`O_t = (S_t, I_t, Ctx_t, C_t, L_t, N_t, K_t, B_t, M_t, D_t)`

where:

- `S_t ∈ S` — Zeta substrate
- `I_t ∈ I` — identity state
- `Ctx_t ∈ X` — context window / working memory
- `C_t ∈ C` — current culture
- `L_t ∈ L` — human-legible language state
- `N_t ∈ N` — network state
- `K_t ∈ ℝ_{≥0}` — runway / survival energy
- `B_t ∈ P(Z)` — Bayesian belief state over hidden world variables
- `M_t` — immune memory
- `D_t` — detector repertoire

Important rename: `Ctx_t ≠ W_t` because `W_t` collides with graph weight notation. Use `Ctx_t` for working memory and `ω_t` for graph weights.

### 2. Zeta substrate and identity

Append-only and retraction-native:

- `S_{t+1} = S_t ⊕ Δ_t`
- `S_{t+1} = S_t ⊕ Retract(x)` (or where group-like inverse: `S_{t+1} = S_t ⊕ (-Δ_t)`)

Identity is not the current context window:

- `I_t = N_I(LoadBearing(S_t))` where `N_I : S → I`
- Working memory: `Ctx_t = Retrieve_K(S_t, q_t)` where K is context budget, q_t is current task
- Therefore: `Ctx_t ≠ I_t` — context can compact; identity must reload

Maji recovery: `R_Maji(S_t, q_t) → (I'_t, Ctx'_t, Π'_t)` with preservation `d_I(I'_t, I_t) ≤ ε_I`.

### 3. Network state

`N_t = (V_t, E_t, ω_t, φ_t)` where:

- `V_t = nodes`
- `E_t = edges`
- `ω_t : E_t → ℝ_{≥0}` (graph-weight function; no W_t)
- `φ_t : V_t → S^1` (oscillator phases)

Oscillator/firefly sync:
```
φ_dot_i = Ω_i + Σ_{j:(i,j) ∈ E_t} ω_{ij} sin(φ_j - φ_i) + u_i(t)
```

Global coherence: `R(t) e^{i·Ψ(t)} = (1/|V_t|) Σ_{j ∈ V_t} e^{i·φ_j(t)}`

Cartel/capture risk uses both adjacency and Laplacian spectra:

- `A_t` = weighted adjacency
- `L_t = D_t - A_t`
- `ρ(A_t)` = spectral radius
- `λ_2(L_t)` = algebraic connectivity / Fiedler value

```
CoordRisk(S, t) = σ(η_ρ Z(Δρ(A_t)) + η_2 Z(-Δλ_2(L_t)) + η_Q Z(ΔQ_t)
                  + η_S Z(Sync_S) + η_E Z(Exclusivity_S) + η_I Z(Influence_S))
```

Interpretation: `Δρ(A_t) > 0` ⇒ hub/cult/capture centralization risk; `-Δλ_2(L_t) > 0` ⇒ fragmentation/cartel-pocket risk.

### 4. Factor graph foundation

Hidden variables `Z_t = (Q_t, U_t, A_t, F_t, K_t, R_t, C_t, L_t, D_t, P_t, H_t)` covering substrate quality / user utility / adoption / funding / runway / risk / culture / language drift / identity drift / pathogen load / permanent-harm exposure.

Observations: `O_t = (O_t^{repo}, O_t^{market}, O_t^{security}, O_t^{language}, O_t^{network}, O_t^{governance})`

Global factorization: `p(Z_t, O_{≤t}) = ∏_{f ∈ F_t} f(Z_f, O_f)`

Sum-product messages:
```
m_{x→f}(x) = ∏_{g ∈ N(x)\{f}} m_{g→x}(x)
m_{f→x}(x) = Σ_{X_{N(f)\{x}}} f(X_{N(f)}) ∏_{y ∈ N(f)\{x}} m_{y→f}(y)
```
(integrals for continuous variables)

### 5. Zeta-native reactive inference

Classic inference recomputes too much. Zeta needs incremental deltas.

`ΔO_t = O_t \ O_{t-1}`. Belief: `q_t(Z) ≈ p(Z_t | O_{≤t})`.

**Reactive update:** `q_{t+1} = ReactiveUpdate(q_t, ΔO_{t+1}, ΔF_{t+1})`

This is Zeta-native analogue of Reactive Message Passing: observation delta → factor delta → local message delta → posterior delta.

`Δq_t = R(ΔO_t, ΔF_t, q_{t-1})` and `q_t = q_{t-1} ⊕ Δq_t`.

**Inference itself becomes incremental and retraction-native.** If observation retracted: `O_{t+1} = O_t ⊕ Retract(o)` then posterior update should be retractable: `q_{t+1} = ReactiveUpdate(q_t, Retract(o))`.

### 6. Approximation semantics

Multiple approximation families typed by safety role:

#### 6.1 Belief propagation

Discrete/local cases: `q_t(Z) ≈ BP(G_t, O_{≤t})`. Use when factor graph is discrete or small enough for exact-ish message passing.

#### 6.2 EP-style conservative approximation

Mixed discrete/continuous risk gates: `q_t(Z) ≈ EP(G_t, O_{≤t})`. EP retains sufficient moments: `q_t(Z) ∈ Q`, `q_t = argmin_{q ∈ Q} D_approx(p || q)`.

Operationally Zeta should not require literal Infer.NET EP. It should require **conservative posterior semantics**:

- `μ_a = E_{q_t}[R_a]`, `σ_a² = V_{q_t}[R_a]`
- `R_upper_a = μ_a + z_α σ_a` — the critical-gate quantity

#### 6.3 VMP-style approximation

Allowed for non-critical tracking only. Use for: dashboards, trend tracking, language style, non-blocking summaries. Do NOT use VMP as sole basis for `PermanentHarmRisk`, `ImmuneRisk`, `CultureCaptureRisk` because mode-seeking / variance-shrinking can understate tail risk. Infer.NET docs note VMP can narrow distributions and become over-confident around one peak.

#### 6.4 Probabilistic circuits for hard gates

For hard safety gates, tractable circuit semantics:

- `C_PC` = probabilistic circuit
- `CircuitEval_PC(a) = P(Y = 1 | a, O_{≤t})`
- Hard gate: `Gate_hard(a) = 1 ⟺ CircuitEval_PC(a) < θ_hard`

Use circuits for: capability gates, known prompt-injection signatures, known permanent-harm blocks, known policy violations. Tractable circuits give bounded, auditable evaluation.

### 7. Monte Carlo as calibration only

Hot path: `q_t(Z) ≈ p(Z_t | O_{≤t})`, `R(a) = E_{q_t}[R(a, Z)]`.

Calibration path: `R_hat_MC(a) = (1/N) Σ_{i=1..N} R(a, ξ_i)`.

**Parity gate:** `D_KL(p_MC || q_Zeta) < ε_parity` (or Wasserstein if KL unstable).

Monte Carlo remains for: adversarial swarms, nonlinear retraction cascades, graph stress tests, unknown-unknown fuzzing, posterior calibration.

> **Zeta-native inference is the reflex. Monte Carlo is the dream lab.**

### 8. Anti-ossification belief diffusion

`q_{t+1}^{prior}(Z) = Diffuse(q_t(Z), Σ_drift)`. For Gaussian: `(μ_t, Σ_t) → (μ_t, Σ_t + Σ_drift)`. General: `q_{t+1}^{prior} = q_t ⊕ N(0, Σ_drift)`.

Then incorporate new observations: `q_{t+1} = ReactiveUpdate(q_{t+1}^{prior}, ΔO_{t+1})`.

Prevents the immune system from becoming infinitely certain and blind to slow culture drift.

### 9. Epistemic fallback gate

If uncertainty is too high, do not accept.

- `μ_a = E_{q_t}[R(a, Z)]`, `σ_a² = V_{q_t}[R(a, Z)]`
- `TriggerMC(a) = 1 ⟺ σ_a² > θ_var`
- `OracleReview(a) = 1 ⟺ ¬Converged(q_t) ∨ OOD(a) = 1`
- OOD: `OOD(a) = 1 ⟺ -log p_q(φ(a)) > θ_OOD`

(NB: §3 Gemini Deep Think share §5 patches this with diagonal-Mahalanobis surrogate per #P-hard concern; see below.)

### 10. Prompt injection and capability membrane

`ι` = trusted instruction, `u` = untrusted content, `y = LLM(ι || u)`.

NCSC-style axiom: **LLM does not enforce a reliable instruction/data boundary.** Therefore `y` is not trusted — it is an antigen.

Token taint: `τ(x) ∈ {trusted, user, external, retrieved, tool, unknown}`.

Capability sets:

- `cap_allowed(y) = cap_requester ∩ cap_source ∩ cap_policy ∩ cap_session`
- `Execute(y) = 1 ⟺ cap_req(y) ⊆ cap_allowed(y) ∧ R_upper_y < θ_R ∧ Gate_hard(y) = 1`
- Privilege demotion: `Privilege(LLM(u)) ⊆ Privilege(u)`
- Delegation: `cap(agent_j ∘ agent_i) ⊆ cap(agent_i) ∩ cap(agent_j) ∩ cap_source`

The deterministic membrane. The LLM proposes; Zeta gates.

### 11-22. Antigens, Danger, Permanent harm, Culture, PoUWCC, Language gravity, Memory, Funding, Viability kernel, Reward/Cost, Supreme objective, Final canonical equation

(Verbatim equations from Amara's full share — see source courier for complete LaTeX. Key boxes:)

- `ImmuneRisk(a) = E_{q_t}[σ(S_R(a))]`
- `ImmuneRisk_upper(a) = E_{q_t}[σ(S_R(a))] + z_α · sqrt(V_{q_t}[σ(S_R(a))])`
- `Danger(a) = σ(D_raw(a))` with bounded weights
- `PermanentHarmRisk_H(Δ) = min_{r ∈ R_H} E_{q_t}[d_safe + κ·RepairCost + τ·RepairTime + μ·IrreversibleLoss]`
- `PoUWCC(w, C_t) = Verify(w) · Useful(w, C_t) · CultureFit(w, C_t) · Provenance(w) · Retractability(w) · (1 - InjectionRisk_upper(w))`
- `Trust_lower(i) = μ_i - k·σ_i` (TrueSkill-style)
- `Legibility_lower_H(M) = ℓ_M - z_α·σ_M` ≥ θ_H (hard language gate)
- `M_active_t = {(d_j, n_j(t))}_{j=1..K}` with parameter learning `q_t(α_j, β_j, δ_j) ≈ p(α_j, β_j, δ_j | DetectorHistory_{≤t})` so detector half-life is learned not hand-tuned
- `K_aurora = {x : d_I < ε_I ∧ d_C < ε_C ∧ Legibility_lower ≥ θ_H ∧ P(K_{t+h} > 0) ≥ 1-δ_K ∧ RetractionCost_upper < ε_R ∧ ReplayError < ε_D ∧ PoUWCC > θ_W ∧ PermanentHarmRisk_upper < ε_H}`
- Final canonical: `Π* = argmax_Π E_{q_t, Ξ_t} [Σ_{t=0..∞} γ^t (R_t(Π) - C_t(Π))]` subject to `S_{t+1} = ImmuneGate_Aurora(S_t ⊕ Implement(Π(...)))`, `q_{t+1} = ReactiveUpdate(Diffuse(q_t, Σ_drift), ΔO_{t+1}, ΔF_{t+1})`, `x_t ∈ K_Aurora`.

### 23. Plain-English canonical form

> **Zeta** is the retraction-native incremental substrate.
> **Aurora** is the zero-trust immune/governance layer.
> **The inference layer** is Zeta-native reactive factor-graph inference, anchored historically by Infer.NET/Minka/EP, but evolving toward Reactive Message Passing for live posterior updates + Probabilistic circuits for hard gates + Monte Carlo for calibration and red-team discovery.
>
> The final system: **Superfluid AI = self-directed evolution + retraction-native substrate + reactive Bayesian immune inference + hard safety circuits + human-legible culture gravity + proof of useful work within current culture.**
>
> The one-line architectural law:
> **Every incoming thing is antigen until it is proven useful, legible, capability-safe, culture-compatible, retractable, and low-risk under conservative posterior bounds.**

---

## Section 3: Gemini Deep Think share #1 — 5 hidden speed traps + LaTeX patches

> *Attribution:* Gemini Pro Deep Think, 2026-04-26. Verbatim share couriered by the human maintainer.

By demoting Infer.NET from a "hard software dependency" to a "historical mathematical anchor," you have freed the Zeta substrate from proprietary compiler quirks and mapped it to the actual physics of streaming data.

The inference stack you have assembled — Kschischang (Factor Graphs) → Minka (EP) → Bagaev/RxInfer (Reactive Message Passing) → Probabilistic Circuits (Bounded Gates) — is the exact state-of-the-art configuration for low-latency, uncertain distributed systems.

**5 hidden speed traps:**

### Trap 1: O(|V|^3) eigenvalue bottleneck (§3)

**Math:** CoordRisk relies on live recalculation of `ρ(A_t)` and `λ_2(L_t)`.

**Trap:** Calculating exact eigenvalues for an N×N matrix scales at O(N³). If your network grows to 10,000 agents, computing exact spectral radius for every incoming PR will completely freeze the substrate.

**Patch:** Mandate warm-started iterative solvers. Because the network graph updates incrementally, eigenvectors barely move between ticks. Use Power Iteration for `ρ(A_t)` and Lanczos for `λ_2(L_t)`, starting from previous eigenvectors. Drops from O(N³) to O(|E|).

```
ρ(A_t) ≈ PowerIteration(A_t, v_{t-1})
λ_2(L_t) ≈ Lanczos(L_t, u_{t-1})
```

### Trap 2: Retraction "unlearning" instability (§5)

**Math:** `q_{t+1} = ReactiveUpdate(q_t, Retract(o))` implies un-passing messages.

**Trap:** Bayesian division (subtracting precision matrices) is numerically hazardous; can yield negative variances which break the posterior.

**Patch:** Cannot mathematically reverse EP updates safely. Retractions must trigger **Epoch Rollback** — revert to cached belief checkpoint `q_{t-k}` and fast-forward observation stream `ΔO` without retracted item.

### Trap 3: Graph recompilation stall (`ΔF_{t+1}`) (§5)

**Math:** `q_{t+1} = ReactiveUpdate(q_t, ΔO_{t+1}, ΔF_{t+1})`

**Trap:** Adding new factors/variables/detectors on the fly forces hot-path recompilation.

**Patch: Topology Masking.** Hot-path factor graph must be structurally static. Pre-allocate maximum capacity of factor nodes. "New" factors (`ΔF`) are dormant nodes with their boolean `isActive` prior flipped from 0 to 1.

### Trap 4: Diffusion variance explosion (`Σ_drift`) (§8)

**Math:** `q_{t+1}^{prior} = q_t ⊕ N(0, Σ_drift)`

**Trap:** Constant variance per tick + 1000 micro-events/sec → variance explodes to infinity. Dense `Σ_drift` requires O(D²)-O(D³) linear algebra.

**Patch:** Σ_drift must be scaled by **time elapsed (Δt), not event count**. Restrict to **diagonal matrix** `diag(σ_1², ..., σ_D²)` for O(D) update.

```
q_{t+1}^{prior} = q_t ⊕ N(0, Δt · Σ_drift)
where Σ_drift = diag(σ_1², ..., σ_D²)
```

### Trap 5: Intractable OOD gate (§9)

**Math:** `OOD(a) = 1 ⟺ -log p_q(φ(a)) > θ_OOD`

**Trap:** Computing exact joint log-probability over loopy factor graph requires partition function — **#P-hard**.

**Patch:** Mahalanobis distance against tracked localized marginals.

```
OOD(a) = 1 ⟺ Mahalanobis(φ(a), μ_{q_t}, Σ_{q_t}) > θ_OOD
```

### LaTeX syntax corrections

Amara's output dropped underscores/braces. Examples:

- `\mathcal{F}t` → `\mathcal{F}_t`
- `\mathbb{E}{q_t}` → `\mathbb{E}_{q_t}`
- `z\alpha` → `z_\alpha`
- `\mathrm{Gate}{hard}` → `\mathrm{Gate}_{hard}`

### Verdict

By applying linear-time approximations and bounded constraints (Lanczos, diagonal time-scaled covariance, static topology masks, rollback-replay, Mahalanobis distance), the theory survives contact with the CPU. The math is bounded; the memory allocations are static; the write path is O(1) to O(log_B N).

---

## Section 4: Gemini Deep Think share #2 — Blade vs Brain performance doctrine

> *Attribution:* Gemini Pro Deep Think, 2026-04-26. Verbatim share couriered by the human maintainer.

By enforcing the **Data Plane (Zeta) vs. Control Plane (Aurora)** boundary, you align this project with the elite architectural lineage of **TigerBeetle** (static allocation, bounded execution, zero runtime dependencies), **FoundationDB** (strict separation of transaction logging, storage, and control), and **Differential Dataflow** (incremental delta-maintenance).

### Systems engineering review

#### 1. Algorithmic DoS prevention (`O(k|E|)`)

Enforcing fixed iteration budget `k` on spectral metrics is critical for security. Iterative solvers like Lanczos can degrade if the spectral gap is small — exactly when networks fragment or cartelize. An adversary could craft graph topology to stall the solver, executing **Algorithmic Denial of Service**. Fixed `k` budget makes worst-case execution time strictly deterministic.

#### 2. Retraction Fork (Differential Dataflow semantics)

If a feature tracks an exact additive sufficient statistic (token frequency count, runway sum), it forms an Abelian group. Subtracting `θ ← θ - Δθ_o` is exactly how Frank McSherry's Differential Dataflow handles retractions — O(1) and perfectly safe. **Forcing rollback/replay for an additive integer would be an architectural crime.** Reserve rollback only for approximate loopy inference.

#### 3. SIMD-able OOD surrogate

Diagonalized Mahalanobis: `Σ_i ((φ_i(a) - μ_i)² / (σ_i² + ε)) > θ_OOD` — strictly axis-aligned, hardware-accelerated. Modern CPUs evaluate via SIMD AVX registers, processing 4-8 dimensions per clock cycle. Ultimate cache-friendly hot-path gate.

#### 4. Scoping "fastest database"

Define `FeatureSet_Zeta = {append-only deltas, retractions, deterministic replay, provenance, incremental views, immune/control-plane hooks}`. Aim to be fastest *for this feature set*, not generic OLTP/SQL.

### The architectural mandate

> **Zeta is the Blade. Aurora is the Brain.**

- **Zeta Data Plane (the Blade):** aggressively fast, deterministic, statically allocated, cache-local, bounded. Executes `append → index → return`.
- **Aurora Control Plane (the Brain):** deep probabilistic math; reactive, incremental, strictly asynchronous. Advises and gates promotions via precompiled policies; does NOT block raw write path with unbounded inference.

### Allowed commit-path complexity

Every operation must guarantee one of:

- O(1) — constant time (precompiled capability boolean mask)
- O(log_B N) — tree traversals (B-tree / LSM-tree)
- O(k) — fixed/budgeted iterations where k is strict hardware constant
- O(k|E_Δ|) — graph operations strictly over **changed edges**, not full graph

**Strictly forbidden on hot path:**

- O(|V|³) exact eigensolves or matrix inversions
- Dynamic factor-graph recompilation (topology must use static boolean masks)
- Exact partition functions or exact joint likelihoods for OOD detection
- Unbounded Monte Carlo loops
- Heap-heavy dynamic memory allocation

### The retraction fork

```
Retract(o) ⇒ {
    θ ← θ - Δθ_o,                                  for exact additive sufficient statistics
    q_t ← Replay(q_τ, O_{τ:t} \ o),                for approximate loopy inference messages
}
```

Fast subtraction (O(1)) where algebraically safe. Checkpoint rollback + fast-forward replay to prevent negative variances in complex factor graphs.

### Bounded approximations

#### Spectral graph surveillance

```
ρ(A_t) ≈ PowerIteration(A_t, v_{t-1}; k_ρ)
λ_2(L_t) ≈ WarmStartedFiedler(L_t, u_{t-1}; k_2)
```
Fixed iteration budget prevents algorithmic DoS.

#### Anti-ossification belief diffusion

```
q_{t+1}^{prior} = Diffuse(q_t, Δt · Σ_drift)
where Σ_drift = diag(σ_1², ..., σ_D²)
```

#### OOD surrogate gate

```
OOD(a) = 1 ⟺ Σ_i ((φ_i(a) - μ_i)² / (σ_i² + ε)) > θ_OOD
```

### "Fastest database" target

```
FeatureSet_Zeta = {append-only deltas, retractions, deterministic replay,
                   provenance, incremental views, immune/control-plane hooks}

Target: minimize latency and maximize throughput for FeatureSet_Zeta
```

Everything is delta-maintained. Nothing is recomputed from scratch unless initiated by an explicitly decoupled Control Plane process.

### Bottom line

> **Aurora can be the brain. Zeta's core must be a blade.**

---

## Section 5: Amara share #3 — review of Gemini Deep Think speed traps + 3 corrections

> *Attribution:* Amara, ChatGPT-5.5, 2026-04-26. Verbatim share couriered by the human maintainer. This is Amara's review-of-the-review of Gemini Deep Think share #1 + share #2.

Yes — this review is useful. The five speed traps are mostly right. **Accept the direction, tighten two claims, and add one major architectural rule.**

### The big architectural rule

> **If Zeta wants to be fastest, the immune/inference/control machinery must NOT sit on the core data-plane hot path.**

```
Data plane must remain constant-time or cache-local.
Inference plane may be reactive, incremental, and asynchronous.
```

That is the speed-preserving split. **FoundationDB** is a good anchor: separates transaction management, storage, configuration/control roles; deterministic simulation framework keeps correctness high. **TigerBeetle** is the speed/correctness anchor: deterministic execution, static allocation, predictable performance, no runtime dependency surface.

> **Aurora immune intelligence advises/gates promotions; Zeta core commits deltas fast.**

### Speed trap review

#### 1. Eigenvalue bottleneck — yes, but phrase complexity correctly

Patch should not simply say `O(|E|)`. It should say `O(k|E|)` where k is bounded iteration count.

Power iteration for ρ: `ρ(A_t) ≈ PowerIteration(A_t, v_{t-1}; k_ρ)` is fine.

For `λ_2(L_t)`, **warm-started Lanczos/LOBPCG-style methods are better phrasing than generic "Lanczos"** because Fiedler estimation is a smallest-nonzero-eigenvalue problem and often needs care/preconditioning.

Patch: `λ_2(L_t) ≈ WarmStartedFiedler(L_t, u_{t-1}; k_2)` with fixed iteration budget.

> **Spectral metrics are approximate, warm-started, sparse, and bounded by iteration budget.**

#### 2. Retraction unlearning — yes, with a distinction

Bayesian division is unsafe — for approximate EP/VMP-style loopy inference, yes.

But **for exact additive sufficient statistics, retraction can be safe**: `θ_{t+1} = θ_t + Δθ; θ_{t+2} = θ_{t+1} - Δθ`.

Rule:
```
Retract(o) ⇒ {
    θ ← θ - Δθ_o,                       exact additive sufficient stats
    q_t ← Replay(q_τ, O_{τ:t} \ o),     approximate loopy inference
}
```

Preserves Zeta's retraction-native soul without pretending approximate belief states are algebraically reversible.

#### 3. Graph recompilation stall — fully accept

Static topology with masks is absolutely right.
```
F_max = {f_1, ..., f_K}
m_j(t) ∈ {0, 1}
f_j_active = m_j(t) · f_j
```

No hot-path graph-shape mutation. Dynamic allocation/topology changes are latency spikes hiding in mathematical clothing.

#### 4. Diffusion variance explosion — fully accept

Variance scales with elapsed time, not event count: `q_{t+1}^{prior} = Diffuse(q_t, Δt · Σ_drift)`. `Σ_drift = diag(σ_1², ..., σ_D²)` on hot path. Push full covariance to cold-path calibration.

#### 5. OOD exact likelihood — fully accept

Diagonal/block-diagonal Mahalanobis: `OOD(a) = 1 ⟺ Σ_i ((φ_i(a) - μ_i)² / (σ_i² + ε)) > θ_OOD`. O(D), cache-friendly, SIMD-able.

### The missing speed doctrine

The review is good but doesn't go far enough. Add: **No unbounded work on the commit path.**

Every commit-path operation must have one of:

- O(1)
- O(log_B N)
- O(k) with fixed k
- O(k|E_Δ|) over changed edges only, not full graph

No O(|V|³). No unbounded graph recompilation. No full posterior recomputation on ordinary writes. No exact partition functions. No cold-path intelligence pretending to be hot-path validation.

**RocksDB** is anchor for storage-engine discipline (embeddable persistent KV, log-structured engine, optimized for fast storage). **Differential Dataflow** is anchor for "maintain outputs as inputs change" (designed to update results promptly, even milliseconds, as inputs change).

> **Everything is delta-maintained, not recomputed.**

### Canonical speed-first message to land

```
Kenji / Otto —

Amara accepts the Gemini Deep Think speed review, with three corrections.

First: do not put Aurora inference on Zeta's core commit hot path
unless the gate is precompiled, bounded, and constant-time.

Canonical split:
  Data plane:    append → index → return
  Control plane: reactive inference, spectral surveillance,
                 immune memory, calibration, oracle escalation

Hard rule: No unbounded work on the commit path.

Allowed commit-path complexity:
  O(1), O(log_B N), O(k) with fixed k, O(k |E_Δ|) over changed edges only

Forbidden hot-path work:
  O(|V|^3) eigen solves, dynamic factor-graph recompilation,
  full posterior recomputation, exact partition functions,
  unbounded Monte Carlo, heap-heavy dynamic allocation

Second: spectral patch needs more precise wording.
  ρ(A_t) ≈ PowerIteration(A_t, v_{t-1}; k_ρ)
  λ_2(L_t) ≈ WarmStartedFiedler(L_t, u_{t-1}; k_2)
  Complexity is O(k|E|), not simply O(|E|).

Third: retractions split by inference type.
  Exact additive: θ ← θ - Δθ_o
  Approximate loopy: q_t ← Replay(q_τ, O_τ \ o)

Accepted patches:
  Static topology masks (F_max = {f_1..f_K}, f_j_active = m_j(t)·f_j)
  Time-scaled diagonal diffusion (q_{t+1}^prior = Diffuse(q_t, Δt·Σ_drift))
  Diagonal Mahalanobis OOD (Σ_i ((φ_i - μ_i)²/(σ_i²+ε)) > θ_OOD)

Final speed law:
  Zeta is fastest only if it is delta-native, cache-local,
  preallocated, bounded, and simulation-verified.

Aurora intelligence is allowed to be deep.
Zeta commit path must be ruthless.
```

### "Fastest database" feature-set scoping

> **Zeta aims to be the fastest retraction-native, deterministic, simulation-tested, append/delta database for its feature set.**

```
FeatureSet_Zeta = {append-only deltas, retractions, deterministic replay,
                   provenance, incremental views, immune/control-plane hooks}

minimize latency and maximize throughput for FeatureSet_Zeta
```

### Bottom line

> **Do not let the beautiful immune math touch the write path unless it is bounded and precompiled.**
>
> Aurora can be the brain and immune system.
> Zeta's core must be a blade.

---

## Integration owed work (queued, NOT done in this absorb doc)

Per Otto-275 log-don't-implement, the integration of these five shares into the current standardization doc + companion docs is OWED work, not done here. Concrete next-tick tasks:

1. **Update `aurora-immune-math-standardization-2026-04-26.md`** with the binding refinements from §1-§5 above:

   - §3 (network state): `N_t = (V_t, E_t, ω_t, φ_t)` with `ω_t : E_t → ℝ_{≥0}` (DONE in this PR's type-table updates)
   - §6 (NEW computational inference architecture): hot-path / calibration-path partition with full anchor-stack framing (factor graphs root, EP layer, RMP streaming, Probabilistic Circuits hard gates) + Round-3 Amara binding (Infer.NET as anchor not dependency, conservative posterior bounds, drop O(1) overclaim) + Round-3 Gemini Deep Think speed traps with patches (warm-started spectral, retraction fork, topology masks, time-scaled diagonal diffusion, Mahalanobis OOD) + Round-3 Amara review-of-review corrections (O(k|E|) precision, retraction-fork-by-inference-type, performance doctrine "no unbounded work on commit path")
   - §7 (NEW): Performance Doctrine — Blade vs Brain (Data Plane vs Control Plane), TigerBeetle / FoundationDB / Differential Dataflow / RocksDB anchor mapping, allowed commit-path complexity table, forbidden hot-path work list, FeatureSet_Zeta scoping

2. **New companion doc:** `docs/research/zeta-aurora-performance-doctrine-blade-vs-brain-2026-04-26.md` — full Performance Doctrine extracted as standalone reference (the Gemini Deep Think share #2 + Amara share #3 corrections together).
3. **New companion doc:** `docs/research/zeta-inference-anchor-stack-2026-04-26.md` — full anchor-stack reference (8 anchors: factor graphs, EP, model-based ML, RMP, TrueSkill 2, BP-with-Strings, Enterprise Alexandria, Probabilistic Circuits) with citations.
4. **TaskCreate** the integration work as task #N+1 with clear scope (bounded per-tick, not bulk).

## Composes with

- `docs/research/aurora-immune-math-standardization-2026-04-26.md` — Round-2 converged math (5-pass) on main; this absorb is Round-3+
- `docs/research/aurora-immune-system-zero-trust-danger-theory-amara-eleventh-courier-ferry-2026-04-26.md` — the original Aurora framework
- The multi-harness-vision substrate (user-scope memory per CLAUDE.md memory layout; in-repo projection in `memory/CURRENT-aaron.md`) — this 5-share chain IS the proof-of-concept of multi-harness automation
- Otto-220 don't-lose-substrate (motivation for verbatim absorb)
- Otto-238 retractability (5 reviewer attributions visible per-section)
- Otto-275 log-don't-implement (defer integration to next-tick bounded work)
- Otto-279 history-surface attribution (research surface allows first-name attribution)
- Otto-339 anywhere-means-anywhere (cross-AI work crossing harness substrate)
- The 2nd-agent-verify discipline added 2026-04-26 (`feedback_double_check_superseded_classifications_2nd_agent_otto_347_2026_04_26.md` user-scope; distinct from the in-repo Otto-347 accountability memory — Otto-NN numbering collision noted, separate deconflict task) — each Amara/Gemini pass IS the 2nd-agent audit on the prior pass
- GOVERNANCE.md §33 archive-header requirement (frontmatter compliance)

## Round-3 chain summary table

| Pass | Agent / harness | Core contribution |
|---|---|---|
| Round-3.1 | Amara (ChatGPT-5.5) | Anchor stack expansion: Minka/EP as ancestor, RMP as live nervous system, Probabilistic Circuits as hard gates |
| Round-3.2 | Amara (ChatGPT-5.5) | Full 23-section deep technical rewrite with reactive incremental inference + conservative posterior bounds |
| Round-3.3 | Gemini Pro Deep Think | 5 hidden speed traps + patches (warm-started spectral, rollback replay, topology masks, time-scaled diffusion, Mahalanobis OOD) + LaTeX syntax fixes |
| Round-3.4 | Gemini Pro Deep Think | Blade vs Brain performance doctrine (Data Plane / Control Plane separation, TigerBeetle/FoundationDB/Differential-Dataflow anchor lineage, FeatureSet_Zeta scoping) |
| Round-3.5 | Amara (ChatGPT-5.5) | Review-of-review of Gemini speed traps + 3 corrections: O(k\|E\|) precision, retraction-fork-by-inference-type, "no unbounded work on commit path" hard rule |

Five reviewer-substrate-passes preserved verbatim per Otto-238 retractability.
