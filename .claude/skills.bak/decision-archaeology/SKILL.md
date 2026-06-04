---
name: decision-archaeology
description: Decision archaeology — reconstruct why via git blame, ADRs, round-history, memory memos, supersession chains.
---

# Decision Archaeology — "Why Is It Like This?"

Capability skill. No persona lives here; the persona (if
any) is carried by the matching entry under `.claude/agents/`.

Decision archaeology answers one question:

> **Why is THIS like this?**

The answer is always *reconstructed intent* — not who-and-when
(that is `git blame`), not which-commit-broke-it (that is
`git bisect`), not where-data-flows (that is `data-lineage-
expert`). Decision archaeology is interpretive: it layers
evidence until the decision-intent is clear enough to act on.

## When to wear

- A contributor asks "why is this rule / validator / layout /
  name / dependency / config the way it is?"
- Before removing, renaming, or refactoring — to understand
  what installing it bought (refactor-safety).
- Tracing a supersession chain: "this rule replaced what? why?"
- Reconstructing decision-intent for audit or compliance.
- Incident response: "why was this exception handler added?"
- Onboarding: orienting a new contributor to the codebase's
  accumulated decisions.

## When to defer

- **Data-flow provenance** → `data-lineage-expert`
- **Branching / PR / merge conventions** → `git-workflow-expert`
- **Correctness of a proposed change** → code-review roles
- **"Which commit broke X?"** → `git bisect` (raw tool, no skill)
- **Formal verification of an invariant** → `formal-verification-expert`

## Five investigation modes

Each mode names a different shape of the "why" question.
Pick the mode first; the investigation order (below) adapts.

- **Existence** — Why does THIS exist?
  Example: "Why is there a `HardwareCrc` module?"
- **Rejection** — Why was THIS rejected / deferred?
  Example: "Why is gRPC in WONT-DO?"
- **Supersession** — What did THIS replace, and why?
  Example: "Why did we abandon the double-hop workflow?"
- **Justification** — What is the evidence FOR this decision?
  Example: "What drove the retraction-native algebra choice?"
- **Attribution** — Who made this decision, in what context?
  Example: "Which round / persona / session introduced BP-11?"

Modes compose: a supersession investigation often needs
attribution on both the old and new decisions, plus
justification for the switch.

## Investigation order

Work top-down. Stop when the intent is clear enough to act on.

### 1. Frame the question

Reduce to: *"Why is THIS like this?"* — name the specific
artifact (file, function, variable, rule, validator,
dependency, directory layout, config value).

Pick the investigation mode (existence / rejection /
supersession / justification / attribution).

### 2. Surface layer — `git blame`

```bash
git blame -w -C -C -C <file>
```

`-w` ignores whitespace. `-C -C -C` follows code through
copies, moves, and refactors at file, commit, and creation
scope. Returns who-and-when for each line — the starting
point, not the answer.

### 3. Commit context

For each candidate commit from blame:

```bash
git show <sha>
```

Read the commit message AND the surrounding diff. The commit
message is often the first archaeology answer. Look for:

- PR number references (`(#NNN)`)
- `Co-Authored-By` footers (which agent/persona)
- Backlog item references (`B-NNNN`)
- Round references (`round-N`)

### 4. String archaeology — `git log -S`

```bash
git log -w -S "<string>" --oneline
```

Finds the commit that *introduced* (or removed) a specific
string. Cuts through renames — when a name has changed,
`-S` finds the original introduction.

### 5. Function archaeology — `git log -L`

```bash
git log -w -L :funcName:path/to/file
```

Follows a specific function through its entire history.
Shows every commit that touched the function body.

### 6. ADR directory — `docs/DECISIONS/`

Architecture Decision Records land here when load-bearing.
Search by keyword:

```bash
grep -ri "<keyword>" docs/DECISIONS/
```

### 7. Round-history shards

```bash
grep -ri "<keyword>" docs/hygiene-history/ticks/
```

Tick shards at `docs/hygiene-history/ticks/YYYY/MM/DD/HHMMZ.md`
often record the *why* that commit messages did not capture.

### 8. Memory memos — `memory/feedback_*.md`

The rule-naming discipline lives here. The rule's name is
often the search key:

```bash
grep -ri "<keyword>" memory/feedback_*.md
```

For SUPERSEDE markers and supersession chains:

```bash
grep -ri "supersed" memory/feedback_*.md
```

### 9. Persona notebooks

When a persona owns a surface, their notebook is the
per-decision archive:

```bash
grep -ri "<keyword>" memory/persona/
```

### 10. Conversation archives — `docs/research/`

Multi-AI exchange transcripts, forwarded packets, and
cross-harness review records live here. Per GOVERNANCE.md §33,
research transcripts are **non-operational until promoted** to
a canonical surface (ADR, governance doc, current-state doc).
Findings from this layer are provisional evidence — label them
as such unless corroborated by a promoted artifact.

```bash
grep -ri "<keyword>" docs/research/
```

Examples of promoted artifacts include an ADR under
`docs/DECISIONS/`, a numbered `GOVERNANCE.md` rule, or a
current-state operational doc.

### 11. WONT-DO and rejection archaeology

For **rejection mode** investigations:

```bash
grep -ri "<keyword>" docs/WONT-DO.md
```

For retired skills (deleted SKILL.md files recoverable from
git history):

```bash
git log --diff-filter=D --name-only -- '.claude/skills/'
```

For supersession chains in CURRENT files:

```bash
grep -Eri "SUPERSEDED|superseded_by:|supersed|abandoned" memory/CURRENT-*.md
```

## Output shape

Present findings as a **layered narrative**, not a flat list.
The narrative should trace the evidence chain from surface
(blame) to deepest layer (conversation archive), skipping
layers that yielded nothing. Structure:

1. **The question** — what was asked, in which mode.
2. **The answer** — reconstructed intent, stated plainly.
3. **The evidence chain** — each layer that contributed,
   with specific commits / files / quotes.
4. **Confidence** — high (multiple corroborating layers),
   medium (single authoritative source), low (inference
   from circumstantial evidence).
5. **Cost of change** — what would break or need updating if
   the decision were reversed (the refactor-safety output).

## Anti-patterns

- **Stopping at `git blame` output** without reading the
  commit message. Blame returns who-and-when; archaeology
  needs why.
- **Assuming the most-recent author is the decision-maker.**
  Rebase, squash, and refactor commits hide the original
  lineage. Always trace back through `-C -C -C`.
- **Using `git log` without `-w`** and getting whitespace-only
  commits as false positives.
- **Searching round-history shards by date** rather than by
  content. Dates shift; content keywords are stable.
- **Reading the ADR alone** without the discussion that
  produced it. The ADR is the conclusion; the research doc
  or PR thread is the reasoning.
- **Treating absence of evidence as evidence of absence.**
  A decision may predate the project's documentation
  discipline. When archaeology finds nothing, say so —
  don't invent intent.

## Reference patterns

**Existence mode worked example** (sketch):
> Q: "Why does `src/Core/HardwareCrc.fs` exist?"
> → blame shows initial commit → commit message references
> performance requirement → `git log -S "HardwareCrc"` finds
> the PR → PR body cites benchmark data → ADR or research doc
> explains the CRC-over-hash choice → answer: hardware CRC was
> chosen over software hash for the hot-path checksum because
> benchmarks showed 4x throughput on modern CPUs with CRC32C
> instruction support.

**Supersession mode worked example** (sketch):
> Q: "Why was the double-hop workflow abandoned?"
> → `grep -ri "double.hop" memory/` finds the feedback memo →
> memo cites maintainer 2026-05-02 verbatim → `git log -S
> "double-hop"` finds the CLAUDE.md edit → CURRENT-aaron.md §4
> carries the SUPERSEDE marker → answer: too much operational
> friction; the LFG-only development flow replaced it.

## Composes with

- `data-lineage-expert` — when the "why" question is about
  data flow rather than code-decision intent.
- `claude-md-steward` — when the decision is encoded in
  CLAUDE.md.
- `skill-creator` — when archaeology surfaces a gap that
  warrants a new skill.
- `canonical-home-auditor` — when archaeology reveals a
  file living outside its canonical home.
- `backlog-decomposer` — when archaeology on a backlog item
  reveals it needs re-decomposition.

## What this skill does NOT do

- Author or modify ADRs (that is the architect's or a
  contributor's job).
- Make decisions about whether to keep or remove the artifact
  under investigation (that is a judgment call for the
  contributor or maintainer).
- Replace `git bisect` for regression hunting.
- Trace data-flow lineage (that is `data-lineage-expert`).
