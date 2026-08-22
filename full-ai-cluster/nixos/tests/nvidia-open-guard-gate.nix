# full-ai-cluster/nixos/tests/nvidia-open-guard-gate.nix
#
# Regression test for the EVAL-TIME half of ../modules/nvidia-open-guard.nix.
#
# 081M00QP33F087G0R001JKB5QM shipped that guard as its deliverable: the flip to
# `hardware.nvidia.open = true` must not be landable without a per-host preflight
# attestation, because the open kernel modules need a GSP (Turing+) and no host
# config in this repo records which card is in which box. The guard's eval
# behaviour was checked by hand when it was written and then by nothing at all —
# no test, no CI step, no flake check referenced it. A gate nobody re-runs is a
# gate that can go vacuous in a refactor while still reading as enforcement.
#
# This is an EVALUATION test, not a VM test: it costs no boot, and it runs under
# the `nix flake check --no-build` step the ISO workflow already performs on every
# PR touching full-ai-cluster/nixos/**. Forcing this attribute forces the asserts.
#
# It does NOT test the boot-time driver-bound unit's VERDICT — that needs real
# NVIDIA silicon, which CI does not have. What it checks about that unit is
# REACHABILITY: it is installed in EVERY state, `open` or not.
#
# That expectation is the inverse of what this test asserted when it was
# written, and the inversion is the point. Until 2026-08-21 the unit was
# `lib.mkIf useOpen` and check A here pinned "as-shipped does NOT install the
# boot-time driver-bound unit" — encoding as intended behaviour a guard that had
# executed zero times on zero hosts, since gpu.nix ships `open = lib.mkDefault
# false` and nothing overrides it. The module now installs it unconditionally
# (see ../modules/nvidia-open-guard.nix), and A/D below are what stop it
# regressing to `mkIf`.
#
# Robustness note: the states are compared to a BASELINE count of failing
# assertions taken from the config as-shipped, rather than to the absolute number
# 0. Unrelated modules are free to add their own assertions without making this
# test lie about the gate.

{ pkgs, nixosConfig }:

let
  inherit (pkgs) lib;

  # The real worker-gpu configuration with one extra module layered on top, so
  # the gate is exercised against the module set that actually ships — not a
  # hand-rolled stub that could drift away from it.
  withModule = mod: (nixosConfig.extendModules { modules = [ mod ]; }).config;

  failingMessages = cfg:
    map (a: a.message) (builtins.filter (a: !a.assertion) cfg.assertions);

  probe = mod:
    let
      cfg = withModule mod;
      failures = failingMessages cfg;
    in {
      inherit failures;
      count = builtins.length failures;
      bootUnitPresent = cfg.systemd.services ? nvidia-open-driver-bound-check;

      # Control for the presence test itself: a unit name no module defines.
      # If this ever reads true, `?` is not asking what the checks think it is.
      absentControl = cfg.systemd.services ? nvidia-open-driver-bound-check-absent-control;
    };

  # ---- the four gate states -------------------------------------------------

  # A. As shipped. `open = lib.mkDefault false`; the guard must be inert.
  shipped = probe { };

  # B. The unattested flip — the case the gate exists for.
  flipped = probe { hardware.nvidia.open = lib.mkForce true; };

  # C. `passed = true` asserted with nothing behind it.
  noEvidence = probe {
    hardware.nvidia.open = lib.mkForce true;
    zeta.gpu.openModulePreflight.passed = true;
  };

  # D. A complete attestation — the one state that must build.
  attested = probe {
    hardware.nvidia.open = lib.mkForce true;
    zeta.gpu.openModulePreflight.passed = true;
    zeta.gpu.openModulePreflight.evidence =
      "eval-test: not a real node, see nvidia-open-guard-gate.nix";
  };

  baseline = shipped.count;

  # The message added by state X relative to the shipped baseline, so the test
  # can check WHICH gate fired rather than only that something did.
  addedMessage = state:
    let extra = lib.subtractLists shipped.failures state.failures;
    in if extra == [ ] then "" else builtins.head extra;

  contains = needle: haystack: lib.hasInfix needle haystack;

  checks = [
    { name = "A: as-shipped adds no failing assertion";
      ok = shipped.count == baseline; }

    # REACHABILITY, both directions. A guard only some hosts instantiate cannot
    # fire where it matters; this unit was that guard until the boot probe was
    # made unconditional. `open = false` is the state EVERY host in this repo is
    # actually in, so it is the state the unit has to be present in.
    { name = "A: as-shipped (open=false) DOES install the boot-time driver-bound unit";
      ok = shipped.bootUnitPresent; }

    { name = "B: open=true without a preflight FAILS the build";
      ok = flipped.count == baseline + 1; }

    { name = "B: and it fails on the preflight gate specifically";
      ok = contains "openModulePreflight" (addedMessage flipped); }

    { name = "C: passed=true with empty evidence FAILS the build";
      ok = noEvidence.count == baseline + 1; }

    { name = "C: and it fails on the evidence gate specifically";
      ok = contains "evidence" (addedMessage noEvidence); }

    { name = "D: a complete attestation adds no failing assertion";
      ok = attested.count == baseline; }

    { name = "D: and it DOES install the boot-time driver-bound unit";
      ok = attested.bootUnitPresent; }

    { name = "the boot unit is reachable in EVERY gate state, not only the flipped ones";
      ok = builtins.all (st: st.bootUnitPresent) [ shipped flipped noEvidence attested ]; }

    # Non-vacuity of the reachability property above. `? name` on
    # `systemd.services` has to be capable of reading FALSE, or the four checks
    # are asserting a constant and would survive the unit being deleted.
    { name = "the presence test discriminates (an undefined unit name reads false)";
      ok = !shipped.absentControl; }
  ];

  failed = builtins.filter (c: !c.ok) checks;

  report = lib.concatMapStringsSep "\n" (c: "  FAILED: ${c.name}") failed;
in

assert lib.assertMsg (failed == [ ]) ''
  nvidia-open-guard eval gate regressed — ${toString (builtins.length failed)} of
  ${toString (builtins.length checks)} expectations did not hold:

  ${report}

  baseline failing assertions (config as shipped): ${toString baseline}
    open=true, no preflight            -> ${toString flipped.count}
    open=true, passed, empty evidence  -> ${toString noEvidence.count}
    open=true, fully attested          -> ${toString attested.count}

  This gate is what stops `hardware.nvidia.open = true` landing on a node whose
  GPU generation nobody has established. If it no longer refuses, do not "fix"
  the test — fix ../modules/nvidia-open-guard.nix.
'';

pkgs.runCommand "nvidia-open-guard-gate"
  {
    meta.description =
      "Eval-time regression test for hardware.nvidia.open's preflight-attestation gate";
  }
  ''
    echo "nvidia-open-guard: ${toString (builtins.length checks)} eval expectations held" > "$out"
  ''
