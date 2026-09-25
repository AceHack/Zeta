#!/usr/bin/env bash
# k3s-datastore-bootstrap-recovery.sh — recover a STILLBORN k3s datastore (one
# that has NEVER completed bootstrap) after a power cut in the first ~20
# seconds of a founding node's first boot; refuse loudly, and touch NOTHING,
# for every other shape of the same crash-loop.
#
# 081M39CR74D087G0R002BEG2G4. MEASURED (WP27's run 35968222668, graceful
# teardown, no self-heal -- the ESP marker was intact so all six WP11
# verdicts fired): k3sServiceActive=false, NRestarts=58, Result=exit-code,
# and 76x in the journal:
#
#   level=fatal msg="Error: preparing server: failed to bootstrap cluster
#   data: failed to reconcile with local datastore: no bootstrap data found
#   in datastore - check server token value and verify datastore integrity"
#
# k3s creates /var/lib/rancher/k3s/server/db, gets roughly 20 seconds, and is
# stopped before it writes bootstrap data into it. A non-empty datastore is
# the one thing k3s will not initialise into, so it refuses forever. On
# metal: an operator who powers the machine off in the first ~20 seconds of
# its first boot -- impatience, a power cut, a tripped breaker -- gets a
# permanently wedged cluster that no reboot recovers. WP25's own ~495
# restarts (081M39B2MDA087G0R003CCEJPQ) are the same fatal, just unobserved
# because that run's verify unit never ran.
#
# THE NAIVE FIX IS CATASTROPHIC, AND THIS SCRIPT DOES NOT DO IT. Deleting the
# datastore whenever k3s reports this fatal is confiscation of the one thing
# on the machine that cannot be regenerated (manifesto §5) -- the exact thing
# `k3s-datastore-preflight.sh` already refuses to do, for the dirty-disk
# case. k3s's OWN message is ambiguous by construction ("check server token
# value AND verify datastore integrity") -- the identical text appears when
# a GOOD, already-served datastore is presented with a WRONG token, and
# deleting there would destroy a healthy cluster.
#
# THE GUARD: A HAS-EVER-BOOTSTRAPPED SENTINEL, WRITTEN ELSEWHERE. This
# script never writes the sentinel itself --
# `k3s-datastore-bootstrap-sentinel-write.sh` (this module's sibling) writes
# it exactly once, when k3s has DEMONSTRABLY completed bootstrap (a real
# `/readyz` success, not something assumed). This script only ever READS it:
#
#   - Sentinel ABSENT + the fatal signature + enough restarts to be sure =
#     STILLBORN. This datastore has never held anything a client ever
#     depended on, so discarding it destroys no state. Recover: delete ONLY
#     the datastore directory, restart k3s, done -- ONCE per boot, ever.
#   - Sentinel PRESENT + the fatal signature = AMBIGUOUS, almost certainly a
#     wrong token presented to a real, already-served cluster. NEVER
#     deleted, regardless of restart count. Loud refusal with the remedy
#     instead.
#   - The fatal signature ABSENT = some OTHER crash-loop. Not this script's
#     problem to fix; a loud, one-time diagnostic dump instead of silence.
#
# THE ONE-WAY PROPERTY: the recovery window opens at first boot and closes
# FOREVER the first time the cluster works. There is no code path in this
# script that can re-open it once the sentinel exists.
#
# SCOPE, STRICT: the ONLY path ever removed is $ZETA_DATASTORE_DIR (default
# /var/lib/rancher/k3s/server/db) -- never server/tls, never server/cred,
# never anything named by path concatenation or a wildcard. And even that is
# removed at most ONCE per boot: a marker file records the attempt, and a
# second round of the same fatal after one recovery attempt gets the loud
# diagnostic path, not a second wipe.
#
# TESTABLE BY CONSTRUCTION: every external dependency (how to read the
# restart count, how to read the journal, how to restart k3s) is a
# COMMAND STRING read from an environment variable with a real-world
# default, so `src/Core.TypeScript/hygiene/k3s-datastore-bootstrap-recovery.test.ts`
# can execute this exact script with fake commands and fixture files and
# prove the has-served case is never touched, without a running systemd or
# k3s anywhere.
#
# NEVER FAILS THE CALLER: this script always exits 0. It is meant to run in
# a loop (systemd `Restart=always`), and its own failure must never become a
# new thing to crash-loop about.

set -u

SENTINEL_FILE="${ZETA_SENTINEL_FILE:-/var/lib/rancher/k3s/server/db/.zeta-datastore-has-served}"
DATASTORE_DIR="${ZETA_DATASTORE_DIR:-/var/lib/rancher/k3s/server/db}"
RECOVERY_ATTEMPTED_FILE="${ZETA_RECOVERY_ATTEMPTED_FILE:-/var/lib/rancher/k3s/server/.zeta-stillborn-recovery-attempted}"
NRESTARTS_CMD="${ZETA_K3S_NRESTARTS_CMD:-systemctl show k3s.service -p NRestarts --value}"
JOURNAL_CMD="${ZETA_K3S_JOURNAL_CMD:-journalctl -u k3s.service -n 80 --no-pager -o cat}"
RESTART_CMD="${ZETA_K3S_RESTART_CMD:-systemctl restart k3s.service}"
THRESHOLD="${ZETA_RESTART_THRESHOLD:-6}"
SERIAL_DEVICE="${ZETA_SERIAL_DEVICE:-/dev/ttyS0}"
FATAL_SIGNATURE="no bootstrap data found in datastore"

say() {
  echo "$1"
  if [ -w "$SERIAL_DEVICE" ]; then
    echo "$1" > "$SERIAL_DEVICE" 2>/dev/null || true
  fi
}

# Independent guard, same shape as k3s-agent-tls-self-heal.sh's "server"
# refusal: whatever ZETA_DATASTORE_DIR is set to, refuse outright (do
# nothing) if it does not end in exactly ".../server/db" -- this stops a
# misconfiguration from ever pointing this script's one `rm -rf` at
# server/tls, server/cred, or anything else.
case "$DATASTORE_DIR" in
  */server/db) ;;
  *)
    say "[zeta-k3s-datastore-bootstrap-recovery]   refusing: ZETA_DATASTORE_DIR ($DATASTORE_DIR) does not end in 'server/db'; this script only ever operates on the datastore directory. Doing nothing."
    exit 0
    ;;
esac

nrestarts="$(eval "$NRESTARTS_CMD" 2>/dev/null || echo 0)"
case "$nrestarts" in
  '' | *[!0-9]*) nrestarts=0 ;;
esac

if [ "$nrestarts" -lt "$THRESHOLD" ]; then
  # Not enough evidence yet. Quiet -- this script is invoked in a poll loop
  # (systemd Restart=always) and will be asked again shortly.
  exit 0
fi

journal="$(eval "$JOURNAL_CMD" 2>/dev/null || echo '')"

if ! printf '%s' "$journal" | grep -qF "$FATAL_SIGNATURE"; then
  # Crash-looping, but NOT with the signature this script knows how to
  # recover from. Loud, generic, and printed ONCE (RECOVERY_ATTEMPTED_FILE
  # doubles as "already reported" here) -- silence for 70 minutes is the
  # defect this whole mechanism exists to end.
  if [ ! -e "$RECOVERY_ATTEMPTED_FILE" ]; then
    say "[zeta-k3s-datastore-bootstrap-recovery]   k3s.service has restarted ${nrestarts} times and is NOT exhibiting the known stillborn-datastore fatal ('$FATAL_SIGNATURE')."
    say "[zeta-k3s-datastore-bootstrap-recovery]   This script only knows how to recover that one condition. Diagnosis needed; last ${nrestarts} restarts' worth of journal follows:"
    printf '%s\n' "$journal" | while IFS= read -r line; do
      say "[zeta-k3s-datastore-bootstrap-recovery]   $line"
    done
    : > "$RECOVERY_ATTEMPTED_FILE"
  fi
  exit 0
fi

# The stillborn-shaped fatal IS present.
if [ -e "$SENTINEL_FILE" ]; then
  # THIS DATASTORE HAS SERVED BEFORE. NEVER DELETE IT, under any
  # circumstance -- the one-way property. This is very likely a wrong
  # token presented to a real, healthy cluster; k3s's own error text
  # cannot distinguish that from the stillborn case, but the sentinel can.
  if [ ! -e "$RECOVERY_ATTEMPTED_FILE" ]; then
    say "[zeta-k3s-datastore-bootstrap-recovery]   REFUSING: k3s reports \"$FATAL_SIGNATURE\" but this datastore has ALREADY served -- sentinel present at $SENTINEL_FILE."
    say "[zeta-k3s-datastore-bootstrap-recovery]   This is very likely a WRONG TOKEN, not a stillborn datastore: k3s's own message cannot tell the two apart, but a served datastore is never touched here regardless. NOTHING HAS BEEN DELETED."
    say "[zeta-k3s-datastore-bootstrap-recovery]   Remedy: verify /var/lib/rancher/k3s/server/token matches what agents present, or restore $DATASTORE_DIR from an out-of-band backup. This script will not act on it."
    : > "$RECOVERY_ATTEMPTED_FILE"
  fi
  exit 0
fi

if [ -e "$RECOVERY_ATTEMPTED_FILE" ]; then
  # Already recovered (or reported) once this boot. One attempt, ever, per
  # boot -- if it is STILL failing with the same signature after a fresh
  # datastore, wiping again would not be recovery, it would be a loop.
  say "[zeta-k3s-datastore-bootstrap-recovery]   k3s is still failing with the stillborn signature after one recovery attempt this boot. Not retrying automatically -- this needs a human."
  exit 0
fi

# STILLBORN, RECOVERABLE: enough restarts, the exact fatal, no sentinel, no
# prior attempt this boot. Discarding this datastore destroys no state --
# nothing has ever read from or written to it as a completed bootstrap.
say "[zeta-k3s-datastore-bootstrap-recovery]   RECOVERING: k3s.service has restarted ${nrestarts} times reporting \"$FATAL_SIGNATURE\", and $SENTINEL_FILE does not exist -- this datastore has NEVER served. Discarding it destroys no state."
say "[zeta-k3s-datastore-bootstrap-recovery]   Removing $DATASTORE_DIR and restarting k3s.service to found fresh."
: > "$RECOVERY_ATTEMPTED_FILE"
rm -rf -- "$DATASTORE_DIR"
eval "$RESTART_CMD" || true
exit 0
