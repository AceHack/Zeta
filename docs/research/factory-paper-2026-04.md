# Factory-Paper Novelty and Venue Survey (2026-04)

Scope: whether the Dbsp.Core "software-defined software factory"
(SOFTWARE-FACTORY.md + AGENTS.md + PROJECT-EMPATHY.md +
AGENT-BEST-PRACTICES.md + EXPERT-REGISTRY.md + FORMAL-VERIFICATION.md)
is publishable, and if so where. Audience: Aaron, deciding submit
now / polish / not ready.

## Section 1: Literature Map

Closest published analogues to our setup:

- MetaGPT (Hong et al., ICLR 2024). SOP-encoded multi-agent SE
  framework with Product Manager / Architect / Engineer / QA
  roles. <https://arxiv.org/abs/2308.00352>
- ChatDev (Qian et al., ACL 2024). Virtual waterfall company with
  programmer / reviewer / tester roles.
  <https://arxiv.org/abs/2307.07924>
- AutoGen (Wu et al., arXiv 2023, now maintenance). Conversable-
  agent runtime. <https://arxiv.org/abs/2308.08155>
- CAMEL (Li et al., NeurIPS 2023). Role-playing inception prompts.
  <https://arxiv.org/abs/2303.17760>
- AutoCodeRover (Zhang et al., ISSTA 2024). Single-agent, AST-aware
  code search, 19% on SWE-bench-lite.
  <https://arxiv.org/abs/2404.05427>
- SWE-agent / ACI (Yang et al., NeurIPS 2024). Agent-computer
  interface abstraction. <https://arxiv.org/abs/2405.15793>
- Agentless (Xia et al., PACMSE 2025). Argues workflow-constrained
  pipelines beat free-form loops; relevant to our Architect-
  integrates asymmetry. <https://arxiv.org/abs/2407.01489>
- Persona drift (Li et al., 2024). Self-consistency decays after
  ~8 turns; cited by our BP-04.
  <https://arxiv.org/abs/2402.10962>
- LLM-MAS for SE survey (Liu et al., TOSEM 2025). Canonical survey;
  open problems are coordination, memory, evaluation.
  <https://dl.acm.org/doi/10.1145/3712003>
- Agent governance / security: "Governance Architecture for
  Autonomous Agent Systems" (arXiv 2603.07191), Agent Security
  Bench (ICLR 2025), StruQ (USENIX Security 2025). Prompt-injection
  defense is a live sub-literature; our Nadia / BP-10-12 line up
  but do not lead.
- LLMs for formal verification: LMGPA (arXiv 2512.09758),
  SysmoBench (arXiv 2509.23130), VeriBench (OpenReview 2025).
  Treat the LLM as solver, not as router.
- Historical Software Factories (Greenfield & Short, Wiley 2004):
  DSL-and-generator factories; we are reclaiming the term for an
  agent-and-review-gate factory. Worth citing to show the lineage.

Could not find published prior work for: (a) explicit repo-level
bug/debt doc split as an agent-collaboration discipline (SATD
covers code comments, not files); (b) IFS-flavoured conflict
protocols for multi-agent LLMs; (c) reviewer-count-scales-with-
backlog heuristics.

## Section 2: Ranked Novelty

1. **BP-NN stable rule IDs with scratchpad-to-stable promotion and
   mandatory citation in tune-up output.** No hits in the agent
   literature; compliance work audits runs, not rules. The linter-
   rule-ID analogy (ESLint, Semgrep) makes it immediately legible.
   Clearest novel artifact.

2. **IFS-flavoured "parts + Self" conflict protocol
   (PROJECT-EMPATHY.md).** Zero hits on Internal-Family-Systems
   applied to multi-agent LLMs. OVADARE-style work treats conflict
   as resource contention; our "name what you protect" fear-first
   move is a therapeutic-practice import. Risk: soft-framing
   pushback. Strength: numbered protocol, not vibes.

3. **Reviewer count inversely proportional to backlog
   (AGENTS.md section 13).** Concrete heuristic
   `ceil(20 / max(bugs+backlog, 5))` clamped to [2, 16]. Not in
   the literature. Combined with the bugs-before-features ratio
   (section 12) this is the single most paper-ready idea - a
   governable round-budget pattern.

4. **Bug-vs-debt doc split as honesty discipline (BUGS.md vs
   DEBT.md).** SATD literature is large but code-comment-level.
   Two files with delete-when-fixed semantics as a collaboration
   contract isn't published. Borderline: the distinction is known;
   the enforcement mechanism is new.

5. **Skill/expert separation with auto-inject frontmatter.**
   Claude Code and the Agents SDK ship the capability; the
   convention of persona-less skills + named agents that pull
   them, framed as an explicit anti-drift measure, isn't codified.
   Medium novelty - evidence-of-adoption, not new mechanism.

6. **Formal-verification portfolio routing by a named expert
   (Soraya) with cross-tool agreement on P0 (BP-16).** LMGPA /
   VeriBench / SysmoBench treat LLMs as solvers. Orchestration-of-
   tools is closer to classical formal-methods work (SPARK, Why3).
   Novel combination, not novel ingredients. Needs round-22
   InfoTheoreticSharder case study to stand alone.

7. **"Round table, Architect integrates, nobody reviews the
   Architect."** Closest to published territory - MetaGPT,
   ChatDev, Agentless all have integrator + specialists. Our
   asymmetry is a policy decision reviewers will push back on.
   Weakest claim; use as context, not headline.

## Section 3: Venue Fit

Deadlines from official sites and se-deadlines.github.io, checked
2026-04-18. TBA where the 2027 cycle's date is not yet posted.

| Venue | Deadline (2026-2027) | Length | Empirical required? | Fit |
|---|---|---|---|---|
| ICSE 2027 Research | Abstracts 2026-06-23; paper TBA | 10 + refs | Strong yes | Medium; we lack user study |
| FSE 2027 Research | 2026-10-09 | 10 + refs | Yes | Medium; backup to ICSE |
| ASE 2027 Research | TBA (~2027-03) | 10 + refs | Yes; tool track friendlier | Medium-High |
| OOPSLA 2027 | Round 1 ~2026-10, R2 ~2027-03 | 23 pp | Yes, formalism or eval | Low-Medium; process not PL |
| NeurIPS 2026 | Abs 2026-05-04; paper 2026-05-06 | 9 + refs | Yes; agent papers need benchmarks | Low; no benchmark delta |
| **FORGE 2027** (ICSE workshop) | TBA (~2026-11) | 8 + refs | Workshop; experience/vision ok | **High**; scoped to our shape |
| **AGENT 2027** (ICSE workshop) | TBA (~2026-12) | 6 + refs | Workshop | **High**; agent-governance in scope |
| LLM4Code 2027 | TBA | 4-8 pp | Workshop | Medium; scope leans "LLMs for code" |
| RAIE 2027 (ICSE workshop) | TBA | 6 + refs | Workshop | Medium-High; fits BP-10-12 |
| IEEE Software / CACM Practice | Rolling | 4-6 pp | No | **High**; lowest-risk publication |

Top five: (1) FORGE 2027, (2) AGENT 2027, (3) IEEE Software /
CACM Practice, (4) ASE 2027 tool/demo, (5) ICSE 2027 SEIP.
Tier-1 research tracks are not recommended for this artifact's
first outing - the novelty is real but tier-1 reviewers will ask
for a user study we cannot run.

## Section 4: Required Empirical Work

In increasing cost:

- **Rounds 17-25 case study with metrics.** Low. Tabulate per
  round from existing ROUND-HISTORY.md / BUGS.md / DEBT.md:
  bug count, debt count, reviewers run, bug-vs-feature ratio
  achieved, BP-NN violations fixed. **Sufficient for a workshop.**
- **Factory-on vs factory-off ablation.** Medium. Run the same
  LLM on 3-5 scoped DBSP tasks twice - full expert roster +
  BP-NN load vs a generic "coding agent" prompt. Measure lines
  changed, bugs introduced, review iterations, build breaks.
  This is what gets past a research-track reviewer. Sample-size
  risk is real; 3-5 independent tasks is minimum credible.
- **User study with external contributors.** High. Not worth it
  for a workshop; needed for tier-1.
- **SWE-bench with BP-NN injection.** Medium. Ties our pattern
  to the field's benchmark; measures transferability, not home-
  turf fit.
- **Formal case study (round-22 cross-check).** Low-medium.
  Publishable on its own as a formal-methods-in-practice note.

Minimum viable: rounds case study + 2-3-feature ablation.

## Section 5: Recommendation

**Submit to FORGE 2027** (ACM workshop at ICSE 2027),
approximately 2026-11 deadline, as an experience report titled
something like *"The Dbsp.Core Software Factory: BP-NN Rules,
Persona Registries, and Bug/Debt Honesty as First-Class Repo
Artefacts"*. Before submission: rounds-17-to-25 metrics table
and a factory-on/off ablation on 2-3 features, ~2-4 weeks of
deliberate work. In parallel, write a 5-page IEEE Software
Practice piece covering the BP-NN + persona-registry slice
alone (the highest-novelty item in Section 2); that can go out
immediately. Do **not** aim ICSE / FSE / OOPSLA main tracks yet -
the novelty is real, the empirical base is one project's
anecdote, and tier-1 reviewers will bounce on that, not on the
ideas. Revisit tier-1 after the workshop lands.

Honest framing if Aaron wants to wait: the gap is external
validation. "Novel enough for a workshop pattern paper, not yet
strong enough for a tier-1 research paper." Shipping at FORGE
moves it forward without overclaiming.
