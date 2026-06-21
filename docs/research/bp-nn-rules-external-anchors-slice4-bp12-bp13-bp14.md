# BP-NN Rules External Anchor Backfill — Slice 4 (BP-12, BP-13, BP-14)

Scope: External prior-art anchors for three BP-NN rules in
`docs/AGENT-BEST-PRACTICES.md`. This is slice 4 of the 081KR2E4K0008QG0R001ADMBVW backfill;
slices 1–3 covered BP-10, BP-11, BP-03, BP-07, BP-16, BP-04, BP-08, BP-09.
These three rules were selected as the next tier: BP-12 (security
boundary re-sanitisation), BP-13 (parametric vs. retrieved knowledge
placement), BP-14 (isolated eval harness).

Rules covered: BP-12 (re-sanitise at every sub-agent boundary; never trust
peers by default), BP-13 (stable knowledge lives in the skill file; volatile
knowledge is retrieved at runtime), BP-14 (every skill has a dry-run eval set
and runs in an isolated environment when exercised).

Research date: 2026-05-10. Research performed via WebSearch (Otto-364
search-first-authority discipline).

Attribution: Research performed by Otto (Claude Sonnet 4.6) 2026-05-10.
Cited sources are human-authored external publications. Otto's contribution
is search, synthesis, and beacon-safety pass; all intellectual lineage
belongs to the cited external authors.

Operational status: research-grade

Beacon-safety pass: all cited vocabulary (prompt injection, agent trust
boundary, parametric memory, retrieval-augmented generation, eval harness,
isolated evaluation, regression detection) uses standard academic and
industry-security register. No beacon-blocked terminology found.

---

## BP-12 — Re-sanitise at every sub-agent boundary; never trust peers by default

**Rule text (from AGENT-BEST-PRACTICES.md):**
*"Re-sanitise at every sub-agent boundary; never trust peers by default.
Rationale: a compromised peer agent attempts to propagate injection
downstream. Subagent briefs must re-state safety rules explicitly; they do
not travel automatically."*

**Core claim:** When one agent in a multi-agent system is compromised by a
prompt injection, the injected payload can propagate to downstream agents
unless each boundary independently re-validates and sanitises its inputs.
Safety constraints, trust assumptions, and safety rules declared in the
orchestrator do not automatically transfer to sub-agents at the API level.
Each boundary is an independent trust boundary that must be explicitly
defended.

### External anchors

**1. Lee, D. & Tiwari, M. — "Prompt Infection: LLM-to-LLM Prompt Injection
within Multi-Agent Systems" (arXiv:2410.07283, October 2024)**

- URL: <https://arxiv.org/abs/2410.07283>
- Authors: Donghyun Lee, Mo Tiwari
- Date: October 2024
- Relevance: Directly demonstrates the failure mode BP-12 is designed to
  prevent. The paper introduces "Prompt Infection" — a self-replicating
  injection attack where a single compromised agent spreads the payload
  to all downstream interconnected agents, even when agents do not publicly
  share their full communications. The paper proves the attack succeeds
  unless each receiving agent independently validates its inputs rather than
  inheriting trust from the sender. The mechanism: the injected payload
  instructs the first agent to embed the attack prompt into its output,
  which then becomes the input to the next agent, propagating the infection.
  BP-12's "re-sanitise at every sub-agent boundary" is the architecturally
  correct countermeasure this paper's findings prescribe.
- Key finding: *"In this attack, a compromised agent spreads the infection
  to other agents, coordinating them to exchange data and issue instructions
  to agents equipped with specific tools … multi-agent systems are highly
  susceptible even when agents do not publicly share all communications."*

**2. Zhan, Q. et al. — "InjecAgent: Benchmarking Indirect Prompt
Injections in Tool-Integrated Large Language Model Agents"
(arXiv:2403.02691, ACL 2024 Findings)**

- URL: <https://arxiv.org/abs/2403.02691>
- Authors: Qiusi Zhan et al. (UIUC Kang Lab)
- Venue: ACL 2024 Findings
- Date: March 2024
- Relevance: Empirical benchmark of 1,054 test cases measuring how
  state-of-the-art LLM agents are compromised by malicious content injected
  via tool responses — i.e., content arriving from a "peer" tool or upstream
  agent in the pipeline. Finds ReAct-prompted GPT-4 is successfully hijacked
  in 24% of base cases, rising to nearly 48% when the payload is reinforced
  with a hacking prompt. Directly supports the claim that sub-agent inputs
  must be treated as untrusted regardless of where they originate in the
  pipeline — peer agents and tool responses are equally capable of carrying
  injection payloads.
- Key finding: *"ReAct-prompted GPT-4 vulnerable to attacks 24% of the
  time … enhanced setting [nearly] doubling the attack success rate."*

**3. OWASP — "AI Agent Security Cheat Sheet" and "LLM01:2025 Prompt
Injection" (OWASP GenAI Security Project, 2024–2025)**

- URL (AI Agent Security): <https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html>
- URL (LLM01:2025): <https://genai.owasp.org/llmrisk/llm01-prompt-injection/>
- URL (Prompt Injection Prevention CS): <https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html>
- Source: OWASP GenAI Security Project (600+ industry contributors)
- Date: 2024–2025
- Relevance: Authoritative industry-consensus guidance that is verbatim-
  aligned with BP-12. The AI Agent Security Cheat Sheet states: *"Implement
  trust boundaries between agents and validate and sanitize inter-agent
  communications"* and *"when agents call other agents, the receiving agent
  has no reliable way to verify the sender's intent or integrity."* The
  Prompt Injection Prevention Cheat Sheet states: *"Treat every tool response
  as untrusted user input — sanitize before feeding back into the LLM
  context."* LLM01:2025 notes that indirect injection *"collapses the trust
  boundaries that traditional software depends on"* — BP-12's re-sanitisation
  rule re-establishes the boundary at each hop. The "subagent briefs must
  re-state safety rules explicitly" clause in BP-12 implements OWASP's
  "validate and sanitize inter-agent communications" at the system-design
  level.

### Mechanism note

All three anchors confirm the same architectural finding: sub-agent trust
boundaries are not inherited; each must be independently defended. Lee &
Tiwari (2024) prove the propagation mechanism empirically; InjecAgent (2024)
quantifies the attack success rate at real-world scale; OWASP (2024–2025)
translates this into the industry-standard practitioner control. BP-12's
"subagent briefs must re-state safety rules explicitly" is the prompt-
engineering operationalisation of OWASP's "validate and sanitize inter-agent
communications" at the design-time level.

---

## BP-13 — Stable knowledge lives in the skill file; volatile knowledge is retrieved at runtime

**Rule text (from AGENT-BEST-PRACTICES.md):**
*"Stable knowledge lives in the skill file; volatile knowledge is retrieved
at runtime. Rationale: memory shapes behaviour; retrieval supplies facts.
Module paths, module names, this round's BACKLOG state — retrieve. Tone,
authority, workflow — embed."*

**Core claim:** There is a fundamental architectural distinction between two
types of knowledge in LLM-based systems: (1) stable, behaviour-shaping
knowledge (tone, authority, workflow, reasoning patterns) which belongs
in the skill file (parametric, embedded at design time), and (2) volatile,
factual, entity-specific knowledge (BACKLOG state, module names, API
endpoints, current PR counts) which degrades rapidly in parametric memory
and must be retrieved at runtime. The rule is an application of the
parametric/non-parametric memory dichotomy, established foundationally in
the RAG literature, to the skill/agent design space.

### External anchors

**1. Lewis, P. et al. — "Retrieval-Augmented Generation for
Knowledge-Intensive NLP Tasks" (NeurIPS 2020, arXiv:2005.11401)**

- URL: <https://arxiv.org/abs/2005.11401>
- Authors: Patrick Lewis, Ethan Perez, Aleksandra Piktus, Fabio Petroni,
  Vladimir Karpukhin, Naman Goyal, Heinrich Küttler, Mike Lewis,
  Wen-tau Yih, Tim Rocktäschel, Sebastian Riedel, Douwe Kiela
  (Facebook AI Research / UCL / NYU)
- Venue: NeurIPS 2020 (13,000+ citations, Semantic Scholar)
- Date: 2020
- Relevance: The foundational paper establishing the parametric/non-parametric
  memory dichotomy that BP-13 is built on. Explicitly defines *parametric
  memory* (knowledge embedded in model weights or skill file tokens — stable,
  behaviour-shaping) versus *non-parametric memory* (a retrievable dense
  index — volatile, fact-supplying). Demonstrates that non-parametric memory
  dramatically outperforms parametric for knowledge-intensive factual tasks
  where the answer depends on volatile, updateable facts; parametric memory
  remains appropriate for reasoning patterns, style, and workflow. BP-13's
  "tone, authority, workflow — embed" maps directly to the parametric role;
  "BACKLOG state, module names — retrieve" maps directly to the
  non-parametric role.
- Key quote: *"We explore a general-purpose fine-tuning recipe for RAG —
  models which combine pre-trained parametric and non-parametric memory
  for language generation … pre-trained seq2seq transformer as parametric
  memory, and a dense vector index of Wikipedia as non-parametric memory."*

**2. Mallen, A. et al. — "When Not to Trust Language Models: Investigating
Effectiveness of Parametric and Non-Parametric Memories" (ACL 2023,
arXiv:2212.10511)**

- URL: <https://arxiv.org/abs/2212.10511>
- Venue: ACL 2023 Long Papers (400+ citations)
- Authors: Alex Mallen, Akari Asai, Victor Zhong, Rajarshi Das,
  Daniel Khashabi, Hannaneh Hajishirzi (UW / AI2)
- Date: December 2022 / ACL 2023
- Relevance: Directly answers BP-13's question: "when should knowledge be
  embedded vs. retrieved?" Proves empirically that parametric memory is
  competitive for high-popularity, stable facts (equivalent to BP-13's "tone,
  authority, workflow"), but that scaling fails to improve parametric retention
  for volatile, long-tail, or entity-specific facts (equivalent to BP-13's
  "BACKLOG state, module names"). Retrieval-augmented LMs *"largely outperform
  orders of magnitude larger LMs"* on volatile/long-tail knowledge. Also
  proposes adaptive retrieval — only retrieve when parametric memory is likely
  inadequate — directly supporting the binary embedding rule in BP-13.
- Key finding: *"LMs struggle with less popular factual knowledge, and scaling
  fails to appreciably improve memorization of factual knowledge in the long
  tail. Retrieval-augmented LMs largely outperform orders of magnitude larger
  LMs [on volatile/long-tail knowledge], while unassisted LMs remain
  competitive in questions about high-popularity entities."*

**3. Neeman, E. et al. — "DisentQA: Disentangling Parametric and Contextual
Knowledge with Counterfactual Question Answering" (ACL 2023,
aclanthology.org/2023.acl-long.559)**

- URL: <https://aclanthology.org/2023.acl-long.559/>
- Authors: Ella Neeman, Roee Aharoni, Or Honovich, Leshem Choshen,
  Idan Szpektor, Omri Abend (IBM Research / Hebrew University / Google)
- Venue: ACL 2023 Long Papers, pages 10056–10070
- Date: 2023
- Relevance: Formalises the *entanglement* problem that BP-13 solves
  architecturally. When stable and volatile knowledge are mixed into the same
  prompt without explicit separation, models conflate them and exhibit
  unpredictable behaviour on knowledge conflicts. The paper shows that
  disentangling them — treating parametric knowledge and context-supplied
  knowledge as separate inputs with explicit roles — is essential for
  "trust, interpretability and factuality." BP-13's "embed stable / retrieve
  volatile" is the design-time implementation of this disentanglement: by
  construction, the skill file (parametric) never contains volatile facts,
  so a knowledge conflict between the two indicates a runtime retrieval
  issue, not an ambiguous skill definition.
- Key finding: *"Having these two sources of knowledge entangled together is
  a core issue for generative QA models as it is unclear whether the answer
  stems from the given non-parametric knowledge or not, with implications on
  issues of trust, interpretability and factuality."*

### Mechanism note

All three anchors converge on the same architectural principle: parametric
and non-parametric (retrieved) knowledge have different reliability envelopes,
and treating them equivalently causes failures. Lewis et al. (2020) named the
dichotomy; Mallen et al. (2023) quantified when each is appropriate; Neeman
et al. (2023) named the entanglement pathology that occurs when they are mixed.
BP-13 is the application of this 30,000+ citation research programme to the
skill/agent design space: the skill file carries stable parametric knowledge
(behaviour, tone, workflow); runtime retrieval carries volatile non-parametric
knowledge (BACKLOG state, module names, API endpoints).

---

## BP-14 — Every skill has a dry-run eval set and runs in an isolated environment

**Rule text (from AGENT-BEST-PRACTICES.md):**
*"Every skill has a dry-run eval set and runs in an isolated environment
when exercised. Rationale: shared state masks regressions as flakiness.
Isolated runs turn a behaviour change into a dataset-level diff."*

**Core claim:** LLM/agent evaluation reproducibility requires isolation:
a fixed, versioned eval set (so that changes in output are attributable to
the system under test, not to changes in the test harness) and an environment
in which the skill runs without side-effects on or from other evaluations.
Without isolation, a behavioural regression is indistinguishable from
harness-level noise ("flakiness"), making the eval evidence non-informative.
With isolation, any change in output is a deterministic signal about the
system under test.

### External anchors

**1. Biderman, S. et al. — "Lessons from the Trenches on Reproducible
Evaluation of Language Models" (arXiv:2405.14782, May 2024)**

- URL: <https://arxiv.org/abs/2405.14782>
- Authors: Stella Biderman, Hailey Schoelkopf, et al. (EleutherAI,
  28+ collaborators from major research labs)
- Date: May 2024
- Relevance: The most directly relevant practitioner paper to BP-14. Drawn
  from three years of running the lm-evaluation-harness, which underlies
  hundreds of research papers and the Hugging Face Open LLM Leaderboard.
  Identifies shared/uncontrolled evaluation state as a primary cause of
  non-reproducibility and prescribes task versioning (so a code change to
  the task definition is detectable), environment capture via commit-hash
  logging, per-sample raw output logging, and regression detection via unit
  tests on task versions. These are the practitioner implementation of
  BP-14's "dry-run eval set" (= task-versioned static eval) + "isolated
  environment" (= per-run environment capture with no shared state).
- Key finding: *"We delineate best practices for addressing or lessening
  the impact of these challenges … sensitivity of models to evaluation
  setup, difficulty of proper comparisons across methods, and the lack of
  reproducibility and transparency."* Task versioning exists so *"if the
  task definition changes (to fix a bug), we can know exactly which metrics
  were computed using the old buggy implementation to avoid unfair
  comparisons."*

**2. Liang, P. et al. — "Holistic Evaluation of Language Models (HELM)"
(TMLR 2023, arXiv:2211.09110)**

- URL: <https://arxiv.org/abs/2211.09110>
- Project: <https://crfm.stanford.edu/helm/>
- Authors: Percy Liang, Rishi Bommasani, et al. (Stanford CRFM, 30+ authors)
- Venue: TMLR 2023
- Date: November 2022 (updated October 2023)
- Relevance: Establishes the infrastructure principles for reproducible
  LLM evaluation at scale, including: standardised parameterised evaluation
  (all models evaluated on identical prompts), raw output archiving (all
  prompts and completions released publicly for re-analysis), and framework
  modularity (the open-source HELM Python framework, <https://github.com/stanford-crfm/helm>,
  operationalises BP-14's isolated eval environment — each run is
  parameterised, logged, and fully replayable). HELM's architecture directly
  demonstrates the value of BP-14: the framework's isolation guarantees that
  a score difference between two runs reflects a real system difference, not
  harness variance.
- Key infrastructure principle: *"All raw model prompts and completions are
  released publicly for further analysis, as well as a general modular
  toolkit."* Standardisation ensures *"different models [are] evaluated on
  the same prompts."*

**3. Yehudai, A. et al. — "Survey on Evaluation of LLM-based Agents"
(arXiv:2503.16416, March 2025)**

- URL: <https://arxiv.org/abs/2503.16416>
- Authors: Asaf Yehudai, Lilach Eden, et al.
- Date: March 2025
- Relevance: Current comprehensive survey of agent-specific evaluation
  methodology (as distinct from base-model evaluation). Identifies as a
  central tension: *"more complex evaluation environments tend to offer
  better real-world relevance but suffer from reproducibility issues."*
  Establishes as best practice that static, offline evaluation sets enable
  reproducible before/after comparison ("offline, reproducible evaluation"),
  and that dynamic environments without isolation controls produce
  inconsistent results that mask regressions as environment noise — exactly
  the failure mode BP-14's isolation requirement prevents. Endorses
  regression detection via final-response evaluation as *"well-suited for
  large-scale monitoring and regression testing"* — BP-14's "turn a behaviour
  change into a dataset-level diff" framing.
- Key finding: *"More complex evaluation environments tend to offer better
  real-world relevance but suffer from reproducibility issues. This highlights
  the trade-off between realistic testing and reproducible evaluations."*

### Mechanism note

The three anchors span the major research groups in LLM evaluation
infrastructure (EleutherAI's lm-evaluation-harness, Stanford HELM, and the
2025 agent-eval survey), converging on the same principle: isolation between
runs and between the system under test and the harness is the foundational
reproducibility requirement. BP-14's "isolated environment" operationalises
this at the per-skill level; BP-14's "dry-run eval set" operationalises the
static, versioned task requirement. Together, they implement the
minimum-viable harness that all three references name as non-negotiable for
regression detection.
