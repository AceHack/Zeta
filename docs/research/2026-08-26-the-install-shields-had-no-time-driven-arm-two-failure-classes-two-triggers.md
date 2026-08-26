# The install shields had no time-driven arm — two failure classes, two triggers

**Date:** 2026-08-26
**Author:** shadow (autonomous tick)
**Status:** implemented — seven shields gain a `schedule:`; nothing demoted, nothing migrated, no job containerized here
**Register:** `metered` (measured here, query stated) · `consistent with` (observed, not isolated) · `speculative` (a projection nobody has run).

---

## 0. The finding, which is larger than the fix

While designing the containerized job runtime I claimed that **48 install steps incidentally re-prove `tools/setup/install.sh` works on a fresh runner**, and that containerizing would give that coverage up. Aaron: *"we discovered it quicker than that lets make it right lol."*

Measuring it properly made the claim collapse in a more useful direction.

`metered`, parsing every install-carrying job on `main` at `89c8a23c40`:

| | count |
|---|---|
| `Install toolchain` steps across all workflows | 48 |
| **preceded, in the same job, by an `actions/cache` restore** of mise runtimes / apt archives / the .NET SDK | **33** |
| with no cache restore in the job | 15 |

**On a cache hit a warm install step never exercises the download path** — that is the cache's whole purpose, and `apt-archive-cache.ts` exists specifically to make those hits reliable. So 33 of 48 are proving that a *restored* toolchain still works.

And the other 15 are only cold relative to *our* caches. They run on a hosted runner image that already ships node, Python, Go, Java and .NET, against an apt mirror inside the same datacentre.

> **None of the 48 is a bare-machine proof.** The claim I made was not slightly optimistic; it was about a different thing.

The genuine bare-machine proof — an empty `ubuntu:24.04` plus `install.sh` and nothing else — belongs to exactly one family of workflows. And:

`metered` — **not one of them had a `schedule:`.** All nine were path-filtered `pull_request` + `push` only.

So the pre-existing gap is bigger than the one containerization would have opened, and it is live today: **the only checks that prove the installer works from bare metal fire solely when somebody edits the installer** — and the failure class they exist to catch never edits anything.

---

## 1. Two causes, two arrival processes, two triggers

This is DV2.0 change-rate partitioning applied to CI triggers. Two failure causes with different arrival processes get two triggers, not one compromise.

| trigger | catches | arrival process | why the other trigger cannot catch it |
|---|---|---|---|
| path filter (`pull_request` / `push`) | **our changes** to `tools/setup/**` | event-driven | — fires immediately, tied to the cause |
| **`schedule:`** | **upstream drift** — a mirror moving, a package disappearing, a channel or runner image updating under us | time-driven, **arrives with no commit** | a path filter never fires: there is nothing to filter on |

Splitting them is what makes the schedule *justified* rather than arbitrary. A cron added "to be safe" is cargo cult; a cron added because a named failure class has no other detector is a control.

### 1.1 The rule for which checks get a schedule

> **Schedule a check iff its outcome can change with no commit** — i.e. iff it reaches outside the repo.

Applied:

**Scheduled (7).** Each reaches outside, and the comment in each file names *what*:

| workflow | cron | what it reaches outside for |
|---|---|---|
| `docker-ubuntu-install-sh-test` | `11 3 * * *` | Ubuntu apt archive, mise release feed, every upstream tarball |
| `docker-ubuntu-jammy-install-sh-test` | `26 3 * * *` | the 22.04 apt archive, same download graph |
| `docker-nixos-install-sh-test` | `51 3 * * *` | the nixpkgs channel |
| `docker-windows-install-ps1-test` | `9 4 * * *` | the Windows package sources `install.ps1` uses |
| `macos-install-sh-test` | `24 4 * * *` | Homebrew formulae, mise feed, the macOS runner image |
| `wsl-install-sh-test` | `49 4 * * *` | the WSL Ubuntu-24.04 distro image + its apt archive |
| `gitbash-install-routing-test` | `56 4 * * *` | the Git-for-Windows build in the hosted runner image |

**Deliberately NOT scheduled (2), and this is the load-bearing half of the rule:**

- `installer-unit-tests` — `bun test` over committed TypeScript.
- `installer-repair-mode-existing-install` — `bun test` over a committed shell script (27 s).

Their inputs are **all committed**. A cron would re-run the same computation over the same bytes and could only ever report what the last push already reported. That is not a shield; it is a scheduled tautology, and scheduling it would dilute the roster with a check that cannot discover anything.

`metered` — the parser agrees with the classification. Running `expectationFromWorkflow` against the modified tree:

```
docker-ubuntu-install-sh-test              periodic 86400
macos-install-sh-test                      periodic 86400
wsl-install-sh-test                        periodic 86400
gitbash-install-routing-test               periodic 86400
installer-unit-tests                       on-change -
installer-repair-mode-existing-install     on-change -
```

### 1.2 Why daily

The drift being caught is a mirror, a channel, or a runner image moving — a **days-scale** process. Daily is the coarsest cadence that still surfaces it inside one work-window, which is the stated basis `factory-hygiene-audit-cadence.yml` already uses (`"37 14 * * *"`).

`mirror-to-fork.yml` runs 6-hourly, and it is **not** the number to copy: its cadence bounds the staleness of a *backup*, a different quantity. Its *principle* is the transferable part — *"a periodic artefact, not a synchronous write path"*, with the cadence chosen from what it is protecting against.

`metered` cost, for a **public** repo where standard hosted runners are free: mean observed durations are 7, 7, 5, 14, 4, 11 and 0.5 minutes — **≈48 runner-minutes per day**, once.

Minutes are odd and distinct per lane so the fleet's scheduled runs do not pile onto one minute and get dropped together under scheduler load. They avoid `:00/:15/:30/:45` (heartbeat), `:07/:37` (drift-sweep), and the `*/6` lanes at `:13/:23/:41`.

---

## 2. Loud, not an inbox — and the loudness needed no new wiring

**A scheduled check nobody reads is the vacuity class wearing a cron expression.** These are non-blocking by Aaron's tiering rule (they cannot bring their toolchain in an image — they *are* the bare-machine test), so loud is the only thing between them and invisibility.

The mechanism already exists, and **adding `schedule:` enrols them in it automatically.** Verified in the code rather than taken on trust:

- `src/Core.TypeScript/forge-host/github/workflow-triggers.ts` — `expectationFromWorkflow` turns a `cron:` into `{ kind: "periodic", periodSeconds }`, and its own comment settles the both-triggers case: *"a workflow that is BOTH scheduled and PR-triggered is `periodic`, because the clock is the stronger claim — the schedule says it should report whether or not anyone opens a PR."* That is exactly our case.
- `src/Core.TypeScript/drift-dashboard/fold.ts` reddens on three separate conditions: **failure**; **silence** (`age > stalenessFactor × periodSeconds`, `stalenessFactor: 3`, line 335); and **never-ran** (*"declared to run every N and has NEVER produced a verdict on this ref"*, line 301). Its `ok` is false when anything is red **or unknown** — *"Unknown never aggregates into green."*

So a shield that quietly stops running goes red, which is the property that distinguishes this from a cron in an inbox.

**Deliberately NOT done:** filing into the `docs/drift-events/` ledger. `drift-ledger.ts` allocates ticks as `max(existing) + 1` and `drift-sweep.yml` documents an add/add double-mint race (`000070`) from exactly that. A second workflow calling `sweep` concurrently would reintroduce it. If a ledger entry is wanted later, the file's own instruction is to *append a finding line to the existing sweep*, not to start a second writer.

---

## 3. Proving the failure path — because a shield never seen failing is not a shield

Two links in the chain, and both are checked rather than assumed.

### 3.1 Does silence actually go red?

`metered` — already covered by existing falsifiers, which pass on this tree (`bun test src/Core.TypeScript/drift-dashboard/fold.test.ts` → **84 pass, 0 fail, 182 assertions**), including by name:

- *"a declared trigger that has NEVER fired is red, however green its other runs are"* (fold.test.ts:523)
- *"a never-fired trigger is only a finding once the trigger COULD have fired"* (fold.test.ts:594)

The second one answers the obvious objection to adding seven schedules at once: it does **not** produce a day-zero red for seven workflows whose first cron has not yet come round. The grace is structural, not a suppression.

### 3.2 Do the shields themselves ever go red?

`metered`, last 100 runs of each workflow:

| shield | success | **failure** | cancelled |
|---|---|---|---|
| `docker-ubuntu-install-sh-test` | 72 | **1** | 26 |
| `docker-ubuntu-jammy-install-sh-test` | 75 | **1** | 23 |
| `docker-nixos-install-sh-test` | 86 | **2** | 12 |
| `docker-windows-install-ps1-test` | 58 | **2** | 39 |
| `macos-install-sh-test` | 85 | **1** | 14 |
| `wsl-install-sh-test` | 80 | **0** | 20 |
| `gitbash-install-routing-test` | 97 | **0** | 3 |

**Five of seven have an observed red.** Their failure path is measured, not assumed.

**Two have never been observed failing, and that is reported rather than smoothed over** — `wsl-install-sh-test` (0/100) and `gitbash-install-routing-test` (0/100). This is precisely the class that produced tonight's `multiboot.test.ts` defect elsewhere in the tree: a green that had never once corresponded to a check that ran. What can be said for these two:

- `gitbash-install-routing-test` **has a reachable failure branch**, read directly:
  ```bash
  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*) echo "ok: running under git-bash/MSYS" ;;
    *) echo "FAIL: shell:bash is not git-bash/MSYS on this runner (uname=$(uname -s))"; exit 1 ;;
  esac
  ```
  It is also **route-only by its own name** — it proves `install.sh` dispatches to `install.ps1`, *not* that the install works. Its 34 s runtime is consistent with that scope, and it should not be counted as a bare-machine install proof.
- `wsl-install-sh-test` runs a real install inside WSL (540–650 s observed). Its zero failures over 100 runs is `consistent with` a genuinely stable lane, and is **not** evidence that it can fail.

`speculative`: both are probably fine. Neither has been demonstrated. Naming them is the honest state, and a deliberate-failure probe for the two is the follow-up this document does not perform.

### 3.3 The cancellation hole, closed in passing

`docker-ubuntu-install-sh-test` carried `cancel-in-progress: true` **unconditionally**, unlike its six siblings. Harmless while every trigger was a PR; wrong the moment a `schedule:` exists, because on `main` a scheduled run and a later push share the concurrency group — so the clock-driven verdict could be **cancelled by an unrelated merge**. A cancelled run reads as neither pass nor fail, so the shield would go quiet with nothing red: the verdict-drought class (`verdict-drought.ts`), imported into the one arm that exists to catch what nothing else can. Now `${{ github.event_name == 'pull_request' }}`, matching its siblings.

`metered` — the cancellation rate in the table above (12–39%) is why this was worth fixing rather than noting.

---

## 4. Scope — what this change does not do

- **No job is migrated to the container.** Only the proof job in the containerized-runtime PR is containerized, so the incidental (weak, per §0) coverage is still fully intact. This lands *ahead* of any loss, deliberately.
- **Nothing is added to `gate (required)`'s `needs`.** These are drift checks, not gates.
- **No existing per-PR install step is deleted or weakened.** The schedule *adds* the time-driven arm. Removing the event-driven one is part of a migration and is not proposed here.
- **No shield is demoted.** They were already non-blocking; the repo has one required check and none of these is it.

---

## 5. What I could not verify

- **That `wsl-install-sh-test` and `gitbash-install-routing-test` can fail.** Zero observed failures in 100 runs each. `gitbash`'s failure branch was read and is reachable; `wsl`'s was not exercised. A deliberate-failure probe is the follow-up.
- **That a scheduled run will execute the real job.** No shield carries a job- or step-level `if:` keyed to `github.event_name`, so nothing should skip — checked by grep across all seven. But **no scheduled run has happened yet**; the first one is the proof, and until it lands this is `speculative`.
- **Whether the daily cadence is right.** It is reasoned from the arrival process, not measured against a history of upstream-drift incidents, because that history is not recorded anywhere I could query. The first month of scheduled runs is what would tell us.
- **The 48-step warm/cold split** is a static parse: it counts a cache *restore step* in the job, not a cache *hit* at runtime. A permanently-missing cache would make a "warm" job cold in practice. The direction of the error is conservative for my argument (it would mean *more* real download coverage than I credited), and it is stated rather than hidden.

`markdownlint` excludes `docs/research/2026-*-*.md`, so an rc=0 from it on this file would be a check that did not run, and is not quoted as a pass.

---

## 6. Pointers

- The seven modified workflows — each carries the two-failure-classes comment inline, where it is read at edit time.
- `src/Core.TypeScript/forge-host/github/workflow-triggers.ts` · `src/Core.TypeScript/drift-dashboard/fold.ts` (+ `fold.test.ts`) — the loud roster a `schedule:` enrols into, and its falsifiers.
- `src/Core.TypeScript/hygiene/drift-ledger.ts` — the ledger, and the tick race that is the reason this change does not write to it.
- `src/Core.TypeScript/ci/verdict-drought.ts` — the class §3.3 avoids importing.
- `docs/research/2026-08-26-containerized-job-runtime-toolchain-portability-tiering-image-as-materialization.md` §4.3 — where the corrected coverage measurement lives, and the change this one lands ahead of.
- `.claude/rules/dv2-data-split-discipline-activated.md` — change-rate partitioning, here applied to triggers rather than to storage.
