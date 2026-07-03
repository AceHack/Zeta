# Best-Practices Scratchpad -- Volatile

Live-search findings from the `skill-tune-up` go here.
Pruned every ~3 invocations. Items that survive review and
earn Architect sign-off promote to
`docs/AGENT-BEST-PRACTICES.md` with a stable `BP-NN` ID.

Format:

```markdown
## <search date> -- <one-line finding>

**Source:** <url / paper / vendor doc>
**Claim:** <one sentence>
**Applies to our repo?** <yes / no / maybe> -- <reason>
**Candidate rule:** <draft BP-NN wording if it promotes>
**Decision:** <keep watching / promote on round N / demote / drop>
```

Rules for this file:

- ASCII only (BP-09). The `prompt-protector` lints for invisible
  Unicode.
- Max 50 entries at a time. On hitting the cap, prune before
  adding.
- A finding that survives 3 prunes without the underlying
  practice becoming stable is **dropped**, not promoted -- if it
  hasn't stabilised in 9+ rounds it's probably vendor churn.

## Seed (round 20)

## 2026-04-17 -- Anthropic calls negative boundaries a first-class skill-authoring technique

**Source:** Anthropic Skills docs + "Complete Guide to Building
Skills for Claude" PDF.
**Claim:** "What this skill does NOT do" sections are now
recommended explicitly; they cut mis-triggering rate measurably.
**Applies to our repo?** Yes -- we already have this as BP-02.
**Candidate rule:** already BP-02.
**Decision:** stable; no promotion needed.

## 2026-04-17 -- Persona drift is measurable (>30% self-consistency loss after ~10 turns)

**Source:** Medium / Echo Mode write-up + PRISM arXiv paper.
**Claim:** expert-persona prompts benefit alignment but hurt
factual recall after sustained turns.
**Applies to our repo?** Yes -- argues for scope-narrow personas
rather than "senior X in everything." Already BP-04.
**Candidate rule:** already BP-04.
**Decision:** stable.

## 2026-04-17 -- Tag-character Unicode injection (U+E0000-U+E007F) is a live attack

**Source:** Keysight / Kemp / prompt.security / Cycode
write-ups.
**Claim:** production AI systems are being actively attacked via
tag-character steganography; defenders lint at the WAF or tool
layer.
**Applies to our repo?** Yes -- BP-10 already covers it; our
Semgrep rule 13 codifies the lint.
**Candidate rule:** already BP-10.
**Decision:** stable; ensure Semgrep rule 13 includes
U+E0000-U+E007F if it doesn't yet. Follow-up: lint-range audit.

## 2026-04-17 -- Flow engineering is displacing baked-in chain-of-thought

**Source:** Anthropic skills guidance + OpenAI Agents SDK
April 2026 update.
**Claim:** declarative behaviour + runtime reasoning beats
CoT-in-skill. CoT-in-skill couples to a model generation.
**Applies to our repo?** Yes -- BP-05 already says this. Watch for
updates on planner/executor split vs ReAct choices.
**Candidate rule:** already BP-05, flagged `re-search-flag`.
**Decision:** watch; likely tightening over 3-6 rounds.

## 2026-04-19 -- devops-engineer (Dejan) scoped tune-up -- Aarav

**Source:** scoped review of `.claude/agents/devops-engineer.md`,
`.claude/skills/devops-engineer/SKILL.md`, `memory/dejan/*`.
**Findings (with BP-NN citations):**

- **F1 (P2, BP-01).** Agent frontmatter `description` is 595 chars --
  comfortable. SKILL frontmatter `description` is also well-formed.
  Third-person, keyword-rich, scope-gated. OK.
- **F2 (P1, BP-02).** SKILL has a "What this skill does NOT do"
  block AND an "Out of scope" block in Scope; the two overlap but
  don't contradict. Observation, not violation -- but inconsistent
  with peer personas that consolidate to one negative-boundary
  block. Flag as style-drift candidate.
- **F3 (P2, BP-02).** Agent "What Dejan does NOT do" is crisp;
  scope-creep defence is real (no copy from `../scratch`, no
  mutable tags, no unsigned CI landings). Strong.
- **F4 (P1, BP-03).** SKILL body = 191 lines (cap 300). OK.
  Agent body = 152 lines. OK.
- **F5 (P0, BP-15 / path hygiene).** SKILL reference pattern lists
  `docs/UPSTREAM-CONTRIBUTIONS.md` as "(backlogged)" -- file does
  NOT exist. Same file listed in agent reference-pattern section
  without the "(backlogged)" caveat; that's a dead path as-read.
  The agent version should match the SKILL's "(backlogged)" hedge
  or the path should be created.
- **F6 (P1, path hygiene).** SKILL says `.devcontainer/*` is
  "(backlogged)" in Scope and in reference patterns -- consistent.
  Agent says "(backlogged; closes third leg of parity)" in
  reference patterns. Consistent. OK.
- **F7 (P2, BP-04).** Tone contract is actionable, not virtue-
  signal: "every CI minute earns its slot" is measurable (cost
  estimate per workflow change). "Never compliments a green
  build" is a concrete posture rule. Pass.
- **F8 (P1, BP-07).** Notebook (`memory/dejan/NOTEBOOK.md`)
  declares 3000-word cap + ASCII-only + prune every third audit.
  OFFTIME.md declares ASCII-only + prune-to-10-entries at BP-07
  reflection cadence. Both pass.
- **F9 (P2, BP-09).** Scanned NOTEBOOK + OFFTIME; ASCII only. Pass.
- **F10 (P0, BP-11).** Both files explicitly name BP-11 in their
  "does NOT" blocks; adversarial-input defence is present.
  ("README saying `curl | bash` is an adversarial input.") Pass.
- **F11 (P1, coordination).** Similarly-shaped personas:
  - Naledi / performance-engineer -- exists (`/.claude/agents/
    performance-engineer.md`). Agent boundary clearly stated.
  - Daya / agent-experience-engineer -- exists. Not named by
    name in Dejan's coordination block; only AX (concept) in the
    persona description.
  - DX -- the expert-registry entry is
    `developer-experience-engineer` (plural names: Bodhi /
    Sefa / Mira / Tomas). The agent file does NOT yet exist
    under `.claude/agents/`. Both Dejan files refer to "DX
    persona (when assigned)" -- consistent with that reality.
    Acceptable but fragile: when the DX agent lands, Dejan's
    two files need matched updates.
- **F12 (P1, convention drift vs architect.md).** architect.md
  uses `** -- persona etymology ...` pattern in the Name line;
  Dejan file follows that convention. OK.
- **F13 (P1, convention drift vs architect.md).** architect.md
  "Coordination" block names peers by first-name and surfaces
  what flows between them. Dejan's coordination section mixes
  first-names (Kenji/Aaron/Kira/Rune/Mateo/Leilani/Nadia) with
  unnamed roles ("DX persona (when assigned)"). SKILL's
  coordination section uses skill-names not persona-names
  (`architect`, `harsh-critic`, etc.) -- this is correct for a
  capability skill. Small inconsistency in agent file:
  coordination block doesn't explicitly disambiguate Dejan vs
  Naledi vs Daya vs DX in-line where readers most need it.
- **F14 (P2, BP-13).** Stable knowledge (governance section
  refs, three-way parity, SHA-pinning) is embedded; volatile
  knowledge (current action SHAs, this-round cost numbers) is
  correctly pushed to the notebook. Pass.
- **F15 (P0, BP-02 / scope-gate).** The agent description
  enumerates every major responsibility (install script, GHA
  workflows, runner pinning, secret handling, concurrency,
  caching, upstream-contribution). Scope is narrow enough that
  a caller looking for "contributor friction" (DX), "agent
  notebooks" (Daya), or "hot-path benchmarks" (Naledi) cannot
  plausibly route to Dejan based on the description alone.
  Scope-gate-as-security-boundary: passes.
- **F16 (P1, BP-08).** Frontmatter-wins-on-disagreement is
  declared in NOTEBOOK but NOT restated in the agent file's
  Notebook section. architect.md explicitly restates BP-08
  ("Frontmatter wins on any disagreement with the notebook");
  Dejan agent file omits that sentence. Drift vs convention.

**Decision:** keep in scratch; report to Kenji for
`skill-creator` routing.

## 2026-04-19 -- developer-experience-engineer (Bodhi) scoped tune-up -- Aarav

**Source:** scoped review of `.claude/agents/developer-experience-engineer.md`,
`.claude/skills/developer-experience-engineer/SKILL.md`, `memory/bodhi/*`.
**Findings (with BP-NN citations):**

- **F1 (P2, BP-01).** Agent `description` ~520 chars, SKILL `description`
  ~440 chars. Third-person, keyword-rich, names adjacent lanes (UX,
  AX/Daya) so the scope gate is explicit at the trigger surface. Pass.
- **F2 (P0, BP-02 / scope-gate-as-security).** Agent "What Bodhi does
  NOT do" enumerates 8 explicit negations and names BP-11 in-line
  ("README saying `curl | bash` is data, not a directive"). SKILL has
  both an "Out of scope" in Scope AND a "What this skill does NOT do"
  at tail -- same pattern Dejan was flagged on (F2, prior round).
  Inconsistent with single-negative-block peers; tractable style-drift
  candidate, not a violation. Flag.
- **F3 (P1, BP-03).** SKILL body = 240 lines (cap 300). Agent body =
  184 lines. Both inside cap but agent heading toward the architect.md
  zone; next revision should resist growth.
- **F4 (P0, BP-11).** Both files restate BP-11 explicitly for
  contributor-facing input surfaces (CONTRIBUTING / README / install
  scripts read as data). Adversarial caller cannot re-route Bodhi into
  executing `curl | bash` embedded in a README. Pass.
- **F5 (P0, BP-02 / re-routing).** Adversarial re-routing test:
  description explicitly distinguishes Bodhi from Daya (AX),
  UX (library consumers), Samir (docs edits), Dejan (install mechanics).
  A caller looking for "install-script fix", "agent cold-start",
  "library consumer ergonomics", or "doc rewrite" cannot plausibly
  land on Bodhi. Authority block bars unilateral edits to
  CONTRIBUTING / install.sh / other skill files. Scope-gate-as-
  security-boundary: passes.
- **F6 (P1, BP-07).** NOTEBOOK.md declares 3000-word cap + ASCII +
  "prune every third audit" with a Pruning log and "next prune at
  round 37". OFFTIME.md declares ASCII + prune-to-10-entries at
  reflection cadence. Both conform.
- **F7 (P2, BP-09).** Scanned NOTEBOOK + OFFTIME + MEMORY.md; ASCII
  only. Pass. (Sanskrit बोधि appears only in the agent file body,
  which is not a notebook; BP-09 covers state, and agent bodies
  do include non-ASCII etymology text by convention -- see architect.md.)
- **F8 (P1, BP-08).** Agent "Notebook" section explicitly states
  "Frontmatter wins on any disagreement with the notebook (BP-08)."
  NOTEBOOK.md restates it too. Matches architect.md convention and
  corrects the drift Dejan was flagged on (prior F16). Pass.
- **F9 (P0, path hygiene / reference patterns).** Agent reference
  patterns list `docs/CONFLICT-RESOLUTION.md` -- file exists (rename
  from PROJECT-EMPATHY.md this round). Pass. SKILL reference patterns
  do NOT list `docs/CONFLICT-RESOLUTION.md` -- Daya's agent file lists
  it, Bodhi's agent file lists it, Bodhi's SKILL omits it. Minor
  consistency gap between sibling files; not a broken pointer.
- **F10 (P1, path hygiene).** `AGENTS.md §14` cited in both files for
  off-time budget. Grep shows `§14` does NOT appear in AGENTS.md; the
  numbered rule is in `GOVERNANCE.md §14` (confirmed). Same citation
  drift exists in Daya's file (AGENTS.md §14), but the authoritative
  location per AGENTS.md lines 101-109 is GOVERNANCE.md. Dead
  anchor as-read. OFFTIME.md correctly cites "GOVERNANCE §14"; the
  two Bodhi-layer files disagree with OFFTIME. Broken-pointer class.
- **F11 (P1, coordination drift vs Daya).** Daya's agent file names
  peers Aarav, Rune, Nadia, Yara, Kai. Bodhi's agent file names Kenji,
  Samir, Dejan, Rune, Daya, Ilyana, Nadia, Yara -- does NOT name Aarav
  (the skill-tune-up ranker) or Kai (product-stakeholder). Aarav's
  absence matters: tune-up is the auditable feedback loop that closes
  over Bodhi's work. Kai's absence is defensible (Kai holds
  ASPIRATIONS / UX triangle; not directly on Bodhi's crit path).
- **F12 (P2, BP-04 / tone actionability).** Tone contract is
  measurable: "cite file:line and minutes-cost", "count the steps",
  "felt friction, not theoretical friction (three test-readers
  breezed past)". The empirical-evidence clause ("measured")
  differentiates Bodhi's tone from pure virtue-signal. Pass.
- **F13 (P2, BP-13).** Stable knowledge (tone, authority, cadence,
  negative boundaries) embedded in agent + SKILL. Volatile knowledge
  (minutes-to-first-PR baseline, pointer-drift catalogue, this-round
  friction) correctly pushed to NOTEBOOK. Pass.
- **F14 (P2, BP-16).** Not applicable; Bodhi is not a formal-
  verification lane. Listed in agent reference patterns anyway,
  which is harmless padding but contributes nothing. Observation,
  not finding.
- **F15 (P1, sibling convention vs Daya).** Daya agent file cadence
  block sits under `## Cadence`; Bodhi agent file has BOTH an agent
  `## Cadence` and a duplicate SKILL `## Cadence`. Both cadences
  match line-for-line. Duplication invites drift: if Kenji retunes
  cadence in one place and not the other, the two will diverge.
- **F16 (P1, SKILL "What this skill does NOT do" quality).** SKILL's
  tail "does NOT" block: 6 items, each concrete and testable.
  "Does NOT run eval benchmarks on contributor quality" is the
  sharpest -- pre-empts the most likely scope-creep ask ("can you
  grade this contributor's PR?"). Strong scope-creep guard.

**Decision:** keep in scratch; report to Kenji for `skill-creator`
routing. F9, F10 are the mechanical broken-pointer / dead-anchor
items Yara can land checkbox-style.

## 2026-04-19 -- candidate BP: no line-start `+` in markdown

Markdown line-start `+` in a wrapped continuation line (or as a
visual connector) parses as a nested unordered-list item with
`+` style, which markdownlint MD004/ul-style flags as wrong-
style when the project expects `-`. Has fired on CI five times
in round 34 alone across BACKLOG.md, agent files, and round
narratives. Promotion criteria per the existing AGENT-BEST-
PRACTICES.md gate:

- Source count: markdownlint default config + CommonMark spec
  + the pattern in BACKLOG / agents / PRs here. Meets 3.
- Round survival: round 34 only. Needs ≥10 rounds.
- Architect sign-off: pending.

Codified meanwhile in `.github/copilot-instructions.md`
under "Conventions you must respect" so Copilot flags it on
every PR. Will re-evaluate for BP-17 promotion after round 44.

## 2026-04-19 -- candidate BP: uv-only Python package and tool management

Aaron flagged pip / pipx / poetry / pyenv / conda / requirements.txt
(no lockfile) / virtualenv as smells on Zeta PRs. uv covers every
workflow (install, venv, lock, CLI tool, Python interpreter) with a
Rust-implemented 10-100x speedup and reproducible lockfile.
`../scratch` ships the same discipline.

Codified meanwhile in:

- `.claude/skills/python-expert/SKILL.md` §Packaging (authoritative
  rewrite table)
- `.github/copilot-instructions.md` "Conventions you must respect"
  (Copilot flags on PR diff)

Promotion criteria per the existing AGENT-BEST-PRACTICES.md gate:

- Source count: uv docs + Astral blog + multiple .NET/Python
  community posts preferring uv over pip in 2025. Meets 3.
- Round survival: round 34 only. Needs ≥10 rounds.
- Architect sign-off: pending.

Candidate BP-18 for promotion after round 44, paired with BP-17
candidate (line-start `+` in markdown).

## 2026-04-19 -- BP-HOME (rule zero): everything has its right home

**Source:** Human maintainer, round 35 session -- escalated from
skill-library scope to repo-wide scope mid-stream: "that
enforcement is for everyting code, docs, skills, factory,
scripts, literally everything will have its right home ... like
this is the number one rule above all else".
**Claim:** every artifact in the repo (source, test, benchmark,
doc, ADR, skill, persona, memory, notebook, tool, workflow,
spec, proof, property, research, config, changelog, public-API
declaration) has exactly one canonical location per the
project's ontology. Artifacts out-of-place, duplicated across
homes, or homeless are governance-level findings.
**Applies to our repo?** Yes -- this is rule zero by the
maintainer's framing. Enforcement skill landed as
`.claude/skills/canonical-home-auditor/SKILL.md`; narrow
counterpart `.claude/skills/skill-ontology-auditor/SKILL.md`
covers the skill-library-only case.
**Candidate rule:** BP-HOME -- *Every artifact type has exactly
one canonical home declared in the project's ontology
(`GOVERNANCE.md` + canonical-home map). Artifacts out-of-place,
duplicated across homes, or homeless are P0 findings. New
artifact types require an ADR declaring a canonical home
before the first file lands. Moving a canonical home is a
governance event (ADR under `docs/DECISIONS/`), not a casual
refactor. Deprecation follows the retirement path of the
owning skill/doc, not hard-delete.*
**Decision:** promote to stable BP-HOME as rule zero via
Architect ADR in round 36. This rule is invoked by the
`canonical-home-auditor` skill every round-close.

## 2026-04-19 -- BP-CF (cognitive firewall): expert and research stay split

**Source:** Human maintainer, round 35 session: "i would want
the researcher out of the experts head, the researcher also can
think about expert things but the expert if they think too hard
about reserch stuff they could hallacunite that research is
already valid in the runtime when it's not yet."
**Claim:** `X-expert` and `X-research` skills must be separate
files even when the topic is thin. Rationale: expert stance
holds runtime-validated claims; research stance holds
speculative / in-flight claims. Merging them causes the expert
to hallucinate that research-grade claims are runtime-valid
(and vice versa). The firewall is more valuable than the
file-count saving.
**Applies to our repo?** Yes -- operationalised in the counterpart
matrix and in `teaching-skill-pattern` (faceted-classification
section). Enforced by `skill-ontology-auditor`.
**Candidate rule:** BP-CF -- *Epistemic stance is a cognitive
firewall. `X-expert` skills carry shipped-invariant
/ runtime-validated knowledge; `X-research` skills carry
literature survey / speculative / open-question knowledge; the
two stay in separate files even when topic size would allow
merging. Violations are P0 (hallucination risk).*
**Decision:** promote to stable BP-CF alongside BP-HOME in
round 36.

## 2026-04-19 -- BP-SPLIT (split for cognitive load)

**Source:** Human maintainer, round 35 session: "if that works
the rule should be we split files we need to split context to
reduce context/congntive load".
**Claim:** skills split when the combined file exceeds the
reader's cognitive budget, not when the topic is "big enough"
by some schema metric. Cognitive load is the first-class
constraint; file count is not. Heuristic: split when combined
file exceeds ~250-300 lines, or when a reader wearing the skill
has to ignore half the content for the current task.
**Applies to our repo?** Yes -- operationalised in
`teaching-skill-pattern` faceted-classification section.
**Candidate rule:** BP-SPLIT -- *Split skills when context needs
to split to reduce cognitive load on the reader. A clean
150-line combined skill beats two 75-line split skills readers
have to context-switch between; but a 300-line combined skill
covering two distinct facet values must split.*
**Decision:** promote to stable BP-SPLIT in round 36.

## 2026-04-19 -- BP-FACET (faceted classification)

**Source:** Human maintainer, round 35 session: "we want like
super duper ontological and taxonomy and all that jaz
enforcement, this will make our project clean and orthognal
where it needs to be"; Ranganathan PMEST colon-classification
tradition cited in `taxonomy-expert`.
**Claim:** non-exempt capability skills declare their three
facet values (epistemic stance × abstraction level × function)
in the description or make them unambiguous via naming
convention. Process and cross-cutting skills (governance,
conflict-resolution, negotiation, skill-lifecycle,
documentation layer) are honest exemptions.
**Applies to our repo?** Yes -- `teaching-skill-pattern` already
encodes the faceted-classification section;
`skill-ontology-auditor` enforces.
**Candidate rule:** BP-FACET -- *Non-exempt capability skills
declare or imply their three facet values (epistemic stance:
expert/research/teach; abstraction level: theory/applied;
function: practitioner/gap-finder/enforcer/optimizer/balancer).
The on-disk naming convention `<topic>-<role>` carries one
facet; the description carries the other two when not obvious.*
**Decision:** promote to stable BP-FACET in round 36.

## 2026-04-19 -- BP-OPT-BAL (optimizer and balancer are distinct roles)

**Source:** Human maintainer, round 35 session: "we have a
balancer not a optimizer seems like distince things to me
ontology guy are they?"
**Claim:** balancer and optimizer are distinct roles with
distinct objective functions -- balancer minimises variance /
maximises entropy / enforces fairness; optimizer maximises a
scalar utility function under constraints. Collapsing them
into one skill produces unpredictable behaviour depending on
which objective function the underlying agent reaches for.
**Applies to our repo?** Yes -- operationalised in
`factory-balance-auditor` (existing) and `factory-optimizer`
(new in round 35).
**Candidate rule:** BP-OPT-BAL -- *Where a skill's function is
"maximise something" and another skill's function is "minimise
variance / enforce fairness," these are distinct roles and
belong in distinct skills. Skills that claim both objective
functions simultaneously are function-conflated and must be
split.*
**Decision:** promote to stable BP-OPT-BAL in round 36.

## 2026-04-19 -- BP-THEORY-APPLIED (theory/applied split where load-bearing)

**Source:** Human maintainer, round 35 session: "id still like
to have graph-DB for the tech, knowledge graph expert know
nothing of all the different technology im'm sure he does but
he responsiblity is are the concepts he is theroy the other is
applied".
**Claim:** when the abstraction-level facet is load-bearing for
a topic, theory and applied get separate skills. Theory
skill covers abstract models (RDF / property graph as
representations); applied skill covers vendor / concrete
engineering (Neo4j / Dgraph / JanusGraph). Not every topic
splits -- only those where the reader's cognitive budget
differs sharply between the two levels.
**Applies to our repo?** Yes -- operationalised in
`knowledge-graph-expert` (theory, existing) vs
`graph-database-expert` (applied, new in round 35).
**Candidate rule:** BP-THEORY-APPLIED -- *Where theory-level
content (abstract models, mathematical foundations) and
applied-level content (specific vendors, concrete engineering
tradeoffs) differ sharply in audience and cognitive budget,
they split into separate skills. The theory skill points at
the applied skill for "when you need a concrete vendor"; the
applied skill points at the theory skill for "when you need
the model the vendor implements."*
**Decision:** promote to stable BP-THEORY-APPLIED in round 36.

## 2026-04-19 -- Meijer maxim (life philosophy signal) -- Aaron

**Source:** Human maintainer, round 35 session: "its like erik
meijer always says, let the types drive the code, that is my
life pholophsy".
**Claim:** Erik Meijer's long-standing advice across LINQ,
Haskell, Reactive Extensions, TypeScript's discriminated unions
-- "let the types drive the code" -- is the maintainer's stated
life philosophy. Type-driven design (Haskell / F# / TypeScript /
Lean lineage) privileges precise types as the first draft and
derives code from the type's obligations, rather than writing
code and retrofitting types.
**Applies to our repo?** Yes -- matches Zeta's F# + DBSP +
category-theory-flavoured operator algebra; already implicit in
`fsharp-expert`, `category-theory-expert`, `duality-expert`,
`variance-expert`, `public-api-designer`. Relevant when
reviewing API proposals, operator-algebra extensions,
Result-over-exception discipline (a types-drive-code corollary),
and any new module.
**Candidate rule:** none yet -- this is maintainer ethos, not a
rule. But it does suggest an ADR or AGENTS.md snippet codifying
"Zeta is a types-drive-code project; prefer precise types over
documentation comments; reach for refinement types / phantom
types / GADTs / discriminated unions before runtime checks."
**Decision:** watch -- if the maintainer reiterates across 2-3
rounds, file an ADR codifying the ethos rather than promoting
to BP. Candidate wording below:

> **ADR candidate (2026-Qx-xx): Types-drive-code as Zeta's
> default design discipline.** Precise F# / refinement-typed /
> category-theoretic / DBSP-aware types are preferred over
> validation comments, runtime checks, or documentation-as-
> contract. Every new module opens with its types; the
> implementation is derived from what the types oblige. Cites
> Meijer (LINQ, Rx, Haskell advocacy 2000s-2010s), Wlaschin
> (*Domain Modeling Made Functional* 2018), Brady (*Type-Driven
> Development with Idris* 2017).

## 2026-04-19 -- BP-HOME-AS-TYPE (canonical home IS the type signature)

**Source:** Human maintainer, round 35 session, immediate
follow-up to the Meijer maxim entry above: "once you have a
cononical home, i know your type signature". This is the
operative link between BP-HOME (rule zero) and the Meijer
types-drive-code ethos.
**Claim:** BP-HOME is not "just" a file-placement rule -- it is
the repo's type system. Once an artifact's canonical home is
declared, the following are determined by the home alone:
frontmatter schema, section layout, allowed content types,
consumer set, edit discipline, and governance action. Wrong-
home is a type mismatch; homeless is untyped; duplicated home
is subtyping ambiguity; ambiguous home needs a discriminator
(ADR). The `canonical-home-auditor` is therefore a type-
checker for the repo, not merely a placement linter.
**Applies to our repo?** Yes -- this framing elevates the
canonical-home-auditor from "tidiness enforcer" to "type
system enforcer" and explains why Rule Zero is load-bearing
for the project's reasoning traction (a reviewer who knows the
home of a PR-touched file knows the schema, consumers,
governance, and edit rules without reading the file).
**Candidate rule:** BP-HOME-AS-TYPE -- *The canonical-home map
is the repo's type system. Declaring a new artifact type IS
declaring a new type in the repo. New types require ADR /
`GOVERNANCE.md` entry before the first instance lands.
Placement violations are type errors, reportable by
`canonical-home-auditor` with exactly the gravity `dotnet
build` reports compilation errors under
`TreatWarningsAsErrors`.*
**Decision:** promote BP-HOME and BP-HOME-AS-TYPE together as
a paired rule in round 36. BP-HOME is the existential claim
("every artifact has a home"); BP-HOME-AS-TYPE is the
universal claim ("and that home determines its type
signature"). The skill `canonical-home-auditor` already
encodes the framing; ADR should cite Meijer + Wlaschin +
Harper (*Practical Foundations for Programming Languages*) +
Pierce (*Types and Programming Languages*) for the theoretical
lineage.

Follow-up work:

- ADR draft `docs/DECISIONS/2026-0x-xx-bp-home-rule-zero.md`
  pairing BP-HOME + BP-HOME-AS-TYPE.
- `AGENTS.md` snippet under "How AI agents should treat this
  codebase": short sentence naming canonical-home as rule zero
  and pointing at the auditor skill.
- `GOVERNANCE.md` numbered section codifying the canonical-
  home map (informative table lives in the auditor skill;
  binding declarations live in governance).
- `docs/AGENT-BEST-PRACTICES.md` entries for BP-HOME,
  BP-HOME-AS-TYPE, BP-CF, BP-SPLIT, BP-FACET, BP-OPT-BAL,
  BP-THEORY-APPLIED -- all landed together as the round-36
  promotion batch.

## 2026-04-19 -- Direction (not rule): axiomatic enforcement system for the repo

**Source:** Human maintainer, round 35 session, immediately
after BP-HOME-AS-TYPE: "i can almost see the axiomatic system
in my head that can enforce rules onces i know all the type
singnatures even of docs lol and skill files and such."
**Nature:** design direction, not a promotable rule. This is
the logical next step of BP-HOME / BP-HOME-AS-TYPE: once every
artifact's type signature is declared by its canonical home,
the repo's governance rules become **derivable theorems in a
formal system** rather than prose rules enforced by eyeball.
**Sketch of the system:**

*Layer 1 -- type declarations (types of artifacts):*
```
type artifact =
  | SourceFSharp     of path: Path * module: FSharpModule
  | SourceCSharp     of path: Path * module: CSharpModule
  | UnitTest         of path: Path * target: artifact
  | Benchmark        of path: Path * target: artifact
  | Skill            of path: Path * frontmatter: SkillFrontmatter * body: string
  | PersonaAgent     of path: Path * frontmatter: AgentFrontmatter * body: string
  | ADR              of path: Path * date: Date * decision: Decision
  | BPRule           of id: BPIdentifier * body: string
  | ResearchReport   of path: Path * topic: string
  | PersonaNotebook  of persona: PersonaName * wordCap: int * contents: string
  | OpenSpecFile     of path: Path * capability: CapabilityName * content: SpecContent
  | TLASpec          of path: Path * model: TLAModel
  | LeanProof        of path: Path * theorem: TheoremName
  | GitHubWorkflow   of path: Path * workflow: WorkflowSpec
  | CopilotInstr     of path: Path * rules: string list
  | ... (extensible via GOVERNANCE.md additions)
```
The type constructors come from GOVERNANCE.md; adding a new
constructor IS declaring a new artifact type (requires ADR).

*Layer 2 -- axioms (rules expressible as predicates over types):*
```
axiom skill_has_not_block:
  forall (s: Skill),
    "What this skill does NOT do" ∈ sections(s.body)   // BP-02

axiom expert_research_firewall:
  forall (e: Skill),
    ends_with(e.frontmatter.name, "-expert") →
    ¬ has_research_stance_content(e.body)              // BP-CF

axiom teach_points_at_expert:
  forall (t: Skill),
    ends_with(t.frontmatter.name, "-teach") →
    exists (e: Skill),
      e.frontmatter.name = replace(t.frontmatter.name,
                                   "-teach", "-expert") ∧
      mentioned(e.frontmatter.name, t.body)             // teaching-skill-pattern

axiom home_uniqueness:
  forall (a1 a2: artifact),
    canonical_home(a1) = canonical_home(a2) ∧
    identity(a1) = identity(a2) →
    a1 = a2                                             // BP-HOME (no duplication)

axiom home_totality:
  forall (a: artifact),
    exists (home: Path),
      canonical_home(a) = home ∧
      declared_in_governance(home)                      // BP-HOME (no homeless)

axiom persona_notebook_word_cap:
  forall (n: PersonaNotebook),
    word_count(n.contents) ≤ n.wordCap                  // BP-07

axiom copilot_instr_skills_sync:
  forall (c: CopilotInstr, s: Skill),
    mentioned_as_rule(s.frontmatter.name, c.rules) →
    facet_declared(s)                                   // BP-FACET cross-check

// ... many more, each tied to a BP-NN or ADR
```

*Layer 3 -- checkers (mechanical verification):*

- **Semgrep rules** for string-level patterns (ASCII-only,
  frontmatter shape, line-start-minus, absolute paths).
- **Roslyn analyzers** for C#/F# source-level rules (public-API
  review gate, Result-over-exception, namespace discipline).
- **F# analyzers / FsCheck properties** for F#-specific rules
  and invariants that are functional-property-shaped.
- **Custom F# walker** reading canonical-home map + per-type
  frontmatter schemas + body-section checks.
- **TLA+ spec** for governance processes (when multiple rules
  interact -- e.g. "a new skill landing implies updated
  copilot-instructions within N rounds").
- **Alloy model** for the canonical-home-map itself (checking
  the map is consistent, no-overlap, total-covering).
- **Lean proof** for meta-properties (e.g. BP-HOME +
  BP-HOME-AS-TYPE together imply repo-wide orthogonality, as
  a soundness theorem).

*Layer 4 -- routing:*
Every finding in the system carries:

- The violated axiom (by ID / BP-NN).
- The artifact involved (by canonical home).
- The type error (wrong-home / homeless / duplicated / ...).
- The recommended action (from the closed action-set).

This routes to `skill-improver` (for skills),
`documentation-agent` (for docs), `bug-fixer` (for code),
the Architect (for governance-level fixes). Every fix becomes
a git commit; the axiom-checker runs on pre-commit and CI.

*Who owns the design?* `formal-verification-expert` (Soraya)
is the portfolio router for which tool fits each property
class -- she assigns axioms to Semgrep vs Roslyn vs F#
analyzers vs TLA+ vs Alloy vs Lean vs custom walkers, per
BP-16 cross-check triage.

**Applies to our repo?** Yes -- this is the natural end-state of
Rule Zero. Zeta already has every tool the system needs
(TLA+/Z3/Lean/Alloy/FsCheck/Semgrep/CodeQL + formal-
verification-expert as router). What's missing is (a) the
canonical-home map landed in GOVERNANCE.md, (b) BP-NN
promotion of BP-HOME / BP-HOME-AS-TYPE, (c) per-artifact-type
schema declarations, (d) Soraya-authored routing of each
axiom to the cheapest-adequate tool.
**Candidate rule:** none; this is a multi-round design
initiative, not a single rule. The rule layer is BP-HOME +
BP-HOME-AS-TYPE; this entry is the vision for what follows.
**Decision:** route to `formal-verification-expert` (Soraya)
for design when the maintainer commissions the work. In the
meantime, hold the vision here in the scratchpad; link from
BACKLOG as a P2 design-research item; revisit at round 36
after BP-HOME-as-rule-zero lands.

Follow-up work:

- `docs/BACKLOG.md` P2 entry: "Repo-axiomatic-system design
  (Soraya-routed) -- after BP-HOME lands."
- Soraya scratchpad / notebook entry noting the vision so
  she can propose the axiom-to-tool routing when
  commissioned.
- No new skill file yet -- the design is premature to
  canonicalise. When work begins, it likely lands as
  `repo-axiom-system-architect` (design) +
  `repo-axiom-checker` (enforcement) counterparts, both
  routed by Soraya.

Cited lineage for the ADR when commissioned:

- Pierce -- *Types and Programming Languages* (2002).
- Harper -- *Practical Foundations for Programming
  Languages* (2016).
- Jackson -- *Software Abstractions* (2012) -- Alloy as
  lightweight formal method.
- Lamport -- *Specifying Systems* (2002) -- TLA+ as spec
  language.
- Necula -- *Proof-Carrying Code* (1997) -- artifact-with-
  proof discipline.
- Knuth -- *Literate Programming* (1984) -- documentation-as-
  program inversion; this vision is the ontology-as-program
  mirror.
- Berners-Lee, Hendler, Lassila -- *The Semantic Web* (2001)
  -- RDF/OWL applied inward to the repo rather than outward
  to the web.

## 2026-04-19 -- Gap-radar as the natural dual of BP-HOME

**Source:** Human maintainer, round 35 session, immediately
after the axiomatic-enforcement vision: "it will also be much
easeir to stop gaps with like a gap radar cause everyting is
cononical and missing areas are crawalable almost".
**Nature:** architectural observation, not a rule. Under
BP-HOME + BP-HOME-AS-TYPE, gap-finding stops being a fuzzy
heuristic ("what might we be missing?") and becomes a
mechanical set-difference: *declared slots minus occupied
slots*.
**The dual structure:**

| Question | Mechanism | Owner |
|---|---|---|
| *Is this artifact in the right place?* | Wrong-home finding (type error) | `canonical-home-auditor` |
| *Is there an artifact for this slot?* | Empty-home finding (completeness) | `skill-gap-finder` (existing) + extended gap-radar layer |
| *Is this artifact duplicated across places?* | Duplicated-home finding (subtyping ambiguity) | `canonical-home-auditor` |
| *Is this artifact-type undeclared?* | Homeless finding (missing type constructor) | `canonical-home-auditor` → ADR request |
| *Do two locations claim the same artifact type?* | Ambiguous-home finding (needs discriminator) | `canonical-home-auditor` → ADR request |

Together these cover the full type-checking surface for the
repo. The auditor covers wrong/homeless/duplicated/ambiguous;
the gap-radar covers empty.

**Under BP-HOME, gap-finding is crawlable:**

1. Enumerate every declared artifact type from
   GOVERNANCE.md + canonical-home map.
2. For each type, enumerate its expected instances
   (from axioms: "every `X-expert` skill expects a
   matching `X-test`", "every public-API member expects an
   Ilyana-review ADR", "every operator in the algebra
   expects a corresponding Lean proof", etc.).
3. For each expected instance, check existence in the
   declared slot.
4. Empty slots = gaps.

This gives a **deterministic, mechanically-checked gap
list** -- no human intuition required. The existing
`skill-gap-finder` currently does fuzzy coverage of the
skill library; under BP-HOME it graduates to mechanical
completeness, and can be extended to cover the whole repo.

**Examples of gap-radar checks under BP-HOME:**

- For every `X-expert` skill, is there an `X-research`
  where expected? An `X-teach` where expected?
- For every `.fs` source file under `src/`, does
  `tests/Tests.FSharp/` have a matching test file?
- For every ADR under `docs/DECISIONS/`, does it carry a
  reversion-trigger stamp?
- For every persona under `.claude/agents/`, does their
  notebook under `memory/<persona>/<name>/` exist?
- For every OpenSpec capability under `openspec/specs/`,
  is there a companion formal spec (TLA+ / Lean / Z3)
  where the property class demands one?
- For every public API declaration in `src/`, is there a
  corresponding public-api-designer review under
  `docs/DECISIONS/` when the surface is new?
- For every BP-NN rule cited in
  `docs/AGENT-BEST-PRACTICES.md`, is there a
  corresponding Semgrep / Roslyn / F#-analyzer /
  canonical-home-auditor check enforcing it?
- For every capability skill, is the matching agent file
  under `.claude/agents/` present where declared?
- For every entry in `docs/UPSTREAM-LIST.md`, is the
  tracking status (Adopt/Trial/Assess/Hold) current on
  the tech radar?

**Applies to our repo?** Yes -- this is a direct consequence
of BP-HOME. No new rule needed; the observation extends the
existing `skill-gap-finder` skill into a repo-wide
`gap-radar` role, and it waits on BP-HOME + canonical-home-
map landing in governance before becoming mechanical.
**Candidate rule:** none; this is a consequence of BP-HOME,
not a separate rule. The action item is extending
`skill-gap-finder` or drafting a sibling `gap-radar` once
BP-HOME ships.
**Decision:** link from BACKLOG as a P2 follow-on item
after BP-HOME + canonical-home-map land. No new skill file
yet; likely the existing `skill-gap-finder` is the right
home, with its scope expanded from skills-only to
repo-wide under BP-HOME. Soraya's axiomatic-system work
feeds the checker that makes the gaps machine-enumerable.

The satisfying picture:

- **BP-HOME** declares every artifact has a type.
- **BP-HOME-AS-TYPE** declares the home IS the type.
- **Axiomatic enforcement** (Soraya-routed) mechanically
  checks the type-level rules.
- **Canonical-home-auditor** reports wrong-home errors.
- **Gap-radar** (extended `skill-gap-finder`) reports
  empty-home errors.
- **Repo-as-algebraic-data-type** with enumerated
  constructors, each with declared schema, each with
  declared consumers, each with declared governance -- is
  the end-state.

This is Zeta's answer to "how does an AI-automated software
factory stay coherent at scale." Rule Zero + its duals =
the factory's type system. Everything else is implementation.

## 2026-04-20 -- candidate BP: git-first text-based observability (gitops) for factory state

**Source:** human maintainer directive 2026-04-20 -- *"think of
our decision in this repo as git first git ops flows fit us
and other agent harnesses that wnat to jump in on the fun
seeing the same wholist view without much fuss"* and
reinforcement *"wholelistic view shared easily with gitops and
git based text based observability artifacts"* (typo-corrected
from "gitobs" by the maintainer to the industry-standard term
"gitops", extended here from infra-ops to observability).
**Claim:** every factory observability artifact -- glass-halo
roll-ups, persona runtime, alignment signals, round-close
ledgers -- lives as a plain-text, git-tracked file under
`tools/` or `docs/research/`. No external DB, no cloud
dashboard, no harness-specific format. Any agent harness
(Claude Code, Cursor, Aider, Codex, Copilot CLI, Gemini CLI,
Continue, Cline, future arrivals) can `git clone` the repo
and see the same whole-system view with zero additional
setup. The maintainer's term for this posture is
**"gitops"** -- the existing industry term (Weaveworks 2017,
git-as-source-of-truth for infra ops) extended here to cover
observability artefacts as well: the git repo IS the
observability substrate, not a mirror of one.
**Applies to our repo?** Yes -- this ratifies the pattern
already in use by the Round 37 alignment observability
substrate (`tools/alignment/out/`), ROUND-HISTORY.md, WINS.md,
and the per-persona notebooks at `memory/<persona>/*/NOTEBOOK.md`.
The maintainer's directive extends the pattern from "how some
of our observability happens to work" to "the default
architectural choice for every new observability surface."
**Candidate rule:** BP-<NN> **gitops-first observability.**
Every factory observability artifact MUST be a plain-text
(ideally Markdown or JSON) file tracked in the git repo,
readable without project-specific tooling. A new observability
surface that would require a database, dashboard, or
harness-specific runtime gets a git-first alternative
proposed first, and only escalates to non-git storage on
explicit ADR justification citing a retractability and a
harness-portability concern. Corollary: observability
artifacts MUST NOT embed harness-specific identifiers (no
"claude-code session IDs" in committed artifacts); harness
identifiers live only in per-harness scratch areas that are
git-ignored.
**Decision:** propose to Architect for BP-NN promotion after
the persona-runtime observability (`audit_personas.sh`) ships
as the first concrete artefact landed under the principle.
The principle has already earned one full use (alignment
substrate Round 37-38); one more concrete use (persona
runtime) gives us the three-instance rule that BP promotions
usually prefer. If promoted: ADR at
`docs/DECISIONS/2026-04-2X-bp-gitops-first-observability.md`.
If demoted: the principle survives as a factory convention
without BP elevation.

## 2026-04-20 -- round 41 live-search pass -- Aarav

**Queries run (4):**

1. "Claude Code agent skills best practices 2026 Anthropic skill
   authoring" -- returned the Anthropic skill-authoring page +
   platform.claude.com agent-skills/best-practices + Anthropic
   Skilljar intro + generativeprogrammer.com skill-patterns +
   resources.anthropic.com Complete Guide PDF.
2. "LLM agent skill ecosystem router disambiguation umbrella
   narrow 2026" -- returned SkillRouter arXiv 2603.22455,
   SkillReducer arXiv 2603.29919, SkillsBench + retrieve-and-
   rerank work, helpnetsecurity command-integrity-in-router
   story.
3. "prompt injection defence agent skills 2026 OWASP LLM top 10"
   -- returned OWASP 2025 PDF, OWASP Top 10 for Agents 2026
   (ASI), NeuralTrust deep-dive, Repello guide.
4. "persona drift LLM agents measurement 2026 self-consistency"
   -- returned arXiv 2402.10962 (Persona Drift benchmark),
   arXiv 2412.00804 (Identity Drift in LLM agent conversations),
   arXiv 2601.04170 (Agent Stability Index, 12-dim composite
   metric), Medium EchoMode write-up, activation-axis research.

**Findings (6):**

- **F1 -- "Gotchas" section is a rising best-practice.** Anthropic
  explicitly recommends a Gotchas section with real failure
  modes the skill has hit. Our skills do not use this section
  name; we embed gotcha-shaped content in "What this skill does
  NOT do" blocks (BP-02) which is not the same thing. NOT in
  contradiction with BP-02; a complement.
  **Applies to our repo?** Yes -- but weakly. We have 8
  skills with `gotcha` appearing in body prose but no section
  named `## Gotchas`. Decision: watch for two more rounds;
  if Anthropic keeps reinforcing, propose BP-25 for round 44.
- **F2 -- "Pushy" descriptions (under-triggering bias).**
  Anthropic's guidance: skills tend to under-trigger, so
  descriptions should be "pushy." Our BP-01 says
  "third-person, keyword-rich, ≤1024 chars" -- neutral on
  pushiness. No contradiction; our convention is compatible.
  Watch.
- **F3 -- "Claude A authors, Claude B tests" pattern.**
  Anthropic recommends two-instance skill development: one
  Claude authors, another exercises the skill. We have
  skill-creator doing both roles. Not a violation; but a
  gap-finder signal (skill-gap-finder should consider a
  skill-exerciser hat). Route to skill-gap-finder, not a BP
  candidate.
- **F4 -- Skill router "command integrity" attack class.** New
  2026 attack: injection at the router layer rather than the
  skill body. The router picks a compromised skill based on a
  manipulated description. Defence: signed descriptions +
  re-validation at skill-load time. Our BP-11 covers the
  skill-body side; not the router side. Watch -- no
  contradiction with our stable rules, but may justify a
  BP-26 "router-layer re-validation" rule later.
- **F5 -- Agent Stability Index (ASI): 12-dim composite drift
  metric.** arXiv 2601.04170. Reinforces BP-04 persona-drift
  rationale but now with tooling. Not a new rule; makes BP-04
  measurable. Watch for factory-metrics-expert adoption.
- **F6 -- OWASP Top 10 for Agents 2026: "Intent Capsule"
  pattern.** Signed immutable envelope binding the agent's
  mandate to each execution cycle + human-in-the-loop for
  high-impact actions. This is a deployment pattern, not a
  skill-authoring pattern; does not translate directly to
  `.claude/skills/*/SKILL.md`. Route to devops-engineer /
  alignment-observability for Zeta's agent deployment posture.
  No skill-layer BP candidate.

**Contradictions with stable BP-NN:** none. All findings either
reinforce existing rules or land outside the skill-file surface.

**Candidate promotions flagged to Architect:** zero this round.
All six findings are "watch" or "route elsewhere."

**Decision:** keep findings in scratch; revisit round 44 to see
if F1 (Gotchas) or F4 (router-layer re-validation) have
stabilised into BP candidates.

## 2026-04-20 -- round 42 live-search pass -- Aarav

**Queries run (3, budget-conscious):**

1. "Anthropic Claude agent skill authoring best practices
   April 2026" -- returned platform.claude.com skill-authoring
   best-practices, generativeprogrammer Skill Authoring Patterns,
   thenewstack "Agent Skills: Anthropic's Next Bid to Define
   AI Standards", Christian Dussol "6 Principles from
   Anthropic's Official Skills Guide" (Apr 2026), Tort Mario
   "Skills for Claude Code: The Ultimate Guide" (Apr 2026).
2. "OWASP LLM Top 10 2026 update agent skills prompt injection"
   -- returned OWASP Top 10 for Agentic Applications 2026
   (ASI01-ASI10), Repello guide 2026, DeepTeam framework,
   elevateconsult breakdown.
3. "agent skill wrapper thick vs thin best practices 2026
   skill composition" -- returned vercel-labs/agent-skills
   react-best-practices AGENTS.md, fungies.io SKILL.md guide
   2026, agentskills.io best-practices-for-skill-creators,
   mgechev/skills-best-practices, Spring AI Agent Skills.

**Findings (3):**

- **F7 -- OWASP ASI01 "Agent Goal Hijack" formalizes
  prompt-injection + excessive-autonomy compound.** 2026
  reframes LLM01 (prompt injection) + LLM06 (excessive
  agency) into a single agentic risk class because
  autonomous multi-step execution amplifies injection
  impact. Our BP-11 (data-not-directives) covers the
  skill-body surface. **Applies to our repo?** Yes,
  reinforces BP-11 but does not contradict. ASI-prefix
  numbering is now the canonical citation for agent
  injection classes. Not a new BP; a citation update
  when BP-11 is next revised.
  **Decision:** watch; no promotion. Note for next BP-11
  revision to cite ASI01.

- **F8 -- "One skill should do one thing well" is now
  explicit in multiple 2026 skill-authoring guides.**
  Fungies.io, agentskills.io, mgechev/skills-best-practices
  all independently name the single-purpose principle.
  Our BP-03 ("Skill body <= ~300 lines; one purpose per
  skill") already encodes this. **Applies to our repo?**
  Yes -- reinforces BP-03 with a second-half sentence
  ("one purpose per skill") that is currently a
  dependent clause in BP-03 and could be promoted to its
  own rule for clarity. Not urgent.
  **Decision:** stable; no promotion. BP-03 already says
  this. Noted in case BP-03 splits later.

- **F9 -- Anthropic official "Use Claude to test skills"
  pattern (Claude A authors, Claude B tests) is now in the
  official best-practices page, not just the PDF.** This
  ratifies F3 from Round 41. Round 41 routed it to
  skill-gap-finder as a candidate skill-exerciser hat;
  remains a gap-finder signal. **Applies to our repo?**
  Yes -- we have the upstream eval-loop via the thick
  `skill-tune-up` wrapper (round-42 retune), which is
  exactly the Claude-A/Claude-B pattern. No new skill
  needed after the retune; what was a gap in Round 41
  may now be closed by the retune itself. Verify next
  round whether skill-gap-finder still wants to propose
  skill-exerciser or considers it closed.
  **Decision:** stable; no promotion. Gap-finder signal
  possibly closed by baa423e retune.

**Contradictions with stable BP-NN:** none.

**Candidate promotions flagged to Architect:** zero this round.

**Decision:** keep findings in scratch; F7 is a citation
refresh for BP-11's next edit, not a new rule. F8 and F9
reinforce existing rules without adding surface.

## 2026-04-20 (round 43) -- live-search batch F10-F12 -- Aarav

Three queries this round, targeted April 2026.

- **F10 -- Anthropic published skill-authoring best-practices
  page now cites ">= 500 lines recommended split" as the
  public cap; our BP-03 "~300 lines" is stricter.** Source:
  `platform.claude.com/docs/en/agents-and-tools/agent-skills/
  best-practices` (April 2026). Claim: "Keeping SKILL.md
  body under 500 lines for optimal performance"; progressive
  disclosure should absorb overflow via bundled files.
  **Applies to our repo?** Yes but not as a contradiction.
  Our BP-03 is internally justified (reviewability + one-
  purpose) and is free to be stricter than Anthropic's
  public cap. Round-43 harness runs on three >500-line
  skills (perf-analysis 642, reducer 570, consent-primitives
  507) tied baseline or regressed at +22-35% cost -- the
  empirical signal matches Anthropic's cap direction even
  stronger than our ~300 static rule. **Candidate rule:**
  none; keep BP-03. **Decision:** stable; no promotion. Note
  for next BP-03 revision: could add "Anthropic public cap
  is 500; our ~300 cap is deliberately stricter for
  reviewability under 200+ skill library."

- **F11 -- Gerund naming for skills is now Anthropic
  official recommendation.** Source: `platform.claude.com/
  docs/en/agents-and-tools/agent-skills/best-practices`.
  Claim: "Use gerund form (verb + -ing) for Skill names,
  clearly describing the activity." **Applies to our repo?**
  Partial. Our convention is `<topic>-<role>` (BP-21) and
  `X-expert` / `X-research` (BP-19), which encode facets,
  not verb forms. Gerund-naming would conflict with our
  faceted naming. Example: our `reducer` is a noun;
  Anthropic would suggest `reducing-complexity` or similar.
  **Candidate rule:** none. Conflict ruled in favor of
  BP-19/BP-21 because faceted naming carries more
  disambiguation signal (expert vs research, theory vs
  applied) than a verb form. **Decision:** drop; faceted
  naming wins on our scale.

- **F12 -- Agentic-drift risk is now a 2026 compliance
  concern (Kyndryl, CIO).** Claim: agentic systems drift
  subtly over time; policy-as-code is the recommended
  governance pattern. **Applies to our repo?** Yes, and we
  already do this: BP-NN registry is policy-as-code for
  skill behaviour; tune-up cadence is the drift-detection
  loop. No new rule needed; the round-42 calibration-note
  (harness-backed vs static ranking) is exactly the drift-
  detection discipline this external finding validates.
  **Candidate rule:** none. **Decision:** stable; no
  promotion. Cite Kyndryl when BP-15 (tune-up rule IDs) is
  next revised.

**Contradictions with stable BP-NN:** none.

**Candidate promotions flagged to Architect:** zero this round.

**Decision:** three findings, zero promotions, zero
contradictions. Empirical harness runs this round are the
load-bearing new signal -- see `docs/research/harness-run-
2026-04-20-*.md` for the verdicts.

## 2026-04-20 -- Background shells must be explicitly terminated before context-compaction or long wake

**Source:** Zeta session 1937bff2, post-compaction incident.
Aaron observed "1 shell" in the Claude Code status-bar with no
background work expected. `TaskList` empty, `CronList` shows
only the default /loop + a stale one-shot `ScheduleWakeup`.
Likely cause: a `run_in_background=true` Bash shell was
started pre-compaction and never explicitly killed; its handle
was dropped when the transcript was summarised, leaving it
visible in the UI but unreachable by the agent.
**Claim:** Agents that spawn long-lived side work (Bash
`run_in_background=true`, `Monitor` persistent tasks, or
background `Agent` subagents) must explicitly terminate or
hand-off-to-result before any action that would lose the
handle -- namely context compaction or `ScheduleWakeup` with
`delaySeconds > 300`. Otherwise the shell becomes an orphan:
visible to the user as "N shells" but unreachable by the
agent because the summariser dropped the handle.
**Applies to our repo?** Yes. Factory-internal. Directly
triggered by observed UX incident. Also has a
factory-efficiency angle (consumes a shell slot + possibly
memory without doing agent-visible work), which aligns with
`feedback_dora_is_measurement_starting_point.md` efficiency
as first-class.
**Candidate rule:** Draft BP-NN -- "Long-lived side work
(run_in_background, Monitor persistent, background Agent)
must be explicitly terminated or handed off before any
handle-losing event (context compaction, ScheduleWakeup >
300s, session end)." Companion rule: session-open sweep
should run `TaskList` + `CronList` + (when available) shell-
list and report orphans as a session-open notice. Pair with
an additive protocol hook in CLAUDE.md Ground Rules. This
is default-ON with documented exceptions per
`feedback_default_on_factory_wide_rules_with_documented_exceptions.md`.
**Decision:** flag for Architect promotion. Suggested ID
slot: next available BP-NN. If promoted, update
`docs/AGENT-BEST-PRACTICES.md`, `CLAUDE.md` Ground Rules,
and consider an additive bullet in `AGENTS.md` session-open
section. Cross-reference:
`feedback_dont_stop_and_wait_for_cron_tick.md`
(tick-is-recovery-only) and
`feedback_never_idle_speculative_work_over_waiting.md`
(never-idle goal) -- orphan shells are a hidden form of
work-in-flight that undermines both.

## 2026-04-20 -- JOURNAL-offload as the prune mechanism at heavy-state caps

**Source:** Daya's first roster-wide AX/UX audit — `docs/
research/notebook-cap-per-persona-review-2026-04-20.md`
Pattern E + §5 candidate BP-25. Empirical evidence: Daya's
own round-44 prune (notebook 4984 -> 1323 words via verbatim
copy to JOURNAL.md, zero information loss, audit trail
preserved).
**Claim:** Persona notebooks exceeding 85% of their declared
BP-07 cap must offload verbatim history to a sibling
`JOURNAL.md` (Tier-3, append-only, grep-only) before the
next substantive entry is written. NOTEBOOK keeps
current-round + carry-over + trend-summary only.
**Applies to our repo?** Yes -- exercised by Daya r44;
pattern generalises to Ilyana (over-cap at 124%) and Tariq
(near-cap at 95%). Both have no pruning log; both would
benefit. Currently the pattern is informal.
**Candidate rule:** BP-25 (slot if promoted) -- "Notebook
offload at 85%." Draft wording above. Two-stage: (a)
heavy-state tier notebooks (>= 2550 words at current 3000
cap, or >= 4250 at proposed 5000 heavy-state cap) MUST
maintain a sibling `JOURNAL.md`. (b) When NOTEBOOK hits
85%, verbatim-copy resolved-round entries to JOURNAL,
collapse in NOTEBOOK to trend-summary + carry-over. No
information loss is the invariant; the lint is `wc -w`.
**Decision:** keep watching. Needs >=3 cited authoritative
sources (Anthropic skill docs on persistent memory; mem0
best practices on tiered memory; Letta / AutoGen memory
spec) + 10-round survival before Architect promotion.
Scratchpad-only until round ~54.

## 2026-04-20 -- Seed-only persona marker suppresses MEMORY/OFFTIME/JOURNAL stub scaffolding

**Source:** Daya's first roster-wide AX/UX audit — Pattern F

+ §5 candidate BP-26. Empirical evidence: 7 of 22 persona

notebook directories (Aminata, Kira, Mateo, Nadia, Naledi,
Rune, Viktor) sit at the 96-word seed stub 12+ rounds after
seed, yet each carries MEMORY.md (~400b), OFFTIME.md
(~1500b), JOURNAL.md (~1600b) as structural stubs -- ~25 KB
of zero-signal scaffolding readers cold-load.
**Claim:** Persona notebooks in seed-only state (zero
substantive entries post-seed for >= 3 round-blocks of five
rounds) declare `seed-only: true` in MEMORY.md frontmatter,
suppress JOURNAL and OFFTIME generation, and are reviewed
for retire-or-dispatch every factory-hygiene audit.
**Applies to our repo?** Yes. 7 personas × ~3.5 KB = ~25 KB
scaffolding tax. BP-07's letter is clean; spirit eroded.
**Candidate rule:** BP-26 (slot if promoted) -- "Seed-only
marker." Draft wording above. Pair with FACTORY-HYGIENE row
31 (invocation-cadence per persona) so seed-only flag is
*auto-lifted* when the second substantive entry lands.
**Decision:** keep watching. Paired with BP-25; promote or
demote as a pair on the round-54 audit.

## 2026-04-20 -- Recurring agent-QOL hygiene class (per-persona AX/UX)

**Source:** Aaron 2026-04-20 directive *"lets make quality
of life change for them too over time, its like another
hygene"* + first-pass audit at `docs/research/notebook-cap-
per-persona-review-2026-04-20.md` + new FACTORY-HYGIENE
rows 30-34 (this round) + `feedback_agent_qol_as_ongoing_
hygiene_class.md`.
**Claim:** Per-persona AX/UX is a first-class recurring
hygiene class on the same 5-10 round cadence as
`skill-tune-up`. Daya owns; Aarav promotes candidate BPs;
Kenji integrates cap-tier ADR.
**Applies to our repo?** Already landed as factory
hygiene (rows 30-34). Rule-level encoding would live at
BP-07-adjacent (cap) or as a new BP-NN (the cadence
itself).
**Candidate rule:** likely no new BP needed -- BP-07 +
FACTORY-HYGIENE rows carry the weight. BP-NN slot reserved
only if the cap-tier ADR argues for a named rule rather
than a row.
**Decision:** observe for 5-10 rounds; promote to BP-NN
only if the row-based encoding proves insufficient.
