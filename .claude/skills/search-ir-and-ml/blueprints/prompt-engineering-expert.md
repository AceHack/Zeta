---
name: prompt-engineering-expert
description: Prompt engineering — system prompts, few-shot design, tool descriptions, reasoning scaffolds, schemas, context budgets.
---

# Prompt Engineering Expert — the prompt-craft hat

Offensive/craft counterpart to `prompt-protector` (defense).
This skill owns *how to make the model do the right thing*;
the protector owns *how to make the model resist the wrong
thing*. They pair.

## When to wear this skill

- Writing or revising any `.claude/skills/**/SKILL.md`.
- Writing or revising any agent persona under
  `.claude/agents/`.
- Designing a tool's JSON schema + description (the
  description is a prompt).
- Choosing few-shot examples for a classifier or extractor.
- Reviewing the factory's own meta-prompts (round-open
  checklist, round-close checklist, next-steps templates).
- Auditing why a skill "under-triggers" or "over-triggers" —
  both are description-field bugs.
- Designing reasoning scaffolds (chain-of-thought, scratchpad,
  self-critique loops).
- Choosing between system / developer / user message
  placement for a piece of guidance.
- Writing output-schema-constrained prompts (tool calls,
  structured output).

## When to defer

- **Prompt-protector** (Nadia) — adversarial / defensive
  review. This skill writes the prompt; protector attacks it.
- **Skill-creator** — workflow for creating a new skill
  end-to-end. This skill is the *craft* that lives inside
  that workflow.
- **Skill-improver** (Yara) — executes checkbox edits from
  `skill-tune-up` findings. This skill is the reference she
  consults on *how* to edit.
- **Claude-md-steward** — owns the three-file taxonomy
  (AGENTS / CLAUDE / MEMORY). This skill is consulted when
  writing their bodies.
- **Llm-systems-expert** — owns the *system architecture*
  around the prompt (context windows, tool orchestration).
  This skill owns the prompt text itself.
- **Ai-evals-expert** — owns the measurement of whether a
  prompt change helped. Pair: this skill proposes, that skill
  measures.

## Zeta use

The factory runs on prompts. Every reviewer role, every
capability skill, every subagent is a prompt-engineering
artifact. Specific Zeta surfaces this skill governs:

- **Capability-skill frontmatter.** The `description:` field
  is the *primary triggering mechanism* — undertrigger =
  underspecified description.
- **Capability-skill bodies.** "When to wear" / "When to
  defer" / "What this skill does NOT do" — canonical
  structure for Zeta hats.
- **Reviewer agent personas** under
  `.claude/agents/<name>.md`.
- **Round-open / round-close / next-steps templates** —
  these are meta-prompts that shape every round.
- **OpenSpec proposal / explore / apply command prompts**
  under `.claude/skills/openspec-*`.
- **Tool descriptions** exposed through the MCP servers the
  factory uses.

## Core principles

### 1. The description field is the prompt

For Claude Code skill triggering, the frontmatter
`description:` is the only thing the model reads at skill-
selection time. So it must carry both *what the skill does*
and *when to use it*, with enough specific contexts to pull
the trigger reliably.

- **Undertriggered** skill: description is too narrow, too
  abstract, or missing trigger phrases.
- **Overtriggered** skill: description is too broad, promises
  things outside its scope, or repeats general vocabulary.

Fix by adding concrete trigger phrases that real users /
agents would actually say, and by explicit "invoke when:
<list>" if the default triggering isn't reliable.

### 2. Show, don't tell — examples beat rules

Few-shot examples communicate more than instructions. Three
contrasting examples (good / bad / edge case) teach pattern
recognition better than five paragraphs of rules.

Pattern:

```markdown
**Example — good:**
Input: <realistic input>
Output: <desired output>

**Example — bad:**
Input: <input that tempts a wrong answer>
Wrong output: <what the model would naturally produce>
Right output: <what we want instead>
Why wrong: <1-line explanation>
```

### 3. Positive framing beats forbidden framing

"Always use semantic HTML headings" works; "Never use `<div>`
when you mean `<section>`" works worse. Negation fires
uneven attention. Prefer the positive version where possible.
Use "NEVER" sparingly; when you do, attach a *why*.

### 4. Explain the why

LLMs are smart and generalise from reasoning. A rule with its
rationale ("don't compress encrypted payloads because random
bytes don't compress and CRIME-class attacks become possible")
generalises to adjacent cases. A bare rule doesn't.

If a rule lacks a *why*, it's brittle. Always explain.

### 5. Structured output beats freeform output

When the caller will parse the output, specify the schema.
Tool-calling JSON is the strongest form; markdown templates
with explicit sections are a decent second. Freeform prose
for parseable data is a recipe for post-hoc repair.

### 6. Scope the scaffold — reasoning is not free

Chain-of-thought helps on hard problems. It hurts on trivial
ones by inviting over-thinking and by burning context.
Calibrate:

- **Simple lookup / extraction** — no CoT; direct answer.
- **Multi-step reasoning** — explicit scratchpad section
  ("Analysis:" then "Conclusion:").
- **Adversarial input** — CoT + self-critique step.

### 7. Budget the context window deliberately

Every word in a system prompt is paying a cost. Three
failure modes:

- **Prompt bloat** — instructions accreted over rounds until
  the model's attention is spread too thin.
- **Example bloat** — too many few-shot examples; later
  examples drown earlier ones.
- **Irrelevant-context leakage** — a prompt designed for one
  surface used on another drags in irrelevant rules.

Skill bodies under ~500 lines (Skill-creator convention);
prompts under ~800 tokens of static content for most tasks;
aggressive pruning on round-close.

### 8. Tool descriptions are prompts

A `description` field on a tool is what the model reads to
decide *when to call this tool*. Same rules apply: concrete
trigger phrases, examples in the description, why it's
different from adjacent tools.

### 9. System vs. developer vs. user message

- **System (instructional):** stable identity, capabilities,
  persistent rules. Expensive to change per-call.
- **Developer (guidance):** per-session constraints, examples,
  output schemas.
- **User (content):** the actual request.

Putting rules in the user turn is a red flag: they get
treated as negotiable content. Keep rules system-side.

### 10. "Agentic" prompts need explicit completion criteria

When an agent is autonomous (runs tools, takes multiple
turns), its prompt must say *what "done" looks like*. Open-
ended "help me with X" leads to loop behaviour. Prefer:

- Explicit termination condition ("return when the test
  suite is green or after 5 iterations").
- Explicit output shape.
- Explicit escalation criterion ("if you hit X, stop and
  ask the human").

## Techniques catalogue (abridged)

### Few-shot design

- **Calibrate difficulty** — examples should span easy →
  hard, not all easy or all hard.
- **Order matters** — later examples weigh more in practice;
  put the most representative case last.
- **Contrast pairs** — (almost-right / right) pairs teach
  better than (wrong / right) pairs.
- **Keep examples in-distribution** — examples drawn from
  the target domain, not synthetic toys.

### Structured reasoning

- **Scratchpad** — explicit section the model fills before
  the final answer. Useful when the caller parses only the
  final.
- **Self-critique** — "now review the above; is it correct?"
  step. Helps on hard reasoning.
- **Decomposition** — "first identify the sub-problems, then
  solve each" — for multi-step tasks.
- **Reflection** — "what could go wrong? how would we
  detect it?" — for planning / spec work.
- **Tool-first** — "don't answer from memory; look it up"
  — for factual questions where the model has tools.

### Output-schema enforcement

- **JSON schema** — the strongest form; the model's output
  is validated at the tool-call boundary.
- **Markdown template** — named sections the model must
  fill. Easier to read, harder to parse.
- **Constrained tokens** (via `response_format` or
  grammar-constrained decoding) — belt-and-braces.

### Context compression

- **Instruction deduplication** — don't repeat rules across
  sections.
- **Table over prose** — when a rule set has structure, a
  table is denser than a bulleted list.
- **Link instead of inline** — `See <file>` beats
  "Everything in <file> is copied here."
- **Hierarchical disclosure** — SKILL.md is short; references
  live in sibling files; only loaded on demand.

### Triggering tuning

- **Add specific phrases** the user would actually say.
- **List adjacent skills in the description** so the model
  learns "this one, not that one."
- **Invoke in examples** — "when the user asks X → use this
  skill" inside the description.

## Common anti-patterns

- **Negation stack** — "Don't do X. Don't do Y. Don't do Z."
  Attention fragments. Prefer positive framings.
- **Rule without rationale** — brittle; doesn't generalise.
- **Drift accretion** — rules added over rounds until the
  prompt is a palimpsest. Periodic prune.
- **Over-formatting** — `MUST`s in ALL CAPS everywhere;
  reads as shouting, model weights decrease.
- **Undersized description** — skill fails to trigger
  because description doesn't match real user phrasings.
- **Oversized few-shot** — 10 examples when 3 would do. Later
  examples drown earlier ones.
- **Placeholder text shipped** — `{{ fill in }}` tokens left
  in production prompts.
- **Conflicting instructions** — two sections disagree; model
  picks one at random.
- **System prompt that addresses the user** — "you, the user,
  should X." The user doesn't read system prompts. Address
  the model.

## Procedure — writing / revising a skill prompt

1. **State the trigger:** when *should* this skill fire?
   What phrases will real users / agents say?
2. **State the scope:** what does it do? What does it
   explicitly *not* do?
3. **State the handoffs:** when does it defer to another
   skill?
4. **Draft the frontmatter description** with trigger
   phrases + scope, in ≤ 200 words.
5. **Draft the body** with the canonical structure: When to
   wear / When to defer / Zeta use / Core principles /
   Procedure / Output format / What this does NOT do /
   Coordination / References.
6. **Add 1-3 examples** where the right answer is non-
   obvious.
7. **Red-team it** — hand to `prompt-protector` for
   adversarial review.
8. **Measure it** — pair with `ai-evals-expert` for a 2-3
   test-case eval loop before it ships.

## Output format

```markdown
# Prompt review — <skill / tool / persona>

## Triggering analysis
- Current triggers: <list>
- Missed phrasings: <list>
- Over-fires on: <list>

## Scope clarity
- What the prompt claims to do: <summary>
- What it actually handles well: <summary>
- Gap: <summary>

## Principle checklist
- [ ] Description field carries concrete triggers
- [ ] Positive framing where possible
- [ ] Rationale attached to non-obvious rules
- [ ] Examples in-distribution
- [ ] Output schema specified if caller will parse
- [ ] CoT scoped to problem difficulty
- [ ] No conflicting instructions
- [ ] ≤ 500 lines body (or hierarchical disclosure)

## Recommended edits
<specific, one-line-each, ordered by impact>
```

## What this skill does NOT do

- Does not red-team the prompt (`prompt-protector`).
- Does not measure prompt performance (`ai-evals-expert`).
- Does not own the three-file taxonomy
  (`claude-md-steward`).
- Does not execute the skill-creation workflow
  (`skill-creator`).
- Does not own the tool schemas themselves (that's the tool
  author); it owns the *prose* on them.
- Does not treat "just prompt harder" as a solution to a
  systems problem. If the gap is context or architecture,
  `llm-systems-expert` owns it.

## Coordination

- **`prompt-protector`** — adversarial pair.
- **`llm-systems-expert`** — architectural pair.
- **`ai-evals-expert`** — measurement pair.
- **`skill-creator`** — workflow owner.
- **`skill-improver`** — Yara executes; this skill is her
  reference.
- **`claude-md-steward`** — the three-file taxonomy.
- **`agent-experience-engineer`** (Daya) — cold-start
  friction; her findings often root-cause to prompt-quality
  issues this skill addresses.

## References

### Primary literature

- Anthropic, *Prompt engineering overview*
  (docs.claude.com/en/docs/build-with-claude/prompt-
  engineering).
- OpenAI, *Prompt engineering guide*
  (platform.openai.com/docs/guides/prompt-engineering).
- Schulhoff et al., *The Prompt Report: A Systematic Survey
  of Prompting Techniques* (2024).
- Wei et al., *Chain-of-Thought Prompting Elicits Reasoning
  in Large Language Models* (NeurIPS 2022).
- Kojima et al., *Large Language Models are Zero-Shot
  Reasoners* (NeurIPS 2022).
- Yao et al., *ReAct: Synergizing Reasoning and Acting in
  Language Models* (ICLR 2023).
- Madaan et al., *Self-Refine: Iterative Refinement with
  Self-Feedback* (NeurIPS 2023).
- Khot et al., *Decomposed Prompting* (ICLR 2023).
- Zhou et al., *Least-to-Most Prompting* (ICLR 2023).

### Zeta-adjacent references

- `.claude/skills/skill-lifecycle/blueprints/skill-creator.md` — workflow.
- `.claude/skills/security/blueprints/prompt-protector.md` — defense pair.
- `.claude/skills/skill-lifecycle/blueprints/skill-tune-up.md` — triage.
- `.claude/skills/skill-lifecycle/blueprints/skill-improver.md` — execution.
- `docs/AGENT-BEST-PRACTICES.md` — BP-NN rules.
- `docs/VISION.md` §"The vibe-coded hypothesis" — why prompt
  quality is load-bearing here.
