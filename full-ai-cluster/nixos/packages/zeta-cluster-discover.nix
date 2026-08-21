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
# WIRED, 2026-08-21. usb-nixos-installer/nixos/installer/configuration.nix now
# carries this package plus `services.avahi.enable`, and zeta-first-boot.sh
# calls it after the network wait and before zeta-install. The earlier note
# here said the ISO shipped neither avahi-browse nor a JS runtime, which was
# read off systemPackages and was right about PATH and wrong about the store --
# see the correction below.
#
# COST, NOW MEASURED (was UNMEASURED, and that gap is what blocked the wiring).
# nixpkgs b77b3de8, x86_64-linux cross-evaluated from an aarch64-darwin
# workstation; closures read from cache.nixos.org narinfo without building;
# marginal = store paths NOT already in the installer's systemPackages closure:
#
#   avahi 0.8   36 paths, 0 NEW, +0 bytes. The identical store path is ALREADY
#               in the installer closure, pulled in by mesa-demos. So the
#               binaries were on the stick all along -- just not on PATH, with
#               no daemon running. "Not in systemPackages" and "not in the
#               image" are different claims, and only the first was true.
#   bun 1.3.3   5 paths, 1 NEW, 99.4 MiB uncompressed NAR. Compressed with the
#               ISO's own squashfs settings (mksquashfs -b 1048576 -comp zstd
#               -Xcompression-level 19) over the real downloaded store path:
#               31,944,704 bytes = 30.5 MiB. Measured, not extrapolated.
#
# So the answer to "has this earned its slot?" is +30.5 MiB, against the ~80 MB
# this same ISO already spends on redistributable firmware for cosmetic dmesg
# quiet. The full argument, including the two rejected zero-byte alternatives,
# lives beside the package list in the installer configuration.
#
# STILL UNMETERED, and a size measurement does not change it
# (`.claude/rules/toy-is-free-metered-must-be-earned.md`): no two nodes have
# ever run this probe near each other. The 30 s dwell is derived from RFC 6762
# timers and a cost asymmetry, not from an observed time-to-first-answer. What
# is measured here is the ISO cost; the protocol behaviour is DESIGNED AND
# UNRUN until two machines boot on one segment.

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
