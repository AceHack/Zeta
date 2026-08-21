---
id: 081M0K36K69087G0R003BYSCF8
type: bug
state: backlog
priority: P2
slug: low-memory-lane-cannot-fit-its-apt-install-inside-ubuntu-sli
title: "low-memory lane cannot fit its apt install inside ubuntu-slim's hard 15-minute cap -- no apt cache, and the budget cannot grow"
created: 2026-08-21T21:21:31.337Z
depends_on: []
composes_with: []
---

# low-memory lane cannot fit its apt install inside ubuntu-slim's hard 15-minute cap -- no apt cache, and the budget cannot grow

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0K36K69087G0R003BYSCF8-*.md` glob. -->

## Measured

`low-memory.yml` job `core-smoke (ubuntu-slim, low-memory)` failed TWICE on the
same commit `b213b8f8` — attempt 1 and attempt 2 of run 32526035691 — with the
identical mechanism:

    E: dpkg was interrupted, you must manually run 'sudo dpkg --configure -a'
    apt-get install failed rc=100
    apt-get install did not succeed within the 420s apt budget

Two attempts, one commit, same failure: **not a flake.** The lane's recent
history is mixed (fail 20:55, ok 20:36, fail 20:35, ok 20:24, ok 20:20), which
is what a MARGINAL budget looks like rather than a random one — it sometimes
fits and often does not.

## Why the obvious fix is unavailable

The script's own refusal names the remedy: raise `ZETA_APT_BUDGET_SECONDS`, but
"in CI the budget is sized to fit inside the job's `timeout-minutes`, so raise
that first." **That lever does not exist here.** `low-memory.yml:99` sets
`timeout-minutes: 14` with the comment "fail gracefully before the 15-minute
runner-class hard cap", and the file header (`:45`) states the constraint
directly: the budget is sized "while staying inside ubuntu-slim's hard
15-minute job limit". The job cannot grow, so neither can the budget inside it.

## The lever nobody pulled

The lane caches **four** things — .NET SDK (`:105`), mise runtimes (`:111`),
elan (`:119`), NuGet (`:125`) — and does **not** cache apt. The one step that
fails is the only expensive step with no cache. Every run re-downloads the whole
apt set (cvc5, the GHC libs, llvm-18, qemu-utils, …) from scratch inside a
budget that cannot be raised.

## Why it matters beyond one red lane

The header records that ubuntu-slim takes ~10+ minutes against ~1.5 on a normal
runner, and that ubuntu-slim was REMOVED from `gate.yml`'s matrix for that
reason — so this lane exists specifically as the slim-runner canary. A canary
that fails a large fraction of the time on its own toolchain install is one
people learn to skim, and a skimmed lane is how the `Synced+Healthy` job hid a
real defect for 4.5 days earlier today. The failure mode is not "red lane"; it
is "lane nobody reads".

## Options, none of them chosen here

1. **Cache the apt archives** — the missing member of a set of four. Needs
   `/var/cache/apt/archives` plus dpkg state, or an action that does both.
   Highest value, real work, and the only option that keeps the canary honest.
2. **Shrink what this lane installs** — it mirrors `gate.yml`'s sequence by
   design, so diverging costs the parity the lane exists to test.
3. **Move it off `ubuntu-slim`** — which deletes the thing being tested.
4. **Accept and mark it non-blocking** — cheapest, and the one that produces the
   skimmed lane described above.

Filed rather than fixed because (1) is a real piece of work and the other three
each trade away something the lane exists for. Not a knob to turn.

