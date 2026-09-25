# USB installer — first-boot reliability on real hardware

Status: active trajectory
Last refreshed: 2026-09-25
Current blocker: none. One end-to-end verification in flight (see §Open).
Next concrete action: read §Open, pick the highest row, and re-run the lane that owns it.

The maintainer's question, verbatim, is the thing this trajectory exists to answer:

> *"we are not 100% certain which of the applications on the helm will start up
> correctly, if the ordering will cause issues … i need to be highly confident that
> if i plug it in and run it then it will reliably do so and without having
> applications crash loop or not start successfully."*

Everything below is organised around **what is measured** versus **what is not**. Do
not promote a row from the second table to the first without a run that says so.

---

## 1. Where the answer stands

On the installed-disk lane (`WP11 — installed-disk first-boot k3s verify`,
dispatch/schedule only), on a real ISO installed to a real disk:

| verdict | measured |
|---|---|
| 1 bootedMultiUser | true, 0s |
| 2 k3sServiceActive | true, ~20s |
| 3 nodeReady | true, ~60s |
| 4 helmJobs | all seven bootstrap charts complete, `failedAttempts=0`, ~145s |
| 5 rootLanded | true, `crdSeen=true`, ~145s |
| 6 noBadPods | true, soaked to a measured 180s bound |
| 7 rosterConverged | **false** — 25/49 Synced+Healthy, 4 excluded, 20 unfinished |

Verdict 7 is the honest one. On the CI guest the roster does **not** fully converge —
and on run 36117868219 a grep for `Evicted|OOMKill|MemoryPressure|DeadlineExceeded|Liveness probe failed`
returned **0**. Nothing crash-loops; there is simply not enough machine. The guest is
4 vCPU / 12 GiB (the GitHub runner is itself 4 vCPU, a hard ceiling); the registered
ClusterNodes are 16–22 cores / 66 G.

**On a memory-constrained node applications DO crash-loop**, and the mechanism is
measured, not inferred (constrained replica lane, dispatch 36119931377):

> memory pressure → containers slow → **liveness probes time out** → the kubelet
> SIGKILLs them → restart → more pressure

61 kubelet `failed liveness probe, will be restarted` events over 28 containers, six
exits of 137 with `Reason: Error`, zero `OOMKilled`, zero `Evicted` — the probes kill
these containers *before* the OOM killer reaches them. `coredns` and `metrics-server`
are among the 28 and are the node's own **floor**, so an unknown share of the other 26
are downstream victims. **Fix the floor first, re-measure, then the remainder.**

---

## 2. The lanes, and which question each answers

| lane | where | answers | cost |
|---|---|---|---|
| `first-boot replica` (unconstrained) | `first-boot-replica.ts`, PR path | is the roster internally consistent? | ~65 min |
| `first-boot replica --constrained` | same file, schedule/dispatch | does it converge under contention? | ~60 min |
| WP11 installed-disk | `build-ai-cluster-iso.yml`, dispatch/schedule | does a real install come up? | ~90 min |
| `k3s-first-boot-roster` / `control-plane-host-boots-k3s` | nixosTest | bootstrap charts in a clean VM | green on main |
| `live kind included Synced+Healthy` | kind | Applications reach Healthy | green |

**The unconstrained replica is systematically optimistic about CPU.**
`buildDockerRunArgs` sets no `--cpus`, no `--memory`, no `--cpuset-cpus` — the
container gets the whole runner with no hypervisor tax. A green there means the roster
is internally consistent, **never** that it converges on constrained hardware. That is
why the constrained mode exists.

---

## 3. Defects found and fixed (each with a before/after)

| defect | evidence |
|---|---|
| Zero-length k3s credentials after an unclean stop wedge the node forever (k3s refuses to regenerate a file that exists) | `error loading key from` **119 → 0** |
| CI killed the *emulator*, not the guest — page cache discarded, ext4 delayed allocation produced those zero-length files | teardown `graceful` 2.5s, guest kernel `reboot: Power down` |
| An artificial second boot left a **stillborn datastore**; k3s will not initialise into a non-empty one, and no reboot recovers it | one first boot; plus a has-ever-bootstrapped sentinel for the metal case |
| Longhorn got a **1 GiB** pool against **943 GiB** of claims on the default single-disk install | **1 GiB → 607 GiB** schedulable |
| ESP injections (SSH keys, hostname, wifi, firstboot conf) lost on ~half of real installs | fix *exercised*: 2 of 6 lanes took rung 4 in one run, both on `boot-medium=/dev/sda` |
| ArgoCD control plane ran **BestEffort** — nine containers, `cpu.weight` 1 of 507 | API unreachability **23% → 0 of 90 samples** |
| Four charts rendered **non-deterministically** (regenerated Secrets / a fresh-identity hook Pod) — perpetual churn under selfHeal | render-twice census, baselined |
| First boot depended on GitHub's **60/hour per-IP** attestation API; behind a NAT it fails closed with a Rust stack location | the failure now names the rate limit and its reset |
| 134 first-boot images span **eight registries**; the cache covered **one** | 26 bootstrap images preloaded; proven with every registry blackholed |

### The ESP defect is worth understanding before touching anything near it

An isohybrid ISO's MBR partition 1 starts at **LBA 0** and spans the whole image, so
`/dev/sda` and `/dev/sda1` expose the same iso9660 with the same `ZETA_INSTALL` label.
`by-label` resolves to whichever udev processed last. When it lands on the whole disk,
the boot medium is mounted from `/dev/sda`, which holds it `O_EXCL` — and **every
partition of it is unopenable for the rest of the install**. Not a CI defect: a real
USB stick is the same image with the same race.

Work item `081M3B7Z38Q087G0R003F9X7HM` proposes deleting the ambiguity at source
(xorriso/isohybrid) rather than routing around it. The mtools rung is a workaround and
the item says so.

---

## 4. Open — do not treat any of these as done

| what | why it matters | where |
|---|---|---|
| **Does the roster converge on 16–22 core / 66 G hardware?** | the only substrate that matters and nothing here can reach it | unmeasurable in CI; needs the maintainer's box |
| Fix the node **floor** (coredns, metrics-server), then re-derive liveness budgets | 26 of the 28 may be downstream symptoms | `liveness-kill-budget.ts`; keda's 3→20 is the worked precedent |
| Scenario 3/4 end-to-end — **reflashing over an existing install** | the last ordinary operator path with no evidence | dispatch 36140151239 was in flight at handoff; PR #17683 merged the fix, the run had not reported |
| `weaviate` stuck `Synced`/`Progressing` | last unexplained app; conditions array is **empty** | cilium's `ExcludedResourceWarning` cause was ruled out |
| Bootstrap-or-join **discovery has never run** | `probe.ts:83` passes `--no-db-lookup`, which this avahi-browse rejects | `081M39K8ND1087G0R000G4EN4N` |
| `k8s/bootstrap/` has **no inert-key coverage** | the manifests that run first, before ArgoCD exists to correct anything | `081M3BTKNNB087G0R000EPCNJ1` |
| A full `workflow_dispatch` intermittently loses **every** ESP injection | root cause found; the ambiguity itself is not deleted | `081M39CJP96087G0R001T4J2R3` |
| `openbao` / `hindsight` have no machine-readable "needs an operator action" declaration | they are neither manual-sync nor broken; the convention lacks a word | `081M3BKQFNC087G0R003MDGSAX` |
| Which half of the capacity fix produced the reachability result | #17666 bundled pod requests *and* node reservations; one pair cannot separate them | needs a run with one applied |

---

## 5. Operational traps — every one of these cost real time

- **`gh api ... per_page=100` silently truncates.** This repo has >100 check-runs on a
  PR. A truncated page reads as "pending". Always `--paginate`.
- **Boolean dispatch inputs need `-F`, not `-f`.** `gh workflow run … -F only_wp11=true`.
  See `docs/ops/WP11-SCOPED-DISPATCH.md`.
- **A `workflow_dispatch` on `main` is evicted by any merge to main** — the concurrency
  group is keyed on workflow + ref, and only the newest *pending* run per group survives.
  Push a branch at main's tip and dispatch on that ref instead.
- **`git push origin <branch-name>` pushes the NAMED REF, not your HEAD.** Committing
  onto a foreign HEAD and pushing by name reports success and pushes nothing. Use
  `git push origin HEAD:<branch>`.
- **On Windows, `rm -rf` and `git worktree remove --force` follow a directory junction
  and delete the target.** One agent emptied the shared `node_modules` this way.
  `cmd /c rmdir <link>` removes the link only.
- **One agent per worktree.** Three collisions happened in one session; one nearly
  landed another agent's work under the wrong AgencySignature trailer inside a squash.
- **Push early, always.** Three separate rescues in one session depended on it.

---

## 6. The discipline that found most of this

Thirteen instances in one session of a single defect class, three of them *inside*
machinery written to catch it:

> **A check whose FAILURE and whose ABSENCE are indistinguishable** — and its mirror,
> **taking a string at face value without checking what produced it** (reading a hint as
> a disambiguator; reading an absence as a state).

Examples: `noBadPods=true` over an empty pod list; a 100-minute timeout that meant "the
verdict unit never ran"; `mdir ::` exiting 0 on an image truncated to 1 MB; a detector
whose two branches returned the same value, so the writer and the verifier confirmed
each other; a mutation check that passed 15/15 against an *unmutated* file because the
`sed` never matched; `wc -l` printing `0` on a failed probe so an "unknown" marker could
never print.

**The tell, both times it was caught: a result that was too clean.** A case that should
have occurred never did.

Three rules that follow, and that this trajectory's work applied throughout:

1. A check must make **three** states distinguishable in its output — passed, failed,
   **did not run**. The third is the one people forget.
2. A verification must not address the same value as the thing it verifies, or it
   confirms itself.
3. A negative control is not optional. The bootstrap-image preload found **six** defects
   only because the test also ran with an empty images directory and had to go red.

A rule proposal carrying all ten original instances is queued as a task chip
("a string at face value is not a measurement"). It has not been written.

---

## 7. Evidence links

Runs worth keeping (artifacts expire — pull what you need before they do):

- `36117868219` — installed disk, post-capacity-fix: 25/49, exclusions verified, 0 API failures
- `36114004943` — installed disk, pre-fix: 12/43, roster incomplete, 9/39 API failures
- `36097366591` — ESP fix exercised: 2 lanes on `/dev/sda` carried by rung 4, WP11 6/6
- `36119931377` — constrained vs unconstrained on one commit: 35/5/2 → 22/3/17
- `36002885823` — Docker replica, full stage table including power-cut recovery
- `35960376641` — the `main` control: `k3sServiceActive=false` at 4202s, 119 `<nil>` errors

Work items: `081M39CJP96087G0R001T4J2R3` · `081M3B7Z38Q087G0R003F9X7HM` ·
`081M39K8ND1087G0R000G4EN4N` · `081M3BPJNRS087G0R0008WFXBZ` ·
`081M3BWJ96T087G0R0028WT3S3` · `081M3BTKNNB087G0R000EPCNJ1` ·
`081M3BKQFNC087G0R003MDGSAX` · `081M3CAJD7J087G0R0021H6WRS` ·
`081M3C10FFX087G0R0033DYXG0`
