# full-ai-cluster/nixos/modules/injected-cluster-address.nix
#
# 081KSNY2Z0008QG0R0008PN7RQ scenario 5 — `joining-node-address-assignment`.
#
# THE GAP
# -------
# `injected-join-server.nix` gives a joining node the k3s `--server` URL. It
# does not give it an ADDRESS, and it does not make the URL's host resolvable.
# On the shared cluster segment (a bare QEMU socket in the harness; a plain
# switch on hardware) there is:
#
#   - no DHCP server — every `networking.useDHCP` / NetworkManager setting in
#     this tree is CLIENT side, and there is no dnsmasq/dhcpd/kea anywhere;
#   - no DNS;
#   - no name service but Avahi/nss-mdns, which answers for `.local` only.
#
# So a joiner reaches RFC-3927 link-local at best (a pseudo-randomly chosen
# address — the nondeterminism §7 DST forbids) and cannot resolve
# `control-plane`.
#
# WHY STATIC AND NOT DHCP
# -----------------------
# `k3s-server.nix` already names this fix and calls it "the robust path":
# inject a `control-plane <cp-ip>` /etc/hosts entry at install time. The same
# comment records that mDNS was TRIED and did not resolve, and that
# NetBIOS/nss-wins did not work either. `nixos/tests/k3s-agent-join.nix`
# supplies exactly this mapping by hand and says so:
#
#     "On hardware the mapping comes from an installer-injected /etc/hosts
#      entry (still open — see the MULTI-NODE note in k3s-server.nix)"
#
# This module is that entry, arriving. A DHCP server on the control plane was
# the alternative and is worse on three counts: it appoints the founder as the
# segment's address authority (manifesto §1 — the defect is appointment, not
# degree), it adds a lease-timing race that cannot replay deterministically,
# and none of it is checkable without booting something.
#
# THE CHAIN
# ---------
#   zflash  src/Core.TypeScript/zflash/cluster-address.ts derives the address
#           from the ROLE (founder .1, joiner .2+) — a pure function, unit
#           tested with no network and no QEMU.
#     ->    written into /zeta-firstboot.conf on the boot ESP
#     ->    zeta-install.sh re-validates and stages three scalars under
#           /mnt/etc/zeta/
#     ->    THIS MODULE reads them at NixOS evaluation time.
#
# Imported by `common.nix` so every host gets the capability. Default behaviour
# is preserved exactly: no files -> nothing is set, and the node keeps DHCP.
#
# NAME AND ADDRESS ARE TWO VALUES ON PURPOSE. The joiner dials the NAME
# `control-plane`, because that is the one name `k3s-server.nix` puts in the
# API certificate (`--tls-san=control-plane`); the address is only what makes
# that name resolve. Dialling the address directly would resolve fine and then
# fail certificate verification — which is also why `.local` was wrong.
#
# UNVERIFIED — READ BEFORE TRUSTING THIS PATH
# -------------------------------------------
# Nothing here has been evaluated by a `nixos-install`, a `nixos-rebuild`, or a
# boot. What IS checked is the file-path contract against `zeta-install.sh`,
# the option names against `k3s-agent.nix` / `k3s-server.nix`, and the value
# derivation in TypeScript unit tests. The `joining-node-address-assignment`
# entry in `JoinBlocker` stays listed until a guest boots from a
# joiner-flashed medium and is observed on the segment.
#
# Specifically NOT verified: that NetworkManager picks up the keyfile below,
# that MAC-based matching selects the segment NIC and not the NAT NIC, and
# that the resulting route lets a joiner reach 6443 on the founder. Those three
# need a booted guest on a real segment; the paragraph below did not.
#
# MEASURED 2026-08-21 (Determinate Nix 3.21.0 / Nix 2.34.6), no hardware:
#
#     builtins.pathExists "<absolute path>"  in pure eval -> false, no error
#     builtins.readFile   "<absolute path>"  in pure eval -> error, loud
#
# A flake ref evaluates PURE by default, and `readTrimmed` below guards its
# `readFile` behind a `pathExists`. So under a pure `nixos-rebuild switch
# --flake ...` this module does not fail — it reports every file absent and
# hands back `null`, the node keeps DHCP, and the whole static-addressing
# provisioning silently disappears. `zeta-install.sh` passes `--impure` to
# `nixos-install`; every `nixos-rebuild` string in this repo now passes it too,
# and `src/Core.TypeScript/hygiene/lint-nixos-rebuild-needs-impure.ts` is the
# check that keeps it true.

{ config, lib, ... }:

let
  addressFile = "/etc/zeta/cluster-segment-address";
  macFile = "/etc/zeta/cluster-segment-mac";
  controlPlaneFile = "/etc/zeta/cluster-control-plane-address";

  readTrimmed = path:
    if builtins.pathExists path
    then
      let
        stripped = lib.removeSuffix "\n" (lib.removeSuffix " " (builtins.readFile path));
      in
      if stripped == "" then null else stripped
    else null;

  # Shape-checked in Nix as well as in bash and in TypeScript. Not redundancy
  # theatre: each is the last guard on a different substrate, and the value
  # came off a FAT filesystem anyone with physical access can rewrite.
  matched = pattern: value:
    if value != null && builtins.match pattern value != null then value else null;

  rawAddress = matched "[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+/[0-9]+" (readTrimmed addressFile);
  rawMac = matched "[0-9a-f][0-9a-f](:[0-9a-f][0-9a-f]){5}" (readTrimmed macFile);
  rawControlPlane = matched "[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+" (readTrimmed controlPlaneFile);

  # ALL THREE OR NONE, matching the installer. A partial set produces a node
  # that looks configured and is unreachable, which is the worst of the three
  # possible outcomes (the other two being "configured" and "plainly on DHCP").
  complete = rawAddress != null && rawMac != null && rawControlPlane != null;

  ownAddress = if complete then builtins.head (lib.splitString "/" rawAddress) else null;
  prefixLength = if complete then builtins.elemAt (lib.splitString "/" rawAddress) 1 else null;

  # This node IS the control plane when its own segment address equals the
  # founder's. Derived rather than injected: one fewer scalar that can
  # disagree with the role already on the medium.
  isControlPlane = complete && ownAddress == rawControlPlane;

  # NetworkManager keyfile. NM owns the network on these hosts
  # (`networking.networkmanager.enable = true` in common.nix), so configuring
  # the interface through systemd-networkd would mean two managers fighting
  # over one NIC. Matching by `mac-address` rather than `interface-name`
  # because kernel names (ens3/enp0s4) follow PCI enumeration and differ
  # between machine types; the MAC is pinned on the QEMU command line and is
  # the one identifier both sides agree on.
  segmentKeyfile = ''
    [connection]
    id=zeta-cluster-segment
    type=ethernet
    autoconnect=true
    autoconnect-priority=10

    [802-3-ethernet]
    mac-address=${rawMac}

    [ipv4]
    method=manual
    address1=${ownAddress}/${prefixLength}
    # No gateway: this segment is cluster-internal. The default route stays on
    # whatever interface already carries it (SLIRP NAT in the harness), so
    # adding one here would silently blackhole outbound traffic.
    never-default=true

    [ipv6]
    method=ignore
  '';
in
{
  # A PLAIN CONDITIONAL, not `lib.mkIf complete`. Caught by evaluating this
  # file rather than by reading it: `mkIf false` filters the definition out of
  # the merge, but the attribute set it wraps is still constructed, so
  # `${rawMac}` was interpolated with `null` on every host that has no
  # injected files — which is currently every host. `mkIf` guards whether a
  # definition COUNTS; it does not guard whether it can be BUILT.
  #
  #   error: cannot coerce null to a string: null
  #
  # `if complete then … else { }` never constructs the branch at all, so the
  # no-op path is genuinely a no-op.
  config = if complete then {
    # mode forces NixOS to COPY rather than symlink into the world-readable
    # store; NetworkManager's keyfile plugin ignores connection files that are
    # not 0600 and root-owned.
    environment.etc."NetworkManager/system-connections/zeta-cluster-segment.nmconnection" = {
      text = segmentKeyfile;
      mode = "0600";
    };

    # The name->address mapping, on JOINERS ONLY.
    #
    # `k3s-server.nix` already maps `control-plane -> 127.0.0.1` on the founder,
    # and /etc/hosts resolution takes the FIRST match — a second line for the
    # same name would not override it, it would make the answer depend on file
    # ordering. The founder resolving itself locally is also correct: its API
    # server is local.
    networking.hosts = lib.mkIf (!isControlPlane) {
      "${rawControlPlane}" = [ "control-plane" ];
    };

    # Make the API certificate valid for the segment address too, so an
    # operator debugging with `https://10.88.0.1:6443` gets a verifiable
    # endpoint rather than a name-mismatch that looks like a broken cluster.
    # Server-side only; k3s rejects server flags on an agent.
    #
    # `extraFlags` is a list option, so this MERGES with k3s-server.nix's list
    # rather than replacing it.
    services.k3s.extraFlags = lib.mkIf (isControlPlane && config.services.k3s.role == "server") [
      "--tls-san=${ownAddress}"
    ];
  } else { };
}
