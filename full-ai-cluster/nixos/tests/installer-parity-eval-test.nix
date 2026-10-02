# full-ai-cluster/nixos/tests/installer-parity-eval-test.nix
#
# Properties of the installer-parity change (work item 081M3YY6TWX087G0R003HZTVWQ): the fixes that
# were made at RUNTIME on node-5b2dfa on 2026-10-02 and that the next ISO must carry natively.
# NOT a VM test and NOT a boot test: pure evaluation, forcing `status` runs every property below.
# `flake.nix` forces it inside `checks.<system>.installer-parity-model`, which
# `nix flake check --no-build` evaluates on every PR.
#
# It reads the REAL `nixosConfigurations.control-plane` and `.worker-gpu`, so what it checks is what
# those hosts ship.
#
# WHAT IT CAN TELL YOU
#   1. inbound TCP 443 is in `networking.firewall.allowedTCPPorts` on BOTH hosts, and TCP 80 is NOT
#      (the decision in modules/node-public-https.nix: nothing on the host listens on 80);
#   2. the pure `hostsFor` maps a public domain to exactly gitlab.<d> and registry.<d> on loopback, and
#      to nothing for an empty, malformed, upper-case or dotless domain;
#   3. the merge did not clobber the names other modules put on 127.0.0.1 (`control-plane`);
#   4. the kubelet is told to start image GC strictly below the eviction line, which is READ from
#      k3s-kubelet-reservations.sh rather than restated, and container logs are bounded;
#   5. key-based sudo is OFF by default (no PAM change on a stock host), and forcing it ON reaches the one
#      switch that activates it (`security.pam.sshAgentAuth.enable`; the sudo service's own flag is already
#      true on a stock host, nixos/modules/security/sudo.nix).
#
# WHAT IT CANNOT TELL YOU
#   Nothing here boots a node. It does not show that NixOS renders the firewall rule or /etc/hosts line,
#   that the kubelet honours the GC flags, that the router delivers to the node, or that a PAM sudo login
#   accepts an agent signature. Only an install and a login show those.

{ pkgs, nixosConfig, secondHostConfig }:

let
  inherit (pkgs) lib;
  publicHosts = import ../lib/public-hosts.nix { inherit lib; };

  must = cond: msg: if cond then true else throw msg;

  # (1) firewall ------------------------------------------------------------------------------------
  firewallOk = label: hostCfg:
    let ports = hostCfg.config.networking.firewall.allowedTCPPorts; in
    must (builtins.elem 443 ports)
      "${label}: TCP 443 is not in networking.firewall.allowedTCPPorts (the node-lan-hosts relay's port)"
    && must (!(builtins.elem 80 ports))
      "${label}: TCP 80 is open, but nothing on the host listens on it (modules/node-public-https.nix records why it stays closed)";

  # (2) the pure hosts function --------------------------------------------------------------------
  hostsOk =
    must (publicHosts.hostsFor "flowdent.net" == { "127.0.0.1" = [ "gitlab.flowdent.net" "registry.flowdent.net" ]; })
      "hostsFor flowdent.net did not return exactly gitlab/registry on 127.0.0.1"
    && must (publicHosts.hostsFor "" == { })
      "hostsFor \"\" must be empty (a LAN-only install has no public name)"
    && must (publicHosts.hostsFor "not a domain" == { })
      "hostsFor a malformed domain must be empty"
    && must (publicHosts.hostsFor "localhost" == { })
      "hostsFor a dotless name must be empty"
    && must (publicHosts.hostsFor "Flowdent.NET" == { })
      "hostsFor is case-strict: the module lower-cases BEFORE calling it, so an upper-case input reaching here is a bug upstream"
    && must (publicHosts.hostsFor "evil.net\n10.0.0.1 x" == { })
      "hostsFor must not let a newline smuggle a second /etc/hosts line";

  # (3) merge --------------------------------------------------------------------------------------
  mergeOk =
    let loopback = nixosConfig.config.networking.hosts."127.0.0.1" or [ ]; in
    must (builtins.elem "control-plane" loopback)
      "control-plane host lost the `control-plane` loopback alias (networking.hosts merge clobbered it)";

  # (4) kubelet disk flags --------------------------------------------------------------------------
  reservationsScript = builtins.readFile ../modules/k3s-kubelet-reservations.sh;
  evictionImagefsFreePercent = 15;
  evictionLineUsedPercent = 100 - evictionImagefsFreePercent;

  flagValue = flags: key:
    let
      prefix = "--kubelet-arg=${key}=";
      hits = builtins.filter (f: lib.hasPrefix prefix f) flags;
    in
    if hits == [ ] then throw "k3s extraFlags carries no ${prefix}<value>"
    else lib.removePrefix prefix (builtins.head hits);

  kubeletOk = label: hostCfg:
    let
      flags = hostCfg.config.services.k3s.extraFlags;
      gcHigh = lib.toInt (flagValue flags "image-gc-high-threshold");
      gcLow = lib.toInt (flagValue flags "image-gc-low-threshold");
    in
    must (lib.hasInfix "imagefs.available<${toString evictionImagefsFreePercent}%" reservationsScript)
      "k3s-kubelet-reservations.sh no longer evicts at imagefs.available<${toString evictionImagefsFreePercent}%: restate evictionImagefsFreePercent here from the script"
    && must (gcLow < gcHigh)
      "${label}: image-gc-low-threshold (${toString gcLow}) must be below image-gc-high-threshold (${toString gcHigh})"
    && must (gcHigh + 5 <= evictionLineUsedPercent)
      "${label}: image-gc-high-threshold ${toString gcHigh} leaves under 5 points before the eviction line at ${toString evictionLineUsedPercent}% used, so GC gets no head start"
    && must (builtins.elem "--kubelet-arg=container-log-max-files=3" flags && builtins.elem "--kubelet-arg=container-log-max-size=10Mi" flags)
      "${label}: container log bounds are missing from k3s extraFlags";

  # (5) operator sudo -------------------------------------------------------------------------------
  forcedOn = nixosConfig.extendModules { modules = [ { zeta.operatorSudo.sshAgentAuth = true; } ]; };
  sudoOk =
    must (nixosConfig.config.zeta.operatorSudo.sshAgentAuth == false)
      "zeta.operatorSudo.sshAgentAuth must default to false (an opt-in widening of who can become root)"
    && must (nixosConfig.config.security.pam.sshAgentAuth.enable == false)
      "a stock host must not enable pam_ssh_agent_auth"
    && must (forcedOn.config.security.pam.sshAgentAuth.enable == true)
      "zeta.operatorSudo.sshAgentAuth = true did not reach security.pam.sshAgentAuth.enable"
    && must (forcedOn.config.security.pam.services.sudo.sshAgentAuth == true)
      "with the global switch on, the sudo PAM service must be using the ssh agent (sudo.nix sets it unconditionally; this fails if that ever changes)";
in
{
  status =
    if firewallOk "control-plane" nixosConfig && firewallOk "worker-gpu" secondHostConfig
      && hostsOk && mergeOk
      && kubeletOk "control-plane" nixosConfig && kubeletOk "worker-gpu" secondHostConfig
      && sudoOk
    then "installer-parity: 443 open and 80 closed on both hosts, hostsFor pinned on 6 cases, GC starts below the ${toString evictionLineUsedPercent}% eviction line, key-based sudo defaults off and flips the one PAM switch when forced on"
    else throw "unreachable: every mismatch above throws";
}
