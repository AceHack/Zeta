# full-ai-cluster/nixos/modules/cilium-wireguard-preflight-checks.nix
#
# The PURE half of the Cilium WireGuard node preflight: given the text of the
# Cilium value surfaces this repo ships, derive (a) whether a WireGuard kernel
# device is a REQUIREMENT of this cluster at all and (b) the shell text that
# checks it at boot.
#
# Split out of cilium-wireguard-node-preflight.nix for the reason
# longhorn-preflight-checks.nix gives for the same split: a `lib.mkIf`-wrapped
# module config cannot be read by an evaluation test without reaching through
# `.content`, and a test that reaches through a wrapper silently reads the
# WRONG value the day the wrapper changes shape.
#
# WHAT THE CLUSTER ACTUALLY ASKS FOR
# ----------------------------------
# Two surfaces request WireGuard, and BOTH of them are early:
#
#   k8s/bootstrap/cilium-install.yaml       -- a k3s HelmChart with
#     `bootstrap: true`, i.e. Cilium at FIRST BOOT, before the node is Ready
#     and before anything else in the cluster exists;
#   k8s/applications/cilium/Application.yaml -- the ArgoCD Application that
#     adopts it, at `argocd.argoproj.io/sync-wave: "-80"`.
#
# Both carry:
#
#     encryption:
#       enabled: true
#       type: wireguard
#       nodeEncryption: true
#
# Cilium is the CNI. If that request cannot be satisfied the agent does not
# degrade to unencrypted -- it refuses (see below) -- so the node has no CNI,
# which on a fresh install means the node never goes Ready and NOTHING comes
# up, at the one moment there is no cluster to ask why.
#
# WHAT CILIUM ACTUALLY DOES WITHOUT THE MODULE -- IT FAILS CLOSED, LOUDLY
# ----------------------------------------------------------------------
# Measured against the pinned chart's agent source (cilium/cilium, the
# `pkg/wireguard/agent` package), NOT from general knowledge:
#
#   link = &netlink.Wireguard{ LinkAttrs: netlink.LinkAttrs{ Name: types.IfaceName, ... } }
#   err := netlink.LinkAdd(link)
#   if err != nil && !errors.Is(err, unix.EEXIST) {
#       if !errors.Is(err, unix.EOPNOTSUPP) {
#           return fmt.Errorf("failed to add WireGuard device: %w", err)
#       }
#       return fmt.Errorf("WireGuard not supported by the Linux kernel (netlink: %w). "+
#           "Please upgrade your kernel, or manually install the kernel module "+
#           "(https://www.wireguard.com/install/)", err)
#   }
#
# and the call site in `daemon/cmd/daemon.go`:
#
#   if params.WGAgent != nil && option.Config.EnableWireguard {
#       if err := params.WGAgent.Init(d.ipcache); err != nil {
#           log.WithError(err).Error("failed to initialize WireGuard agent")
#           return nil, nil, fmt.Errorf("failed to initialize WireGuard agent: %w", err)
#       }
#
# So: no silent fallback, no unencrypted degrade. `newDaemon` returns an error,
# cilium-agent exits, the DaemonSet CrashLoopBackOffs, and the error text names
# the remedy. The userspace fallback that once existed
# (`--enable-wireguard-userspace-fallback`) has always defaulted to FALSE, is
# not set by either of our value surfaces, and was deprecated for removal in
# 1.17. This file therefore does NOT claim to prevent a silent failure -- it
# claims to move a loud failure from "inside a CrashLoopBackOff on a node with
# no CNI" to "a named refusal on the console, before k3s starts".
#
# IS THE MODULE ACTUALLY MISSING? THE HONEST ANSWER IS "PROBABLY NOT, AND
# NOTHING SAYS SO"
# ----------------------------------------------------------------------
# Two mechanisms make it likely present without anyone having asked for it:
#
#   1. nixpkgs builds kernels with autoModules -- generate-config.pl answers
#      "m" to every tristate that offers it
#      (`$answer = "m" if $autoModules && $alts =~ ...`), and
#      x86_64 sets `autoModules ? ... or true`. So CONFIG_WIREGUARD=m comes
#      out of the stock nixos-25.11 kernel without appearing in
#      common-config.nix at all.
#   2. The kernel AUTO-LOADS it on the very netlink call Cilium makes:
#      net/core/rtnetlink.c does `request_module("rtnl-link-%s", kind)` when a
#      link kind is unknown, and drivers/net/wireguard/main.c declares
#      `MODULE_ALIAS_RTNL_LINK(KBUILD_MODNAME)`.
#
# That is why this has not bitten yet. It is ALSO why nothing in this repo
# would notice the day it stops being true -- a hardened or custom kernel, an
# `autoModules = false`, a stripped module tree. The requirement was implicit
# in two mechanisms neither of which this repository owns. This file makes it
# explicit and checkable; it does not claim to have found an outage.
#
# THE WEAK FORM THIS AVOIDS
# -------------------------
# `modinfo wireguard` is NOT the question, and it is the obvious thing to reach
# for. modinfo reads a .ko's metadata off disk and succeeds on a module that has
# never been and cannot be loaded -- it is the `systemctl cat` of kernel
# modules, the same shape that let nixos/tests/k3s-control-plane-platform-fixes.nix
# stay green through 62 days of dead Longhorn. The check below asks
# /sys/module/<name>, which exists only for a module actually in the kernel, and
# then asks the kernel to build the device for real.
#
# WHAT IT DELIBERATELY DOES NOT DO
# --------------------------------
# It does not check that encryption is WORKING -- `wg show cilium_wg0` has no
# meaningful answer at boot, because cilium-agent has not run yet and the
# interface it names does not exist. The question this file can answer at boot
# is the one Cilium will ask later: can this kernel make a WireGuard device.

{ lib, sources }:

let
  # ---- derivation: is WireGuard a requirement of THIS cluster? -------------
  #
  # DERIVED from the shipped value surfaces, never from a hand-written boolean,
  # for the reason longhorn-preflight-checks.nix derives requiredMounts from
  # `fileSystems`: a second copy of a fact drifts from the first, and a drifted
  # copy passes. Turn encryption off in the manifests and this preflight stops
  # demanding a module, with no edit here.
  #
  # The predicate is `type: wireguard`, not the conjunction with
  # `enabled: true`. Nix has no YAML parser in builtins, and a line-wise
  # conjunction across a nested block is exactly the kind of almost-right
  # parsing that reads the wrong value later. The chosen predicate errs toward
  # OVER-requiring (a leftover `type: wireguard` under `enabled: false` would
  # still request the module), and over-requiring costs a loaded kernel module
  # nobody uses, while under-requiring costs the CNI. Asymmetric, so pick the
  # safe side and say which side was picked.
  lines = text: lib.splitString "\n" text;

  anyLineMatching =
    pattern: text: builtins.any (line: builtins.match pattern line != null) (lines text);

  wireguardPattern = "[[:space:]]*type:[[:space:]]*wireguard[[:space:]]*(#.*)?";
  nodeEncryptionPattern = "[[:space:]]*nodeEncryption:[[:space:]]*true[[:space:]]*(#.*)?";

  sortStrings = builtins.sort (a: b: a < b);

  requestedBy = sortStrings (
    map (s: s.name) (builtins.filter (s: anyLineMatching wireguardPattern s.text) sources)
  );

  nodeEncryptionRequestedBy = sortStrings (
    map (s: s.name) (builtins.filter (s: anyLineMatching nodeEncryptionPattern s.text) sources)
  );

  wireguardRequired = requestedBy != [ ];

  # The kernel module name, used BOTH by the declaration (boot.kernelModules in
  # cilium-wireguard-prereqs.nix) and by the check below, from this one binding,
  # so the thing declared and the thing checked cannot drift apart.
  kernelModule = "wireguard";

  # A netlink probe needs a device name of its own. `cilium_wg0` is Cilium's --
  # touching it would be reaching into the CNI's state -- so the probe uses a
  # name nothing else in this repo or in Cilium claims. Under IFNAMSIZ (16).
  probeIface = "zeta-wgprobe0";

  okMarker = "ZETA_CILIUM_WG_PREFLIGHT_OK";
  failMarker = "ZETA_CILIUM_WG_PREFLIGHT_FAILED";
  skipMarker = "ZETA_CILIUM_WG_PREFLIGHT_NOT_REQUIRED";

  # POSIX sh. Same shape as the Longhorn preflight: every failure increments a
  # counter and the script exits 1 only at the end, so ONE boot reports EVERY
  # problem.
  #
  # No backticks anywhere below: this is a Nix indented string, where a
  # backslash is NOT an escape, so a "quoted" backtick would survive into the
  # shell and open a command substitution.
  checksBody = ''
    # ---- 1. the module this node DECLARED is loaded -----------------------
    #
    # Ordered FIRST on purpose, and the ordering is load-bearing: check 2 below
    # performs a netlink link-add, and that call AUTO-LOADS the module
    # (rtnetlink.c request_module + MODULE_ALIAS_RTNL_LINK). Running check 2
    # first would therefore make check 1 pass on a node where
    # systemd-modules-load had failed -- a check that cannot fail.
    #
    # /sys/module/<name> exists only for a module that is actually in the kernel
    # (loaded or built in). The weaker form this deliberately avoids is named in
    # the header above -- and named THERE rather than here, because the eval
    # test asserts the weak form's spelling never appears in this script, and a
    # comment saying "not X" would satisfy a grep for X.
    if [ -d /sys/module/${kernelModule} ]; then
      note "zeta-cilium-wg-preflight: ok   ${kernelModule} loaded"
    else
      fail "the ${kernelModule} kernel module is not loaded. Cilium is the CNI here and its values request encryption.type=wireguard, so cilium-agent will call netlink LinkAdd for a WireGuard device, get EOPNOTSUPP, refuse to initialise ('WireGuard not supported by the Linux kernel'), and CrashLoopBackOff -- leaving this node with no CNI at all." \
           "it is requested via boot.kernelModules in nixos/modules/cilium-wireguard-prereqs.nix. Run: modprobe ${kernelModule} ; systemctl status systemd-modules-load.service ; journalctl -u systemd-modules-load.service -b"
    fi

    # ---- 2. the kernel can actually create a WireGuard device -------------
    #
    # This is the operation cilium-agent performs, run here instead of there:
    # RTM_NEWLINK with kind "wireguard". It is the only check on this node that
    # can distinguish "the module file exists" from "the syscall Cilium makes
    # succeeds", and it is what stays true if the module is built in, renamed,
    # or provided out of tree.
    #
    # Cleaned up either way: a leftover probe device would be indistinguishable
    # from cluster state to the next reader.
    ip link del dev ${probeIface} 2>/dev/null || true
    if probe_err=$(ip link add dev ${probeIface} type wireguard 2>&1); then
      ip link del dev ${probeIface} 2>/dev/null || true
      note "zeta-cilium-wg-preflight: ok   netlink accepted a WireGuard device"
    else
      ip link del dev ${probeIface} 2>/dev/null || true
      fail "this kernel refused RTM_NEWLINK for a WireGuard device (netlink said: $probe_err). That is the exact call cilium-agent makes at startup, so Cilium will not initialise on this node." \
           "the kernel needs CONFIG_WIREGUARD (=y or =m). nixos-25.11 builds it as a module by default (autoModules). Reproduce with: ip link add dev ${probeIface} type wireguard. Then: modprobe ${kernelModule} ; zcat /proc/config.gz 2>/dev/null | grep WIREGUARD ; uname -r. If a custom kernel is in use, restore CONFIG_WIREGUARD or turn encryption off in k8s/bootstrap/cilium-install.yaml AND k8s/applications/cilium/Application.yaml."
    fi

    # ---- 3. the operator has `wg` to diagnose with (WARNING, not refusal) --
    #
    # NOT a failure, and the distinction is deliberate rather than soft:
    # cilium-agent talks to the kernel over netlink/wgctrl and never execs wg,
    # so a missing wg tool cannot break encryption. What it breaks is the
    # OPERATOR, who has no way to answer "is this tunnel actually up" on the
    # console. Before this module, wireguard-tools appeared only on the
    # installer ISO (usb-nixos-installer/nixos/installer/configuration.nix) and
    # never on an installed node.
    #
    # Refusing a boot over a missing diagnostic tool would overstate the fault;
    # staying silent about it would hide the gap this module exists to close.
    # So: warn, count it separately, and never let it colour the verdict.
    if [ -x /run/current-system/sw/bin/wg ]; then
      note "zeta-cilium-wg-preflight: ok   wg present for diagnosis"
    else
      warn "wg is not on this system's PATH, so there is no way to inspect the tunnel from the console (wg show cilium_wg0). Encryption is unaffected. It is declared via environment.systemPackages in nixos/modules/cilium-wireguard-prereqs.nix -- if it is missing, this generation did not apply that module."
    fi
  '';

  # DECLARED vacuity, not discovered vacuity. If no shipped Cilium value surface
  # asks for WireGuard, there is nothing on this node to check -- and saying so
  # out loud is what stops "it passed" being read as "this kernel can do
  # WireGuard".
  #
  # The skip is the WHOLE script rather than an early `exit 0` inside the full
  # one, so the not-required path cannot emit the OK marker or reach the exit-1
  # verdict AT ALL -- not even as unreachable text. An unreachable success line
  # still present in the script is exactly what a later reader, or a
  # grep-shaped check, mistakes for a check that ran.
  skipScript = ''
    set -u
    printf '%s\n' "${skipMarker} no shipped Cilium value surface requests encryption.type=wireguard; nothing to check." >&2
    exit 0
  '';

  fullScript = ''
    set -u

    failures=0
    warnings=0

    # note()  -> journal only. shout() -> journal AND the physical console.
    note() { printf '%s\n' "$*" >&2; }
    shout() {
      printf '%s\n' "$*" >&2
      printf '%s\n' "$*" > /dev/console 2>/dev/null || true
    }

    fail() {
      failures=$((failures + 1))
      shout "zeta-cilium-wg-preflight: REFUSED -- $1"
      shout "zeta-cilium-wg-preflight:   remedy: $2"
    }

    warn() {
      warnings=$((warnings + 1))
      shout "zeta-cilium-wg-preflight: WARNING -- $1"
    }

    note "zeta-cilium-wg-preflight: wireguard requested by: ${lib.concatStringsSep " " requestedBy}"

    ${checksBody}

    # ---- verdict -----------------------------------------------------------
    if [ "$failures" -gt 0 ]; then
      shout "${failMarker} failures=$failures warnings=$warnings"
      shout "zeta-cilium-wg-preflight: Cilium is the CNI on this node and it will NOT start until the above is fixed."
      exit 1
    fi

    note "${okMarker} warnings=$warnings"
  '';

  script = if wireguardRequired then fullScript else skipScript;
in
{
  inherit
    requestedBy
    nodeEncryptionRequestedBy
    wireguardRequired
    kernelModule
    probeIface
    okMarker
    failMarker
    skipMarker
    script
    ;
}
