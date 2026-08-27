#!/usr/bin/env bash
# k3s-join-intent-preflight.sh — refuse to start k3s when a node PROVISIONED TO
# JOIN resolved to a FOUNDING configuration.
#
# THE FAILURE THIS RULES OUT, in its own module's words
# (`nixos/modules/injected-server-join.nix`):
#
#   "PURE EVAL IS A SILENT NO-OP ... `builtins.pathExists` on an absolute path
#    returns FALSE under pure eval (measured 2026-08-21, Nix 2.34.6), so a
#    `nixos-rebuild` without `--impure` reverts a joining server to a FOUNDING
#    one. That is the worst reversion in this family -- it re-founds a
#    sovereign cluster on a node that was a member."
#
# WHY THE EXISTING GUARDS DO NOT COVER IT.
#
#   * `lint-nixos-rebuild-needs-impure.ts` checks that DOCUMENTED rebuild
#     strings carry `--impure`. That is a lint over prose. It cannot see a
#     human typing the command, a tool composing it, or any path the corpus
#     does not contain.
#   * `k3s-datastore-preflight.sh` -- the sibling this file is modelled on --
#     refuses when a join-provisioned node ALREADY HOLDS a datastore, and says
#     so plainly: "On a genuinely from-scratch flash that is fine -- there is
#     no datastore, so nothing is ignored."
#
# A FRESHLY FORMATTED MACHINE IS EXACTLY THE UNCOVERED CASE, and it is the one
# an operator performs on purpose: flash machine 2 from USB, have it join
# machine 1. There is no prior datastore, so the sibling passes. If evaluation
# did not see `/etc/zeta` -- pure eval, a staging symlink that did not land, a
# path typo, a refactor -- the node comes up as a healthy sovereign cluster of
# ONE. `systemctl status k3s` is green. `kubectl get nodes` is green on both
# machines and shows one node each. Nothing errors. The operator finds out by
# noticing the second machine never appeared in the first's node list.
#
# THE COMPARISON, and why it cannot be made at evaluation alone. Two facts,
# recorded at two different times:
#
#   INTENT   read at BOOT, from the disk    -- `/etc/zeta/cluster-join-server-url`
#   OUTCOME  baked at BUILD, from the eval  -- the resolved k3s options
#
# When evaluation cannot see the intent there is nothing left at eval time to
# compare against; the reversion is invisible precisely because the input went
# missing. Reading the intent a SECOND time, at boot, from the disk it is
# actually on, is what makes the disagreement observable -- and it catches the
# reversion regardless of WHY eval missed the file.
#
# IT DELETES NOTHING and it starts nothing. Same discipline as the sibling: the
# remediation is printed and is the operator's to run (manifesto §5).
#
# Configuration is by environment so a test can supply it:
#   ZETA_JOIN_URL_FILE            presence == "this node is provisioned to join"
#   ZETA_JOIN_TOKEN_FILE          the staged credential
#   ZETA_RESOLVED_CLUSTER_INIT    "true"/"false" -- config.services.k3s.clusterInit
#   ZETA_RESOLVED_SERVER_ADDR     config.services.k3s.serverAddr ("" == founding)
#   ZETA_ROLE                     "server" or "agent"
#   ZETA_SERIAL_DEVICE            echoed to in addition to stdout, when writable
#
# Exit 0 = the resolved config agrees with the disk. Exit 1 = refused.

set -u

JOIN_URL_FILE="${ZETA_JOIN_URL_FILE:-/etc/zeta/cluster-join-server-url}"
JOIN_TOKEN_FILE="${ZETA_JOIN_TOKEN_FILE:-/etc/zeta/k3s-join-token}"
RESOLVED_CLUSTER_INIT="${ZETA_RESOLVED_CLUSTER_INIT:-unknown}"
RESOLVED_SERVER_ADDR="${ZETA_RESOLVED_SERVER_ADDR:-}"
ROLE="${ZETA_ROLE:-server}"
SERIAL_DEVICE="${ZETA_SERIAL_DEVICE:-/dev/ttyS0}"

# Distinct markers, neither a prefix of the other, so an operator grepping
# serial output for one can never match the other.
MARKER_REVERTED="[zeta-k3s-join-intent]   REFUSED: provisioned to JOIN but resolved to FOUND"
MARKER_HALF="[zeta-k3s-join-intent]   REFUSED: provisioned to join with an unusable endpoint"
MARKER_CLEAR="[zeta-k3s-join-intent]   clear: resolved configuration agrees with the disk"

say() {
  echo "$1"
  if [ -w "$SERIAL_DEVICE" ]; then
    echo "$1" > "$SERIAL_DEVICE" 2>/dev/null || true
  fi
}

# No intent on disk: founding is what this node is for, and this unit has
# nothing to say. Sovereign-by-default is the tree's deliberate posture
# (`k3s-server.nix`: `clusterInit = lib.mkDefault true`), never an accident to
# be corrected here.
if [ ! -f "$JOIN_URL_FILE" ]; then
  say "$MARKER_CLEAR (node is not provisioned to join; founding behaviour unchanged)"
  exit 0
fi

join_endpoint="$(cat "$JOIN_URL_FILE" 2>/dev/null || echo '')"
# Trim: a trailing newline from `echo >` staging is normal and must not read as
# content, while a file of only whitespace must not read as an endpoint.
trimmed_endpoint="$(printf '%s' "$join_endpoint" | tr -d '[:space:]')"

if [ -z "$trimmed_endpoint" ]; then
  say "$MARKER_HALF"
  say "[zeta-k3s-join-intent]   $JOIN_URL_FILE exists but carries no endpoint."
  say "[zeta-k3s-join-intent]   A node provisioned to join with no address to join WOULD FOUND its own"
  say "[zeta-k3s-join-intent]   cluster. Refusing is the quieter outcome of the two."
  say "[zeta-k3s-join-intent]   Remediation: write the endpoint into $JOIN_URL_FILE and reboot, or"
  say "[zeta-k3s-join-intent]   remove the file to found deliberately."
  exit 1
fi

# The outcome half. `serverAddr` is the field that means "joining" for BOTH
# roles; `clusterInit` is meaningful only for a server. Checking `serverAddr`
# first means the agent path is covered by the same branch rather than by an
# untaken one.
reverted=0
reason=""
if [ -z "$RESOLVED_SERVER_ADDR" ]; then
  reverted=1
  reason="services.k3s.serverAddr resolved EMPTY"
elif [ "$ROLE" = "server" ] && [ "$RESOLVED_CLUSTER_INIT" = "true" ]; then
  reverted=1
  reason="services.k3s.clusterInit resolved TRUE"
fi

if [ "$reverted" -eq 0 ]; then
  say "$MARKER_CLEAR (joining $trimmed_endpoint; serverAddr=$RESOLVED_SERVER_ADDR clusterInit=$RESOLVED_CLUSTER_INIT)"
  exit 0
fi

# The credential's PRESENCE is diagnostic and its CONTENT is never read: a
# token echoed to console and serial would be a secret leaked by the very unit
# meant to make things safer.
if [ -f "$JOIN_TOKEN_FILE" ]; then
  token_state="present"
else
  token_state="ABSENT"
fi

say "$MARKER_REVERTED"
say "[zeta-k3s-join-intent]   role            : $ROLE"
say "[zeta-k3s-join-intent]   disk says JOIN  : $JOIN_URL_FILE -> $trimmed_endpoint"
say "[zeta-k3s-join-intent]   join token      : $JOIN_TOKEN_FILE ($token_state, content never read)"
say "[zeta-k3s-join-intent]   build says FOUND: $reason"
say "[zeta-k3s-join-intent]"
say "[zeta-k3s-join-intent]   The configuration this node BOOTED does not carry the join the disk was"
say "[zeta-k3s-join-intent]   provisioned for. Starting k3s now would not join $trimmed_endpoint --"
say "[zeta-k3s-join-intent]   it would FOUND a second sovereign cluster, and every surface would look"
say "[zeta-k3s-join-intent]   healthy while it did: the unit goes active, the node goes Ready, and"
say "[zeta-k3s-join-intent]   'kubectl get nodes' shows one node on each machine."
say "[zeta-k3s-join-intent]"
say "[zeta-k3s-join-intent]   MOST LIKELY CAUSE: the configuration was evaluated WITHOUT --impure, so"
say "[zeta-k3s-join-intent]   builtins.pathExists returned false for /etc/zeta/* and the join inputs"
say "[zeta-k3s-join-intent]   were invisible to evaluation. zeta-install.sh passes --impure; a"
say "[zeta-k3s-join-intent]   hand-run 'nixos-rebuild switch' without it does not."
say "[zeta-k3s-join-intent]"
say "[zeta-k3s-join-intent]   NOTHING HAS BEEN DELETED and nothing has been started. Two ways forward:"
say "[zeta-k3s-join-intent]     (a) JOIN, as the disk says: re-run the rebuild WITH --impure, e.g."
say "[zeta-k3s-join-intent]         nixos-rebuild switch --impure --flake /etc/nixos#<host>"
say "[zeta-k3s-join-intent]     (b) FOUND deliberately: remove $JOIN_URL_FILE and reboot. The node"
say "[zeta-k3s-join-intent]         then founds its own cluster because you said so, not because an"
say "[zeta-k3s-join-intent]         evaluation flag went missing."
exit 1
