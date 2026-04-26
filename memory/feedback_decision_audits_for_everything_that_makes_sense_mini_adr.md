---
name: Decision audits for everything that makes sense — mini-ADR pattern, symmetric humans-benefit too
description: Aaron 2026-04-22 — generalize intentionality-enforcement from script-label-only to a factory-wide "mini-ADR" pattern; every non-trivial decision gets an auditable what/why/alternatives/supersedes/expires-when record; humans benefit from the same practice.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Aaron 2026-04-22 three-message burst while the factory was
authoring the cross-platform parity audit:

1. *"this is great i will be able to audit all your decisions
   now and give you feedback, decisions audits are great for
   humeans too, you can always ask me why ima asking you do
   someting i can always answer why and justify myself."*
2. *"we want decison audits for everything that makes sense,
   this is kind of like mini ADR lol"*
3. *"decison records i mean"*

**Why:** The factory had been applying intentionality-
enforcement surgically — script exception labels
(POST-SETUP-SCRIPT-STACK.md Q3), FACTORY-HYGIENE row #47 (every
hygiene row classifies prevention-bearing / detection-only-
justified / detection-only-gap at landing), BACKLOG row
rationales. Aaron saw the pattern and named it: these are all
instances of **decision records** that make any participant's
thinking auditable. He wants the pattern generalized — "for
everything that makes sense" — and named it "mini ADR" to
distinguish from the full ADR format under `docs/DECISIONS/`.

The symmetry matters. Aaron said the same audit discipline
applies to him: *"you can always ask me why ima asking you do
someting i can always answer why and justify myself."* This is
not the factory submitting to audit; it's a mutual practice. If
the factory asks *why* on any directive Aaron issues, Aaron
answers. The factory owes the same.

**Canonical mini-ADR shape (worked instance: header block of
`tools/hygiene/audit-cross-platform-parity.sh` — the first
instance of the pattern, landed in the same commit as this
memory):**

```
# ----- Decision record (mini-ADR) ---------------------------------
# Date:        YYYY-MM-DD
# Context:     the prompting signal (quote Aaron directly when
#              applicable; else name the audit finding / PR
#              comment / incident / etc. that triggered the
#              decision).
# Decision:    the choice made, in one or two sentences.
# Alternatives considered:
#              (a) option-not-taken — reason rejected.
#              (b) option-not-taken — reason rejected.
#              (c) option-taken    — this choice.
# Auditable by: who/what reviews it (Aaron, reviewer, CI lint,
#              round-close sweep, etc.).
# Supersedes:  prior decision this revises (path + date), or N/A.
# Expires when: the exit condition — deferred enforcement flips
#              on, baseline becomes green, the rule migrates to
#              full-ADR, etc. Blank if no expiry.
```

**How to apply:**

- **Scope: "everything that makes sense"** — not everything.
  Use judgment. Good signals for mini-ADR:
  - A decision between multiple reasonable options where the
    reason would not be obvious to a future reviewer.
  - A deferred-enforcement or detect-only-for-now choice.
  - A flip or reversal of a prior decision (always pair with
    `Supersedes:` line).
  - Any rule with a time-limited validity (`Expires when:`).
  - Any decision Aaron might plausibly ask "why?" about later.
- **Home for the record:** inline-on-the-artifact when
  possible (script header block, markdown section, frontmatter
  field). `docs/DECISIONS/` stays reserved for full ADRs —
  system-wide, long-horizon, architectural. Mini-ADRs live
  with the thing they decide about so the audit is one read
  away.
- **Generalize where it already exists:** existing patterns are
  already mini-ADRs in disguise — POST-SETUP-SCRIPT-STACK.md
  Q3 exception-label headers, prevention-layer-classification
  rows, intentional-debt ledger rows. Don't duplicate; retrofit
  the shape to match (date + alternatives + supersedes +
  expires-when fields as they become applicable).
- **The format itself deserves a proper ADR.** The shape above
  is a first-draft shipped with the parity-audit instance; it
  needs iteration. Queue a mini-ADR-format ADR under
  `docs/DECISIONS/YYYY-MM-DD-mini-adr-format.md` after 5-10
  more mini-ADRs are authored and the shape is known to work.
  Don't over-formalize before we've used it — see
  `feedback_data_driven_cadence_not_prescribed.md`.
- **Symmetric audit:** when Aaron issues a directive and the
  factory is about to absorb it into a rule / memory / skill
  edit, the factory can ask "what's the *why* I should record
  as Context?" Aaron has explicitly committed to answering.
  This is not friction — it's the same practice that makes
  factory decisions auditable applied to human decisions.

**Pattern: intentionality-enforcement generalized.** The
script-label rule, the prevention-layer classification, the
intentional-debt ledger, and now the mini-ADR are all the same
idea: the artifact has to carry a recorded decision, not a
silent default. The mini-ADR is the naming act that makes the
pattern legible to the factory.

**Related memories:**
- `memory/feedback_enforcing_intentional_decisions_not_correctness.md`
  — parent rule (intentionality vs correctness).
- `memory/feedback_intentionality_doesnt_demand_migration_bash_forever_valid.md`
  — instance: the decision-forcing rule accepts any answer with
  a reason.
- `memory/feedback_stay_bash_forever_implies_powershell_twin_obligation.md`
  — instance: a mini-ADR prevents partial-accounting by forcing
  the Alternatives line to be written down.
- `memory/feedback_factory_reflects_aaron_decision_process_alignment_signal.md`
  — the aligned-vs-course-correct metric reflects the same
  idea: decision trails make alignment measurable.
