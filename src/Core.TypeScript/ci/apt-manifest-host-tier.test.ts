import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "bun:test";
import { parse as parseYaml } from "yaml";

// 081M0K36K69087G0R003BYSCF8 — manifests/apt is tier-gated, like manifests/brew already was.
//
// These tests call the REAL filter (`zeta_filter_manifest_by_tier` in
// tools/setup/common/host-tier.sh, the same function tools/setup/linux.sh calls) through a
// real bash. Nothing here reimplements the parse — a second copy of the logic would agree
// with itself no matter what the installer does, which is the vacuity class this repo refuses.

const ROOT = join(import.meta.dir, "../../..");
const HOST_TIER_SH = join(ROOT, "tools/setup/common/host-tier.sh");
const APT_MANIFEST = join(ROOT, "tools/setup/manifests/apt");
const BREW_MANIFEST = join(ROOT, "tools/setup/manifests/brew");
const LINUX_SH = join(ROOT, "tools/setup/linux.sh");
const LOW_MEMORY_WORKFLOW = join(ROOT, ".github/workflows/low-memory.yml");
const GATE_WORKFLOW = join(ROOT, ".github/workflows/gate.yml");

/**
 * The gate.yml jobs whose whole body is a mise-provided tool (bun, shellcheck, semgrep, a
 * language linter) and which therefore must declare `ZETA_HOST_TIER: slim` on their
 * installer step. Without the declaration the runner auto-detects `full` and each of these
 * lanes fetches 713 MiB of apt — 237 MB of it the `agda` row's transitive `ghc` +
 * 63 `libghc-*-dev` — which is what stalled the archive mirror and burned the whole 420s
 * apt budget on 2026-08-25 (job 97707217922, `lint (no conflict markers)`).
 *
 * Three installer jobs are deliberately ABSENT: build-and-test (whole F# suite),
 * test-typescript-environment (zflash esp-inject) and full-verify (smoke-7-toolchains needs
 * emscripten). They genuinely reach past slim, and pretending otherwise would trade a slow
 * lane for a broken one. They are also where the remaining GHC exposure lives, stated here
 * rather than left to be rediscovered: src/Core.TypeScript/cluster/runner-disk.ts:130 already
 * reclaims `/opt/ghc` because "this tree has no Haskell source and no lane invokes `ghc`,
 * `cabal` or `stack`" — the repo deletes the compiler from its runners and the apt manifest
 * puts it back. Closing that needs evidence about what those three lanes actually reach for,
 * which is a separate measurement, not a guess to make here.
 */
const SLIM_GATE_JOBS = [
  "lint", //                        semgrep, via the `pipx:semgrep` mise pin
  "lint-semgrep-drift",
  "lint-shell", //                  shellcheck, mise pin 0.11.0
  "lint-no-conflict-markers",
  "lint-archive-header-section33",
  "lint-section-33-migration-xrefs",
  "lint-tick-shard-relative-paths",
  "lint-fsharp",
  "lint-csharp",
  "lint-go",
  "lint-python",
  "lint-rust",
] as const;

/** Run the installer's own filter at a declared tier. Returns stdout packages + stderr skips. */
function filterAt(tier: string, manifest = APT_MANIFEST): { packages: string[]; skips: string } {
  const res = spawnSync(
    "bash",
    ["-c", `set -euo pipefail; . "$1"; zeta_filter_manifest_by_tier "$2"`, "_", HOST_TIER_SH, manifest],
    { env: { ...process.env, ZETA_HOST_TIER: tier }, encoding: "utf8" },
  );
  if (res.status !== 0) throw new Error(`filter failed at tier=${tier}: ${res.stderr}`);
  return {
    packages: res.stdout.split("\n").map((l) => l.trim()).filter((l) => l.length > 0),
    skips: res.stderr,
  };
}

/** Every package name in the manifest, tier token and comments removed. */
function everyRow(manifest: string): string[] {
  return readFileSync(manifest, "utf8")
    .split(/\r?\n/)
    .map((l) => (l.split("#")[0] ?? "").trim())
    .filter((l) => l.length > 0)
    .map((l) => l.split(/\s+/).filter((t) => !t.startsWith("tier="))[0] ?? "")
    .filter((t) => t.length > 0);
}

describe("manifests/apt host-tier gate", () => {
  it("drops the measured-expensive rows on a slim host", () => {
    // Measured on ubuntu:24.04 amd64, universe enabled, --no-install-recommends (2026-08-21):
    // these rows carry +242 (agda), +150 (emscripten), +57 (r-base), +53 (llvm), +26 (pandoc)
    // and +21 (podman) MiB of download between them.
    const slim = new Set(filterAt("slim").packages);
    for (const heavy of [
      "agda",
      "emscripten",
      "llvm",
      "r-base",
      "pandoc",
      "podman",
      "qemu-system-x86",
      "qemu-utils",
      "mtools",
      "opam",
      "uidmap",
      "slirp4netns",
      "fuse-overlayfs",
    ]) {
      expect(slim.has(heavy)).toBe(false);
    }
  });

  it("KEEPS everything the low-memory lane needs to run dotnet", () => {
    // The counterweight to the test above, and the more important one: the fix is supposed to
    // make the lane cheaper, never to make it stop testing. Tag any of these tier=standard and
    // the slim runner has no compiler, no CA bundle, or a dotnet that exits with no status
    // (the classic missing-libicu failure) — a cheap lane that proves nothing.
    const slim = new Set(filterAt("slim").packages);
    for (const required of [
      "build-essential",
      "curl",
      "ca-certificates",
      "git",
      "libicu74", //  ICU — .NET globalization
      "libssl3t64", //  OpenSSL 3 runtime
      "libgssapi-krb5-2", //  Kerberos/GSSAPI — .NET networking
      "tzdata", //  .NET DateTime
    ]) {
      expect(slim.has(required)).toBe(true);
    }
  });

  it("installs every row at tier=full — the gate subtracts, it never adds", () => {
    expect(filterAt("full").packages).toEqual(everyRow(APT_MANIFEST));
  });

  it("orders the tiers: slim ⊂ standard ⊂ full", () => {
    const slim = filterAt("slim").packages;
    const standard = filterAt("standard").packages;
    const full = filterAt("full").packages;
    expect(standard).toEqual(expect.arrayContaining(slim));
    expect(full).toEqual(expect.arrayContaining(standard));
    expect(full.length).toBeGreaterThan(slim.length);
  });

  it("never leaks a tier= token to apt-get", () => {
    // The manifest's own note used to say a tier= suffix "would be read as a version-pin".
    // That is what this asserts can no longer happen.
    for (const tier of ["slim", "standard", "full"]) {
      for (const pkg of filterAt(tier).packages) {
        expect(pkg).not.toContain("=");
        expect(pkg.split(/\s+/).length).toBe(1);
      }
    }
  });

  it("names every skipped package and both tiers on stderr", () => {
    // A package that silently vanished from an install would be the absent-check failure:
    // the log has to say what was dropped and why, or nobody can tell a tier gate from a bug.
    const { skips } = filterAt("slim");
    expect(skips).toContain("agda skipped: requires tier=standard, host is slim");
    expect(skips).toContain("emscripten skipped: requires tier=standard, host is slim");
  });

  it("actually drops rows — negative control on a fixture", () => {
    // Guards the degenerate pass: a filter that returned its input unchanged would satisfy
    // every "keeps X" assertion above.
    const dir = mkdtempSync(join(tmpdir(), "zeta-apt-tier-"));
    try {
      const fixture = join(dir, "apt");
      writeFileSync(fixture, "always\nsometimes tier=standard\nrarely tier=full  # comment\n");
      expect(filterAt("slim", fixture).packages).toEqual(["always"]);
      expect(filterAt("standard", fixture).packages).toEqual(["always", "sometimes"]);
      expect(filterAt("full", fixture).packages).toEqual(["always", "sometimes", "rarely"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("the gate is wired to the things that depend on it", () => {
  it("linux.sh routes manifests/apt through the tier filter", () => {
    const src = readFileSync(LINUX_SH, "utf8");
    expect(src).toContain('source "$SETUP_DIR/common/host-tier.sh"');
    expect(src).toContain('zeta_filter_manifest_by_tier "$APT_MANIFEST"');
  });

  it("the low-memory lane still declares ZETA_HOST_TIER: slim", () => {
    // Without this line the lane silently reverts to the full 713 MiB apt phase and the
    // budget defect comes back with nothing red to show for it.
    expect(readFileSync(LOW_MEMORY_WORKFLOW, "utf8")).toMatch(/ZETA_HOST_TIER:\s*slim/);
  });

  describe("gate.yml lint lanes declare the tier they actually need", () => {
    interface WorkflowStep {
      readonly run?: unknown;
      readonly env?: Record<string, unknown>;
    }
    interface WorkflowJob {
      readonly steps?: readonly WorkflowStep[];
      readonly env?: Record<string, unknown>;
    }

    /**
     * Every gate.yml job that runs the installer, with the tier its installer step declares
     * (`null` when it declares none and the runner therefore auto-detects — 16 GB of runner
     * memory resolves to `full`, which is how twelve lint lanes came to install a Haskell
     * compiler). Read from the YAML the runner reads; nothing here restates the roster.
     */
    const installerJobs = (): Map<string, string | null> => {
      const wf = parseYaml(readFileSync(GATE_WORKFLOW, "utf8")) as { jobs: Record<string, WorkflowJob> };
      const out = new Map<string, string | null>();
      for (const [id, job] of Object.entries(wf.jobs)) {
        const step = (job.steps ?? []).find(
          (s) => typeof s.run === "string" && /tools\/setup\/(install|linux)\.sh/.test(s.run),
        );
        if (!step) continue;
        const declared = step.env?.ZETA_HOST_TIER ?? job.env?.ZETA_HOST_TIER;
        out.set(id, declared === undefined || declared === null ? null : String(declared));
      }
      return out;
    };

    it("every job on the slim roster still declares it", () => {
      // Delete a declaration and the lane silently reverts to the 713 MiB apt phase that
      // stalled nine checks across seven PRs on 2026-08-25 — with nothing red to say why.
      // That is the exact failure shape this repo refuses: a check that did not run reading
      // as one that passed, moved one layer down into what the check had to download first.
      const jobs = installerJobs();
      for (const id of SLIM_GATE_JOBS) {
        expect(jobs.has(id)).toBe(true); // the roster may not name a job that stopped installing
        expect(jobs.get(id)).toBe("slim");
      }
    });

    it("the roster is not vacuous — some installer job is NOT on it", () => {
      // Negative control. A roster that had quietly grown to cover every installer job would
      // satisfy the test above and would ALSO mean someone had put the F# suite, the zflash
      // esp-inject tests and smoke-7-toolchains on a host with no emscripten and no mtools.
      // "Everything is slim" must not be able to pass silently.
      const jobs = installerJobs();
      const roster = new Set<string>(SLIM_GATE_JOBS);
      const offRoster = [...jobs.keys()].filter((id) => !roster.has(id));
      expect(offRoster.length).toBeGreaterThan(0);
      for (const id of offRoster) expect(jobs.get(id)).not.toBe("slim");
    });
  });

  it("apt and brew agree on which tools are tier=standard", () => {
    // brew has gated these since 081KTWQZY7F; apt now mirrors it. Drift between the two is
    // how a macOS slim host and a Linux slim host quietly stop being the same host tier.
    const tieredIn = (manifest: string): Set<string> =>
      new Set(
        readFileSync(manifest, "utf8")
          .split(/\r?\n/)
          .map((l) => (l.split("#")[0] ?? "").trim())
          .filter((l) => /\btier=standard\b/.test(l))
          .map((l) => l.split(/\s+/)[0] ?? ""),
      );
    // brew name -> apt name(s). `null` = deliberately absent from manifests/apt, with the
    // reason recorded in the manifest itself.
    const APT_NAMES: Record<string, string[] | null> = {
      qemu: ["qemu-system-x86", "qemu-utils"],
      opam: ["opam"],
      podman: ["podman"],
      r: ["r-base"],
      agda: ["agda"],
      emscripten: ["emscripten"],
      llvm: ["llvm"],
      pandoc: ["pandoc"],
      tectonic: null, // not packaged in Ubuntu apt — see the NOTE in manifests/apt
    };
    const brewStandard = tieredIn(BREW_MANIFEST);
    const aptStandard = tieredIn(APT_MANIFEST);

    // Every brew tier=standard tool has a disposition, and no disposition is stale.
    expect([...brewStandard].filter((t) => !(t in APT_NAMES))).toEqual([]);
    expect(Object.keys(APT_NAMES).filter((t) => !brewStandard.has(t))).toEqual([]);

    const unmirrored = [...brewStandard]
      .flatMap((t) => APT_NAMES[t] ?? [])
      .filter((aptName) => !aptStandard.has(aptName));
    expect(unmirrored).toEqual([]);
  });
});
