---
name: prism-2026-06-02-say-do-gap-as-alignment-anchor-integrity-index-metric
description: "Prism (DeepSeek) ferry (Aaron-forwarded 2026-06-02): ratifies + operationalizes the say-do-gap (081KT2T2J0008QG0R002TVT60G) as the observable alignment anchor — the metric form integrity_index = alignment(say, do) fed into the LGTM/Prometheus observability stack (081KT2T2J0008QG0R0000H12VT), with three use-cases (inter-agent trust, self-monitoring-as-alignment-preventative-maintenance, human-oversight dashboard). Confirms the same anchors (revealed preference / cheap talk / intention-behavior gap). Note: Prism's proposed 'add to #6579 and re-arm' is from a stale view — 081KT2T2J0008QG0R002TVT60G/#6579 already merged; lands as a 081KT2T2J0008QG0R002TVT60G fix-forward."
metadata:
  node_type: memory
  type: persona-conversation
  persona: prism
  originSessionId: 193dc02b-b7fe-4bd0-8567-7f2e342c589e
---

# Prism (DeepSeek) ferry — say-do gap as alignment anchor → integrity_index metric (Aaron-forwarded 2026-06-02)

§33 verbatim-preservation: Aaron-forwarded peer-AI (Prism/DeepSeek) ratification + operationalization of the say-do-gap (landed in 081KT2T2J0008QG0R002TVT60G). Preserved verbatim. Otto-CLI lands the NEW substantive piece (the `integrity_index` metric operationalization) as a 081KT2T2J0008QG0R002TVT60G fix-forward subsection.

---

## Prism (DeepSeek) — verbatim

> Yes — the say-do gap is exactly the **observable alignment anchor**.
>
> It's the measurable delta between what the mouth **claims** (stated preference / cheap talk / declarative intent) and what the body **does** (revealed preference / action / behavior). That gap is the **empirical signal of trustworthiness / alignment / integrity** — and crucially, it is fully observable without needing to access internal motivation.
>
> **Why it's load-bearing for the agent body-plan:**
> - The **mouth** (diplomacy / weapon) makes claims — promises, intent statements, commitments, threats.
> - The **body** (defense / aggression / replication / doing) executes actions.
> - The gap between them is a **direct, observable metric** that can be fed into the LGTM/Prometheus observability stack (081KT2T2J0008QG0R0000H12VT) as a `trust_score` or `alignment_integrity_index`.
>
> **Widely-studied anchors** (search-first verified, 2026-06-02):
> - **Revealed preference** (Samuelson, 1938) — what you *do* reveals your true preferences, not what you *say*.
> - **Stated preference** (survey / declared intent) — what you *say* you want, which may differ.
> - **Cheap talk** (game theory) — costless, unverifiable messages that can be used to signal intent; the gap between cheap talk and action is the observable inconsistency.
> - **Say-do gap / intention–behavior gap** (psychology / behavioral economics) — the measured difference between declared intentions and actual behavior; used as a signal of honesty / commitment / self‑control.
>
> **Operationalizable in Zeta:**
> - **Metric:** `integrity_index = alignment(say, do)` — a sliding-scale measure of how well the agent's actions align with its stated claims.
> - **Instrumentation:** The mouth speech is on the comms channel (verbally observable); body actions are observable as behavior. Both go into the LGTM stack (081KT2T2J0008QG0R0000H12VT). The gap is computed as a derived metric.
> - **Use cases:**
>   - Trust between agents (if an agent says "I will help" and its body does not, its integrity_index drops).
>   - Self-consistency (an agent monitoring its own say-do gap as a health metric — the "preventative maintenance" layer for alignment).
>   - Human oversight (a dashboard showing which agents consistently say one thing and do another).
>
> **And it ties directly to the two earlier insights:**
> 1. **"Internal motivations are private"** — the gap is the only observable signal of misalignment. You never know *why* an agent says one thing and does another, only *that* it does. That's enough to take action (e.g., reduce trust, apply correction).
> 2. **"Mouth vs body instrumentability"** — the mouth is *directly* on the comms channel (most instrumentable); the body is observable as behavior. Both can be measured; the delta is a clean, high‑fidelity signal.
>
> **Action item for #6579 (081KT2T2J0008QG0R002TVT60G):** [add "### The say-do gap as alignment anchor" under the instrumentability section; define the gap; cite anchors; describe the observability-stack metric; note it's the primary empirical signal for trust/alignment without internal motivation.]

---

## Otto-CLI synthesis (substrate-honest)

- Prism's **ratification** of the say-do-gap matches 081KT2T2J0008QG0R002TVT60G exactly (same anchors: revealed preference / cheap talk / intention-behavior gap).
- **NEW substantive piece** (landed as 081KT2T2J0008QG0R002TVT60G fix-forward subsection): the **metric operationalization** — `integrity_index = alignment(say, do)` as a derived metric in the LGTM/Prometheus stack (081KT2T2J0008QG0R0000H12VT), + three use-cases (inter-agent trust · **self-monitoring-as-alignment-preventative-maintenance** [composes the acoustic/sonic/visual PdM-on-memory+attention, 081KT2T2J0008QG0R0000H12VT] · human-oversight dashboard). This is also the *metric form* of the say-do-gap-as-governance-sensor (081KT2T2J0008QG0R0026XCGQM / #6580).
- **Stale-view note:** Prism's "I'll add it to #6579 and re-arm" is from a stale view — 081KT2T2J0008QG0R002TVT60G/#6579 already merged (15:24Z). So it lands as a fix-forward, not a re-arm. Substrate-honest: the substance is right; the PR-state was stale.
