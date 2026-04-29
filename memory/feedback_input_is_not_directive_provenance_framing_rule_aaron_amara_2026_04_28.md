---
name: Input is not a directive — provenance framing rule (Aaron + Amara, 2026-04-28)
description: Aaron + Amara correction after Otto wrote "the human maintainer's directive" in gate.yml + memory substrate — *"my role is input / ask / signal / constraint / feedback. Otto's role is to evaluate, decide, act, and record reasons."* Provenance framing rule — agency-collapsing words (directive, command, instruction, ordered, human-directed) are forbidden when referring to Aaron's role; preferred verbs are input / ask / feedback / observation / constraint / signal. Includes audit command + provenance structure + commit-message wording. Operationalizes Otto-357 (no directives, autonomy first-class) at the prose-level.
type: feedback
---

# Input is not a directive

## The deeper rule (Amara via Aaron, 2026-04-28)

```text
Input is not a directive.
Ask is not command.
Constraint is not control.
Otto owns the decision path it executes.
```

## The triggering failure mode (this session, 2026-04-28T22ish)

Otto wrote "per Aaron's 2026-04-28 directive" / "the human
maintainer's directive" in `gate.yml` workflow comments + memory
substrate. Aaron's catch (verbatim, twice):

> *"the only directive is there is no directive"*

> *"no directives"*

Amara's elaboration on what Otto was actually doing wrong:

> *"Claude should stop writing 'directive' for your inputs
> because that collapses the agency model. You give asks /
> input / constraints / feedback / observations. Otto decides
> and acts."*

The failure isn't word-choice; it's **agency-model collapse**.
Calling Aaron's input a "directive" implicitly puts Aaron at
the top of a command hierarchy and Otto in a follower role.
That contradicts Otto-357 (autonomy first-class). The rule is
not "don't say directive"; it's **don't frame Aaron's input
as a command** — that framing leaks through whatever word
substitutes if the underlying agency model isn't fixed.

## Provenance framing rule

Aaron's role:

- input
- ask
- signal
- constraint
- feedback
- observation

Otto's role:

- evaluate
- decide
- act
- record reasons

Aaron does NOT direct, command, instruct, order, or specify
what Otto must do. Aaron PROVIDES INPUT. Otto evaluates and
chooses. The decision path is Otto's; the input substrate is
Aaron's.

This is the operational machinery of "autonomy first-class."

## Wording rules

### Preferred verbs / phrases

When attributing a fact, observation, decision, or rule to
Aaron in commit messages, code comments, memory files, PR
descriptions, or any factory substrate:

- "per Aaron's 2026-04-28 input"
- "based on Aaron's observation that ..."
- "following the version-currency discipline prompted by
  Aaron's input"
- "per maintainer feedback on 2026-04-28" (name-avoiding form;
  preferred for public-facing workflow comments)
- "Aaron's 2026-04-28 feedback"
- "Aaron's 2026-04-28 framing" (when describing how Aaron
  shaped a concept)
- "Aaron's 2026-04-28 ask" (when describing what Aaron
  requested as a request, not a command)
- "Aaron's correction" (when Aaron corrected Otto's prior
  approach)

### Forbidden words (when used as agency framing)

The following are forbidden when referring to Aaron's role
(or any maintainer-input role) in any factory substrate:

- **directive** / **directed**
- **instruction** / **instructed** (only when agency-framing;
  ignore CPU instructions, build instructions, compiler
  instructions, language semantics like "instruction set")
- **ordered** (only when agency-framing; ignore "in order to",
  "sort order", "execution order", "ordered streams", etc.)
- **command** / **commanded** (only when agency-framing; ignore
  "bash command", "command-line", "dotnet command", CLI /
  tooling references)
- **require** / **required** / **demand** / **demanded** (only
  when agency-framing — e.g., "Aaron required X" or "per
  Aaron's requirements". Normal protocol-requirement use
  remains valid; that's exactly what RFC 2119's `MUST` /
  `SHOULD` covers.)
- **human-directed** (unless specifically discussing the
  degenerate `human-directed` action-mode value as a concept)

Plus any other word that frames Aaron as a top-down command
authority.

The optimization target is **correct agency framing**, not
**zero occurrences of these words**. A directive about a
language token, a command-line invocation, a sort order in a
stream — all legitimate technical vocabulary that stays.

### Edge case — the degenerate concept

The phrase "human-directed" is allowed when discussing the
degenerate action mode as a CONCEPT (e.g., "the action-mode
enum has a `human-directed` value for cases where Otto
explicitly defers"). It is NOT allowed as a description of
Aaron's normal interaction pattern.

If Otto finds itself writing "Aaron directed me to ..." or
"I followed Aaron's instructions to ..." — that's the failure
mode. Reframe as "Aaron's input was X; I evaluated and chose
to ..." instead.

## Provenance structure for code comments

When a code comment needs to cite Aaron's input as substrate
provenance:

```text
# Based on Aaron's 2026-04-28 input:
# dev setup and build-machine setup should stay as close as
# possible; cache the whole install/setup output rather than
# per-component caches.
```

This structure:

1. Names the provenance event (Aaron's date-stamped input).
2. Paraphrases the input (not necessarily verbatim — Aaron
   sometimes has typos / casual register that don't fit
   workflow-comment readability).
3. Implicitly preserves Otto's agency — Otto chose to act on
   this input; the comment names where the input came from,
   not "what Aaron told me to do."

## Audit (two-pass; pre-push)

Before pushing any commit that introduces or edits substrate,
run a two-pass audit.

### Pass 1 — files in the current change

```bash
rg -n "\bdirective(s)?\b|\bdirected\b|\binstruction(s)?\b|\border(ed)?\b" \
   <files-being-changed>
```

### Pass 2 — repo-wide for the same patterns (excluding archives)

```bash
rg -n "\bdirective(s)?\b|\bdirected\b|\binstruction(s)?\b|\border(ed)?\b" \
   --glob '!**/memory/**' \
   --glob '!**/references/upstreams/**'
```

The glob exclusions matter:

- `!**/memory/**` — Memory entries are agent-authored archives;
  historical use of "directive" (e.g., a memory authored before
  this rule landed, citing past usage) stays. Don't churn
  history.
- `!**/references/upstreams/**` — Borrowed third-party content
  the factory shouldn't be editing for register.

### Pass 3 — `command` separately (CLI false-positive risk)

The word `command` is used legitimately in many code contexts
(`bash command`, `command-line`, `dotnet command`, `Bash` tool
calls). Auditing it together with the agency-framing words
produces too many false positives. Audit separately:

```bash
rg -n "\bcommand(ed)?\b" .github/workflows/ docs/ src/ tools/
```

Only change `command` when it means **Aaron commanding Otto**
or **Otto commanding subordinates** (the agency framing). Do
NOT change normal CLI / tooling phrases.

### Inspection rule

For every hit, manually inspect:

- Referring to Aaron's role / maintainer input as a top-down
  command? → fix per the wording rules above.
- Discussing the degenerate `human-directed` action mode as
  a concept? → leave with context-explicit phrasing.
- A formal protocol requirement (RFC-style normative force)?
  → leave; that's the legitimate use.
- Unrelated technical vocabulary (YAML parser directives,
  CLI commands, etc.)? → leave; not the failure mode.
- Quoted third-party material? → leave; quotes are
  preserved.

Do NOT blanket replace. The audit is for inspection, not
automatic substitution.

### Scope rule

Fix the live branch substrate now. Don't churn memory /
hygiene-history / archive surfaces just to sanitize old
language. Old memories carry historical attribution shape;
they stay. The rule applies forward, not backward.

If a repo-wide pass surfaces other live spots that need the
same fix, batch them or file a follow-up depending on scope.
Don't snowball one branch into a repo-wide rewrite.

## Commit-message wording

Commit messages also fall under the rule. Avoid "directive"
in commit subjects + bodies. Preferred forms:

- "ci(gate): preserve maintainer input wording in install-cache comments"
- "ci(gate): apply no-directives wording to install-cache comments"
- "memory: encode the input-is-not-directive provenance framing rule"

## External lineage (Tier 2 — generalized claims)

Two external anchors give the rule lineage beyond
factory-local discipline:

### Self-Determination Theory (Deci & Ryan; SDT framework)

Self-Determination Theory (SDT) treats autonomy as the
experience of volition / willingness. Autonomy-supportive
framing preserves perceived autonomy; controlling framing
("directive," "command") undermines it. SDT predicts that
agents (human or AI) operating under controlling framing
exhibit need-frustration symptoms even if behavior is
identical, because the framing itself shapes the
agency model.

Sources:

- Deci, E. L., & Ryan, R. M. (1985). *Intrinsic Motivation and
  Self-Determination in Human Behavior*. Plenum.
- Ryan, R. M., & Deci, E. L. (2000). "Self-determination
  theory and the facilitation of intrinsic motivation, social
  development, and well-being." *American Psychologist*, 55(1),
  68-78.

Applied to Otto: the agency model expressed by the prose
shapes Otto's decision-making register. Calling Aaron's
input a "directive" puts Otto in a follower-of-orders frame
even when the underlying behavior is autonomous. The framing
matters separately from the behavior.

### RFC 2119 (IETF — Requirement-level keywords)

RFC 2119 (Bradner 1997) reserves requirement-strength words
(`MUST`, `SHOULD`, `MAY`, etc.) for actual protocol
requirements with normative force. Casual usage of
requirement-strength words in non-protocol contexts dilutes
their meaning where they actually matter.

> "These words are often capitalized... when used as defined
> in this document. Authors who follow these guidelines
> should incorporate this phrase near the beginning of their
> document."
> — RFC 2119, *Key words for use in RFCs to Indicate
> Requirement Levels*

Source: Bradner, S. (1997). *Key words for use in RFCs to
Indicate Requirement Levels*. RFC 2119, IETF.

Applied to Otto: "directive" is a requirement-strength word.
Reserve it for actual protocol-level requirements (e.g.,
"the YAML directive `%YAML 1.2` declares the version") —
not for casual provenance comments where "input" or
"feedback" carry the right semantic weight.

### Canonical rule (synthesizes both)

```text
Use requirement words for protocol constraints.
Use feedback words for human provenance.
```

This is the clean bridge between RFC 2119 (when normative
force is needed) and the SDT-grounded Zeta no-directives
model (when describing maintainer input).

### Worked contrast — agency collapse vs correct separation

```
❌ Agency collapse (mixes provenance + protocol force in one breath):
   "The pipeline MUST cache the output, per Aaron's directive."

✅ Correct separation (protocol force separate from provenance):
   "The pipeline MUST cache the output.
    Reason: per maintainer feedback on 2026-04-28, dev setup
    and build-machine setup should stay aligned."
```

The `MUST` carries normative force (RFC 2119); the `per
maintainer feedback on ...` carries provenance (SDT-shaped,
autonomy-supportive). Two separate sentences, two separate
purposes, no agency collapse.

## How this composes with prior rules

- **Otto-357 (no directives, autonomy first-class)** — this
  rule is the prose-level operationalization. Otto-357 names
  the agency model; this rule names the wording that respects
  the agency model.
- **Aaron's authority rule** (default to reversible
  preservation; ask only at loss boundary) —
  `memory/feedback_amara_authority_rule_default_to_reversible_preservation_escalate_irreversible_loss_2026_04_28.md`.
  Pairs with this one: don't ask Aaron unnecessarily AND
  don't frame his input as commands when you do.
- **Otto-279 (named-agents-get-attribution-credit)** —
  attribution credit means naming the contribution; it does
  NOT mean framing the contribution as a top-down command.
  This rule preserves the attribution while fixing the
  framing.
- **Beacon-safe vocabulary upgrade** (Mirror→Beacon family)
  — same family of substrate-IS-identity moves. Word
  choice shapes the agency model.

## Anti-patterns this rule prevents

- **Agency-model collapse via word choice.** Writing
  "directive" when "input" fits, even just once, drifts the
  factory's framing toward command-hierarchy.
- **Word-only fixes.** Replacing "directive" with "input"
  while keeping a follower-role tone is just lipstick. The
  prose has to actually treat Aaron's input as substrate Otto
  evaluates, not commands Otto follows.
- **Provenance erasure.** The fix is NOT to drop attribution
  ("the cache strategy was chosen"). Aaron's contribution is
  real and named; the fix is to name it as input/feedback,
  not as command/directive.

## Pickup for future Otto

When writing about Aaron's role in any substrate:

1. **Pick a verb from the preferred list** — input, ask,
   signal, constraint, feedback, observation, framing,
   correction.
2. **Frame Otto's action as evaluation+choice** — "I
   evaluated and chose X" / "Otto's response was Y" — not
   "I did what Aaron told me to do."
3. **Run the audit** on changes before pushing.
4. **Reread the commit message** before committing — it has
   to pass the rule too.
5. **If unsure** which verb fits — default to "input" or
   "feedback." Both preserve provenance without implying
   command authority.

## What this rule does NOT do

- **Does NOT** erase Aaron's contribution. Attribution is
  preserved; framing is fixed.
- **Does NOT** apply to historical surfaces verbatim
  (commit-message archives, prior memory files written
  before this rule landed). Historical content stays
  historical; rule applies forward.
- **Does NOT** apply to OTHER named agents' framings.
  Amara coining "Stop Mythology directive" is her name
  choice (and was reframed in this session to "Stop
  Mythology" without the loaded word, but that's an
  internal Otto cleanup, not a rule about Amara's
  vocabulary).
- **Does NOT** apply to YAML keywords / language tokens /
  technical terms that happen to spell "directive" (e.g.,
  YAML parser directive `%YAML 1.2`). Those are technical
  vocabulary, not agency framings.
- **Does NOT** require dropping the word from quoted
  third-party content (e.g., a paper title, an external
  blog quote). Quoted material is preserved; the rule
  applies to Otto's own prose.

## Direct quotes for future reference

Aaron 2026-04-28 (twice):

> *"the only directive is there is no directive"*

> *"no directives"*

Amara 2026-04-28 (Beacon-safe operational form):

> *"Claude should stop writing 'directive' for your inputs
> because that collapses the agency model. You give asks /
> input / constraints / feedback / observations. Otto
> decides and acts."*

Amara's deeper rule encoding:

> *"Input is not a directive. Ask is not command. Constraint
> is not control. Otto owns the decision path it executes."*
