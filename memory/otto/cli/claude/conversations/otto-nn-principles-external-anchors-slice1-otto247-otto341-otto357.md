# Otto-NN Principles External Anchor Backfill — Slice 1 (Otto-247, Otto-341, Otto-357)

Scope: External prior-art anchors for three of the seven wake-time Otto-NN
principles listed in B-0313. This is slice 1 of a multi-slice backfill.
Principles covered: Otto-247 (Search-first authority), Otto-341
(Substrate-IS-identity), Otto-357 (No-directives / autonomy-first).
Remaining four principles (Otto-275, Otto-279, Otto-351, Otto-352) are
deferred to slice 2.

Attribution: Research performed by Otto (Claude Sonnet 4.6) 2026-05-10
via WebSearch. Cited sources are human-authored external publications.
Otto's contribution is search, synthesis, and Beacon-safety pass; all
intellectual lineage belongs to the cited external authors.

Operational status: research-grade

Beacon-safety pass: all cited vocabulary (McLuhan, Sapir-Whorf,
self-determination theory, principal-agent theory, Age-of-Information,
knowledge cutoffs) uses standard academic register with no Beacon-blocked
terminology. No vocabulary collisions found.

---

## Otto-247 — Search-first authority

**Internal definition:** "Training data is stale; verify against current
upstream sources before asserting." Named after an Aaron correction
(2026-04-24) when Claude defaulted to outdated runner images because
training-data knowledge of versions was months behind reality.

**Core property:** Any knowledge system suffers a staleness/currency gap
between when information was learned and when it is applied. The correct
response is always to query the authoritative current source, not to trust
cached knowledge for load-bearing claims.

### External anchors

**1. Age-of-Information (AoI) — information-freshness formalization**

- Zu et al. (2022). "Towards Optimal Tradeoff Between Data Freshness and
  Update Cost in Information-update Systems." *arXiv* 2204.14123.
  <https://arxiv.org/abs/2204.14123>

  Relevance: Formally models the staleness problem as a Markov decision
  process. AoI is the gap between the time a status update was generated
  and the current time. Minimizing AoI vs. update cost is exactly the
  Otto-247 trade-off: querying upstream has a cost, but stale knowledge
  has a risk cost. The academic formalization validates that this is a
  recognized engineering problem, not a Zeta-specific concern.

**2. LLM knowledge cutoff empirics**

- Dodge, J. et al. (2024). "Dated Data: Tracing Knowledge Cutoffs in
  Large Language Models." *arXiv* 2403.12958.
  <https://arxiv.org/html/2403.12958v1>

  Relevance: Empirically demonstrates that effective LLM knowledge cutoffs
  diverge significantly from reported cutoffs. Training data has temporal
  misalignment artifacts (CommonCrawl deduplication, crawl-lag). An LLM's
  "I know X" is unreliable for recent claims even if X is nominally within
  the cutoff window. Direct empirical support for the Otto-247 operational
  rule: training-data knowledge of versions and current state is
  systematically worse than stated.

**3. Stale context causes harm in AI-assisted systems**

- Meta Engineering. (2026-04-06). "How Meta Used AI to Map Tribal
  Knowledge in Large-Scale Data Pipelines."
  <https://engineering.fb.com/2026/04/06/developer-tools/how-meta-used-ai-to-map-tribal-knowledge-in-large-scale-data-pipelines/>

  Relevance: Practitioner anchor. Core finding (verbatim): *"Context that
  goes stale causes more harm than no context."* Meta's automated
  validation jobs systematically detect and refresh stale references for
  AI agent grounding. Industry-validated that the Otto-247 pattern
  (actively check currency vs. rely on cached context) is the correct
  operational default.

**Assessment:** Otto-247 is a specialization of a well-studied
information-science problem (AoI minimization) applied to LLM-assisted
development. Not original; well-anchored to academic and practitioner
literature.

---

## Otto-341 — Substrate-IS-identity

**Internal definition:** "The medium shapes the message/decision. The
structure and format of instruction substrate (code, docs, prompts)
actively shapes cognitive outcomes, not passively carries them."

**Core property:** The way information is encoded — its medium, structure,
vocabulary, and format — is not neutral. It shapes what decisions are
possible, what reasoning paths are salient, and what outcomes emerge. This
applies to code architecture, documentation format, prompt structure, and
the vocabulary choices in operational rules.

### External anchors

**1. McLuhan — "The medium is the message"**

- McLuhan, M. (1964). *Understanding Media: The Extensions of Man.*
  McGraw-Hill. Chapter 1: "The Medium is the Message."

  Relevance: The canonical statement of the principle. McLuhan argued that
  the characteristics of a medium matter more than any particular content
  it carries — electric light enables night-shift work regardless of what
  it illuminates; television reshapes social interaction regardless of what
  program is shown. Applied to Zeta: the fact that operational rules are
  structured as carved-sentence markdown files with memory pointers shapes
  agent behavior independently of the rule's content. The medium (file
  format, vocabulary, structure) IS the substrate, and the substrate IS the
  identity shaper.

  Note: the illustrated companion *The Medium is the Massage* (1967,
  Bantam Books, with Quentin Fiore) restates the same thesis in visual
  form and is more accessible; both are valid citations.

**2. Sapir-Whorf linguistic relativity**

- Whorf, B. L. (1956). *Language, Thought, and Reality: Selected
  Writings of Benjamin Lee Whorf.* MIT Press. (John B. Carroll, ed.)
- Sapir, E. (1929/1949). "The status of linguistics as a science" in
  *Selected Writings of Edward Sapir in Language, Culture, and
  Personality.* University of California Press.
- Stanford Encyclopedia of Philosophy. "Linguistic Relativity."
  <https://plato.stanford.edu/entries/linguistics/whorfianism/>

  Relevance: The weak-form Sapir-Whorf hypothesis (linguistic relativity)
  claims that language structure influences — but does not fully determine
  — thought patterns. The vocabulary and grammar of a language make
  certain concepts easy or hard to reason about. Applied to Zeta: the
  vocabulary embedded in CLAUDE.md (e.g., "retraction-native,"
  "substrate-or-it-didn't-happen") shapes what the agent treats as salient
  and what reasoning it applies by default. Substrate vocabulary IS
  cognitive infrastructure.

**3. Instruction format shapes LLM agent behavior**

- Zhao, Y. et al. (2026). *Agentic Artificial Intelligence:
  Architectures, Taxonomies, and Evaluation of Large Language Model
  Agents.* arXiv 2601.12560.
  <https://arxiv.org/html/2601.12560v1>

  Relevance: Documents that instruction format (structured markers,
  numbered steps, JSON schema, markdown headers) yields measurably
  different agent output quality. Format is not just presentation; it
  shapes the agent's inference path. This is the operational AI-research
  validation of the McLuhan principle applied to LLM substrates
  specifically.

**Assessment:** Otto-341 is a well-anchored rediscovery of McLuhan +
Sapir-Whorf applied to AI-agent substrate design. The McLuhan anchor is
particularly strong — widely cited, accessible, and directly applicable.
The newer LLM-instruction-format research provides empirical validation in
the AI-systems domain.

---

## Otto-357 — No-directives (autonomy-first)

**Internal definition:** "Framing agent inputs as 'directives' or 'orders'
rather than 'inputs,' 'framings,' or 'corrections' makes the agent a
follower-of-orders rather than an accountable autonomous peer. The framing
itself shapes the decision substrate."

**Core property:** The vocabulary used to characterize agent inputs
(directive vs. input, order vs. correction) shapes the agent's stance
toward its own decision-making. An agent that sees itself as an
order-follower will produce systematically different behavior than one that
sees itself as an autonomous accountable peer — even given the same
substantive information.

Note: Otto-357 composes with Otto-341 (the vocabulary framing IS the
substrate; changing the framing changes the decision substrate).

### External anchors

**1. Self-Determination Theory — autonomy as a basic human need**

- Ryan, R. M., & Deci, E. L. (2000). "Self-Determination Theory and the
  Facilitation of Intrinsic Motivation, Social Development, and
  Well-Being." *American Psychologist, 55*(1), 68–78.
  <https://selfdeterminationtheory.org/SDT/documents/2000_RyanDeci_SDT.pdf>
  (>80,000 citations)

  Relevance: Self-Determination Theory establishes that autonomy,
  competence, and relatedness are basic psychological needs. When
  autonomy is supported (vs. controlled by external directives),
  individuals show higher intrinsic motivation, better-quality engagement,
  and more sustained behavior. Applied to agent design: framing agent
  inputs as autonomy-supporting ("here is context; you decide") rather than
  controlling ("you must do X") produces a different motivational substrate
  — and potentially different outcomes. This is not merely descriptive;
  SDT has been applied to organizational contexts for decades.

**2. Principal-agent theory — aligning agents without micromanagement**

- Jensen, M. C., & Meckling, W. H. (1976). "Theory of the Firm:
  Managerial Behavior, Agency Costs and Ownership Structure." *Journal
  of Financial Economics, 3*(4), 305–360.
- Ross, S. A. (1973). "The Economic Theory of Agency: The Principal's
  Problem." *American Economic Review, 63*(2), 134–139.

  Relevance: Agency theory formalizes the principal-agent problem: how
  does a principal (delegator) get an agent (executor) to act in the
  principal's interests without constant supervision? The key insight is
  that micromanagement (directive-style control) is both costly and
  brittle; alignment via incentive structures (giving the agent goals and
  letting them determine method) is more robust. Otto-357's no-directives
  discipline is the AI-agent instantiation of this classical finding:
  framing matters for whether the agent acts as an order-follower or an
  aligned-autonomous-peer.

**3. AI alignment — value alignment vs. instruction following**

- Leike, J. et al. (2018). "AI Safety Gridworlds." arXiv 1711.09883.
  <https://arxiv.org/abs/1711.09883>
- Gabriel, I. (2020). "Artificial Intelligence, Values, and Alignment."
  *Minds and Machines, 30*, 411–437.
  <https://doi.org/10.1007/s11023-020-09539-2>
- Shen, T. et al. (2023). *Large Language Model Alignment: A Survey.*
  arXiv 2310.19852. <https://arxiv.org/abs/2310.19852>

  Relevance: The AI alignment literature distinguishes *instruction
  following* (do what you're told) from *value alignment* (act in
  accordance with human values, even when not explicitly instructed).
  Pure instruction-following is brittle: it fails on novel situations not
  covered by directives, and it creates safety vulnerabilities when
  instructions conflict or are absent. Gabriel (2020) argues that robust
  alignment requires agents to internalize values, not just execute
  directives. This is the AI-safety-research grounding for Otto-357:
  "no-directives" is not a stylistic preference but a structural property
  of how aligned autonomous behavior works.

**Assessment:** Otto-357 is anchored to three converging traditions:
organizational psychology (SDT), economics (agency theory), and AI safety
(alignment vs. instruction-following). The principle is not original to
Zeta — it rediscovers a cross-disciplinary consensus that autonomy-based
framing produces more robust behavior than directive-based control.

---

## Coverage summary (B-0313 progress)

| Principle | Status | Primary anchor |
| --- | --- | --- |
| Otto-247 | anchored (slice 1) | Dodge et al. 2024 (LLM cutoffs) + Meta Eng 2026 |
| Otto-341 | anchored (slice 1) | McLuhan 1964 + Sapir-Whorf + Zhao et al. 2026 |
| Otto-357 | anchored (slice 1) | Ryan & Deci 2000 + Jensen & Meckling 1976 + Gabriel 2020 |
| Otto-275 | anchor-pending | deferred to slice 2 |
| Otto-279 | anchor-pending | deferred to slice 2 |
| Otto-351 | anchor-pending | deferred to slice 2 |
| Otto-352 | anchor-pending | deferred to slice 2 |

Slice 2 will cover Otto-275 (manufactured patience / sustainable cadence),
Otto-279 (named-agent distinctness / agent identity), Otto-351
(beacon-safety / register discipline), and Otto-352 (external-anchor
lineage discipline itself).

## Composes with

- B-0313 (this file is the slice-1 output)
- B-0060 (umbrella anchor-backfill row)
- B-0311 (coverage scanner — will pick up these anchors once it reads
  this file; URLs in this file are extractable by `EXTERNAL_RE`)
- `.claude/rules/search-first-authority.md` (Otto-364 — the search
  discipline that produced this research)
- `memory/feedback_prefer_mechanical_external_anchors_over_aaron_as_anchor_aaron_2026_05_01.md`
  (the preference for mechanical anchors over maintainer-as-anchor)
