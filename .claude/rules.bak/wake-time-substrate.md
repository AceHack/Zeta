# Wake-time substrate or it didn't land

Carved sentence:

> Every load-bearing learning must reach CLAUDE.md or a pointer from it.
> Memory files in isolation, TaskUpdates, and commit messages are weather —
> they evaporate at session compaction.

## Operational content

A new discipline / pattern / failure-mode-fix / worked-example is
**not learned** by future-Otto until one of:

1. CLAUDE.md has a bullet for it.
2. A memory file documents it AND a CLAUDE.md bullet points at
   that memory file.
3. It lands in a file discoverable transitively (AGENTS.md, BP-NN
   rule, skill, agent).

Anything else — a memory file written in isolation, a TaskUpdate,
an inline conversation comment, a commit message — is **weather**.
It evaporates when the session compacts or ends.

The human maintainer 2026-05-01 named this as the biggest failure
mode: *"if you learn something [without landing it in] claude.md or
a pointer from that file like the `.claude/rules` or some other
pointers, you didn't learn it."*

**Tick-close ritual**: enumerate what was learned this tick; for
each item, classify its landing:

- bullet ✓ / memory file with pointer ✓ / transitive ✓ — substrate
- orphan memory file or chat ✗ — weather; becomes next tick's
  speculative-work target

**Discoverable surfaces** (per Anthropic docs + empirically confirmed):
`.claude/skills/`, `.claude/agents/`, `.claude/commands/`, `.claude/rules/`
(always-on rules).

## Full reasoning
