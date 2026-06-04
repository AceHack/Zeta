# Claude Code loading taxonomy — three mechanisms, pick by failure-mode shape

Carved sentence:

> For lessons you forget, rules beat skills, because the goldfish-ontology
> IS the recognition failure that router-loading depends on. Match the
> surface to the failure-mode shape, not to convenience.

## Operational content

Three loading mechanisms across multiple surfaces:

| Mechanism | Surface | When it fires |
|---|---|---|
| **Direct-load** | CLAUDE.md, CLAUDE.local.md, `.claude/rules/*.md` (no `paths:`) | Auto-load at session start; **empirically confirmed** in this harness |
| **Lazy-load** | `.claude/rules/*.md` with `paths:` glob | When Claude reads matching files (doc-supported; not yet empirically tested) |
| **Router-keyed** | `.claude/skills/<name>/SKILL.md` | Via `Skill` tool description-matching (empirically tested) |
| **Subagent-discovery** | `.claude/agents/<name>.md` | Subagent dispatch |
| **On-demand** | `~/.claude/projects/<x>/memory/MEMORY.md` | First 200 lines / 25KB at session start + explicit Read |

**Behavioral-lesson placement rule of thumb:**

- "I keep forgetting to do X" → CLAUDE.md or `.claude/rules/` (direct-load)
- "Apply X when working with Y files" → path-scoped `.claude/rules/` (lazy-load)
- "Multi-step procedure for task T" → skill (router-keyed)
- "Role X has responsibilities Y, Z" → agent (subagent-discovery)

**The goldfish-ontology principle:** lessons with a recognition-failure
component need triggering-independent surfaces. Router-loaded skills require
the agent to recognize that routing IS needed — if the agent has already
forgotten the discipline, it won't route to the skill that reminds it.
Direct-load rules fire regardless of recognition.

## Full reasoning

`memory/feedback_claude_code_loading_taxonomy_rules_vs_skills_vs_claude_md_aaron_2026_05_01.md`
`.claude/rules/test-canary.md` (test methodology for empirical verification)
Canonical Anthropic doc: `code.claude.com/docs/en/memory`
