// audit-mise-lock-coverage.test.ts — the refusals, which are the half that matters.
//
// A coverage audit that has only ever been shown to PASS is the vacuity class: it cannot
// tell a working check from an absent one. Every case here mutates the audit's subject and
// asserts the audit CONVICTS, and the mutations are the four drifts that were measured to
// be possible on 2026-09-10 rather than four invented ones:
//
//   1. `locked = true` deleted from `.mise.toml`      -> the lockfile silently self-heals
//   2. a config pin bumped without a re-lock          -> the committed digest describes the old artifact
//   3. a platform row dropped from the lockfile       -> invisible in 600 lines of generated TOML
//   4. an UNLOCKABLE_BACKENDS entry gone stale        -> the exemption roster grows without a diff
//
// Plus the parser cases, because a parser that silently skips a declaration form reports
// FULL coverage for a tool it never looked at — the same defect wearing a green tick.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  checkLockedModeSafety,
  checkPair,
  checkProvenanceMatchesInstallSettings,
  classifyRelock,
  INSTALL_PS1_PATH,
  LINUX_SH_PATH,
  MACOS_SH_PATH,
  MISE_SH_PATH,
  PAIRS,
  parseConfigTools,
  parseLock,
  provenanceKeys,
  REQUIRED_PLATFORMS,
  UNLOCKABLE_BACKENDS,
  versionSatisfies,
  withoutProvenance,
} from "./audit-mise-lock-coverage.ts";

const ROOT = join(import.meta.dir, "..", "..", "..");

/** Indexed once, so `noUncheckedIndexedAccess` does not spread `?? ` through every case. */
const BASE_PAIR = PAIRS[0] as { readonly config: string; readonly lock: string };
const FULL_PAIR = PAIRS[1] as { readonly config: string; readonly lock: string };
const read = (p: string): string => readFileSync(join(ROOT, p), "utf8");

const failures = (fs: readonly { ok: boolean; message: string }[]): string[] =>
  fs.filter((f) => !f.ok).map((f) => f.message);

/** A minimal but REAL-SHAPED pair: one lockable tool, one roster tool, one fuzzy pin. */
const CONFIG = `min_version = "2026.6.12"

[tools]
zig = "0.13.0"
node = "24"
rust = { version = "1.99.0-beta.3", components = ["rustfmt"] }

[settings]
locked = true
python.compile = false
`;

const platformBlock = (tool: string, plat: string, digest: string): string =>
  `[tools.${tool}."platforms.${plat}"]\nchecksum = "sha256:${digest}"\nurl = "https://example.invalid/${tool}-${plat}"\n`;

const lockFor = (tool: string, version: string, platforms: readonly string[]): string =>
  `[[tools.${tool}]]\nversion = "${version}"\nbackend = "core:${tool}"\n\n` +
  platforms.map((p, i) => platformBlock(tool, p, String(i).repeat(64))).join("\n");

const LOCK =
  "# @generated\n\nlockfile_version = 1\n\n" +
  lockFor("zig", "0.13.0", REQUIRED_PLATFORMS) +
  "\n" +
  lockFor("node", "24.16.0", REQUIRED_PLATFORMS) +
  '\n[[tools.rust]]\nversion = "1.99.0-beta.3"\nbackend = "core:rust"\n\n[tools.rust.options]\ncomponents = "rustfmt"\n';

describe("the audit passes on a correct pair (the control)", () => {
  test("no findings against the synthetic tree", () => {
    // Scoped to the full-tier label so the base-tier roster-completeness rule (which
    // demands every UNLOCKABLE_BACKENDS name be declared) does not apply to this fixture.
    expect(failures(checkPair(FULL_PAIR.config, CONFIG, LOCK))).toEqual([]);
  });

  test("and on the REAL tree — a fixture-only suite would survive a rename", () => {
    const findings = [
      ...checkLockedModeSafety(read(".mise.toml"), read(LINUX_SH_PATH), read(MACOS_SH_PATH), read(INSTALL_PS1_PATH)),
    ];
    for (const p of PAIRS) findings.push(...checkPair(p.config, read(p.config), read(p.lock)));
    expect(failures(findings)).toEqual([]);
  });
});

describe("1. locked mode is permitted only when every installer pins ONE mise version", () => {
  const PINNED = 'MISE_PIN_VERSION="2026.6.12"\n';
  const PS1_PINNED = "$MisePinVersion = '2026.6.12' # keep in sync\n";
  const MACOS_FLOOR_ONLY = 'MISE_MIN_VERSION="2026.6.12"\n';
  const LOCKED = "[settings]\nlocked = true\n";
  const UNLOCKED = "[settings]\npython.compile = false\n";

  test("CONVICTS on `locked = true` while macOS only declares a floor — the state measured unsafe", () => {
    const f = checkLockedModeSafety(LOCKED, PINNED, MACOS_FLOOR_ONLY, PS1_PINNED);
    expect(failures(f)).toHaveLength(1);
    expect(failures(f)[0]).toContain("do NOT all pin the same");
    expect(failures(f)[0]).toContain("no exact pin");
  });

  test("passes with locked mode OFF under that same divergence — the shipped state", () => {
    expect(failures(checkLockedModeSafety(UNLOCKED, PINNED, MACOS_FLOOR_ONLY, PS1_PINNED))).toEqual([]);
  });

  test("REQUIRES locked mode once all three pins agree — so the exemption cannot become permanent", () => {
    const f = checkLockedModeSafety(UNLOCKED, PINNED, PINNED, PS1_PINNED);
    expect(failures(f)).toHaveLength(1);
    expect(failures(f)[0]).toContain("Re-lock on that version");
  });

  test("and is satisfied once both halves move together", () => {
    expect(failures(checkLockedModeSafety(LOCKED, PINNED, PINNED, PS1_PINNED))).toEqual([]);
  });

  test("pins that DISAGREE are a divergence too, not only a missing one", () => {
    const other = 'MISE_PIN_VERSION="2026.8.14"\n';
    expect(failures(checkLockedModeSafety(LOCKED, PINNED, other, PS1_PINNED))).toHaveLength(1);
  });

  test("a `locked = true` in a COMMENT is not a declaration", () => {
    const commented = "[settings]\n# locked = true\n";
    // Reads as OFF, so under the divergence it must PASS rather than convict.
    expect(failures(checkLockedModeSafety(commented, PINNED, MACOS_FLOOR_ONLY, PS1_PINNED))).toEqual([]);
  });

  test("the REAL installers still diverge, and the REAL .mise.toml therefore has locked mode off", () => {
    expect(read(".mise.toml")).not.toContain("\nlocked = true");
    expect(
      failures(
        checkLockedModeSafety(read(".mise.toml"), read(LINUX_SH_PATH), read(MACOS_SH_PATH), read(INSTALL_PS1_PATH)),
      ),
    ).toEqual([]);
  });
});

describe("2. a pin bumped without a re-lock", () => {
  test("convicts, and the message names both versions", () => {
    const bumped = CONFIG.replace('zig = "0.13.0"', 'zig = "0.14.0"');
    const msgs = failures(checkPair(FULL_PAIR.config, bumped, LOCK));
    expect(msgs).toHaveLength(1);
    const only = msgs[0] ?? "";
    expect(only).toContain("zig");
    expect(only).toContain('"0.14.0"');
    expect(only).toContain('"0.13.0"');
  });

  test("a tool declared but wholly absent from the lockfile convicts", () => {
    const extra = CONFIG.replace('zig = "0.13.0"', 'zig = "0.13.0"\nshellcheck = "0.11.0"');
    expect(failures(checkPair(FULL_PAIR.config, extra, LOCK)).join(" ")).toContain("shellcheck");
  });

  test("a FUZZY pin is satisfied by the version mise resolved it to", () => {
    expect(versionSatisfies("24", "24.16.0")).toBe(true);
    expect(versionSatisfies("1.3", "1.3.14")).toBe(true);
    expect(versionSatisfies("0.13.0", "0.13.0")).toBe(true);
  });

  test("and NOT by one that merely shares a prefix — the dot boundary is the check", () => {
    expect(versionSatisfies("24", "240.1.0")).toBe(false);
    expect(versionSatisfies("1.3", "1.30.0")).toBe(false);
  });
});

describe("3. a platform silently losing its digest", () => {
  for (const plat of REQUIRED_PLATFORMS) {
    test(`dropping the ${plat} row convicts`, () => {
      const stripped = LOCK.split("\n\n")
        .filter((p) => !p.includes(`tools.zig."platforms.${plat}"`))
        .join("\n\n");
      const msgs = failures(checkPair(FULL_PAIR.config, CONFIG, stripped));
      expect(msgs.join(" ")).toContain(plat);
    });
  }

  test("a platform row present but with NO checksum convicts — a URL is not a digest", () => {
    const noDigest = LOCK.replace(/checksum = "sha256:0{64}"\n/, "");
    expect(failures(checkPair(FULL_PAIR.config, CONFIG, noDigest)).join(" ")).toContain("NO committed digest");
  });
});

describe("4. the exemption roster can shrink, never grow", () => {
  test("a roster tool that has BECOME lockable convicts, so the exemption cannot outlive its reason", () => {
    const nowLocked = `${LOCK}\n${lockFor("rust", "1.99.0-beta.3", REQUIRED_PLATFORMS)}`;
    const msgs = failures(checkPair(FULL_PAIR.config, CONFIG, nowLocked));
    expect(msgs.join(" ")).toContain("the exemption is stale");
  });

  test("a roster entry naming a tool nothing declares convicts on the base pair", () => {
    // Every UNLOCKABLE_BACKENDS name must still be declared in `.mise.toml`; drop one and
    // the base-tier pair must notice. Uses the real config with one line removed.
    const name = Object.keys(UNLOCKABLE_BACKENDS)[0] ?? "";
    const withoutIt = read(".mise.toml")
      .split("\n")
      .filter((l) => !new RegExp(`^"?${name}"?\\s*=`).test(l.trim()))
      .join("\n");
    const msgs = failures(checkPair(BASE_PAIR.config, withoutIt, read("mise.lock")));
    expect(msgs.join(" ")).toContain("stale roster entry");
  });
});

describe("the parsers see what mise actually writes", () => {
  test("both config declaration forms — a skipped inline table would report false coverage", () => {
    const tools = parseConfigTools(CONFIG);
    expect(tools["zig"]).toBe("0.13.0");
    expect(tools["rust"]).toBe("1.99.0-beta.3");
  });

  test("quoted, colon-bearing backend names round-trip", () => {
    const tools = parseConfigTools('[tools]\n"pipx:ruff" = "0.16.5"\n"github:yannh/kubeconform" = "0.7.0"\n');
    expect(tools["pipx:ruff"]).toBe("0.16.5");
    expect(tools["github:yannh/kubeconform"]).toBe("0.7.0");
  });

  test("`[tools.<x>.options]` is not mistaken for a platform row", () => {
    const rust = parseLock(LOCK)["rust"];
    expect(rust).toBeDefined();
    expect(rust?.versions).toEqual(["1.99.0-beta.3"]);
    expect(Object.keys(rust?.platforms ?? {})).toEqual([]);
  });

  test("the REAL lockfile parses to the tools the REAL config declares", () => {
    const declared = Object.keys(parseConfigTools(read(".mise.toml")));
    const locked = parseLock(read("mise.lock"));
    expect(declared.length).toBeGreaterThan(10);
    for (const name of declared) expect(locked[name]).toBeDefined();
  });

  test("a config with an empty [tools] table convicts rather than reporting success", () => {
    expect(failures(checkPair("fixture", "[tools]\n[settings]\n", LOCK)).join(" ")).toContain("ZERO tools");
  });
});

describe("5. the re-lock comparison separates what we own from what a third party attests", () => {
  const withProv = `[[tools.zig]]
version = "0.13.0"

[tools.zig."platforms.linux-x64"]
checksum = "sha256:${"a".repeat(64)}"
url = "https://example.invalid/zig"
provenance = "github-attestations"
`;
  const withoutProv = withProv.replace('provenance = "github-attestations"\n', "");

  test("a provenance row LOST by a re-lock is `unknown`, not drift — the attestation service was down", () => {
    const v = classifyRelock(withProv, withoutProv);
    expect(v.drift).toEqual([]);
    expect(v.provenanceLost).toEqual(["zig/linux-x64"]);
    expect(v.provenanceGained).toEqual([]);
  });

  test("a provenance row GAINED is reported, not drift", () => {
    const v = classifyRelock(withoutProv, withProv);
    expect(v.drift).toEqual([]);
    expect(v.provenanceGained).toEqual(["zig/linux-x64"]);
  });

  test("a CHECKSUM that moved IS drift — the one thing this must never wave through", () => {
    const tampered = withProv.replace("a".repeat(64), "b".repeat(64));
    const v = classifyRelock(withProv, tampered);
    expect(v.drift.length).toBeGreaterThan(0);
    expect(v.drift[0]).toContain("checksum");
  });

  test("a URL that moved IS drift", () => {
    const moved = withProv.replace("https://example.invalid/zig", "https://elsewhere.invalid/zig");
    expect(classifyRelock(withProv, moved).drift.length).toBeGreaterThan(0);
  });

  test("a VERSION that moved IS drift", () => {
    const moved = withProv.replace('version = "0.13.0"', 'version = "0.14.0"');
    expect(classifyRelock(withProv, moved).drift.length).toBeGreaterThan(0);
  });

  test("identical input is identical output — the control", () => {
    const v = classifyRelock(withProv, withProv);
    expect(v.drift).toEqual([]);
    expect(v.provenanceLost).toEqual([]);
    expect(v.provenanceGained).toEqual([]);
  });

  test("`withoutProvenance` removes provenance and nothing else", () => {
    expect(withoutProvenance(withProv)).toBe(withoutProv);
    expect(withoutProvenance(withProv)).toContain("checksum = ");
    expect(withoutProvenance(withProv)).toContain("url = ");
  });

  test("the REAL lockfile carries provenance, so the attestation is already relocated to lock time", () => {
    // A zero here would mean every install still makes the live attestation call — the exact
    // coupling that took both ARM lanes down. This is the assertion that would notice.
    expect(provenanceKeys(read("mise.lock")).size).toBeGreaterThan(0);
  });
});

describe("6. a provenance row and the install-time setting that governs it must agree", () => {
  // The exact export line tools/setup/common/mise.sh carries.
  const MISE_SH_DISABLED = 'export MISE_PYTHON_GITHUB_ATTESTATIONS="${MISE_PYTHON_GITHUB_ATTESTATIONS:-0}"\n';
  const lockWithPythonProvenance = `[[tools.python]]
version = "3.14.6"

[tools.python."platforms.linux-x64"]
checksum = "sha256:${"c".repeat(64)}"
url = "https://example.invalid/cpython"
provenance = "github-attestations"
`;

  test("CONVICTS on the state that took every container lane down on 2026-09-10", () => {
    const f = checkProvenanceMatchesInstallSettings(MISE_SH_DISABLED, lockWithPythonProvenance);
    expect(failures(f)).toHaveLength(1);
    expect(failures(f)[0]).toContain("downgrade attack");
    expect(failures(f)[0]).toContain("python/linux-x64");
  });

  test("passes when the lockfile does not attest what the installer disables", () => {
    const noProv = lockWithPythonProvenance.replace('provenance = "github-attestations"\n', "");
    expect(failures(checkProvenanceMatchesInstallSettings(MISE_SH_DISABLED, noProv))).toEqual([]);
  });

  test("passes when the installer stops disabling it — the coupling is read, not assumed", () => {
    expect(failures(checkProvenanceMatchesInstallSettings("# nothing here\n", lockWithPythonProvenance))).toEqual([]);
  });

  test("a NON-python provenance row is untouched — the global setting still permits those", () => {
    const uv = lockWithPythonProvenance.replace(/python/g, "uv");
    expect(failures(checkProvenanceMatchesInstallSettings(MISE_SH_DISABLED, uv))).toEqual([]);
  });

  test("the REAL mise.sh and the REAL lockfile agree", () => {
    expect(failures(checkProvenanceMatchesInstallSettings(read(MISE_SH_PATH), read("mise.lock")))).toEqual([]);
  });
});
