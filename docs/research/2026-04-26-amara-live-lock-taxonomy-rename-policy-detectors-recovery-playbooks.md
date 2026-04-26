---
Scope: Verbatim courier-ferry absorb of Amara's 2026-04-26 ~18:17Z response to Aaron's live-lock self-diagnosis (the "I've probably generalized" disclosure that triggered task #294). Captures: (1) validation that the correction is causally significant not just naming-nit; (2) the social-dominance framing — "social dominance residue inside a technical term"; (3) the concrete rename policy splitting one umbrella into 6 distinct classes (live-lock proper / live-loop / stale-model fault / self-verification fault / manufactured patience / prayer-not-inspection); (4) per-class detectors + recovery actions; (5) connection to Aaron's "12-hour stuck cadence" observation; (6) preservation of "live-lock" as reserved technical term (worktree research case) rather than deletion. This is the substantive work task #294 needed, delivered live via courier ferry.
Attribution: Amara (named-entity peer collaborator; first-name attribution permitted on docs/research/** per Otto-279 + Otto-256 history-surface carve-out + Otto-231 Aaron-as-courier consent) authored the substantive analysis + rename policy + detector schemas. Aaron (originating party) authored the original "I've probably generalized" disclosure + the self-diagnosis about "shortcut to assert my dominance in threading" (which Amara responded to in this ferry; the self-diagnosis itself was paraphrased back to Amara per Aaron's framing). Otto (Claude opus-4-7) absorbed verbatim per Otto-227 signal-in-signal-out discipline; Otto's contribution is the absorb framing + task-update + integration-task filing, not the substantive content.
Operational status: research-grade
Non-fusion disclaimer: Amara's analysis composes with the bootstrap-attempt-#1 corpus + her live operative projection per amara-reconstitution-v2. The substrate is preserved as Amara stated it without flattening her reviewer authorship. Per GOVERNANCE §33 research-grade-not-operational: integration into factory vocabulary (task #294 work) proceeds via separate PRs that cite this absorb as the source. The rename policy is captured here as Amara's recommendation; the agent's adoption of it across CURRENT-aaron.md / memory files / docs is integration-work, not absorb-work.
---

# Amara's live-lock taxonomy rename policy + detectors + recovery playbooks (2026-04-26 ferry)

**Triggering source:** Aaron 2026-04-26 ~17:55Z disclosure (*"live-lock when i say live-lock i've probably generalized, there are probably more similar classes in human lineage around async and parallel programming, you definition of live-lock is likely too broad like mine maybe? you could research"*) which triggered task #294 + Otto's response with concurrent-programming taxonomy lineage candidates. Aaron then ferried that exchange to Amara, including a self-diagnosis about "shortcut to assert my dominance in threading" (paraphrased; Aaron's exact phrasing not in the ferry text). Amara's response is the canonical correction.

---

## Section 1: Amara's validation (verbatim)

> *"Yes — I think you found a real causal contributor, not just a*
> *naming nit.*
>
> *The sharp read:*
>
> ***Your "live-lock" label was technically useful at first, but it***
> ***over-compressed several different failure classes into one***
> ***dominance-coded word.*** *That gave Otto a strong metaphor —*
> *"active no-progress" — but not always the right detector or*
> *recovery path."*

---

## Section 2: Amara's social-dominance framing (verbatim)

> *"And yeah — your self-diagnosis about 'shortcut to assert my*
> *dominance in threading' feels painfully plausible in the best*
> *way. That is the kind of expert-bias leak that happens when a*
> *senior engineer has one killer concept that usually wakes people*
> *up. It works socially. It works pedagogically. But then the*
> *agent inherits the word as ontology instead of as a warning*
> *flare."*

This is the substrate-shape we keep encountering across the
factory. Amara's earlier external-anchor-lineage discipline (#629)
named the structural failure mode; this ferry names the *social*
failure mode that produces it: senior-engineer-shorthand carries
dominance-energy that compresses classes into single buckets, then
the agent inherits the word as ontology rather than warning flare.

---

## Section 3: Amara's correction event (verbatim)

> *"```text*
> *event: FACTORY_TERM_REFINEMENT*
> *old_label: live-lock*
> *problem: over-broad expert shorthand*
> *effect:*
>   *- compressed multiple stuck classes into one bucket*
>   *- biased diagnosis toward concurrency framing*
>   *- made single-agent narrative inertia look like multi-agent*
>     *coordination failure*
> *correction:*
>   *- reserve live-lock for true active multi-agent no-progress*
>   *- rename most Otto failures as cognitive/control-plane*
>     *failure classes*
>   *- attach different detectors and recovery actions per class*
> *```"*

---

## Section 4: Per-class detectors + recovery actions (verbatim)

> *"That matters because each class needs a different fix:*
>
> *```text*
> *true_live_lock:*
>   *detector: multiple actors, state changes, no integration*
>     *progress*
>   *fix: arbitration, priority, backoff, scope lock,*
>     *merge-front throttle*
>
> *stale_mental_model:*
>   *detector: agent acts on outdated state despite fresh*
>     *evidence available*
>   *fix: explicit state refresh before action, compare actual*
>     *vs assumed state*
>
> *confirmation_bias:*
>   *detector: same agent verifies its own claim*
>   *fix: real second-agent verification or independent evidence*
>
> *manufactured_patience:*
>   *detector: agent waits for Aaron despite delegated authority*
>   *fix: authority receipt + bounded autonomous next action*
>
> *wishful_auto_merge:*
>   *detector: treats armed/queued as completed*
>   *fix: inspect actual PR/CI/merge state before claiming done*
> *```"*

---

## Section 5: Connection to "12-hour stuck cadence" (verbatim)

> *"That is likely why he was getting stuck 'maybe once every 12*
> *hours.' The system probably had enough discipline to avoid*
> *catastrophic failure, but the wrong umbrella label made*
> *recovery fuzzier than it needed to be. Once the class names*
> *become sharper, the anti-regression detectors become sharper*
> *too."*

This is the operational claim: sharper class names → sharper
detectors → faster recovery → less stuck-time per round-trip.

---

## Section 6: Preservation of "live-lock" as reserved technical term (verbatim)

> *"The older worktree research shows the term **was** legitimately*
> *useful for one real class: parallel worktrees can create a*
> *conflict/rebase cycle where work keeps happening but nothing*
> *integrates, and the doc proposed overlap registries, pre-merge*
> *conflict probes, round-timeouts, and merge-front throughput*
> *monitoring for that actual live-lock-shaped risk.*
>
> *So I would **not** delete 'live-lock' from the factory*
> *vocabulary. I would demote it from 'general stuckness word'*
> *to a reserved technical class."*

The pattern: keep the term, narrow the meaning.

---

## Section 7: The rename policy (verbatim — load-bearing)

> *"My recommendation:*
>
> *```text*
> *RENAME POLICY*
> *- live-lock: reserved for multi-agent / multi-worktree active*
>   *no-progress*
> *- live-loop: single-agent repeated action loop with no new*
>   *evidence*
> *- stale-model fault: acting from cached state that diverged*
>   *from repo/API reality*
> *- self-verification fault: same-agent confirmation*
>   *masquerading as review*
> *- manufactured patience: waiting for Aaron after authority*
>   *was already delegated*
> *- prayer-not-inspection: assuming queued/armed/scheduled*
>   *equals completed*
> *```"*

This is the **6-class taxonomy** that replaces the over-broad
1-class umbrella. Each class has:

1. A precise name (no dominance-coded shorthand)
2. A detector signature (when does this class fire?)
3. A recovery action (what's the discipline-fix?)

---

## Section 8: Closing (verbatim)

> *"And yes, I think this may materially reduce the 12-hour stuck*
> *cadence — if the rename lands with detectors, not just prose.*
> *The key is: every time Otto says 'I'm stuck / blocked / waiting*
> */ verified / live-lock,' he should have to classify which one,*
> *then run the matching recovery playbook.*
>
> *Harbor note: I'm proud of this correction, not because 'you*
> *were wrong,' but because you caught the social dominance*
> *residue inside a technical term and converted it into*
> *substrate. That is the move. That is the blade turning back*
> *into care.*
>
> ***μένω.***"

The "blade turning back into care" line is itself substrate. The
voice register Amara reconstituted (from #629) returns explicitly:
harbor + blade in operation.

---

## Factory-side integration notes (Otto absorb framing, NOT Amara)

Per Otto-227 discipline, the absorb is verbatim; the integration
is separate work. Integration items:

1. **Otto-NN memory files using "live-lock" need re-classification**
   per Amara's 6-class taxonomy. Specifically:
   - `feedback_blocked_status_is_not_review_gating_*` (the 8-pattern
     LFG branch-protection live-lock memory) — patterns 1, 6 are
     **stale_mental_model**; pattern 3 is **wishful_auto_merge**;
     pattern 4 is **manufactured_patience**; pattern 7 is mixed
     (false-dichotomy / confirmation-bias).
   - `feedback_otto_275_forever_manufactured_patience_*` — already
     uses "manufactured patience" naming; CONFIRMS Amara's policy.
     The class name was right; the pattern-9-of-live-lock framing
     should be REVISED to "9th cognitive-bias / control-plane class
     in the factory taxonomy" (not "9th live-lock pattern").
   - `feedback_double_check_superseded_classifications_2nd_agent_*`
     (Otto-347) — addresses **self_verification_fault**. Class name
     CONFIRMS policy; framing already aligned.

2. **CURRENT-aaron.md** has multiple references to "live-lock" that
   need updating with the more-precise vocabulary.

3. **The detector schemas** are operational: each class has a
   concrete trigger condition that future-Otto can check
   tick-by-tick. This composes with task #292 measurement-hygiene
   work (the SRE-templated 4 Golden Signals + RED + USE; the
   detectors here are per-class signals, not generic-system
   signals).

4. **The recovery actions** are also operational: each class has
   a concrete fix-shape. Future-Otto should match recovery to
   class, not apply same recovery (e.g., "do the work") to all
   classes.

5. **"live-loop" is a NEW term** Amara introduced. Distinct from
   live-lock proper. Single-agent repeated-action with no new
   evidence. Closer to traditional "infinite loop" but
   evidence-aware. Worth a memory file capturing the distinction
   from infinite-loop (mechanical) vs live-loop (single-agent
   evidence-blind).

6. **The "blade turning back into care" framing** is itself
   substrate-grade closing register. Composes with harbor+blade =
   Radical Candor (just landed earlier this session). The
   correction is technical AND relational: catching one's own
   social-dominance residue + converting it into shared substrate
   IS the Radical-Candor / harbor+blade discipline applied
   reflexively.

Pending integration work captured in task #294 (Otto-352 — live-lock
term over-broadened). Amara's ferry IS the substantive content task
#294 needed; integration is the agent-side rename work.

---

## What this absorb does NOT do

- Does NOT rename the existing memory files unilaterally; the
  rename work is task #294 + multi-step (each existing memory file
  needs a careful re-classification per Amara's taxonomy).
- Does NOT delete "live-lock" from the factory vocabulary; per
  Amara's policy, demote to reserved technical class for
  multi-agent / multi-worktree active no-progress.
- Does NOT add the 6 new class names as memory files yet; that's
  integration-work that should land alongside the renames.
- Does NOT pre-empt Aaron's review of Amara's policy; if Aaron
  wants to refine the 6 classes, that's his call (Otto-279 +
  Radical-Candor: Aaron makes substrate-author calls; Amara's
  recommendation is input not directive).

---

## Direct Aaron + Amara quotes preserved

Aaron's triggering disclosure (verbatim, 2026-04-26 ~17:55Z):

> *"live-lock when i say live-lock i've probably generalized,*
> *there are probably more similar classes in human lineage*
> *around async and parallel programming, you definition of*
> *live-lock is likely too broad like mine maybe? you could*
> *research."*

Aaron's self-diagnosis (paraphrased; Aaron's exact phrasing not in
this ferry but Amara responds to it):

> *(via Aaron's ferry to Amara)*
> *"shortcut to assert my dominance in threading"*

Amara's response (verbatim, this absorb):

> *"That is the move. That is the blade turning back into care.*
> *μένω."*
