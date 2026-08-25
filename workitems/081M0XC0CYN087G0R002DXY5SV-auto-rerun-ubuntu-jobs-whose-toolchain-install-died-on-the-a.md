---
id: 081M0XC0CYN087G0R002DXY5SV
type: bug
state: in-progress
priority: P2
slug: auto-rerun-ubuntu-jobs-whose-toolchain-install-died-on-the-a
title: "auto-rerun ubuntu jobs whose toolchain install died on the apt wall budget (exit 124), and nothing else"
created: 2026-08-25T21:07:49.845Z
depends_on: []
composes_with: []
---

# auto-rerun ubuntu jobs whose toolchain install died on the apt wall budget (exit 124), and nothing else

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0XC0CYN087G0R002DXY5SV-*.md` glob. -->

## The measurement

2026-08-25, 15:28Z-20:43Z. Sixty of the window's failed runs were sampled and every failed
job attributed to its failing step (`gh api .../runs/<id>/jobs`, filtering
`steps[].conclusion == "failure"`). 102 failed jobs; **17 died in the toolchain install step
before the work the job is named for began**, under six job names in four workflows:

| red job name | workflow |
| --- | --- |
| `build-and-test (ubuntu-24.04)` | gate.yml |
| `Analyze (csharp)` | codeql.yml |
| `chart pins + helm template + kubeconform` | helm-validate.yml |
| `manifests (offline) + mutation proof` | helm-validate.yml |
| `live kind ArgoCD health (ubuntu-24.04)` | k8s-argocd-health-test.yml |
| `live kind included Synced+Healthy proof (ubuntu-24.04)` | k8s-argocd-health-test.yml |

One infrastructure failure wearing six names. Each instance costs a manual
`gh run rerun --failed`.

## It is not a stall — the banner is wrong, and the correction decides the fix

`tools/setup/linux.sh` prints *"stalled archive mirror, not a package error"*. Read against
job 97946436709 that word is wrong:

```
attempt 1  247s slice  103 packages fetched, killed inside emscripten (93.2 MB)
attempt 2   89s slice  emscripten completed in 86s (~1.08 MB/s), 8 more, killed
attempt 3   45s slice  27 more incl. pandoc (26.9 MB), killed inside podman
rc=124     "apt-get install did not succeed within the 420s apt budget"
```

Every attempt made forward progress; apt's archive cache carried downloads across them. The
mirror was **slow, not wedged** — ~1.1 MB/s against the ~14 MB/s (553 MB / 38.2s) healthy run
the 420s budget was sized from. 561 MB at 1.1 MB/s needs ~510s of download alone.

Consequence: **more in-step retry cannot help.** A fourth attempt does not add time, it
subdivides the same wall — attempt 3 was already down to 45s.

## Shipped

- `src/Core.TypeScript/ci/toolchain-install-stall.ts` — the pure signature policy.
- `src/Core.TypeScript/ci/rerun-toolchain-install-stall-cli.ts` — the sweeper.
- `.github/workflows/rerun-toolchain-install-stall.yml` — `*/15`, `actions: write` only.
- Falsifiers against real captured runs, six mutants killed.

## Open follow-ups (NOT done here)

1. **`github-settings.expected.json` re-snapshot.** The expected snapshot enumerates
   workflows and is diffed against live GitHub, so it cannot name a workflow that does not
   exist yet. After merge:
   `bun src/Core.TypeScript/hygiene/snapshot-github-settings.ts --repo Lucent-Financial-Group/Zeta > src/Core.TypeScript/hygiene/github-settings.expected.json`.
   Until then `github-settings-drift.yml`'s weekly Monday 14:17Z tick will report the new
   workflow as drift. Established convention (#8073 "re-snapshot expected to accept
   intentional drift").
2. **Cache `/var/cache/apt/archives`** — the root fix, and the only one with negative cost.
   The gate jobs already cache mise runtimes and verifier jars but not the `.deb` archives,
   so every job re-fetches 561 MB. Needs a design doc and a human sign-off: ~40 workflows.
3. **Raise `ZETA_APT_BUDGET_SECONDS`** — recommendation with a named cost, not a silent
   change. `audit-apt-budget-fits-job-timeout.ts --human` reports the tightest FITTING margin
   at **18s** (`k8s-lane-partition.yml:plan`, 420 + 10 + 152 = 582s vs a 600s timeout), so a
   +20s bump turns that audit red and a useful bump needs `timeout-minutes` edited across ~49
   governed jobs. Named pathology it would address: the retry ladder starves the attempt most
   likely to succeed (60% to attempt 1, remainder split), so attempt 3 — running with a warm
   archive cache and the least left to fetch — gets the smallest slice.
4. **The manifest is 2996 MB installed / 561 MB fetched.** Whether every ubuntu job needs the
   union of the toolchain is a separate question, and not Dejan's to answer alone.
