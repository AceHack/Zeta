---
id: 081M00J3WD2087G0R00149C8ZD
type: task
state: done
priority: P1
slug: helm-validate-could-not-go-red-real-yaml-parse-exact-chart-v
title: "helm-validate could not go red: real YAML parse, exact chart-version resolution, helm template + kubeconform, daily cadence"
created: 2026-08-14T16:36:36.898Z
completed: 2026-08-17T14:42:10.248Z
depends_on: []
composes_with: []
---

# helm-validate could not go red: real YAML parse, exact chart-version resolution, helm template + kubeconform, daily cadence

## What was wrong

`helm-validate` was the only gate over `infra/k8s/` — the GitOps tree ArgoCD
syncs onto real hardware. Three of its checks could not go red. Measured
2026-08-14 against the pre-change validator:

| Mutation                                                             | Expected | Actual                                       |
| -------------------------------------------------------------------- | -------- | -------------------------------------------- |
| Manifest with tab indent, unterminated quote, unclosed flow sequence | red      | `PASS: orleans/Application.yaml: valid YAML` |
| Duplicate `destination.namespace` key (API server rejects)           | red      | `37 passed, 0 failed`, exit 0                |
| `targetRevision: 999.999.999` on the cockroachdb chart               | red      | `44 passed, 0 failed`, exit 0                |

Root causes: a ~120-line hand-rolled YAML parser that never threw (it skipped
any line it did not understand), and a chart check that was
`index.yaml.includes("name: " + chart)` — a substring match that never looked
at the pinned version.

Compounding: the chart check only ran on push-to-main and a **weekly** Monday
cron, never on a pull request. Total run count of the whole workflow before
this change: **one** (2026-08-10). Aaron 2026-08-13: "it should be more often
than weekly on the k8s testing."

## What changed

- Validator rewritten on the `yaml` package with `uniqueKeys: true` — invalid
  syntax and duplicate keys are now parse errors.
- Chart check resolves the parsed repo index and requires an **exact** version
  match on the named entry, reporting how many versions are published and the
  newest one.
- New `--render` lane: `helm template` each chart with its real
  `valuesObject`, then `kubeconform -strict` over the rendered manifests.
- New `validate-applications.test.ts`: 12-case mutation suite that copies the
  real tree, breaks one thing, and asserts exit 1 with the specific reason —
  plus a control case asserting the unmutated tree exits 0.
- `parseArgs` `strict: false` -> `strict: true`; a typo'd flag was silently
  ignored and the run went green having checked nothing the caller asked for.
- Cadence weekly -> daily (`29 15 * * *`); chart checks now run on every PR.

## Proof it can go red

Stubbing out the validator's non-zero exit made **9 of 12** mutation cases fail
immediately; restoring it made all 12 pass. The bogus-version mutation now
fails in both lanes:

- Test 7: `chart 'cockroachdb' has no version '999.999.999' ... (110 published versions; newest 21.0.4)`
- Test 8: `helm template failed: Error: chart "cockroachdb" version "999.999.999" not found`

## Cost, measured

Offline validation 0.4 s; mutation suite 1.7 s; online version check 1.4 s over
~5 MB; `helm template` of all six charts 5.1 s; end-to-end `--render` 7.6 s.
Billable minutes zero (public repo, standard runners). There was never a cost
case for keeping chart validation off pull requests.

## Independent re-verification (2026-08-17, Otto/shadow)

The row above was still `state: backlog` after the fix merged as #10647, so it
read as available work. Re-verified from scratch before closing it — the claims
are **reproduced, not taken on trust**. `helm` 4.2.0 and `kubeconform` 0.7.0 were
both on PATH, so the `--render` lane ran end-to-end rather than being asserted.

Control, unmutated tree: `--offline` exit **0**, `37 passed, 0 failed`; full
`--render` exit **0**, `55 passed, 0 failed` (all six charts really pulled and
rendered). A validator that rejects everything would be as useless as one that
accepts everything, so both directions are pinned.

Each row of the original table, re-run against the current validator:

| Mutation | Exit | Reason reported |
| --- | --- | --- |
| Tab indent + unterminated quote + unclosed flow sequence | **1** | `YAML parse failed: Tabs are not allowed as indentation at line 37` |
| Duplicate `destination.namespace` (`orleans` → `hijacked`) | **1** | `YAML parse failed: Map keys must be unique at line 29` |
| `targetRevision: 999.999.999` on cockroachdb | **1** | `chart 'cockroachdb' has no version '999.999.999' … (110 published versions; newest 21.0.4)` |

**A confound was found and removed.** The first attempt at the syntax mutation
appended a second top-level `metadata:`, and it went red on *duplicate keys* —
not on the syntax. That is the same shape as the zflash allowlist whose cases
were all caught incidentally by a different rule. Re-run under a unique key, the
syntax defect fails on its own; only then is row 1 actually closed.

**Mutation testing of the fix itself**, which is what proves the guard is load-bearing:

- Validator's `process.exit(1)` → `exit(0)`: **12 pass / 0 fail → 3 pass / 9 fail**,
  independently reproducing the 9-of-12 figure claimed above. Restored → 12/0.
- `uniqueKeys: true` → `false`: **exactly one** test fails, and it is the
  duplicate-key case. A sharp falsifier, not a blunt one.
- `versions.includes(ref.version)` → the original `text.includes("name: " + chart)`:
  the bogus-pin tree prints `PASS: cockroachdb: cockroachdb 999.999.999 is published`
  and exits **0** — the historical defect reproduced live. This is the direct
  evidence that the exact-version comparison is what carries the check.

After each mutation the file was restored and `git diff --stat` confirmed empty.

## Deliberately not done

- `helm template` + `kubeconform` validate structure and schema, not
  semantics. `statefulset.replicas: "not-a-number"` renders `replicas: 0` —
  schema-valid, silently wrong. Only a live cluster notices no pod appears.
- The `lint (yaml/k8s)` job in `gate.yml` is still `continue-on-error: true`,
  so it cannot fail the gate. Its own comment says to flip it once clean for a
  few rounds; it has been clean since 2026-08-01. Left alone here to avoid
  colliding with concurrent work in `gate.yml` — separate one-line change.
- `infra/k8s/` still never reaches a live cluster in CI. The kind lane in
  `k8s-argocd-health-test.yml` is hardcoded to `full-ai-cluster/k8s/applications`.
