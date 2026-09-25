---
id: 081M3BKQFNC087G0R003MDGSAX
type: task
state: backlog
priority: P2
slug: the-sync-policy-convention-needs-a-second-value-not-a-wider
title: "The sync-policy convention needs a SECOND VALUE, not a wider bucket: converges-only-after-an-operator-action"
created: 2026-09-25T06:23:32.012Z
depends_on: []
composes_with: []
---

# The sync-policy convention needs a SECOND VALUE, not a wider bucket: converges-only-after-an-operator-action

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3BKQFNC087G0R003MDGSAX-*.md` glob. -->

## The gap, stated as a vocabulary gap rather than a classification gap

`manual-sync-policy.ts` gives the tree ONE machine-readable escape from the
full Synced+Healthy contract:

    zeta.io/sync-policy: manual
    zeta.io/sync-policy-reason: "<why, non-empty>"

That value means exactly one thing: **an operator must run `argocd app sync`,
and nothing in an automated lane ever will.** `cdi`, `kubevirt`, `ollama` and
`vllm` are all genuinely that.

**`openbao` and `hindsight` are NOT that, and there is no word for what they
are.** Measured 2026-09-25 by the Docker-replica lane's stage 6 (42
Applications: 35 Healthy, 5 DIVERGENCE, 2 FAIL):

| app | why it does not converge on a fresh cluster |
|---|---|
| `openbao` | **sealed by design.** The chart syncs; the workload comes up sealed and stays that way until someone unseals it. |
| `hindsight` | **needs an external API key** no fresh cluster can hold — it is on `INJECTION-POINTS.md`'s `**EXTERNAL**` roster. |

Both are *synced*. Neither is waiting on `argocd app sync`. Both are waiting on
an **operator action of a different kind**. So:

> **The convention needs a SECOND VALUE, not a wider bucket** — something like
> `zeta.io/sync-policy: operator-action` with a required reason, meaning
> *converges only after an operator action, and it is not a sync*.

Widening `manual` to cover them would destroy the distinction rather than
express it: a checker reading `manual` could no longer tell "nobody will sync
this" from "this is synced and waiting on a human", and the two need different
assertions. `manual` gets `manualSyncAssertion`'s weaker contract (comparison
completed + health `Missing`|`Healthy`); an `operator-action` app should be
asserted *more* strongly than that — it IS applied, so it must be `Synced`, and
only its HEALTH is permitted to lag.

## Why the obvious shortcut is wrong

`full-ai-cluster/INJECTION-POINTS.md`'s `## In-cluster catalog Secrets` table
already marks rows `**EXTERNAL**`, and `first-boot-replica.ts` already parses
it (`ExternalSecretCatalogEntry`). It is tempting to read that table instead of
inventing an annotation.

It does not work for WP11's verdict 7 (081M3BEGSQR087G0R003610CGB), which is
where this gap was found: that verdict runs **on an installed disk with no repo
checkout**, so the table would have to be baked into the image at Nix eval
time. That creates a **second, separately-drifting copy of a roster** — the
defect class this repo has paid for repeatedly. An annotation on the
Application travels with the live object, which is why verdict 7 reads
`zeta.io/sync-policy` off the cluster rather than off the tree.

## Consumers to update when the second value lands

- `src/Core.TypeScript/cluster/manual-sync-policy.ts` — `classifySyncPolicy`
  gains the value and its own assertion; the three existing refusals apply to
  it unchanged (no reason, coexisting `automated:`, unclaimed omission).
- `full-ai-cluster/nixos/modules/zeta-first-boot-k3s-verify.nix` — verdict 7's
  awk classifier gains an `excluded-operator-action` bucket. It already reads
  the annotation value off the live object, so only the classification arm is
  new.
- `src/Core.TypeScript/cluster/first-boot-replica.ts` — stage 6 can then
  classify these two from the declaration instead of from a hand-maintained
  divergence list.
- `full-ai-cluster/k8s/applications/{openbao,hindsight}/Application.yaml` — the
  declarations themselves.

## Until it lands

Verdict 7 reports both as `unconverged`, named on serial with their last
Sync+Health state. That is deliberate and must not be "fixed" by widening a
bucket — see the WHAT THIS DELIBERATELY DOES NOT EXCLUDE section of
`zeta-first-boot-k3s-verify.nix`.

## Origin

081M3BEGSQR087G0R003610CGB (WP31), PR #17656 — found by cross-checking verdict
7's DERIVED exclusion set against the Docker replica's MEASURED one. The two
agreed on four Applications and differed on three, every difference in the
conservative direction.
