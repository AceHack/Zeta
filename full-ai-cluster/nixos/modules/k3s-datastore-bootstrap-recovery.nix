# full-ai-cluster/nixos/modules/k3s-datastore-bootstrap-recovery.nix
#
# 081M39CR74D087G0R002BEG2G4. SERVER ROLE ONLY (a worker agent has no
# `server/db` and nothing here has any effect on it).
#
# ROOT CAUSE, CITED (WP27's run 35968222668, graceful teardown, no
# self-heal -- its ESP marker was intact so all six WP11 verdicts fired):
#
#   k3sServiceActive=false, NRestarts=58, Result=exit-code, 76x in the
#   journal: level=fatal msg="Error: preparing server: failed to bootstrap
#   cluster data: failed to reconcile with local datastore: no bootstrap
#   data found in datastore - check server token value and verify
#   datastore integrity"
#
# k3s creates /var/lib/rancher/k3s/server/db, gets roughly 20 seconds, and
# is stopped before it writes bootstrap data into it. A non-empty datastore
# is the one thing k3s will not initialise into, so it refuses forever. On
# metal: an operator who powers the machine off in the first ~20 seconds of
# its first boot -- impatience, a power cut, a tripped breaker -- gets a
# permanently wedged cluster that no reboot recovers. WP25's own measured
# ~495 restarts (081M39B2MDA087G0R003CCEJPQ, PR #17608) are this same
# fatal, just unobserved because that run's verify unit never ran.
#
# THE NAIVE FIX IS CATASTROPHIC AND IS NOT WHAT THIS MODULE DOES. Deleting
# the datastore whenever k3s reports that fatal is confiscation of the one
# thing on the machine that cannot be regenerated (manifesto §5) -- the
# exact thing `k3s-datastore-preflight.nix` already refuses to do, for the
# dirty-disk case. k3s's OWN error text is ambiguous by construction
# ("check server token value AND verify datastore integrity") -- the
# identical message appears when a GOOD, already-served datastore is
# presented with a WRONG token, and deleting there would destroy a healthy
# cluster.
#
# THE GUARD: A HAS-EVER-BOOTSTRAPPED SENTINEL. Two systemd services, two
# standalone scripts (same discipline as `k3s-agent-tls-self-heal.sh`: a
# file a test can EXECUTE, not merely Nix source nothing runs):
#
#   1. zeta-k3s-datastore-bootstrap-sentinel (sentinel-write.sh) -- writes
#      /var/lib/rancher/k3s/server/db/.zeta-datastore-has-served EXACTLY
#      ONCE, and only once k3s's OWN `/readyz` endpoint has genuinely
#      succeeded (not "the process is active" -- a process can be active
#      while its datastore never finished bootstrapping, which is exactly
#      this bug). Write-once, checked first, before anything else runs.
#   2. zeta-k3s-datastore-bootstrap-recovery (recovery.sh) -- reads that
#      sentinel. If it is ABSENT and k3s has crash-looped past a threshold
#      reporting the exact fatal above, the datastore is STILLBORN (has
#      never held anything a client ever depended on) and is discarded --
#      ONCE per boot, ever -- so k3s can found fresh. If the sentinel IS
#      present, the datastore is NEVER touched, regardless of restart
#      count or how many times the fatal repeats; a loud refusal with the
#      remedy (check the token) is printed instead.
#
# THE ONE-WAY PROPERTY, stated so it stays true: the recovery window opens
# at first boot and closes FOREVER the first time the cluster works. There
# is no code path in either script that can re-open it once the sentinel
# exists.
#
# NOT COUPLED TO THE WP11 ESP MARKER, ON PURPOSE. That marker is what
# proved it can go missing silently (WP25's own run, 495 unobserved
# restarts) -- both services here read only `systemctl`/`journalctl`/a
# real `/readyz` call, and speak on the SERIAL CONSOLE directly (the `say`
# helper in each script), so they work on every boot, on metal, with no
# harness, no ESP marker, and no verify unit present at all.
#
# TESTED: `src/Core.TypeScript/hygiene/k3s-datastore-bootstrap-recovery.test.ts`
# EXECUTES both scripts over fixtures with every external dependency
# (restart count, journal content, the restart command, the readyz check)
# injected via environment variable, and proves the has-served case is
# NEVER touched -- the one property this module exists to guarantee.

{ config, lib, pkgs, ... }:

{
  systemd.services.zeta-k3s-datastore-bootstrap-sentinel = {
    description = "Write the has-ever-bootstrapped sentinel once k3s's own /readyz succeeds";
    after = [ "k3s.service" ];
    # NOT `requires`/`bindsTo` -- this must keep polling even while k3s is
    # down or crash-looping (that is precisely the state it is watching
    # FOR), so it must not be torn down by k3s's own failures.
    wantedBy = [ "multi-user.target" ];
    path = [ pkgs.coreutils pkgs.k3s ];
    serviceConfig = {
      Type = "simple";
      ExecStart = "${pkgs.bash}/bin/bash ${./k3s-datastore-bootstrap-sentinel-write.sh}";
      # Poll: write-once means most invocations after the first successful
      # one are instant no-ops (sentinel already exists), so a short
      # interval costs nothing once settled and catches the "just became
      # ready" moment quickly while it matters.
      Restart = "always";
      RestartSec = "10s";
      StandardOutput = "journal+console";
      StandardError = "journal+console";
    };
  };

  systemd.services.zeta-k3s-datastore-bootstrap-recovery = {
    description = "Recover a STILLBORN k3s datastore; never touch one that has served";
    after = [ "k3s.service" ];
    wantedBy = [ "multi-user.target" ];
    path = [ pkgs.coreutils pkgs.gnugrep pkgs.systemd ];
    serviceConfig = {
      Type = "simple";
      ExecStart = "${pkgs.bash}/bin/bash ${./k3s-datastore-bootstrap-recovery.sh}";
      Restart = "always";
      RestartSec = "10s";
      StandardOutput = "journal+console";
      StandardError = "journal+console";
    };
  };
}
