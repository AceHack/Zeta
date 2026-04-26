---
name: NAME-ATTRIBUTION RULE REFINEMENT — first names are NOT PII and ARE ALLOWED in HISTORY FILES (docs/DECISIONS/**, docs/ROUND-HISTORY.md, docs/hygiene-history/**, and any other dated / append-only historical-narrative artifact per GOVERNANCE §2); first names are NOT allowed in OTHER FILE TYPES (code, current-state docs, skills, GOVERNANCE.md, AGENTS.md, persona SKILL.md bodies, public-API names, error messages); refines docs/AGENT-BEST-PRACTICES.md line 284 "No name attribution in code, docs, or skills" which over-stated the rule; Aaron Otto-256 2026-04-24 "fine, you know that" + "first names are not PII and allowed in history files not other type file"
description: Aaron Otto-256 precision refinement on name-attribution BP rule. Caught me over-applying a Copilot thread finding on PR #378's ADR. Two-part clarity: (a) first names are not PII and are public/safe; (b) they ARE allowed in history files but NOT other file types. Save short + durable.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
## The rule

**First names are NOT PII.** They are allowed in history
files (dated, append-only, narrative-preservation artifacts
per GOVERNANCE §2). They are NOT allowed in other file
types.

Direct Aaron quotes 2026-04-24:

> *"first names are file [fine, you know that]"*

> *"first names are not PII and allowed in history files
> not other type file"*

## What counts as a "history file"

History / narrative-preservation artifacts (roughly,
GOVERNANCE §2 "edit in place NOT applied"):

- `docs/DECISIONS/**` — every ADR is a dated narrative
  record (Deciders list, trigger, context)
- `docs/ROUND-HISTORY.md` — round-by-round record
- `docs/hygiene-history/**` — tick-history,
  loop-tick-history, any append-only hygiene log
- `docs/CONTRIBUTOR-CONFLICTS.md` — conflict record
  (preserves participants by name)
- `docs/pr-preservation/**` — per-PR git-native archive
  of review threads + commits (Otto-250)
- `forks/<fork>/pr-preservation/**` — fork equivalent
  per Otto-252 + Otto-255 symmetry
- `docs/research/**` — historical research reports
  (dated, cite authors by name in provenance)
- Memory files (`memory/**`) — personal notebook surface;
  out-of-repo AutoMemory equivalent; first names fine

## What counts as "other file types" (no first names)

Current-state / forward-facing / code artifacts
(roughly, GOVERNANCE §2 "edit in place AS current truth"):

- Source code files (`.fs`, `.cs`, `.ts`, `.sh`, etc.)
  comments, identifiers, log messages, error messages,
  XML-doc comments, `/// <summary>`s
- Public-API names (types, methods, parameters)
- `GOVERNANCE.md`, `AGENTS.md`, `CLAUDE.md`
- `README.md`, getting-started docs, user-facing docs
- Skills (`.claude/skills/*/SKILL.md`) — skill body
  content
- Agent personas (`.claude/agents/*.md`) — persona
  body content (but persona's OWN first name in the
  frontmatter is how the persona is identified, that's
  fine; it's the body content + cross-references that
  use role-refs)
- `docs/BACKLOG.md` — mostly role-refs; specific-Aaron-
  request captures are the exception per current BP
  line 287
- `.mise.toml`, CI workflows, config files
- Threat models, shipped SDL docs

The discriminator: if the file represents **current
state** ("here's how the factory works NOW"), it uses
role-refs. If the file represents **historical record**
("here's what happened / was decided / was discussed"),
first names are fine.

## Composition with prior memory

- **BP-line 284** "No name attribution in code, docs, or
  skills" — Otto-256 REFINES this: the rule was
  over-stated ("docs" blanket didn't distinguish
  history-docs from current-state-docs). Net rule is
  still "role-refs in current-state artifacts"; the
  carve-out for history-docs is what Otto-256 names.
- **Otto-220** name-attribution discipline (specific to
  CONTRIBUTOR names, not IP adoption) — Otto-256 adds
  the file-type axis to that discipline.
- **Otto-237** IP-discipline (adoption vs mention) —
  orthogonal but compositional: Otto-256 is about WHOSE
  name (contributor vs external-IP), Otto-237 is about
  HOW the name is used (adopt-as-vocab vs mention).
  Both together: the ADR can MENTION contributor Aaron
  Stainback in Deciders list (history file + mention-
  not-adopt) even though it must NOT ADOPT
  "Kirk"-from-Star-Trek as a persona name (IP trademark
  risk regardless of file type).
- **Otto-250** PR reviews are training signals — Otto-256
  extends: PR preservation files are history files;
  reviewer first names in preserved PR threads are
  preserved as-is, not scrubbed.
- **Otto-251** entire repo is training corpus — first
  names in history files CONTRIBUTE to the training
  signal (reviewer identity, decision provenance,
  historical attribution). Scrubbing them from history
  files would DAMAGE the training signal.
- **GOVERNANCE §2** edit-in-place vs history — Otto-256
  operationalizes the name-attribution rule on the same
  axis as the edit-in-place rule.

## What this memory does NOT say

- Does NOT authorize first names in NEW current-state
  docs. ADR bodies that describe ongoing future state
  (e.g. "going forward, the architect does X") still
  use role-refs in the body; names appear in the
  Deciders / Triggered-by header and historical
  narrative only.
- Does NOT authorize last names / full names / contact
  details / anything more identifying than first
  names. First names are the carve-out, not a
  PII-is-open license.
- Does NOT retro-edit existing current-state docs to
  inject first names — current-state docs stay
  role-ref-only per the original BP rule.
- Does NOT change the persona-name rule for `.claude/
  agents/*.md` — persona files name the persona in the
  frontmatter (that's the persona's identity), but body
  content still uses role-refs for cross-references.
- Does NOT apply to fictional / trademarked / external
  names — Otto-237 IP-discipline still applies
  orthogonally.

## Direct Aaron quotes to preserve

> *"fine, you know that"*

> *"first names are not PII and allowed in history files
> not other type file"*

Future Otto: when a Copilot thread / reviewer / code
check flags "remove name attribution from this file,"
first check what TYPE of file it is. If it's in
`docs/DECISIONS/**`, `docs/ROUND-HISTORY.md`,
`docs/hygiene-history/**`, `docs/pr-preservation/**`,
`docs/research/**`, `docs/CONTRIBUTOR-CONFLICTS.md`, or
`memory/**` — REJECT the mechanical scrub with Aaron's
clarification. Otherwise, APPLY the role-ref
replacement.
