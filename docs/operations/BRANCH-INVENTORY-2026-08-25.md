# Branch inventory — `origin` after the 2026-08-25 cleanups

**Measured:** 2026-08-25 · **`origin/main` at measurement:** `7e1e1487f2b6312b325708827f48b2f8fa1eb7cc`
**Authoritative ref count:** 248 heads (247 branches + `main`)
**Work item:** 081M0WSV2N7087G0R002EV0GVV

This is an **inventory, not a sweep**. Nothing was deleted. Every class below carries the evidence
that put a branch in it, so the delete/keep call stays with the maintainer.

Context: `origin` carried ~1,858 heads this morning. Two cleanups ran — 1,235 redundant
`automation/pr-archive-*` branches whose records were already byte-identical on `main`, and 1,612
legacy `heartbeat/<agent>-flush-<40hex>` snapshot refs superseded by reusable
`heartbeat/<agent>-flush` refs. 248 heads remain. This document says what they are.

## Summary

| class | count | what it means | disposition |
|---|---|---|---|
| `TRUNK` | 1 | `main` | — |
| `LIVE-LANE` | 25 | `heartbeat/*` telemetry lanes (agent, cadence, and their `-buffer` halves) | **keep — load-bearing** |
| `OPEN-PR` | 15 | heads an open pull request (non-heartbeat) | **keep — never deletable** |
| `TIP-ON-MAIN` | 6 | tip is a literal ancestor of `main`; carries nothing | **delete — zero risk** |
| `SQUASH-LANDED` | 67 | a PR from this head merged, and its merge commit is on `main` | **delete — with one exception, below** |
| `ARCHIVE-LEFTOVER` | 49 | `automation/pr-archive-*` the byte-identical sweep could not match | **delete — evidence below** |
| `CLOSED-UNMERGED` | 63 | PR was closed without merging | **judgement — 10 carry files `main` does not have** |
| `NO-PR` | 22 | no PR was ever opened from this head | **judgement — 3 are pure duplicates, 9 carry real content** |

Age spread across the 247 non-trunk branches: 47 touched today, 76 within a week, 53 at 8–30 days,
66 at 31–60 days, 5 older than 60 days.

## Method, and the controls on it

Every number below is reproducible from these commands. Run them from a clone you own — the shared
checkout at `/Users/acehack/Documents/src/repos/Zeta` is a view, not a workspace.

```bash
# 1. Authoritative head list. NOT `gh api .../branches` — that paginates and under-reports.
git ls-remote --heads origin > lsremote.txt
wc -l < lsremote.txt        # 248

# 2. Fetch every head into your own clone (blobless keeps it to a few seconds).
git fetch --filter=blob:none --prune origin '+refs/heads/*:refs/remotes/origin/*'

# 3. CONTROL: the fetched view must equal the authoritative list, tip for tip.
awk '{sub(/^refs\/heads\//,"",$2); print $1" "$2}' lsremote.txt | sort -k2 > remote_tips.txt
git for-each-ref --format='%(objectname) %(refname:strip=3)' refs/remotes/origin | sort -k2 > local_tips.txt
diff remote_tips.txt local_tips.txt; echo "rc=$?"    # rc=0, zero lines

# 4. "Merged" tested structurally, never by name pattern.
git merge-base --is-ancestor "$ref" refs/remotes/origin/main; echo "rc=$?"

# 5. Unique commits — the --stdin form. Passing a ref list as an unquoted shell
#    variable does NOT word-split in zsh; it becomes one argument, every call
#    errors, stderr is swallowed, and every branch reports "0 unique commits".
git for-each-ref --format='%(refname)' refs/remotes/origin | sort > allrefs.txt
{ echo "$sha"; grep -v -x -F "$ref" allrefs.txt | sed 's/^/^/'; } | git rev-list --stdin --count

# 6. Does the branch's content already exist on main? Compare blob OIDs, which a
#    blobless clone can do without downloading a single blob.
git ls-tree -r --format='%(objectname) %(path)' refs/remotes/origin/main > main_tree.txt
```

**Three measurement errors were caught and corrected during this run. They are recorded because the
corrected numbers are only trustworthy if the failures are visible:**

1. **`git ls-remote` and `git clone` could not resolve `github.com`** on this machine — `getaddrinfo`
   was broken while `dig` answered fine, so every git transport failed while `gh` kept working. Using
   `gh` alone would have meant accepting the paginated API as the source of truth. Resolved instead by
   pinning the transport to the resolved address with a host-key alias:
   `GIT_SSH_COMMAND='ssh -o HostKeyAlias=github.com' git ls-remote --heads ssh://git@140.82.112.4/Lucent-Financial-Group/Zeta.git`.
   The count that came back — 248 — was then used as the control on everything downstream.
2. **`git rev-parse "main:no/such/path"` echoes its own argument back and exits 128.** A presence test
   written as `mo=$(git rev-parse "main:$f" 2>/dev/null); [ -z "$mo" ] && absent` therefore reported
   **zero absent files for every branch in the repository** — a check that cannot fail. It was caught
   by a surprising count (`absent_on_main=0`, 248 times) followed by a control on a path known not to
   exist. Corrected to a lookup against a materialised `git ls-tree -r` of `main`, with both a
   present-control (`CLAUDE.md` → 1) and an absent-control (a known-missing heartbeat path → 0).
   The corrected test is what found the 681 orphaned files on `agent-heartbeats`; the vacuous one had
   reported that branch as fully contained.
3. **`grep -P` is unavailable in BSD grep** and exits 2 with a usage error. Exit code 2 is a check that
   never ran, not a check that found nothing; the affected lookups were re-run with `awk`.

**One term needs defining, because it decides most of the dispositions.** This repo squash-merges
(`gh pr merge --auto --squash`), so a branch whose work fully landed is **not** an ancestor of `main`
and **does** report unique commits. Only 6 of 247 branches are literal ancestors. "Landed" is
therefore tested as: *the PR's `merge_commit_sha` is an ancestor of `origin/main`* —

```bash
gh api repos/Lucent-Financial-Group/Zeta/pulls/$N --jq '.merge_commit_sha'
git merge-base --is-ancestor "$sha" refs/remotes/origin/main; echo "rc=$?"
```

— which is why the tables below carry a `files not on main` column. That column, not the unique-commit
count, is the measure of what a deletion would actually cost.

## `LIVE-LANE` — 25 · keep, load-bearing

`CLAUDE.md` names `heartbeat/*` as the externalized idle counter, and reading `origin/main` alone
under-reports fleet liveness by up to a flush interval. These lanes are the substrate that fixes that.
Do not propose deleting any of them.

Three shapes are present, and all three are in use:

- **agent lanes** — `heartbeat/<agent>` plus its `heartbeat/<agent>-flush` PR head (`alexa`, `otto`, `soraya`)
- **cadence lanes** — `heartbeat/{tick-metrics,society,drift-sweep,drift-dashboard,pr-archive,red-state,search-index,budget-snapshot,context-cost-trend,manifesto-citation-snapshot,lockfile-healer-probe}`
- **buffer halves** — `heartbeat/<cadence>-buffer`, which is where un-flushed telemetry parks

The buffers are visibly doing their job: `heartbeat/drift-sweep-buffer` holds 63 files `main` has not
seen, `heartbeat/pr-archive-buffer` 46, `heartbeat/society-buffer` 15. That is telemetry in flight, not
abandoned work.

Two oddities worth knowing, neither of them a problem:

- `heartbeat/otto` **is** an ancestor of `main` right now. It is still a live lane; that is just where
  the flush cycle happens to be.
- `heartbeat/lockfile-healer-probe`'s merged PR (#13895) is **not** on `main` — it merged into
  `probe/flush-path-base`, a base branch that has since been deleted. Harmless, but it is the one place
  where "PR merged" and "content on main" come apart, and it is why the ancestry test is run on the
  merge commit rather than trusted from the PR state.

| branch | tip | age (d) | behind main | unique commits | files not on main | evidence |
|---|---|---|---|---|---|---|
| `heartbeat/alexa-flush` | 5a67ec385 | 0 | 1 | 0 | 0 | PR 15366 (open) |
| `heartbeat/alexa` | 5a67ec385 | 0 | 1 | 0 | 0 | PR 11138 (merged) |
| `heartbeat/budget-snapshot` | 2f8133c2a | 1 | 915 | 1 | 0 | PR 14289 (merged) |
| `heartbeat/context-cost-trend-buffer` | fcd0f970a | 0 | 64 | 0 | 0 | no PR ever opened |
| `heartbeat/context-cost-trend` | fcd0f970a | 0 | 64 | 0 | 0 | PR 15312 (merged) |
| `heartbeat/drift-dashboard-buffer` | 19b8db8db | 0 | 18 | 0 | 0 | no PR ever opened |
| `heartbeat/drift-dashboard` | 19b8db8db | 0 | 18 | 0 | 0 | PR 15286 (merged) |
| `heartbeat/drift-sweep-buffer` | f14545d4e | 0 | 1 | 1 | 63 | no PR ever opened |
| `heartbeat/drift-sweep` | 1972556b7 | 0 | 87 | 1 | 2 | PR 15276 (open) |
| `heartbeat/lockfile-healer-probe` | 18b1d1967 | 2 | 1145 | 2 | 0 | PR 13895 (merged) |
| `heartbeat/manifesto-citation-snapshot-buffer` | 6c4126724 | 1 | 663 | 1 | 1 | no PR ever opened |
| `heartbeat/manifesto-citation-snapshot` | 08539e0b6 | 2 | 1044 | 1 | 0 | PR 14063 (merged) |
| `heartbeat/otto` | ba92c4037 | 0 | 1 | 0 | 0 | PR 11133 (merged) |
| `heartbeat/pr-archive-buffer` | 21ade58a1 | 0 | 1 | 1 | 46 | no PR ever opened |
| `heartbeat/pr-archive` | 6cdf79d4f | 0 | 37 | 1 | 4 | PR 15327 (open) |
| `heartbeat/red-state-buffer` | 508de1d3c | 0 | 4 | 1 | 0 | no PR ever opened |
| `heartbeat/red-state` | b8495bc78 | 0 | 869 | 2 | 0 | PR 12321 (merged) |
| `heartbeat/search-index-buffer` | e647d0df5 | 0 | 420 | 0 | 0 | no PR ever opened |
| `heartbeat/search-index` | e647d0df5 | 0 | 420 | 0 | 0 | PR 14918 (merged) |
| `heartbeat/society-buffer` | 25f482b5c | 0 | 3 | 1 | 15 | no PR ever opened |
| `heartbeat/society` | fd8717767 | 0 | 38 | 1 | 1 | PR 15325 (open) |
| `heartbeat/soraya-flush` | fc3343a3f | 0 | 1 | 0 | 0 | PR 15365 (open) |
| `heartbeat/soraya` | fc3343a3f | 0 | 1 | 0 | 0 | PR 11139 (merged) |
| `heartbeat/tick-metrics-buffer` | c1ab9cee3 | 0 | 7 | 0 | 0 | no PR ever opened |
| `heartbeat/tick-metrics` | c1ab9cee3 | 0 | 7 | 0 | 0 | PR 15345 (merged) |

## `OPEN-PR` — 15 · keep, never deletable

Fifteen non-heartbeat branches head an open PR (a further 5 open PRs are the heartbeat flush lanes
listed above, for 20 open PRs total). Eight of the fifteen are `dependabot/*`.

| branch | tip | age (d) | behind main | unique commits | files not on main | evidence |
|---|---|---|---|---|---|---|
| `dependabot/bun/bun-minor-patch-315bd842cf` | 9ee41de68 | 0 | 8 | 1 | 0 | PR 15305 (open) |
| `dependabot/bun/full-ai-cluster/portal/web/multi-d8ec5a502f` | eb03aa3f1 | 1 | 728 | 1 | 0 | PR 14571 (open) |
| `dependabot/npm_and_yarn/agentic-organization/npm-minor-patch-218b9a2e63` | c192d7c00 | 0 | 8 | 1 | 0 | PR 15304 (open) |
| `dependabot/npm_and_yarn/demo/identity-dla-site/react-day-picker-10.0.1` | 175540896 | 0 | 71 | 1 | 0 | PR 14578 (open) |
| `dependabot/npm_and_yarn/demo/identity-dla-site/react-resizable-panels-4.12.3` | 990fc3e70 | 1 | 728 | 1 | 0 | PR 14579 (open) |
| `dependabot/npm_and_yarn/src/Renderers/website/react-day-picker-10.0.1` | 13c1f34ce | 0 | 70 | 1 | 0 | PR 14585 (open) |
| `dependabot/npm_and_yarn/src/Renderers/website/react-resizable-panels-4.12.3` | bc5322f2c | 1 | 728 | 1 | 0 | PR 14583 (open) |
| `dependabot/uv/src/Core.Python/uv-minor-patch-5af91188b2` | da53e622f | 0 | 8 | 1 | 0 | PR 14563 (open) |
| `fix/latent-push-to-main` | 0257b48ac | 0 | 17 | 23 | 4 | PR 13909 (open) |
| `fix/persona-coauthor-trailers-collide-with-real-github-users` | 7da45c845 | 0 | 3 | 3 | 4 | PR 15357 (open) |
| `fix/probe-the-scope-the-step-actually-uses` | 17143e575 | 0 | 3 | 2 | 2 | PR 15364 (open) |
| `fix/unify-duplicate-query-surfaces` | af8e65a90 | 0 | 87 | 4 | 2 | PR 15302 (open) |
| `otto/pr-archive-backfill-1` | 675e376a5 | 0 | 65 | 15 | 3334 | PR 15324 (open) |
| `otto/simd-linear-column-ops` | 1090eb0c0 | 0 | 87 | 8 | 5 | PR 15308 (open) |
| `shadow/boot-workload-identity-keys` | 183d5a116 | 8 | 3041 | 1 | 2 | PR 11501 (open) |

The two long-lived ones are worth a look rather than a merge-or-close reflex: `shadow/boot-workload-identity-keys`
(PR 11501, opened 2026-08-17, tip untouched for 8 days, 3,041 behind) and `fix/latent-push-to-main` (PR 13909, opened 2026-08-22, 23 unique
commits, only 17 behind — actively worked today).

## `TIP-ON-MAIN` — 6 · delete, zero risk

The tip of each of these is a literal ancestor of `origin/main`. Zero unique commits, zero files `main`
lacks. Deleting them cannot lose anything; the assertion is mechanical.

| branch | tip | age (d) | behind main | unique commits | files not on main | evidence |
|---|---|---|---|---|---|---|
| `alexa/qsharp-zset-isa-corrected` | 2080bcdb1 | 66 | 7502 | 0 | 0 | PR 8656 (closed, not merged) |
| `claim/081kqgdbj0008qg0r002-alexa-2026-07-08` | 425cf177b | 47 | 6514 | 0 | 0 | no PR ever opened |
| `feat/factory-hygiene-cadence-add-worktrees-job-otto-cli-2026-05-14` | fe8a84590 | 102 | 12577 | 0 | 0 | no PR ever opened |
| `gemini/summon-cli` | 65c6e67c7 | 70 | 7728 | 0 | 0 | no PR ever opened |
| `riven/b0891-acceptance` | 26fe2c6ea | 74 | 8324 | 0 | 0 | no PR ever opened |
| `validate/nix-ld-081KZETP6AT` | e438a554d | 15 | 4930 | 0 | 0 | no PR ever opened |

Verify any row with:

```bash
git merge-base --is-ancestor refs/remotes/origin/<branch> refs/remotes/origin/main; echo "rc=$?"   # rc=0
```

## `SQUASH-LANDED` — 67 · delete, with one exception

A PR opened from each of these heads merged, and its `merge_commit_sha` is an ancestor of `origin/main`.
Because the merge was a squash, the branch still reports unique commits — those are the pre-squash
originals, and their content is on `main` inside the squash commit.

**The exception is `agent-heartbeats`, and it is the single most consequential row in this document.**
Its PR (#5470) merged on 2026-05-27, and then the branch **kept accumulating heartbeats until
2026-06-19 that were never flushed again**. 689 files are unique to it; **681 of them exist on no other
ref and are not on `main`** — `docs/agent-heartbeats/otto-windows/2026/05/31` through `2026/06/03`, plus
one `otto` record from `2026/06/20`. `main` has no `docs/agent-heartbeats/otto-windows/` directory at all.
This is the only branch in the repository holding telemetry that would be destroyed by deleting it.
Recommendation: **flush it or archive it as a tag before it is deleted**, and do not batch it with the
other 66.

Nine other rows show a handful of files not on `main`; each is post-merge drift on the branch (commits
pushed after the PR merged), and each is small enough to eyeball:

| branch | tip | age (d) | behind main | unique commits | files not on main | evidence |
|---|---|---|---|---|---|---|
| `chore/081KLL7-post-8992-bookkeeping` | ea42499db | 54 | 7044 | 2 | 1 | PR 9061 -> 09540b618 on main |
| `claim/081M0Q8TY1B-retention-runtime-selection` | c6e0e9db6 | 0 | 14 | 4 | 1 | PR 15352 -> 8428c00ea on main |
| `claim/task-browser-page-durable-pwa` | 78030ea91 | 2 | 1222 | 8 | 1 | PR 13790 -> b99cfb89a on main |
| `claim/task-browser-runtime-probe` | 4f39a631e | 24 | 5781 | 10 | 1 | PR 9842 -> da89c1d7b on main |
| `claude/github-project-genesis-y44lc2` | 9eee3015f | 19 | 5432 | 14 | 14 | PR 8844 -> 57e1a0e0f on main |
| `feat/usb-esp-hostname-creds-asserts` | 5e7e84bbb | 47 | 6478 | 3 | 4 | PR 9543 -> 8910ddbd2 on main |
| `fix/ghcr-anon-token-measurement` | 0b8da2cad | 1 | 907 | 3 | 1 | PR 14307 -> 087b65081 on main |
| `ouroboros-bootstrap` | e87c53f35 | 0 | 153 | 5 | 4 | PR 14858 -> e5c419cea on main |
| `shadow/society-invariants-maximin-and-hat-residue` | 8a1ffe10e | 24 | 5728 | 2 | 1 | PR 9877 -> 827f83474 on main |

The largest, `claude/github-project-genesis-y44lc2` (14 of 15 files absent), is a 19-day-old
GitHub-project scaffold whose PR #8844 landed a different subset than the branch now holds — worth one
look before deletion. The rest are single-file drifts.

The full 67:

| branch | tip | age (d) | behind main | unique commits | files not on main | evidence |
|---|---|---|---|---|---|---|
| `agent-heartbeats` | 2a7324047 | 66 | 11002 | 689 | 681 | PR 5470 -> e9e8fe6aa on main |
| `automation/pr-archive-14581-run-32819776147-attempt-1` | 7332a666c | 0 | 80 | 1 | 0 | PR 15288 -> 74f56676c on main |
| `automation/pr-archive-15277-run-32819678796-attempt-1` | 5ab6a75fc | 0 | 81 | 1 | 0 | PR 15287 -> d6f2c1552 on main |
| `automation/pr-archive-15278-run-32819220704-attempt-1` | c37c28e51 | 0 | 83 | 1 | 0 | PR 15284 -> 1769cef50 on main |
| `book/feynman-susskind-readers-disease-20260802` | e5539c9af | 22 | 5569 | 2 | 0 | PR 9980 -> 227b72e10 on main |
| `book/hinge-information-geometry` | ad9a6839f | 1 | 849 | 2 | 0 | PR 14394 -> d4537a814 on main |
| `book/the-apex-predator-and-the-bound` | 7ab3c9703 | 1 | 800 | 3 | 0 | PR 14461 -> 1a369e2f6 on main |
| `chore/081KLL7-post-8992-bookkeeping` | ea42499db | 54 | 7044 | 2 | 1 | PR 9061 -> 09540b618 on main |
| `claim/081M0Q8TY1B-retention-runtime-selection` | c6e0e9db6 | 0 | 14 | 4 | 1 | PR 15352 -> 8428c00ea on main |
| `claim/cross-lang-zset-isa-capstone` | 10f15c2fa | 52 | 7022 | 0 | 0 | PR 8950 -> 64933769d on main |
| `claim/kiro-7b-codegen-work-2026-08-01` | 3be6912bf | 24 | 5714 | 1 | 0 | PR 9887 -> 0ffcfd058 on main |
| `claim/kiro-heartbeat-pr-flush-2026-07-08` | 3a7bb274d | 47 | 6475 | 2 | 0 | PR 9552 -> 143c44226 on main |
| `claim/kiro-otto-healer-duty-2026-08-01` | 470f4b5e9 | 24 | 5735 | 0 | 0 | PR 9874 -> 3f7ddec07 on main |
| `claim/task-browser-page-durable-pwa` | 78030ea91 | 2 | 1222 | 8 | 1 | PR 13790 -> b99cfb89a on main |
| `claim/task-browser-runtime-probe` | 4f39a631e | 24 | 5781 | 10 | 1 | PR 9842 -> da89c1d7b on main |
| `claim/vault-bridge-final-cleanup` | abf44ce5c | 23 | 5623 | 2 | 0 | PR 9950 -> d998d6f99 on main |
| `claim/vault-monitoring-bridge-design` | 525f1c7c4 | 23 | 5669 | 3 | 0 | PR 9914 -> ca6835c60 on main |
| `claude/github-project-genesis-y44lc2` | 9eee3015f | 19 | 5432 | 14 | 14 | PR 8844 -> 57e1a0e0f on main |
| `dejan/gate-required-absent-reads-as-green` | d171b9dee | 0 | 425 | 2 | 0 | PR 14914 -> 49a16f6ac on main |
| `docs/book-add-parents-pantheon-of-two-consent-granted-20260804` | ea65896a0 | 20 | 5461 | 2 | 0 | PR 10045 -> b94519ad5 on main |
| `feat/columnar-zset-vectorized-scan-v2` | 4d001225d | 0 | 122 | 5 | 0 | PR 15246 -> c8f11824e on main |
| `feat/dejan-declare-pam-reattach` | 75946a242 | 1 | 577 | 3 | 0 | PR 14781 -> a2a159542 on main |
| `feat/git-native-reverse-index` | 6ecf1e4a4 | 1 | 872 | 5 | 0 | PR 14359 -> f92e86e1d on main |
| `feat/index-excludes-itself` | e2b0e7c8f | 1 | 859 | 2 | 0 | PR 14386 -> e991df804 on main |
| `feat/no-private-source-image-deps` | 6cf49d637 | 1 | 905 | 9 | 0 | PR 14298 -> 3f0e0c99f on main |
| `feat/test-cilium-in-kind` | c0131fa33 | 3 | 1538 | 6 | 0 | PR 13329 -> 51e44678a on main |
| `feat/usb-esp-hostname-creds-asserts` | 5e7e84bbb | 47 | 6478 | 3 | 4 | PR 9543 -> 8910ddbd2 on main |
| `ferry-schuller-constructive-gravity` | 5d19254f7 | 11 | 4098 | 7 | 0 | PR 10351 -> 51c1333ac on main |
| `ferry/brain-evolution-neoteny-and-the-growth-ceiling` | 558766252 | 3 | 1251 | 2 | 0 | PR 13744 -> 08eeeaf18 on main |
| `ferry/demarcation-is-the-first-act-spencer-brown-anchor` | aa76dc17f | 1 | 555 | 2 | 0 | PR 14813 -> ef51caa6d on main |
| `ferry/language-as-organism-barenholtz-hahn-shapes-before-labels` | a223a2e4b | 3 | 1518 | 24 | 0 | PR 13423 -> d18ca1e8c on main |
| `fix-ollama-hang` | 3b4ee4632 | 11 | 4080 | 0 | 0 | PR 10368 -> 918ba4f54 on main |
| `fix/081KZZ27KJ8-delete-smt-solver-floor` | fb69d568c | 10 | 3727 | 2 | 0 | PR 10800 -> 106ea60d5 on main |
| `fix/drift-dashboard-evidence` | 09f1c03ad | 2 | 1097 | 2 | 0 | PR 13964 -> 9f861ebef on main |
| `fix/forgejo-oci-registry-and-published-pin` | cad372776 | 3 | 1538 | 5 | 0 | PR 13373 -> da4998b98 on main |
| `fix/ghcr-anon-token-measurement` | 0b8da2cad | 1 | 907 | 3 | 1 | PR 14307 -> 087b65081 on main |
| `fix/mise-tools-resolve-globally` | f96ffac25 | 1 | 886 | 4 | 0 | PR 14304 -> 2627ef96d on main |
| `fix/unpriced-charts-measurable` | 2496df132 | 2 | 988 | 4 | 0 | PR 14174 -> c3984580c on main |
| `fix/whole-tree-scan-timeout-impersonates-dark-route` | 836cc6463 | 2 | 1194 | 3 | 0 | PR 13821 -> 4de7a4ee2 on main |
| `fix/windows-docker-workspace-manifest` | 6eb70c64f | 1 | 886 | 2 | 0 | PR 14329 -> b06f6ea77 on main |
| `meno-lean-ybe` | ab29972db | 11 | 4096 | 4 | 0 | PR 10353 -> 325d46e30 on main |
| `nazar/frost-reshare-no-reconstitution` | e2ca82329 | 10 | 3862 | 2 | 0 | PR 10654 -> d2b18fb98 on main |
| `otto/four-corner-interface-type-plus-bridge11-orbit-intertwining` | e8be91ba3 | 52 | 6600 | 2 | 0 | PR 9443 -> 9cce00d0f on main |
| `otto/scheduler-zeta-weak-fixed-point-table` | 174b6e79a | 53 | 6920 | 2 | 0 | PR 9181 -> 215e784ba on main |
| `ouroboros-bootstrap` | e87c53f35 | 0 | 153 | 5 | 4 | PR 14858 -> e5c419cea on main |
| `refactor/retire-op-token-setup-to-ts` | b4f5dc0ae | 1 | 891 | 2 | 0 | PR 14336 -> 114514a6b on main |
| `research/qec-stack-routing` | b4d57abbd | 2 | 969 | 2 | 0 | PR 14224 -> 4ac632b8f on main |
| `research/rho-series-settles-the-band` | 548e2528a | 2 | 1240 | 3 | 0 | PR 13753 -> 77915be87 on main |
| `research/society-in-one-gpu` | 3f1803827 | 11 | 4056 | 2 | 0 | PR 10402 -> a9c23730f on main |
| `research/tit-for-lesser-tat-arena` | b8b8ebcce | 11 | 4029 | 3 | 0 | PR 10447 -> 37f2cee75 on main |
| `riven/qemu-uefi-menu-smoke` | 5ad42407a | 8 | 3662 | 2 | 0 | PR 10916 -> 9649f9494 on main |
| `shadow-openziti-trust-bundle` | 42f1c8929 | 3 | 1316 | 2 | 0 | PR 13664 -> 38fc0d55c on main |
| `shadow-revert-13973-mass-deletion` | fafd2b089 | 2 | 1091 | 3 | 0 | PR 13980 -> 07e9530c4 on main |
| `shadow/correct-16-grammar-universality-caveat` | 5db3285af | 15 | 4953 | 2 | 0 | PR 10218 -> 439c85ea2 on main |
| `shadow/demote-z2-z4-z5-z6-to-conjecture` | 31ca7b359 | 24 | 5747 | 1 | 0 | PR 9862 -> 592b04978 on main |
| `shadow/ferry-ismael-incompleteness-from-within` | f4c737c0a | 8 | 3277 | 5 | 0 | PR 11261 -> f349bdee3 on main |
| `shadow/ferry-manchak-unknowability-limits-of-measurement` | dc99d0492 | 7 | 3017 | 8 | 0 | PR 11527 -> 8d35c757c on main |
| `shadow/fix-stale-wall-clock-allowlist-row` | 1078cc45e | 6 | 2544 | 2 | 0 | PR 12129 -> a659187aa on main |
| `shadow/heartbeat-pat-gate-restart` | d44fdbd88 | 8 | 3574 | 3 | 0 | PR 10986 -> f5cc9f1b2 on main |
| `shadow/independent-lane-partition` | 4e97d6b8d | 2 | 1232 | 3 | 0 | PR 13786 -> 02266f378 on main |
| `shadow/ip-no-cloning-workaround-time-not-encryption` | de988ea48 | 46 | 6358 | 2 | 0 | PR 9642 -> d3a6573fe on main |
| `shadow/rename-tsirelson-to-sticking-threshold` | 96cec33f7 | 24 | 5736 | 3 | 0 | PR 9870 -> d57d3205d on main |
| `shadow/society-invariants-maximin-and-hat-residue` | 8a1ffe10e | 24 | 5728 | 2 | 1 | PR 9877 -> 827f83474 on main |
| `shadow/translation-residue` | 6937e7a9c | 6 | 2527 | 2 | 0 | PR 12153 -> cbd3557cc on main |
| `shadow/vacuous-ci-gates-sweep` | fc04a22d8 | 9 | 3671 | 2 | 0 | PR 10878 -> b822b89d8 on main |
| `soraya-nuf` | 103ee5dce | 1 | 551 | 4 | 0 | PR 14800 -> 2a5ff022b on main |
| `soraya/ambient-time-in-tests` | 8410784f8 | 6 | 2559 | 3 | 0 | PR 12112 -> 58338c1d9 on main |

## `ARCHIVE-LEFTOVER` — 49 · delete, evidence below

These are the `automation/pr-archive-<PR>-run-<id>-attempt-<n>` branches the byte-identical sweep left
behind. **All 49 touch exactly two paths, and every one of those paths exists on `main` — zero files
absent, across the whole class.** The sweep skipped them for a mechanical reason, not a content one:

- one of the two paths is an **append-only container** (`docs/github/prs/manifest.jsonl`, or a
  `docs/github/prs/shards/NNN/*.json` shard) which accumulates every later PR, so it can never be
  byte-identical to a months-old snapshot;
- for the 44 older rows the `docs/history/pr-reviews/PR-NNNN-*.md` record also differs, because `main`'s
  copy was **cleaned up after** the snapshot was taken.

Worked instance — `automation/pr-archive-9028-run-28550161842-attempt-1` vs `main`, same path:

```console
$ git diff --stat <branch>:docs/history/pr-reviews/PR-9028-....md main:docs/history/pr-reviews/PR-9028-....md
 1 file changed, 11 deletions(-)
```

The 11 lines `main` dropped are the transient `[//]: # (dependabot-start)` "Dependabot is rebasing this
PR" banner. `main`'s record is a strict improvement on the snapshot, not a different record. Only 3 of
the 49 are byte-identical on both paths; 5 more on one path; the remaining 41 differ only in that
direction.

Distribution: 44 are 53–54 days old (PRs #9028–#9182, from 2026-07-01/02, no PR ever opened for the
archive branch itself) and 5 are from today (PRs #14346, #14882, #15186, #15260, #15262 — four of which
have an archive PR that was closed unmerged, and one no PR at all).

Recommended action: **delete all 49**, and treat the append-only-container case as the reason the sweep
under-matched — a future sweep that compares only the `docs/history/pr-reviews/PR-*.md` path would have
caught these.

| branch | tip | age (d) | behind main | unique commits | files not on main | evidence |
|---|---|---|---|---|---|---|
| `automation/pr-archive-14346-run-32807762899-attempt-1` | c3062689d | 0 | 155 | 1 | 0 | PR 15205 (closed, not merged) |
| `automation/pr-archive-14882-run-32758806825-attempt-1` | 207e45ddf | 0 | 448 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-15186-run-32807558167-attempt-1` | 5682435a3 | 0 | 160 | 1 | 0 | PR 15198 (closed, not merged) |
| `automation/pr-archive-15260-run-32816566562-attempt-1` | 45df78aa2 | 0 | 95 | 1 | 0 | PR 15268 (closed, not merged) |
| `automation/pr-archive-15262-run-32815995734-attempt-1` | 2fa4d43c9 | 0 | 101 | 1 | 0 | PR 15263 (closed, not merged) |
| `automation/pr-archive-9028-run-28550161842-attempt-1` | 3a0eda6bd | 54 | 7058 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9029-run-28550147090-attempt-1` | b40006e51 | 54 | 7059 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9065-run-28552871278-attempt-1` | 1f1cba9e0 | 54 | 7051 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9069-run-28553381093-attempt-1` | 85a916c9e | 54 | 7047 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9100-run-28561163983-attempt-1` | 0c8f74a7f | 54 | 7001 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9101-run-28561506929-attempt-1` | 13b233a9e | 54 | 7000 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9103-run-28562045275-attempt-1` | 527aa31ce | 54 | 6998 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9104-run-28562129688-attempt-1` | 77169121a | 54 | 6997 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9105-run-28563130451-attempt-1` | 0be015a4f | 54 | 6996 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9106-run-28563163097-attempt-1` | ca5d15f41 | 54 | 6995 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9107-run-28564279745-attempt-1` | 2b9a2c22c | 54 | 6994 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9109-run-28564918424-attempt-1` | e2e032029 | 54 | 6992 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9110-run-28565020301-attempt-1` | 2438edfd1 | 54 | 6991 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9111-run-28565481754-attempt-1` | 3790c3ac5 | 54 | 6990 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9112-run-28565727573-attempt-1` | e5b8b377d | 54 | 6988 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9113-run-28565721017-attempt-1` | ed2c36f19 | 54 | 6989 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9115-run-28566287491-attempt-1` | a8887cbeb | 54 | 6986 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9116-run-28566428113-attempt-1` | 2071b63ed | 54 | 6985 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9117-run-28566554984-attempt-1` | f11c05827 | 54 | 6984 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9118-run-28567095112-attempt-1` | dbc503b8e | 54 | 6983 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9129-run-28590694006-attempt-1` | 097af9d66 | 54 | 6970 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9130-run-28591028312-attempt-1` | 98982496f | 54 | 6969 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9131-run-28591102956-attempt-1` | e38652547 | 54 | 6968 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9132-run-28591216568-attempt-1` | 89b51a205 | 54 | 6967 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9133-run-28591396113-attempt-1` | f624dc7c2 | 54 | 6966 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9134-run-28596346690-attempt-1` | 4a3a595ce | 54 | 6965 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9137-run-28597770908-attempt-1` | 44ddd8b56 | 54 | 6962 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9138-run-28598041293-attempt-1` | 223a7da9e | 54 | 6960 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9140-run-28599473750-attempt-1` | 28f3184cf | 54 | 6959 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9141-run-28599949128-attempt-1` | cda93a925 | 54 | 6958 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9143-run-28601238036-attempt-1` | e1fd61865 | 54 | 6956 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9144-run-28601588908-attempt-1` | e8ea49a4d | 54 | 6955 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9146-run-28602784041-attempt-1` | 56b428664 | 53 | 6953 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9147-run-28604095472-attempt-1` | 61bc3d41e | 53 | 6952 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9170-run-28609871940-attempt-1` | ced9ff954 | 53 | 6929 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9172-run-28610654873-attempt-1` | 53dff3639 | 53 | 6927 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9173-run-28610775109-attempt-1` | 7bf73cf43 | 53 | 6926 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9174-run-28611305494-attempt-1` | 082e7c0f3 | 53 | 6925 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9175-run-28611969155-attempt-1` | 87f3e9284 | 53 | 6924 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9177-run-28612181524-attempt-1` | 19dc36a9a | 53 | 6922 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9178-run-28612874823-attempt-1` | 0a6ad122b | 53 | 6921 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9179-run-28613043125-attempt-1` | c9c469ecd | 53 | 6920 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9181-run-28613523229-attempt-1` | ea86d175c | 53 | 6918 | 1 | 0 | no PR ever opened |
| `automation/pr-archive-9182-run-28613544848-attempt-1` | e27a5c9e0 | 53 | 6917 | 1 | 0 | no PR ever opened |

## `CLOSED-UNMERGED` — 63 · judgement

A PR was opened from each of these and closed without merging. That is a decision someone already made,
so the branch is usually redundant — but the branch is also the only place the rejected work still exists,
so this class gets read, not swept.

**53 of the 63 touch no path that `main` lacks.** For a rejected change to an existing file that is the
expected shape, and it means deletion costs only the diff, which the closed PR still renders on GitHub.

**10 carry files `main` does not have**, and these are the ones that need a call:

| branch | tip | age (d) | behind main | unique commits | files not on main | evidence |
|---|---|---|---|---|---|---|
| `otto/lint-fused-persona-cell-phase5` | c99a73e34 | 47 | 7022 | 5 | 7 | PR 9551 (closed, not merged) |
| `shadow/consensus-vote-dead-timestamp-and-local-time-audit` | 30887df76 | 8 | 3156 | 1 | 4 | PR 10738 (closed, not merged) |
| `shadow/candidate-generator-possibility-space` | 28c6c0c1f | 9 | 3715 | 1 | 4 | PR 10845 (closed, not merged) |
| `fix/verify-session-toctou` | 6e8af24f1 | 2 | 1105 | 1 | 2 | PR 13958 (closed, not merged) |
| `fix/installer-ci-and-gate-reds-2026-07-31` | b40009e19 | 24 | 5773 | 2 | 1 | PR 9833 (closed, not merged) |
| `claim/kiro-trust-protection-adr-2026-07-08` | f59f8b54a | 47 | 6486 | 2 | 1 | PR 9537 (closed, not merged) |
| `claim/kiro-trio-attestation-research-2026-07-08` | 11a278d75 | 47 | 6460 | 2 | 1 | PR 9570 (closed, not merged) |
| `claim/kiro-identity-adr-corrections-2026-07-08` | 14f08f615 | 47 | 6476 | 2 | 1 | PR 9547 (closed, not merged) |
| `claim/kiro-free-tier-intelligence-scaling` | d11c4c6a1 | 47 | 6467 | 2 | 1 | PR 9561 (closed, not merged) |
| `claim/bug-dotnet-arm64-accessviolation` | 7435f72e5 | 24 | 5737 | 3 | 1 | PR 9871 (closed, not merged) |

Reading them: `otto/lint-fused-persona-cell-phase5` (7 files, 47d) and the two 4-file shadow branches
(`shadow/consensus-vote-dead-timestamp-and-local-time-audit`, `shadow/candidate-generator-possibility-space`,
both ~8d) are the only ones where a non-trivial body of new files would go away. The other seven are 1–2
files each.

One row in this class is a cleanup miss rather than a judgement call:
`heartbeat/alexa-flush-dd75e0079cb01981ce4de2a0f8d00060c631e996` is a **legacy 40-hex flush snapshot ref
that survived the 1,612-branch sweep** — it was created today, after or during the sweep, by whatever
still emits the old naming. Its PR #15307 was closed unmerged and all three of its files are on `main`.
Deleting it is safe; the more useful finding is that **the emitter of the legacy name is still running**,
so the population will grow back unless that is fixed.

The other 53:

| branch | tip | age (d) | behind main | unique commits | files not on main | evidence |
|---|---|---|---|---|---|---|
| `auth/authorize-aaron-passkey` | ac964945d | 11 | 4011 | 6 | 0 | PR 10479 (closed, not merged) |
| `chore/refresh-chart-snapshots-2026-08-21` | 4f64f253b | 3 | 1532 | 1 | 0 | PR 13405 (closed, not merged) |
| `claim/gate-installer-tests` | 713b622b0 | 17 | 5255 | 1 | 0 | PR 10134 (closed, not merged) |
| `claim/kiro-agent-heartbeat-workflow-2026-07-08` | 07b14fff8 | 47 | 6514 | 3 | 0 | PR 9525 (closed, not merged) |
| `claim/kiro-agent-reviewer-2026-07-08` | 09583fdab | 47 | 6473 | 1 | 0 | PR 9555 (closed, not merged) |
| `claim/kiro-attestation-events-2026-07-08` | 0b79d1b5f | 47 | 6457 | 1 | 0 | PR 9576 (closed, not merged) |
| `claim/kiro-free-tier-adr-2026-07-08` | 5feac0101 | 47 | 6514 | 1 | 0 | PR 9519 (closed, not merged) |
| `claim/kiro-monitor-dashboard-2026-07-08` | 2d6c634cc | 47 | 6489 | 1 | 0 | PR 9534 (closed, not merged) |
| `claim/kiro-resume-update-2026-08-01` | 74ffe67fa | 24 | 5735 | 1 | 0 | PR 9886 (closed, not merged) |
| `codex/vite-app-ownership` | 7ac11222c | 2 | 953 | 1 | 0 | PR 14234 (closed, not merged) |
| `drain-pr-archives` | f822e843c | 11 | 4100 | 2 | 0 | PR 10346 (closed, not merged) |
| `feat/bp-29-falsifier-density-v2` | 5773d1617 | 4 | 2052 | 1 | 0 | PR 12840 (closed, not merged) |
| `feat/bp-29-falsifier-density` | fe27058b1 | 4 | 2057 | 1 | 0 | PR 12833 (closed, not merged) |
| `feat/first-session-durable-journal` | f747a6e7c | 7 | 2638 | 2 | 0 | PR 11957 (closed, not merged) |
| `feat/softvalue-widening-operator` | e2e7f5891 | 2 | 964 | 1 | 0 | PR 14218 (closed, not merged) |
| `feature-agent-capabilities-playable-quotes` | 6b3cc7b6b | 8 | 4080 | 0 | 0 | PR 10947 (closed, not merged) |
| `feature-lensography-toy-env` | 57cdacd74 | 9 | 4080 | 0 | 0 | PR 10910 (closed, not merged) |
| `fix/bun-lock-records-twitch-ai-workspace` | 6a6c0718f | 1 | 907 | 1 | 0 | PR 14305 (closed, not merged) |
| `fix/chart-currency-step-name-not-continue-on-error` | 9cd40f00d | 3 | 1538 | 1 | 0 | PR 13392 (closed, not merged) |
| `fix/ci-rustfmt-markdownlint` | 12bf0a4c0 | 52 | 6717 | 5 | 0 | PR 9343 (closed, not merged) |
| `fix/drift-ledger-silent-push-failure` | d134fca15 | 2 | 1183 | 0 | 0 | PR 12066 (closed, not merged) |
| `fix/gate-narrow-js-bootstrap` | 23486b40f | 4 | 2028 | 1 | 0 | PR 12983 (closed, not merged) |
| `fix/manifest-drift-2026-08-20` | 8bcb4ca9e | 4 | 1975 | 1 | 0 | PR 12893 (closed, not merged) |
| `fix/pr-manifest-redrive-2026-08-19` | a4016acae | 6 | 2391 | 1 | 0 | PR 12322 (closed, not merged) |
| `fix/shellcheck-sc2012-self-register` | ac549bfe5 | 3 | 1459 | 1 | 0 | PR 13496 (closed, not merged) |
| `fix/verify-session-fixes-toctou` | 658946562 | 2 | 1105 | 1 | 0 | PR 13954 (closed, not merged) |
| `heartbeat/alexa-flush-dd75e0079cb01981ce4de2a0f8d00060c631e996` | dd75e0079 | 0 | 68 | 3 | 0 | PR 15307 (closed, not merged) |
| `ops/pr-manifest-repair-8778` | f76a44e85 | 3 | 1603 | 1 | 0 | PR 13008 (closed, not merged) |
| `otto/auto-vivify-dangling-refs-2026-08-19` | 8d2797e28 | 6 | 2365 | 1 | 0 | PR 12401 (closed, not merged) |
| `refactor-roles-to-hats` | 793216df3 | 8 | 4080 | 1 | 0 | PR 10949 (closed, not merged) |
| `research/collapse-containment-markov-rooms` | 227c7e3f6 | 5 | 2106 | 1 | 0 | PR 12773 (closed, not merged) |
| `research/futamura-for-observables` | adc6ecb08 | 5 | 2099 | 1 | 0 | PR 12783 (closed, not merged) |
| `research/gravity-as-phase-slowing-under-consensus` | bad0e6f10 | 5 | 2101 | 1 | 0 | PR 12780 (closed, not merged) |
| `research/gravity-is-the-restoring-force` | b1540ccef | 5 | 2096 | 1 | 0 | PR 12790 (closed, not merged) |
| `research/philosophers-star-magic-square-generates-star-v2` | 42314ff1e | 3 | 1437 | 4 | 0 | PR 13430 (closed, not merged) |
| `research/philosophers-star-magic-square-generates-star` | aa8a71780 | 3 | 1520 | 2 | 0 | PR 13417 (closed, not merged) |
| `research/slow-explosion-warning-system` | 95f0fcbc2 | 5 | 2101 | 1 | 0 | PR 12778 (closed, not merged) |
| `research/thermal-erasure-is-the-one-place` | b8d2c8866 | 5 | 2106 | 1 | 0 | PR 12771 (closed, not merged) |
| `shadow/attribute-wasm-substrate-test-timeout` | 3b249876a | 7 | 2973 | 1 | 0 | PR 11570 (closed, not merged) |
| `shadow/blind-breaker-and-split-pressure-classifier` | 5ffe676e1 | 8 | 3156 | 1 | 0 | PR 10735 (closed, not merged) |
| `shadow/bonsai-cost-model-and-app-free-verification` | d73d0e779 | 9 | 3715 | 0 | 0 | PR 10835 (closed, not merged) |
| `shadow/dedupe-dkek-inventory-entry` | bbbd0c49c | 3 | 1453 | 1 | 0 | PR 13503 (closed, not merged) |
| `shadow/derive-envelope-conclusions` | 33389e152 | 2 | 1153 | 2 | 0 | PR 13885 (closed, not merged) |
| `shadow/ferry-deflation-claim-narrowed` | a13d67fa8 | 7 | 2942 | 2 | 0 | PR 11591 (closed, not merged) |
| `shadow/geodesic-default-oracle` | bfe95d3f6 | 7 | 2846 | 1 | 0 | PR 11707 (closed, not merged) |
| `shadow/iterated-tradition-density-probe` | 3cc5c552f | 7 | 2869 | 2 | 0 | PR 11687 (closed, not merged) |
| `shadow/manifest-drift-check-measures-age` | 54aaed985 | 2 | 1212 | 1 | 0 | PR 13802 (closed, not merged) |
| `shadow/reaim-heartbeat-credential-pin` | a86256071 | 8 | 3551 | 1 | 0 | PR 11023 (closed, not merged) |
| `shadow/telemetry-cadences-cannot-push-to-main` | 4c4acc7cc | 2 | 1212 | 1 | 0 | PR 13795 (closed, not merged) |
| `shadow/tradition-density-probe-guarded` | 98460b096 | 7 | 2604 | 1 | 0 | PR 11986 (closed, not merged) |
| `shadow/ult-33-34-fix` | e2ce9c3ec | 10 | 3741 | 1 | 0 | PR 10796 (closed, not merged) |
| `soraya/ambient-time-collation-followup` | 9f1fba4fd | 6 | 2527 | 1 | 0 | PR 12149 (closed, not merged) |
| `zflash/one-home-for-size-bounds-v2` | 096ff0fba | 4 | 1798 | 1 | 0 | PR 13104 (closed, not merged) |

## `NO-PR` — 22 · judgement

No PR was ever opened from these heads, so there is no closed-PR page holding the diff. Whatever is here
exists only as the branch. They split three ways.

**Five are pure duplicates — delete, zero cost.** The three `flush/heartbeat-*-20260801T15xxZ` branches
are the pre-reusable-lane flush snapshots from 2026-08-01, and every file in them is **byte-identical on
`main`** (314/314, 312/312, 310/310 — blob OID equality, not a name match). `claim/081kzeta0007040005-alexa-2026-07-08`
and `cursor/fix-drift-ledger-silent-push-3f96` have zero commits that are not already on some other ref.

**Three touch only paths `main` already has** (`cursor/longhorn-common-nix-default-test-06ca`,
`cursor/longhorn-rebase-clean-06ca`, `cursor/rework-pr-13767-9c53`) — two-day-old harness experiments;
deletion costs only the diff.

**Fourteen carry files that exist nowhere else.** Two are substantial:

- `otto/telemetry-zetaid-shards` — **560 files absent from `main`**, 11 days old, 4,080 behind. By far the
  largest orphan in this class. It touches 1,128 files total, so half its footprint never landed.
- `claude/design-sync-dqxa3r` — 21 of 36 files absent, 54 days old, from the Claude-design sync lane.

`derivation-{a,b,c}/threshold-sig-verify` are a deliberate three-way independent-derivation set (3, 4 and
3 orphaned files) — that is an N-version experiment, and deleting one arm without the others destroys the
comparison rather than a duplicate. `otto/agent-sovereign-keys-proposal` (7 files) and
`automation/society-protected-main-contract` (5 files) are proposals that were written and never opened.
The six `claim/*` and `codex/*` rows are one file each — claim markers, most likely, but they are not on
`main`.

| branch | tip | age (d) | behind main | unique commits | files not on main | evidence |
|---|---|---|---|---|---|---|
| `automation/society-protected-main-contract` | beaf6cd89 | 11 | 4332 | 1 | 5 | no PR ever opened |
| `claim/081ktqx7w6q08qg0r000-otto-2026-08-24` | 424fa4502 | 0 | 449 | 1 | 1 | no PR ever opened |
| `claim/081ktqx7w6q08qg0r000-otto-2026-08-25` | 55f71cf0c | 0 | 286 | 1 | 1 | no PR ever opened |
| `claim/081KWQS2PN608QG0R002CXSBG0-minimal-bnn-synthesis` | d0da65597 | 47 | 6502 | 1 | 1 | no PR ever opened |
| `claim/081kzeta0007040005-alexa-2026-07-08` | b50c36139 | 47 | 6514 | 0 | 0 | no PR ever opened |
| `claim/task-browser-checkpoint-port` | 1b688a027 | 16 | 5026 | 1 | 1 | no PR ever opened |
| `claim/task-browser-pwa-checkpoint-transport` | 329364be6 | 16 | 5158 | 1 | 1 | no PR ever opened |
| `claim/task-browser-zetadb-invalidation` | 9aa2c64c1 | 15 | 4918 | 1 | 1 | no PR ever opened |
| `claude/design-sync-dqxa3r` | b04c6e6ba | 54 | 7052 | 1 | 21 | no PR ever opened |
| `codex/browser-zetadb-startup-hydration` | 7dc5eef17 | 15 | 4887 | 2 | 1 | no PR ever opened |
| `cursor/fix-drift-ledger-silent-push-3f96` | d134fca15 | 2 | 1183 | 0 | 0 | no PR ever opened |
| `cursor/longhorn-common-nix-default-test-06ca` | 274e217e2 | 2 | 1189 | 5 | 0 | no PR ever opened |
| `cursor/longhorn-rebase-clean-06ca` | b85aba867 | 2 | 1169 | 4 | 0 | no PR ever opened |
| `cursor/rework-pr-13767-9c53` | 9142e163f | 2 | 1183 | 1 | 0 | no PR ever opened |
| `derivation-a/threshold-sig-verify` | 06b7b32b0 | 15 | 4880 | 2 | 3 | no PR ever opened |
| `derivation-b/threshold-sig-verify` | 9c527259b | 15 | 4880 | 4 | 4 | no PR ever opened |
| `derivation-c/threshold-sig-verify` | 63cf97e93 | 15 | 4880 | 2 | 3 | no PR ever opened |
| `flush/heartbeat-alexa-20260801T1500Z` | 0609a1315 | 24 | 5710 | 315 | 0 | no PR ever opened |
| `flush/heartbeat-otto-20260801T1500Z` | 06230517d | 24 | 5710 | 313 | 0 | no PR ever opened |
| `flush/heartbeat-soraya-20260801T1459Z` | d7a510b20 | 24 | 5710 | 311 | 0 | no PR ever opened |
| `otto/agent-sovereign-keys-proposal` | 316b67b41 | 11 | 4100 | 6 | 7 | no PR ever opened |
| `otto/telemetry-zetaid-shards` | 81351e0dd | 11 | 4080 | 3 | 560 | no PR ever opened |

## Anything that fits none of the above

Nothing was forced into a category, but three things sit oddly and are recorded rather than classified:

1. **`heartbeat/lockfile-healer-probe`'s merge target no longer exists.** Its PR merged into
   `probe/flush-path-base`, which has been deleted, so "merged" and "on `main`" disagree for this one
   branch. It stays in `LIVE-LANE` on the strength of its name and cadence, not its merge state.
2. **`main` reports one unique commit** — its own tip, which is on no branch. That is the measurement
   working, not an anomaly, and it is a useful control on the unique-commit query: a run that reported
   `0` there would be the vacuous form of the `--stdin` mistake.
3. **The legacy `heartbeat/<agent>-flush-<40hex>` shape is still being emitted.** Exactly one such ref
   exists (`heartbeat/alexa-flush-dd75e00…`), created today — after a sweep that removed 1,612 of them.
   One ref is not a problem; an emitter that survived the cutover is.

## Recommended disposition

Deleting is the maintainer's call. Grouped by how much judgement each group needs:

| group | count | recommendation |
|---|---|---|
| `main`, `LIVE-LANE`, `OPEN-PR` | 41 | **keep** — load-bearing or heads an open PR |
| `TIP-ON-MAIN` | 6 | **delete** — tip is an ancestor of `main`, mechanically empty |
| `ARCHIVE-LEFTOVER` | 49 | **delete** — record on `main` is a strict improvement on the snapshot |
| `SQUASH-LANDED` minus `agent-heartbeats` | 66 | **delete** — merge commit verified on `main` |
| `CLOSED-UNMERGED` with no absent files | 53 | **delete** — decision already made, diff preserved on the closed PR |
| `NO-PR` pure duplicates | 5 | **delete** — byte-identical on `main`, or zero unique commits |
| **clear-cut subtotal** | **179** | |
| `agent-heartbeats` | 1 | **flush or tag first** — 681 orphaned telemetry files |
| `CLOSED-UNMERGED` with absent files | 10 | **read before deleting** — 1–7 orphaned files each |
| `NO-PR` with content | 17 | **read before deleting** — includes the 560-file `otto/telemetry-zetaid-shards` |
| **judgement subtotal** | **28** | |

If the 179 clear-cut deletions land, `origin` goes from 248 heads to 69, of which 41 are actively in use.

Two follow-ups that are worth more than the deletions:

- **Fix the emitter still producing `heartbeat/<agent>-flush-<40hex>` names**, or the 1,612-branch sweep
  will need re-running.
- **Have the `pr-archive` sweep compare only `docs/history/pr-reviews/PR-*.md`**, not the append-only
  manifest and shard files. That single change accounts for all 49 `ARCHIVE-LEFTOVER` rows.

## Reproducing this document

The raw per-branch data (name, tip, ancestry, ahead/behind, unique commits, files touched, files present
on `main`, files byte-identical on `main`, PR state) was produced by the commands in **Method** above and
is regenerable in full from a fresh clone. Nothing in this document depends on state that only existed in
the measuring session.
