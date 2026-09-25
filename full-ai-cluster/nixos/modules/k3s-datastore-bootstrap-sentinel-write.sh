#!/usr/bin/env bash
# k3s-datastore-bootstrap-sentinel-write.sh — write the has-ever-bootstrapped
# sentinel EXACTLY ONCE, when k3s has DEMONSTRABLY completed bootstrap (a
# real `/readyz` success), never before, never again after it exists.
#
# 081M39CR74D087G0R002BEG2G4. This is the write side of the guard
# `k3s-datastore-bootstrap-recovery.sh` (this module's sibling) reads:
# before this sentinel exists, a datastore k3s refuses to bootstrap into is
# STILLBORN and safe to discard; after it exists, the same datastore is
# real and is never touched under any circumstance. The one-way property
# depends entirely on this script never writing early and never being
# fooled into re-writing (write-once is enforced by checking existence
# FIRST, unconditionally, before doing anything else that could observe a
# transient false success).
#
# THE WRITER'S HEALTH IS A PRECONDITION OF THE READER'S SAFETY. READ THIS
# BEFORE CHANGING READYZ_CMD BELOW.
#
# The recovery script's entire licence to delete anything is "no sentinel
# means this datastore never served". That inference is only sound while
# THIS script can actually write the sentinel. If READYZ_CMD ever stops
# succeeding -- a typo, k3s dropped from the unit's `path`, a moved
# kubeconfig, an endpoint k3s renames -- then the sentinel is never written
# on any node, every HEALTHY datastore reads as stillborn forever, and the
# module whose purpose is to prevent data loss begins causing it, on every
# node, with the recovery path firing exactly as designed.
#
# Nothing else in the pair can detect that. The recovery script cannot tell
# "never served" from "served, but the writer is broken" -- they are the
# same absence. So this script's failure branch REFUSES TO BE SILENT: it
# prints `VERDICT waiting-for-readyz` once per boot, naming the sentinel it
# is not writing. A node that prints that line and never follows it with
# "this datastore has now served" is a node where this command is broken,
# and that is the only warning that will ever arrive.
#
# `nixos/tests/k3s-datastore-bootstrap-sentinel.nix` is the falsifier: it
# boots a real k3s and asserts the DEFAULT command below genuinely succeeds
# from inside this unit. A change to READYZ_CMD that passes the fixture
# tests and fails that one is the inversion described above.
#
# WHY readyz AND NOT "k3s.service is active": `systemctl is-active` answers
# whether the PROCESS is running, not whether the CLUSTER bootstrapped --
# exactly the gap that produces this whole defect class (a process can be
# "active" while its datastore never received bootstrap data). `/readyz` is
# k3s's own API-server health endpoint; a real 200 from it is k3s asserting
# its own control plane is live, which cannot happen against a datastore
# that never finished bootstrapping.
#
# TESTABLE BY CONSTRUCTION: the readyz check is a COMMAND STRING from an
# environment variable with a real-world default, so
# `k3s-datastore-bootstrap-recovery.test.ts` can execute this exact script
# with a fake command ("true" / "false") and a fixture sentinel path, and
# prove write-once directly, without a running k3s anywhere.
#
# NEVER FAILS THE CALLER: always exits 0.

set -u

SENTINEL_FILE="${ZETA_SENTINEL_FILE:-/var/lib/rancher/k3s/server/db/.zeta-datastore-has-served}"
READYZ_CMD="${ZETA_K3S_READYZ_CMD:-KUBECONFIG=/etc/rancher/k3s/k3s.yaml k3s kubectl get --raw=/readyz}"
SERIAL_DEVICE="${ZETA_SERIAL_DEVICE:-/dev/ttyS0}"

say() {
  echo "$1"
  if [ -w "$SERIAL_DEVICE" ]; then
    echo "$1" > "$SERIAL_DEVICE" 2>/dev/null || true
  fi
}

# WRITE-ONCE, CHECKED FIRST: if the sentinel already exists, this script has
# nothing to do -- not even the readyz check runs. This is what makes the
# one-way property hold regardless of anything readyz does afterward.
if [ -e "$SENTINEL_FILE" ]; then
  exit 0
fi

if eval "$READYZ_CMD" >/dev/null 2>&1; then
  mkdir -p "$(dirname -- "$SENTINEL_FILE")" 2>/dev/null || true
  # write-new-then-rename: a killed-mid-write sentinel must never look like
  # a valid one to a script re-checking `-e` on the next boot -- a partial
  # write at the FINAL path would itself be a truncated-file bug of exactly
  # the shape k3s-agent-tls-self-heal.sh exists to fix, reintroduced here.
  if date -u +%Y-%m-%dT%H:%M:%SZ > "$SENTINEL_FILE.tmp" 2>/dev/null; then
    mv -f -- "$SENTINEL_FILE.tmp" "$SENTINEL_FILE" 2>/dev/null || true
  fi
  if [ -e "$SENTINEL_FILE" ]; then
    say "[zeta-k3s-datastore-bootstrap-sentinel]   this datastore has now served (readyz succeeded); wrote $SENTINEL_FILE -- it will never be auto-discarded again."
  fi
  exit 0
fi

# READYZ HAS NOT SUCCEEDED YET. Say so ONCE per boot, and never again.
#
# This branch is the one that can silently destroy a cluster, which is why
# it refuses to be quiet. If the default READYZ_CMD above is ever wrong --
# a typo, k3s absent from the unit's `path`, a moved kubeconfig -- then
# readyz never succeeds, the sentinel is never written, and a datastore
# that HAS served looks stillborn to the recovery script forever. The
# failure would be invisible: a unit running happily, doing nothing,
# reporting nothing. One line per boot is what makes it visible instead.
WAITING_STATE_FILE="${ZETA_WAITING_STATE_FILE:-/run/zeta-k3s-datastore-bootstrap-sentinel.waiting}"
if [ ! -e "$WAITING_STATE_FILE" ]; then
  say "[zeta-k3s-datastore-bootstrap-sentinel]   VERDICT waiting-for-readyz: k3s has not yet answered readyz, so ${SENTINEL_FILE} is NOT written and this datastore does not yet count as having served. Polling."
  mkdir -p "$(dirname -- "$WAITING_STATE_FILE")" 2>/dev/null || true
  : > "$WAITING_STATE_FILE" 2>/dev/null || true
fi

exit 0
