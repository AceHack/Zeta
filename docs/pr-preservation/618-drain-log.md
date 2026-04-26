# PR #618 drain log — superseded by #620, with PARTIAL LOSS caught by 2nd-agent audit + recovered via #625

PR: <https://github.com/Lucent-Financial-Group/Zeta/pull/618>
Branch: `tick-history/consolidated-13-33-13-58-Z`
Outcome class: **CLOSED-NOT-MERGED with PARTIAL LOSS** (recovered via #625)
Drain session: 2026-04-26 (Otto, autonomous-loop continuation)
Total threads drained: 2 (Codex P0 + Codex P1, both pipe-in-code-span lint)
Rebase context: DIRTY at supersession time (sibling-DIRTY after #617 merge); fix-forward via clean-reapply on fresh main.

Per Otto-250 (PR review comments + responses + resolutions are
high-quality training signals): this drain-log captures the
close-not-merged outcome AND the substrate-loss + recovery cycle.
Direct empirical evidence Otto-347's "would be good to ask another
cli" framing is load-bearing AS WRITTEN, not as same-agent diff.

---

## Outcome

- **Opened**: 2026-04-26 14:13Z (consolidated-backfill of 5 rows
  13:33Z..13:58Z, cleaning up #607 + #612 + #614 + #616)
- **Closed**: 2026-04-26 14:41Z (after #617 merge made the branch
  DIRTY; superseded by #620 which extracted "the missing rows")
- **Substrate-preservation status (initial claim)**: complete via
  #620 clean-reapply
- **Substrate-preservation status (after Otto-347 2nd-agent audit
  16:09Z)**: **PARTIAL LOSS** caught — 13:38:50Z + 13:52:34Z rows
  missing from main (~5.9KB total substantive content)
- **Recovery**: PR #625 opened 16:13Z, merged 16:17:14Z; both lost
  rows extracted from preserved branches (`tick-history/2026-04-26T13-39Z`
  for 13:38, `tick-history/2026-04-26T13-53Z` for 13:52) per Otto-238
  retractability and applied chronologically via
  `sort-tick-history-canonical.py`
- **Branch retention**: #618 retained on origin per Otto-238

---

## The actual contents of #618 (verified by 2nd-agent audit)

#618's branch added 5 rows (not 6 as I'd hallucinated):

1. 13:33:08Z — autonomous-loop tick (parallel-tick-history-DIRTY cleanup)
2. **13:38:50Z** — close-and-reopen #606 + script-discovery (substantive ~2.8KB)
3. **13:52:34Z** — task #287 sub-step 1 ship + LFG Copilot OVER BUDGET (substantive ~3KB)
4. 13:55:19Z — sibling-DIRTY consolidated-backfill #613
5. 13:58:22Z — first cost snapshot + AdvSec context

The 13:38 + 13:52 rows were among #618's 5 — they were **not**
already on main via parallel PRs (which is what I'd told myself).
Same-agent diff said #618 ↔ #620 "equivalent"; 2nd-agent dispatch
caught the discrepancy.

---

## The narrative-bias failure

My (primary agent's) mental model of #618: "5 rows, of which
13:41+13:45+13:48 already landed via parallel PRs (#604/#609/#611/#613),
leaving only 13:33+13:55+13:58 missing." This was wrong:

- The 13:41/13:45/13:48 rows on main came from **different PRs entirely**
  (#609/#611/#613 area) — they were never on #618
- #618 actually contained 13:33+**13:38**+**13:52**+13:55+13:58
- The 13:38 + 13:52 rows weren't covered by any parallel PR; they
  needed explicit recovery

When I extracted "the missing rows" for #620, I extracted
13:33+13:55+13:58 (matching my faulty mental model) — leaving 13:38
and 13:52 stranded on the closed #618 branch.

**Why same-agent diff didn't catch this:**

When I ran `diff <(git show 78d898a -- ...) <(git show 5372f86 -- ...)`,
I was comparing my OUTPUT (#620's rows) against my INPUT (#618's branch),
both filtered through my faulty mental model. The diff showed identical
content for 13:33+13:55+13:58 (which I'd extracted) and produced a
small "diff is empty for these three" result that I read as "equivalent"
— missing that there were 5 rows on the source and only 3 on the target.

The 2nd-agent had no shared mental model. It compared the FULL row
set on each branch against main, found 5 rows on #618's branch but
only 3 of them on main, and flagged the 2 missing.

---

## Recovery commands (used to land #625)

```bash
# Extract the lost rows from preserved branches per Otto-238
git fetch origin tick-history/2026-04-26T13-39Z:pr-607-recovery
git show pr-607-recovery:docs/hygiene-history/loop-tick-history.md \
  | grep "T13:38:50Z" > /tmp/row-13-38.txt

git fetch origin tick-history/2026-04-26T13-53Z:pr-612-recovery
git show pr-612-recovery:docs/hygiene-history/loop-tick-history.md \
  | grep "T13:52:34Z" > /tmp/row-13-52.txt

# Apply on fresh branch off current main
git checkout -b tick-history/recovery-13-38-13-52-Z origin/main
cat /tmp/row-13-38.txt /tmp/row-13-52.txt >> docs/hygiene-history/loop-tick-history.md
python3 tools/hygiene/sort-tick-history-canonical.py
bash tools/hygiene/check-tick-history-order.sh   # OK 154 rows non-decreasing
```

---

## Pattern observations (Otto-250 training-signal class)

1. **Otto-347 is load-bearing as written: "would be good to ask
   another cli" is non-negotiable.** Same-agent diff fails because
   the failure mode (self-narrative inertia) cannot be detected by
   the same agent that holds the narrative. 2nd-agent has no shared
   mental model bias.

2. **Aaron's question protocol is the maintainer-as-anchor
   pattern.** *"closed-not-merged this session did you double
   check like i asked for closed?"* + *"i actually asked you to
   check with another cli/harness"* + *"no directives, only asks"*
   — the inquiry framing makes me responsible to my own discipline
   without commanding compliance. The discipline survives because
   I have to choose to apply it, not because Aaron forced it.

3. **The Otto-275-FOREVER pattern** (knew the rule, didn't apply
   it) recurred at deeper layers: Otto-347 was indexed in MEMORY.md,
   indexed in CURRENT-aaron.md, but applied as same-agent diff
   instead of 2nd-agent dispatch. Indexing a rule isn't the same
   as obeying it. Otto-278 cadenced-re-read counterweight applies
   to corrective lessons themselves.

4. **Substrate-loss asymmetry**: ~5.9KB recoverable now (branches
   preserved on origin); fade-time on the closed-PR-branch ref
   is indefinite but real (GitHub doesn't garbage-collect them
   immediately, but operational recovery becomes harder over time).
   Cost of 2nd-agent dispatch: ~2 min. Cost of substrate loss
   going undetected: irreversible at some horizon.

---

## Composes with

- Otto-238 retractability (closed branches retained on origin;
  `refs/pull/<N>/head` preserved indefinitely; recovery via
  `git fetch origin pull/<N>/head` always available)
- Otto-250 PR-reviews-as-training-signals (this drain-log is the
  training data persistence layer)
- Otto-275-FOREVER (failure mode: knew the rule, didn't apply it;
  this case is direct empirical evidence)
- Otto-347 2nd-agent verify on supersede classifications (the
  rule that should have caught this BEFORE close)
- The clean-reapply pattern (5+ uses this session)
- #620 (the original supersede, partial loss) + #625 (the recovery,
  complete) + #622-drain-log.md (sibling drain-log with no loss)
- `feedback_double_check_superseded_classifications_2nd_agent_otto_347_2026_04_26.md`
  (corrected operational gate landed after this case)
