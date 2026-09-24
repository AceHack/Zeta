---
id: 081M39CR74D087G0R002BEG2G4
type: task
state: backlog
priority: P1
slug: k3s-stillborn-datastore-recovery-has-ever-bootstrapped-senti
title: "k3s stillborn-datastore recovery: has-ever-bootstrapped sentinel for a power-cut in the first ~20s"
created: 2026-09-24T09:43:07.149Z
depends_on: ["081M39B2MDA087G0R003CCEJPQ"]
composes_with: []
---

# k3s stillborn-datastore recovery: has-ever-bootstrapped sentinel for a power-cut in the first ~20s

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M39CR74D087G0R002BEG2G4-*.md` glob. -->

## Diagnosis (resolves 081M39B2MDA087G0R003CCEJPQ)

WP27 measured, run 35968222668 (their branch: graceful teardown, NO self-heal --
kept its ESP marker, so unlike WP25's run it produced all six WP11 verdicts):

```
k3sServiceActive = false, NRestarts=58, Result=exit-code
76 x level=fatal msg="Error: preparing server: failed to bootstrap cluster data:
     failed to reconcile with local datastore: no bootstrap data found in datastore
     - check server token value and verify datastore integrity"
```

Independently of WP25's self-heal module, `error loading key from` was **0** on
WP27's run too (against 119 on `main`). Both fixes reach the same place from
different directions -- WP25 heals the truncation, WP27 stops CI manufacturing it
-- and underneath BOTH lies this third condition. WP25's ~495 restarts
(081M39B2MDA087G0R003CCEJPQ) are almost certainly this same fatal; it could not be
seen there because that run's verify unit was never enabled.

## The condition, and why it is a real metal defect, not a harness artefact

k3s creates `/var/lib/rancher/k3s/server/db`, gets roughly 20 seconds, and is
stopped before it writes bootstrap data into it. A non-empty datastore is the one
thing k3s will not initialise into, so it refuses forever. On metal: **an operator
who powers the machine off in the first ~20 seconds of its first boot --
impatience, a power cut, a tripped breaker -- gets a permanently wedged cluster
that no reboot recovers.** Same failure class as the zero-length truncation PR
#17608 fixed, one layer deeper, and the user's stated fear almost word for word.

## The naive fix is CATASTROPHIC -- do not weaken this

Deleting `/var/lib/rancher/k3s/server/db` when k3s reports that fatal is
confiscation of the one thing on the machine that cannot be regenerated (manifesto
§5), the exact thing `full-ai-cluster/nixos/modules/k3s-datastore-preflight.nix`
already refuses to do. k3s's own message is ALSO ambiguous by construction --
"check server token value AND verify datastore integrity" -- the same text appears
when a GOOD datastore is presented with a WRONG token, and deleting there would
destroy a healthy cluster.

## The shape to defend, and argue with first: a has-ever-bootstrapped sentinel

Write a marker exactly once, when k3s has DEMONSTRABLY completed bootstrap (API
serving, node registered -- pick something observable, not assumed). Before that
marker exists, a datastore k3s refuses to bootstrap into is STILLBORN: it has never
held anything, so discarding it destroys no state and the §5 objection does not
apply. After the marker exists, the datastore is NEVER touched under any
circumstance, and the fatal becomes a loud refusal with the remedy printed instead
of a silent 70-minute crash-loop.

**The one-way property to state in the module header:** the recovery window opens
at first boot and closes forever the first time the cluster works.

## Requirements

1. Prove BOTH the stillborn case and the has-served case as executable tests over
   fixtures, same discipline as `k3s-agent-tls-self-heal.sh` /
   `k3s-agent-tls-self-heal.test.ts`. The has-served test is the important one -- it
   must fail if the guard ever lets a real datastore be removed.
2. A loud-refusal path must exist even when recovery is declined (post-marker, or
   the ambiguous-fatal case) -- a crash-loop that says nothing for 70 minutes is how
   this cost a whole night. Bound it: after N consecutive fatals, print the
   diagnosis and the remedy to the console AND the serial.
3. Do NOT couple any of this to the WP11 ESP marker -- that marker just proved it
   can go missing silently, and the diagnostics that would have caught the 495-
   restart case were gated behind it. Whatever is built must speak on every boot, on
   metal, with no harness present.
4. New branch off current `main`, new PR, this ZetaId. Do NOT stack on #17608 --
   that one lands on its own 119->0 evidence, unrelated to this condition.

## Explicitly out of scope here

WP27 is separately removing the artificial phase-2/phase-3 reboot from the harness
(qemu-full-install-test.ts) -- on metal there is ONE first boot and the CI split is
what manufactures this condition in CI. That is WP27's surface; this workitem is
the machine that loses power for real, on metal, where no harness split exists to
remove.

## Evidence

- Run 35968222668 (WP27's branch, graceful teardown only): the six verdicts +
  NRestarts=58 + the 76x fatal message quoted above.
- Run 35965945581 (WP25's branch, self-heal only): ~495 restarts, no verdict unit
  (081M39B2MDA087G0R003CCEJPQ), now understood to be the same fatal.
- Run 35960376641 (`main`, `schedule`): the original before-control, 119 `error
  loading key from`.
- `full-ai-cluster/nixos/modules/k3s-datastore-preflight.nix`: the standing refusal
  discipline (never delete, refuse loudly instead) this fix must extend, not
  contradict.
