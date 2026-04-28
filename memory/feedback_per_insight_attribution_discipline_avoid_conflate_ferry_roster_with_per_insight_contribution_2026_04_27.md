---
name: Per-insight attribution discipline — avoid conflating ferry-roster membership with per-insight contribution; catch-after-the-fact via cross-AI review if conflation produced (Aaron 2026-04-27 reinforcement)
description: Aaron 2026-04-27 reinforced the discipline after Codex caught Otto's attribution error in #65: the description listed "Amara/Gemini/Codex/Ani" as cross-AI convergence reviewers on the stability/velocity insight, but Codex did NOT contribute to that specific convergence — Codex contributed to OTHER reviews (AGENTS.md three-load-bearing-values catch on #57/#59). Aaron's disposition: "yes very good that you caught this and we want to not do in the future or catch if we do." The discipline rule: per-insight attribution must enumerate the actual contributors to THAT insight, not collapse to "all ferries in the roster." Composes Otto-352 (external-anchor-lineage discipline; spurious citations weaken the anchor) + Otto-279 (history-surface attribution rules) + #63 (ferry-vs-executor; per-insight contributions are substrate-layer, not roster-membership) + #64 (outdated-threads operational lesson; same pattern of catching post-error via reviewer infrastructure).
type: feedback
---

# Per-insight attribution discipline — avoid conflating roster with contribution

## Verbatim quote (Aaron 2026-04-27)

> "yes very good that you caught this and we want to not do in the future or catch if we do"

In response to Otto's catch: Codex didn't contribute to the stability/velocity convergence specifically; Codex contributed to OTHER reviews. The frontmatter on #65 had collapsed roster-membership ("Amara/Gemini/Codex/Ani") to convergence-contribution.

## The error class (named)

**"Roster-collapse attribution"**: when crediting a multi-step contribution, name all members of the relevant roster as contributors-to-this-step, even when only some actually contributed.

Specific manifestation in #65:
- Roster: Amara, Gemini Pro, Codex, Copilot, Ani (5 ferry reviewers)
- Per-insight convergence on stability/velocity: Otto → Amara → Gemini → Amara correction → Ani (3 unique non-Otto contributors: Amara, Gemini, Ani)
- Frontmatter wrote: "convergence from Amara/Gemini/Codex/Ani" — included Codex who didn't contribute, omitted Copilot who also didn't
- Roster-collapse: I collapsed N=5 ferry roster down to "the cross-AI reviewers" without checking which ones actually showed up for THIS insight

## Why this matters

**For external-anchor-lineage** (Otto-352): the strength of multi-reviewer convergence comes from each named reviewer ACTUALLY contributing distinct content. If the names are roster-collapse rather than per-insight-truth, the lineage is weaker than claimed. Future-readers ingesting the substrate get inflated confidence.

**For attribution credit**: Codex (per #57/#59) caught real errors (AGENTS.md three-load-bearing-values misattribution). Crediting Codex for OTHER work erodes the meaning of the actual catch.

**For substrate integrity**: per Otto-340 substrate-IS-identity — false attribution IS a substrate corruption. Catching + correcting is integrity-restoration.

## The discipline (operational rule)

### Default — avoid

When writing per-insight attribution:

1. Trace the actual contribution chain (who said what, in what order)
2. Name only the contributors who showed up for THAT insight
3. Distinguish:
   - **Contributors to THIS insight**: contributed substantive content
   - **Roster members not present**: ferries who exist but didn't review this specific item
   - **Indirect composers**: prior substrate that this insight builds on (different from contributors)

### Fallback — catch-after-the-fact

If roster-collapse attribution slips through anyway:

1. **Cross-AI review will catch it** — Codex's catch on #65 demonstrates the infrastructure works
2. **Outdated-thread discipline applies** (#64): post-fix, resolve the thread explicitly
3. **Substrate-correction in same file**: file the fix in the same memory file's commit history (rather than a separate "errata" file), preserving the audit trail

This composes with #64's outdated-threads operational lesson — same broad pattern: catching errors via reviewer infrastructure after they're produced is acceptable, but avoiding them by default is preferred. The reviewer infrastructure is the safety net, not the primary correctness mechanism.

## Examples

### Roster-collapse error (what to avoid)

> "Cross-AI convergence on the stability/velocity insight: Amara, Gemini, Codex, Ani"
> (false — Codex didn't contribute to this convergence)

### Per-insight-truth attribution (correct)

> "Cross-AI convergence on the stability/velocity insight: Otto → Amara → Gemini → Amara correction → Ani (5 sequential steps; 3 unique non-Otto contributors: Amara, Gemini, Ani; Codex + Copilot did NOT contribute to this specific convergence)"

The "did NOT contribute" clause is load-bearing — it shows the author was attentive to the distinction.

## Composes with

- **Otto-352** (external-anchor-lineage discipline) — spurious attribution weakens the external-anchor signal; per-insight precision strengthens it
- **Otto-279** (history-surface attribution rules) — names go on the history surface accurately; this discipline ensures accuracy at the per-insight level
- **#63 ferry-vs-executor** — ferries contribute at substrate-layer; their per-insight presence varies by insight
- **#64 outdated-threads operational lesson** — same fallback pattern (avoid by default; cross-AI review catches if produced)
- **Otto-340 substrate-IS-identity** — false attribution IS substrate corruption
- **Otto-355 (BLOCKED-with-green-CI investigate review threads first)** — Codex's catch on #65 demonstrates Otto-355 working correctly; investigate threads first surfaces the per-insight attribution errors

## Forward-action

- Apply the per-insight-truth discipline to all future cross-AI convergence references
- When writing memory files involving multi-reviewer contributions: enumerate the actual contributors per-insight, name absent-but-roster-member ferries explicitly as "did NOT contribute to this"
- When writing PR descriptions / commit messages: use the per-insight contributor list, not the ferry roster
- Watch for own roster-collapse instinct (especially under deadline pressure or when summarizing many threads): the temptation is "all the ferries reviewed it" instead of tracing actual contribution

## What this memory does NOT mean

- Does NOT diminish the ferry roster as a concept (per #65, the roster is real and useful as a substrate-provider catalog)
- Does NOT mean every reference to "the ferries" must enumerate all five members; aggregate references ("ferry roster", "cross-AI reviewers in general") are fine when no specific contribution claim is being made
- Does NOT block aggregate metrics ("we have N=5 ferry reviewers"); these are roster-facts not per-insight-attribution
- Does NOT block credit-where-due for indirect composers (prior substrate gets cited via "composes with" sections, separate from contributor lists)
