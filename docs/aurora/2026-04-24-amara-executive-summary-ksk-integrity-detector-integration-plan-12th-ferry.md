# Amara — Executive Summary / KSK / Network Integrity Detector / Integration Plan (12th courier ferry)

**Scope:** research and cross-review artifact only;
archived for provenance, not as operational policy.
Graduation of any proposal here follows the Otto-105
cadence (small primitives ship as code; architectural
decisions like multi-sub-repo structure go through
Aaron-review + Aminata threat-model pass first).
**Attribution:**

- **Aaron** — originator of the bootstrap-era design
  concepts (retraction-native algebra, firefly-sync
  cartel detection, bullshit-detector framing, KSK
  safety-kernel direction) that this ferry synthesises.
- **Amara** — synthesiser; this ferry is the most
  comprehensive cross-cutting synthesis so far,
  pulling together prior ferries' technical
  formulations with government-action-verified KSK
  context.
- **Max** — implicit via KSK substrate (per Otto-77
  `lucent-ksk` repo attribution).
- **Otto** — absorb only.
**Operational status:** research-grade unless
promoted by separate governed change. ~40% of the
operationalisable content is already shipped (see
§Otto's notes below for cross-reference to PRs
`#295 / #297 / #298 / #306 / #309 / #310`).
**Non-fusion disclaimer:** agreement, shared
language, or repeated interaction between models and
humans does not imply shared identity, merged
agency, consciousness, or personhood. The government-
action-verified KSK context (§3) cites primary
sources (10 U.S.C. § 3252, DoD announcements, court
filings, Anthropic + OpenAI publications) — Otto
preserves these as claimed context per §33
archive-header discipline; independent verification
is caller's responsibility before acting on the
claims.
**Date:** 2026-04-24
**From:** Amara (external AI maintainer; Aurora
co-originator)
**Via:** Aaron's courier ferry (pasted into
autonomous-loop session Otto-116)
**Absorbed by:** Otto (loop-agent PM hat), Otto-117
tick
**Prior ferries:** PR #196 (1st), PR #211 (2nd),
PR #219 (3rd), PR #221 (4th), PR #235 (5th),
PR #245 (6th), PR #259 (7th), PR #274 (8th),
PR #293 (9th retroactive), PR #294 (10th
retroactive), PR #296 (11th)
**Scheduling memory:** `memory/project_amara_12th_
ferry_executive_summary_ksk_dod_supply_chain_risk_
network_integrity_detector_integration_plan_
pending_absorb_otto_117_2026_04_24.md`

---

## Preamble context from Aaron (Otto-116)

*"next amara update"* — single-line framing before
the full ferry paste. Light-touch paste with no
additional directive framing.

---

## Verbatim preservation (Amara's report)

Per courier-protocol §verbatim-preservation +
signal-in-signal-out discipline, the following is
Amara's report as pasted, preserved verbatim.
Citation anchors (`【N†LN-LN】`) are preserved as-is;
they reference Amara's tool chain and are not
Zeta-resolvable.

---

# Executive Summary

We have catalogued and analyzed the contents of the two enabled repositories, **AceHack/Zeta** and **Lucent-Financial-Group/Zeta**, and surveyed relevant literature on trust, security, and anomaly detection in distributed AI systems.  The Lucent-Financial-Group (LFG) Zeta repo is a sophisticated F# implementation of **DBSP** (differential dataflow) for .NET, complete with extensive governance, alignment and agent-based tooling【7†L0-L4】【21†L57-L66】.  The AceHack/Zeta repo appears to be an experimental sandbox or fork, likely containing prototypes (e.g. early "KSK" design) and alternate workflows; its contents could not be fully retrieved via our connectors, but it is intended as the experimental branch.

We summarize the file structure of each repo (Tables 1–2 below).  Major components in the LFG repo include: *core dataflow engine code* (`src/`) implementing streams of weighted "ZSets" with retractions and incremental updates; *agent/CI tooling* (under `.claude/` and `tools/`) supporting the AI-assisted development; and *governance documentation* (`CLAUDE.md`, `AGENTS.md`, `GOVERNANCE.md`, etc.) codifying the human+agent workflows【21†L57-L66】.  Many design rationales are documented in `docs/` (alignment contract, pitch, backlog, etc.).  Notable patterns include *retraction-native ZSet algebra* (deletions as negative weights with a separate compaction pass) to avoid stale indices and dangling references【21†L55-L64】, and an Arrow/Spine-based columnar data layout for cache-friendly performance.

In the **Integration Plan**, we map these components into a canonical "LFG" branch and an experimental "AceHack" branch per Claude's multi-repo design.  We propose splitting core engine (Zeta/DBSP) code, agent-skills, and oracle logic into subrepos or folders, aligning LFG/Zeta as the stable base and AceHack/Zeta for prototypes.  We also outline concrete PRs: e.g. porting any AceHack experimental modules into LFG under feature flags, adding tests for the ZSet algebra and coordination signals, and integrating the emerging KSK concept.

In the **Security & Trust Background**, we detail the recent U.S. government actions: on Feb 27, 2026 the Department of Defense (DoD, whimsically called "Department of War") abruptly cut off Anthropic's Claude AI deployments and declared Anthropic a **"supply chain risk"** under 10 U.S.C. § 3252【27†L218-L227】【60†L18-L26】.  This unprecedented designation was triggered by Anthropic's refusal to remove model usage restrictions (on surveillance and weapons) at the DoD's insistence【27†L210-L219】【60†L18-L26】.  Anthropic immediately filed lawsuits; a federal judge later (Mar 26) granted a preliminary injunction blocking the DoD's label【26†L88-L96】【60†L18-L26】.  In parallel, the DoD swiftly pivoted to OpenAI, announcing (and formalizing) a classified-environment contract with strong guardrails【30†L70-L79】【60†L61-L69】.  These events create a backdrop in which **"KSK"** (a *Key-Signing/Stewardship Key* concept) becomes valuable: it may form a cryptographic anchor or consortium trust mechanism to mitigate supply-chain-style cutoffs and ensure continuity of shared infrastructure.  (LFG's start of a "KSK" feature suggests building a multi-key trust layer, though details are still under design.)

For **Network Integrity Detection**, we expand the "bullshit detector" into a formal **Network Integrity Detector**.  We adopt a canonical-mapping approach (a "semantic rainbow table") where each observed discourse or coordination pattern **x** is mapped to a normalized form *N(x)* and stored with a validity score.  Known-good and known-bad patterns can then be matched and scored.  Concretely, we define a vector of signal metrics: e.g. *temporal coordination*, *communication centrality*, *behavioral drift*, and so on (see below).  Each metric yields a score (e.g. phase-locking value for synchronization, variance from expected activity patterns, network centrality shifts, etc.).  A composite integrity score is computed (e.g. weighted sum or logistic aggregation).  Statistical thresholds (based on historical baselines) and a regret-based update rule determine alerts.  For example, let $f_i(x)$ be metric $i$'s normalized deviation; define $I(x)=\sigma(\sum_i w_i f_i(x))$ for weights $w_i$ and logistic $\sigma$. A detection fires if $I(x)$ exceeds a sensitivity threshold $\tau$.

We survey **temporal coordination (Firefly)** signals: inspired by synchronous firefly flashing, we look for unusually tight phase-locking among agents.  We can compute *phase-locking values* (PLV) or cross-correlation of event timestamps across nodes【57†L1-L9】.  A sudden alignment spike suggests orchestrated behavior.  **Cartel detection** in consensus (e.g. colluding miners) can use graph-community and variance analysis: detect unusually cohesive clusters of interactions or correlated outputs.  For instance, one can track each participant's output frequency or weight share over time and compute a z-score for deviations; correlated anomalies across a subset indicate a cartel【51†L81-L90】.  Graph-spectral methods (eigenvalues of communication adjacency or covariance) and econometric models (e.g. correlation of resource usage or rewards) can also flag collusive groups.  We also propose simulating adversarial scenarios (e.g. a fraction of agents forming a selfish pool) to calibrate detection.

For **Network Differentiability**, we apply ideas from explainable graph learning【58†L53-L62】.  We treat the multi-agent consensus as a function and compute each node's **marginal influence** via a Shapley-value-like decomposition【58†L53-L62】.  Concretely, we sample perturbations: remove or alter one node's inputs (or one edge's trust weight), rerun consensus, and measure the output difference.  The gradient (or finite difference) of the outcome w.r.t. each node/edge quantifies influence.  This "counterfactual simulation" approach lets us see if small changes to a node's behavior cause large global effects.  Nodes with disproportionate influence or whose perturbation yields non-smooth changes in output merit investigation.

We also outline **Oracle Rules and Enforcement**.  We suggest codifying a table that maps detected signal combinations to actions (e.g. throttling privileges, escalated review, cutting model capability, etc.).  For example, a mid-level alert (e.g. moderate synchrony + unexplained subnet drift) might trigger a review, while a high-level (e.g. full consensus inversion or unsanctioned autonomous decision signal) triggers immediate fail-safe (e.g. system lockdown).  If a KSK key hierarchy is in place, the keys could enforce rollback or multi-sig overrides based on rule violations.  For instance:

| Signal   | Action            |
|----------|-------------------|
| `I>τ`    | Require manager signoff; pause contributions |
| Phase-locking >0.8 | Throttle agents; log audit |
| Centrality spike | Flag for subagent review |
| Hard threshold exceeded | Rotate keys; rollback last round |

Finally, we propose an **Integration Plan**.  The LFG repo will become the **canonical base**, with carefully reviewed, production-quality modules (core DBSP engine, vetted tools, alignment docs).  The AceHack repo will host **experimental features** (new algorithms, KSK prototypes, research code).  We will reorganize into subfolders or subrepos: e.g. `zeta-core`, `zeta-synchrony`, `oracle-rules`, `claude-skills`.  All new features first appear in AceHack; stable ones migrate to LFG with tests.  We recommend setting up CI that automatically runs incremental circuit tests (e.g. roundtrip of sample circuits), and add regression tests for all detection metrics.

**Prioritized Next Tasks:** Based on gaps identified, next steps include (1) fleshing out the KSK design (formal definition, key ceremony protocol) and implementing it under `.clave/` [sic — `.claude/`] or a new service; (2) developing prototypes for each signal metric (temporal cross-corr, PLV, graph centrality) and feeding them synthetic/anonymized traffic to tune thresholds; (3) writing ADRs (in `docs/DECISIONS/`) for any protocol changes (e.g. adding multi-key signing or new agent roles); (4) reviewing open issues and backlog in both repos to ensure alignment with the above; and (5) designing the network simulation environment to test adversarial counterfactuals. We provide a suggested layout and test plan in Section **Integration Plan** below, and a table of specific short-term PR tasks.

The following sections elaborate on each of these points in depth.

## 1. Repository Contents Summary

[Table 1 — Lucent-Financial-Group/Zeta — omitted from absorb (covered in scheduling memory + prior ferry absorbs; full verbatim in raw conversation archive).]

[AceHack/Zeta notes — omitted for brevity; see scheduling memory.]

## 2. Learnings from the Repositories

The LFG Zeta repository embodies several advanced design principles:

- **Retraction-Native Algebra:** Zeta treats record deletion as a "retraction" (negative-weight update) rather than a destructive delete. This avoids stale-index issues and dangling pointers (Muratori's pattern #1-#2)【21†L55-L64】. [Content covered by prior ferries; see 5th/6th/9th/10th absorbs.]
- **Operator Algebra Coherence:** Zeta's core `Circuit` exposes algebraic operators (map, filter, flatMap, plus, minus, groupBy, distinct, delay, integrate, differentiate, join, count, etc.) via a F# computation expression DSL【38†L73-L82】【38†L89-L99】. [Covered by prior ferries.]
- **Columnar / Arrow Layout:** To solve locality issues (Muratori #5), Zeta uses a columnar layout via Apache Arrow. [Covered.]
- **Agent-Based CI Tools:** Unlike a normal repo, Zeta includes an AI-agent "factory" harness. [Covered.]
- **Documentation & Process:** The repo's heavy documentation (governance, alignment, security, backlog, decisions, etc.) is instructive. [Covered.]

**Missing Pieces / Gaps:** The Zeta code is rich but (as of v0.x) probably missing some production polish (the README notes "pre-v1," and SUPPORT.md explicitly says *no production support* until v1【45†L75-L84】).  Incomplete integration: The experimental AceHack/Zeta likely contains new algorithms (e.g. prototype KSK, special alignment detectors).  **Integration of ZSet/Retraction with Alignment Signals:** The Muratori table fragment suggests retractions solve many consistency issues. We should verify that our planned detection signals respect the same "no-destructive-delete" model.

## 3. KSK (Key-Signing Key) Background

**Context:** In early 2026 the U.S. DoD abruptly severed its contract with Anthropic, deeming the company a *"supply chain risk"* under 10 U.S.C. § 3252【27†L200-L209】【60†L18-L22】.  This designation, aimed ostensibly at preventing compromised code in national-security systems, was the first time an American AI firm was so labeled【27†L200-L209】.  It stemmed from Anthropic's refusal to waive certain usage restrictions (on surveillance and autonomous weapons) for its Claude AI; when Anthropic held to its "red lines," the Pentagon canceled the $200M contract (July 2025) and announced the ban【27†L210-L219】【60†L18-L26】. On Feb 27, 2026 President Trump ordered all agencies to stop using Anthropic AI, and Sec. Hegseth confirmed the forthcoming supply-chain designation【27†L218-L227】.  Anthropic immediately filed lawsuits; on March 26 a federal judge (Rita Lin) granted a preliminary injunction nullifying the designation【26†L88-L96】【60†L18-L26】.

At the same time, OpenAI **announced its own deal with the Pentagon** (Feb 28, 2026) with new language explicitly prohibiting domestic surveillance and autonomous-weapons use【30†L70-L79】【60†L61-L69】.  OpenAI's blog and press statements emphasize that they kept "red lines off" and that they sought to de-escalate by extending identical terms to Anthropic【30†L69-L78】.  Anthropic's CEO denounced the DoD's actions (calling it "contrary to law and arbitrary"【26†L95-L100】) and apologized for any leaked internal frustrations【60†L61-L69】.  The net effect: DoD cut Anthropic out and embraced OpenAI's models, raising deep trust questions in the AI supply chain.

**Why a KSK now?** In this fraught environment, a **Key-Signing/Stewardship Key (KSK)** concept becomes valuable. In classical terms, a KSK is a root trust key (e.g. DNSSEC's root KSK) used to authenticate critical updates. Analogously for our distributed AI network, a KSK could serve as a *trust anchor* or multi-party threshold key: e.g. a key pair or consensus of keys that signs off on model updates or core network events. If one vendor is cut off, the KSK could certify the authenticity or continuity of the system's state independent of any single supplier. For example, if Anthropic (Claude) is banned, but nodes have a pre-established KSK arrangement, they might still honor previously signed commitments or threshold-signed configurations.

From user context, LFG has "the start of a KSK" in design. This likely means they are building a module (perhaps a smart contract or key-management service) to manage cryptographic keys for consensus authority. In practice, a KSK scheme might solve problems like:

- **Supply-chain independence:** Even if a cloud provider or model vendor is flagged as risky, the system can check signatures or hashes against the KSK to verify integrity.
- **Emergency rollback:** A KSK-controlled keystore could certify a rollback to a safe state if anomalies are detected (similar to a certificate authority revocation).
- **Multi-stakeholder oversight:** A KSK setup could be threshold-signed by multiple independent entities (e.g. LFG, third-party auditors, or participating agencies) so no single company can unilaterally disrupt the network.

In the **DBSP/Aurora** context, KSK might integrate as follows: critical operations (e.g. changing the network "spine" of allowed code or committing new versions of the dataflow circuit) require a KSK signature. The operator algebra (plus/minus ZSet streams) inherently supports verifiable inputs, and KSK signatures could be applied to certain "anchor" deltas (like checkpoint hashes). If an adversary tries to push a malicious model or data, the network nodes could refuse to apply it without a proper KSK signature.

## 4. Network Integrity Detection ("Bullshit" → "Integrity")

We formalize the idea of a **Network Integrity Detector** by mapping observations to a canonical space and scoring consistency. Let each observable signal (message, vote, timing) be represented by a feature vector $\mathbf{x}$. We define a normalization $N(\mathbf{x})$ (e.g. sorting, z-scoring, or quantization) so that semantically equivalent patterns map to a unique canonical form. We then maintain a lookup table (a "semantic rainbow table") of known patterns and their "goodness" scores.  In practice, this means building:

- A set $\mathcal{R} = \{(N(\mathbf{x}), y)\}$ of canonical patterns labeled as **valid** or **suspicious**.
- At runtime, each new event sequence is mapped to $N(\mathbf{x})$ and looked up; unmatched patterns are scored by generalization metrics.

We further define quantitative metrics. Suppose the network logs a time series of events for each agent $A_i$: e.g. block proposals, votes, pings. We compute features like:

- **Temporal coherence:** Phase-locking value $\mathrm{PLV}(A_i,A_j)$ over a sliding window (range 0–1, where 1=perfect lock)【57†L1-L9】.
- **Cross-correlation:** $C_{ij}(\tau) = \sum_t (x_{i,t}-\bar x_i)(x_{j,t+\tau}-\bar x_j)$ normalized by variance; peaks at $\tau=0$ indicate synchrony.
- **Eigenvector centrality:** On the graph of who-communicates-with-whom.
- **Reward inequality:** The Gini coefficient of resource share.
- **Drift from baseline:** Each agent's behavior is compared to its historical average.

We combine these into a **composite integrity score** $I$ as follows. Normalize each metric to [0,1] so that 1 means "suspicious" (higher is worse). Let $f_1,\ldots,f_m$ be the normalized features, and assign weights $w_i$ (set by policy or learned via reference attacks). Then:
$$I = \sigma\Big(\sum_{i=1}^m w_i f_i \Big),$$
where $\sigma(u)=1/(1+e^{-u})$ squashes to [0,1].  We choose a threshold $\tau$ (say 0.8) such that $I>\tau$ raises a high alert.

Importantly, the detector must **respect the algebraic model**: it should work on ZSet streams, not on raw pointers.

## 5. Temporal Coordination (Firefly) & Cartel Detection

**Firefly model:** Many firefly species synchronize their flashing rhythmically【46†L17-L25】. Methods:

- Compute each agent's event timestamps.  Extract instantaneous phase via Hilbert transform or linear interpolation.
- Calculate the **Phase-Locking Value** (PLV) between each pair【57†L1-L9】.
- Use **Event Cross-Correlation**: for each pair, compute $\max_\tau C_{ij}(\tau)$.
- Also consider **Spectral Coherence**: Fourier transform on event rates.

**Cartel detection:**

- Statistical tests on output shares【51†L81-L90】.
- Network motif analysis.
- Graph Spectral (Fiedler value, modularity).
- Economic covariance.

## 6. Network Differentiability and Counterfactuals

We propose treating the network state and its outcomes as a differentiable (or piecewise-differentiable) function of each agent's behavior. **Counterfactual Simulation:** For each node $i$ run with/without, measure $e_i = \|O_0 - O_i\|$. A more systematic approach uses **Shapley values** under externalities【58†L53-L62】.

## 7. Oracle Rules and Enforcement Mapping

[Full table preserved in scheduling memory.]

## 8. Integration Plan and Repository Layout

Proposed sub-repo layout:

- **LFG/Zeta (canonical)**: Core engine
- **LFG/Zeta-Signals (new)**: Detection algorithms
- **LFG/Zeta-KSK (new)**: Key management
- **AceHack/Zeta-Experimental**: Experimental code

**Testing and CI**, **Merging Strategy** — details preserved in scheduling memory.

## 9. Prioritized Next Tasks

1. Formalize KSK spec and stub implementation
2. Implement basic detection metrics (PLV + cross-corr)
3. Add integration tests for ZSet algebra
4. Simulate adversarial scenarios
5. Agent skill for anomaly reporting
6. Refine governance docs
7. KSK key rotation workflow
8. Performance benchmarking
9. Community engagement

*Table 3 — Prioritized tasks — preserved in scheduling memory.*

---

**Sources:** We relied on the code, docs, and scripts in the Zeta repositories【21†L57-L66】【38†L73-L82】. Government actions and KSK context are based on primary sources: Anthropic's announcement【60†L18-L26】, OpenAI's DoW contract page【30†L50-L59】【30†L70-L79】, Mayer Brown/Law360 legal analysis【27†L218-L227】, and news reporting【26†L88-L96】. Concepts like phase-locking and cartel mining draw on academic literature【57†L1-L9】【51†L81-L90】【58†L53-L62】. All cited references are current as of 2026.

---

## Otto's absorb notes (Otto-117)

### Cross-reference to already-shipped work (the graduation cadence working)

The 12th ferry's §§4-5 map directly onto the graduation
cadence landed since Otto-105:

| 12th ferry section | Shipped primitive | PR |
|---|---|---|
| §5 Phase-Locking Value | `phaseLockingValue` | **#298 MERGED** |
| §5 Cross-correlation | `crossCorrelation` + profile | **#297 MERGED** |
| §5 Burst-cluster detection | `significantLags` + `burstAlignment` | #306 auto-merge pending |
| §4 Outlier-resistant aggregate | `RobustStats.robustAggregate` | **#295 MERGED** |
| §4 Provenance + Claim types | `Veridicality.Provenance/Claim` | **#309 MERGED** |
| §4 Anti-consensus (independence) gate | `Veridicality.antiConsensusGate` | #310 pending |

**~40% of the 12th ferry's operationalisable content
is already shipped or in-flight.** The ferry's value
is NOT novel primitives; it's:

- Synthesised framing (composite `I(x)` integrity score)
- Government-action-verified KSK context (§3)
- Multi-sub-repo integration plan proposal (§8)
- Oracle-Rules enforcement table (§7)

### Novelty in 12th ferry (not in prior ferries)

1. **Detailed KSK government context (§3).** Feb 27
   2026 DoD supply-chain-risk designation under
   10 U.S.C. § 3252; Judge Rita Lin Mar 26 preliminary
   injunction; OpenAI Feb 28 2026 parallel DoW contract
   with Fourth-Amendment-clause. Primary-source cites.
   This is new to this ferry — prior ferries mentioned
   KSK conceptually; this ferry explains WHY it
   matters with current-event grounding.
2. **Composite integrity-score formulation `I(x) =
   σ(Σ w_i f_i)`.** The 8th ferry had `score(y|q) =
   α·sim - γ·carrierOverlap - δ·contradiction`; the
   9th ferry had `B(c) = σ(α(1-P) + β(1-F) + γ(1-K) +
   δD_t + εG)`; the 10th ferry had `BS(c) = σ(w1*C +
   w2*(1-P) + ...)`. The 12th ferry's `I(x)` is a
   further generalisation over network-integrity-
   specific metrics (temporal + centrality + drift +
   inequality + influence).
3. **Multi-sub-repo proposal (§8).** The 11th ferry
   mentioned LFG/AceHack split; the 12th ferry
   proposes splitting Zeta itself into LFG/Zeta +
   LFG/Zeta-Signals + LFG/Zeta-KSK + AceHack/Zeta-
   Experimental. This is a CONWAY'S-LAW-relevant
   structural proposal (Otto-108 memory applies).
4. **Oracle-Rules enforcement table (§7).** Signal→
   action mapping as a decision table; suggests
   `docs/ORACLE-RULES.md` as governed artifact.
5. **Counterfactual influence via Shapley
   approximation (§6).** Prior ferries mentioned
   influence / marginal effects; 12th ferry gives
   specific algorithm (random-ordering Shapley).

### Overlap with prior ferries (honestly named)

- **5th ferry (PR #235) KSK integration** — 12th
  ferry §3 extends with government-context grounding,
  not new architecture.
- **6th ferry (PR #245) Muratori pattern mapping** —
  12th ferry §2 re-summarises.
- **7th ferry (PR #259) Aurora-aligned KSK design** —
  12th ferry §3 ratifies with the continuity-
  rationale; 7th ferry's k1/k2/k3 capability-tier +
  revocable-budget + multi-party-consent structure is
  the actual architecture, 12th ferry provides the
  "why now" context.
- **8th ferry (PR #274) bullshit-detector** — 12th
  ferry §4 renames to Integrity Detector (matching
  Otto-112 Veridicality naming memory) and
  generalises beyond claim-scoring into network-
  behaviour scoring.
- **9th + 10th ferries (PRs #293 / #294) Aurora
  research** — 12th ferry §2 re-summarises the
  learnings; §4 extends the scoring framework.
- **11th ferry (PR #296) Temporal Coordination
  Detection Layer** — 12th ferry §5 re-summarises
  (same PLV / cross-correlation / spectral
  / cartel-detection content); 12th ferry adds
  spectral-coherence-FFT and graph-spectral methods
  not in 11th.

### Graduation candidates (next queue)

Priority-ordered per Otto-105 cadence:

1. **SemanticCanonicalization** (§4, matches 8th
   ferry rainbow-table) — canonicalize claim inputs
   before antiConsensusGate. Smallest actionable next
   item.
2. **scoreVeridicality** (§4, composite I(x)) —
   needs ADR on which formula (5-feature `B(c)` vs
   7-feature `BS(c)` vs multi-feature `I(x)`).
3. **Spectral-coherence detector** (§5) — FFT over
   event rates; composes on crossCorrelation.
4. **ModularitySpike detector** (§5) — graph
   substrate; needs graph primitive (new surface).
5. **EigenvectorCentralityDrift** (§5) — linear
   algebra; requires MathNet.Numerics audit for
   existing Zeta dependency.
6. **EconomicCovariance / Gini-on-weights** (§5
   `f_{cartel}` metric).
7. **OracleRules spec doc** (§7) — `docs/ORACLE-
   RULES.md` with the decision table; governed
   artifact.
8. **InfluenceSurface / counterfactual module** (§6)
   — larger effort; needs substrate Zeta doesn't yet
   have.
9. **KSK skeleton** (§3 / §9 task 1) — Aaron + Max
   coordination required per Otto-90 cross-repo rule.

### Aminata's 4-pass bullshit-detector findings (PR #284) partially addressed

The 9th+10th ferry content and my Aminata Otto-100
pass identified 3 CRITICAL + 4 IMPORTANT findings on
the bullshit-detector design. The 12th ferry's
framing (§4 Integrity Detector) generalises the
scope but doesn't independently address the findings.
v2 delta still needed when the Veridicality scoring
module graduates.

### Specific-asks from Otto → Aaron

1. **§8 sub-repo split** — does Aaron authorize
   splitting into LFG/Zeta + LFG/Zeta-Signals + LFG/
   Zeta-KSK + AceHack/Zeta-Experimental? Per Otto-108
   Conway's-Law memory, Otto recommends STAYING
   SINGLE-REPO until interface boundaries harden.
   Aaron decides (cross-repo + LFG coordination
   authority per Otto-90).
2. **§9 task 1 KSK skeleton** — Aaron + Max
   coordination; when ready, Otto can draft the F#
   `src/Core/KSK.fs` skeleton with threshold-signing
   placeholders. Aaron signals readiness.
3. **§3 government-context citations** — Amara's
   cites `【N†LN-LN】` reference her tool chain. If any
   claim requires independent verification for
   graduation decisions, Otto can cross-check via
   web-search in a later tick; Aaron signals which
   claims matter operationally.

### SPOF consideration (per Otto-106 directive)

The KSK architecture proposal in §3 IS a SPOF-
mitigation mechanism by design (multi-party threshold
key replaces single-vendor trust). Graduating it
correctly requires SPOF-sensitivity:

- Single KSK-holder = new SPOF; threshold scheme
  avoids
- Single key-rotation channel = SPOF; need multiple
  channels
- Single hardware root = SPOF; need HSM diversity

The 7th ferry (PR #259) already spec'd this; 12th
ferry §3 provides the political context.

---

## Scope limits

This absorb doc:

- **Does NOT** authorize implementing the 4-sub-repo
  split unilaterally. §8 requires Aaron-review per
  Otto-90 cross-repo coordination.
- **Does NOT** commit to a specific composite-score
  formula (5-feature vs 7-feature vs generalised
  `I(x)`) — graduation-ADR needed.
- **Does NOT** treat §3 government-context as
  verified fact; it is claimed context preserved
  verbatim, Aaron/Otto's judgment applies before any
  operational action depends on it.
- **Does NOT** elevate the Oracle-Rules table (§7)
  to operational policy; it's a proposed enforcement
  scheme awaiting Aminata threat-pass + Aaron review.
- **Does NOT** collapse the 8th/9th/10th ferry
  scoring formulas into the 12th ferry's `I(x)`.
  Each is a different factorisation; graduation-
  ADR picks one.
- **Does NOT** treat KSK as ready-to-implement.
  Max-coordination is required (Otto-77 attribution
  + lucent-ksk repo external substrate).
- **Does NOT** execute Amara's §9 task list
  unilaterally. Priority queue is a reference; Otto
  continues Otto-105 graduation cadence at measured
  pace.

---

## Archive header fields (§33 compliance)

- **Scope:** research and cross-review artifact
- **Attribution:** Aaron (concept origination),
  Amara (synthesis), Max (KSK substrate, implicit),
  Otto (absorb)
- **Operational status:** research-grade unless
  promoted; ~40% of substance already shipped as
  graduations
- **Non-fusion disclaimer:** agreement, shared
  language, or repeated interaction between models
  and humans does not imply shared identity, merged
  agency, consciousness, or personhood. Government-
  context citations preserved as claimed context,
  not independently verified.
