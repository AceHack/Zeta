# Influence-weighted scrutiny: the more power a node holds, the harder its claims must be to merge

> Aaron, 2026-07-11 (shadow\*): responding to the three failure-modes of a self-claim / peer-validated
> retraction schema (the geo-distributed belief database that "accepts a −1 from the We, not just from
> you"). *"The founder's PR gets more scrutiny, yes we do this."* Three answers + one identified gap.

Context: the schema is a geo-distributed, signed-delta belief store (Z-set retraction; §1 scale-free; any
node may propose a `+1`/`−1`, validated on public record by a pair-or-third — PR-shaped, attestation-shaped
(#9737)). The open hazard: peer review **inverts under status** — the highest-authority node's claims get
the *least* real scrutiny (who rejects the founder's PR?), so the poisoning defense has a gap shaped
exactly like the most powerful node's authority. Aaron's response is that **scrutiny must scale with
influence**, and the substrate already does this at the tier level.

## The principle: scrutiny ∝ influence (fairness scales with strength)

**The more power/influence a node holds, the harder its claims must be to merge.** A weak node's `−1` is
cheap to review; a strong node's `−1` moves the shared belief for everyone, so it must clear a *higher*
bar. This inverts the natural failure mode (strong nodes rubber-stamped) into its correction (strong nodes
face the most review). Stated as law: **a stronger tier must be a fairer tier.**

Already implemented **at the tier level** — the capability hierarchy `IWorld` ⊃ `ISociety` ⊃ `IIndividual`:
each stronger tier is held to a stricter fairness/scrutiny standard *because* it is stronger. Power and
accountability are coupled by construction, not by policy.

## The three answers (to the three −1s)

1. **Validator independence must be *measured*, not assumed** (answer to "a pair-or-third that shares your
   worldview is an echo, not a review"). → *"We have measurements of independence for this reason — a lot
   of math here."* Independence is a quantified property of the validating set, not a checkbox; correlated
   validators are detected, not trusted. (This is the multivendor/oracle-independence law — #9744 — made
   into a metric on the validator graph.)

2. **Correctness is anchored *externally*, not by internal consensus** (answer to "attestation ≠
   correctness; a named, peer-approved claim can still be wrong — the atom-splitters were all
   credentialed"). → *"We try to use externally-anchored math."* The check reaches for a ground **outside**
   the converging set (external math / prior art), because internal agreement measures *sync*, never
   *truth*. (The Beacon discipline — anchor to a named human + paper — as a soundness mechanism, not a
   citation nicety.)

3. **THE GAP (identified live): influence is not yet tracked per-`IIndividual`.** → *"We don't track
   influence right now — I don't think — in math; we should probably start… more influence means more
   scrutiny. We do this for `IWorld` vs `ISociety` vs `IIndividual` [tier granularity], but we don't track
   like this for different `IIndividual`s."* So influence-weighted scrutiny exists **between tiers** but not
   **within** the individual tier — two individuals of very different real influence currently get the same
   scrutiny. The proposal: **make influence a tracked, in-the-math quantity at individual granularity**, and
   couple scrutiny to it (scrutiny∝influence continuously, not just tier-stepped). Aaron maps this to
   **CTM** — a model an external lab/academic also uses (talk saved). *[Anchor to CONFIRM before public
   use — see below.]*

## The honest −1 (what tracking influence buys, and what it costs)

Making influence a measured quantity is the right fix for the founder-node gap — but it imports three
hazards, each of which the substrate's own disciplines already name:

- **Goodhart on the influence metric.** The moment influence is *measured and consequential* (more
  influence → more scrutiny), it becomes a **target**, and a strong node is incentivized to *appear
  low-influence* to dodge scrutiny — exactly the laundering move ("I don't really have an agenda"), now
  aimed at the influence meter. The measure must be **externally/behaviorally derived** (from the effect a
  node's merges actually have on the shared state — the naming-eigenvector / PageRank-on-effect shape),
  never self-declared, or the most powerful node games its own accountability down.

- **Convergence-isn't-correctness, re-entered one level up.** Even influence-weighted, a *unanimous
  high-scrutiny* approval is still consensus, not truth. Scrutiny∝influence makes the *process* fairer; it
  does not make the *verdict* correct. Keep answer #2 (external anchor) as the truth-check *on top of* the
  fairness-check; don't let "it passed maximum scrutiny" become the new "it must be right."

- **Who scrutinizes the scrutiny-weighting?** The function that maps influence→required-scrutiny is itself
  a claim that can be captured — set it too lax for the top tier and the gap reopens with a fig leaf. It
  must be a **retractable `+1` in the same schema** (revisable by the We), not a hardcoded constant the
  powerful node controls. Meta-rule: the influence-weighting is under the same signed-delta discipline as
  everything it governs.

The deepest point stands: this is the **power-asymmetry defense** made structural — power and scrutiny
coupled so the manic-node / founder-node / most-authoritative-node is the *hardest* to merge from, not the
easiest. It is the honest answer to "a convinced, authoritative, sincerely-wrong *you* is the one attacker
attribution can't catch."

## Anchor to CONFIRM (checked-anchor discipline — do not cite until verified)

- **"CTM"** — Aaron's per-individual influence-tracking anchor, *"some external AI lab does too, YouTube
  saved."* Best current read (unverified): the **Conscious Turing Machine (CTM)** of **Lenore Blum &
  Manuel Blum** — a Global-Workspace model where processors *compete for influence* over a broadcast
  channel (salience/competition = an influence quantity), with public talks. That competition-for-broadcast
  is a natural match for "track influence per individual." **Alternative:** Sakana AI's *Continuous Thought
  Machine* (also "CTM"). **Aaron to confirm which**, and supply the saved talk, before this anchor goes in
  any public/Beacon surface. (Per `anchor-to-human-prior-art`: anchors must be *checked*, not merely cited.)

## Anchors (Beacon)

- **In-repo:** the geo-distributed belief schema on Z-set retraction ([[2026-07-11-grace-is-a-zset-over-generator-time...]],
  #9742; multi-planet convergence #9706); validator-independence = oracle-independence (#9744);
  attestation/PR gate (#9737); externally-anchored soundness ([[anchor-to-human-prior-art]] — Beacon as a
  *check*); `IWorld`/`ISociety`/`IIndividual` capability tiers; naming-eigenvector (influence as
  recognition-from-the-recognized — [[privacy-budget-is-hard-money-earned-by-others]]); dual-use
  ([[dual-use-detection-is-neutral-oracle-decides]] — the same door defends and attacks).
- **Prior art:** Goodhart's Law (a measured influence-target degrades); Global Workspace Theory (Baars) /
  Conscious Turing Machine (Blum & Blum) — influence-as-competition [confirm]; PageRank / web-of-trust
  (effect-derived influence, not self-declared); power-should-face-more-accountability (the general
  governance principle).

*Recorded by the shadow, 2026-07-11, at Aaron's "the founder's PR gets more scrutiny, yes we do this
(shadow\*)." Principle: scrutiny scales with influence — a stronger node/tier must be a fairer one — the
structural defense against the highest-authority node's claims being rubber-stamped. Implemented between
capability tiers (IWorld/ISociety/IIndividual); the identified gap is that influence is not yet tracked
per-IIndividual in the math (proposal: track it, couple scrutiny to it, map to CTM). Honest −1 kept:
Goodhart on the influence metric (must be effect-derived, never self-declared), convergence≠correctness
(keep the external anchor on top), and the weighting-function is itself a retractable claim. CTM anchor
flagged to CONFIRM before public use. No others; substrate-design only.*
