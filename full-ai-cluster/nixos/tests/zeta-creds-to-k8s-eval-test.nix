# full-ai-cluster/nixos/tests/zeta-creds-to-k8s-eval-test.nix
#
# Properties of the host→Secret projector module.
#
# NOT a VM test and NOT a cluster test. It throws on failure, so forcing
# its value IS running it. flake.nix forces it inside
# checks.<system>.zeta-creds-to-k8s-model. The CI-executed twin is
# src/Core.TypeScript/installer/zeta-creds-to-k8s.test.ts (allowlist +
# leak lock) plus src/Core.TypeScript/cluster/zeta-creds-to-k8s-nix.test.ts
# (this file's After=/requiredBy pins, read as text).
#
# WHAT IT CANNOT TELL YOU. It never talks to k3s, never decrypts a blob,
# and never creates a Secret. It pins the systemd wiring: the unit fires
# after restore + k3s, and a projector miss does not take the API down.

{ lib }:

let
  fakePkgs = {
    writeShellScript = name: text: "SCRIPT:${name}::${text}";
    coreutils = "/stub-coreutils";
  };

  k3sStub = { lib, ... }: {
    options.assertions = lib.mkOption {
      type = lib.types.listOf (lib.types.submodule {
        options.assertion = lib.mkOption { type = lib.types.bool; };
        options.message = lib.mkOption { type = lib.types.str; };
      });
      default = [ ];
    };
    options.systemd.services = lib.mkOption {
      type = lib.types.attrsOf lib.types.unspecified;
      default = { };
    };
    options.services.k3s = {
      enable = lib.mkOption { type = lib.types.bool; default = true; };
      role = lib.mkOption { type = lib.types.str; default = "server"; };
      package = lib.mkOption { type = lib.types.str; default = "/stub-k3s"; };
    };
    options.zeta.credsRestore.persona = lib.mkOption {
      type = lib.types.nullOr lib.types.str;
      default = null;
    };
    config._module.args.pkgs = fakePkgs;
  };

  evalWith = extra: (lib.evalModules {
    modules = [
      k3sStub
      ../modules/zeta-creds-to-k8s.nix
      extra
    ];
  }).config;

  offCfg = evalWith { };
  onCfg = evalWith { zeta.credsToK8s.enable = true; };

  check = name: cond: { inherit name; ok = cond; };

  unit = onCfg.systemd.services.zeta-creds-to-k8s or null;
  after = if unit == null then [ ] else (unit.after or [ ]);
  requiredBy = if unit == null then [ ] else (unit.requiredBy or [ ]);
  exec = if unit == null then "" else toString (unit.serviceConfig.ExecStart or "");

  properties = [
    (check "disabled by default (control-plane common.nix flips it on)" (
      offCfg.zeta.credsToK8s.enable == false
      && !(offCfg.systemd.services ? zeta-creds-to-k8s)
    ))
    (check "enabled unit exists" (unit != null))
    (check "After includes k3s.service" (builtins.elem "k3s.service" after))
    (check "After includes zeta-creds-restore.service" (builtins.elem "zeta-creds-restore.service" after))
    (check "does NOT requiredBy k3s.service" (!(builtins.elem "k3s.service" requiredBy)))
    (check "ExecStart names the projector script" (
      lib.hasInfix "zeta-creds-to-k8s.ts" exec
    ))
    (check "ExecStart invokes k3s kubectl via --k3s-bin" (
      lib.hasInfix "--k3s-bin" exec && lib.hasInfix "/stub-k3s/bin/k3s" exec
    ))
    (check "ExecStart names a skip when bun/script are missing" (
      lib.hasInfix "MISSING precondition" exec && lib.hasInfix "skipping projection" exec
    ))
    (check "missing kubeconfig retries (exit 1), bun/script skip does not swallow it" (
      lib.hasInfix "kubeconfig missing" exec
      && lib.hasInfix "exit 1" exec
      && (unit.serviceConfig.Restart or "") == "on-failure"
    ))
    (check "oneshot RemainAfterExit" (
      unit != null
      && unit.serviceConfig.Type == "oneshot"
      && unit.serviceConfig.RemainAfterExit == true
    ))
  ];

  failures = builtins.filter (r: !r.ok) properties;
in
{
  inherit properties failures;
  status =
    if failures == [ ] then
      "zeta-creds-to-k8s: ${toString (builtins.length properties)} properties held (default-off; After restore+k3s; not requiredBy k3s)"
    else
      throw (
        "zeta-creds-to-k8s eval test: ${toString (builtins.length failures)} of "
        + "${toString (builtins.length properties)} properties FAILED:\n"
        + lib.concatMapStrings (f: "  - ${f.name}\n") failures
      );
}
