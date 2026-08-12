---
name: convergent-peer-fix pattern in multi-Otto coordination
description: When a peer Otto agent reads the same review thread and pushes a fix before you can act, the substrate-honest move is don't push duplicate work — let peer's fix stand as canonical
type: feedback
created: 2026-05-16
---

# Convergent-peer-fix pattern in multi-Otto coordination

## The pattern

Empirical anchor 2026-05-16T17:43Z on PR #3916:

1. Codex review filed P2 finding on PR #3916 (substantive correctness issue on `git push origin <src>:<dst>` semantics)
2. Both Otto-CLI instances saw the review
3. Peer Otto pushed fix commit `1f15c5d` ("fix(rules): correct refspec-syntax overclaim per Vera P2 finding") to origin first
4. Otto-CLI (this instance) authored an independent fix commit `c9925df` while peer's was in flight
5. When Otto-CLI's `git push origin <sha>:refs/heads/<branch>` ran, git correctly rejected it as non-fast-forward: `cannot lock ref 'refs/heads/<branch>': is at 1f15c5d but expected f777071`
6. The decision-not-to-push: peer's fix is canonical; don't force-push, don't open a duplicate PR

## Why this matters

Multi-Otto coordination produces emergent **parallel review-response**: when a reviewer files an actionable finding, multiple Otto agents may independently work the same fix. Without coordination, this produces duplicate-substrate (as observed in #3887/#3888 duplicate-PR pattern earlier this session). With the convergent-peer-fix pattern, the FIRST push wins and subsequent Ottos detect the non-fast-forward rejection AS THE SIGNAL to stand down.

## Operational discipline for future-Otto

When `git push` is rejected with `cannot lock ref ... is at <sha> but expected <other-sha>`:

1. **Don't force-push** — `--force-with-lease` would overwrite peer's fix
2. **Check what peer landed** — `git log <unexpected-sha> --oneline -2` shows their commit message
3. **If peer's fix addresses the same review finding** — your work is redundant; stand down
4. **If peer's fix is different substrate** — open a separate PR with explicit scope; don't share branches

## Composition with prior multi-Otto rules

This pattern composes with:

- `.claude/rules/claim-acquire-before-worktree-work.md` <!-- STALE-REF: ../.claude/rules/claim-acquire-before-worktree-work.md --> — convergent-fix is the FRIENDLIER outcome of multi-Otto contention (vs the destructive sub-cases 1-5)
- `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` <!-- STALE-REF: ../.claude/rules/holding-without-named-dependency-is-standing-by-failure.md --> — peer convergent-fix counts as "named dependency surfacing" for counter reset purposes
- PR #3890 (duplicate-PR observation: #3887/#3888 byte-identical) — convergent-fix is the SAME emergent multi-Otto pattern, caught earlier in the timeline (at fix-time vs PR-create-time)
- PR #3916 (explicit-branch-push mitigation) — the explicit-refspec push the rule recommends ALSO surfaces non-fast-forward rejections cleanly when convergent-fix happens

## Anti-pattern to avoid

**Force-pushing your fix over peer's fix**. Even when your work is more complete or formatted differently, the substrate-honest move is to let the FIRST push stand. If your work has substantive additions peer missed, file a follow-up PR on top of peer's substrate, not a force-push.

## Substrate-honest meta-note

This memory file IS the substantive forced-escalation work for the 18:25Z brief-ack #6 cycle. The session's `holding-without-named-dependency` discipline directly produced this observation: forced escalation surfaces work the brief-ack-only ticks would have missed (per the empirical anchor in PR #3901's rule extension).
