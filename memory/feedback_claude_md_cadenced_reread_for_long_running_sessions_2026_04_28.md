---
name: CLAUDE.md cadenced re-read for long-running sessions (substrate-application discipline)
description: Re-read CLAUDE.md every 10 ticks of the autonomous loop (N=10 per Aaron 2026-04-28), AND after every caught application-failure of an Otto-NN / wake-time rule, AND after every context compaction event. Wake-time disciplines decay with session age; vigilance has shorter half-life than the autonomous-loop tick rate; substrate (cadenced re-read) beats vigilance. The trigger is "I just violated a rule I knew was loaded at session start" — that's evidence the rule has aged out of working context, and the corrective is mechanical re-read, not promise-to-do-better. Aaron 2026-04-28 surfaced this pattern after I leaked "directive" language despite Otto-357 being CLAUDE.md-level: *"is it avoiadble in the future? application failure one should always ask that, maybe if you reread claude on a cadence since you are long running."* The cost of a re-read is ~1 tick; the cost of a recurring rule violation is compounding. Composes with Otto-275-FOREVER (knowing-rule != applying-rule) and Otto-341 (mechanism-over-vigilance).
type: feedback
---

# CLAUDE.md cadenced re-read for long-running sessions

**Rule:** in autonomous-loop mode (long-running sessions),
re-read the wake-time floor on a cadence — not just at session
start. The floor is **CLAUDE.md + the rule sources it points
at**, not CLAUDE.md alone. Triggers:

1. **Periodic** — every 10 ticks (cadence picked by Aaron
   2026-04-28; ~1 tick of overhead; refreshes wake-time floor).
2. **Corrective** — immediately after any caught violation of a
   wake-time rule (Otto-247 / Otto-357 / verify-before-deferring
   / future-self-not-bound / never-be-idle / honor-those-that-
   came-before / no-directives). The violation IS evidence the
   rule has aged out of working context.
3. **Post-compaction** — after the harness summarises older
   messages (context compaction can drop the original CLAUDE.md
   read out of working memory, even though it was loaded at
   bootstrap).

After re-read: explicitly check the in-flight work against each
wake-time discipline. If anything in flight violates a rule, fix
it before continuing.

**Scope of the re-read (Aaron 2026-04-28 surfaced this when
CLAUDE.md-alone re-read failed to prevent an Otto-279 violation
on `docs/research/**`):**

CLAUDE.md is a *pointer tree*, not the rule corpus. Re-reading
CLAUDE.md alone refreshes the bootstrap-pointer set, not the
actual rules. The rules live in:

- `docs/AGENT-BEST-PRACTICES.md` — BP-NN stable rule list
  (including the role-refs / first-name-attribution rule with
  the Otto-279 history-surface carve-out at lines 284-348). This
  is where the "is this surface a history surface?" question is
  answered, not in CLAUDE.md.
- `docs/CONFLICT-RESOLUTION.md` — reviewer roster + conference
  protocol; load-bearing for any specialist-review task.
- `AGENTS.md` — the universal cross-harness handbook (the rule
  corpus's wider home).
- `docs/AUTONOMOUS-LOOP.md` — the tick six-step checklist.
- Memory files referenced by CLAUDE.md as load-bearing
  (Otto-279 history-surface carve-out file, Otto-357
  no-directives, verify-before-deferring,
  future-self-not-bound-by-past, never-be-idle, version-
  currency).

So the cadenced re-read covers all of these (~5-6 files), not
just CLAUDE.md. Cost: ~2-3 ticks per refresh instead of ~1.
Still cheap relative to the cost of mis-applied carve-outs.

**Why CLAUDE.md-alone is insufficient (concrete surfacing):**
2026-04-28 I re-read CLAUDE.md after an Otto-357 violation
(directive-language leak), then later edited research files
and *over-scrubbed first names*, violating the Otto-279
history-surface carve-out. CLAUDE.md doesn't itself state
"`docs/research/**` is a history surface where attribution is
preserved" — that's in `docs/AGENT-BEST-PRACTICES.md` (and the
EAT packet's own archive header line 4: *"first-name attribution
permitted on `docs/research/**` per Otto-279"*). Re-reading
CLAUDE.md alone left me with a half-remembered version of the
role-refs rule (de-name everywhere) instead of the calibrated
version (de-name on current-state surfaces; preserve on history
surfaces). The fix is to re-read the rule source, not just the
pointer.

**Why:** this came directly from Aaron 2026-04-28:

> *"that's an application failure, not a knowledge gap. is it
> avoiadble in the future? application failure one should always
> ask that, maybe if you reread claude on a cadence since you are
> long running."*

The trigger was a fresh Otto-357 violation: I had written
*"Acknowledged Aaron's directive: 2nd-CLI verify before any 0/0/0
convergence move"* — leaking the "directive" framing that
Otto-357 explicitly forbids ("Aaron's only directive is that
there ARE no directives"). The rule was in CLAUDE.md, loaded at
session start, and I still violated it.

This is the structural shape: **wake-time disciplines decay with
session age**. The harness's session-bootstrap load is a one-shot
event; after compaction, after long stretches of unrelated work,
after dozens of context-pressuring tool calls, the original
CLAUDE.md content is no longer materially in working context even
if technically still in the message log. Vigilance ("I'll
remember") has half-life shorter than the autonomous-loop tick
rate; cadenced re-read is the mechanical refresh that beats
vigilance.

This discipline composes with **Otto-275-FOREVER** (knowing-rule
!= applying-rule — the failure mode where YET silently mutates
to FOREVER under lean-tick stretches) and **Otto-341**
(mechanism-over-vigilance — substrate-as-mechanism beats
agent-vigilance because vigilance decays).

The "always ask" meta-routine Aaron named is itself the
discipline: when an application failure surfaces, the next move
isn't "noted, continuing" — it's *"is the failure mode
structural? what mechanism prevents recurrence?"* Then build the
mechanism.

**How to apply:**

1. **At session start**: read CLAUDE.md (already happens via
   harness bootstrap).
2. **Every 10 ticks** in autonomous-loop mode (Aaron's pick): do
   a self-paced re-read. The /loop skill's natural tick boundary
   is the cadence anchor. Specifically: at the close of every
   10th tick, before the speculative-work pick, re-read CLAUDE.md
   in full. ~1 tick of overhead.
3. **On caught violation**: corrective re-read NOW, before
   continuing. The violation evidence is the trigger; deferring
   the re-read defeats the discipline.
4. **Post-compaction**: when the harness has summarised older
   messages (visible in conversation context), re-read CLAUDE.md
   to restore the wake-time floor.
5. **After re-read**: check the in-flight work against each
   wake-time discipline. Anything violating: fix before
   continuing.

**Diagnostic tell:** if you write something that contradicts a
known wake-time rule (e.g. "directive", "phantom deferral",
"untouched stale claim"), and your reflexive thought is *"oh
right, the rule says X"*, that's evidence the rule has decayed.
Re-read before continuing is the corrective.

**What this discipline does NOT do:**

- Does NOT replace the harness's bootstrap-time load (that's
  still load-bearing).
- Does NOT excuse violations during the gap between re-reads
  ("but I hadn't re-read yet" is not a defence — the rule was in
  the corpus the whole time).
- Does NOT substitute for filing new rules. If a violation
  surfaces a NEW rule worth landing, file it as a memory + index
  in MEMORY.md; the re-read covers refresh, not authoring.

**Composes with: single-CLI verify is a known failure mode
(Otto-347).** A 2026-04-28 surfacing demonstrated the
single-CLI-verify limit: the `pr-review-toolkit:silent-failure-
hunter` plugin agent passed an over-scrubbed de-naming as
*"consistent with Otto-279 history-surface attribution carve-
out"* — i.e., the verifier got the rule inverted in the same
direction I did. When the actor and the verifier share the same
rule-misreading, single-CLI verify is insufficient. Otto-347's
"would be good to ask another cli/harness" is the actual
corrective; in this session Aaron's external check caught what
the plugin-agent missed. So: **for rule-application checks
where the rule has carve-outs, prefer cross-CLI/harness verify
(or maintainer review) over single-CLI verify** — same-substrate
agents can share the same rule-misreading.

## Cross-references

- `memory/feedback_otto_357_no_directives_aaron_makes_autonomy_first_class_accountability_mine_2026_04_27.md`
  — the rule I just violated; the corrective re-read pattern
  was named after this violation.
- `memory/feedback_otto_275_forever_manufactured_patience_live_lock_9th_pattern_2026_04_26.md`
  — knowing-rule != applying-rule; this discipline closes that
  gap structurally.
- `memory/feedback_otto_341_mechanism_over_vigilance.md` (or
  equivalent) — substrate-as-mechanism beats agent-vigilance;
  cadenced re-read is the mechanism-form of CLAUDE.md
  application.
- `CLAUDE.md` — the document whose re-read this discipline
  governs.
- `docs/AUTONOMOUS-LOOP.md` — the tick discipline; this
  composes with the six-step checklist by adding a periodic
  "re-read CLAUDE.md" sub-step at the close of every 10th tick.
