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

# EVERY OUTCOME SPEAKS, AND THEY ARE DISTINGUISHABLE FROM EACH OTHER.
#
# The defect class this whole module exists inside of is a check whose
# FAILURE and whose ABSENCE look identical -- silence. The first revision of
# this script printed only on the paths where it ACTED, so a boot on which
# it decided "nothing to do" was byte-identical, on the console, to a boot on
# which the unit never started at all. That is the seventh instance of the
# same defect, written into the fix for the sixth.
#
# So every terminal path below ends in `verdict <code> <sentence>`, and the
# codes are mutually exclusive. The three that matter most, named:
#
#   stillborn-recovered  no sentinel, the datastore had never served, it was
#                        discarded so k3s could found fresh
#   served / served-refused
#                        the sentinel is present; this datastore has served
#                        and is NEVER touched, whatever k3s is reporting
#   datastore-absent     there is no datastore directory at all -- nothing to
#                        recover and nothing at risk
#
# PRINTED ONCE PER BOOT PER DISTINCT VERDICT, not once per poll: the unit
# restarts every 10s forever, so printing unconditionally would bury the
# console, and latching the FIRST verdict of the boot would report
# "watching" on a node that went on to recover. Recording the last verdict
# and printing only on CHANGE gives exactly one line per outcome that
# actually occurred, in the order they occurred -- the boot's whole story,
# in one line each. The state file lives on /run (tmpfs), so it is empty
# again at every boot without anything having to clean it up.
VERDICT_STATE_FILE="${ZETA_VERDICT_STATE_FILE:-/run/zeta-k3s-datastore-bootstrap-recovery.verdict}"

verdict() {
  verdict_code="$1"
  verdict_sentence="$2"
  verdict_previous=""
  if [ -e "$VERDICT_STATE_FILE" ]; then
    verdict_previous="$(cat "$VERDICT_STATE_FILE" 2>/dev/null || echo '')"
  fi
  if [ "$verdict_previous" != "$verdict_code" ]; then
    say "[zeta-k3s-datastore-bootstrap-recovery]   VERDICT ${verdict_code}: ${verdict_sentence}"
    mkdir -p "$(dirname -- "$VERDICT_STATE_FILE")" 2>/dev/null || true
    printf '%s' "$verdict_code" > "$VERDICT_STATE_FILE" 2>/dev/null || true
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

# OUTCOME 3 OF 3: THERE IS NO DATASTORE AT ALL. Checked before anything else
# reads a restart count or a journal, because "no datastore" and "a datastore
# I decided not to touch" are completely different facts about this machine
# and must never arrive as the same silence. Nothing to recover, nothing at
# risk -- k3s has not created its datastore yet (very early first boot), or
# this is not a server role.
if [ ! -d "$DATASTORE_DIR" ]; then
  verdict datastore-absent "no k3s datastore directory exists at ${DATASTORE_DIR} -- nothing to recover, and nothing at risk."
  exit 0
fi

# OUTCOME 2 OF 3: THE SENTINEL IS PRESENT -- THIS DATASTORE HAS SERVED.
#
# STRUCTURALLY FIRST, ON PURPOSE. This branch returns before the recovery
# code below is even REACHABLE, so the one-way property ("the window closes
# forever the first time the cluster works") is a property of the script's
# SHAPE and not of a condition someone has to re-verify by reading to the
# end. Nothing after this point can run while the sentinel exists.
if [ -e "$SENTINEL_FILE" ]; then
  if [ "$nrestarts" -ge "$THRESHOLD" ] &&
     printf '%s' "$(eval "$JOURNAL_CMD" 2>/dev/null || echo '')" | grep -qF "$FATAL_SIGNATURE"; then
    # The ambiguous case this module exists for: k3s's own message cannot
    # tell "never bootstrapped" from "wrong token against a real cluster".
    # The sentinel can, and it says this one is real.
    if [ ! -e "$RECOVERY_ATTEMPTED_FILE" ]; then
      say "[zeta-k3s-datastore-bootstrap-recovery]   REFUSING: k3s reports \"$FATAL_SIGNATURE\" but this datastore has ALREADY served -- sentinel present at $SENTINEL_FILE."
      say "[zeta-k3s-datastore-bootstrap-recovery]   This is very likely a WRONG TOKEN, not a stillborn datastore: k3s's own message cannot tell the two apart, but a served datastore is never touched here regardless. NOTHING HAS BEEN DELETED."
      say "[zeta-k3s-datastore-bootstrap-recovery]   Remedy: verify /var/lib/rancher/k3s/server/token matches what agents present, or restore $DATASTORE_DIR from an out-of-band backup. This script will not act on it."
      : > "$RECOVERY_ATTEMPTED_FILE"
    fi
    verdict served-refused "marker present at ${SENTINEL_FILE} and k3s is reporting the stillborn fatal -- refusing to touch ${DATASTORE_DIR}; nothing has been deleted."
  else
    verdict served "marker present at ${SENTINEL_FILE} -- this datastore has served and will never be auto-discarded; nothing to do."
  fi
  exit 0
fi

# From here down the sentinel does NOT exist.
if [ "$nrestarts" -lt "$THRESHOLD" ]; then
  # Not enough evidence yet -- but say so once, rather than exiting silently.
  # This is the ordinary shape of a healthy first boot before k3s has
  # finished bootstrapping, and it must be distinguishable from a unit that
  # never ran.
  verdict unbootstrapped-watching "datastore at ${DATASTORE_DIR} has not served yet and k3s has restarted ${nrestarts} time(s) (threshold ${THRESHOLD}) -- watching, nothing done."
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
  verdict other-crash-loop "k3s has restarted ${nrestarts} time(s) but NOT with the stillborn fatal -- ${DATASTORE_DIR} untouched; this needs diagnosis, journal dumped above."
  exit 0
fi

# The stillborn-shaped fatal IS present, and the sentinel does not exist
# (the has-served branch above already returned if it did).
if [ -e "$RECOVERY_ATTEMPTED_FILE" ]; then
  # Already recovered (or reported) once this boot. One attempt, ever, per
  # boot -- if it is STILL failing with the same signature after a fresh
  # datastore, wiping again would not be recovery, it would be a loop.
  say "[zeta-k3s-datastore-bootstrap-recovery]   k3s is still failing with the stillborn signature after one recovery attempt this boot. Not retrying automatically -- this needs a human."
  verdict stillborn-recovery-exhausted "one recovery already happened this boot and k3s still reports the stillborn fatal -- not retrying; this needs a human."
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
verdict stillborn-recovered "no marker at ${SENTINEL_FILE} and k3s reported the stillborn fatal ${nrestarts} restart(s) in -- ${DATASTORE_DIR} was discarded so k3s can found fresh; no state was destroyed."
exit 0
