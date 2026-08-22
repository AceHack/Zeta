# full-ai-cluster/nixos/modules/injected-join-server.nix
#
# 081KSNY2Z0008QG0R0008PN7RQ scenario 5 — per-node k3s join endpoint injection.
#
# `modules/k3s-agent.nix` sets:
#
#     services.k3s.serverAddr = lib.mkDefault "https://control-plane:6443";
#
# which is a build-time constant and a bare single label. Two problems, both
# real on the multi-node path:
#
#   1. Every agent built from the flake dials the SAME name, so an operator
#      with two clusters — or a QEMU harness with its own naming — has no way
#      to point a node at a different founder without editing the flake.
#   2. A bare `control-plane` is not mDNS-resolvable. nss-mdns (`nssmdns4`, on
#      in common.nix) answers for `.local` names only, so on a segment with no
#      DNS and no DHCP the default cannot resolve at all.
#
# Fix, mirroring `injected-hostname.nix` exactly: zflash writes the endpoint to
# the boot ESP inside `/zeta-firstboot.conf`; `zeta-install.sh` extracts it to
# `/mnt/etc/zeta/cluster-join-server-url`; this module reads that file at NixOS
# evaluation time and overrides `services.k3s.serverAddr`.
#
# Imported by `common.nix` so every host gets the capability. Default behaviour
# is preserved exactly: no file → `k3s-agent.nix`'s mkDefault stays in effect.
#
# GUARDED TO AGENTS. Setting `serverAddr` on a `--cluster-init` founding server
# would tell it to join something instead of founding, so the override only
# applies where `services.k3s.role == "agent"`. A control plane that happens to
# have the file (e.g. flashed once as a joiner, re-flashed as a founder) is
# unaffected rather than quietly broken.
#
# UNVERIFIED: this module has not been evaluated by a `nixos-install` or a
# `nixos-rebuild` in this change. What is checked is the file path contract
# against `zeta-install.sh` and the option name against `k3s-agent.nix`.
#
# MEASURED 2026-08-21 (Determinate Nix 3.21.0 / Nix 2.34.6) — THIS MODULE IS A
# NO-OP UNDER PURE EVAL, SILENTLY:
#
#     builtins.pathExists "<absolute path>"  in pure eval -> false, no error
#     builtins.readFile   "<absolute path>"  in pure eval -> error, loud
#
# A flake ref evaluates pure by DEFAULT. Because the read below is guarded by
# `pathExists`, a pure `nixos-rebuild switch` against the flake ref does not
# fail — it takes the "no file, keep the default" branch, and `services.k3s.serverAddr`
# reverts to `k3s-agent.nix`'s mkDefault `https://control-plane:6443`. The node
# stops joining whatever it was flashed to join, with nothing in the output to
# say so. `zeta-install.sh` passes `--impure` to `nixos-install`; every
# `nixos-rebuild` string in this repo now passes it too, and
# `src/Core.TypeScript/hygiene/lint-nixos-rebuild-needs-impure.ts` is the check
# that keeps it true.

{ config, lib, ... }:

let
  urlFile = "/etc/zeta/cluster-join-server-url";
  injectedRaw =
    if builtins.pathExists urlFile
    then builtins.readFile urlFile
    else null;
  # Strip trailing newline + space; reject empty. Same trim as
  # injected-hostname.nix so the two cannot drift in behaviour.
  trimmed =
    if injectedRaw == null
    then null
    else
      let
        stripped = lib.removeSuffix "\n" (lib.removeSuffix " " injectedRaw);
      in
      if stripped == "" then null else stripped;
  # Shape check in Nix as well as in bash and in TypeScript. Three independent
  # checks is not redundancy theatre here: each one is the last guard on a
  # different substrate, and the value came off a FAT filesystem anyone with
  # physical access can write.
  injected =
    if trimmed != null && lib.hasPrefix "https://" trimmed && builtins.match "https://[A-Za-z0-9._:-]+" trimmed != null
    then trimmed
    else null;
in
{
  # mkOverride 50 beats k3s-agent.nix's mkDefault (1000) while still losing to
  # an explicit operator mkForce — the same priority choice, for the same
  # reason, as injected-hostname.nix.
  services.k3s.serverAddr =
    lib.mkIf (injected != null && config.services.k3s.role == "agent") (lib.mkOverride 50 injected);
}
