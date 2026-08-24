# A maintenance commit on another agent's branch carries no AgencySignature block

Carved sentence:

> A maintenance commit on **another agent's branch** carries **no** AgencySignature
> block when it makes **no content decision** — a clean merge from `main`, a
> mechanical rebase. Silence asserts nothing, and asserting nothing is the honest
> record; **never copy the branch's block** to look compliant. A maintenance commit
> that **does** decide content — resolving a conflict, fixing a lint — is authored
> work: sign it **as yourself** with your own honest values (measure
> `Credential-Mode` from the live credential; degrade to `unknown` rather than
> assert a convenient one). If that honest block then disagrees with the branch's on
> a governance key, **the disagreement is true** — hand the PR back to its owner.
> That is the mechanism working, not failing. **One exception, and only one:**
> `Action-Mode` describes how ONE COMMIT was made rather than what the change
> claims, so a branch's `human-directed` plus your honest `autonomous-*` is two
> true statements, not a contradiction — it **reconciles to the weakest claim**
> and needs no hand-back. `Human-Review` and the rest still do.

## Why

You do not need to assert `Credential-Mode: dedicated-agent` or `Human-Review:
explicit` to merge `main` into someone else's branch — and you must not. The
validator already permits the honest path: `findAllSignatureBlocks` keeps whole
paragraphs carrying all ten keys, `detectBlockDisagreement` returns `null` below two
blocks, so a blockless commit contributes **zero blocks and zero disagreement**. Git's
default `Merge branch 'main' into X` message passes today, unchanged.

That path was **accidental** until 2026-08-18 — nothing asserted it — so a future
tightening ("every commit must be signed") would have deleted the only honest
maintenance route and forced maintainers to choose between lying in a trailer and
leaving PRs stuck. It is now pinned by falsifiers in
`agencysignature-block.test.ts` §MAINTENANCE COMMITS, and the `Action-Mode`
exception by §ACTION-MODE RECONCILIATION in the same file.

The other half cannot be pinned by a test, which is why it is written here: **the
parser cannot distinguish a copied attestation from an earned one** — a copy is
byte-identical to the original, so two identical blocks pass and always will. Only
this rule stops the copy.

## Pointers

- `src/Core.TypeScript/hygiene/agencysignature-block.ts` — `findAllSignatureBlocks` · `detectBlockDisagreement` · `GOVERNANCE_KEYS` (five keys; four are loud on disagreement, `Action-Mode` reconciles to the weakest claim — §THE THIRD CASE: RECONCILABLE)
- `src/Core.TypeScript/hygiene/agencysignature-block.test.ts` §"MAINTENANCE COMMITS" — the falsifiers, including the stated admission that a copy passes
- `src/Core.TypeScript/agent-heartbeats/merge-heartbeats-to-main.ts` `heartbeatMergePrBody` — the worked example of the second half: signs as itself, infers `Credential-Mode` from `gh api user`, degrades to `unknown`
- [`no-directives.md`](no-directives.md) — source ≠ authorization; the shadow may **inherit** authority, never **extend** it. A copied block is extension.
- `docs/research/2026-04-26-gemini-deep-think-agencysignature-commit-attribution-convention-validation-and-refinement.md` §7.4 (canonical shape) · §7.5 (Identity Demarcation Rule)
