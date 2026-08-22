# full-ai-cluster/k8s validation baseline

<!-- Machine-readable. The ratchet parses EXACTLY this line; keep the format. -->

    BASELINE_FAILURES: 13

**Measured:** 2026-08-22 · **at commit:** `the four unrenderable Applications fixed (this PR)`
**Previous:** 18, `temporal datastore wired to CockroachDB` (#13469)
**Toolchain:** helm `v4.2.0+g0646808` · kubeconform `v0.7.0` · bun `1.3.14` · `--kube-version 1.33.0`
**Reproduce:** `bun infra/k8s/tests/ratchet-app-failures.ts` (it prints the count it measured)

## What this number is

A **debt ceiling**, not a target and not a pass mark. The `full-ai-cluster/k8s`
tree does not validate clean, and there are only three honest ways to wire a
lane at it:

| option                    | why it was rejected                                                                                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| plain step, no ratchet    | permanently red; a lane that is always red is a lane people learn to skim, so it stops carrying signal exactly when it matters                                         |
| `continue-on-error: true` | can never fail. It permits anything, including a regression to 200 failures. That is the vacuity class in its purest form: a check that reports and constrains nothing |
| **ratchet (this)**        | fails on regression, and fails on unrecorded improvement. Never green-by-permission, never ignorable-red                                                               |

## Both directions are load-bearing

The step fails on any count that is **not exactly** `BASELINE_FAILURES`.

- **More** failures than baseline → a regression was introduced. Obvious half.
- **Fewer** failures than baseline → a real improvement that nobody recorded.
  This also fails, and that is the half that keeps the number honest. A ceiling
  that only ever moves _up_ rots into a figure nobody believes; forcing the
  commit means this file's `git log` **is** the record of the tree getting
  better, and the date above is always the date the number was last true.

Lowering it is one line, and the ratchet prints the exact delta and the new
number to write when it refuses.

## Composition of the 13 — measured, not estimated

| n   | class                                                                                                                                                                                                                                                                                                                                                      | verdict                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| 13  | ArgoCD contract: missing `syncPolicy.automated.prune` / `.selfHeal`, or `CreateNamespace=true` absent from `syncOptions`                                                                                                                                                                                                                                   | **real** — but read the caveat |
| 0   | _(empty — kept as the ledger of what left it.)_ `oz` LEFT 2026-08-22, taking **2** with it (version check + render): it pinned `ziti-controller` **1.4.5**, which openziti has never published — its 1.x line ends at 1.3.4 and `1.4.x` exists there only as an _appVersion_. Corrected to **3.1.1**, the newest chart still on appVersion 1.7.2, so the pin moves as far forward as it can WITHOUT changing which OpenZiti server runs (3.2.1 is appVersion 2.0.1 and additionally requires `cluster.mode`). Measured across 1.3.4 / 2.1.2 / 3.1.1 / 3.2.1: every key this manifest sets survives all three majors and the storage contract is identical, so the earlier "not drop-in" reason for deferring did not hold. The render half needed a second fix the bad pin had been hiding — `clientApi.advertisedHost`, required by every published version | **cleared**, both fixed        |
| 0   | _(empty — kept as the ledger of what left it.)_ `sealed-secrets` LEFT 2026-08-21: repoURL moved `bitnami-labs` -> `bitnami`, corrected, both failures with it. `forgejo` LEFT 2026-08-21: `https://code.forgejo.org/forgejo-helm/` is an organisation page whose `index.yaml` 404s and the chart is OCI-only, so the source became the bare `code.forgejo.org/forgejo-helm`; and the pin `9.0.6` was never published (169 tags, exactly one 9.x — `9.0.0`), so it moved to `17.1.5` (Forgejo 15.0.7). Both of its failures — version check and render — went with it | **cleared**, both fixed        |
| 0   | _(empty — kept as the ledger of what left it.)_ **"the chart refuses to render with the values we hand it" IS NOW AN EMPTY CLASS.** All four left on 2026-08-22 and not one was a limitation of the renderer — every one would have failed inside ArgoCD in the same place. `temporal`: refused with "Please specify cassandra port for default store" because its `valuesObject` disabled the bundled Cassandra without naming a replacement; both stores are now wired to the CockroachDB already in the cluster over `postgres12` (#13469). `gitlab`: needed `global.ingress.configureCertmanager: false`, which `certmanager.install: false` does NOT imply — the sibling gitlab Application in the other cluster tree already carried it, which is exactly why that one rendered. `headscale`: passed `persistence.data`, a key the chart mounts at `/data` and never writes to, with no `accessMode`; renamed to the chart's own `persistence.config` (mountPath `/etc/headscale`) so the volume is where the sqlite DB and both private keys actually live. `arc-runner-set`: the chart discovers the `gha-rs-controller` ServiceAccount with `lookup` at template time, and ships `controllerServiceAccount.{name,namespace}` to skip it — BOTH keys, since `name` alone then fails on the namespace lookup | **cleared**, all four fixed    |

Per-app split of the 13: `cdi` 3, `kubevirt` 3, `forgejo` 2, `ollama` 2,
`vllm` 2, `cilium-lb-ipam` 1. (`forgejo` keeps its 2 here: it is the
manual-sync standby half of the `gitlab`/`forgejo` pair, so its missing
`automated:` block is the documented convention, not a defect — see the caveat.)

> **Caveat on the 13 — do not "fix" them blindly to lower this number.**
> `root-application.yaml`'s own header documents an either/or gating convention:
> some directories ship alternatives (`gitlab` vs `forgejo`, `ollama` vs `vllm`)
> and _"alternatives omit an `automated:` block (manual sync only)"_ **on
> purpose**. Where that is the intent, the manifest is correct and the
> **validator** is what needs to learn the convention. Adding `automated:` blocks
> to make the number go down would silently switch manual-sync alternatives to
> auto-syncing — turning a reporting problem into a cluster change.

## Why it opens at 23 and not the 29 that was first measured

The first measurement of this tree was **305 passed, 29 failed**. **Seven of
those 29 were validator-scope artifacts, not manifest defects**, and both causes
were fixed in `validate-applications.ts` in the same commit as this file:

1. **Six** from the three OCI-registry apps — `arc-controller`,
   `arc-runner-set`, `hindsight`. Their `repoURL` is a bare
   `ghcr.io/...` host, which is ArgoCD's convention for an OCI source. The
   validator was fetching `<repoURL>/index.yaml` (meaningless for OCI: registries
   do not serve a Helm repo index) and running `helm template --repo ghcr.io/...`
   (`could not find protocol handler`). Now: OCI is detected by the absence of a
   URL scheme, existence is checked with `helm show chart oci://...`, and the
   render addresses the chart as a single `oci://host/path/chart` argument.
2. **One** from Test 6 looking for `root-application.yaml` under `applications/`.
   This tree keeps it in `bootstrap/`, because k3s applies it at first boot and
   it must sit on the `services.k3s.manifests` roster. New `--root-app` flag.

The OCI fix **added one genuine failure it had been masking** — `arc-runner-set`
now renders far enough to fail on real values. `29 − 7 + 1 = 23`. It has since
come down four times, each time by correcting a real manifest: `23 − 2 = 21`
(`sealed-secrets`, PR #13339), `21 − 2 = 19` (`forgejo`), `19 − 1 = 18`
(`temporal`, a render failure cleared by giving the chart the datastore it was
never told about), and `18 − 5 = 13` — this file's current measurement — from
the four Applications that would not render at all: `oz` (2: a pin no registry
has ever served, plus the missing `advertisedHost` behind it), `gitlab`,
`headscale` and `arc-runner-set` (1 each).

**Note what the last drop was made of.** All five were defects in our own
manifests, and four of them had been sitting behind an app the storage checker
reported as UNRENDERABLE — a state in which nothing about the app is verified
and nothing about it is refuted. 106 GiB of declared storage sat behind those
four. That is why an unrenderable app is worse than a failing one: a failure is
a measurement, and this was the absence of one.

That is the point of fixing the validator before setting the baseline: a
baseline that banks false reds is a number that can be "improved" by fixing
nothing.

## Not covered here

Only `validate-applications.ts` against `full-ai-cluster/k8s/applications`.
The bootstrap set in the same tree is checked by
`validate-bootstrap.ts --infra-dir full-ai-cluster`, which sits at **52 passed,
0 failed** and is a **hard gate with no ratchet** — it carries no debt to
amortise, so it simply has to stay green.

## Known measurement hazard — the count is not perfectly stable

Measured 2026-08-20: two identical runs minutes apart returned **23** and **24**
failures. The extra entry was **helm itself crashing** while rendering `redis` —
a Go runtime panic (`pointer to unallocated span ... span.state=0`), not a
manifest defect. This machine was also under heavy concurrent load at the time.

The ratchet handles this narrowly and visibly rather than by loosening the
comparison: when the first measurement disagrees with the baseline it takes a
**second** one. Two runs that **agree** are believed, whatever they say. Two runs
that **disagree** are reported as `MEASUREMENT NOT TRUSTED` (exit 2) with the
exact entries that moved — never a pass. It stops at two, so it cannot retry
until the number is convenient.

If that exit-2 path starts firing regularly, the flaky entry deserves its own
ticket. An unstable gate decays into an ignored one just as surely as a
permanently-red one does.
