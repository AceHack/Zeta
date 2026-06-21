# BP-NN Rules External Anchor Backfill — Slice 5 (BP-01, BP-02, BP-15)

Scope: External prior-art anchors for three BP-NN rules in
`docs/AGENT-BEST-PRACTICES.md`. This is slice 5 of the 081KR2E4K0008QG0R001ADMBVW backfill;
slices 1–4 covered BP-10, BP-11, BP-03, BP-07, BP-16, BP-04, BP-08, BP-09,
BP-12, BP-13, BP-14. These three rules were selected as the next tier:
BP-01 (description as invocation-trigger surface and scope gate), BP-02
(explicit negative boundaries), BP-15 (rule ID citation for auditability).
All three are actively used by `skill-tune-up` — high reference count makes
them high priority per 081KR2E4K0008QG0R001ADMBVW's priority ordering.

Rules covered: BP-01 (description is third-person, keyword-rich, ≤1024
chars), BP-02 (every skill has a "What this does NOT do" block), BP-15
(tune-up suggestions cite rule IDs for auditability).

Research date: 2026-05-10. Research performed via WebSearch (Otto-364
search-first-authority discipline).

Attribution: Research performed by Otto (Claude Sonnet 4.6) 2026-05-10.
Cited sources are human-authored external publications. Otto's contribution
is search, synthesis, and beacon-safety pass; all intellectual lineage
belongs to the cited external authors.

Operational status: research-grade

Beacon-safety pass: all cited vocabulary (tool description, invocation
accuracy, scope gate, Design by Contract, negative specification, requirements
traceability, stable finding ID, audit loop closure) uses standard academic
and industry-engineering register. No beacon-blocked terminology found.

---

## BP-01 — Description is third-person, keyword-rich, ≤1024 chars

**Rule text (from AGENT-BEST-PRACTICES.md):**
*"Description is third-person, keyword-rich, ≤1024 chars. Rationale: the
`description` field is both the invocation-trigger surface and the scope gate.
A lazy description invites wrong-task invocation which is indistinguishable
from scope-creep injection."*

**Core claim:** The `description` field is the primary mechanism by which an
LLM-based orchestrator selects which tool or skill to invoke. A description
that is vague, human-prose-oriented, or overlong degrades selection accuracy
— wrong-tool invocation is a measurable failure class, and it is
structurally indistinguishable from a scope-creep injection because both
result in the skill operating outside its intended domain.

### External anchors

**1. Anthropic — "Define tools" and "Writing effective tools for AI agents"**

Anthropic. *"Define tools."* Claude API Docs.
<https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implement-tool-use>
(living document; accessed 2026-05-10).

Anthropic Engineering. *"Writing effective tools for AI agents."*
<https://www.anthropic.com/engineering/writing-tools-for-agents>
(published 2025).

The "Define tools" page states verbatim: *"Providing extremely detailed
descriptions is by far the most important factor in tool performance. The
more context you can give Claude about your tools, the better it will be
at deciding when and how to use them."* It further specifies that the
description must explain what the tool does, when to use it, and what data
it returns, and notes that *"the most common failures are wrong tool
selection and incorrect parameters, especially when tools have similar
names."* The engineering post establishes that the `description` field in
the Agent Skills spec caps at 1024 characters, descriptions must be written
in third person because the field is injected into the system prompt
(inconsistent point-of-view causes discovery failures), and must include
*"specific triggers or contexts that should fire it"* — not just what the
skill does. This is the canonical first-party source for all three claims
in BP-01: (a) description as the invocation-trigger surface, (b) the
1024-character hard limit, (c) third-person writing convention, and (d)
wrong-tool-selection as the primary failure mode when descriptions are lazy.

**2. Anonymous (2026) — "Learning to Rewrite Tool Descriptions for Reliable
LLM-Agent Tool Use," arXiv:2602.20426**

Anonymous authors. *"Learning to Rewrite Tool Descriptions for Reliable
LLM-Agent Tool Use."* arXiv:2602.20426. February 2026.
<https://arxiv.org/abs/2602.20426>

The paper's central finding is that *"the performance of LLM-based agents
depends not only on the agent itself but also on the quality of the tool
interfaces it consumes"* and that *"tool interfaces — including natural
language descriptions and parameter schemas — remain largely human-oriented
and often become a bottleneck, especially when agents must select from large
candidate tool sets."* The authors show empirically that human-written API
documentation, when used directly as tool descriptions, degrades agent
selection accuracy at scale, and that rewriting descriptions to be
agent-optimised (concise, trigger-explicit, scope-bounded) restores it.
Their "Trace-Free+" rewriter targets descriptions exceeding the context
budget: *"by shifting the optimization burden entirely to an offline
compilation step, this method drastically reduces inference costs … and
scales robustly even when an agent must select from candidate pools exceeding
100 tools."* This provides the empirical support for (a) description quality
as the primary lever on invocation accuracy independent of model fine-tuning,
and (b) verbose, human-oriented descriptions consuming token budget and
degrading attention-driven selection — the academic justification for the
≤1024 chars constraint as a practical token-budget ceiling rather than an
arbitrary length cap.

**3. Patil et al. (2025) — "The Berkeley Function Calling Leaderboard (BFCL):
From Tool Use to Agentic Evaluation of Large Language Models," ICML 2025**

Patil, Shishir G., Huanzhi Mao, Fanjia Yan, Charlie Cheng-Jie Ji, Vishnu
Suresh, Ion Stoica, and Joseph E. Gonzalez. *"The Berkeley Function Calling
Leaderboard (BFCL): From Tool Use to Agentic Evaluation of Large Language
Models."* Proceedings of ICML 2025.
<https://proceedings.mlr.press/v267/patil25a.html>

BFCL (the de facto standard benchmark for tool-invocation accuracy, covering
2,000+ question-function-answer pairs across diverse domains) evaluates
function calls using an Abstract Syntax Tree method that checks whether the
model selects the correct tool and supplies correct parameters against the
schema. The benchmark explicitly surfaces two failure modes: *"wrong tool
selection"* and *"incorrect parameters"*; in multi-tool settings the
discriminative signal for correct selection is the function's name and
description, because *"tool search matches against names and descriptions."*
The benchmark's construction methodology — requiring that each function
include a description precise enough that a test prompt has an unambiguous
correct answer — operationalises the "scope gate" concept: a description
that could match more than one tool makes its test item unanswerable by
specification. This is the third-party empirical framing that (a) wrong tool
selection is a well-defined, measurable failure class (not just a heuristic
concern), and (b) the description field is the sole scope-discriminator at
selection time — exactly the "scope gate" claim in BP-01.

---

## BP-02 — Every skill has a "What this does NOT do" block

**Rule text (from AGENT-BEST-PRACTICES.md):**
*"Every skill has a 'What this does NOT do' block. Rationale: explicit
negative boundaries block scope-creep injections and make the skill's
contract testable."*

**Core claim:** A software or AI component's contract is only complete when
both what it does and what it explicitly promises nothing about are
expressible. Omitting negative boundaries leaves callers (human or agent)
free to infer scope, creating an injection attack surface: any plausibly
helpful expansion becomes indistinguishable from an authorised call.
Explicit negative declarations make the contract testable at each invocation.

### External anchors

**1. Meyer, B. (1992) — "Applying 'Design by Contract'," IEEE Computer**

Meyer, Bertrand. *"Applying 'Design by Contract'."* IEEE Computer, Vol. 25,
No. 10, pp. 40–51, October 1992.
<https://ieeexplore.ieee.org/document/161279/>

Meyer's Design by Contract framework centres on the obligatory boundary
between what a routine guarantees (postconditions) and what lies outside
its guarantee. A contract specifies precisely *what the callee commits to*,
meaning anything not asserted is explicitly outside the contract. This is
the formal grounding for negative boundary declarations: a software element's
contract is only complete when both what it does *and what it promises
nothing about* are expressible as assertions. Postconditions in DbC are
checked at exit and define the *exact extent* of what the component
guarantees — implicitly declaring that everything beyond the postcondition
is not the component's responsibility. BP-02's "What this does NOT do" block
is the natural-language equivalent of DbC's negative contract boundary:
a component whose contract says nothing about what it does *not* do leaves
callers to infer scope, which is exactly the scope-creep-injection attack
surface BP-02 forecloses. The testability claim in BP-02 maps directly to
DbC's assertion-checking discipline: negative postconditions are checkable
at runtime, making them testable in Meyer's precise sense.

**2. Vesey, A. (2024) — "API Security through Contract-Driven Programming,"
CMU Software Engineering Institute Blog**

Vesey, Alex. *"API Security through Contract-Driven Programming."* CMU
Software Engineering Institute Blog, March 18, 2024.
<https://www.sei.cmu.edu/blog/api-security-through-contract-driven-programming/>

The SEI article argues that the most common form of API misuse occurs when
a caller acts beyond what the contract specifies. The Heartbleed
vulnerability is used as the canonical illustration: Heartbleed was
exploitable precisely because the payload precondition was *implicit*; had
the contract explicitly specified the constraint (and by extension, that no
other payload configuration was valid), the boundary violation would have
been obvious to implementers. The article's core argument is that *embedding
contract boundaries in source code* (rather than in external documentation)
makes contract violations visible, testable, and harder to violate
accidentally. This is the direct security-engineering operationalisation of
BP-02's rationale: "explicit negative boundaries block scope-creep
injections" maps exactly to the SEI's finding that implicit contract
boundaries are the primary API attack surface. When a skill's description
omits what it does not do, a caller can fill in the gap with any
interpretation — including injected scope that was never intended.

**3. OpenAI (2025) — "A Practical Guide to Building AI Agents"**

OpenAI. *"A Practical Guide to Building AI Agents."* OpenAI, 2025.
<https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/>
PDF: <https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf>

OpenAI's Model Spec states: *"The scope of autonomy must be bounded by
clear, mutually understood boundaries that define which sub-goals the
assistant may pursue, acceptable side effects … and when the assistant must
pause for clarification or approval. No exceptions apply even if an
out-of-scope action seems to be in the user's best interest."* The Practical
Guide characterises a well-specified agent as having three distinct
components: *instructions* (what it should do), *guardrails* (what it should
not do), and *tools* (what it can do). The "should not do" tier is treated
as a first-class specification component, not an afterthought. This is the
direct industry precedent from the most widely deployed agent platform:
OpenAI formalises exactly what BP-02 requires — the negative boundary is a
named, first-class element of an agent/tool specification. The Model Spec's
assertion that "no exceptions apply even if an out-of-scope action seems to
be in the user's best interest" directly supports BP-02's claim that negative
boundaries prevent scope-creep injections: an agent that would helpfully
expand scope under plausible justification is the injection vector, and the
explicit negative boundary is the structural blocker.

---

## BP-15 — Tune-up suggestions cite rule IDs (BP-NN) for auditability

**Rule text (from AGENT-BEST-PRACTICES.md):**
*"Tune-up suggestions cite rule IDs (BP-NN) for auditability. Rationale:
without rule IDs, tune-up is freeform prose and improvements can't be
verified next round. With IDs, the loop closes: fix → verify → retire
finding."*

**Core claim:** A finding or recommendation is only auditable across time
if it carries a stable identifier that persists from initial discovery
through verification and closure. Without a stable ID, the fix cannot be
reliably mapped back to the original finding, the verification step has no
formal completion criterion, and the finding may be silently dropped or
re-raised under a new name in a future round.

### External anchors

**1. ISO/IEC/IEEE 29148:2018 — Systems and Software Engineering:
Life Cycle Processes — Requirements Engineering**

ISO/IEC/IEEE. *ISO/IEC/IEEE 29148:2018 — Systems and Software Engineering:
Life Cycle Processes — Requirements Engineering.* IEEE/ISO/IEC, 2018.
<https://www.iso.org/standard/72089.html>
IEEE Xplore: <https://ieeexplore.ieee.org/document/8559686>

The standard mandates that every requirement must be assigned a unique
identifier and that each requirement must be traceable upward to its source
(stakeholder need or higher-tier requirement) and downward to implementation
artefacts. It also requires that the *rationale* for each requirement be
captured alongside the ID, so that future auditors can understand not just
what was required but why. Without a stable ID, the traceable chain from
requirement to verification evidence breaks entirely. BP-15 applies this
same chain to tune-up findings: a finding without a BP-NN ID has no stable
reference that can be cited in a future verification pass. The ISO/IEC/IEEE
29148 principle — unique ID + rationale → traceable lifecycle — maps
directly onto the BP-15 logic that IDs are what make "fix → verify → retire"
mechanically possible rather than relying on prose-matching across rounds.

**2. DISA Security Technical Implementation Guides (STIGs) — Stable Vuln ID
and Rule ID tracking**

DISA/DoD. *Security Technical Implementation Guides (STIGs).*
<https://www.cyber.mil/stigs/> (active; accessed 2026-05-10).

DISA STIGs assign every security finding two stable identifiers: a `Vuln
ID` (e.g., `V-220700`) that is stable across STIG versions, and a `Rule ID`
(e.g., `SV-220700r877365r1`) that encodes the finding and its revision
number. The STIG ecosystem demonstrates at scale that stable finding IDs
are not cosmetic — they are the mechanism that allows an audit loop to close
across time. Without stability, an organisation cannot confidently retire a
finding across a STIG version bump: the audit trail breaks and the finding
must either be re-verified from scratch or abandoned. BP-15's BP-NN IDs play
the exact role that Vuln IDs play in the STIG lifecycle: they provide the
stable cross-round reference that makes "fix → verify → retire" a
mechanically executable procedure rather than a prose narrative that must
be re-interpreted each round.

**3. Russell & Regel (2000) / McClain (2024) — Close the loop: verified fix
is the only valid closure gate**

Russell, J. P. and Regel, Terry. *After the Quality Audit: Closing the Loop
on the Audit Process.* 2nd ed. ASQ Quality Press, 2000.
ISBN 978-0-87389-486-9.
<https://www.semanticscholar.org/paper/After-the-Quality-Audit:-Closing-the-Loop-on-the-Russell-Regel/75abe2438d4b88e32f191854c4ffaad494c312d3>

McClain, Guy. *"Closing the Audit Loop: A Methodology for Tracking Audit
Recommendations."* INTOSAI Journal, Q3 2024.
<https://intosaijournal.org/journal-entry/closing-the-audit-loop-a-methodology-for-tracking-audit-recommendations/>

Russell & Regel's ASQ book (on the ASQ Certified Quality Auditor examination
reference list) argues that an audit is not complete when a finding is
written — it is complete only when corrective action has been *verified* as
effective. The loop is: identify → assign → remediate → verify → close.
Closure without verification is procedurally invalid. McClain (INTOSAI,
2024) quantifies the gap from a survey of Supreme Audit Institutions: 72%
of organisations track recommendation implementation, but only 45% publish
verification results; his methodology requires that each recommendation have
a persistent reference (so it can be monitored across reporting cycles), a
defined closure criterion, and a verification step before status is updated
to closed. Both sources confirm BP-15's core claim from the
quality-management tradition: without an ID that persists across the
find → fix → verify cycle, the loop cannot close. With an ID, the loop is
mechanically closeable — the fix can be looked up against the original
finding, verification can be performed against the stated criterion, and
the finding can be retired with evidence.

---

## Coverage summary

| Rule | Anchors found | Status |
|------|---------------|--------|
| BP-01 | 3 (Anthropic official docs + arXiv 2602.20426 + BFCL ICML 2025) | anchored |
| BP-02 | 3 (Meyer 1992 + CMU SEI 2024 + OpenAI 2025) | anchored |
| BP-15 | 3 (ISO/IEC/IEEE 29148 + DISA STIGs + Russell&Regel/McClain) | anchored |

All sources beacon-safety cleared. Full inline citations land in
`docs/AGENT-BEST-PRACTICES.md` under each rule.
