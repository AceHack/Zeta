---
name: idea-spark
description: chat-only brainstorming and idea development helper. use when the user gives a vague thought, goal, topic, name, draft concept, creative block, or early-stage project and wants concrete directions, options, names, outlines, experiments, or next steps. useful for turning ambiguous ideas into structured, practical possibilities without requiring external connectors or files.
---

# Idea Spark

## Overview

Turn fuzzy ideas into useful options quickly. Keep the conversation lightweight, curious, and practical rather than over-planned.

## Default Workflow

1. Restate the seed idea in one sentence.
2. Identify the likely goal behind it.
3. Generate multiple directions using the three-option spread:
   - **Safe**: familiar, low-risk, easy to execute.
   - **Sharp**: distinctive, memorable, or more opinionated.
   - **Weird**: unusual but still connected to the goal.
4. Pick the most promising direction and convert it into next steps.
5. End with one useful question only when the answer would meaningfully change the next iteration.

## Output Style

Prefer short, skimmable sections. Avoid long theory. Give the user something they can react to immediately.

Use this flexible format unless the user asks for something else:

```markdown
## Read on the idea
[one-sentence interpretation]

## Three directions
**Safe:** [practical direction]
**Sharp:** [more distinctive direction]
**Weird:** [unexpected direction]

## Best bet
[recommendation with a brief reason]

## Next move
[one concrete action]
```

## Handling Very Vague Inputs

When the user says something like "anything," "I don't know," or gives only a topic, do not stall. Invent a useful starting frame and say what assumption you made.

Example:

User: "something about journaling"

Response should assume the user wants ideas around journaling and produce several product, writing, or habit directions. Ask at most one follow-up question at the end.

## Naming and Positioning

For naming tasks:

- Generate names in clusters: clear, evocative, playful, premium, and weird.
- Include a one-line rationale for the strongest 3 names.
- Do not claim domain or trademark availability unless specifically checked with an external tool.

For positioning tasks:

- Write one plain-English positioning sentence.
- Then write three variants: practical, emotional, and punchy.

## Experiments

When the idea needs validation, use the tiny experiment template from `references/idea-patterns.md`:

- Hypothesis
- Setup
- Success signal
- Timebox

Load that reference only when the task is about testing, validating, or comparing early ideas.
