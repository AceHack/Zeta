# full-ai-cluster/nixos/packages/zeta-cluster-discover.nix
#
# The bootstrap-or-join decider, as a package rather than as a host module.
#
# DELIBERATELY NOT IN ANY HOST CLOSURE. The only consumer is the INSTALLER
# environment, where the role decision happens; an installed node has already
# decided and would carry the bun closure for nothing. Cost discipline: a
# dependency earns its slot by having a consumer, and on a cluster node this
# one has none.
#
# Wiring it into the installer ISO is one line in
# usb-nixos-installer/nixos/installer/configuration.nix, plus
# services.avahi.enable -- because that ISO today ships NEITHER avahi-browse
# NOR an mDNS responder (measured 2026-08-21 by reading its systemPackages).
# Until that lands this package builds and nothing calls it, and saying so is
# the honest status.
#
# COST, UNMEASURED: bun is the runtime. `nix path-info -S` for the
# x86_64-linux bun could not be evaluated from this workstation without
# fetching the derivation, so the ISO-size delta is NOT known and must be
# measured before the installer wiring lands. A discovery feature that adds an
# unmeasured hundred megabytes to a USB image has not earned its slot yet.

{ pkgs, lib ? pkgs.lib }:

let
  source = lib.cleanSource ../cluster-discovery;
in
pkgs.writeShellScriptBin "zeta-cluster-discover" (lib.concatStringsSep "\n" [
  "set -euo pipefail"
  "# avahi-browse must be on PATH; its absence is reported by the probe as"
  "# probe-failed(browser-missing), never as an empty network."
  "export PATH=${lib.makeBinPath [ pkgs.avahi ]}:$PATH"
  "exec ${pkgs.bun}/bin/bun ${source}/cli.ts \"$@\""
])
