---
name: Default disposition for paused work is "re-evaluate later," not "close" (Aaron 2026-04-30)
description: On this project, very few things are WONT-DO. Most paused work gets re-evaluated when the round is ready. The agent's instinct to "close as stale" or "bulk-discard" is the wrong shape — the right shape is "park visibly for later."
type: feedback
---

When work doesn't land in the active round, the **default
disposition is re-evaluate later, not close**. WONT-DO is the
rare explicit decline (per `docs/WONT-DO.md`); pause-for-later
is the dominant mode for the rest.

> *"why would you want to bulk close, are these things we
> should do later? on this project there are very few wontdos
> most things are reevualtuate later"*
> — Aaron 2026-04-30

**Why:**

The agent's instinct in queue-hygiene work is to treat
"didn't land in this round" as "discard." That collapses
multiple categories that should stay separate:

1. **Work-already-done-via-different-path** — the substantive
   change is on main via a different SHA. PR can close
   because the work IS done. Verify by reading the on-main
   file or commit.
2. **Topology obsolescence** — the action's prerequisite has
   been ratified out of existence (e.g., LFG-only topology
   obsoleting AceHack→LFG sync direction). Close because the
   work is no longer applicable. Verify by citing the
   topology decision.
3. **Paused-for-later (DOMINANT)** — round didn't get to it.
   Substance is preserved (branches, PRs, memory). Future-
   Otto re-evaluates when the round is ready. **Default
   disposition.**
4. **WONT-DO (RARE, AARON-ONLY for now)** — explicitly
   declined. Lands in `docs/WONT-DO.md` with a reason.
   **Authority constraint** (Aaron 2026-04-30 follow-on
   correction): *"nothing gets permanently wont do without
   me for now until you see why i need you to know
   everything, that is the ultimate scope of this — an
   intellectual backup of earth."* The agent does not
   unilaterally land entries in `docs/WONT-DO.md`. Until
   the agent demonstrates full-scope understanding (the
   intellectual-backup-of-earth scope; see
   `feedback_zeta_ultimate_scope_intellectual_backup_of_earth_wont_do_authority_aaron_2026_04_30.md`),
   permanent declines require Aaron's explicit sign-off.
   Recommendations to add a row are fine; landing the row
   is not.

The agent's bulk-close instinct conflates 3 and 4. Aaron's
correction restores the asymmetry: 4 is rare, 3 is the
default. **Closing a category-3 PR misframes paused work as
declined work.** And even when category 4 is genuinely the
right answer, the agent does not land the WONT-DO row alone
— that requires Aaron-in-the-loop.

This composes with Otto-363 substrate-or-it-didn't-happen:
the branches are already in "remote-parked" tier (committed

+ pushed + reachable). The PR being open is the visibility

layer. Closing the PR removes visibility-as-paused without
adding value.

**How to apply:**

1. **Before proposing close, classify which category.** If
   the answer isn't "category 1 (on-main evidence)" or
   "category 2 (topology change)" or "category 4 (explicit
   WONT-DO)," the answer is "leave open."
2. **Bulk-close is almost never the right shape.** If you
   find yourself wanting to bulk-close N PRs as "stale,"
   that's the failure mode. The right shape is per-PR
   classification, with most landing in category 3
   (paused-for-later).
3. **Queue-clarity is not a closing reason.** "26 open PRs
   feels cluttered" is the agent's pressure, not the
   maintainer's. Open PRs are visible-as-paused; bulk
   closure makes the queue feel cleaner but loses the
   visibility.
4. **WONT-DO landings are deliberate, not opportunistic.**
   Adding to `docs/WONT-DO.md` is itself substrate work
   that requires explicit decision + reason. It's not a
   side-effect of queue-hygiene.
5. **When in doubt, leave open.** The cost of an open PR
   (queue noise) is small and reversible. The cost of
   closing-as-stale-when-actually-paused (work feels
   declined when it's not) is higher and harder to detect.

**Live trigger that produced this rule:**

2026-04-30 stale-PR triage round (task #356). Agent
encountered ~20 prior-round tick-history shard PRs in the
LFG queue. Closed 3 with on-main evidence (categories 1+2:
#752, #739 DIRTY collisions; #661 topology obsolescence).
Then proposed bulk-closing 17 minimal tick-history shards
as "stale." Aaron's correction landed:

> *"why would you want to bulk close ... most things are
> reevualtuate later"*

Reframe absorbed: the 17 stale shards are category-3
(paused-for-later), not category-4 (WONT-DO). Leaving
them open keeps the visibility-as-paused signal intact.
The substance (1-line tick observability records) is low
priority but not declined; future-Otto re-evaluates if
the missing minute-windows ever matter.

**Composes with:**

- `docs/WONT-DO.md` — the explicit decline list. This
  rule clarifies that the list stays *small* by default;
  things go there only when explicitly declined.
- `memory/feedback_otto_363_substrate_or_it_didnt_happen_no_invisible_directives_aaron_amara_2026_04_29.md`
  — open PRs are "remote-parked" tier; closing them
  doesn't lose substrate, but it does collapse the
  paused/declined distinction.
- `memory/feedback_future_self_not_bound_by_past_decisions.md`
  — future-self gets to re-evaluate. That re-evaluation
  works only if past-self left the work visible-as-paused.
- `memory/feedback_substrate_is_product_four_products_evolving_trajectory_aaron_2026_04_30.md`
  — paused work is part of the evolving trajectory; the
  set of products / dependencies / sister projects shifts
  over time, and paused work may become relevant again as
  the trajectory evolves.
