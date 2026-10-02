# Dispatching the WP11 installed-disk lane on its own

`build-ai-cluster-iso.yml` is the heaviest lane in the repo. A plain
`workflow_dispatch` runs every dispatch-only QEMU scenario — several of them
90–100 minutes each — before it reaches WP11, the installed-disk first-boot k3s
verify. Iterating on WP11 through a full dispatch costs hours of unrelated QEMU.

`only_wp11` exists to narrow that. This page is how to pass it and, more
importantly, **how to confirm it took**.

## The command

```bash
gh workflow run build-ai-cluster-iso.yml --ref main -F only_wp11=true
```

**`-F`, not `-f`.** `gh workflow run` sends `-f` values as strings and `-F`
values as typed JSON. The input is declared `type: boolean` and is read in the
workflow as `inputs.only_wp11`, so pass it typed.

## A dispatch on `main` can be EVICTED by any merge to `main`

Learned the expensive way, twice in one night (WP25 and WP29 each lost a run to
this before either of us understood it). It is not guessable from the workflow
file, so it is written down here.

The workflow's concurrency group is:

```yaml
concurrency:
  group: build-ai-cluster-iso-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
```

`github.ref` is `refs/heads/main` for a **dispatch on main** _and_ for **every
push to main**, so they share one group. `cancel-in-progress` is `false` for
both, which correctly protects a RUNNING run — but GitHub keeps only the
**newest PENDING run per group** and cancels older queued ones. So a dispatch
that is queued behind a push gets evicted the moment the next merge to `main`
lands. On a busy evening that is minutes.

Measured: run 36090644178 (`workflow_dispatch` on `main`, 03:30:38Z) sat
`pending` behind a push from 03:27, and was `cancelled` at 03:46:53Z when the
next merge arrived. Three hours of QEMU, never started.

**The workaround — push a ref and dispatch on that:**

```bash
git fetch origin main
git push origin origin/main:refs/heads/<you>/<purpose> -f
gh workflow run build-ai-cluster-iso.yml --ref <you>/<purpose>
```

A different `github.ref` is a different concurrency group, so merges to `main`
cannot evict it, and the tree is byte-identical to `main`'s tip. Delete the ref
when the run is done. Note the run is then attributed to that branch rather
than to `main`, which is a small price and makes it easier to find afterwards.

Corollary for anyone watching a dispatch: a run in `pending` is not safe. Check
`.status` and `.conclusion`, not just "did it finish" — an evicted run reports
`completed/cancelled`, which reads like someone cancelled it on purpose.

## Confirm it took — do not assume

A dispatch input that did not take looks exactly like one that did until you
read the step list, and that is a ~3-hour difference. Read the step
conclusions over REST (`gh pr view` / `gh run view` are GraphQL, which is the
contested budget — see
[`rest-is-the-default-transport-graphql-is-the-contested-budget`](../../.claude/rules/rest-is-the-default-transport-graphql-is-the-contested-budget.md)):

```bash
run=<run id>
gh api "repos/Lucent-Financial-Group/Zeta/actions/runs/$run/jobs" --paginate \
  --jq '.jobs[] | select(.name=="build-iso") | .steps[] | "\(.conclusion)\t\(.name)"'
```

**`--paginate` is not optional on this repo, and the failure is silent.** A PR
here can carry well over 100 check runs, and `per_page=100` without
`--paginate` returns one page — a query filtered to a check that happens to
fall on page 2 comes back EMPTY, which reads exactly like "not reported yet".
Measured: WP30 read an empty single-page result as `pending` for eighteen
minutes on a PR with 110 check runs. Paginate every `check-runs` and `jobs`
query, or a check you are waiting on can be green and invisible.

A scoped dispatch must show `skipped` for:

- the seven pre-ISO-build NixOS test steps (control-plane cluster-init, node
  platform fixes, agent join, cluster-CIDR/server-join eval, second control
  plane, dirty-disk fail-closed, cluster-online) and the longhorn-volume-binds
  step,
- `UEFI keyfile restore decrypt`, `wifi ESP acceptance`, `UEFI keyfile
install-time write`, `UEFI keyfile picker bind`, scenarios 3 and 4, and each
  of their upload-serial-log siblings.

It still runs the ISO build, the boot discriminator, scenario 1, scenario 2 and
WP11 itself. Those are not gated by `only_wp11`.

## Why this page exists

081M39CJP96087G0R001T4J2R3 (WP29). `UEFI keyfile restore decrypt` carried
`if: github.event_name == 'workflow_dispatch'` with the `&& !inputs.only_wp11`
half **missing**, while its own upload-serial-log sibling three lines below had
it. Measured on run 36044770870, dispatched with `only_wp11`: every other
dispatch-only step reported `skipped`, that one ran for 15m 48s, and then its
log upload skipped — so a scoped probe paid a quarter of an hour for a lane it
had not asked for _and_ the failure it produced could not be read afterwards.
Run 36014672753 did the same thing four hours earlier.

Both halves are fixed. The step list is still the thing to check, because the
next input that silently does not take will look identical to this one.

## Getting the ISO without waiting for the scenarios: `publish_iso_early`

Measured, run 36907804039: `Build installer ISO` finished at 19:03 and the ISO
was published at 21:54, because `Locate ISO` / `Sign ISO` / the artifact uploads
sit at the END of the job, behind ~2h50m of dispatch-only QEMU scenarios. The
owner waited ~3.3 h for an artifact that existed after ~30 min.

```bash
gh workflow run build-ai-cluster-iso.yml --ref <branch> -F publish_iso_early=true
```

**`-F`, not `-f`**, for the same reason as `only_wp11` (boolean input; `-f`
sends a string). Default is `false`: every PR, push, schedule and plain dispatch
publishes at the end of the job exactly as before.

What it does when `true`:

- Locate ISO, cosign sign (keyless, same workflow-file identity), and the three
  uploads (the ISO, `<iso>.sha256`, `<iso>.cosign`) run **immediately after
  `Audit installer ISO content`** — i.e. after the build-time floor (ISO name,
  bootstrap archive, provenance pin, ISO-content audit) and **before** the first
  QEMU scenario. Same artifact names as the end-of-job copies.
- The end-of-job copies are skipped (exactly one copy runs, so no
  artifact-name collision).
- The scenarios still run afterwards and still decide the job's conclusion. The
  run's step summary carries: _ISO published BEFORE the dispatch-only scenarios
  ran: treat the run conclusion as the verdict on this ISO._ A published
  artifact on a **red** run has not passed the scenarios.
- If the early publish itself fails, the scenarios still run (the early steps
  are `continue-on-error`), no second copy is attempted, and the job is failed
  at its end by `Early ISO publish must have succeeded`.
- If the floor fails before the early copy can start, nothing is published
  early and the end-of-job copy runs as it always did.

It composes with `only_wp11` (`-F only_wp11=true -F publish_iso_early=true`).

Confirm it took the same way as above — read the step conclusions over REST
and require the six `(early publish)` steps to say `success` and the six
end-of-job `Locate ISO…` / `Install cosign` / `Sign ISO…` / `Upload…` steps to
say `skipped`. The artifact should appear within minutes of the build, not
hours: list `repos/Lucent-Financial-Group/Zeta/actions/runs/<run>/artifacts`.

Pinned by `src/Core.TypeScript/ci/build-ai-cluster-iso-publish-early.test.ts`,
which simulates the job's real `if:` expressions per event/input/failure.
