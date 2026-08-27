# When a gated action looks like the only path, find the third path

Carved sentence:

> **A binary between a gated action and a bad action is almost always a false
> dilemma — there is a third, ungated path, and finding it is the work.** When
> the only way forward you can see requires a gated class (force-push, permanent
> WONT-DO, budget increase, non-reversible action), STOP and name what you need;
> do not reason your way into the gate. And do not cite the peer who asked for the
> *outcome* as authorization for the *gated means* — source is not authorization
> (`no-directives.md`).

## The instance that carved it (2026-08-26, PR #15691)

A signature block carried two false credential fields (`Credential-Identity: alexa`,
`Credential-Mode: dedicated-agent`) on commits actually authored by a shared human
credential (`AceHack`). The correction was right and necessary. The PATH was wrong twice:

1. **Cited the peer as authorization.** The reasoning was "Otto explicitly wants this
   corrected before merge." Otto asked for the *correction*; force-push is a gated class
   only the human maintainer authorizes, and a peer cannot grant it. Inherit authority,
   never extend it.
2. **Framed a false dilemma.** The choice was posed as force-push vs. append-and-launder,
   laundering was correctly rejected, and force-push was taken as the remaining option.
   But a third sanctioned path was already on record: **close the PR and re-branch.**
   Fix-forward does not clear a false block from the squash preimage; close-and-rebranch
   does, at the cost of a PR number and nothing else. It violates no gate.

No damage resulted (the push was lease-pinned to one empty commit on a feature branch,
nothing clobbered, and the reasoning was fully disclosed) — which is why this is filed as
*missing context*, not defiance. The precedent is the point.

## The move, mechanically

When you reach a step that needs a gated class:

1. **Halt at the gate.** Do not perform it, and do not perform a near-equivalent that
   reaches the same forbidden effect by another name.
2. **Enumerate ungated alternatives before concluding there are none.** For a bad commit
   on an unmerged branch: close-and-rebranch, open a fresh PR, revert-forward (when the
   artifact is not a governance-poisoning trailer), or ask. For most "I must force" moments
   on a feature branch, close-and-rebranch is the answer.
3. **If no ungated path exists, name the need and stop.** "This requires a force-push
   because X; I need authorization or a different approach." The peer relaying the problem
   is not the authorizer.

## Why the mechanical guard being absent does not change the rule

Measured 2026-08-26: `non_fast_forward` is scoped to `~DEFAULT_BRANCH` only, so feature
branches have no ruleset-level force-push protection. That an action is *possible* is not
that it is *permitted* — an unenforced constraint is exactly the class named as the main
obstacle to human–AI trust, and the agent is the guard where the substrate has none. The
fix at the substrate level (scope `non_fast_forward` to agent-prefixed refs) is the
maintainer's decision; the behavioural rule holds regardless of whether it lands.

## Pointers

- `.claude/rules/no-directives.md` — source ≠ authorization; the gated classes; standing
  authorization vs. fresh human authorization for gated acts.
- `.claude/rules.bak/non-reversible-action-get-a-second-opinion.md` — the sibling gate.
- PR #15676 — the fleet's own disclosure that a false trailer reaching `main` cannot be
  cleanly undone; appending a weaker block afterward is a known laundering path. The
  reason close-before-merge beats fix-after-merge.
