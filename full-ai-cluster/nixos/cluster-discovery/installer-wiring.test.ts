/**
 * full-ai-cluster/nixos/cluster-discovery/installer-wiring.test.ts
 *
 * THE CALL SITE IS PART OF THE DESIGN, so it gets falsifiers too.
 *
 * `decide.ts` is careful to distinguish "nothing answered" from "I could not
 * look", and every one of its unit tests proves that the DECIDER keeps them
 * apart. None of them can prove that the SHELL SCRIPT calling it does -- and a
 * caller that folds a failed probe back into "no cluster here" undoes the whole
 * module from outside, silently, with every decider test still green.
 *
 * So this file reads the two wiring surfaces as text and checks the properties
 * that only exist at the seam:
 *
 *   1. the ISO runs a responder at all (without a daemon, avahi-browse cannot
 *      run and every probe fails -- a check that never runs)
 *   2. the ISO does NOT advertise itself (an installer is not a cluster node)
 *   3. an explicit declaration skips discovery entirely
 *   4. EVERY refusal reason the decider can emit is routed, and the two that
 *      mean "the probe did not run" are routed differently from the ones that
 *      mean "a cluster answered" -- the roster is derived from decide.ts, so a
 *      new reason added there fails here until it is handled
 *   5. no credential is read, logged, or passed
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const INSTALLER_CONFIG_PATH = fileURLToPath(
  new URL("../../usb-nixos-installer/nixos/installer/configuration.nix", import.meta.url),
);
const FIRST_BOOT_PATH = fileURLToPath(new URL("../../usb-nixos-installer/zeta-first-boot.sh", import.meta.url));
const DECIDE_PATH = fileURLToPath(new URL("./decide.ts", import.meta.url));

const INSTALLER_CONFIG = readFileSync(INSTALLER_CONFIG_PATH, "utf8");
const FIRST_BOOT = readFileSync(FIRST_BOOT_PATH, "utf8");
const DECIDE_SOURCE = readFileSync(DECIDE_PATH, "utf8");

/** Shell text with comment lines removed, so a comment can never satisfy a check. */
const FIRST_BOOT_CODE = FIRST_BOOT.split("\n")
  .filter((line) => !line.trim().startsWith("#"))
  .join("\n");

/** Nix text with comment lines removed, same reason. */
const INSTALLER_CODE = INSTALLER_CONFIG.split("\n")
  .filter((line) => !line.trim().startsWith("#"))
  .join("\n");

/**
 * The `RefusalReason` union, read out of decide.ts rather than copied.
 *
 * Copying it would make this file agree with a snapshot of the decider instead
 * of with the decider, which is the drift the whole exercise is about.
 */
function refusalReasonsFromDecide(): readonly string[] {
  const block = DECIDE_SOURCE.match(/export type RefusalReason =([\s\S]*?);/);
  if (block === null) {
    throw new Error("could not find the RefusalReason union in decide.ts");
  }
  const reasons = [...(block[1] ?? "").matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1] ?? "");
  if (reasons.length === 0) {
    throw new Error("RefusalReason union parsed to zero reasons");
  }
  return reasons;
}

/** The reasons that mean the probe produced NO observation. */
const PROBE_DID_NOT_RUN: readonly string[] = ["probe-failed", "dwell-too-short"];

/**
 * The reason-dispatch `case` in the shell, parsed into arms.
 *
 * Parsed rather than grepped as a blob, because a check that pulls an arm out
 * with a regex and finds nothing then asserts over an EMPTY STRING and passes
 * -- vacuously, which is the failure class this repo is built to refuse. This
 * throws when it cannot find the block, so a rename goes red instead of quietly
 * green. Caught during authoring: the first draft of the two tests below did
 * exactly that, and only a mutation run exposed it.
 */
function reasonDispatchArms(): ReadonlyArray<{ patterns: readonly string[]; body: string }> {
  const block = FIRST_BOOT_CODE.match(/case\s+"\$\{DISCOVER_REASON\}"\s+in([\s\S]*?)\n\s*esac/);
  if (block === null) {
    throw new Error("could not find the DISCOVER_REASON case block in zeta-first-boot.sh");
  }
  const arms = [...(block[1] ?? "").matchAll(/^[ \t]*([a-z0-9|*-]+)\)([\s\S]*?);;/gm)].map((m) => ({
    patterns: (m[1] ?? "").split("|"),
    body: m[2] ?? "",
  }));
  if (arms.length < 2) {
    throw new Error(`expected at least two dispatch arms, parsed ${String(arms.length)}`);
  }
  return arms;
}

/**
 * JUST the `services.avahi = { ... };` block.
 *
 * Scoped on purpose. A file-wide `/enable\s*=\s*true;/` is satisfied by
 * `networking.networkmanager.enable = true;` twenty lines away, so it stays
 * green while avahi is switched OFF -- which is a check that cannot fail
 * wearing the costume of one that passed. This was not hypothetical: the
 * unscoped version of the assertion below survived exactly that mutation.
 */
function avahiBlock(): string {
  const block = INSTALLER_CODE.match(/services\.avahi\s*=\s*\{([\s\S]*?)\n\s*\};/);
  if (block === null) {
    throw new Error("could not find the services.avahi block in the installer configuration");
  }
  return block[1] ?? "";
}

describe("the ISO can actually run the check", () => {
  test("the discover package is in the installer's systemPackages", () => {
    expect(INSTALLER_CODE).toContain("zeta-cluster-discover.nix");
  });

  test("avahi-browse is on PATH, not merely in the store", () => {
    // The measurement that unblocked this wiring found pkgs.avahi was ALREADY
    // in the ISO closure via mesa-demos -- present in the store, absent from
    // PATH. Being in the closure is not being callable.
    const packages = INSTALLER_CODE.match(/environment\.systemPackages\s*=\s*with pkgs;\s*\[([\s\S]*?)\n\s*\];/);
    expect(packages).not.toBeNull();
    expect(packages?.[1] ?? "").toMatch(/^\s*avahi\s*$/m);
  });

  test("an mDNS responder is enabled, because avahi-browse is a client of one", () => {
    // Without a running avahi-daemon, avahi-browse exits non-zero with
    // "Failed to create client object". The probe maps that to
    // responder-unavailable, so the install would refuse on every boot: the
    // wiring would be present and the check would never once run.
    expect(avahiBlock()).toMatch(/enable\s*=\s*true;/);
  });

  test("the firewall is opened for mDNS, or our own firewall manufactures the silence", () => {
    expect(avahiBlock()).toMatch(/openFirewall\s*=\s*true;/);
  });
});

describe("the installer must never advertise itself as a cluster node", () => {
  test("publishing is explicitly off on the live ISO", () => {
    // A live ISO answering on the Zeta service type is a phantom member that
    // vanishes at reboot -- and would make the NEXT node refuse to install.
    // The nixpkgs default is already false; asserting it makes the security
    // property a decision on the record rather than an inherited accident.
    expect(avahiBlock()).toMatch(/publish\.enable\s*=\s*false;/);
    expect(avahiBlock()).not.toMatch(/publish\.enable\s*=\s*true;/);
  });

  test("the ISO does not turn on nss-mdns it has no use for", () => {
    expect(avahiBlock()).toMatch(/nssmdns4\s*=\s*false;/);
    expect(avahiBlock()).toMatch(/nssmdns6\s*=\s*false;/);
  });
});

describe("an explicit declaration always wins over discovery", () => {
  test("provenance, not presence, decides whether a role was declared", () => {
    // HOST is ALWAYS set (the ISO's own conf ships HOST=control-plane), so
    // "is a role set?" is not a usable question. Only the SOURCE separates a
    // human's choice from a build-time fallback.
    expect(FIRST_BOOT_CODE).toContain("ZETA_ROLE_DECLARED");
    expect(FIRST_BOOT_CODE).toMatch(/esp:\*\|keystroke:\*\)\s*ZETA_ROLE_DECLARED=yes/);
  });

  test("an operator keystroke is recorded as a declaration", () => {
    expect(FIRST_BOOT_CODE).toContain('ZETA_ROLE_SOURCE="keystroke:c"');
    expect(FIRST_BOOT_CODE).toContain('ZETA_ROLE_SOURCE="keystroke:w"');
  });

  test("discovery is skipped when the role was declared", () => {
    expect(FIRST_BOOT_CODE).toMatch(/if\s*\[\[\s*"\$\{ZETA_ROLE_DECLARED\}"\s*==\s*"yes"\s*\]\]/);
  });
});

describe("a check that did not run must never look like a check that passed", () => {
  const reasons = refusalReasonsFromDecide();

  test("the decider's refusal roster is non-trivial", () => {
    expect(reasons.length).toBeGreaterThanOrEqual(8);
    for (const expected of PROBE_DID_NOT_RUN) {
      expect(reasons).toContain(expected);
    }
  });

  test("the could-not-run arm carries EXACTLY the two probe-did-not-run reasons", () => {
    // Both directions matter. Missing one would send a non-result to the halt
    // path (an install that stops for no reason); ADDING one would send a
    // cluster-was-heard refusal to the fallback, and the fallback founds a
    // cluster. The second is the split-brain, so the set is pinned, not
    // spot-checked.
    const arms = reasonDispatchArms();
    const fallbackArms = arms.filter((a) => a.body.includes("zeta_discovery_could_not_run"));
    expect(fallbackArms.length).toBe(1);
    expect([...(fallbackArms[0]?.patterns ?? [])].sort()).toEqual([...PROBE_DID_NOT_RUN].sort());
  });

  test("a cluster-was-heard refusal HALTS rather than founding a second cluster", () => {
    // Every reason that is not one of the two above means something answered.
    // Continuing past those to bootstrap is the split-brain this module exists
    // to prevent, so the catch-all arm must halt.
    const clusterHeard = reasons.filter((r) => !PROBE_DID_NOT_RUN.includes(r));
    expect(clusterHeard.length).toBeGreaterThan(0);
    const arms = reasonDispatchArms();
    const catchAll = arms.filter((a) => a.patterns.includes("*"));
    expect(catchAll.length).toBe(1);
    expect(catchAll[0]?.body ?? "").toContain("zeta_discovery_halt");
  });

  test("every refusal reason the decider can emit is routed by exactly one arm", () => {
    // The roster is derived from decide.ts, so a NEW RefusalReason added there
    // is covered here the moment it exists -- either it is named explicitly or
    // it lands on the catch-all, and either way it is routed. What this
    // forbids is a reason that matches an arm which does neither.
    const arms = reasonDispatchArms();
    for (const reason of reasons) {
      const matching = arms.filter((a) => a.patterns.includes(reason) || a.patterns.includes("*"));
      expect(matching.length).toBeGreaterThan(0);
      const first = matching[0];
      const routed =
        (first?.body ?? "").includes("zeta_discovery_halt") ||
        (first?.body ?? "").includes("zeta_discovery_could_not_run");
      expect(routed).toBe(true);
    }
  });

  test("an unexpected exit code is a non-result, not a silence", () => {
    // Exit 2, an unparseable line, or anything the contract does not define.
    expect(FIRST_BOOT_CODE).toMatch(/unexpected exit/);
  });

  test("a missing discover binary is a non-result, not a silence", () => {
    expect(FIRST_BOOT_CODE).toMatch(/command -v zeta-cluster-discover/);
    const arm = FIRST_BOOT_CODE.match(/command -v zeta-cluster-discover[\s\S]{0,400}/)?.[0] ?? "";
    expect(arm).toContain("zeta_discovery_could_not_run");
  });

  test("turning discovery off is reported as a check that did not run", () => {
    const arm = FIRST_BOOT_CODE.match(/ZETA_DISCOVERY\}"\s*==\s*"off"[\s\S]{0,300}/)?.[0] ?? "";
    expect(arm).toContain("zeta_discovery_could_not_run");
  });

  test("a short dwell is NOT auto-acknowledged", () => {
    // The decider refuses a silence gathered under a dwell below its floor
    // unless the policy explicitly acknowledges the shortening. Passing that
    // acknowledgement automatically whenever the dwell is lowered would delete
    // the guard while appearing to respect it.
    expect(FIRST_BOOT_CODE).toContain("ZETA_DISCOVERY_ACK_SHORT_DWELL");
    expect(FIRST_BOOT_CODE).toMatch(/ZETA_DISCOVERY_ACK_SHORT_DWELL\}"\s*==\s*"1"\s*\]\]/);
  });
});

describe("discovery finds an address; it never carries a credential", () => {
  test("token presence is passed as a boolean, never the token", () => {
    expect(FIRST_BOOT_CODE).toContain("--token-present=");
  });

  test("the token file is size-tested, never read", () => {
    // `-s` is a stat; nothing here opens the file, so no secret can reach a
    // flag, a log line, or a crash trace.
    expect(FIRST_BOOT_CODE).toMatch(/-s\s+"\$\{ZETA_JOIN_TOKEN_ESP_PATH\}"/);
    for (const forbidden of [
      'cat "${ZETA_JOIN_TOKEN_ESP_PATH}"',
      "$(<${ZETA_JOIN_TOKEN_ESP_PATH})",
      "--token=",
      "--join-token=",
    ]) {
      expect(FIRST_BOOT_CODE).not.toContain(forbidden);
    }
  });

  test("no token value is ever passed to the decider", () => {
    // The CLI's own flag roster has no token-carrying flag; assert the caller
    // does not invent one.
    const invocation = FIRST_BOOT_CODE.match(/DISCOVER_ARGS=\(([\s\S]*?)\)/)?.[1] ?? "";
    expect(invocation).toContain("--dwell-ms=");
    expect(invocation).toContain("--token-present=");
    expect(invocation.toLowerCase()).not.toContain("secret");
    expect(invocation).not.toMatch(/--token=[^-]/);
  });
});

describe("ordering: the decision happens before anything is destroyed", () => {
  test("discovery runs before zeta-install is invoked", () => {
    const discoveryAt = FIRST_BOOT.indexOf("[zeta-discovery] bootstrap-or-join check");
    const installAt = FIRST_BOOT.indexOf("[3/3] Running zeta-install");
    expect(discoveryAt).toBeGreaterThan(0);
    expect(installAt).toBeGreaterThan(0);
    expect(discoveryAt).toBeLessThan(installAt);
  });

  test("discovery runs AFTER the network wait, where a link can exist", () => {
    // At the role prompt the NIC routinely has no carrier, so a probe there
    // would fail for a reason unrelated to whether a cluster exists.
    const networkAt = FIRST_BOOT.indexOf("[1/3] Waiting up to");
    const discoveryAt = FIRST_BOOT.indexOf("[zeta-discovery] bootstrap-or-join check");
    expect(networkAt).toBeGreaterThan(0);
    expect(discoveryAt).toBeGreaterThan(networkAt);
  });

  test("the serial marker the QEMU harness pins is unchanged", () => {
    // src/Core.TypeScript/zflash/test-harness/serial-markers.ts matches this
    // string exactly; renumbering the steps would break the harness silently.
    expect(FIRST_BOOT).toContain("[3/3] Running zeta-install");
  });
});
