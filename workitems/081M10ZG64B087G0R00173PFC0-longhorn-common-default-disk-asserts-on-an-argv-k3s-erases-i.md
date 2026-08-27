---
id: 081M10ZG64B087G0R00173PFC0
type: bug
state: backlog
priority: P3
slug: longhorn-common-default-disk-asserts-on-an-argv-k3s-erases-i
title: "longhorn-common-default-disk asserts on an argv k3s erases, in a flake check no workflow invokes (doubly dead)"
created: 2026-08-27T06:46:13.387Z
depends_on: []
composes_with: ["081M10ZG63M087G0R000SG5KV6"]
---

# longhorn-common-default-disk asserts on an argv k3s erases, in a flake check no workflow invokes (doubly dead)

## Two independent deaths, either of which alone would be a defect

**Death 1 — the assertion cannot succeed.**
`full-ai-cluster/nixos/tests/longhorn-common-default-disk.nix:97`:

```python
server.succeed(
    "tr '\\0' ' ' < /proc/$(systemctl show -p MainPID --value k3s)/cmdline "
    "| grep -F 'node.longhorn.io/create-default-disk=config'"
)
```

**k3s erases its own argv.** `pkg/cli/server/server.go` opens `run()` with
`proctitle.SetProcTitle(os.Args[0] + " server")`, reaching
`github.com/erikdubbelboer/gspt` (a cgo port of BSD setproctitle) which
`memset`s the **whole** argv region and writes the short title back in place —
blanket, not per-secret. k3s-io/k3s PR #2072, commit 1eec7348, for issue #2014
*"Database password written to process list"*. Present in **every k3s since
v1.19.1+k3s1 (2020)**.

Measured on k3s 1.34.5+k3s1 (run 33040848262 step 13, the sibling test): the
cmdline is a **445-byte region whose first 74 bytes are
`/nix/store/...-k3s-1.34.5+k3s1/bin/k3s server` and whose remaining 371 bytes are
NUL.** The region keeps the length systemd exec'd it with, so the flags were
overwritten *after* exec rather than never passed. `tr` turns those NULs into
spaces and the grep matches nothing. This assertion has never been satisfiable on
any k3s this repo would ship.

**Death 2 — nothing runs it.**
`flake.nix:420` defines `checks.x86_64-linux.longhorn-common-default-disk`, and
`git grep 'longhorn-common-default-disk' -- '.github/**'` returns **empty**. Both
`nix flake check` invocations in the repo
(`build-ai-cluster-iso.yml:193` and `:920`) pass `--no-build`, so the derivation
is *evaluated* but the VM never boots.

## Why file something already inert

Because the two deaths mask each other, and fixing either alone is a trap. Wire
the check into a workflow without fixing the oracle and the lane goes red for a
reason that looks like a longhorn defect and is not. Fix the oracle without
wiring it and nothing changes, but the repo now *looks* like it checks this.

It is also the same root cause as #15810 in a second location — worth knowing
that the argv-erasure trap has two instances, so a third is plausible. `git grep
'/cmdline' -- 'full-ai-cluster/**' 'infra/**'` is the sweep; today it returns
only this file and the sibling's explanatory comments.

## The fix, if it is picked up

Same substitution #15810 made: read systemd's record of the argv it exec'd
(`systemctl show -p MainPID -p ExecStart k3s.service`), which is not scrubbed,
and bind the record's `pid=` to the live `MainPID` so a stale invocation cannot
answer for the current one. That test will also need a
`wait_for_unit("k3s.service")` — it currently waits only for
`multi-user.target`, so `MainPID` may be `0` and `/proc/0/cmdline` does not
exist.

Then decide, separately, whether the check earns a VM slot in a workflow. If it
does not, deleting it is more honest than leaving a `flake.checks` entry that
reads as coverage and provides none.

## Falsifier that closes this

Either (a) the check runs in a named workflow lane AND its assertion is
mutation-tested — remove the `--node-label` from the product module and it must
go red — or (b) the check is deleted with a note saying why. **What must not
remain is the current state: an unsatisfiable assertion inside an uninvoked
check.**

## Lineage

- #15810 — the same k3s argv-erasure defect in `k3s-server-join.nix`, with the upstream citation and the byte measurement
- 081M10ZG63M087G0R000SG5KV6 — sibling in kind: mechanical detection of checks that look like coverage and are not
