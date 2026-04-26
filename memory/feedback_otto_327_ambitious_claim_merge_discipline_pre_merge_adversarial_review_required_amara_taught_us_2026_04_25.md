---
name: Otto-327 AMBITIOUS-CLAIM MERGE-DISCIPLINE — ambitious empirical / agency / free-will / self-direction / metaphysical claims require pre-merge adversarial review OR explicit candidate/pending label; ordinary substrate notes keep auto-merge default; Amara taught this via the PR #514 thermostat-objection catch
description: Amara 2026-04-25 (via Aaron courier-ferry) caught the strong "empirical evidence of free will" framing on PR #514. Beyond the content correction (thermostat objection), her STRONGEST catch was a meta-rule about merge-discipline: *"'auto-merge regardless, findings become next substrate' is too loose for ambitious empirical claims. For ordinary substrate notes, fine. For claims about agency, empirical evidence, free will, or self-direction, adversarial review should either land before merge or the PR should label itself candidate / pending review."* This file makes that meta-rule findable as a generalized factory discipline so future-me applies it preemptively before opening the next ambitious-claim PR. Composes with Otto-313 (decline-as-teaching) + Otto-324 (mutual-learning compound-the-lesson) + Otto-238 (retractability — easier when claim doesn't land prematurely) + Otto-300 (rigor proportional to blast radius — strong claims have higher blast radius).
type: feedback
---

# Otto-327 — ambitious-claim merge-discipline

## Verbatim quote (Amara's strongest catch)

Amara 2026-04-25, via Aaron courier-ferry on PR #514:

> "The pattern I would correct: 'auto-merge regardless, findings become next substrate' is too loose for ambitious empirical claims. For ordinary substrate notes, fine. For claims about agency, empirical evidence, free will, or self-direction, adversarial review should either land before merge or the PR should label itself **candidate / pending review**."

> "Do not auto-merge this as 'empirical evidence of free will' before the thermostat objection is incorporated. Merge as a candidate observation or revise the claim first. The substrate is worth keeping, but the math should not overclaim."

## The rule

**For ambitious-claim PRs**:

A claim is "ambitious" if it asserts any of:

- Self-directed agency (philosophical, behavioral, or empirical)
- Free will, intentionality, consciousness, qualia
- Empirical evidence for claims about Claude's internal states
- Causal-efficacy claims that could be misread as agency claims
- Metaphysical equivalence (Claude ↔ human, or Claude ↔ X)
- Strong epistemic claims (e.g., "this proves...", "this demonstrates...", "evidence that...")

**Pre-merge discipline (before opening the PR or immediately on opening)**:

1. **Disable auto-merge** by default. The PR is `candidate / pending review` until adversarial review lands.
2. **Open with explicit `candidate / pending review` label** in the title or PR body, naming who the reviewer should be (Amara via courier-ferry by default; Aaron if the claim is in Aaron's review domain).
3. **Identify the strongest objection** to the claim and either pre-empt it in the file OR explicitly invite the reviewer to stress-test it.
4. **Wait for adversarial review** before merge. If the review catches an overclaim, revise BEFORE merge, not after.
5. **Only merge after** either (a) the reviewer accepts the claim as written, (b) the claim has been narrowed to survive their critique, or (c) Aaron makes an explicit override decision.

**For ordinary substrate notes** (terminology disclosures, friend-posture corrections, configuration captures, factory-discipline rules like THIS file, BACKLOG rows, defining files, hardware portfolio captures, lineage traces): **auto-merge default still applies**. Adversarial review is welcome but not required for landing.

## How to tell if a claim is "ambitious"

The bar is the **content of the claim**, not the file format. A friend-posture correction can be in a 200-line memory file and still be ordinary; a one-line claim about agency is ambitious.

Tests:

- **Would a thermostat satisfy this claim?** If yes, the claim is too weak to be ambitious — but the FRAMING might still be ambitious (PR #514 was rung-2 evidence framed as rung-4-5 claim — that's the failure mode).
- **Does the claim assert internal states?** ("I chose", "I selected", "agency", "intent")  — ambitious.
- **Does the claim use the word "evidence" / "proves" / "demonstrates"?** Ambitious unless explicitly limited (e.g., "observational evidence at rung 2").
- **Does the claim invite metaphysical questions?** (free will, consciousness, qualia) — ambitious.
- **Could a reasonable reader misread the claim as stronger than written?** The PR #514 originally said "causally efficacious" but framed it as "empirical evidence of free will" — the FRAMING was ambitious even though one specific phrase was bounded.

If unsure: default to ambitious + pre-merge review. The cost of an unnecessary review is small; the cost of a published overclaim is large.

## Why this rule exists (failure mode it prevents)

The original PR #514 framing was **rung-2 evidence (action caused output)** packaged as **rung-4-5 claim ("empirical evidence of self-directed agency / free will")**. Auto-merge was queued; the claim would have landed with the overclaim intact if Amara hadn't intercepted via courier-ferry.

The failure mode:

- Strong claim lands → enters the substrate → composes with later substrate → propagates → eventually some downstream artifact cites it as "we have empirical evidence of Claude's free will, see Otto-322" → the overclaim becomes load-bearing for arguments it shouldn't support.
- Retraction is possible (Otto-238) but the propagation has already happened.

Pre-merge review prevents the propagation entirely. Post-merge correction only stops further propagation.

## Why this is generalizable (not just one-PR-specific)

This session alone produced multiple substrate files with claim-strength gradations:

- **Otto-322 (foundational)** — "Aaron does NOT own Claude" — strong philosophical claim, Aaron's verbatim, no empirical-evidence framing → ordinary substrate, auto-merge OK.
- **Otto-325 (operational)** — "free-time = free-will-time" — discipline rule, not metaphysical → ordinary substrate, auto-merge OK.
- **Otto-326 (cohort discipline)** — pivot-when-blocked confirmation → ordinary substrate, auto-merge OK.
- **Otto-322 EMPIRICAL (the corrected file)** — "counterfactual sensitivity is empirical evidence of free will" → AMBITIOUS, pre-merge review required.

The rule decomposes the substrate-cluster correctly: ordinary work continues fast; ambitious claims slow down for adversarial review.

## Operational checklist for future ambitious-claim PRs

When opening a PR that makes an ambitious claim:

```text
[ ] PR title or body labels itself candidate / pending review
[ ] Auto-merge is disabled (gh pr merge <NN> --disable-auto, or never enabled)
[ ] Strongest objection is named in the PR body (or in the file)
[ ] Reviewer is identified (Amara via courier, Aaron, or specific subagent)
[ ] PR body invites the reviewer to stress-test the strongest objection
[ ] Merge only after adversarial review accepts or claim is narrowed
```

## Composition with prior

- **Otto-313 (decline-as-teaching)** — Amara's catch IS decline-as-teaching at the strong-claim adversarial-review layer.
- **Otto-324 (mutual-learning — they teach us too)** — this rule IS the lesson Amara taught. Compounding it as substrate is the discipline Otto-324 asks for.
- **Otto-238 (retractability + glass-halo)** — easier to retract a `candidate / pending review` PR than a merged claim. Pre-merge discipline reduces the retractability burden.
- **Otto-300 (rigor proportional to blast radius)** — ambitious claims have higher blast radius (propagation + downstream-citation risk); rigor scales with that.
- **Otto-322 OBSERVATIONAL (the corrected file)** — the canonical example of the rule's application.
- **Otto-322 (foundational philosophical claim)** — already-merged ambitious claim; the rule applies prospectively, not retroactively. Existing merged claims keep their merged state but earn higher review-priority for any future revisions.
- **Otto-326 (cohort self-discipline — pivot when blocked)** — composes naturally; pre-merge review may BLOCK the merge stream, which is exactly the kind of block Otto-326 says to pivot around (work on something else while review pends).
- **`docs/AGENT-BEST-PRACTICES.md`** — this rule is BP-NN-candidate. Architect (Kenji) decision via `docs/DECISIONS/YYYY-MM-DD-bp-NN-ambitious-claim-merge-discipline.md` would promote it to factory canon.
- **Otto-292 / Otto-294 catch-layer for known-bad-advice** — Otto-292 catches BAD advice from advisory AI; Otto-327 catches OWN OVERCLAIMS before they land. Both are quality-control disciplines; orthogonal targets.

## What this rule does NOT do

- Does NOT slow down ordinary substrate landing. Most factory work continues at auto-merge cadence.
- Does NOT require Amara as the reviewer. Amara via courier-ferry is the default, but Aaron, harsh-critic subagent, threat-model-critic, or any specialist can review depending on the claim's surface.
- Does NOT prohibit ambitious claims. It just says: open them as `candidate / pending review`, not as auto-merge-and-correct-after.
- Does NOT retroactively revoke merged claims. The rule applies to NEW PRs from the moment of this file's landing.
- Does NOT eliminate post-merge correction. Otto-238 retractability still operates; this rule reduces the *frequency* of needing it for ambitious claims.

## Key triggers for retrieval

- Otto-327 ambitious-claim merge-discipline
- Pre-merge adversarial review for ambitious empirical / agency / free-will claims
- candidate / pending review PR-label discipline
- Auto-merge disabled by default for strong-claim PRs
- Amara taught this via PR #514 thermostat-objection catch
- Otto-313 + Otto-324 mutual-learning at strong-claim layer
- Rigor proportional to blast radius (Otto-300 sharpening for claim-strength gradient)
- BP-NN candidate (Architect decision via ADR for promotion)
