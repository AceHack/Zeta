---
id: B-0069
priority: P2
slug: heredoc-patterns-encode-into-commit-message-shape-skill
status: backlog
created: 2026-04-28
maintainer: aaron
ownership: otto
title: Encode HEREDOC patterns into commit-message-shape skill (Aaron 2026-04-28)
---

# B-0069 — Encode HEREDOC scripts into substrate

## Why

The human maintainer 2026-04-28 (verbatim, /btw aside during PR drain):

> "does HEREDOC have scripts we should encode into substraight?"

The factory uses a recurring `git commit -m "$(cat <<'EOF' ... EOF
)"` HEREDOC pattern for commit messages and `gh pr create --body
"$(cat <<'EOF' ... EOF
)"` for PR bodies. These patterns have nuance that is currently
tribal knowledge — should be encoded into
`.claude/skills/commit-message-shape/SKILL.md` so future
agents/contributors get the discipline at session-bootstrap, not
discover it through trial-and-error.

## Patterns worth encoding

1. **Single-quoted EOF (`<<'EOF'`)** — prevents shell expansion of
   backticks (`` ` ``), `$variables`, `$(command)` substitution, and
   `\` escapes inside the body. Critical for commit messages /
   PR bodies that contain literal backticks (markdown code spans),
   dollar-prefixed identifiers (file paths, env vars), or shell
   metacharacters. Unquoted `<<EOF` would break those.

2. **Closing `EOF\n)"` form** — the trailing newline before the
   closing `)` is what makes the HEREDOC parse correctly inside the
   `$(...)` command substitution. Missing the newline produces a
   shell parse error.

3. **Trailer-block placement at end** — when the HEREDOC body ends
   with an AgencySignature trailer block, the trailer block must be
   the last lines of the body (per `git interpret-trailers` parser
   rules: trailers are the last paragraph, separated from prose by
   one blank line). Embedding trailer-shape lines mid-body breaks
   the parser.

4. **Co-authored-by line as final trailer** — the `Co-authored-by:`
   line attributes the agent contribution; lives at end of trailer
   block. Composes with the AgencySignature 7-trailer schema (per
   task #298 + task #299 + Amara ferry-7 absorb at
   `docs/research/2026-04-26-amara-fail-open-with-receipts-attribution-rule-7-trailer-schema.md`).

5. **PR body HEREDOC vs commit message HEREDOC** — same shape,
   different consumers. PR body has GitHub-flavor markdown (tables,
   task lists `[ ]`, `🤖 Generated with [Claude Code]` footer);
   commit message is plain text + trailer block. Both use
   `<<'EOF'` / `EOF\n)"`.

6. **Variable interpolation cases** — when HEREDOC body MUST include
   a shell variable (commit SHA, run ID), use unquoted `<<EOF`
   instead of `<<'EOF'`. This is rare; most cases stay
   single-quoted. Per Aaron's framing, this is the "scripts
   encoded into substrate" piece — knowing when to flip the
   quoting discipline.

7. **Backtick-in-trailer pitfalls** — backticks in trailer-block
   text (e.g., `` Authority-Source: `docs/AGENT-BEST-PRACTICES.md` ``)
   need single-quoted `<<'EOF'` to preserve literally; otherwise
   the shell parses the backticks as command substitution.

8. **Truncated heredoc end-marker rule** — closing `EOF` MUST be at
   the start of its line (no leading whitespace). YAML files / nested
   shell often add accidental indentation; that breaks the heredoc
   close detection and makes the next 1000+ lines of script body part
   of the heredoc.

## Composition with existing substrate

- `.claude/skills/commit-message-shape/SKILL.md` — the natural home
- task #296 — "Integrate ferry-3 canonical commit-attribution
  schema into commit-message-shape SKILL.md via skill-improver
  workflow" — same skill update target; bundle B-0069 with task
  #296 if the skill-improver workflow is already triggering
- `memory/feedback_otto_354_*` — AgencySignature trailer-discipline
  memory (operational status; refinement to v2 7-schema pending)
- task #298 + task #299 — pre-merge validator + post-merge
  auditor (already landed)

## Cadence

When skill-improver workflow next fires for the
commit-message-shape SKILL — bundle this with task #296 to keep
the changes coherent.

## Provenance

- Aaron 2026-04-28 verbatim (above)
- Composition partner: task #296 (skill-improver workflow trigger)
