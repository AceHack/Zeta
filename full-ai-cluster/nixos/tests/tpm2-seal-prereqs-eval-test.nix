# full-ai-cluster/nixos/tests/tpm2-seal-prereqs-eval-test.nix
#
# Properties of the TPM-seal desired-state model and the module that carries it.
#
# NOT a NixOS VM test (unlike most siblings in this directory). It is a pure
# evaluation test: it throws on failure, so forcing its value IS running it.
# `flake.nix` forces it inside `checks.<system>.tpm2-seal-prereqs-model`, which
# `nix flake check --no-build` evaluates on every PR touching
# `full-ai-cluster/nixos/**`.
#
# Run it directly:
#   nix eval --impure --expr '
#     import ./full-ai-cluster/nixos/tests/tpm2-seal-prereqs-eval-test.nix {
#       lib = (builtins.getFlake "nixpkgs").lib;
#     }'
#
# WHAT IT CANNOT TELL YOU. Every property below is about a Nix value. None of
# them touches a TPM, a PKCS#11 token, a PIN, a key, or a seal. They cannot tell
# you whether a node HAS a TPM 2.0 — nothing in this repo has ever asked one —
# and they cannot tell you whether `libtpm2_pkcs11.so` loads, whether the module
# talks to `/dev/tpmrm0`, or whether OpenBao can wrap anything with it. What
# they DO catch is a future change that loosens the provision gate, smuggles a
# custody decision into a derived plan, collapses the probe's five states back
# into a boolean, or drops the `withHsm` pin that keeps the PKCS#11 code
# compiled into the `bao` binary.
#
# The `prereqs` rung is evaluated against a FAKE `pkgs` (two stubs), which is
# what keeps this test hermetic and channel-free. That is also its limit: it
# proves the module ASKS for those packages, never that they build.

{ lib }:

let
  model = import ../modules/tpm2-seal-model.nix;

  # A property records its own verdict rather than throwing on the spot, so a
  # mutation shows EVERY property it breaks instead of only the first.
  check = name: cond: { inherit name; ok = cond; };

  throws = f: !(builtins.tryEval (builtins.deepSeq (f null) true)).success;

  allPlans = map model.derivePlan model.modes;

  isBoolOrNull = v: v == null || builtins.isBool v;

  # Two stubs, not derivations: enough for the module to reference them, cheap
  # enough that this test needs no channel and builds nothing.
  fakePkgs = {
    tpm2-tools = "PKG:tpm2-tools";
    openbao = {
      override = args: "PKG:openbao(withHsm=${lib.boolToString args.withHsm})";
    };
  };

  # Evaluate the NixOS module standalone. `assertions`, `security` and
  # `environment` are normally supplied by nixpkgs' own modules; minimal stubs
  # keep this test free of a full NixOS eval (fast, and works on any host).
  evalModule =
    mode:
    (lib.evalModules {
      modules = [
        ../modules/tpm2-seal-prereqs.nix
        {
          options.assertions = lib.mkOption {
            type = lib.types.listOf lib.types.unspecified;
            default = [ ];
          };
          options.security = lib.mkOption {
            type = lib.types.attrsOf lib.types.unspecified;
            default = { };
          };
          options.environment = lib.mkOption {
            type = lib.types.attrsOf lib.types.unspecified;
            default = { };
          };
          config._module.args.pkgs = fakePkgs;
          config.zeta.tpm2Seal.mode = mode;
        }
      ];
    }).config;

  offCfg = evalModule "off";
  prereqCfg = evalModule "prereqs";
  provisionCfg = evalModule "provision";

  failedAssertions = cfg: builtins.filter (a: !a.assertion) cfg.assertions;

  properties = [
    # ---- the modes are exactly three, and `off` is first (the default) -----
    (check "modes are off/prereqs/provision" (model.modes == [ "off" "prereqs" "provision" ]))

    # ---- a plan can never carry a custody decision ------------------------
    (check "no plan attribute names a custody key" (
      builtins.all (
        plan: builtins.all (k: !(builtins.elem k (builtins.attrNames plan))) model.custodyKeys
      ) allPlans
    ))
    (check "every plan value is a bool or null" (
      builtins.all (plan: builtins.all (n: isBoolOrNull plan.${n}) (builtins.attrNames plan)) allPlans
    ))
    (check "every plan has the same attribute set" (
      builtins.all (
        plan: builtins.attrNames plan == builtins.attrNames (model.derivePlan "off")
      ) allPlans
    ))

    # ---- `off` is a provable no-op ---------------------------------------
    (check "off provisions nothing" (
      let p = model.derivePlan "off"; in
      !p.tpm2Enable && !p.pkcs11Module && !p.tctiEnvironment && !p.tpm2Tools
      && !p.baoCliWithHsm && !p.provisionToken && !p.mintSealKey
    ))
    (check "off claims nothing about hardware" ((model.derivePlan "off").tpmMustBePresent == null))
    (check "off sets no security option" (offCfg.security == { }))
    (check "off sets no system package" (offCfg.environment == { }))

    # ---- `prereqs` stops exactly at custody ------------------------------
    (check "prereqs installs the userspace" (
      let p = model.derivePlan "prereqs"; in
      p.tpm2Enable && p.pkcs11Module && p.tctiEnvironment && p.tpm2Tools && p.baoCliWithHsm
    ))
    (check "prereqs mints nothing" (
      let p = model.derivePlan "prereqs"; in !p.provisionToken && !p.mintSealKey
    ))
    # The load-bearing one: installing a TPM userspace asserts nothing about
    # silicon. A `prereqs` plan that claimed presence would be a check that
    # cannot fail on a node with no TPM.
    (check "prereqs claims nothing about hardware" ((model.derivePlan "prereqs").tpmMustBePresent == null))
    (check "prereqs turns on security.tpm2" (prereqCfg.security.tpm2.enable == true))
    (check "prereqs grants the resource manager via udev" (prereqCfg.security.tpm2.applyUdevRules == true))
    (check "prereqs points TCTI at the resource manager, not the raw device" (
      prereqCfg.security.tpm2.tctiEnvironment.deviceConf == "/dev/tpmrm0"
    ))
    # If `withHsm` is ever dropped the node ships a `bao` that cannot see a
    # PKCS#11 token at all — a seal that fails at runtime, not at build.
    (check "prereqs pins the bao CLI's hsm build tag" (
      builtins.elem "PKG:openbao(withHsm=true)" prereqCfg.environment.systemPackages
    ))
    (check "prereqs installs tpm2-tools" (
      builtins.elem "PKG:tpm2-tools" prereqCfg.environment.systemPackages
    ))

    # ---- the gate ---------------------------------------------------------
    (check "off passes every assertion" (failedAssertions offCfg == [ ]))
    (check "prereqs passes every assertion" (failedAssertions prereqCfg == [ ]))
    (check "provision fails an assertion" (builtins.length (failedAssertions provisionCfg) == 1))
    (check "the refusal names the custody fork" (
      let
        fails = failedAssertions provisionCfg;
        # Guarded, not assumed: if the gate is ever loosened this property must
        # report ITS OWN name, not die on `head []` and hide behind a stack trace.
        msg = if fails == [ ] then "" else (builtins.head fails).message;
      in
      lib.hasInfix "unexportable" msg && lib.hasInfix "IMPORTED" msg && lib.hasInfix "escrow blob" msg
    ))
    (check "an unknown mode throws rather than defaulting" (throws (_: model.derivePlan "hardware")))

    # ---- assess keeps "could not look" distinct from "no TPM" -------------
    (check "off/prereqs make no hardware claim" (
      model.assess { mode = "off"; tpmState = null; } == "no-claim"
      && model.assess { mode = "prereqs"; tpmState = "absent"; } == "no-claim"
    ))
    (check "provision + never probed is `unprobed`" (
      model.assess { mode = "provision"; tpmState = null; } == "unprobed"
    ))
    (check "provision + present agrees" (
      model.assess { mode = "provision"; tpmState = "present"; } == "agree"
    ))
    # `absent` is the ONLY producer of drift: it is the one state that means an
    # enumeration succeeded and found nothing. The other three mean the check
    # did not run, and rounding any of them to `drift` would be the failure
    # tpm2-linux-probe.ts was written to stop.
    (check "only `absent` produces drift" (
      model.assess { mode = "provision"; tpmState = "absent"; } == "drift"
      && model.assess { mode = "provision"; tpmState = "unreadable"; } == "check-did-not-run"
      && model.assess { mode = "provision"; tpmState = "unavailable"; } == "check-did-not-run"
      && model.assess { mode = "provision"; tpmState = "indeterminate"; } == "check-did-not-run"
    ))
  ];

  failures = builtins.filter (p: !p.ok) properties;
  names = builtins.concatStringsSep ", " (map (p: p.name) failures);
in
if failures == [ ] then
  {
    status = "tpm2-seal-prereqs-model: ${toString (builtins.length properties)} properties hold";
  }
else
  throw "tpm2-seal-prereqs-model: ${toString (builtins.length failures)} properties FAILED: ${names}"
