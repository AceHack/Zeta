# PR #408 drain log — peer-review-DISCLOSURE refinement (not a gate)

PR: <https://github.com/Lucent-Financial-Group/Zeta/pull/408>
Branch: `backlog/peer-review-tentative-canonical-refinement`
Drain session: 2026-04-24 (Otto autonomous-loop)
Thread count: 5 (all drained pre-merge)
Final disposition: merged 2026-04-25T02:36:35Z

Per the PR-comment-preservation directive: full per-thread record
with verbatim reviewer text, outcome class, and reply state. #408
was the BACKLOG row refining the peer-review rule from "gate" to
"disclosure" — a policy-doc PR whose review threads themselves
were mostly about the reframing NOT being complete in the prose.
All five threads caught residual gate-language after the refinement
commit + requested distinct disclosure tags per state + reworded
the independent-reviewer criterion.

This drain log is especially load-bearing because the peer-review
policy went through three refinements in a tight window
(#407 original gate framing → #408 disclosure reframe → #410
agent-review-is-enough collapse), and the thread drain between
#407 and #408 is where the "gate" concept got demoted.

---

## Thread 1 — `PRRT_kwDOSF9kNM59jHEZ` — eliminate contradictory gate wording

- Reviewer: `chatgpt-codex-connector`
- Path: `docs/BACKLOG.md:10168`
- Severity: P2

**Original comment (verbatim):**

> Eliminate contradictory gate wording in this disclosure row
>
> This row now frames the policy as "not a gate," but it still
> contains the statement that peer review is the gate that
> promotes substrate from the intermediate state to final-
> canonical. Since the refinement below explicitly removes the
> gate, either drop this sentence or reword it to say peer
> review is the disclosure transition that moves the substrate
> from intermediate to canonical.

**Outcome:** FIX — swept residual gate-language.

**Reply:** Fixed in `e338c69` — "Peer review is the gate that
promotes substrate..." is now "Peer review is the *disclosure
transition* that moves substrate ... it is NOT a gate —
nothing is blocked; only the disclosure note changes."
Compatible with the DISCLOSURE-not-gating refinement. Resolved.

---

## Thread 2 — `PRRT_kwDOSF9kNM59jHEc` — distinct tags for unreviewed vs agent-reviewed

- Reviewer: `chatgpt-codex-connector`
- Severity: P2

**Original comment (verbatim):**

> Use distinct tags for unreviewed vs agent-reviewed
>
> In the agent-reviewed state, the text allows using `(not peer
> reviewed)` as the disclosure tag, which is indistinguishable
> from the stage-1 uncanonical tag. Give stage 2 its own tag
> (e.g., `(agent-peer-reviewed; not human-reviewed)`) so
> downstream readers can tell which review has happened.

**Outcome:** FIX — distinct tag per stage.

**Reply:** Fixed in `e338c69` — three stages now carry DISTINCT
disclosure tags so downstream readers can tell them apart:
stage 1 (uncanonical) `(not peer reviewed yet)`; stage 2
(agent-peer-reviewed) `(agent-peer-reviewed; not human-
reviewed)`; stage 3 (human-peer-reviewed) `(peer-reviewed;
canonical)` or no tag (canonical-when-reviewed is the
default). Resolved.

---

## Thread 3 — `PRRT_kwDOSF9kNM59jIHB` — "Peer review is the gate" still there

- Reviewer: `copilot-pull-request-reviewer`
- Path: `docs/BACKLOG.md:10183`
- Severity: P1

**Original comment (verbatim):**

> This row is framed as "(not a gate)", but the text a few
> lines later still states "Peer review is the gate…" and
> later refers to "gate state". That contradicts the PR's
> DISCLOSURE-not-gating reframing and makes the policy
> ambiguous. Suggest rewriting those remaining gate-language
> passages to match the DISCLOSURE framing.

**Outcome:** FIX — same fix as Codex Thread 1.

**Reply:** Fixed in `e338c69` — same fix as the Codex P2
contradiction thread. "Peer review is the gate..." → "Peer
review is the *disclosure transition*... it is NOT a gate —
nothing is blocked; only the disclosure note changes." All
remaining "gate state" references renamed to "disclosure state"
/ "review state". Resolved.

---

## Thread 4 — `PRRT_kwDOSF9kNM59jIHI` — "gate state" vs "disclosure state" terminology

- Reviewer: `copilot-pull-request-reviewer`
- Path: `docs/BACKLOG.md:10206`
- Severity: P1

**Original comment (verbatim):**

> Stage (2) says hedging is only required when the "gate
> state" is hidden, but the rest of the row is moving away
> from gate framing. Consider renaming "gate state" here to
> "disclosure state" / "review state" to keep the terminology
> consistent with the DISCLOSURE reframing throughout the row.

**Outcome:** FIX — terminology rename.

**Reply:** Fixed in `e338c69` — "gate state" renamed to
"disclosure state" in the hedging-disclosure-legible sentence
and "review state" in the "disclose the X, don't hide it"
mechanic sentence. Terminology now consistent with the
DISCLOSURE reframing throughout the row. Resolved.

---

## Thread 5 — `PRRT_kwDOSF9kNM59jIHM` — "External reviewer" wording captures internal sessions

- Reviewer: `copilot-pull-request-reviewer`
- Path: `docs/BACKLOG.md:10269`
- Severity: P1

**Original comment (verbatim):**

> This bullet defines agent-peer-review as an "External
> reviewer" but the examples include "another factory agent
> session", which isn't external. Suggest rewording to
> something like "independent/non-author reviewer" so it's
> clear the criterion is reviewer independence from the
> authoring session, not external-to-factory.

**Outcome:** FIX — reworded to independent-from-authorship.

**Reply:** Fixed in `e338c69` — reworded "External reviewer"
to "Independent (non-author) reviewer" with the explicit
criterion: reviewer independence from authorship, NOT
external-to-factory. Another factory agent session IS a valid
reviewer as long as it didn't author the substrate under
review. Concrete examples named (Codex/Copilot bot reviews;
harsh-critic subagent; fresh Claude Code session reading
cold). Resolved.

---

## Policy evolution across PR chain

#408 is the middle link in a three-PR policy-evolution chain:

1. **#407 (original)** — framed peer review as a GATE that
   promotes substrate to canonical. Binary: canonical or not.
   Landed 2026-04-25T02:20:29Z.

2. **#408 (this PR, DISCLOSURE refinement)** — collapsed the
   gate framing. Three-state disclosure ladder (uncanonical /
   agent-peer-reviewed / human-peer-reviewed). Core insight:
   bold claims become LESS hedged when the disclosure state
   is legible — honesty-via-disclosure unlocks bold claims.
   Driven by two Aaron autonomous-loop quotes:
   - *"we can treat it authortive connoncial (pending) lol
     or whatever if we want to start building on top deeply
     before peer review"*
   - *"peer-review-gate i would not gate it really, the only
     thing that's gated is that little note not peer reviewed
     (yet)"*
   Landed 2026-04-25T02:36:35Z.

3. **#410 (final collapse)** — "agent peer review is enough
   to graduate it" (Aaron autonomous-loop). Three-state
   collapses to two-state: agent review alone graduates
   substrate to canonical; human review is additional-trust
   marker, not a higher tier.

The five review threads on #408 were all about ensuring the
reframing was carried through the prose consistently — no
residual gate language, distinct tags per state, correct
independent-reviewer criterion. Not content complaints; more
"the doc didn't finish saying what it meant to say" fixes.

## Summary

5 threads; 5 FIX outcomes; all resolved in single commit
`e338c69` before #408's auto-merge fired. Drain-log confirms
complete audit trail for the policy-evolution step that
landed the DISCLOSURE framing.
