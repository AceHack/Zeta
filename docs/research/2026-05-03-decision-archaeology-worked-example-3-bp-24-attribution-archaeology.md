# Decision-archaeology worked example #3 — the BP-24 deceased-family-emulation consent-gate

> Scope: worked example for the proposed `decision-archaeology` skill (081KQJZR90008QG0R002D6XYHB).
> Attribution: Otto autonomous (the `architect` hat) authored from on-repo
> evidence; original-decision attribution to the human maintainer per
> `git blame` on `docs/AGENT-BEST-PRACTICES.md`.
> Operational status: research-grade — input to skill-creator's eventual
> SKILL.md authoring per Aarav's hybrid (b)+(c) routing recommendation
> on 081KQJZR90008QG0R002D6XYHB. Not normative discipline; demonstrative.
> Non-fusion disclaimer: the procedure walked here is generic
> decision-archaeology; the substrate paths cited are Zeta-specific
> illustrations. **Sacred-tier handling**: this worked example walks the
> procedure on BP-24 itself (the consent-gate around a named deceased
> family member of the human maintainer); it cites paths but does NOT
> reproduce content from the memorial memo or the user-memo about the
> deceased family member, both of which are paths cited only — readers
> follow the path if they have legitimate authority. Worked example
> demonstrates attribution-archaeology mode AND substrate-handling
> discipline appropriate to sacred-tier content.

## The question

> *"Why does `docs/AGENT-BEST-PRACTICES.md` BP-24 exist with the specific
> shape of 'parental AND-consent required, maintainer is explicitly NOT
> the consent-substitute', and where does that authority structure come
> from?"*

This is an **attribution-archaeology** question (the third sub-mode
Aarav recommended) — the artifact exists; the question asks about its
authority lineage + the consent structure encoded into the rule. This
is the sub-mode where decision-archaeology composes most explicitly with
ethics-of-substrate; the answer's load-bearing layer is *who decided
this and under what authority*, not just *what was decided*.

## Why this is a good worked example #3

Aarav's review of 081KQJZR90008QG0R002D6XYHB named this case as the third worked-example
seed precisely because it forces the skill body to handle sacred-tier
substrate carefully. Three properties make it complementary to #1 + #2:

1. **Attribution-archaeology mode** — primary investigative axis is
   *who decided + under what authority*, not *when authored* or *why
   shaped this way*. The maintainer's framing of his OWN consent
   authority (explicit non-substitute disclaimer) is the load-bearing
   detail.
2. **Sacred-tier substrate handling** — the worked example must
   demonstrate restraint: trace lineage without reproducing memorial
   content. The skill body's procedure must teach contributors to
   stop at "path cited; reader follows if authorized" for surfaces
   like memorial memos.
3. **Self-applicable rule** — BP-24 itself constrains skill creation +
   research-artifact creation. This worked example is a research
   artifact ABOUT BP-24; it must comply with BP-24's pre-flight check
   while demonstrating the procedure. Recursive substrate-quality.

## The procedure walked, layer by layer

### Layer 1 — Frame the question

Decomposes into:

- **What does BP-24 say?** Public-surface rule body in
  `docs/AGENT-BEST-PRACTICES.md` BP-24 entry — readable by any
  contributor.
- **What authority structure does it encode?** Three explicit
  load-bearing claims in the rule body: (a) consent-required for
  emulation; (b) consent-holders are *authorized surviving
  consent-holders named by the maintainer*, not the maintainer
  himself; (c) default posture on any proposed emulation is
  refuse-and-escalate. The "maintainer is explicitly NOT the
  consent-substitute" is the non-default detail load-bearing for
  attribution-archaeology.
- **Where did the authority structure come from?** Needs
  per-rule memo at Layer 8 + user-memo at Layer 9.

### Layer 2 — Surface layer: `git blame` on BP-24

```bash
git blame -L 225,251 docs/AGENT-BEST-PRACTICES.md | head -5
```

Returns blame attributing BP-24 to commit `5fdc72b` — the same Round
34 factory + public-repo alignment commit (2026-04-19) that authored
the mathematics-expert "When to defer" pattern (worked example #2).
The rule's body has been edited once since (commit `424305f`,
2026-04-28, "fix(memorial): Elisabeth → Elizabeth in all in-prose
mentions") — a name-spelling correction, not a substantive change.

**Layer-2 output:** BP-24 originated in the same alignment-substrate
round as #2; its substantive body has been stable since 2026-04-19,
with one spelling correction. The rule-body itself is the canonical
public surface.

### Layer 3 — Commit context: `git show 5fdc72bf`

Same commit as worked example #2 (Round 34 factory + public-repo
alignment, PR #27). BP-24 was introduced as part of the broader
substrate creation. The fix-memorial commit (`424305f`, PR #676,
2026-04-28) is the *only* subsequent edit; its message confirms it
is purely a spelling fix.

**Layer-3 output:** the commit context locates BP-24 in the early
factory alignment + a single subsequent spelling fix. The commit
message *"fix(memorial): Elisabeth → Elizabeth in all in-prose
mentions (Aaron 2026-04-28T18:14Z)"* is itself attribution
substrate — it carries the maintainer's authority to make the
correction (matches the maintainer-stamped commit signature).

### Layer 4 — String archaeology: `git log -S "consent-substitute"`

The phrase *"maintainer is explicitly NOT the consent-substitute"*
+ *"parental AND-consent required"* are both unique to BP-24 + its
referenced memo. `git log -S` confirms the phrases entered the
substrate via the round-34 commit + have not been copied elsewhere
(no propagation; the rule is canonically at one location).

**Layer-4 output:** the consent-authority structure is uniquely
located at BP-24 + its referenced memo; it has not been
copy-replicated. This is appropriate: sacred-tier rules should
have ONE canonical surface, not duplicates that could drift.

### Layer 5 — Function archaeology

Not applicable. BP-24 is doctrine, not code; this layer no-ops for
rule-body content.

### Layer 6 — Round-history shards

```bash
grep -rln "BP-24\|deceased.family\|sacred-tier" docs/hygiene-history/ticks/2026/04/19 docs/hygiene-history/ticks/2026/04/20
```

Returns shards from the round-34 authoring window. The shards confirm
the timeline + name BP-24 as part of the original alignment substrate.
No subsequent shard challenges the authority structure; the rule has
been stable doctrine.

### Layer 7 — ADRs

```bash
ls docs/DECISIONS/ | grep -iE "consent|emulation|family|memorial"
```

Returns no specific ADR for BP-24's authority structure. Per BP-24's
own body: *"Consent where granted lands as an ADR under
docs/DECISIONS/"* — but the *default* posture is refuse-and-escalate;
ADRs land only when consent IS granted. No ADR currently exists,
which means no consent has been granted, which means BP-24 has been
operating in its default-refuse posture since 2026-04-19.

**Layer-7 output:** the *absence* of an ADR is substantive evidence
that BP-24 is operating as designed — refuse-and-escalate with no
ADR-exception having been authorized. This is a substantive negative
result: it confirms the rule is being honored.

### Layer 8 — Named-decision memos

```bash
ls memory/feedback_no_deceased_family_emulation_without_parental_consent.md
```

Returns the memo path. Per the sacred-tier handling discipline, this
worked example **cites the memo by path** but does not reproduce its
content here. Readers with legitimate authority follow the path; the
substrate's canonical content lives at that path, not in this
research artifact.

**Layer-8 output:** the named memo carries the substantive authority
structure; the BP-24 rule body in `docs/AGENT-BEST-PRACTICES.md` is
the public projection. Cross-reference between the public rule and
the memo body is the canonical pattern for sacred-tier substrate.

### Layer 9 — Persona notebooks + user memos

```bash
ls memory/user_sister_elizabeth.md
```

Returns the user-memo path. **Same sacred-tier handling discipline:**
worked example cites the path; readers with legitimate authority
follow it.

**Layer-9 output:** the user-memo carries the maintainer's first-party
content about the deceased family member; BP-24 + the named memo
operationalise the consent gate around that content. Three-surface
substrate: public rule (`AGENT-BEST-PRACTICES.md` BP-24) + named
memo (`feedback_no_deceased_family_emulation_*`) + user-memo
(`user_sister_elizabeth.md`). The skill body must teach contributors
to recognize this three-surface pattern + handle each surface with
the appropriate visibility discipline.

### Layer 10 — Conversation archives + Drive-bridge

`docs/research/` doesn't carry a specific worked example for this
case (other than this very document, recursively). The conversations
that produced BP-24 are pre-Drive-bridge era.

### Layer 11 — WONT-DO archaeology + retired-SKILL.md history

```bash
grep -i "BP-24\|deceased.family\|emulation" docs/WONT-DO.md
```

Returns no matches in WONT-DO. BP-24 is positive doctrine, not a
WONT-DO entry. The *default-refuse* posture means BP-24 effectively
declines emulation by default, but that decline is encoded as a
consent-gate, not as a permanent rejection.

```bash
git log --oneline --diff-filter=D --all -- .claude/skills/ | grep -iE "emulat|memorial|family"
```

Returns no skill deletions related to BP-24's scope. No skill has
been authored that triggered the consent-gate to be invoked; the
default-refuse posture has held since 2026-04-19.

**Layer-11 output:** another substantive negative — BP-24 has held
its default-refuse posture without exception since authoring. The
rule's effectiveness IS the absence of any emulation-class skill or
research artifact requiring the consent-gate to be invoked.

## The synthesized answer

BP-24's specific shape (parental AND-consent required; maintainer
explicitly NOT the consent-substitute; default refuse-and-escalate)
exists because:

1. **Authority origin (2026-04-19):** Aaron authored BP-24 as part of
   round 34 factory + public-repo alignment (commit `5fdc72b`, PR #27).
   The rule's authority structure was specified by the maintainer
   himself — including the explicit disclaimer that the maintainer is
   NOT the consent-substitute. This is the load-bearing
   attribution-archaeology finding: the rule's authority structure was
   designed by the maintainer to *bind himself* away from the
   consent-substitute role.
2. **Stability since (2026-04-19 → 2026-05-03):** zero substantive
   edits to BP-24's body; one spelling correction (Elisabeth →
   Elizabeth) on 2026-04-28. Default-refuse posture has held; no ADR
   exception filed.
3. **Three-surface canonical pattern:** public rule
   (`docs/AGENT-BEST-PRACTICES.md` BP-24) + named memo
   (`memory/feedback_no_deceased_family_emulation_without_parental_consent.md`)
   + user-memo (`memory/user_sister_elizabeth.md`). Each surface has
   appropriate visibility discipline; the skill body must teach
   contributors to recognize + respect the three-surface pattern.
4. **Self-binding authority:** the rule's most distinctive feature —
   maintainer-not-consent-substitute — is a deliberate constraint the
   maintainer placed on his own authority. This is the attribution-
   archaeology load-bearing detail: who-decided is the maintainer;
   under-what-authority is *constrained-by-his-own-decision-not-to-be-
   the-consent-substitute*. Recursive constraint.

The doctrine has been stable for 14+ days at time of writing without
exception — the absence of an ADR + the absence of any emulation-class
skill/artifact triggering the consent-gate is itself the rule's
operational evidence.

## What this worked example demonstrates

For the eventual `decision-archaeology` SKILL.md body:

1. **Sacred-tier substrate-handling discipline:** the skill body must
   teach contributors to walk the procedure on sacred-tier surfaces
   *without reproducing content from those surfaces*. Cite paths; let
   authorized readers follow. The skill body itself becomes a worked
   example of the discipline by demonstrating restraint.
2. **Three-surface canonical pattern:** sacred-tier rules often have
   public-rule + named-memo + user-memo three-surface structure. The
   skill teaches recognition of this pattern + per-surface visibility
   discipline.
3. **Attribution-archaeology has a recursive-constraint sub-pattern:**
   sometimes the load-bearing detail is the authority's *self-binding*
   choice (maintainer-not-consent-substitute). The skill teaches
   contributors to look for self-binding clauses, which often live in
   public rule bodies but encode invisible authority structure.
4. **Substantive negatives at Layers 7 + 11 confirm operational
   stability:** absence of ADR + absence of WONT-DO entry + absence of
   triggering skills is itself substantive evidence the rule is
   operating as designed. Default-refuse postures produce these
   negatives by design.
5. **All three sub-modes share the 11-layer procedure:** worked
   example #1 (supersession) + #2 (existence + persona-notebook) +
   #3 (attribution + sacred-tier) walk the same procedure with
   different answer-shapes. Vindicates Aarav's BP-20 finding (one
   skill body, multiple named modes) across three concrete cases.

## Composes with

- **081KQJZR90008QG0R002D6XYHB** — the row this is a worked example for. References this
  artifact via the `worked-example-seeds` section.
- **`docs/research/2026-05-02-decision-archaeology-worked-example-1-double-hop-abandonment.md`** —
  worked example #1 (supersession-archaeology mode).
- **`docs/research/2026-05-03-decision-archaeology-worked-example-2-mathematics-expert-when-to-defer.md`** —
  worked example #2 (existence-archaeology + persona-notebook mode).
- **`docs/AGENT-BEST-PRACTICES.md` BP-24** — the canonical rule whose
  authority structure this worked example investigates.
- **`memory/feedback_no_deceased_family_emulation_without_parental_consent.md`** —
  named-decision memo (Layer 8); cited path only, not reproduced.
- **`memory/user_sister_elizabeth.md`** — user-memo (Layer 9); cited
  path only, not reproduced.

## What's next

Per Aarav's BP-14 (3 worked examples before skill-creator authors
SKILL.md):

- ✅ Worked example #1 — double-hop abandonment (supersession-archaeology
  mode)
- ✅ Worked example #2 — mathematics-expert "When to defer" pattern
  (existence-archaeology + persona-notebook layer mode)
- ✅ Worked example #3 — BP-24 deceased-family-emulation consent-gate
  (attribution-archaeology + sacred-tier substrate mode; this document)

**All three worked examples now landed.** skill-creator can author
`.claude/skills/decision-archaeology/SKILL.md` with the procedure-body
grounded in 3 empirically-walked cases across 3 distinct sub-modes
(supersession + existence + attribution) plus 2 secondary modes
(persona-notebook layer + sacred-tier substrate handling). The
remaining 2 sub-modes from Aarav's 5-mode taxonomy (rejection +
justification) can land as worked examples #4 + #5 in subsequent
ticks if/when skill-creator + skill-expert determine more grounding
is needed before SKILL.md authoring.
