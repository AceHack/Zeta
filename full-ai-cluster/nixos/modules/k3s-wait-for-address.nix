# full-ai-cluster/nixos/modules/k3s-wait-for-address.nix
#
# WP20 (081M34R7P99087G0R000H77GX9). Root-cause work for run 35717757526:
# k3s.service on the real installed disk NEVER reached `active` in 4201s.
#
# WHAT THIS FIXES, AND WHAT IT DOES NOT
# ----------------------------------------
# nixpkgs' rancher/k3s module (checked against the pinned nixos-26.05 branch,
# commit 1e8bc658, nixos/modules/services/cluster/rancher/default.nix) orders
# k3s.service with:
#
#   after = [ "firewall.service" "network-online.target" ];
#   wants = [ "firewall.service" "network-online.target" ];
#
# `wants`, not `requires` -- a FAILING network-online.target would not take
# k3s down with it. The risk is the ORDERING half: `After=` defers k3s's
# start job until network-online.target's own job has SETTLED (active or
# failed). This repo has a directly measured precedent for that apparently
# never happening on the real installed-disk image:
# `zeta-first-boot-k3s-verify.nix` (081M33XMWME087G0R000825CCB, run
# 35697298781) carried the identical `after = [ ... "network-online.target"
# ... ]` shape and printed NOTHING across a 75+ minute window, while sibling
# units ordered only on `local-fs.target` printed fine on the same boot.
#
# HONEST LIMIT, RECORDED RATHER THAN PAPERED OVER: a WP20 negative control
# (architect-requested; claude/control-plane-host-vm-boot-repro, runs
# 35742067241 and 35743154251 -- the second boots through the REAL
# UEFI/OVMF/systemd-boot chain, not nixosTest's fast default path) did NOT
# reproduce the defect even without this fix -- k3s.service reached active in
# well under 30s both times, network-online.target settled promptly, and no
# ordering cycle ever appeared. So this change is NOT validated by a
# passing/failing VM run either way; it rests on the sibling-unit precedent
# above, on the upstream dependency being `wants` rather than `requires`
# (checked, not assumed), and on the design argument below. Final validation
# is PR #17530's real installed-disk ISO re-run (branch
# claude/wp11-k3s-diagnostics) with richer diagnostics -- cross-check this
# fix's effect against THAT evidence before treating the question closed.
#
# THE DESIGN: DROP THE ORDERING, ADD A BOUNDED POSITIVE WAIT
# --------------------------------------------------------------
# Two changes, deliberately both, because they cover different failure
# shapes:
#
#   1. `after`/`wants` drop `network-online.target`, keeping only
#      `firewall.service` (k3s opens ports the firewall must have already
#      shaped). This is what stops k3s waiting on a target that -- on the
#      measured sibling unit -- can apparently fail to settle at all, which a
#      bounded ordering timeout would not: `After=` has no timeout of its own:
#      it waits for the OTHER unit's start job to finish, however long that
#      takes.
#
#   2. Risk this drop introduces (named by the architect, 2026-09-22): k3s
#      does not pass `--node-ip`/`--advertise-address` (checked: `grep -n
#      'node-ip\|advertise-address' k3s-server.nix k3s-agent.nix` -- no
#      hits), so k3s self-resolves its node address at process start. Without
#      SOME wait for an interface to be configured, k3s could start before
#      NetworkManager has assigned an address at all. Mitigated two ways:
#      - `ExecStartPre` below is a BOUNDED positive check (poll for a
#        global-scope IPv4 address, up to 120s, then proceed regardless --
#        never blocks boot beyond the bound, unlike the removed ordering).
#      - k3s's own upstream `Restart = "always"; RestartSec = "5s";` is the
#        backstop for a still-later address: a k3s that starts with no
#        address at all fails its own startup and systemd retries it every
#        5s, which self-heals within tens of seconds once an address exists
#        -- cheap insurance under normal boot timing, and unconditional
#        (does not depend on this module at all).
#
#      NOT chosen: fixing NetworkManager-wait-online's own settling behaviour
#      directly. The repro evidence above gives no council on WHAT would be
#      broken there (network-online settled fine on every VM run this repo
#      could produce), so there is nothing concrete to fix yet -- see
#      PR #17530.
#
# Imported by BOTH k3s-server.nix and k3s-agent.nix: nixpkgs' rancher module
# names the systemd unit "k3s" on both roles (the same `mkRancherModule`
# function, parameterized only by role/flags), so the ordering risk and the
# node-ip risk are identical on an agent even though run 35717757526 only
# exercised a server.

{ config, lib, pkgs, ... }:

{
  systemd.services.k3s = {
    after = lib.mkForce [ "firewall.service" ];
    wants = lib.mkForce [ "firewall.service" ];

    serviceConfig.ExecStartPre = [
      (pkgs.writeShellScript "zeta-k3s-wait-for-address" ''
        set -u
        IP=${pkgs.iproute2}/bin/ip
        deadline=$(( $(date +%s) + 120 ))
        while [ "$(date +%s)" -lt "$deadline" ]; do
          if "$IP" -4 -o addr show scope global 2>/dev/null | grep -q .; then
            echo "zeta-k3s-wait-for-address: a global-scope IPv4 address is present; proceeding."
            exit 0
          fi
          sleep 2
        done
        echo "zeta-k3s-wait-for-address: no global-scope IPv4 address after 120s; proceeding anyway (k3s's own Restart=always/RestartSec=5s covers a still-later address)." >&2
        exit 0
      '')
    ];
  };
}
