---
name: Chronological Insertion Polarity Error — class name + append-only-on-oldest-first discipline (Amara naming, Otto incident, 2026-04-28)
description: Amara 2026-04-28T19:58Z named the class after Otto's PR #684 ordering bug. Class definition — edit-tool prepend semantics applied to a history file with oldest-first invariant produces chronological reversal. Discipline — when adding rows to oldest-first append-only history files, use `cat >> file <<'EOF'` (always-append semantics) OR run `tools/hygiene/sort-tick-history-canonical.py` post-edit. Mechanism-over-vigilance: the tick-history lint hook caught it within 1 minute. Reusable; small; demonstrates 'stability is the substrate of velocity'.
type: feedback
---

# Chronological Insertion Polarity Error

## Class name (Amara 2026-04-28T19:58Z)

**Chronological Insertion Polarity Error** — when an edit
operation's directional semantics (prepend / insert-before /
unshift) are applied to a file whose invariant is the opposite
direction (oldest-first; newest at end). The mistake is tiny;
the class is reusable.

## Concrete incident (Otto 2026-04-28T19:54Z)

- File: `docs/hygiene-history/loop-tick-history.md`.
- Invariant: oldest tick at top, newest tick at bottom (rows
  ordered by ISO timestamp ascending).
- Mistake: used `Edit` tool with `old_string = "| 2026-04-28T19:41:27Z ..."`
  and `new_string = "| 2026-04-28T19:50:30Z ...\n| 2026-04-28T19:41:27Z ..."`.
  This **prepended** the 19:50 row in front of the 19:41 row.
  But oldest-first means 19:41 should come BEFORE 19:50 — my
  prepend was chronological reversal.
- Caught: by `lint (tick-history order)` CI job within ~1 min
  of push to PR #684.
- Fixed: `python3 tools/hygiene/sort-tick-history-canonical.py`
  (the canonical-sort script designed exactly for this).
- Net cost: 1 minute of CI feedback + 1 small commit + 1
  force-push.

## Causal chain (Amara's framing)

```
mistake → lint catches it within 1 minute → PR blocked before
merge → canonical write pattern discovered → future rule encoded
```

This is **mechanism-over-vigilance** working as designed: the
hook substrate makes the mistake cheap, fast, and
non-catastrophic. Instead of "be more careful next time," the
factory has a substrate-level answer: append safely, or
canonicalize after editing.

## The discipline

When adding a row to a file with oldest-first append-only
invariant (history files; tick logs; chronological journals):

1. **Prefer append-only semantics**:

   ```bash
   cat >> path/to/history <<'EOF'
   | 2026-04-28T19:50Z (...) | ... |
   EOF
   ```

   Always-append is impossible to get the polarity wrong.

2. **OR sort-canonically post-edit**:

   ```bash
   python3 tools/hygiene/sort-tick-history-canonical.py
   ```

   The script reorders rows + dedupes; safe even if your edit
   landed at the wrong position.

3. **Don't prepend or insert-before via `Edit` tool** unless you
   have explicitly verified the file's polarity invariant.

## Lint hook control

The CI lint job
(`lint (tick-history order)` in
`.github/workflows/<gate-or-similar>.yml`) is the
**mechanism-over-vigilance** control. Without it, the
chronological reversal would have merged silently and corrupted
the durable history. With it, the mistake costs 1 minute of CI
feedback.

## Generalization beyond tick-history

The same class applies anywhere an append-only history file is
in use:

- `docs/hygiene-history/loop-tick-history.md` (this incident)
- `docs/budget-history/snapshots.jsonl` (oldest-first JSONL,
  similar polarity invariant — but JSONL appends are line-based
  so the bug shape is different; still an append-only invariant)
- ADR records (`docs/DECISIONS/`) — filename-dated; insertion
  order is timestamp-ordered by file naming convention
- Round-history (`docs/ROUND-HISTORY.md`) — chronological
- (Any future append-only journal)

For each: the lint hook + the canonical-sort tool are the
control pair. If a new history file lacks both, file as a
factory-hygiene gap.

## What this is NOT

- **NOT a directive to be more careful**. The discipline is
  mechanism-based, not vigilance-based. Future-Otto WILL make
  this mistake again on a new file; the lint hook catches it
  again; that's the design.
- **NOT a ban on `Edit` tool for history files**. `Edit` is
  fine for FIXING rows that already exist (typo fixes, wording
  corrections). The ban is on `Edit`-prepend for NEW rows.
- **NOT specific to tick-history.md**. The class generalizes;
  the specific incident was just the worked example.

## Stability is the substrate of velocity (Amara's framing)

This bug is small + boring; that's the proof. The factory's
ability to absorb a chronological-reversal mistake without
slowing down — the lint catches it, the canonical-sort fixes
it, the work continues — IS what stability buys. Without the
mechanism, this class of mistake would either be a manual
review-time catch (slow, expensive) or a silent corruption
(catastrophic if undiscovered).

The discipline scales: every mechanism-over-vigilance hook
added (to any history file, any append-only structure) adds
this kind of resilience.

## Composes with

- `tools/hygiene/sort-tick-history-canonical.py` — the
  canonical-sort script that fixes the bug after-the-fact.
- `memory/feedback_orthogonal_axes_factory_hygiene.md` —
  hygiene-axes design heuristic; this class is "polarity"
  axis.
- `memory/feedback_destructive_git_op_5_pre_flight_disciplines_codex_gemini_2026_04_28.md`
  — same shape of "small mistake, large potential impact,
  controlled by mechanism not vigilance".
- `memory/feedback_emit_empty_security_result_on_conditional_skip_ci_maturity_pattern_aaron_2026_04_28.md`
  — same family: design the hook in advance, let the metric
  self-heal / let the lint catch / let the mechanism do the
  work.
- `memory/feedback_self_healing_metrics_on_regime_change_factory_design_principle_aaron_2026_04_28.md`
  — adjacent: self-healing for metrics; mechanism-over-vigilance
  for code/data hygiene; both are "design substrate that makes
  failures cheap" patterns.

## Pickup notes for future-Otto

If you find yourself about to `Edit` a history file with a new
row:

1. **Stop.** Use `cat >> file <<EOF` instead.
2. If `Edit` is the only tool available (e.g. you're inside an
   agent without `Bash`): apply Edit, then run the canonical-sort
   on the whole file before commit.
3. **Don't add an opt-out flag** to suppress the lint. That's
   the Otto-341 self-deception pattern Aaron caught earlier;
   suppressing the hook re-introduces the failure mode it
   prevents.
