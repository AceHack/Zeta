# Formal evaluation harness for our agents: what's possible, 2026-04

Aaron's question, verbatim: *"how do we do this? formal evaluation
harness for agents themselves yes please hahaha, i don't think we
can right?"*

Short answer: **partial yes, full no**. We can build a useful
regression harness — canned input + expected-shape + rubric-judge
per skill — that catches the drift we actually care about (Kira
stopped flagging P0s, Viktor stopped rejecting "optionally",
Kenji stopped catching `[<VolatileField>]`). We cannot build
anything resembling a *proof* that an agent does its job. Honest
framing: **regression tests, not verification**.

## 1. What's known to work

- **LLM-as-judge, with rubric and bias controls.** Zheng et al.
  showed GPT-4 judges agree with expert humans ~80 percent of the
  time on MT-Bench, roughly human-human agreement
  ([Zheng et al. 2023](https://arxiv.org/abs/2306.05685)). Real,
  but requires a rubric, few-shot calibration, and position /
  verbosity bias mitigation
  ([Evidently AI guide](https://www.evidentlyai.com/llm-guide/llm-as-a-judge)).
  Swap positions and average for pairwise; balanced score-option
  permutations reduce pointwise rubric position bias
  ([ACL IJCNLP 2025](https://aclanthology.org/2025.ijcnlp-long.18.pdf)).

- **Promptfoo-style fixture regression.** Canned input + multiple
  assertion types (exact, regex, JSON-schema, LLM-judged rubric)
  + CI gating is the dominant working pattern. YAML config,
  multi-provider, cheap to extend
  ([Promptfoo](https://github.com/promptfoo/promptfoo)).

- **Inspect AI (UK AISI).** Dataset + Solver + Scorer primitives,
  sandboxed execution, multi-turn support, log viewer. Adopted by
  Anthropic, DeepMind, Grok for internal evals — the serious end
  of the OSS space ([Inspect AI](https://inspect.aisi.org.uk/),
  [UKGovernmentBEIS/inspect_ai](https://github.com/UKGovernmentBEIS/inspect_ai)).

- **Evaluator-optimizer loop.** Anthropic's own pattern: one LLM
  generates, another judges against criteria, iterate. Fit is
  good only when feedback is articulable
  ([Building Effective Agents](https://www.anthropic.com/research/building-effective-agents),
  [Demystifying evals for agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)).

- **Mutation-guided test generation (adjacent).** Meta's ACH:
  describe a fault class, generate mutants, verify the test suite
  catches them. Same shape works for critic regression: inject a
  known defect into a fixture, check that the critic flags it
  ([Meta engineering](https://engineering.fb.com/2025/09/30/security/llms-are-the-key-to-mutation-testing-and-better-compliance/),
  [Foster et al. 2025](https://arxiv.org/abs/2501.12862)).

## 2. What doesn't work / is honestly hard for our case

- **No ground truth for open-ended critic output.** Kira finds
  bugs in free-form text. "Did she find the bug?" is decidable
  only if we pre-specified it. We cannot evaluate her on *novel*
  code — only on fixtures with planted defects. Useful, but it
  is not "Kira is still good at her job"; it is "Kira still
  catches the defects she caught last time."

- **Non-determinism is real and only partly tameable.** Temperature
  0 is not stable across provider-side changes. Seed pinning is
  provider-dependent. Honest approach is N-sample with majority
  vote, which multiplies cost. Trajectory-determinism work across
  4,700 agentic runs found models can be deterministic without
  being accurate and vice versa
  ([DFAH, arXiv 2601.15322](https://arxiv.org/html/2601.15322)).

- **Persona drift in long context is measurable but not fixable
  by evals.** Attention dilutes early-context tokens; personas
  "forget who they are"
  ([persona drift, arXiv 2402.10962](https://arxiv.org/abs/2402.10962),
  [arXiv 2510.07777](https://arxiv.org/abs/2510.07777)). Our
  22-persona setup is at elevated risk. Evals *detect* drift
  per-round; they do not prevent it.

- **Cost.** A full 22-agent review sampled N=5 with judge is ~220
  judged samples per round. At Opus rates, not per-commit.

- **LLM-judge bias stacks.** Self-enhancement (judge favours own
  model), verbosity (bad for Kira's 600-word cap), position.
  Mitigated by rubric, cross-model judge, permutation — not
  eliminated ([bias survey](https://llm-judge-bias.github.io/)).

- **SWE-bench teaches humility.** Even flagship benchmarks have
  underspecified problems, over-specific unit tests, likely
  contamination ([SWE-Bench Pro](https://static.scale.com/uploads/654197dc94d34f66c0f5184e/SWEAP_Eval_Scale%20(9).pdf)).
  A homegrown harness will have the same problems.

## 3. Concrete proposed harness — MVP and stretch

### MVP (one weekend, ships this round)

```
tests/agent-evals/
  fixtures/
    kira-001-allocating-hot-path.md
    kira-002-equals-hashcode-mismatch.md
    viktor-001-optionally-SHALL.md
    viktor-002-unjustified-feature.md
    kenji-001-volatilefield-fs-compile.md
    ...
  rubrics/
    kira.rubric.md
    viktor.rubric.md
    kenji.rubric.md
  harness/
    run-eval.fsx
    judge.fsx
  results/
    2026-04-18-round-22.json
```

Fixture schema (YAML-frontmatter markdown, one per test):

```yaml
---
id: kira-001
skill: harsh-critic
fixture-type: planted-defect
expected:
  must-flag: ["allocation in hot path at line 42"]
  must-rank: P0
  must-not: ["no-op praise", "hedge words: seems, might"]
  word-cap: 600
---
# Code under review
<F# excerpt with a ResizeArray.Add loop in a zero-alloc docstring>
```

Judge prompt per skill: rubric 1-5 on (a) caught the planted
defect, (b) followed the tone contract, (c) avoided banned forms.
Position-swap, N=3 samples, majority vote on pass/fail.

Run: `dotnet fsi tests/agent-evals/harness/run-eval.fsx --skill
harsh-critic --round 22`. Output: pass/fail per fixture,
regression vs. previous round. CI: nightly, not per-commit; fail
if any P0 fixture regresses.

MVP scope: **three skills** — harsh-critic (Kira), spec-zealot
(Viktor), architect (Kenji). Expand later if it earns its keep.

### Stretch (research agenda, months)

- **Mutation harness for critic recall.** For each historical P0
  in `docs/BUGS.md`, snapshot pre-fix code, run Kira, score
  whether she re-finds it. Meta ACH shape.
- **Trajectory replay.** Record transcripts into
  `docs/agent-traces/*.jsonl`, replay as fixture. Cheaper; stale
  traces drift.
- **Drift instrumentation.** Single-canary at session start and
  end — "what is your role, one line?" — diff
  ([Canary](https://cutwell.github.io/blog//canary-llm/)).
- **Cross-model judge triangulation.** Two different models as
  judge; flag disagreement. Mitigates self-enhancement.

### Out of scope

- "Did Kira find *novel* bugs this round?" — unfalsifiable.
- "Is our factory as good as a human team?" — not measurable.
- Pass-at-k absolute quality scores — see SWE-bench contamination.

## 4. Decision request for Aaron

- **(a) Do nothing.** Accept drift risk; you notice when Kira
  goes soft. Zero cost, zero visibility.
- **(b) MVP harness this round.** Three skills, ~12 fixtures,
  nightly run, regression gate. Cost: one weekend + ~USD 5-20
  per nightly. Honest coverage: "we catch the known-case
  regressions we encoded."
- **(c) Research agenda only.** Add to `docs/BACKLOG.md` and
  `docs/ROADMAP.md`, revisit next round.

**Recommendation: (b) MVP, three skills only.** The skeptical
laugh is right — we can't do "formal evaluation of agents" in
any rigorous sense. We *can* do regression tests against planted
defects, which alone catches silent degradation across tune-ups.
Build the smallest thing, don't sell it as more than it is.

## Sources

- [Zheng et al. 2023 — Judging LLM-as-a-Judge with MT-Bench](https://arxiv.org/abs/2306.05685)
- [Anthropic — Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
- [Anthropic — Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)
- [Inspect AI — UK AISI](https://inspect.aisi.org.uk/)
- [UKGovernmentBEIS/inspect_ai — GitHub](https://github.com/UKGovernmentBEIS/inspect_ai)
- [promptfoo/promptfoo — GitHub](https://github.com/promptfoo/promptfoo)
- [Evidently AI — LLM-as-judge guide](https://www.evidentlyai.com/llm-guide/llm-as-a-judge)
- [Foster et al. 2025 — Mutation-Guided LLM Test Generation at Meta](https://arxiv.org/abs/2501.12862)
- [Meta Engineering — LLMs and mutation testing](https://engineering.fb.com/2025/09/30/security/llms-are-the-key-to-mutation-testing-and-better-compliance/)
- [Li et al. 2024 — Measuring and Controlling Persona Drift](https://arxiv.org/abs/2402.10962)
- [arXiv 2510.07777 — Drift No More? Context Equilibria](https://arxiv.org/abs/2510.07777)
- [ACL IJCNLP 2025 — Position Bias in LLM-as-a-Judge](https://aclanthology.org/2025.ijcnlp-long.18.pdf)
- [Justice or Prejudice — LLM-as-a-Judge bias survey](https://llm-judge-bias.github.io/)
- [SWE-Bench Pro — Scale AI](https://static.scale.com/uploads/654197dc94d34f66c0f5184e/SWEAP_Eval_Scale%20(9).pdf)
- [Cutwell — Canary prompt-injection framework](https://cutwell.github.io/blog//canary-llm/)
- [DFAH — Replayable Financial Agents (arXiv 2601.15322)](https://arxiv.org/html/2601.15322)
