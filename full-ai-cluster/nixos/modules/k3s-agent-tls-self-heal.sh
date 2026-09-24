#!/usr/bin/env bash
# k3s-agent-tls-self-heal.sh — delete ZERO-LENGTH files that block k3s's own
# node-bootstrap handshake, so a truncated write (an unclean stop mid-first-
# boot: this harness's own VM kill, or on real hardware a power cut) does not
# wedge k3s's own cert/registration bootstrap forever.
#
# WP25 (081M38G8NGC087G0R001GEGEDK). THREE TARGETS, EACH MEASURED ON A REAL
# RUN OF THIS EXACT FIX, IN SEQUENCE -- fixing the first exposed the second:
#
# TARGET 1 -- an ALLOWLIST of two places under /var/lib/rancher/k3s/agent,
# never a sweep of the whole tree. ROOT CAUSE, MEASURED on run 35927439681:
# k3s.service stuck `activating` for 70+ minutes, retrying "error loading key
# from .../serving-kubelet.key: <nil>". CITED: rancher/dynamiclistener's
# cert.LoadOrGenerateKeyFile (cert/io.go) only regenerates a key when
# `os.ReadFile` returns `os.IsNotExist(err) == true`. A file that EXISTS with
# 0 bytes reads with `err == nil`, so the function takes its "real read
# error" branch instead of regenerating -- formatting the nil `err` with
# `%v` as the literal string `<nil>`, character for character the text
# measured. Deleting the zero-length file turns the next read into a genuine
# IsNotExist, which the same function already handles by regenerating.
#
# THE ALLOWLIST, AND WHY IT REPLACED A SWEEP-WITH-EXCLUSION. A real WP25 CI
# run (`-f only_wp11=true`, an earlier revision that swept the whole
# AGENT_DIR tree minus one excluded subtree) found and removed 3243
# "zero-length" files in one boot, the overwhelming majority under
# .../agent/containerd/io.containerd.<component>.<version>.<name>/... --
# containerd's own plugin-namespaced working data (content-addressed blob
# store, overlayfs snapshot content, runtime task state, the metadata bolt
# db). Every one of those was genuinely zero bytes and genuinely NOT a
# truncated credential: OCI runtimes create empty
# `snapshots/*/fs/etc/{hosts,resolv.conf,hostname}` files ON PURPOSE as
# bind-mount targets, and container images legitimately ship zero-length
# marker/lock files (`py.typed`, empty `__init__.py`, `.rpm.lock`,
# `dpkg/lock`, …). A single excluded subtree only defends against the ONE
# unsafe location this run happened to reach -- an allowlist defends by
# construction, because the measured-safe set is exactly two places and the
# healthy first invocation on that same run proves it:
#
#   1. $AGENT_DIR itself, ONE LEVEL DEEP ONLY (`-maxdepth 1`) -- the
#      certs/keys/kubeconfigs this target exists for: client-kubelet.{crt,key},
#      client-k3s-controller.{crt,key}, client-kube-proxy.{crt,key},
#      serving-kubelet.{crt,key}, k3scontroller.kubeconfig,
#      kubelet.kubeconfig, kubeproxy.kubeconfig.
#   2. $AGENT_DIR/etc, RECURSIVELY -- containerd's own PROCESS CONFIG, not
#      its image data: etc/containerd/config.toml, etc/crictl.yaml,
#      etc/containerd/certs.d/<registry>/hosts.toml. These are written by
#      containerd itself at startup from static config, the same
#      write-fresh-every-boot shape as the depth-1 credentials, and
#      unrelated to anything under $AGENT_DIR/containerd (note: different
#      directory -- agent/etc/containerd/ is config, agent/containerd/ is
#      the runtime's working directory).
#
# $AGENT_DIR/containerd is NEVER considered, by construction -- neither
# clause names it, so no exclusion is needed and none can be forgotten when
# a third containerd-internal directory shape shows up later. The only
# thing this allowlist gives up versus the old sweep is
# agent/containerd/containerd.log, whose own zero-length state is normal
# and healthy (a fresh empty log) and was never load-bearing for k3s's
# bootstrap in the first place.
#
# TARGET 2 -- /etc/rancher/node/password (single file). MEASURED on run
# 35945... (WP25's own first re-run, after target 1 alone): target 1's fix
# landed clean (confirmed: the `<nil>` text no longer appears anywhere in
# that run's serial log), and k3s.service progressed PAST the cert-loading
# retry loop -- and then failed differently: "Sending HTTP/1.1 400 response
# ...: node password not set" / "Waiting to retrieve agent configuration;
# server is not ready: .../serving-kubelet.crt: .../v1-k3s/serving-kubelet.crt:
# 400 Bad Request", every few seconds, for the rest of the 70-minute window.
# CITED (k3s community precedent, github.com/k3s-io/k3s discussions #8121 and
# codybunch.com "Kubernetes Fix: Node Password Rejected"): the agent stores
# ITS OWN generated per-node registration secret at
# /etc/rancher/node/password and presents it on every bootstrap request; the
# server's "node password not set" response is what it sends when that
# presented value is empty. This file is agent-owned and per-node -- it is
# not a trust root and not shared cluster state, the same category as
# target 1's files, so it gets the same treatment: if it exists at 0 bytes,
# remove it, and the agent generates a fresh one on its next attempt.
#
# TARGET 3 -- /var/lib/rancher/k3s/server/cred/node-passwd (single file,
# SERVER ROLE ONLY -- absent entirely on an agent, which is fine, see below).
# Named explicitly by the WP25 task brief as a file to check, and by the
# same k3s community precedent above: this is the SERVER's table of already-
# established per-node passwords (not an encryption key, not a CA -- see the
# NOT touched list below for what actually is). A 0-byte node-passwd is
# read by the server as "no node has ever registered," which is the correct
# state for the server to resume from -- it does not disable the server's
# ability to accept a FRESH registration the way a corrupt encryption key or
# CA would. Removed by name only, never swept: this directory also holds
# encryption-config.json and ipsec.psk (see below), and this script must
# never risk widening from "the one named table" to "everything living next
# to it."
#
# NOT TOUCHED, ANYWHERE, EVER, AND WHY (unchanged from target 1's original
# scope argument -- restated because targets 2 and 3 make it easy to forget
# where the line still is):
#   - /var/lib/rancher/k3s/server/tls -- this cluster's CA material
#     (server-ca, client-ca, request-header-ca, the service-account signing
#     key). Regenerating a truncated CA key silently issues a NEW authority
#     that no previously-issued certificate chains to -- a cluster-wide,
#     self-inflicted trust break, strictly worse than the hang this script
#     fixes.
#   - /var/lib/rancher/k3s/server/cred/encryption-config.json and .../ipsec.psk
#     -- an encryption key and a shared secret, not a lookup table. Losing or
#     regenerating either can leave already-etcd-stored data permanently
#     unreadable, which is destruction, not repair.
#   - /var/lib/rancher/k3s/server/db (the datastore) -- never read by this
#     script at all; no target above is a path under it.
#   - $AGENT_DIR/containerd (the whole directory, both roles) -- containerd's
#     own runtime working data: the content-addressed blob store, overlayfs
#     (or equivalent) snapshot content for every pulled image, the metadata
#     bolt db, CRI/runtime task state. This class is named explicitly because
#     a measured regression reached it (see target 1's header): it holds
#     files that are LEGITIMATELY zero-length as shipped image content or as
#     OCI-runtime bind-mount placeholders, which k3s does not own and does
#     not regenerate the way it regenerates its own bootstrap credentials --
#     a sweep that reaches it destroys image content rather than repairing
#     k3s state. Target 1's allowlist never names this directory, so nothing
#     under it is ever a candidate.
# Residual risk, stated rather than papered over: a power cut that truncates
# one of the NOT-TOUCHED files above is not self-healed by this script and
# still needs manual, deliberate recovery.
#
# SCOPE, STRICT, ACROSS ALL THREE TARGETS: only files whose size is EXACTLY
# ZERO are ever removed. A non-empty file -- however suspicious its
# contents -- is never touched: this script has no way to tell "corrupt but
# non-empty" from "valid", and guessing would be a stronger and less
# justified claim than the zero-length case, which is unambiguous (a 0-byte
# key, certificate, password, or lookup table is never valid, by
# construction, so removing it can never discard a state that was actually
# usable).
#
# THIS SCRIPT IS A STANDALONE FILE, not a Nix string, so that a test can
# EXECUTE it rather than only read it --
# `src/Core.TypeScript/hygiene/k3s-agent-tls-self-heal.test.ts` runs it over
# fixture directories and asserts exactly which files disappear. Same
# discipline as `k3s-datastore-preflight.sh`.
#
# NEVER FAILS THE UNIT: k3s-agent-tls-self-heal.nix wires this as an
# ExecStartPre on systemd.services.k3s, and a self-heal step must never
# itself become a new way for k3s to fail to start. So this script always
# exits 0, including when a target path does not exist yet (a node that has
# never run k3s before, or an agent role which has no server/cred at all) or
# when a refusal guard below trips.

set -u

AGENT_DIR="${ZETA_K3S_AGENT_DIR:-/var/lib/rancher/k3s/agent}"
NODE_PASSWORD_FILE="${ZETA_K3S_NODE_PASSWORD_FILE:-/etc/rancher/node/password}"
SERVER_NODE_PASSWD_FILE="${ZETA_K3S_SERVER_NODE_PASSWD_FILE:-/var/lib/rancher/k3s/server/cred/node-passwd}"
SERIAL_DEVICE="${ZETA_SERIAL_DEVICE:-/dev/ttyS0}"

say() {
  echo "$1"
  # Serial, when there is one. Never fatal if there is not.
  if [ -w "$SERIAL_DEVICE" ]; then
    echo "$1" > "$SERIAL_DEVICE" 2>/dev/null || true
  fi
}

# ── Target 1: an ALLOWLIST of two places under AGENT_DIR ─────────────────
#
# Independent guard, on top of the caller only ever pointing this at the
# agent directory: refuse to touch anything under a "server" path segment
# (the datastore and the CA material both live there) whatever
# ZETA_K3S_AGENT_DIR is set to. A misconfiguration here must fail SAFE (do
# nothing) rather than silently widen this script's blast radius.
case "$AGENT_DIR" in
  */server | */server/*)
    say "[zeta-k3s-agent-tls-self-heal]   refusing: ZETA_K3S_AGENT_DIR ($AGENT_DIR) contains a 'server' path segment; this script only ever operates on the agent directory. Doing nothing."
    ;;
  *)
    if [ ! -d "$AGENT_DIR" ]; then
      say "[zeta-k3s-agent-tls-self-heal]   $AGENT_DIR does not exist yet; nothing to heal."
    else
      removed=0
      # Clause 1: AGENT_DIR itself, one level deep only -- the credentials
      # and kubeconfigs this target exists for. Clause 2: AGENT_DIR/etc,
      # recursively -- containerd's own process config, a different
      # directory from AGENT_DIR/containerd (the runtime's working data,
      # NEVER named here -- see the module header's "NOT TOUCHED" section).
      # `2>/dev/null` on the second covers AGENT_DIR/etc not existing at all,
      # which is a normal state (nothing has been pulled yet) and not a
      # refusal.
      while IFS= read -r -d '' f; do
        say "[zeta-k3s-agent-tls-self-heal]   removing zero-length file: $f"
        rm -f -- "$f"
        removed=$((removed + 1))
      done < <(find "$AGENT_DIR" -maxdepth 1 -type f -size 0 -print0 2>/dev/null)
      while IFS= read -r -d '' f; do
        say "[zeta-k3s-agent-tls-self-heal]   removing zero-length file: $f"
        rm -f -- "$f"
        removed=$((removed + 1))
      done < <(find "$AGENT_DIR/etc" -type f -size 0 -print0 2>/dev/null)

      if [ "$removed" -eq 0 ]; then
        say "[zeta-k3s-agent-tls-self-heal]   clear: no zero-length files under $AGENT_DIR"
      else
        say "[zeta-k3s-agent-tls-self-heal]   removed $removed zero-length file(s) under $AGENT_DIR; k3s will regenerate them"
      fi
    fi
    ;;
esac

# ── Target 2: the agent's own per-node registration secret ──────────────
#
# A single named file, not a sweep -- there is exactly one, and naming it
# exactly is the guard: nothing else under /etc/rancher/node is ever
# considered, whatever else might live there.
if [ -f "$NODE_PASSWORD_FILE" ] && [ ! -s "$NODE_PASSWORD_FILE" ]; then
  say "[zeta-k3s-agent-tls-self-heal]   removing zero-length file: $NODE_PASSWORD_FILE"
  rm -f -- "$NODE_PASSWORD_FILE"
  say "[zeta-k3s-agent-tls-self-heal]   removed $NODE_PASSWORD_FILE; k3s will regenerate it"
else
  say "[zeta-k3s-agent-tls-self-heal]   clear: $NODE_PASSWORD_FILE is absent or non-empty"
fi

# ── Target 3: the server's per-node password table (server role only) ───
#
# Also a single named file. Absent entirely on an agent-role node, which is
# the ordinary case and not logged as a refusal -- there is nothing wrong
# with an agent not having a server/cred directory.
if [ -f "$SERVER_NODE_PASSWD_FILE" ] && [ ! -s "$SERVER_NODE_PASSWD_FILE" ]; then
  say "[zeta-k3s-agent-tls-self-heal]   removing zero-length file: $SERVER_NODE_PASSWD_FILE"
  rm -f -- "$SERVER_NODE_PASSWD_FILE"
  say "[zeta-k3s-agent-tls-self-heal]   removed $SERVER_NODE_PASSWD_FILE; k3s will treat this as no node yet registered"
elif [ -f "$SERVER_NODE_PASSWD_FILE" ]; then
  say "[zeta-k3s-agent-tls-self-heal]   clear: $SERVER_NODE_PASSWD_FILE is non-empty"
fi

exit 0
