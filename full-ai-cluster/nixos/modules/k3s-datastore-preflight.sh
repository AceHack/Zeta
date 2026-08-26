#!/usr/bin/env bash
# k3s-datastore-preflight.sh — refuse to start k3s when a node PROVISIONED TO
# JOIN already holds a k3s datastore.
#
# k3s, verbatim from its own documentation:
#
#   "If an etcd datastore is found on disk ... the datastore arguments
#    (--cluster-init, --server, --datastore-endpoint, etc) are IGNORED."
#
# Every option `nixos/modules/injected-server-join.nix` sets is a datastore
# argument. So on a node that already holds a datastore a declarative join is a
# SILENT NO-OP: the unit starts, the flags parse, the disk wins, and the node
# quietly resumes being the cluster it already was. `systemctl status k3s` is
# green the whole time. That is how one intended cluster becomes two.
#
# IT DELETES NOTHING. A boot-path `rm -rf /var/lib/rancher/k3s/server` would
# "fix" this in one line and would be confiscation we introduced — irreversible
# destruction of the one thing on the machine that cannot be regenerated
# (manifesto §5). k3s already fails closed; the only thing missing was somebody
# saying so out loud. The remediation is printed and is the operator's to run.
#
# THIS FILE IS A STANDALONE SCRIPT, not a Nix string, so that it can be
# EXECUTED by a test rather than only read. `nixos/modules/k3s-datastore-preflight.nix`
# runs it as a systemd oneshot ordered `before` k3s.service and `requiredBy`
# it (fail-closed);
# `src/Core.TypeScript/hygiene/lint-k3s-datastore-preflight.test.ts` runs it
# over fixture directories and asserts each exit status — which matters because
# no workflow in this repository runs `nix flake check` on
# `full-ai-cluster/flake.nix`.
#
# Configuration is by environment so both callers can supply it:
#   ZETA_JOIN_URL_FILE   presence == "this node is provisioned to join"
#   ZETA_DATASTORE_DIR   the embedded-etcd datastore whose existence is fatal
#   ZETA_SERIAL_DEVICE   echoed to in addition to stdout, when writable
#
# Exit 0 = clear to start k3s. Exit 1 = refused, and k3s must not start.

set -u

JOIN_URL_FILE="${ZETA_JOIN_URL_FILE:-/etc/zeta/cluster-join-server-url}"
DATASTORE_DIR="${ZETA_DATASTORE_DIR:-/var/lib/rancher/k3s/server/db/etcd}"
SERIAL_DEVICE="${ZETA_SERIAL_DEVICE:-/dev/ttyS0}"

# The two markers are kept distinct on purpose, and neither is a prefix of the
# other: an operator grepping serial output for one must never match the other.
MARKER_REFUSED="[zeta-k3s-datastore-preflight]   REFUSED: provisioned to JOIN but a k3s datastore already exists"
MARKER_CLEAR="[zeta-k3s-datastore-preflight]   clear: no conflicting datastore"

say() {
  echo "$1"
  # Serial, when there is one. Never fatal if there is not — a machine with no
  # serial port must still get the refusal on its console.
  if [ -w "$SERIAL_DEVICE" ]; then
    echo "$1" > "$SERIAL_DEVICE" 2>/dev/null || true
  fi
}

if [ ! -f "$JOIN_URL_FILE" ]; then
  say "$MARKER_CLEAR (node is not provisioned to join; founding behaviour unchanged)"
  exit 0
fi

join_endpoint="$(cat "$JOIN_URL_FILE" 2>/dev/null || echo '<unreadable>')"

if [ ! -e "$DATASTORE_DIR" ]; then
  say "$MARKER_CLEAR (provisioned to join $join_endpoint; $DATASTORE_DIR absent)"
  exit 0
fi

say "$MARKER_REFUSED"
say "[zeta-k3s-datastore-preflight]   join endpoint : $join_endpoint"
say "[zeta-k3s-datastore-preflight]   datastore     : $DATASTORE_DIR"
say "[zeta-k3s-datastore-preflight]"
say "[zeta-k3s-datastore-preflight]   k3s IGNORES --cluster-init / --server / --token-file when a datastore"
say "[zeta-k3s-datastore-preflight]   already exists on disk. Starting k3s now would not join anything --"
say "[zeta-k3s-datastore-preflight]   it would silently resume the cluster this disk already holds, which is"
say "[zeta-k3s-datastore-preflight]   how one intended cluster becomes two sovereign ones."
say "[zeta-k3s-datastore-preflight]"
say "[zeta-k3s-datastore-preflight]   NOTHING HAS BEEN DELETED. This node's cluster state is intact and is"
say "[zeta-k3s-datastore-preflight]   yours to keep or to destroy deliberately. Two ways forward:"
say "[zeta-k3s-datastore-preflight]     (a) KEEP this cluster: remove $JOIN_URL_FILE and reboot. The node"
say "[zeta-k3s-datastore-preflight]         resumes its own cluster, which is what the disk says it is."
say "[zeta-k3s-datastore-preflight]     (b) JOIN the other cluster: re-flash from scratch so the install"
say "[zeta-k3s-datastore-preflight]         formats the disk. Deleting $DATASTORE_DIR by hand also works and"
say "[zeta-k3s-datastore-preflight]         is irreversible -- this unit will not do it for you."
exit 1
