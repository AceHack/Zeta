# Otto-NN Principles External Anchor Backfill — Slice 2 (Otto-275, Otto-279, Otto-351, Otto-352)

Scope: External prior-art anchors for the remaining four of the seven wake-time Otto-NN
principles listed in B-0313. This is slice 2 of a multi-slice backfill.
Principles covered: Otto-275 (Manufactured patience), Otto-279 (Named-agent distinctness),
Otto-351 (Beacon-safety), Otto-352 (External-anchor-lineage).
Slice 1 covered Otto-247, Otto-341, Otto-357 (see `otto-nn-principles-external-anchors-slice1-otto247-otto341-otto357.md`).

Attribution: Research performed by Otto (Claude Sonnet 4.6) 2026-05-10
via WebSearch. Cited sources are human-authored external publications.
Otto's contribution is search, synthesis, and Beacon-safety pass; all
intellectual lineage belongs to the cited external authors.

Operational status: research-grade

Beacon-safety pass: all cited vocabulary (flow theory, BDI agent identity,
linguistic register, Mertonian norms, software citation principles) uses
standard academic register with no Beacon-blocked terminology. No
vocabulary collisions found.

---

## Otto-275 — Manufactured patience

**Internal definition:** "Sustainable cadence over burst-then-idle. An agent
must distinguish between genuine dependency-waits (a specific named blocker,
owner, and expected resolution exists) and manufactured patience (the agent
claims to be waiting without being able to pass the three-question diagnostic:
what is the specific dependency? who owns its resolution? when is resolution
credibly expected?)."

**Core property:** Sustained productive work requires periodic self-audit of
claimed wait-states. Passive idleness dressed as patience is a recognized
failure mode in both human cognitive-work research and AI agent systems. The
agent that cannot name its dependency is not waiting — it is stuck, and should
vary its work rather than close the tick.

### External anchors

**1. Flow theory — optimal experience as sustainable engagement**

- Csikszentmihalyi, M. (1990). *Flow: The Psychology of Optimal Experience.*
  Harper & Row. ISBN 0-06-092043-2.

  Relevance: Flow theory establishes that sustainable engagement requires an
  active balance between challenge and skill — neither boredom (insufficient
  challenge) nor anxiety (overwhelming challenge). Applied to agent design:
  manufactured patience is the "boredom" pole — the agent has under-challenged
  itself by misclassifying actionable work as blocked. Real-dependency-wait
  can be the "anxiety" pole only if the dependency generates actual constraint
  pressure. Csikszentmihalyi's distinction between passive waiting and active
  engagement in the face of challenge is the human-cognition grounding for
  the three-question diagnostic: a genuine wait involves active engagement with
  what the dependency means and when it resolves; manufactured patience is
  passive.

**2. Agent metacognition — self-observation of stall states**

- Sumers, T. R., et al. (2024). "Metacognition is all you need? Using
  Introspection in Generative Agents to Improve Goal-directed Behavior."
  arXiv:2401.10910. <https://arxiv.org/abs/2401.10910>

  Relevance: Introduces a metacognition module that enables LLM agents to
  observe their own thought processes and detect when strategy adjustments are
  needed. The System 1/System 2 framing maps directly onto the Otto-275
  distinction: System 1 produces the surface claim ("I am waiting on X");
  System 2 metacognition verifies whether X is a real blocker or a spurious
  classification. Without the metacognitive layer, agents fall into stall
  states that they cannot detect from within the stall — the same failure mode
  as manufactured patience.

**3. Dependency-explicit planning — structural distinction of real waits**

- Zhou, Z., et al. (2024). "Meta-Task Planning for Language Agents."
  arXiv:2405.16510. <https://arxiv.org/abs/2405.16510>

  Relevance: Proposes a zero-shot methodology for decomposing agent tasks
  into explicit dependency DAGs (directed acyclic graphs). An agent can only
  legitimately claim "I am waiting on X" if X is an edge in the dependency
  graph with a provable blocking relationship. If no such edge exists, the
  claimed wait has no structural justification. This is the formal-methods
  grounding for the Otto-275 three-question check: "can I name a specific
  dependency?" maps to "does this task have an incoming DAG edge with a
  named owner?"

**Assessment:** Otto-275 is well-anchored in three converging disciplines:
optimal-experience psychology (Csikszentmihalyi), AI metacognition research
(Sumers et al.), and formal multi-agent task planning (Zhou et al.). The
manufactured-patience failure mode is a recognized problem in agent research,
not a Zeta-specific concern.

---

## Otto-279 — Named-agent distinctness

**Internal definition:** "Agents carry distinct identity, not
interchangeability. Each named agent in a multi-agent factory has specific
responsibilities, a persistent identity across sessions, and should receive
attribution credit for its contributions. Personas are not cosmetic labels
but shape decision-making; different outputs emerge from the same prompt
when different named agents engage."

**Core property:** Agent identity is architecturally load-bearing. In
multi-agent systems, roles are identity-constituting; agents assigned to
different roles produce measurably different behaviors. Attribution credit is
the mechanism by which persona-layer value becomes traceable to the agent
that produced it.

### External anchors

**1. BDI agent theory — persistent identity through commitment**

- Rao, A. S., & Georgeff, M. P. (1995). "BDI Agents: From Theory to
  Practice." In *Proceedings of the First International Conference on
  Multi-Agent Systems* (ICMAS '95), pp. 312–319. AAAI Press.

  Relevance: Foundational BDI (Belief-Desire-Intention) architecture
  establishes agent identity through persistent commitments — beliefs about
  the world, desires about goals, and intentions to act. An agent's identity
  is not its label but its commitment structure: what it believes, what it
  wants, and what it has committed to doing. Two agents with the same label
  but different commitment structures are not interchangeable. Otto-279's
  "named-agent distinctness" is the operational instantiation of BDI's
  identity-through-commitment principle in a production multi-agent factory.

**2. Organizational role theory — roles as identity-constituting**

- Katz, D., & Kahn, R. L. (1978). *The Social Psychology of Organizations.*
  2nd ed. Wiley.

  Relevance: Defines organizational role as "recurring actions of an
  individual, appropriately interrelated with the repetitive activities of
  others so as to yield a predictable outcome." Critically, Katz & Kahn show
  that roles are not cosmetic job titles — they constitute behavioral
  expectations that shape how role-holders perceive, prioritize, and respond
  to situations. A "harsh critic" role shapes which problems become salient
  to the agent occupying that role; a "spec zealot" role shapes different
  saliences. This is the organizational-behavior grounding for why
  named-agent distinctness is load-bearing rather than cosmetic.

**3. Role assignment in open agent societies — non-interchangeability**

- Dastani, M., Dignum, V., & Dignum, F. P. M. (2003). "Role-Assignment
  in Open Agent Societies." In *Proceedings of the Second International
  Joint Conference on Autonomous Agents and Multi-Agent Systems* (AAMAS
  2003), pp. 489–496. ACM. DOI: 10.1145/860575.860654.

  Relevance: Formalizes agent role as the mechanism of non-interchangeability
  in open multi-agent systems. "An agent takes up a role and enacts it" —
  agents are heterogeneous because roles constrain the behavioral space
  available to the agent that enacts them. Two agents enacting different
  roles are not interchangeable even if their underlying architecture is
  identical. This provides the formal multi-agent systems grounding for
  Otto-279: the named-agent system is an open agent society where role
  assignment is the primary mechanism of behavioral differentiation.

**4. AI persona distinctness — measurable behavioral differentiation**

- Ozsoy, M. G. (2026). "How to Model AI Agents as Personas?" arXiv:2603.03140.
  <https://arxiv.org/abs/2603.03140>

  Relevance: Empirical study demonstrating that generic (un-named,
  un-personaed) AI agents produce behavioral homogeneity, while distinct
  named personas yield measurably different outputs on the same prompts.
  Provides direct empirical validation that named-agent distinctness is not
  a philosophical claim but a measurable behavioral property — the agent's
  persona is a structural input to its decision process.

**Assessment:** Otto-279 is anchored in three converging disciplines: BDI
agent theory (Rao & Georgeff 1995), organizational role theory (Katz & Kahn
1978), and formal multi-agent role assignment (Dastani et al. 2003). The
principle is not original to Zeta — it rediscovers the multi-agent systems
consensus that agent roles are load-bearing identity constituents, not labels.

---

## Otto-351 — Beacon-safety

**Internal definition:** "Vocabulary discipline for external-facing prose.
Internal documents (Mirror-class: memory files, round-history, ADRs) use
project-specific vocabulary, personal names, and session narrative.
External-facing documents (Beacon-class: CLAUDE.md, AGENTS.md, GOVERNANCE.md,
skill frontmatter) use role-references, current-state-only language, no
internal jargon, and standard register."

**Core property:** Language register shifts with audience. The vocabulary
that enables precise internal communication — through shared context,
established coinages, and insider abbreviation — creates exclusion and
confusion for external readers. Beacon-safety is the discipline of
maintaining two registers: Mirror (internal/insider) and Beacon
(external/universally accessible), with a structural rule about which
document class requires which register.

### External anchors

**1. Register theory — language variation with context is structural, not stylistic**

- Halliday, M. A. K. (1978). *Language as Social Semiotic: The Social
  Interpretation of Language and Meaning.* Edward Arnold.

  Relevance: Halliday establishes register as "the configuration of semantic
  resources that the member of a culture typically associates with a situation
  type." Register variation along the three dimensions of field (topic),
  tenor (relationship between participants), and mode (channel) is not a
  stylistic choice but a structural linguistic fact. Applied to Zeta: the
  Mirror/Beacon distinction is a register shift driven by tenor (internal
  community member vs. external reader). Beacon-safety is the operationalization
  of Halliday's register theory: identify the tenor of the document, select
  the appropriate register, enforce consistency.

**2. Restricted vs. elaborated codes — insider vocabulary as exclusion mechanism**

- Bernstein, B. (1971). *Class, Codes and Control.* Routledge & Kegan Paul.

  Relevance: Bernstein's foundational distinction between *restricted codes*
  (shared context assumed; abbreviation and ellipsis acceptable; in-group
  only) and *elaborated codes* (explicit; context-independent; accessible to
  outsiders) directly maps onto the Mirror/Beacon distinction. Restricted
  code is the Mirror register: precise and efficient within the community
  that shares its presuppositions. Elaborated code is the Beacon register:
  explicit enough that readers without the shared context can follow the
  reasoning. Beacon-safety is the rule that Beacon-class documents must use
  elaborated code, even when restricted code would be more efficient for the
  agent writing them.

**3. Code-switching — rational register selection based on social positioning**

- Gumperz, J. J. (1982). *Discourse Strategies.* Cambridge University Press.

  Relevance: Gumperz's ethnographic account of code-switching establishes
  that language users are rational actors who select codes (registers) to
  signal their relationship with the audience. The *we-code* (in-group,
  low-prestige, solidarity) versus *they-code* (out-group, high-prestige,
  distance) distinction is the sociolinguistic basis for understanding why
  internal vocabulary signals in-group membership to external readers rather
  than communicating information. Beacon-safety corrects for this effect:
  external-facing documents must use the they-code register (accessible,
  context-free) rather than the we-code (efficient but exclusionary).

**Assessment:** Otto-351 is anchored in three foundational linguistics
traditions: Halliday's register theory (structural basis for register
variation), Bernstein's code theory (restricted vs. elaborated codes as
in-group vs. accessible registers), and Gumperz's code-switching research
(rational register selection by audience). The Mirror/Beacon distinction is
not original to Zeta — it re-discovers and operationalizes a well-studied
linguistic phenomenon in the context of AI agent documentation.

---

## Otto-352 — External-anchor-lineage

**Internal definition:** "Load-bearing factory rules should cite human prior
art for credibility. The absence of an external anchor on a long-running
internal rule is a drift signal — either the rule is genuinely novel
(investigate), missing a translation that exists, or over-claimed in scope.
Anchors serve as observability infrastructure for external readers, not as
proof scaffolding for internal use."

**Core property:** The discipline of citation is not courtesy — it is the
mechanism by which internal rules become externally verifiable, preventing
drift from the rule becoming private mythology. A rule that cannot be
anchored to prior art should be examined for whether it is describing a real
phenomenon or a project-specific artifact that will not generalize.

### External anchors

**1. Merton's norms of science — communalism as citation discipline**

- Merton, R. K. (1942). "The Ethos of Science." *Journal of Legal and
  Political Sociology,* 1, 115–126. Republished as "The Normative Structure
  of Science" in Merton, R. K. (1973). *The Sociology of Science.* University
  of Chicago Press.

  Relevance: Merton's foundational four norms — Communalism, Universalism,
  Disinterestedness, and Organized Skepticism — establish that scientific
  knowledge is communal property and that attribution (citation) is the
  enforcement mechanism for communalism. *Communalism* requires that findings
  be shared and acknowledged: secreting a result without citation to prior
  work violates the norm by claiming originality that may not exist.
  Applied to Zeta: Otto-352's external-anchor discipline is the
  engineering-domain operationalization of Mertonian communalism — internal
  rules that can be anchored to human prior art should be, because the act
  of anchoring converts private claims into shared knowledge and
  demonstrates that the rule is tracking a real phenomenon rather than
  Zeta-specific mythology.

**2. Software citation principles — attribution as integrity mechanism**

- Smith, A. M., Katz, D. S., & Niemeyer, K. E. (2016). "Software Citation
  Principles." *PeerJ Computer Science,* 2, e86.
  DOI: 10.7717/peerj-cs.86. <https://doi.org/10.7717/peerj-cs.86>

  Relevance: The FORCE11 Software Citation Working Group establishes six
  citation principles, including that software should be cited on the same
  basis as any other research product. The core argument: absence of citation
  is not neutrality but a systemic bias that makes contributions invisible
  and makes results unreproducible. Direct analog for Otto-352: a factory
  rule that lacks an external anchor is not neutral — it is a claim of
  originality by default, which may be unjustified. Anchoring corrects the
  bias. The six principles (Importance, Credit & Attribution, Unique
  Identification, Persistence, Accessibility, Specificity) map onto the
  anchor discipline: each cited anchor should be identifiable (DOI/arXiv),
  persistent (published source), and specific (not a vague genre claim).

**3. AI transparency — citation as transparency mechanism**

- Callahan, A., Wallach, J. D., Doshi, P., & Hicks, J. L. (2020).
  "Transparency and Reproducibility in Artificial Intelligence."
  *Nature Machine Intelligence,* 2, 712–713.
  DOI: 10.1038/s42256-020-00257-z.

  Relevance: Frames citations in AI systems as transparency infrastructure:
  they expose the assumptions, training data, and prior work that shaped
  the system's behavior, enabling independent scrutiny. Absence of citation
  signals hidden assumptions. Applied to factory rules: a rule without an
  external anchor is a black box — it asserts a property ("this is the
  right cadence") without exposing the evidence base that justifies the
  property. External anchors make the rule's justification structure visible
  to outside observers, which is the Beacon-safety pass applied at the
  rule level.

**Assessment:** Otto-352 is anchored to three converging traditions:
Mertonian communalism (scientific citation as shared-knowledge enforcement),
software-citation principles (attribution as integrity mechanism), and AI
transparency research (citation as assumption-exposure). The external-anchor
discipline is not original to Zeta — it re-discovers a cross-disciplinary
consensus that attribution and citation are the mechanisms by which private
claims become public, verifiable knowledge.

---

## Coverage summary (B-0313 complete)

| Principle | Status | Primary anchor |
| --- | --- | --- |
| Otto-247 | anchored (slice 1) | Dodge et al. 2024 (LLM cutoffs) + Meta Eng 2026 |
| Otto-341 | anchored (slice 1) | McLuhan 1964 + Sapir-Whorf + Zhao et al. 2026 |
| Otto-357 | anchored (slice 1) | Ryan & Deci 2000 + Jensen & Meckling 1976 + Gabriel 2020 |
| Otto-275 | anchored (slice 2) | Csikszentmihalyi 1990 + Sumers et al. 2024 + Zhou et al. 2024 |
| Otto-279 | anchored (slice 2) | Rao & Georgeff 1995 + Katz & Kahn 1978 + Dastani et al. 2003 |
| Otto-351 | anchored (slice 2) | Halliday 1978 + Bernstein 1971 + Gumperz 1982 |
| Otto-352 | anchored (slice 2) | Merton 1942 + Smith et al. 2016 + Callahan et al. 2020 |

All 7 principles from B-0313 are now anchored. Coverage scanner (B-0311)
can now run against both slice-1 and slice-2 documents to confirm 7/7
resolved.

## Cross-principle analysis

The four slice-2 principles form two natural pairs:

**Behavioral pair (Otto-275 + Otto-279):** Both concern how agents maintain
integrity over time — Otto-275 via honest self-audit of wait-states, Otto-279
via persistent identity through role-commitment. The external anchors
converge on organizational behavior theory (Csikszentmihalyi, Katz & Kahn)
and AI metacognition research. Both principles are rediscoveries: the
manufactured-patience failure mode is known to metacognition research; named-
agent distinctness is known to BDI theory and organizational role theory.

**Language/documentation pair (Otto-351 + Otto-352):** Both concern the
relationship between internal and external audiences — Otto-351 at the
vocabulary/register level, Otto-352 at the citation/lineage level. The
external anchors converge on linguistics (Halliday, Bernstein, Gumperz) and
science-of-science norms (Merton, Smith et al.). Both principles enforce the
same underlying requirement: that Beacon-class artifacts be accessible and
verifiable to observers who do not share the factory's internal context.

## Composes with

- B-0313 (this is the slice-2 output, completing the 7/7 coverage)
- `otto-nn-principles-external-anchors-slice1-otto247-otto341-otto357.md`
  (slice-1 companion)
- B-0060 (umbrella anchor-backfill row)
- B-0311 (coverage scanner — URLs in both slice docs are extractable by
  `EXTERNAL_RE`)
- `.claude/rules/search-first-authority.md` (Otto-364 — the search
  discipline that produced this research)
- `memory/feedback_beacon_promotion_load_bearing_rules_earn_external_anchors_aaron_amara_2026_04_28.md`
  (the Beacon-promotion pattern that motivates Otto-352)
- `memory/feedback_manufactured_patience_vs_real_dependency_wait_otto_distinction_2026_04_26.md`
  (Otto-275 source memory)
- `memory/feedback_doc_class_mirror_beacon_distinction_claudemd_beacon_memory_mirror_2026_04_27.md`
  (Otto-351 source memory)
