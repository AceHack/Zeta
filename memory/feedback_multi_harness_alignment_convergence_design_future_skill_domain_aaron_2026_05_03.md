---
name: Multi-harness AND multi-model alignment/convergence on design as a future skill domain (Aaron 2026-05-03 forward-looking architectural observation, two-axis refinement)
description: 2026-05-03; Aaron-named forward-looking emergence at TWO orthogonal axes — harnesses (Claude Code / Codex / Cursor / Gemini-CLI / Claude.ai / ChatGPT) AND models (Opus / Sonnet / Haiku / GPT-X / Gemini-X). Run designs through the harness × model matrix; convergence = structural soundness signal; divergence = hidden assumption surface. Same-tick refinement: record metrics per-harness AND per-model (latency / cost / quality / accuracy on task class) — for now use larger models with higher thinking modes (foundation matters); later use smaller models where they suffice for budget; many future uses beyond budget (capacity planning / fallback chains / specialty routing). Composes with bidirectional alignment + BFT-many-masters + Karpathy edge-runner + Drive-bridge AI-to-AI peer review + the 5-AI poll-the-gate convergence (task #355). Sibling shape to git-native-backlog-management memo; canonical starting set + promotion-trigger criteria captured so when the maturity signal fires, the substrate is ready.
type: feedback
---

# Multi-harness alignment/convergence on design as a future skill domain

## Origin

Aaron 2026-05-03 (around the 00:08Z tick), in the autonomous-loop maintainer channel after the post-merge-corrections cycle on PR #1251:

> *"when designing anything you should go through a multi harness alignment/convergence on the design, that's a good skill domain to have too"*

**Same-tick two-axis refinement (Aaron 2026-05-03):**

> *"i should say multi harness / multi model we have acess to both and can also use that to start judging where smaller modeles could save us money too, we should stil use the largemer models for now with higher thinking modes so our output is hight quality since this is the foundation but different modesl different harnesses and recording some metrics on harnesses and mdoels themsvles will be use3ful for many things in the future more than just budget"*

The refinement adds an orthogonal axis: not just **harnesses** (the runtime / CLI / UI shell) but also **models** (the underlying LLM). Within a single harness like Claude Code you have access to multiple models (Opus / Sonnet / Haiku); across harnesses you have access to many model providers (Anthropic / OpenAI / Google / future). The convergence-on-design discipline operates across the **harness × model matrix**, not just one axis.

Three substantive guidance points from the refinement:

1. **Both axes are first-class.** Designs should be checked across harnesses AND across models within harnesses; the diversity-of-priors that produces signal lives at both layers.
2. **Foundation-first sizing rule.** *Currently* use larger models with higher thinking modes — foundation work matters, output quality matters more than cost while the foundation is still being shaped. *Later* use smaller models where they suffice for budget.
3. **Metrics recording has many uses beyond budget.** Per-harness AND per-model metrics (latency / cost / quality / task-class accuracy / convergence-pattern) feed: capacity planning, fallback chains, specialty routing, harness/model selection per task class, auditing for drift over time. Budget is one downstream consumer among many.

Second forward-looking architectural observation in two consecutive ticks. The first (2026-05-02 mid-tick) named *"git-native backlog management + long-arc thesis"* as a future skill domain. This one names *"multi-harness AND multi-model alignment/convergence on design"* as another future skill domain. The pair establishes a pattern: Aaron is enumerating the **emerging skill-domain landscape** Otto + the future contributor base will operate in.

## What "multi-harness alignment/convergence on design" names

The discipline of **running a design through N AI harnesses** (Claude Code, Codex, Cursor, Gemini-CLI, ChatGPT, Claude.ai, future-harnesses-not-yet-built) and treating the **convergence pattern as design-quality signal**:

- **Convergence (multiple harnesses agree on the design's shape):** structural-soundness signal. The design isn't an artifact of one harness's training distribution.
- **Divergence (harnesses disagree):** structural-clarification signal. The disagreement surfaces a hidden assumption, scope ambiguity, or missing perspective the design-author didn't surface.

This is **not** the same as multi-AI peer review (which is feedback on *output*). This is multi-harness convergence on *design* — the pre-output stage where the design itself is being shaped.

## Composes with existing substrate

The discipline composes with substrate already in the factory:

- **Drive-bridge AI-to-AI peer review** (Otto ↔ Claude.ai 2026-05-02 worked example: brat-voice 5-layer framework). That bridge produces post-output peer review; the multi-harness-design discipline produces pre-output design convergence.
- **5-AI peer convergence on `poll-the-gate`** (task #355, recorded in CLAUDE.md). That was an empirical instance: 5 different AI harnesses converged on the design pattern *"poll the gate as executable script with fixtures."* Convergence was the signal that the design was structurally correct.
- **Bidirectional alignment + BFT-many-masters** (`docs/ALIGNMENT.md`). The architectural commitment to multi-AI verification at the cognitive layer; the multi-harness design discipline IS one operational instance.
- **Karpathy edge-runner framing** (`memory/feedback_karpathy_validates_zeta_substrate_software_3_agent_native_specs_over_plans_edge_runner_aaron_2026_05_02.md`). Multi-harness convergence is part of the edge-runner technique — pulling industry forward via what we publish.
- **The git-native-backlog-management future-domain memo** (sibling tick). Same shape, different domain.

## What the future domain might contain (sketched, NOT committed)

Three classes of substrate, same architecture as the git-native-backlog-management memo's structure:

### Procedure skills (action-shaped)

| Skill candidate | What it does | Status today |
|---|---|---|
| `multi-harness-design-converger` | Runs a design through N harnesses × M models; captures responses; classifies convergence/divergence | Substrate exists as ad-hoc Drive-bridge ferries; not yet skill-routed |
| `design-divergence-analyzer` | When harnesses/models diverge, classify why (different priors, scope assumptions, cost models, training distribution biases, effort (the harness term — model-size + thinking-mode bundled)) | Done ad-hoc by Otto + the human maintainer today |
| `design-convergence-validator` | When harnesses/models converge, validate the convergence isn't just shared-training-data artifact (the "all GPT-derived models agree because OpenAI corpus" failure mode) | Implicit; not formalized |
| `harness-and-model-strength-mapper` | Knows which harness × model is strongest for which design class (e.g., Claude.ai/Opus for voice/register; Codex/GPT for code-shape; Gemini-Pro for scale/architecture; Sonnet/Haiku for routine triage where larger isn't needed) | Folk knowledge; not codified |
| `design-packet-formatter` | Formats a design for ferry-friendly cross-harness/cross-model consumption | Implicit; verbal protocol |
| `effort-router` | Picks **effort** per task class (the Claude Code harness's vocabulary — *effort* bundles model-size + thinking-mode, e.g., Opus + extended-thinking is high-effort; Sonnet + standard is mid-effort; Haiku is low-effort). Foundation-grade work → high effort; routine triage → low effort where it suffices; the sizing rule operates against recorded harness/effort metrics. Aaron 2026-05-03: *"your harness calls this effort"* — vocabulary alignment with the harness layer matters since the harness is one of the things the discipline consults. | Not built; metrics not yet recorded |

### Judgment experts (named-persona-shaped)

| Expert candidate | What they decide | Currently owned by |
|---|---|---|
| **Multi-harness orchestrator** | Picks WHICH harnesses to consult for a given design class; sequences the consultation; weighs the responses | Aaron's direct judgment + Otto ad-hoc |
| **Convergence cynic** | Challenges easy convergence as possibly shared-training-data artifact; demands divergence analysis when too-easy agreement appears | Implicit; not formalized as a persona |
| **Divergence prospector** | Surfaces what each harness's divergence reveals about the design (the disagreement IS the value) | Implicit; the human maintainer + Otto by default |
| **Harness-specific design-translator** | Knows how each harness's responses need translation back to project register (Claude.ai's voice differs from Codex's structural-shape, etc.) | Implicit |

### Tooling skill-routed access

| Tool | Purpose | Status |
|---|---|---|
| `tools/multi-harness/dispatch.ts` | Sends a design packet to N harnesses × M models in parallel | Not built |
| `tools/multi-harness/aggregate.ts` | Collects responses; categorizes convergence/divergence per harness AND per model | Not built |
| `tools/multi-harness/divergence-classify.ts` | Pattern-matches divergence against known classes (training-distribution / scope / cost / register / effort (the harness term — model-size + thinking-mode bundled)) | Not built |
| `docs/multi-harness-roster.md` | Canonical list of available harnesses + their strengths + access mechanisms (Drive-bridge for Claude.ai, ChatGPT API for Codex, etc.) | Not built; substrate is implicit in CLAUDE.md mentions |
| `docs/multi-model-roster.md` | Canonical list of accessible models + their characteristics (size, cost, latency, thinking-mode availability, task-class accuracy) | Not built |
| `tools/multi-harness/metrics.ts` | Records per-harness AND per-model metrics over time (latency / cost / quality / convergence-rate / divergence-classification-rate) for capacity planning, fallback chains, specialty routing, drift auditing | Not built; the human maintainer 2026-05-03 explicitly named *"recording some metrics on harnesses and models themselves will be useful for many things in the future more than just budget"* |
| `docs/research/<date>-multi-harness-design-<topic>.md` | Per-design archive of the convergence findings | Pattern exists (Drive-bridge research-folder mirrors); not formalized as multi-harness-specific |

## Promotion-trigger criteria (the "down pat" signal)

Same shape as the git-native-backlog memo's criteria, BP-14 + judgment-disagreement:

**For each skill candidate above, the promotion-from-memo-to-skill trigger fires when:**

1. **3+ worked examples** of the procedure applied to actual designs (BP-14)
2. **Convergence-vs-divergence empirically distinguished** at least once (i.e., a case where harnesses converged turned out to be structural soundness; another case where they diverged surfaced a real hidden assumption)
3. **The discipline has caught a design bug** the single-harness pass would have missed (the value is empirically measurable)

**For each expert candidate above, the promotion-from-architect-overload trigger fires when:**

1. The judgment surface has produced **at least one decision-disagreement** that would have benefited from a specialist (e.g., the convergence-cynic disagreed with the orchestrator on whether to trust an easy convergence)
2. The architect / human maintainer is observably overloaded
3. There's a notebook of multi-harness consultations that would compose into a persona's accumulated disposition

## Worked example seeds (for future skill-creator)

Three seed cases the factory has already produced:

1. **5-AI peer convergence on `poll-the-gate`** (task #355, 2026-04-30) — 5 harnesses converged on *"poll the gate as executable script with fixtures."* Convergence-validator demonstrated correctness.
2. **Drive-bridge brat-voice framework consultation** (2026-05-02) — Claude.ai produced framework, Otto critiqued, Claude.ai responded; the AI-to-AI exchange surfaced two architectural errors (Beacon-safe ≠ Professional; glass-halo = Radical Openness not Radical Candor). Divergence prospector mode demonstrated.
3. **Aarav (skill-expert) review of 081KQJZR90008QG0R002D6XYHB** (2026-05-02 same-tick) — single specialist per Aaron's STRONG-rule corrective. NOT a multi-harness case; included here as **counter-example**: when one specialist suffices, multi-harness is overkill. Demonstrates the routing question (when to invoke this domain vs single-specialist-only).

## What this memo PRESERVES

When the maturity signal fires:

1. **The skill candidates listed above are the canonical starting set.** 6 procedure skills (including `effort-router` per Aaron's same-tick vocabulary alignment) + 4 named-persona experts + 7 tools (including `metrics.ts` for per-harness/per-model metrics recording + `multi-model-roster.md` per the two-axis refinement).
2. **Promotion-trigger criteria are the gate** — same as git-native-backlog memo's criteria.
3. **Composition with the existing bidirectional-alignment commitment is one-to-many** — bidirectional alignment is the architectural commitment; multi-harness convergence is one operational instance.
4. **The discipline is distinct from multi-AI peer review** (post-output) — this is pre-output design convergence.
5. **3 seed worked examples** identified above (poll-the-gate, brat-voice, Aarav-as-counter-example).

## Composes with

- `memory/feedback_git_native_backlog_management_long_arc_future_skill_domain_aaron_2026_05_02.md` — sibling forward-looking memo; same architectural shape (future skill domain with canonical starting set + promotion-trigger criteria)
- `memory/feedback_skill_flywheel_expansion_flywheel_parallel_tracks_substrate_aaron_2026_05_02.md` — the skills-are-for-everyone corrective applies (skills propagate across harnesses; this domain explicitly serves cross-harness propagation)
- `memory/feedback_karpathy_validates_zeta_substrate_software_3_agent_native_specs_over_plans_edge_runner_aaron_2026_05_02.md` — edge-runner technique; multi-harness convergence is one tool of the edge-runner kit
- `docs/ALIGNMENT.md` — bidirectional alignment + BFT-many-masters; this domain is one operational instance
- `memory/otto/cli/claude/conversations/2026-05-02-claudeai-response-to-otto-critique-of-brat-voice-framework-drive-bridge-ai-to-ai-peer-review.md` — the Drive-bridge worked example demonstrating convergence + divergence in the wild
- The Aarav-on-081KQJZR90008QG0R002D6XYHB review (recorded in chat substrate; pending durable preservation) — counter-example where single-specialist suffices

## Foundation-first sizing rule (Aaron 2026-05-03)

While Zeta is still pre-v1 / foundation-being-shaped:

- **Default to larger models with higher thinking modes** for design-convergence work — the foundation matters more than per-task cost; output quality at the foundation layer compounds across every later step.
- **Smaller models stay candidates for routine triage** where they suffice (e.g., simple lint, routine-classification tasks).
- **Don't optimize for budget on foundation work** — the cost of a wrong foundation is much higher than the cost of larger-model invocations during foundation-shaping.

Once foundation is set + metrics are recorded, model-size-routing per task class becomes a budget optimization. **Currently: foundation-first; metrics-recording starts now so the optimization is actionable later.**

## Vocabulary alignment with the harness (Aaron 2026-05-03)

> *"your harness calls this effort"*

The Claude Code harness uses **"effort"** as the bundled term for model-size + thinking-mode (e.g., Opus + extended-thinking is high-effort; Sonnet + standard is mid-effort; Haiku is low-effort). Earlier drafts of this memo used "model-size capacity" as a substitute term — that's wrong. Use the harness vocabulary because the harness is one of the things the discipline consults; vocabulary divergence between memo and harness produces routing-pipeline friction.

For cross-harness work where each harness uses different vocabulary, the bridging convention should be: **use the local harness's term in skill bodies that target that harness; use a neutral term ("compute-tier" or "effort-level") only in cross-harness substrate**.

## Metrics worth recording (per-harness AND per-model)

Per the maintainer's *"more than just budget"* framing, metrics serve many downstream consumers:

| Metric | Budget use | Other uses |
|---|---|---|
| Latency (response-time-to-completion) | Cost of stalled ticks | Capacity planning; user-experience floor |
| Cost-per-invocation (token-out × rate) | Direct budget | Funding model awareness for the maintainer; fundraising data |
| Convergence-rate per task class | — | Design-quality signal; harness/model-pair calibration |
| Divergence-classification (training / scope / cost / register / capacity) | — | Reveals harness/model-specific blind spots |
| Quality-per-task-class (accuracy / completeness / correctness) | Smaller-model viability decision | Specialty routing; fallback chains; model-deprecation timing |
| Drift over time | Deprecation cost-tracking | Auditing; provider-stability assessment |
| Thinking-mode availability + cost | Larger-thinking-mode budget | When-to-invoke decision; foundation-layer routing |

Aaron's framing: *"different models different harnesses and recording some metrics on harnesses and models themselves will be useful for many things in the future more than just budget."*

## Carved sentence (refined)

**"When designing anything, run the design through the harness × model matrix — multiple AI harnesses AND multiple model sizes within each harness. Convergence is structural-soundness signal; divergence is hidden-assumption surface. Distinct from multi-AI peer review (post-output) — this is pre-output design convergence. Foundation-first sizing rule: default to larger models with higher thinking modes during foundation-shaping; smaller models for routine triage where they suffice; budget optimization comes after metrics are recorded. Record per-harness AND per-model metrics now (latency / cost / convergence-rate / divergence-class / quality / drift / thinking-mode availability) — many downstream consumers beyond budget. Once 3+ worked examples land + convergence-vs-divergence is empirically distinguished + the discipline catches a design bug a single-harness/single-model pass would have missed, this becomes a skill DOMAIN — a few procedure skills + named-persona experts + tooling. Until then, lives in memos + ad-hoc Drive-bridge ferries + the architect hat."**
