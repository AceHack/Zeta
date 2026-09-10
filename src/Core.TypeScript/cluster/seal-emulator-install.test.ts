/**
 * Falsifiers for the SoftHSM2 / swtpm install job.
 *
 * REFUTE:
 *   * skip-if-absent wearing pass when the cell wanted an emulator.
 *   * Inferring swtpm from /dev/tpmrm0.
 *   * A cell that wants softhsm but has no module reporting ci-softhsm.
 *   * The workflow installing nothing, or continue-on-error.
 *   * Claiming this job is YubiHSM / this-board TPM.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  main,
  REAL_FS,
  aptPackagesForCell,
  detectEmulators,
  expectedLadderForCell,
  expectedPathForCell,
  inferSwtpmFromKernelTpm,
  parseWantFlag,
  softhsmInstalled,
  swtpmInstalled,
  witnessInstall,
  type EmulatorFs,
} from "./seal-emulator-install.ts";
import { skipIfAbsentCannotWearPass } from "./unseal-path.ts";

const REPO = join(import.meta.dir, "..", "..", "..");
const WORKFLOW = join(REPO, ".github", "workflows", "seal-emulator-install.yml");

function fs(files: readonly string[], bins: readonly string[]): EmulatorFs {
  const fileSet = new Set(files);
  const binSet = new Set(bins);
  return {
    fileExists: (p) => fileSet.has(p),
    commandOnPath: (n) => binSet.has(n),
  };
}

describe("detectEmulators — disk and PATH, never /dev/tpmrm0", () => {
  test("Ubuntu amd64 module path counts as installed", () => {
    expect(softhsmInstalled(fs(["/usr/lib/x86_64-linux-gnu/softhsm/libsofthsm2.so"], []))).toBe(true);
  });

  test("softhsm2-util on PATH is enough (module path can vary)", () => {
    expect(softhsmInstalled(fs([], ["softhsm2-util"]))).toBe(true);
  });

  test("empty disk is not installed", () => {
    expect(detectEmulators(fs([], [])).softhsmInstalled).toBe(false);
    expect(detectEmulators(fs([], [])).swtpmInstalled).toBe(false);
  });

  test("swtpm binary on PATH is the emulator, not a kernel TPM", () => {
    expect(swtpmInstalled(fs([], ["swtpm"]))).toBe(true);
    expect(inferSwtpmFromKernelTpm(true)).toBe(false);
    expect(inferSwtpmFromKernelTpm(false)).toBe(false);
  });

  test("REAL_FS PATH probe finds sh and does not invent a missing binary", () => {
    expect(REAL_FS.commandOnPath("sh")).toBe(true);
    expect(REAL_FS.commandOnPath("definitely-not-a-seal-emulator-xyzzy")).toBe(false);
  });

  test("PATH probe source does not pass -- to command -v", () => {
    const src = readFileSync(join(import.meta.dir, "seal-emulator-install.ts"), "utf8");
    expect(src).not.toContain("command -v --");
  });
});

describe("witnessInstall — 2×2, fail-missing, never skip-pass", () => {
  test("skip-if-absent cannot wear pass", () => {
    expect(skipIfAbsentCannotWearPass()).toBe(false);
  });

  test("wants softhsm, module missing → fail-missing", () => {
    const r = witnessInstall({ wantSofthsm: true, wantSwtpm: false, kindUnsealerPresent: true }, fs([], []));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("fail-missing");
  });

  test("wants swtpm, binary missing → fail-missing", () => {
    const r = witnessInstall({ wantSofthsm: false, wantSwtpm: true, kindUnsealerPresent: true }, fs([], []));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("fail-missing");
  });

  test("softhsm cell with module → ci-softhsm", () => {
    const r = witnessInstall(
      { wantSofthsm: true, wantSwtpm: false, kindUnsealerPresent: true },
      fs(["/usr/lib/x86_64-linux-gnu/softhsm/libsofthsm2.so"], []),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.path).toBe("ci-softhsm");
    expect(r.mechanism).toBe("aes-gcm");
  });

  test("swtpm cell with binary → ci-swtpm OAEP", () => {
    const r = witnessInstall({ wantSofthsm: false, wantSwtpm: true, kindUnsealerPresent: true }, fs([], ["swtpm"]));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.path).toBe("ci-swtpm");
    expect(r.mechanism).toBe("must-pin-rsa-oaep");
  });

  test("both installed → ci-softhsm (one seal)", () => {
    const r = witnessInstall(
      { wantSofthsm: true, wantSwtpm: true, kindUnsealerPresent: true },
      fs(["/usr/lib64/softhsm/libsofthsm2.so"], ["swtpm", "softhsm2-util"]),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.path).toBe("ci-softhsm");
  });

  test("neither emulator, kind unsealer present → kind-shamir", () => {
    const r = witnessInstall({ wantSofthsm: false, wantSwtpm: false, kindUnsealerPresent: true }, fs([], []));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.path).toBe("kind-shamir");
  });

  test("neither emulator and no kind path is no-path, not a skip", () => {
    const r = witnessInstall({ wantSofthsm: false, wantSwtpm: false, kindUnsealerPresent: false }, fs([], []));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("no-path");
  });
});

describe("aptPackagesForCell — the job installs what the cell wants", () => {
  test("packages match the 2×2", () => {
    expect(aptPackagesForCell(false, false)).toEqual([]);
    expect(aptPackagesForCell(true, false)).toEqual(["softhsm2"]);
    expect(aptPackagesForCell(false, true)).toEqual(["swtpm"]);
    expect(aptPackagesForCell(true, true)).toEqual(["softhsm2", "swtpm"]);
  });

  test("expectedPathForCell names the cell, not leftover packages", () => {
    expect(expectedPathForCell(false, false, true)).toBe("kind-shamir");
    expect(expectedPathForCell(true, false, true)).toBe("ci-softhsm");
    expect(expectedPathForCell(false, true, true)).toBe("ci-swtpm");
    expect(expectedPathForCell(true, true, true)).toBe("ci-softhsm");
  });

  test("expectedLadderForCell names the three USB rungs independently", () => {
    expect(expectedLadderForCell(false, false, true)).toBe("sidecar");
    expect(expectedLadderForCell(true, false, true)).toBe("hsm");
    expect(expectedLadderForCell(false, true, true)).toBe("tpm");
    expect(expectedLadderForCell(true, true, true)).toBe("hsm");
    expect(expectedLadderForCell(false, false, false)).toBeUndefined();
  });

  test("parseWantFlag accepts 1/true/yes only", () => {
    expect(parseWantFlag("1")).toBe(true);
    expect(parseWantFlag("true")).toBe(true);
    expect(parseWantFlag("0")).toBe(false);
    expect(parseWantFlag("")).toBe(false);
  });
});

describe("main — CLI the job actually runs", () => {
  test("softhsm cell with module exits 0", () => {
    expect(
      main(["--want-softhsm=1", "--want-swtpm=0", "--kind-unsealer=1"], fs(["/usr/lib/softhsm/libsofthsm2.so"], [])),
    ).toBe(0);
  });

  test("missing emulator the cell asked for exits 1", () => {
    expect(main(["--want-softhsm=1", "--want-swtpm=0", "--kind-unsealer=1"], fs([], []))).toBe(1);
  });

  test("neither emulator with kind unsealer exits 0", () => {
    expect(main(["--want-softhsm=0", "--want-swtpm=0", "--kind-unsealer=1"], fs([], []))).toBe(0);
  });

  test("expect-path refuses a leftover emulator wearing the wrong cell", () => {
    expect(
      main(
        ["--want-softhsm=0", "--want-swtpm=1", "--kind-unsealer=1", "--expect-path=ci-swtpm"],
        fs(["/usr/lib/x86_64-linux-gnu/softhsm/libsofthsm2.so"], ["swtpm"]),
      ),
    ).toBe(1);
  });

  test("expect-path accepts the named cell", () => {
    expect(
      main(["--want-softhsm=0", "--want-swtpm=1", "--kind-unsealer=1", "--expect-path=ci-swtpm"], fs([], ["swtpm"])),
    ).toBe(0);
  });

  test("expect-ladder accepts the three independent rungs", () => {
    expect(
      main(
        ["--want-softhsm=1", "--want-swtpm=0", "--kind-unsealer=1", "--expect-path=ci-softhsm", "--expect-ladder=hsm"],
        fs(["/usr/lib/softhsm/libsofthsm2.so"], []),
      ),
    ).toBe(0);
    expect(
      main(
        ["--want-softhsm=0", "--want-swtpm=1", "--kind-unsealer=1", "--expect-path=ci-swtpm", "--expect-ladder=tpm"],
        fs([], ["swtpm"]),
      ),
    ).toBe(0);
    expect(
      main(
        ["--want-softhsm=0", "--want-swtpm=0", "--kind-unsealer=1", "--expect-path=kind-shamir", "--expect-ladder=sidecar"],
        fs([], []),
      ),
    ).toBe(0);
  });

  test("expect-ladder refuses a leftover emulator wearing the wrong rung", () => {
    expect(
      main(
        ["--want-softhsm=0", "--want-swtpm=1", "--kind-unsealer=1", "--expect-ladder=tpm"],
        fs(["/usr/lib/x86_64-linux-gnu/softhsm/libsofthsm2.so"], ["swtpm"]),
      ),
    ).toBe(1);
    expect(
      main(["--want-softhsm=0", "--want-swtpm=0", "--kind-unsealer=1", "--expect-ladder=hsm"], fs([], [])),
    ).toBe(1);
  });
});

describe("workflow — installs, never skip-pass, never continue-on-error", () => {
  const yml = readFileSync(WORKFLOW, "utf8");
  const executable = yml
    .split("\n")
    .filter((line) => {
      const t = line.trimStart();
      return t.length > 0 && !t.startsWith("#");
    })
    .join("\n");

  test("four named cells: hsm simulator, tpm simulator, sidecar, and HSM-wins", () => {
    expect(yml).toContain("sidecar");
    expect(yml).toContain("hsm-simulator");
    expect(yml).toContain("tpm-simulator");
    expect(yml).toContain("both-softhsm-wins");
    expect(yml).not.toContain("neither-kind-shamir");
    expect(yml).not.toContain("softhsm-only");
    expect(yml).not.toContain("swtpm-only");
    expect(yml).toContain("expect: kind-shamir");
    expect(yml).toContain("expect: ci-softhsm");
    expect(yml).toContain("expect: ci-swtpm");
    expect(yml).toContain("expect_ladder: sidecar");
    expect(yml).toContain("expect_ladder: hsm");
    expect(yml).toContain("expect_ladder: tpm");
    expect(yml).toContain("--expect-path=");
    expect(yml).toContain("--expect-ladder=");
  });

  test("apt installs softhsm2 and swtpm when the cell asks", () => {
    expect(yml).toContain("softhsm2");
    expect(yml).toContain("swtpm");
    expect(yml).toContain("apt-get install");
  });

  test("witness runs after install; skip-if-absent and continue-on-error are absent", () => {
    expect(yml).toContain("seal-emulator-install.ts");
    expect(executable).not.toMatch(/continue-on-error\s*:/);
    expect(executable).not.toContain("|| true");
    expect(executable).not.toContain("skip-if-absent");
    expect(executable).not.toContain("if: false");
  });

  test("does not edit the OpenBao Application or add a seal stanza", () => {
    expect(yml).not.toContain("valuesObject");
    expect(yml).not.toMatch(/seal\s+"pkcs11"/);
  });

  test("permissions are contents:read; actions are SHA-pinned", () => {
    expect(yml).toMatch(/permissions:\s*\n\s+contents:\s+read/);
    expect(yml).toMatch(/actions\/checkout@[0-9a-f]{40}/);
    expect(yml).toMatch(/oven-sh\/setup-bun@[0-9a-f]{40}/);
  });

  test("falsifiers job runs bun test; token init is not skip-if-the-package-is-missing", () => {
    expect(yml).toContain("bun test");
    expect(yml).toContain("seal-emulator-install.test.ts");
    expect(yml).toMatch(/if:\s*matrix\.softhsm\s*==\s*'1'/);
    expect(yml).toContain("apt-get install");
  });
});
