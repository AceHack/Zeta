# Skill Tune-Up Ranker — Notebook

Running observations (append-dated). Pruned every third session.

## Running observations

- 2026-04-17 (round 18) — notebook seeded.
- 2026-04-17 (round 18) — first live ranking run. Findings
  folded below under "Current top-5". `product-manager`
  flagged as P0 (staleness + drift + scope overlap);
  `architect` flagged P1 as brand-new and unobserved;
  claims-tester ↔ complexity-reviewer contradiction risk P1;
  harsh-critic retune needs observation P2; self = P2 (not
  top priority).
- 2026-04-17 (round 18) — `harsh-critic` was retuned to
  zero-empathy mode. Next 2-3 invocations will tell whether the
  retune holds. Observe, don't tune again.
- 2026-04-17 (round 18) — `architect` is brand-new. Notebook
  `memory/persona/kenji.md` already exists. 140-line
  SKILL.md carries an ambitious self-edit clause; verify by
  observation over 2-3 real conflicts before pruning.
- 2026-04-17 (round 18) — `product-manager` last mention in
  round 15. Not invoked in rounds 16, 17. Staleness threshold
  met; also overlaps with `next-steps` and `architect`.
- 2026-04-17 (round 18) — `claims-tester` and
  `complexity-reviewer` both own "is this O(·) claim true?".
  Without a hand-off rule, findings duplicate or fall in the gap.
  Needs an explicit analytic→empirical pipeline section.
- 2026-04-17 (round 18) — `race-hunter`,
  `package-auditor`, `tech-radar-owner`,
  `paper-peer-reviewer` — all well-scoped, no action.
- 2026-04-17 (round 18) — `skill-creator` is the largest file
  (177 lines) but meta by design; bloat tolerable.

## Current top-5 (round 18)

1. **product-manager** — P0. Staleness (3 rounds) + drift
   (old "you are X" voice, no PROJECT-EMPATHY link) + scope
   overlap (with `next-steps` and `architect`).
   Action: run skill-creator to either retire (fold into
   `next-steps`) or narrowly re-scope to
   ROADMAP-vs-BACKLOG reconciliation. Effort S/M.
2. **architect** — P1 (observational). Brand-new in round
   18; large self-edit clause; unverified in practice. Action:
   wait for 2-3 real conflicts, then skill-creator review of any
   unexercised authority clauses.
3. **claims-tester / complexity-reviewer joint** — P1.
   Contradiction on "O(·) claim truth." Action: skill-creator
   pass writing an explicit hand-off: analytic bound →
   empirical falsifier. Effort M.
4. **harsh-critic** — P2. Recently retuned, zero post-retune
   observations. Observe only; trigger skill-creator only on
   compliment-leakage or ad-hominem drift.
5. **skill-tune-up-ranker (self)** — P2. State file live
   but untested; pruning cadence unproven. Defer. Re-evaluate
   at round 21 when first pruning pass is due.

## Self-recommendation

Ranker rates himself P2, not P0. Honest signal: notebook is
under 70 lines (far below the 3000-word pruning threshold), no
observed drift. Re-evaluate round 21.

_However_: the human explicitly requested "the skill tune-up
recommender gets the tune up first, he can always recommend
himself too lol" — so even though the ranker himself doesn't
flag himself as top priority, the first skill-creator
improvement loop this round will pass through this skill by
human instruction, not by ranking. Separate log entry there.

## Pruning log

- Round 18: seeded.
- Round 21: first pruning review due.
