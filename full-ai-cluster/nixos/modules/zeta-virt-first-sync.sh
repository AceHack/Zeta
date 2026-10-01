#!/usr/bin/env bash
# zeta-virt-first-sync.sh — sync the `kubevirt` and `cdi` ArgoCD Applications
# EXACTLY ONCE, on a cluster that has neither operator, and never touch a
# cluster that already runs one. Then, only if THIS script synced KubeVirt and
# this host has no /dev/kvm, enable KubeVirt's software-emulation fallback.
#
# WHY THIS EXISTS. `kubevirt` and `cdi` are declared MANUAL-SYNC
# (`zeta.io/sync-policy: manual`, see src/Core.TypeScript/cluster/manual-sync-policy.ts)
# because they adopt operators installed by hand on node-5b2dfa, which carries
# production Windows guests: an automated sync there could roll virt-operator
# underneath live VMs. That reason is a constraint on THAT cluster, not on the
# bytes. But the declaration lives in the one tree every cluster syncs, so a
# FRESH install inherits it too -- and nothing on a fresh boot ever runs
# `argocd app sync`, so a freshly flashed node comes up with NO virtualisation
# layer at all, forever: both Applications sit `Missing` and the Windows-VM
# capability the platform advertises does not exist.
#
# THE FIX KEEPS THE DECLARATION AND ADDS THE MISSING ACT. PHASE 1 performs, once,
# the one-time manual sync a human would run -- but only where doing so cannot
# disturb anything:
#
#   * per app, it is skipped when that operator's CRD already exists
#     (`kubevirts.kubevirt.io`, `cdis.cdi.kubevirt.io`). A hand-installed or
#     already-synced operator is exactly the case the manual declaration protects,
#     and its CRD is the one thing it cannot be running without.
#   * it initiates an ordinary Application `operation.sync` -- the same field
#     `argocd app sync` writes -- so ArgoCD does the apply, with ServerSideApply
#     (the KubeVirt CRD is at 91% of the client-side annotation ceiling). Nothing
#     is applied from here directly.
#   * a sentinel makes it write-once. After it, the Applications are ordinary
#     manual-sync apps again: later commits show OutOfSync and wait for a human.
#
# PHASE 2 -- THE EMULATION FALLBACK. A KubeVirt VM pod requests the extended
# resource `devices.kubevirt.io/kvm`; on a host with no /dev/kvm (a node that is
# itself a VM without nested virtualisation) nothing advertises it and every VM
# stays Pending forever with no error that says why. KubeVirt's own answer is
# `configuration.developerConfiguration.useEmulation: true` (QEMU TCG). It is a
# CLUSTER-WIDE switch, ~10x slower, and Windows under it is not usable -- so it is
# NEVER the default and NEVER applied to a cluster this script did not sync: it is
# written only when (a) phase 1 recorded `kubevirt=sync` and (b) this host has no
# /dev/kvm. It prints a VERDICT line so the slowness has a named cause.
#
# ABSENCE IS NOT A STATE, SO THE OUTCOMES ARE KEPT APART and each prints a VERDICT
# line to the serial console:
#     synced      the sync was initiated
#     skipped     the operator's CRD already exists / a sync already ran -- left alone
#     waiting     the Application, the API, the CRD lookup or the KubeVirt CR was not
#                 answerable yet -- exit 1 so systemd retries; NEVER recorded as skipped
# A CRD probe that FAILS (API down) is `waiting`, not "CRD absent": reading an
# error as an absence is how a check that cannot fail is built.
#
# TESTABLE BY CONSTRUCTION: every external dependency is an environment
# variable with a real-world default, so
# src/Core.TypeScript/hygiene/zeta-virt-first-sync.test.ts EXECUTES this exact
# script against a fake kubectl and proves each outcome, including the one that
# matters most -- an existing operator is never synced.
#
# EXIT: 0 done (both sentinels present), 1 not yet answerable (retry).

set -u

KUBECTL="${ZETA_KUBECTL_CMD:-KUBECONFIG=/etc/rancher/k3s/k3s.yaml k3s kubectl}"
SENTINEL_FILE="${ZETA_VIRT_SENTINEL_FILE:-/var/lib/zeta/virt-first-sync.done}"
EMULATION_SENTINEL_FILE="${ZETA_VIRT_EMULATION_SENTINEL_FILE:-/var/lib/zeta/virt-emulation.done}"
KVM_DEVICE="${ZETA_KVM_DEVICE:-/dev/kvm}"
ARGOCD_NAMESPACE="${ZETA_ARGOCD_NAMESPACE:-argocd}"
# application=crd, space-separated. Order is the sync order: both are
# independent (cdi needs no virtualisation), so it is only a stable order.
APP_CRDS="${ZETA_VIRT_APP_CRDS:-kubevirt=kubevirts.kubevirt.io cdi=cdis.cdi.kubevirt.io}"
SERIAL_DEVICE="${ZETA_SERIAL_DEVICE:-/dev/ttyS0}"
WAITING_STATE_FILE="${ZETA_VIRT_WAITING_STATE_FILE:-/run/zeta-virt-first-sync.waiting}"

say() {
  echo "$1"
  if [ -w "$SERIAL_DEVICE" ]; then
    echo "$1" > "$SERIAL_DEVICE" 2>/dev/null || true
  fi
}

waiting() {
  # One line per boot: a unit that retries silently is a unit nobody can tell is
  # stuck. The message names what it is waiting for.
  if [ ! -e "$WAITING_STATE_FILE" ]; then
    say "[zeta-virt-first-sync]   VERDICT waiting: $1 -- retrying."
    mkdir -p "$(dirname -- "$WAITING_STATE_FILE")" 2>/dev/null || true
    : > "$WAITING_STATE_FILE" 2>/dev/null || true
  fi
  exit 1
}

# write-new-then-rename: a killed-mid-write sentinel must never look like a valid
# one to a later `-e` check.
write_sentinel() {
  mkdir -p "$(dirname -- "$1")" 2>/dev/null || true
  if { date -u +%Y-%m-%dT%H:%M:%SZ; printf '%s\n' "$2"; } > "$1.tmp" 2>/dev/null; then
    mv -f -- "$1.tmp" "$1" 2>/dev/null || true
  fi
  [ -e "$1" ]
}

# ---------------------------------------------------------------------------
# PHASE 1 -- the one-time sync. Write-once, checked first.
# ---------------------------------------------------------------------------
if [ ! -e "$SENTINEL_FILE" ]; then
  # `retry` is load-bearing and is the whole point of this line's shape. A manual-sync
  # Application has no `syncPolicy.automated`, and an `operation` written with no `retry` is
  # tried EXACTLY ONCE: if the API server is mid-restart when ArgoCD discovers server
  # resources (measured on the WP11 first-boot guest, run 36832486494: `cdi` read
  # "one or more synchronization tasks are not valid: failed to discover server resources
  # ... connection refused" while k3s had restarted 14 times under CPU/memory pressure),
  # the operation ends `Failed`, nothing ever starts another, and this unit has already
  # written its sentinel -- so the Application sat OutOfSync/Degraded for good. A bounded
  # backoff makes the one-time sync survive the very boot instability it runs inside.
  # 20 tries at 30s doubling to 5m is a bit over an hour: long enough to outlast a slow
  # control plane, short enough that a genuinely invalid manifest ends loudly Failed.
  PATCH='{"operation":{"initiatedBy":{"username":"zeta-virt-first-sync"},"retry":{"limit":20,"backoff":{"duration":"30s","factor":2,"maxDuration":"5m"}},"sync":{"syncOptions":["ServerSideApply=true"]}}}'

  # PASS 1 -- look at everything BEFORE touching anything, so a half-answerable
  # cluster never ends up with one app synced and the other unexamined.
  PLAN=""
  for pair in $APP_CRDS; do
    app="${pair%%=*}"
    crd="${pair#*=}"

    if ! eval "$KUBECTL -n $ARGOCD_NAMESPACE get application $app -o name" >/dev/null 2>&1; then
      waiting "ArgoCD Application '$app' does not exist yet (zeta-root has not created it)"
    fi

    # An Application that has EVER run a sync operation (a human, a previous run of
    # this unit that crashed before its sentinel, anything) is not ours to start a
    # second one on: replacing a live `operation` can restart a half-applied sync.
    if ! op="$(eval "$KUBECTL -n $ARGOCD_NAMESPACE get application $app -o jsonpath='{.status.operationState.phase}'" 2>/dev/null)"; then
      waiting "could not read Application '$app' operation state"
    fi
    if [ -n "$op" ]; then
      PLAN="$PLAN $app=skip-synced"
      continue
    fi

    # `--ignore-not-found` makes "absent" a SUCCESS with empty output, so a
    # non-zero exit can only mean the question was not answered.
    if ! out="$(eval "$KUBECTL get crd $crd -o name --ignore-not-found" 2>/dev/null)"; then
      waiting "could not ask the API whether CRD '$crd' exists"
    fi

    if [ -n "$out" ]; then
      PLAN="$PLAN $app=skip"
    else
      PLAN="$PLAN $app=sync"
    fi
  done

  # PASS 2 -- act. The sentinel is written only after every app in the plan has
  # been dealt with, and records each outcome so phase 2 can read it.
  for entry in $PLAN; do
    app="${entry%%=*}"
    action="${entry#*=}"
    if [ "$action" = "skip-synced" ]; then
      say "[zeta-virt-first-sync]   VERDICT skipped: Application '${app}' has already run a sync operation; not starting a second."
      continue
    fi
    if [ "$action" = "skip" ]; then
      say "[zeta-virt-first-sync]   VERDICT skipped: ${app}'s CRD already exists, so this cluster already runs the operator; leaving it to a human (manual-sync)."
      continue
    fi
    if ! eval "$KUBECTL -n $ARGOCD_NAMESPACE patch application $app --type merge -p '$PATCH'" >/dev/null 2>&1; then
      waiting "patching Application '$app' with the first sync operation failed"
    fi
    say "[zeta-virt-first-sync]   VERDICT synced: initiated the one-time sync of Application '${app}' (no operator CRD was present)."
  done

  if ! write_sentinel "$SENTINEL_FILE" "$(echo $PLAN | tr ' ' '\n')"; then
    # Could not record it: do NOT claim done. A retry re-evaluates the CRDs, and any
    # operator the first pass started is by then present and therefore skipped.
    waiting "could not write the sentinel ${SENTINEL_FILE}"
  fi
  say "[zeta-virt-first-sync]   phase 1 done; wrote ${SENTINEL_FILE}."
fi

# ---------------------------------------------------------------------------
# PHASE 2 -- the emulation fallback. Only for a KubeVirt THIS script synced, only
# on a host with no /dev/kvm. Write-once, checked first.
# ---------------------------------------------------------------------------
if [ -e "$EMULATION_SENTINEL_FILE" ]; then
  exit 0
fi

if ! grep -qx 'kubevirt=sync' "$SENTINEL_FILE" 2>/dev/null; then
  # We did not sync KubeVirt (an existing operator, or a human got there first):
  # its configuration is not ours to touch, on any host.
  write_sentinel "$EMULATION_SENTINEL_FILE" "not-applicable: kubevirt was not synced by zeta-virt-first-sync" >/dev/null
  exit 0
fi

if [ -e "$KVM_DEVICE" ]; then
  write_sentinel "$EMULATION_SENTINEL_FILE" "hardware: $KVM_DEVICE present, emulation not needed" >/dev/null
  say "[zeta-virt-first-sync]   VERDICT hardware-virtualisation: $KVM_DEVICE present; KubeVirt keeps useEmulation unset."
  exit 0
fi

# No /dev/kvm. The KubeVirt CR exists only once the Application's sync reaches its
# second wave, so its absence is `waiting`, not "nothing to do".
if ! cr="$(eval "$KUBECTL -n kubevirt get kubevirt kubevirt -o name --ignore-not-found" 2>/dev/null)"; then
  waiting "could not ask the API whether the KubeVirt CR exists (needed to enable emulation: $KVM_DEVICE is absent)"
fi
if [ -z "$cr" ]; then
  waiting "the KubeVirt CR does not exist yet (the sync has not reached it); $KVM_DEVICE is absent so emulation will be enabled when it does"
fi
if ! eval "$KUBECTL -n kubevirt patch kubevirt kubevirt --type merge -p '{\"spec\":{\"configuration\":{\"developerConfiguration\":{\"useEmulation\":true}}}}'" >/dev/null 2>&1; then
  waiting "patching the KubeVirt CR with useEmulation failed"
fi
if ! write_sentinel "$EMULATION_SENTINEL_FILE" "emulation: $KVM_DEVICE absent, useEmulation set" >/dev/null; then
  waiting "could not write the sentinel ${EMULATION_SENTINEL_FILE}"
fi
say "[zeta-virt-first-sync]   VERDICT software-emulation: $KVM_DEVICE is ABSENT on this host, so KubeVirt useEmulation=true (QEMU TCG: ~10x slower, Windows guests will not be usable). Run on hardware, or a hypervisor with nested virtualisation, for real VMs."
exit 0
