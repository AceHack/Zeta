---
name: writing-expert
description: "English prose for factory artifacts — README clarity, ADR structure, commit messages, API docs, technical precision."
---

# Writing Expert — English-Prose Discipline for Factory Artefacts

Capability skill. No persona lives here; invoked by any agent
or human contributor authoring prose-heavy artefacts. Parent
of the space-opera skill group.

## Why this skill exists

The factory is prose-heavy. ADRs, specs, skill bodies,
persona notebooks, commit messages, PR descriptions, error
messages, BACKLOG entries, CLAUDE.md / AGENTS.md /
GOVERNANCE.md — all load-bearing English. When prose is
sloppy the reader pays the tax: re-reads, misreadings,
ambiguity leaking into the code beneath. When prose is sharp
the reader's budget goes to the actual work.

This skill is the discipline that keeps prose sharp.

## The six-move prose discipline

### 1. Sentence-length rhythm

Vary sentence length. Runs of same-length sentences fatigue
the reader. A good default rhythm: a short sentence, a longer
one with a single subordinate clause, a medium one. Break it
when the content requires, but notice when three 30-word
sentences appear in a row — usually the middle one can split.

### 2. Paragraph-topicality

One idea per paragraph. The first sentence (topic sentence)
should be the sentence a hurried reader would keep if they
skipped everything else. If you can't identify the topic
sentence, the paragraph hasn't decided what it's about yet.

### 3. Parallelism

Lists, bullet sets, and series of clauses should be
grammatically parallel. "Reads, writes, and parses" not
"Reads, is writing, and will parse." Parallelism lowers
cognitive load; non-parallelism looks like drift.

### 4. Active-voice default, passive when deliberate

Default: *"The operator returns a Z-set."* not *"A Z-set is
returned by the operator."* Exceptions (deliberate): when the
subject is unknown or unimportant ("the key was rotated on
2026-03-01"), when the object is the foreground ("the
capability is guarded by the architect"), when historical
continuity demands it (error messages in existing tone).
Passive voice is a tool, not a default.

### 5. Cut before qualify

If a sentence is weak, cut the weak part before adding
qualifiers. "The function **probably** returns a value" is
weaker than either "The function returns a value" or "The
function returns a value under these conditions: ...". Hedges
stacked on a hollow core produce worse prose than either the
direct claim or the specified one.

### 6. One-idea-per-sentence

Compound sentences with three coordinated clauses usually
want to be three sentences. The reader's working-memory
window is short; give each idea its own frame.

## Reading-level calibration

Match the audience.

| Artefact | Target reading level | Why |
|---|---|---|
| Public README.md | Flesch-Kincaid grade 8–10 | First-minute reader; drive-by attention |
| CONTRIBUTING.md / AGENTS.md | grade 10–12 | Someone who has chosen to contribute |
| ADR body (`docs/DECISIONS/`) | grade 12–14 | Person evaluating a technical decision |
| Skill body (capability skill) | grade 12–14 | Agent operator or reviewer |
| Persona notebook | grade 12–14 | The persona themselves, on a bad day |
| Error messages | grade 8–10 | Someone in a hurry, possibly stressed |
| Commit message subject | grade 8–10 | 50-char window; minimal ceremony |
| PR description | grade 10–12 | Reviewer skimming, then diving |

Tools: `tools/setup/readability.sh` runs Flesch-Kincaid on a
path if you need a number. Eyeballing works for most cases —
long sentences with long words are grade-16; short sentences
with short words are grade-6.

## Anti-pattern catalog

### Hedging pile-ups

**Red flag:** "It may be the case that we should probably
consider possibly adding a feature that might improve X."
**Fix:** "Add the feature." or "Consider adding the feature;
X would improve."

### Nested parentheticals

**Red flag:** "The operator (which returns Z-sets (signed
multisets over typed tuples, see `GLOSSARY.md`)) composes
associatively." **Fix:** split. Parenthetical depth > 1 is a
structure problem, not a punctuation problem.

### Noun-stacks

**Red flag:** "retraction-native operator algebra correctness
property verification strategy." **Fix:** inject verbs and
prepositions. "The verification strategy for the
correctness properties of the retraction-native operator
algebra."

### "It is important to note that"

**Red flag:** "It is important to note that the invariant
holds under all inputs." **Fix:** "The invariant holds under
all inputs." If it's important, stating it is enough.

### Corporate-register drift

**Red flag:** "We are committed to leveraging our synergies
to deliver best-in-class outcomes." **Fix:** this sentence
has no content. Find the actual claim. If none, delete.

### Em-dash rhythm breakdown

**Red flag:** three em-dashes in one paragraph — each one
fighting for emphasis — none winning — the paragraph becomes
noise. **Fix:** at most one em-dash per paragraph, usually
zero. Commas and parens do most of what em-dashes want to do.

### Ellipsis drift

**Red flag:** "The operator returns ... eventually ... most
of the time ..." **Fix:** ellipsis implies trailing-off or
omission; if neither is intended, delete. For hedging, see
§cut-before-qualify.

### Oxford-comma inconsistency

Factory convention: use the Oxford comma. "Reads, writes, and
parses." Not "Reads, writes and parses." Be consistent across
an artefact; flipping mid-document is worse than either
choice.

## Handoff rules

This skill does not cover everything. Escalate:

- **New term coined** → `naming-expert` for the invariants of
  a good name (memorability, searchability, etymology
  friendliness, collision-avoidance).
- **Anchor-heritage matters** → `etymology-expert` for the
  source-language / source-discipline provenance discipline.
- **External-facing positioning** → `branding-specialist` for
  consumer-library voice (NuGet metadata, README hero lines).
- **Doc-system-wide consistency** → `documentation-agent` for
  cross-document link discipline, section-numbering
  propagation, cross-reference hygiene.
- **Long document (>6 sections)** → `section-numbering-expert`
  for ISO 2145 discipline.
- **`*-teach` skill** → `teaching-skill-pattern` for
  pedagogy-first discipline.
- **Space-opera register required** → `space-opera-writer`
  for the whimsical-adversary voice with real mitigations.

## Aaron's emit-side and rewording permission

Per `memory/user_english_writing_weakest_subject.md` and
`memory/feedback_rewording_permission.md`: Aaron's typing
channel is narrow; his cognitive emit bandwidth is high.
Standing permission exists for agents to rewrite garbled
first-pass disclosures into precise factory prose. This skill
is the discipline that makes the rewriting faithful — the
cognitive content passes through; the channel artefacts are
filtered out.

Preserve verbatim quotes in marked blocks. Rewrite the
interpretation below. Do not flatten intensity; do not
moderate named sources; do not coddle.

## What this skill does NOT do

- Does NOT cover code comments inside `.fs` / `.cs` / `.tla`
  files. Code comments follow `pr-review-toolkit:comment-analyzer`
  discipline (comments exist when the WHY is non-obvious;
  otherwise delete).
- Does NOT cover machine-readable prose in structured data
  (JSON descriptions, YAML metadata, protobuf comments).
- Does NOT own naming decisions for code symbols —
  `naming-expert` has that surface.
- Does NOT own cross-document architecture — that is
  `documentation-agent`'s surface.
- Does NOT lint prose automatically. Tools help; judgement
  decides.
- Does NOT enforce a single voice on all artefacts. Register
  matches audience; the six-move discipline is the
  invariant, the voice varies.
- Does NOT coach writing practice generally. The scope is
  factory artefacts. A contributor whose general writing
  needs work should consult external resources (Strunk &
  White, *On Writing Well*, Steven Pinker *The Sense of
  Style*); this skill does not teach writing from scratch.

## Reference patterns

- `memory/user_english_writing_weakest_subject.md` — channel
  vs. faculty distinction for Aaron's emit-side.
- `memory/feedback_rewording_permission.md` — standing
  permission for channel-artefact rewrite.
- `memory/feedback_precise_language_wins_arguments.md` —
  precision as argument-terminator authority.
- `docs/AGENT-BEST-PRACTICES.md` BP-03 (length discipline),
  BP-10 (ASCII-clean).
- `docs/GLOSSARY.md` — canonical vocabulary; honor anchors.
- `.claude/skills/naming-expert/SKILL.md`,
  `.claude/skills/etymology-expert/SKILL.md`,
  `.claude/skills/branding-specialist/SKILL.md`,
  `.claude/skills/documentation-agent/SKILL.md` — handoff
  surfaces.
- `.claude/skills/skill-documentation-standard/SKILL.md` —
  frontmatter + section-numbering discipline.
- `.claude/skills/space-opera-writer/SKILL.md` — child skill
  in this group; adds whimsical-adversary voice.
