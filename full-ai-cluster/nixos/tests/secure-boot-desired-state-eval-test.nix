# full-ai-cluster/nixos/tests/secure-boot-desired-state-eval-test.nix
#
# 081M00KTH58087G0R00120WT6F — properties of the Secure Boot desired-state model.
#
# NOT a NixOS VM test (unlike its siblings in this directory). It is a pure
# evaluation test: it throws on failure, so forcing its value IS running it.
# `flake.nix` forces it inside `checks.x86_64-linux.secure-boot-desired-state-model`,
# which `nix flake check --no-build` evaluates on every PR touching
# `full-ai-cluster/nixos/**`.
#
# Run it directly:
#   nix eval --impure --expr '
#     import ./full-ai-cluster/nixos/tests/secure-boot-desired-state-eval-test.nix {
#       lib = (builtins.getFlake "nixpkgs").lib;
#     }'
#
# WHAT IT CANNOT TELL YOU. Every property below is about a Nix value. None of
# them touches firmware, a signature, a key, or a boot. They cannot detect an
# unbootable node, a failed enrolment, or a mis-signed UKI, because nothing in
# this repo signs or enrols anything yet. What they DO catch is a future change
# that silently loosens the enforce-phase brick guard, that smuggles a
# key-custody decision into a derived plan, or that lets a non-"off" phase
# evaluate without the maintainer's answers.

{ lib }:

let
  model = import ../modules/secure-boot-phase-model.nix;

  # ---- helpers ----------------------------------------------------------

  # A property records its own verdict rather than throwing on the spot, so a
  # mutation shows EVERY property it breaks instead of only the first — the
  # difference between "a check went red" and knowing what the check covers.
  check = name: cond: {
    inherit name;
    ok = cond;
  };

  # `derivePlan` on a bad phase must throw rather than return a default.
  throws = f: !(builtins.tryEval (builtins.deepSeq (f null) true)).success;

  allPlans = map model.derivePlan model.phases;

  planAttrNames = plan: builtins.attrNames plan;

  isBoolOrNull = v: v == null || builtins.isBool v;

  # Evaluate the NixOS module standalone. `assertions` is normally supplied by
  # nixpkgs' assertion module; declaring a minimal stub keeps this test free of
  # a full NixOS eval (fast, and works on any host platform).
  evalModule =
    phase:
    (lib.evalModules {
      modules = [
        ../modules/secure-boot.nix
        {
          options.assertions = lib.mkOption {
            type = lib.types.listOf lib.types.unspecified;
            default = [ ];
          };
        }
        { zeta.secureBoot.phase = phase; }
      ];
    }).config;

  offConfig = evalModule "off";
  enforceConfig = evalModule "enforce";
  provisionConfig = evalModule "provision";

  failing = cfgAssertions: builtins.filter (a: !a.assertion) cfgAssertions;

  # ---- properties -------------------------------------------------------

  results = [
    # P1 totality — every declared phase derives a plan, and all plans carry
    # the same attribute names. A phase with a missing key is a phase whose
    # derived state is partly undefined, i.e. a second place to describe it.
    (check "every phase derives a plan with identical attribute names" (
      builtins.length allPlans == builtins.length model.phases
      && builtins.all (p: planAttrNames p == planAttrNames (builtins.head allPlans)) allPlans
    ))

    # P2 the brick guard (design doc §5.3). `enforce` must refuse unsigned
    # images; if this flips to true, a lost /var/lib/sbctl silently installs
    # unsigned UKIs and the node dies at the next reboot.
    (check "enforce refuses unsigned images" ((model.derivePlan "enforce").allowUnsigned == false))

    # P3 provision must TOLERATE unsigned — the inverse guard. A "safer"
    # tightening here bricks a node before its firmware ceremony.
    (check "provision tolerates unsigned before enrolment" (
      (model.derivePlan "provision").allowUnsigned == true
    ))

    # P4 the default phase is a provable no-op: exactly today's bootloader.
    (check "off is the fleet's current bootloader, unchanged" (
      (model.derivePlan "off") == {
        lanzabooteEnable = false;
        systemdBootEnable = true;
        allowUnsigned = null;
        firmwareMustEnforce = null;
      }
    ))

    # P5 an unknown phase throws rather than defaulting. A typo'd phase must
    # never silently mean "off" (that reads as compliance and enables nothing)
    # nor silently mean "enforce".
    (check "an unknown phase throws" (throws model.derivePlan))

    # P6 NO CUSTODY DECISION IS DERIVABLE. Two ways to violate this: name a
    # custody key, or carry a value that could BE a custody decision (a path,
    # a CA name, a URL). Both are refused — plans are booleans and nulls only.
    (check "no plan attribute names a custody decision" (
      builtins.all (
        p: builtins.all (k: !(builtins.elem k model.custodyKeys)) (planAttrNames p)
      ) allPlans
    ))
    (check "every plan value is a bool or null (no key paths, no CA names)" (
      builtins.all (p: builtins.all isBoolOrNull (builtins.attrValues p)) allPlans
    ))

    # P7 firmware state is a measurement, not a declaration. Only `enforce`
    # asserts anything about firmware; "unmeasured" must be distinguishable
    # from "agree", so a check that never ran cannot read as one that passed.
    (check "off makes no claim about firmware" (
      model.assess {
        phase = "off";
        firmwareSecureBoot = true;
      } == "no-claim"
    ))
    (check "provision makes no claim about firmware (ceremony may be pending)" (
      model.assess {
        phase = "provision";
        firmwareSecureBoot = false;
      } == "no-claim"
    ))
    (check "enforce with no measurement is unmeasured, not agreed" (
      model.assess {
        phase = "enforce";
        firmwareSecureBoot = null;
      } == "unmeasured"
    ))
    (check "enforce against a non-enforcing firmware is drift" (
      model.assess {
        phase = "enforce";
        firmwareSecureBoot = false;
      } == "drift"
    ))
    (check "enforce against an enforcing firmware agrees" (
      model.assess {
        phase = "enforce";
        firmwareSecureBoot = true;
      } == "agree"
    ))

    # P8 the module's default is inert: no failing assertion, and the derived
    # plan matches the model (the module does not re-describe the phase).
    (check "module at default phase raises no failing assertion" (
      failing offConfig.assertions == [ ]
    ))
    (check "module derives its plan from the model, not from itself" (
      offConfig.zeta.secureBoot.plan == model.derivePlan "off"
    ))

    # P9 fail-closed. Any phase that would need a custody decision must FAIL
    # evaluation, and the failure must name why. A gate whose message does not
    # name the blocking question sends the next agent looking for a bug.
    (check "enforce fails closed" (builtins.length (failing enforceConfig.assertions) == 1))
    (check "provision fails closed" (builtins.length (failing provisionConfig.assertions) == 1))
    (check "the refusal names the custody blocker" (
      let
        failed = failing enforceConfig.assertions;
      in
      failed != [ ]
      && builtins.match ".*key[[:space:]]+custody.*" (
        builtins.replaceStrings [ "\n" ] [ " " ] (builtins.head failed).message
      ) != null
    ))

    # P10 the module sets no bootloader option at any phase. This is the claim
    # the PR body makes about safety, so it is checked rather than asserted:
    # the evaluated config's top level must carry only `zeta` and `assertions`.
    (check "the module defines no option outside zeta.secureBoot + assertions" (
      builtins.sort builtins.lessThan (builtins.attrNames offConfig) == [
        "assertions"
        "zeta"
      ]
    ))
  ];
  failures = builtins.filter (r: !r.ok) results;
in
{
  inherit results failures;

  # Forcing `status` runs every property. It is a string on success and a throw
  # naming every broken property on failure — so a consumer (flake.nix) that
  # merely evaluates it cannot pass while a property is red.
  status =
    if failures == [ ] then
      "secure-boot desired-state model: ${toString (builtins.length results)} properties held"
    else
      throw "secure-boot desired-state model FAILED: ${
        builtins.concatStringsSep "; " (map (r: r.name) failures)
      }";
}
