# full-ai-cluster/nixos/modules/zeta-wp11-ci-envelope.nix
#
# WP11 ONLY: keep the installed-disk QEMU guest inside what it can hold, so the
# lane measures the platform instead of an overloaded 12 GiB VM.
# Work item 081M3K1K1XV087G0R002A6YFRS.
#
# WHAT IT DOES. On a node carrying the WP11 marker file (the same one that
# enables zeta-first-boot-k3s-verify.nix, written only by the QEMU harness) and
# only there, BEFORE k3s first starts: it writes a copy of the root Application
# carrying `directory.exclude` over the dirs in k8s/wp11-ci-envelope.json, and a
# `root-application.yaml.skip` so k3s's deploy controller applies the copy
# instead of the original (k3s "Auto-Deploying Manifests": a `.skip` file makes
# k3s ignore the corresponding manifest). Same ArgoCD mechanism and the same
# three dirs the dev/CI kind lanes already exclude (DEFAULT_ROOT_DEV_CATALOG in
# src/Core.TypeScript/cluster/ports.ts).
#
# WHY, MEASURED: the JSON carries the numbers. In short, #17711 / #17718 /
# #17708 added 10533 MiB / 4875m / 24 pods of requests in one day, more than the
# guest's whole allocatable, and run 36364782876 lost its API server.
#
# A REAL INSTALL NEVER HAS THE MARKER and deploys everything, unchanged. Without
# the marker this unit removes any override it finds that carries its own header
# (and nothing else), so a disk that once booted as a WP11 guest cannot keep a
# stale exclusion.
#
# THE EXCLUSION IS NEVER SILENT: the outcome goes to serial, and to
# /run/zeta-wp11-ci-envelope/state, which the WP11 verdict prints at verdict 7 and
# carries in its JSON (`ciEnvelope`). If the root manifest's shape is not what the
# injection anchors on, the unit FAILS and writes nothing, so the guest deploys
# the full roster rather than a half-edited one.

{ config, lib, pkgs, ... }:

let
  markerFile = "/etc/zeta/qemu-k3s-first-boot-verify";
  manifestsDir = "/var/lib/rancher/k3s/server/manifests";
  stateDir = "/run/zeta-wp11-ci-envelope";
  envelope = builtins.fromJSON (builtins.readFile ../../k8s/wp11-ci-envelope.json);
  excludeGlob = "{" + lib.concatMapStringsSep "," (e: "${e.dir}/**") envelope.excluded + "}";
  rootSrc = ../../k8s/bootstrap/root-application.yaml;
in
{
  systemd.services.zeta-wp11-ci-envelope = {
    description = "WP11 QEMU-only: exclude the Applications the CI guest cannot hold (k8s/wp11-ci-envelope.json)";
    wantedBy = [ "multi-user.target" ];
    before = [ "k3s.service" ];
    serviceConfig = {
      Type = "oneshot";
      RemainAfterExit = true;
      StandardOutput = "journal+console";
      StandardError = "journal+console";
      ExecStart = pkgs.writeShellScript "zeta-wp11-ci-envelope" ''
        set -uo pipefail
        _serial=""
        for _dev in /dev/ttyS0 /dev/ttyAMA0; do
          if [ -e "$_dev" ]; then
            _serial="$_dev"
            break
          fi
        done
        log() {
          echo "$1"
          if [ -n "$_serial" ]; then
            echo "$1" >> "$_serial" || true
          fi
        }
        AWK=${pkgs.gawk}/bin/awk
        GREP=${pkgs.gnugrep}/bin/grep
        MV=${pkgs.coreutils}/bin/mv
        RM=${pkgs.coreutils}/bin/rm
        MKDIR=${pkgs.coreutils}/bin/mkdir
        # ZETA-WP11-ENVELOPE-BEGIN
        zeta_wp11_envelope_apply() {
          # $1 marker  $2 manifests dir  $3 root manifest source  $4 exclude glob  $5 state dir
          _env_marker="$1"
          _env_dir="$2"
          _env_src="$3"
          _env_glob="$4"
          _env_state="$5/state"
          _env_tag="# zeta-wp11-ci-envelope"
          _env_override="$_env_dir/zeta-root-wp11-ci-envelope.yaml"
          _env_skip="$_env_dir/root-application.yaml.skip"
          "$MKDIR" -p "$5"
          if [ ! -e "$_env_marker" ]; then
            # Not a WP11 guest. Remove only what THIS unit wrote.
            for _env_f in "$_env_override" "$_env_skip"; do
              if [ -e "$_env_f" ] && "$GREP" -qxF "$_env_tag" "$_env_f"; then
                "$RM" -f "$_env_f"
                log "[wp11-ci-envelope] no WP11 marker: removed stale $_env_f"
              fi
            done
            printf 'not-applicable\t-\tno WP11 marker: full roster\n' > "$_env_state"
            return 0
          fi
          if [ ! -d "$_env_dir" ]; then
            printf 'not-applicable\t-\tno k3s server manifests dir (agent node)\n' > "$_env_state"
            return 0
          fi
          _env_n="$("$GREP" -cE '^[[:space:]]*include:' "$_env_src")"
          if [ "$_env_n" != "1" ]; then
            log "[wp11-ci-envelope] FAILED: expected exactly one include: line in the root manifest, found $_env_n -- nothing written, the FULL roster will deploy"
            printf 'failed\t-\troot manifest has %s include: lines, expected 1\n' "$_env_n" > "$_env_state"
            return 1
          fi
          _env_tmp="$_env_dir/.zeta-root-wp11-ci-envelope.tmp"
          {
            echo "$_env_tag"
            "$AWK" -v g="$_env_glob" -v q="'" '
              { print }
              /^[[:space:]]*include:/ {
                match($0, /^[[:space:]]*/)
                printf "%sexclude: %s%s%s\n", substr($0, 1, RLENGTH), q, g, q
              }
            ' "$_env_src"
          } > "$_env_tmp"
          if [ "$("$GREP" -cF "exclude: '$_env_glob'" "$_env_tmp")" != "1" ]; then
            "$RM" -f "$_env_tmp"
            log "[wp11-ci-envelope] FAILED: the exclude line did not land in the copy -- nothing written, the FULL roster will deploy"
            printf 'failed\t-\texclude line not present after injection\n' > "$_env_state"
            return 1
          fi
          "$MV" -f "$_env_tmp" "$_env_override"
          echo "$_env_tag" > "$_env_skip"
          log "[wp11-ci-envelope] applied: this guest does NOT deploy $_env_glob (k8s/wp11-ci-envelope.json carries each reason); a real install deploys them"
          printf 'applied\t%s\tk8s/wp11-ci-envelope.json\n' "$_env_glob" > "$_env_state"
          return 0
        }
        # ZETA-WP11-ENVELOPE-END
        zeta_wp11_envelope_apply "${markerFile}" "${manifestsDir}" "${rootSrc}" "${excludeGlob}" "${stateDir}"
      '';
    };
  };
}
