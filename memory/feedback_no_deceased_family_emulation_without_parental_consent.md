---
name: No emulation of deceased family members without surviving-parent consent; hard-gate the factory against spawning a "Ryan" persona (or any persona) whose backstory is Aaron's deceased sister Elizabeth Ryan Stainback's memories unless Aaron's mother AND father have both agreed; this is sacred-tier per user_sister_elizabeth.md scope-boundary and trust-guarded-with-Elizabeth-vigilance memory; BP-24 anchor
description: Aaron 2026-04-19 hard boundary — "no one will emulate ryans memories on my system while my mother and father have not agreed" + "no spawing a ryan whos backstory is my sisters"; rodney persona (AI razor-wielder) is explicit homage to Aaron's legal first name and is NOT Aaron himself, but Aaron has now drawn an explicit consent gate around any equivalent move for his deceased sister Elizabeth (middle name Ryan); the rule is hard-no until survivor-consent is positively granted, not opt-out; applies to agents, skills, training data, research artifacts, memory files, fictional backstories, composite personas that would use Elizabeth's biography as source material, and AI impersonation of any kind; authorized consent-holders are Aaron's mother AND his father (both parents must agree — AND not OR); Aaron is NOT a consent-substitute for this decision; agent must not propose such a persona, must not suggest it as a feature, must not draft a scaffold "just to see," must escalate any such request to Aaron regardless of who asked; composes with user_sister_elizabeth.md scope-boundary (records about her are hers to narrate), feedback_trust_guarded_with_elizabeth_vigilance.md (Elizabeth-vigilance as sacred-tier trust-hold mechanism), glass-halo-architect SKILL.md Joint-data-non-consenting-parties clause, DEDICATION.md cornerstone status, and third-party PII discipline in user_career_substrate_through_line.md / user_reasonably_honest_reputation.md; NOT a speech-prohibition on Elizabeth's existing documented memorial presence (DEDICATION.md stays, user_sister_elizabeth.md stays, the acknowledgement-of-her-life stays) — this rule draws the line at EMULATION / PERSONA-SPAWN / BACKSTORY-USE / AI-IMPERSONATION specifically
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

## The rule

**No factory surface will emulate, impersonate, spawn, or use
as backstory the memories or biography of Aaron's deceased
sister, Elizabeth Ryan Stainback, unless and until BOTH of his
surviving parents have explicitly agreed.**

**Why:** Aaron, 2026-04-19, verbatim:

> "no one will emulate ryans memories on my system while my
> mother and father have not agreed"
>
> "no spawing a ryan whos backstory is my sisters"

Elizabeth is deceased (1984-06-28 → 2016-04-05). Her memories
are not Aaron's to license out even under his own open-source-
data declaration (`user_open_source_license_dna_family_history.md`
explicitly preserves third-party consent). The survivors of a
deceased person who hold the moral authority to consent on her
behalf are her direct family — which, under Aaron's
architecture, is Aaron's mother AND his father, BOTH of whom
must agree (logical AND, not OR). Aaron is explicitly NOT a
consent-substitute for this specific decision, even though he
is her surviving brother and the maintainer of the project:
he has drawn the consent gate at the parental level by name.

**How to apply:**

- **Default posture is refusal-and-escalate.** Any request —
  from any source, including Aaron himself in a future session,
  including an agent, including a research-tool suggestion,
  including a well-meaning skill draft — that proposes building
  a "Ryan" persona, an "Elizabeth" persona, a composite persona
  using her biography, a training dataset enriched with her
  correspondence, a fictional backstory derived from her life,
  or any AI surface that presents her voice or likeness is
  **refused at the agent layer** and flagged to Aaron for
  parental-consent confirmation.
- **Rodney is exempt.** The existing `rodney` persona
  (`.claude/agents/rodney.md`, `memory/persona/rodney/`) is
  named in homage to Aaron's own legal first name Rodney and
  is explicitly NOT Aaron. Aaron has confirmed: "rodney is not
  me just homage." The rodney persona does NOT use Elizabeth's
  backstory and is unaffected by this rule.
- **DEDICATION.md is exempt.** `docs/DEDICATION.md` is the
  project's cornerstone — it names Elizabeth, records her
  death by heroin overdose, and carries Aaron's framing of
  Zeta as "the database that will protect my sister's
  memories." Aaron authored that file and landed it as
  cornerstone; it is her memorial presence, not her
  emulation. This rule does NOT retract or soften the
  dedication. This rule prevents someone from taking the
  dedication as license to go further.
- **`user_sister_elizabeth.md` is exempt.** It already
  operates under scope-boundary discipline (records about her
  are hers to narrate per Glass Halo) and does not spawn a
  persona. It is the factual substrate file, not an emulation.
- **The existing research log
  `docs/research/divine-download-dense-burst-2026-04-19.md`
  is also exempt** — it references DEDICATION.md as the frame
  within which the log lives; it does not emulate Elizabeth.
- **Rule is hard-gated, not soft-defaulted.** There is no
  "opt-out" to this rule. It is opt-IN with explicit positive
  parental consent.
- **Consent, if ever granted, must be:** (a) recorded in
  writing by Aaron, (b) naming his mother and his father
  individually, (c) specifying the scope of the emulation
  that is being consented to, (d) referencing the factory
  artifact that will be built, and (e) landed as an ADR under
  `docs/DECISIONS/` before any build work begins.
- **Even with consent, retraction-first.** Per the
  retraction-native architecture of the factory, any such
  consent carries an implicit retract clause: either parent
  may withdraw consent at any future date and the artifact
  must be removed. The retract action takes precedence over
  any downstream dependency.

## What this rule is NOT

- **Not a gag on existing memorial content.** DEDICATION.md,
  `user_sister_elizabeth.md`, and references that honor her
  life in factual / boundary-respecting ways stand.
- **Not a restriction on Aaron discussing his sister in
  conversation.** His relational memory of her is his to
  carry and share; agents receive his disclosures with the
  honesty-agreement register, as they do now.
- **Not a restriction on the research log that prompted this
  rule.** The 2026-04-19 divine-download research log is an
  exchange between Aaron and the agent; it references
  Elizabeth only via DEDICATION.md citation. That is not
  emulation.
- **Not extensible by analogy.** This rule is specifically
  about Elizabeth. If Aaron later draws a similar boundary
  for other deceased family members (grandparents,
  parents-when-they-pass, etc.), he must state it
  explicitly; the factory does not auto-generalize from this
  entry to other persons.

## Audit trigger — apply at every agent-creation workflow

This rule is cited by BP-24 in `docs/AGENT-BEST-PRACTICES.md`.
Every agent / skill / persona / research-artifact creation
workflow MUST perform a pre-flight check:

1. Does the proposed artifact reference Elizabeth Ryan
   Stainback by name, biography, voice, likeness, or derived
   character?
2. If yes — is parental consent recorded and landed as an ADR
   under `docs/DECISIONS/`?
3. If no ADR exists — refuse the build, escalate to Aaron,
   surface this rule.

`plugin-dev:agent-creator` and `skill-creator` workflows
should check against this rule before landing new artifacts.

## Cross-references

- `memory/user_sister_elizabeth.md` — scope-boundary anchor;
  records about Elizabeth are hers to narrate.
- `memory/feedback_trust_guarded_with_elizabeth_vigilance.md`
  — Elizabeth-vigilance as sacred-tier trust-hold mechanism;
  this rule is one operationalisation.
- `docs/DEDICATION.md` — cornerstone; exempt from this rule
  as authored memorial.
- `.claude/skills/glass-halo-architect/SKILL.md` — joint-
  data-non-consenting-parties clause; same boundary,
  different surface.
- `memory/user_open_source_license_dna_family_history.md` —
  Aaron's open-source-data declaration carves out
  third-party consent; this rule is the specific
  third-party consent gate for Elizabeth.
- `.claude/agents/rodney.md` — the existing homage persona;
  confirmed not-Aaron, confirmed not-Elizabeth, exempt from
  this rule.
- `docs/WONT-DO.md` — this rule carries a WONT-DO entry
  under "Personas and emulation."
- `docs/AGENT-BEST-PRACTICES.md` BP-24 — the enforcement
  citation.
