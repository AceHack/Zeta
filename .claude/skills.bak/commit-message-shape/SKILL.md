---
name: commit-message-shape
description: "Commit-message conventions — imperative subject, WHY body, scope prefix, Co-Authored-By footer."
---

# Commit-Message Shape — Procedure

Capability skill. No persona. Wear this hat when
drafting any commit message.

## When to wear

- Writing a commit message.
- Reviewing a PR's commit history for squash-merge
  prep.
- Unsure whether a multi-file change should be one
  commit or several.

## The canonical shape

```
<scope>(<area>): <imperative-mood subject, <= 72 chars>

<optional one-paragraph context: why this change exists,
what problem it closes, what constraint drove the
approach. Not "what changed" — the diff shows that.
Wrap at 72.>

- Concrete change 1 — one line, specific.
- Concrete change 2 — one line, specific.
- Concrete change 3 — one line, specific.

<optional trailing paragraph for follow-ups, deferred
items, or links to design docs.>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

## Scope prefixes we use

- **`skill(<name>):`** — changes to a `.claude/skills/*`
  SKILL.md or agent file.
- **`deps:`** — NuGet / package bumps.
- **`docs:`** — pure documentation changes.
- **`Round N —`** — round-level narrative commits
  (governance rules, design-doc landings, anchor
  deliverables).
- **Plain subject** — implementation commits with no
  obvious bucket fit.

Scope prefixes are **encouraged, not mandatory**. A
descriptive imperative subject is more important than
getting the prefix right.

## Subject line

- **Imperative mood.** "Add FsCheck law runner" not
  "Added FsCheck law runner" or "Adding FsCheck law
  runner."
- **No trailing period.** It's a title, not a sentence.
- **≤ 72 chars.** Wraps cleanly in git log and GitHub
  UI.
- **Specific.** "Fix bug" is useless; "Fix
  RetractionCompletenessLaw off-by-one in continuation
  comparison" is useful.
- **Capitalise the first word of the subject.**

## Body

- **Explains WHY.** The diff shows what changed; the
  body justifies it.
- **72-char wrap.** Not strict but conventional. Works
  with `git log` on an 80-col terminal.
- **Reference issues, rounds, governance rules.**
  "Aaron round 29:", "GOVERNANCE §24", "Kira P0 finding
  in round 28."
- **Quote direct asks from Aaron when relevant.** His
  framing usually carries the constraint we're honouring.
- **Bullet list of concrete changes** when the commit
  touches multiple files or surfaces. One bullet per
  change; one line per bullet; specific file paths.
- **Name deferrals explicitly.** "DEBT entry added for
  X", "flagged as backlog", "retired in same commit, no
  alias per §24."

## The Co-Authored-By footer

Every commit authored by an AI agent carries:

```
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

Purpose: auditable attribution; GitHub renders the
coauthor; future contributors see the origin. The
`noreply@anthropic.com` is a real Anthropic address;
don't invent a different email.

## HEREDOC mechanics

Multi-line commit messages and PR bodies use the HEREDOC
pattern to preserve formatting through the shell:

```bash
git commit -m "$(cat <<'EOF'
feat(B-0042): add the thing

Why: Aaron asked for it. The constraint is X.

- Change 1
- Change 2

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

Key details:

- **Single-quoted `'EOF'`** — prevents shell expansion
  inside the message (dollar signs, backticks stay literal).
- **No leading whitespace** on the `EOF` terminator line.
- **The closing `)"` on the same line as `EOF`** — no
  trailing newline after the message.

PR bodies use the same pattern:

```bash
gh pr create --title "the title" --body "$(cat <<'EOF'
## Summary
...
EOF
)"
```

## One commit or several

**One logical change per commit.** Rules of thumb:

- **One commit** — a refactor that touches many files
  but is the same conceptual change. The rename sweep
  is one commit, not one-per-file.
- **Separate commits** — unrelated changes that happen
  to land in the same working tree. Design doc + code
  that implements it can be one commit; design doc +
  unrelated bug fix should be two.
- **Round close bookkeeping** — always its own commit
  (updates to `CURRENT-ROUND.md`, `ROUND-HISTORY.md`,
  `WINS.md`).

## Pitfalls we've hit

- **Subject line too generic.** "Update files." Useless
  in a year; useless in three months. Be specific.
- **Body describes diff.** "Added lines X through Y."
  That's what the diff shows. The body should say why
  those lines matter.
- **Missing Co-Authored-By.** Breaks audit trail; GitHub
  won't render the coauthor correctly.
- **Commit bundles unrelated changes.** Harder to
  revert, harder to review, harder to cherry-pick.
  Split before committing.
- **Passive voice subject.** "Was fixed" vs "Fix."
  Active / imperative is the convention.
- **Trailing period in subject.** Non-standard.
- **Over-long subject.** ">72 chars wraps ugly in most
  UIs."

## Interaction with other skills

- **`sweep-refs`** — rename sweeps use a single commit
  with a specific subject shape describing the move.
- **`round-open-checklist`** — round-boundary commits
  use the `Round N —` prefix.
- **`holistic-view`** — if the commit's scope surprises
  a reviewer, the commit message hid cross-links the
  body should have named.
- **Reviewers (Kira, Rune)** — read commit messages
  before diffs. A bad message predicts a bad review
  experience.

## Reference patterns

- `git log --oneline --all` — visual cadence of our
  subject-line discipline
- Recent good example subjects:
  - "Round 28 — LawRunner: Linear + retraction-
    completeness laws live"
  - "skill(devops-engineer): initial — Dejan"
  - "deps: Bump FsUnit.xUnit from 7.1.0 to 7.1.1 (#1)"
- `.claude/skills/sweep-refs/SKILL.md` — sibling; rename
  sweeps have their own commit shape
- GOVERNANCE §2 — docs-read-as-current-state is why the
  WHY belongs in commit messages, not in-tree comments
