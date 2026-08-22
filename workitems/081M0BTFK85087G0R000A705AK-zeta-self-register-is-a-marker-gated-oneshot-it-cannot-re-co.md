---
id: 081M0BTFK85087G0R000A705AK
type: bug
state: in-progress
priority: P2
slug: zeta-self-register-is-a-marker-gated-oneshot-it-cannot-re-co
title: "zeta-self-register is a marker-gated oneshot: it cannot re-converge, so the host layer is enrolment, not repair"
created: 2026-08-19T01:34:28.101Z
depends_on: []
composes_with: []
---

# zeta-self-register is a marker-gated oneshot: it cannot re-converge, so the host layer is enrolment, not repair

Reported in
`docs/research/2026-08-18-reaching-a-dark-node-the-recovery-planes-missing-half-rendezvous-container-seam-and-the-bootstrap-paradox.md`
§1.0, and proposed there (open question 5) as the first workitem of the pre-k8s
recovery plane. Governing architecture:
`docs/research/2026-08-18-the-pre-k8s-layer-is-the-recovery-plane-*.md` (Kenji).

## Verified before fixing

Measured on `origin/main` at `8455c1633791666cbe1b0302b12c7d028608740c`:

| claim | verdict | evidence |
|---|---|---|
| every `zeta-*` unit is `Type=oneshot` except the agent | **confirmed** | `zeta-creds-restore`, `zeta-self-register`, `zeta-self-register-ci`, `k3s-join-observer`, `nvidia-open-driver-bound-check` are `oneshot`; `zeta-ai-agent` is `simple` |
| `zeta-self-register` is marker-gated | **confirmed** | `unitConfig.ConditionPathExists = [ "!${cfg.markerPath}" … ]`, plus a matching `[ -f "$MARKER" ] && exit 0` at the top of the script — belt *and* braces on the same defect |
| no other re-convergence path exists | **confirmed** | `systemd.timers` appears **nowhere** under `full-ai-cluster/nixos/`; `Restart=on-failure` only retries within one activation, and the script `exit 0`s (not non-zero) on the commonest failure, so even that does not fire |

**One thing is worse than reported.** The marker is written after opening a *PR*,
not after the registration merges — the pre-fix script wrote `PR_URL` into it. So
the gate closes on an *attempt*, permanently. A node whose registration PR was
closed without merging is recorded as "done" forever, having never been
registered at all.

The script also *already contained* the correct convergence check
(`gh api …/contents/<node.yaml>` → "already registered on main"). It was simply
unreachable once the marker existed: a working level-triggered test gated behind
a stale assertion about the past.

## The fix — converge, do not re-run

The marker becomes a **receipt**, never a gate. Each activation asks the level
question ("is the desired state present?") and acts only on divergence, so
apply-N ≡ apply-once by construction (manifesto §12). A `zeta-self-register.timer`
supplies recurrence; the service keeps its boot activation, so first-boot
enrolment timing is unchanged.

`zeta-self-register-ci` keeps its marker gate deliberately — it is a hermetic
one-shot compose proof in a throwaway VM, not a repair path.

## The failure mode this introduces, and its three bounds

A converger on a timer is a self-inflicted load source, and a fleet retrying hard
through a GitHub outage is a thundering herd.

1. **Read cadence** — 6h `OnUnitActiveSec` with 30min `RandomizedDelaySec`. ~4
   read-only calls/node/day, de-phased; a 100-node fleet is ~400/day against a
   5000/hr limit.
2. **In-boot retry** — `Restart=on-failure`/`RestartSec=30s` is kept for the "gh
   auth arrives a beat late" case but capped at `startLimitBurst=5` per
   `startLimitIntervalSec=600`. Safe because the 6h timer outlives the window.
3. **Write side (the sharp one)** — at most **one open registration PR per host**
   at a time, and at most one PR-creation *attempt* per 24h. A pathological
   once-a-minute run cannot open a second PR.

None of the three is a give-up: all expire, so the node always re-converges.
`Persistent` is deliberately omitted from the timer — replaying a missed window
is edge-triggered thinking, and it is how a fleet that was off during an outage
herds the moment it returns.

Also hardened, because a timer makes it reachable: **a failed check is not a
negative result.** The status probes now separate "definitely absent" (HTTP 404)
from "could not tell" (network/5xx/auth revoked) and refuse to act on the second.
Reading an unreachable API as "not registered" is how a converger becomes a PR
spammer during exactly the outage it should be quiet through.

## Scope

This fix stands regardless of open question 7.0 (routed to Kenji: new surface, or
capability of an existing tier?). A unit that cannot re-converge is broken under
any decomposition. Nothing here restructures the layer.

## What is checked, and what is not

**Checked:** `nix-instantiate --parse` on the module; `bash -n` + `shellcheck -S
warning` clean on the script; 12 new tests in
`src/Core.TypeScript/ci/self-register-reconvergence.test.ts` that *execute the
real script* under stubbed `gh`/`git` — **11 of the 12 fail against the pre-fix
script**, so they are falsifiers rather than decoration; 220 `src/Core.TypeScript/ci`
tests green; `tsc --noEmit` clean; `audit-installer-substrate` green, and its new
`mustNotContain` sentinel verified to fire on the pre-fix module.

**A second defect, found in self-review after the first push.** The in-flight-PR
matcher was written against `gh --json`'s COMPACT output (`"headRefName":"x"`).
`gh` pretty-prints to a TTY (`"headRefName": "x"`), which is the
operator-runs-it-by-hand case — and the compact-only matcher missed the in-flight
PR there, i.e. it failed in the duplicate-PR direction, defeating the very bound
this design leans on. Two layers were wrong: the whitespace, and the fact that the
per-object split is line-based while the pretty form spans several lines per
object. Both fixed, and both now witnessed by a test that fails without the fix.
It was found by reading the code, not by a failing test, which is exactly why it
got one.

**Checked in CI, and stronger than the line above claimed** (corrected after
watching the run — the original text said "`nix-instantiate --parse`", which
understated it): `build-ai-cluster-iso` went green on this branch, and it runs
`nix flake check --no-build --show-trace` over `full-ai-cluster`. That
**evaluates** the `nixosConfigurations`, which import `common.nix`, which imports
this module — so the option types (`ints.unsigned`, `str`), the
`systemd.timers.zeta-self-register` block, and `startLimitIntervalSec` /
`startLimitBurst` are validated by the real NixOS module system, not merely
parsed. The installer ISO also built, so the module survives into a system
closure.

**NOT checked — no node ever STARTED this unit.** The correction above must not
be read as more than it is: the NixOS VM tests in `full-ai-cluster/nixos/tests/`
import specific modules (`k3s-server.nix`, `k3s-agent.nix`,
`k3s-join-observer.nix`) and **do not import `common.nix`**, so none of them
brings up `zeta-self-register` — checked, rather than assumed, before writing
this. Evaluation proves the unit is well-formed; it proves nothing about
behaviour. Timer elapse, jitter, the `startLimitIntervalSec` interaction with
timer-driven starts, `StateDirectory` ownership of the receipt, and ordering
against `zeta-creds-restore` are **reviewed, not executed**. The stubs encode
what we believe `gh --json` returns; a change in gh's output shape would break a
node and not these tests. First real convergence on hardware remains unobserved.
