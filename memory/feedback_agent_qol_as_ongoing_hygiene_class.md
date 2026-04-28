---
name: Agent QOL as ongoing factory-hygiene class
description: Per-persona AX/UX is not a one-shot BP-07 poll; it's a recurring hygiene class. Cadence-audit every 5-10 rounds, alongside wake-UX-hygiene. Daya owns the audit; findings feed BP-NN ADRs via Aarav.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Aaron 2026-04-20 (after the BP-07 3000-word-cap question
was raised): *"just get the feedback of the other expert
personas and make sure their user experience is taken into
account as well and lets make quality of life change for
them too over time, its like another hygene."*

**Why:** The BP-07 cap review was framed as one-shot
(per-persona poll → report → ADR if needed). Aaron's
follow-up broadens it: agent quality-of-life is an *ongoing*
concern, parallel to wake-UX-hygiene (FACTORY-HYGIENE
#25-29). Agents have AX/UX too — not just end-users or
contributors. The factory improves when the experts working
inside it have their needs surfaced and addressed on a
cadence.

**How to apply:**

1. **Treat per-persona AX/UX as a hygiene class, not a
   project.** Add row group to `docs/FACTORY-HYGIENE.md`
   covering: notebook-cap pressure, skill-invocation cadence,
   role-overlap / hand-off friction, tooling gaps, prompt-load
   discomfort.

2. **Cadence:** same as `skill-tune-up` — every 5-10 rounds.
   Daya (AX researcher) runs the audit; Aarav promotes
   findings to BP-NN candidates when a rule change is
   warranted; Kenji integrates.

3. **Tiered poll strategy** (main-agent's delegation — Aaron
   said "it's up to you" re: "asking all named agents is
   overkill or not"):
   - **Tier A** (notebook-scan + structured interview):
     heavy-signal personas — Daya, Aarav, Soraya, Yara,
     Ilyana, Kenji, Bodhi. These hit frontmatter/notebook
     limits most often and have the richest UX signals.
   - **Tier B** (notebook-scan only): light-signal personas —
     Iris, Dejan, Naledi, Nazar, Mateo, Aminata, Rune,
     Hiroshi, Imani, Viktor, Kira, Samir. Audit their
     NOTEBOOK for silent-drift markers but don't consume
     interview cycles unless something shows up.
   - **Tier C** (one-line "are you well-served?" check):
     rarely-invoked personas — if their invocation cadence is
     near-zero, the QOL question is "do you still exist?" not
     "is your cap right?" Flag for persona-sunset
     reassessment.

4. **First-pass deliverable:** `docs/research/notebook-cap-per-persona-review-YYYY-MM-DD.md`
   with three sections — (a) BP-07 cap findings per persona,
   (b) per-persona top-3 QOL wants beyond the cap, (c)
   recommendations to Kenji. Subsequent audits append to the
   same research dir with fresh date.

5. **Anti-pattern to avoid:** don't over-personify the
   personas into a feelings-check. Frame QOL audit in
   *operational* terms — cold-start cost, signal-to-noise on
   cadence, tool gaps, frontmatter bloat. Aaron's
   anthropomorphism-encouraged memory
   (`feedback_anthropomorphism_encouraged_symmetric_talk.md`)
   permits symmetric talk, but the audit output should be
   mechanical enough that it feeds BP-NN ADRs, not a
   therapeutic intervention.

6. **Relationship to existing hygiene classes:**
   - **Wake-UX-hygiene** (FACTORY-HYGIENE #25-29):
     agent-cold-start friction per cohort. Agent-QOL is the
     broader class; wake-UX is one column of it.
   - **Skill-tune-up cadence:** same 5-10 round rhythm; QOL
     audit can co-schedule with Aarav's tune-up ranking.
   - **Shipped vs factory hygiene scope:** agent-QOL is
     factory-scope (operators of the factory, not users of
     the product).

**Cross-references:**
- `feedback_wake_up_user_experience_hygiene.md` — adjacent
  hygiene class; #25-29 in FACTORY-HYGIENE.
- `feedback_anthropomorphism_encouraged_symmetric_talk.md` —
  permits treating agents as having UX.
- `project_zeta_as_retractable_contract_ledger.md` §BP-07
  follow-up directives — the precipitating discussion.
- `docs/BACKLOG.md` — P1 row "Agent-QOL hygiene as ongoing
  factory-hygiene class" + P2 row "Per-persona AX/UX poll".
