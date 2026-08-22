# full-ai-cluster/nixos/modules/injected-hostname.nix
#
# iter-5.2 (B-0792): per-node hostname injection for multi-node clusters.
#
# Without this, every USB-installed node uses the flake host config's
# hardcoded `networking.hostName` (e.g., "control-plane" for every node
# built from the control-plane flake). Result for multi-node:
#
#   - All control-plane nodes have hostname "control-plane"
#   - mDNS publishing collides; second + later nodes auto-rename to
#     "control-plane-2.local" / "control-plane-3.local" via Avahi's
#     conflict-resolution but underlying NixOS hostname stays
#     "control-plane" (confusing in logs, journalctl, kubectl, etc.)
#
# Fix: zeta-install.sh reads `zeta-hostname.txt` from the USB ESP (if
# the operator passed `--host <name>` to zflash) + writes the chosen
# hostname to `/mnt/etc/zeta/cluster-node-id` during install. This
# module reads that file at NixOS evaluation time + overrides
# `networking.hostName`.
#
# Imported by `common.nix` so EVERY host (control-plane, worker-gpu,
# worker-template, future configs) gets the override capability
# automatically. Default behavior preserved: if the file doesn't
# exist, `networking.hostName` from the per-host config remains in
# effect (e.g., `control-plane` stays `control-plane` for the
# zero-typing single-node case).
#
# Aaron 2026-05-26: "make any multi node changes we need to like
# think though mdns names when we have two control planes."
#
# MEASURED 2026-08-21 (Determinate Nix 3.21.0 / Nix 2.34.6) — the "default
# behavior preserved" branch above ALSO fires on a pure-eval rebuild:
#
#     builtins.pathExists "<absolute path>"  in pure eval -> false, no error
#     builtins.readFile   "<absolute path>"  in pure eval -> error, loud
#
# A flake ref evaluates PURE by default, so a `nixos-rebuild switch` against
# the flake ref with no `--impure` reports the id file absent even when it is
# present, and `networking.hostName` reverts to the per-host config's
# hardcoded name. Every
# node built from the control-plane flake becomes `control-plane` again — the
# exact mDNS collision this module exists to prevent, reintroduced silently by
# a routine update. Every `nixos-rebuild` string in this repo now carries
# `--impure`; `src/Core.TypeScript/hygiene/lint-nixos-rebuild-needs-impure.ts`
# is the check that keeps it that way.

{ config, lib, ... }:

let
  idFile = "/etc/zeta/cluster-node-id";
  injectedRaw =
    if builtins.pathExists idFile
    then builtins.readFile idFile
    else null;
  # Strip trailing newline + whitespace; reject empty result.
  injected =
    if injectedRaw == null
    then null
    else
      let
        trimmed = lib.removeSuffix "\n" (lib.removeSuffix " " injectedRaw);
      in
      if trimmed == "" then null else trimmed;
in
{
  # mkOverride 50 wins over the per-host config's default
  # (mkDefault = 1000) but loses to explicit operator overrides
  # (mkForce = 50 too; explicit `networking.hostName = "..."` without
  # any priority modifier = 100). The intent: zeta-install.sh's
  # injected value is preferred over the flake's per-host default
  # BUT operators rebuilding with a custom override in a new
  # configuration retain control.
  networking.hostName = lib.mkIf (injected != null) (lib.mkOverride 50 injected);
}
