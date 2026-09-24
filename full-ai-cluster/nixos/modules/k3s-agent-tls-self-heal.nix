# full-ai-cluster/nixos/modules/k3s-agent-tls-self-heal.nix
#
# WP25 (081M38G8NGC087G0R001GEGEDK). Root-cause work for run 35927439681
# (workflow build-ai-cluster-iso.yml, step "WP11 — installed-disk first-boot
# k3s verify"): on the real USB-installed disk, k3s.service never finishes
# starting, so Kubernetes never comes up and no app ever starts.
#
# MEASURED. `systemctl status k3s` sat `activating` forever (NRestarts=0,
# network-online.target ACTIVE, no ordering cycle). k3s's own log, every ~8s
# for 70+ minutes: "Waiting to retrieve agent configuration; server is not
# ready: /var/lib/rancher/k3s/agent/serving-kubelet.crt: failed to create
# certificate request ... error loading key from
# /var/lib/rancher/k3s/agent/serving-kubelet.key: <nil>". `ls -l` on that box
# showed EVERY file under /var/lib/rancher/k3s/agent at 0 bytes, timestamped
# from the PREVIOUS boot -- client-kubelet.{crt,key},
# client-k3s-controller.{crt,key}, client-kube-proxy.{crt,key},
# serving-kubelet.{crt,key}, k3scontroller.kubeconfig, kubelet.kubeconfig,
# kubeproxy.kubeconfig. Meanwhile /var/lib/rancher/k3s/server/tls/* held real
# content. The files were created but their contents never reached disk
# before the machine stopped -- the QEMU harness kills the VM at the end of
# its install phase; on real hardware this is a power cut during first boot.
# A zero-length key or certificate is never valid, so this state is
# unambiguous.
#
# ROOT CAUSE, CITED (checked against the upstream source, not guessed).
# k3s's agent certs are loaded and regenerated through
# rancher/dynamiclistener's `cert.LoadOrGenerateKeyFile`
# (github.com/rancher/dynamiclistener, cert/io.go):
#
#   loadedData, err := os.ReadFile(keyPath)
#   if err == nil && verifyKeyData(loadedData) {
#       return loadedData, false, err
#   }
#   if !os.IsNotExist(err) {
#       return nil, false, fmt.Errorf("error loading key from %s: %v", keyPath, err)
#   }
#   // ... only past this point does it generate + write a fresh key
#
# `verifyKeyData` correctly rejects a 0-byte file (`len(data) == 0` ->
# false). But a file that EXISTS with no content makes `os.ReadFile` return
# `err == nil` -- so `os.IsNotExist(err)` is false, `!false` is true, and the
# function takes the "real read error" branch instead of falling through to
# regeneration, formatting the nil `err` with `%v` as the literal string
# `<nil>`. That is the exact text in the measured log line above, character
# for character. k3s's agent bootstrap loop retries this same read forever
# (the "Waiting to retrieve agent configuration" message), which matches the
# 70-minute measured hang exactly. Corroborated independently: k3s users have
# hit the identical shape for a different file under the same tree
# (/var/lib/rancher/k3s/agent/containerd/peer.key generated empty by an
# unclean stop, same dynamiclistener code path, same fix reported by
# operators -- delete the empty file and let k3s recreate it on restart).
#
# Deleting the zero-length file turns the NEXT read into a genuine
# `os.IsNotExist(err) == true`, which the SAME function already handles by
# generating a fresh key -- no k3s code change, no behaviour invented, just
# removing the on-disk state that trips its own conditional.
#
# THAT FIX WAS NOT THE WHOLE STORY -- MEASURED, NOT ASSUMED. The first
# version of this module covered only /var/lib/rancher/k3s/agent, and a real
# CI run of exactly that fix (WP25's own first re-run) proved it necessary
# but not sufficient: the `<nil>` text was gone -- confirmed absent from that
# run's serial log -- and k3s.service progressed past the cert-loading retry
# loop, then failed differently: "node password not set" / 400 Bad Request
# on the SAME `v1-k3s/serving-kubelet.crt` bootstrap endpoint, for the rest
# of the 70-minute window. Fixing the first bug is what exposed the second;
# per this repo's own economics (every bug has value, a fix that surfaces
# the next one is progress, not failure), this module now covers three
# targets, all in the same file, all sharing one property: a per-node
# credential the AGENT or SERVER already knows how to regenerate, never a
# trust root.
#
# TARGET 1 -- /var/lib/rancher/k3s/agent, SWEPT (every zero-length file
# under the tree, WITH ONE PRUNED SUBTREE). Every file here is a per-node
# LEAF certificate or kubeconfig: k3s's agent bootstrap is "ask the server
# for my certs again", so the control plane re-issues all of it to a
# rejoining node on request -- nothing under this directory is a trust root,
# and this is true on BOTH roles (a server node also runs its own embedded
# agent/kubelet, writing the identical files under the same path -- nixpkgs'
# rancher module names the systemd unit "k3s" on both roles, which is why
# this module is imported by BOTH k3s-server.nix and k3s-agent.nix, same as
# its sibling k3s-wait-for-address.nix).
#
# THE SWEEP HAS ONE EXCLUSION, ADDED AFTER A MEASURED REGRESSION. A real
# WP25 CI run (targets-1-and-2 revision, once real image pulls had run)
# found this script removing 3243 files in one boot under
# .../agent/containerd/io.containerd.<component>.<version>.<name>/... --
# containerd's own plugin-namespaced working data (content-addressed blob
# store, overlayfs snapshot content, the runtime task state, the metadata
# bolt db). Every one of those was genuinely zero bytes and genuinely NOT a
# truncated credential: OCI runtimes create empty
# `snapshots/*/fs/etc/{hosts,resolv.conf,hostname}` files ON PURPOSE as
# bind-mount targets, and container images legitimately ship zero-length
# marker/lock files (`py.typed`, empty `__init__.py`, `.rpm.lock`,
# `dpkg/lock`, …). The script's own citation for target 1 — dynamiclistener
# regenerates a missing k3s credential -- has no analogue for containerd's
# extracted image content, so deleting there is deleting the runtime's own
# state on a guess, exactly what the "SCOPE, STRICT" section of the
# script's header already forbids. The fix (in
# `k3s-agent-tls-self-heal.sh`): `find` PRUNES
# `$AGENT_DIR/containerd/io.containerd.*` as a whole subtree, by
# containerd's own stable plugin-naming convention, rather than filtering
# it file-by-file after the fact.
#
# TARGET 2 -- /etc/rancher/node/password, ONE NAMED FILE. This is the
# agent's own generated per-node registration secret, presented on every
# bootstrap request (k3s community precedent: github.com/k3s-io/k3s
# discussions #8121; codybunch.com "Kubernetes Fix: Node Password Rejected"
# names deleting this exact file as the agent-side half of the standard
# remedy). Agent-owned, per-node, freely regenerated by the agent when
# absent -- the same category as target 1, so it gets the same treatment.
#
# TARGET 3 -- /var/lib/rancher/k3s/server/cred/node-passwd, ONE NAMED FILE,
# SERVER ROLE ONLY (simply absent on an agent, which changes nothing). Named
# explicitly in the WP25 task brief as a file to check. This is the SERVER's
# lookup table of already-established per-node passwords -- the same
# community precedent's server-side half of the standard remedy. A 0-byte
# table reads as "no node has ever registered," which is a state the server
# can resume from cleanly; it does NOT disable the server's ability to
# accept a fresh registration the way a corrupt encryption key or CA would.
# Removed BY NAME ONLY, never swept -- this directory also holds the two
# files named below, and widening from "the one named table" to "everything
# next to it" is exactly the mistake this module exists to avoid making.
#
# NOT TOUCHED, ANYWHERE, EVER, AND WHY -- unchanged by targets 2 and 3, and
# worth restating because they sit one directory over from something that
# IS now touched:
#
# `/var/lib/rancher/k3s/server/tls` holds this cluster's CA material --
# server-ca, client-ca, request-header-ca, the service-account signing key.
# Deleting a truncated CA key and letting dynamiclistener regenerate a FRESH
# one would silently issue a NEW certificate authority that no
# previously-issued certificate chains to: every other node's agent certs,
# every already-minted kubeconfig, anything a human copied off the box --
# all invalidated at once, with no error message pointing at the cause. That
# is a self-inflicted, cluster-wide, hard-to-diagnose trust break, strictly
# worse than the hang this module fixes.
#
# `/var/lib/rancher/k3s/server/cred/encryption-config.json` and `.../ipsec.psk`
# are the same shape one step further downstream: they are an ENCRYPTION KEY
# and a SHARED SECRET, not a lookup table like target 3 -- regenerating
# either can leave already-etcd-stored secrets permanently unreadable, which
# is destruction, not repair. `server/cred` as a DIRECTORY is not in scope;
# only the one named file (target 3) is, and only by exact name.
#
# So the residual risk, stated plainly: a power cut that truncates a file
# under server/tls, or the encryption-config/ipsec.psk files under
# server/cred, is NOT self-healed by this module and would still require
# manual, deliberate recovery (accept the trust break and delete, or restore
# from an out-of-band backup — neither of which this module performs).
# These three targets are the boundary between credentials that are safe to
# repair unattended and ones that are not; it narrows this module's blast
# radius to the part of the bug family that is provably safe, rather than
# reaching for the whole directory trees the underlying defect could in
# principle touch. The datastore (server/db) is outside this module's scope
# entirely -- no target above is a path under it.
#
# A SECOND, NAMED RESIDUAL RISK -- THE ASYMMETRIC-CORRUPTION CASE. Targets 2
# and 3 are two ends of one handshake: the agent presents the secret at
# target 2, the server checks it against target 3's table. The measured
# failure truncated BOTH together (same crash, same instant), which is why
# clearing both and letting each side regenerate independently works -- a
# freshly empty table has no stale entry to contradict the agent's freshly
# generated password. k3s's own semantics (community precedent, same
# sources as targets 2/3 above) are that a MISMATCH -- not an absence -- is
# a DIFFERENT, and NOT self-healing, failure: if only target 2 were
# truncated while target 3 SURVIVED non-empty with a real (non-zero-length)
# entry already recorded for this exact node name, this script would
# correctly regenerate a brand-new random password at target 2 (it is
# zero-length, so it qualifies) and leave target 3 untouched (it is
# non-empty, so it does not qualify) -- and the server would then reject the
# NEW password against the OLD stored hash for the SAME node name. That
# rejection is reported as "node password rejected" (RPi4/Buster case,
# k3s-io/k3s#746), a DIFFERENT string from "node password not set", and
# retries exactly as unproductively as the bug this module fixes.
#
# THIS IS NOT HANDLED, ON PURPOSE, RATHER THAN HOPED PAST. Curing it would
# mean finding and deleting only THIS node's entry inside target 3's table
# -- but k3s's node-password store is not one fixed on-disk shape across
# datastore backends (community sources describe both a flat per-node table
# under server/cred AND a `<nodename>.node-password.k3s` Secret in the
# kube-system namespace for datastore-backed clusters), and this module
# reads no Kubernetes API and parses no k3s-internal format -- doing either
# on a guess would be a stronger and less justified claim than the
# zero-length case this module already limits itself to. So: if a node ever
# changes its locally-stored password (target 2 regenerated) while the
# SAME node name keeps a stale, non-empty entry server-side, this module
# does not resolve it, and the operator remedy is the same one the
# community sources name for a plain node-password rejection -- clear the
# specific stale entry for that node name (server-side table row or Secret)
# by hand. NOT the scenario measured on this branch (which truncated both
# sides together, and remains fully self-healed); named here because the
# coordinator asked the question directly and "if it can, handle it
# explicitly rather than hoping" is the right bar -- this paragraph is the
# explicit handling: named, bounded, and left to a human rather than
# silently assumed away.
#
# PREVENTION, CONSIDERED AND DEFERRED. A power cut can land at any instant,
# so no amount of "sync before the install phase ends" makes this
# unreachable in general -- self-heal is the durable fix because it covers
# every timing, not just the one the installer happens to guard. Syncing
# more aggressively during the install's shutdown phase would still be a
# nice-to-have (it narrows the WINDOW in which a crash produces truncated
# files at all), but claiming it as a fix would be a claim this module does
# not make and a real power cut can defeat regardless of where the sync
# points sit. Not implemented here; the durable fix is this module.
#
# WIRING: an ExecStartPre on systemd.services.k3s, following
# k3s-wait-for-address.nix's shape exactly -- same unit, same append-only
# list (NixOS merges `serviceConfig.ExecStartPre` list definitions across
# modules; neither file uses `mkForce`, so both run). ExecStartPre failures
# normally fail the unit; this script is written to ALWAYS exit 0 (see its
# own header), so a self-heal step can never itself become a new way for k3s
# to fail to start.
#
# THE SCRIPT is `k3s-agent-tls-self-heal.sh`, a standalone file (not an
# inline Nix string) for the same reason `k3s-datastore-preflight.sh` is:
# `src/Core.TypeScript/hygiene/k3s-agent-tls-self-heal.test.ts` EXECUTES it
# over fixture directories and asserts exactly which files disappear and
# which never do, rather than only reading Nix source that nothing runs. End
# to end on a real boot: `nixos/tests/k3s-agent-tls-self-heal.nix` boots the
# shipped k3s-server.nix module, lets it write real cert material, truncates
# every file under the agent directory PLUS the node-password files at
# targets 2 and 3 to 0 bytes (reproducing the measured defect chain), and
# asserts k3s reaches `active` and `/readyz` again.
#
# VALIDATED end-to-end on the real installed-disk path, not only in the VM
# sandbox: run 35943840554 (workflow_dispatch, `-f only_wp11=true`, this
# branch, target-1-only revision) measured the `<nil>` bug fixed and the
# node-password bug exposed, exactly as targets 2/3's own comments state.
# A follow-up run with all three targets is the falsifier for whether that
# closes the chain; see the PR for the run id and verdict.

{ config, lib, pkgs, ... }:

{
  systemd.services.k3s.serviceConfig.ExecStartPre = [
    "${pkgs.bash}/bin/bash ${./k3s-agent-tls-self-heal.sh}"
  ];
}
