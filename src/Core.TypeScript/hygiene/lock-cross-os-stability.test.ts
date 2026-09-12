// lock-cross-os-stability.test.ts — the falsifiers for the cross-platform lock comparison.
//
// The failure this file is weighted against is a comparison that cannot fail. A lane whose
// classifier answers "declared" to everything would report a green cross-OS measurement for
// a tree that resolves differently on every runner, and the whole point of the lane is that
// the answer is trusted enough to widen `--locked-mode` on. So the cases below are mostly
// about the DECLARED path refusing to absorb things it should not:
//
//   * a perturbed lock (the control) must come out `differs-unexplained`
//   * a RID-shaped difference in a project that declares no RID must NOT be declared
//   * a declared project with a NON-RID-shaped difference must NOT be declared
//   * a commented-out RuntimeIdentifier must not count as declaring one
//   * a lock missing on one platform must not be silently skipped

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  canonicalise,
  classifyProject,
  compareManifests,
  declaredPerOsSignals,
  differingEntryKeys,
  isRidShapedPackage,
  type LockManifest,
  type PerOsSignals,
} from "./lock-cross-os-stability.ts";

const NO_SIGNALS: PerOsSignals = { runtimeIdentifiers: [], osSuffixedTfms: [] };
const RID_SIGNALS: PerOsSignals = { runtimeIdentifiers: ["win-x64", "linux-x64"], osSuffixedTfms: [] };

/** A minimal but realistically-shaped lock. */
const lock = (entries: Record<string, { resolved: string; contentHash: string }>): string =>
  JSON.stringify(
    {
      version: 2,
      dependencies: {
        "net10.0": Object.fromEntries(
          Object.entries(entries).map(([name, body]) => [
            name,
            { type: "Direct", requested: `[${body.resolved}, )`, ...body },
          ]),
        ),
      },
    },
    null,
    2,
  );

const BASE = lock({
  "Apache.Arrow": { resolved: "23.0.0", contentHash: "cU4Zm7byFwnb82Ea9ZRvVnq2nJNf==" },
  "FSharp.Core": { resolved: "9.0.300", contentHash: "KzsZeI3sMK36DloK3nKdHGb8RBe==" },
});

const PLATFORMS = ["macos-26", "ubuntu-24.04", "ubuntu-24.04-arm", "windows-11-arm", "windows-2025"];

const everywhere = (text: string): Map<string, string> =>
  new Map(PLATFORMS.map((p) => [p, text]));

describe("the control — a perturbed lock must be caught", () => {
  test("one platform resolving a different contentHash is differs-unexplained", () => {
    // THE CONTROL. Identical to BASE except that windows-2025 got a different sha512 for
    // one package — exactly the shape of the supply-chain event `--locked-mode` exists to
    // catch, and exactly the shape of a genuine per-OS resolution difference. If this
    // comes back anything but `differs-unexplained`, the lane is decorative.
    const perturbed = lock({
      "Apache.Arrow": { resolved: "23.0.0", contentHash: "PERTURBEDHASHPERTURBEDHASH==" },
      "FSharp.Core": { resolved: "9.0.300", contentHash: "KzsZeI3sMK36DloK3nKdHGb8RBe==" },
    });
    const byPlatform = everywhere(BASE);
    byPlatform.set("windows-2025", perturbed);

    const finding = classifyProject("src/Core/packages.lock.json", byPlatform, BASE, PLATFORMS, NO_SIGNALS);

    expect(finding.verdict).toBe("differs-unexplained");
    expect(finding.differingEntries).toEqual(["net10.0/Apache.Arrow"]);
    expect(finding.groups).toHaveLength(2);
    expect(finding.groups).toContainEqual(["windows-2025"]);
  });

  test("a differing RESOLVED VERSION is also caught", () => {
    const bumped = lock({
      "Apache.Arrow": { resolved: "23.0.1", contentHash: "cU4Zm7byFwnb82Ea9ZRvVnq2nJNf==" },
      "FSharp.Core": { resolved: "9.0.300", contentHash: "KzsZeI3sMK36DloK3nKdHGb8RBe==" },
    });
    const byPlatform = everywhere(BASE);
    byPlatform.set("ubuntu-24.04-arm", bumped);
    expect(classifyProject("p/packages.lock.json", byPlatform, BASE, PLATFORMS, NO_SIGNALS).verdict).toBe(
      "differs-unexplained",
    );
  });

  test("an ADDED package on one platform is caught", () => {
    const extra = lock({
      "Apache.Arrow": { resolved: "23.0.0", contentHash: "cU4Zm7byFwnb82Ea9ZRvVnq2nJNf==" },
      "FSharp.Core": { resolved: "9.0.300", contentHash: "KzsZeI3sMK36DloK3nKdHGb8RBe==" },
      "System.Text.Json": { resolved: "9.0.0", contentHash: "AAAA==" },
    });
    const byPlatform = everywhere(BASE);
    byPlatform.set("macos-26", extra);
    const finding = classifyProject("p/packages.lock.json", byPlatform, BASE, PLATFORMS, NO_SIGNALS);
    expect(finding.verdict).toBe("differs-unexplained");
    expect(finding.differingEntries).toEqual(["net10.0/System.Text.Json"]);
  });
});

describe("the declared path is conjunctive — shape AND declaration", () => {
  const withRuntimePack = lock({
    "Apache.Arrow": { resolved: "23.0.0", contentHash: "cU4Zm7byFwnb82Ea9ZRvVnq2nJNf==" },
    "FSharp.Core": { resolved: "9.0.300", contentHash: "KzsZeI3sMK36DloK3nKdHGb8RBe==" },
    "runtime.win-x64.Microsoft.NETCore.ILAsm": { resolved: "9.0.0", contentHash: "WINWIN==" },
  });

  test("RID-shaped difference in a project that declares NO RID is NOT declared", () => {
    // The half that is easy to get wrong. The entry LOOKS platform-specific, but nothing
    // in the tree asked for a per-platform graph, so its appearance is the finding.
    const byPlatform = everywhere(BASE);
    byPlatform.set("windows-2025", withRuntimePack);
    const finding = classifyProject("p/packages.lock.json", byPlatform, BASE, PLATFORMS, NO_SIGNALS);
    expect(finding.verdict).toBe("differs-unexplained");
    expect(finding.detail).toContain("declares no RuntimeIdentifier");
  });

  test("RID-shaped difference in a project that DOES declare a RID is declared", () => {
    const byPlatform = everywhere(BASE);
    byPlatform.set("windows-2025", withRuntimePack);
    const finding = classifyProject("p/packages.lock.json", byPlatform, BASE, PLATFORMS, RID_SIGNALS);
    expect(finding.verdict).toBe("differs-for-a-declared-reason");
  });

  test("a declared project with a NON-RID-shaped difference is still unexplained", () => {
    const mixed = lock({
      "Apache.Arrow": { resolved: "23.0.0", contentHash: "DIFFERENT==" },
      "FSharp.Core": { resolved: "9.0.300", contentHash: "KzsZeI3sMK36DloK3nKdHGb8RBe==" },
      "runtime.win-x64.Microsoft.NETCore.ILAsm": { resolved: "9.0.0", contentHash: "WINWIN==" },
    });
    const byPlatform = everywhere(BASE);
    byPlatform.set("windows-2025", mixed);
    const finding = classifyProject("p/packages.lock.json", byPlatform, BASE, PLATFORMS, RID_SIGNALS);
    expect(finding.verdict).toBe("differs-unexplained");
    expect(finding.detail).toContain("not runtime/RID-shaped");
  });
});

describe("verdicts that are NOT the finding", () => {
  test("all platforms agreeing and equal to committed is identical", () => {
    expect(classifyProject("p/packages.lock.json", everywhere(BASE), BASE, PLATFORMS, NO_SIGNALS).verdict).toBe(
      "identical",
    );
  });

  test("all platforms agreeing but differing from committed is uniform drift, not a cross-OS finding", () => {
    const committed = lock({
      "Apache.Arrow": { resolved: "22.0.0", contentHash: "OLD==" },
      "FSharp.Core": { resolved: "9.0.300", contentHash: "KzsZeI3sMK36DloK3nKdHGb8RBe==" },
    });
    const finding = classifyProject("p/packages.lock.json", everywhere(BASE), committed, PLATFORMS, NO_SIGNALS);
    expect(finding.verdict).toBe("uniform-drift-from-committed");
    // Still counts as STABLE across platforms — it is the gate's problem, not this lane's.
    expect(finding.differingEntries).toEqual(["net10.0/Apache.Arrow"]);
  });

  test("CRLF-only difference is named, not silently normalised away", () => {
    const byPlatform = everywhere(BASE);
    byPlatform.set("windows-2025", BASE.replace(/\n/g, "\r\n"));
    const finding = classifyProject("p/packages.lock.json", byPlatform, BASE, PLATFORMS, NO_SIGNALS);
    expect(finding.verdict).toBe("differs-formatting-only");
  });

  test("key ORDER alone is not a difference", () => {
    // Rebuild the same object with every key-insertion order reversed at every level.
    // `canonicalise` must see through that; raw byte comparison must not.
    const reverseKeys = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(reverseKeys);
      if (value !== null && typeof value === "object") {
        const out: Record<string, unknown> = {};
        for (const key of Object.keys(value as Record<string, unknown>).reverse()) {
          out[key] = reverseKeys((value as Record<string, unknown>)[key]);
        }
        return out;
      }
      return value;
    };
    const reordered = JSON.stringify(reverseKeys(JSON.parse(BASE) as unknown), null, 2);
    expect(reordered).not.toBe(BASE);
    expect(canonicalise(reordered)).toBe(canonicalise(BASE));
    // And the whole-matrix path agrees: reordering is not a cross-platform finding.
    const byPlatform = everywhere(BASE);
    byPlatform.set("macos-26", reordered);
    expect(classifyProject("p/packages.lock.json", byPlatform, BASE, PLATFORMS, NO_SIGNALS).verdict).toBe(
      "differs-formatting-only",
    );
  });
});

describe("a lock missing on one platform is a finding, never a skip", () => {
  test("absence is reported rather than ignored", () => {
    const byPlatform = everywhere(BASE);
    byPlatform.delete("windows-11-arm");
    const finding = classifyProject("p/packages.lock.json", byPlatform, BASE, PLATFORMS, NO_SIGNALS);
    expect(finding.verdict).toBe("missing-on-some-platforms");
    expect(finding.absentOn).toEqual(["windows-11-arm"]);
  });

  test("a report containing a missing lock is NOT stable", () => {
    const manifests: LockManifest[] = PLATFORMS.map((p) => ({
      platform: p,
      sdk: "10.0.400",
      arch: p.includes("arm") ? "arm64" : "x64",
      locks: p === "windows-2025" ? {} : { "p/packages.lock.json": BASE },
    }));
    const report = compareManifests(manifests, { "p/packages.lock.json": BASE }, () => NO_SIGNALS);
    expect(report.stable).toBe(false);
    expect(report.counts["missing-on-some-platforms"]).toBe(1);
  });
});

describe("a leg that never reported is a failure, not agreement", () => {
  // The `a check that did not run looking like one that passed` class, in this lane's
  // own terms: if the windows-2025 restore dies, no manifest is uploaded, and a
  // comparison over the legs that DID report would call four-way agreement `stable`.
  const four: LockManifest[] = PLATFORMS.filter((p) => p !== "windows-2025").map((p) => ({
    platform: p,
    sdk: "10.0.400",
    arch: "x64",
    locks: { "a/packages.lock.json": BASE },
  }));
  const committed = { "a/packages.lock.json": BASE };

  test("four agreeing legs are NOT stable when five were expected", () => {
    const report = compareManifests(four, committed, () => NO_SIGNALS, PLATFORMS);
    expect(report.missingPlatforms).toEqual(["windows-2025"]);
    expect(report.stable).toBe(false);
    // and the per-project verdict is still clean — which is exactly why the roster
    // check has to exist separately from it.
    expect(report.counts.identical).toBe(1);
  });

  test("the same four legs ARE stable when only four were expected", () => {
    const report = compareManifests(four, committed, () => NO_SIGNALS, four.map((m) => m.platform));
    expect(report.missingPlatforms).toEqual([]);
    expect(report.stable).toBe(true);
  });

  test("no expected roster at all still compares what it has", () => {
    expect(compareManifests(four, committed, () => NO_SIGNALS).stable).toBe(true);
  });
});

describe("compareManifests folds the whole matrix", () => {
  test("a clean matrix is stable and every project is identical", () => {
    const manifests: LockManifest[] = PLATFORMS.map((p) => ({
      platform: p,
      sdk: "10.0.400",
      arch: p.includes("arm") ? "arm64" : "x64",
      locks: { "a/packages.lock.json": BASE, "b/packages.lock.json": BASE },
    }));
    const report = compareManifests(
      manifests,
      { "a/packages.lock.json": BASE, "b/packages.lock.json": BASE },
      () => NO_SIGNALS,
    );
    expect(report.stable).toBe(true);
    expect(report.counts.identical).toBe(2);
    expect(report.platforms).toEqual([...PLATFORMS].sort());
  });

  test("one bad project makes the whole report unstable", () => {
    const manifests: LockManifest[] = PLATFORMS.map((p) => ({
      platform: p,
      sdk: "10.0.400",
      arch: "x64",
      locks: {
        "a/packages.lock.json": BASE,
        "b/packages.lock.json": p === "macos-26" ? BASE.replace("23.0.0", "23.0.9") : BASE,
      },
    }));
    const report = compareManifests(
      manifests,
      { "a/packages.lock.json": BASE, "b/packages.lock.json": BASE },
      () => NO_SIGNALS,
    );
    expect(report.stable).toBe(false);
    expect(report.counts["differs-unexplained"]).toBe(1);
    expect(report.counts.identical).toBe(1);
  });
});

describe("declaredPerOsSignals reads the tree, not its comments", () => {
  test("finds a RuntimeIdentifier", () => {
    expect(declaredPerOsSignals(["<Project><PropertyGroup><RuntimeIdentifier>win-x64</RuntimeIdentifier></PropertyGroup></Project>"]).runtimeIdentifiers).toEqual(["win-x64"]);
  });

  test("finds several RuntimeIdentifiers", () => {
    expect(
      declaredPerOsSignals(["<RuntimeIdentifiers>win-x64;linux-x64;osx-arm64</RuntimeIdentifiers>"]).runtimeIdentifiers,
    ).toEqual(["win-x64", "linux-x64", "osx-arm64"]);
  });

  test("finds an OS-suffixed TargetFramework and ignores a plain one", () => {
    const s = declaredPerOsSignals(["<TargetFrameworks>net10.0;net10.0-windows</TargetFrameworks>"]);
    expect(s.osSuffixedTfms).toEqual(["net10.0-windows"]);
  });

  test("a COMMENTED-OUT RuntimeIdentifier does not count as declaring one", () => {
    // Otherwise a comment explaining why the repo sets no RID would license every
    // RID-shaped difference in that project — a declaration nobody made.
    const s = declaredPerOsSignals([
      "<Project><!-- deliberately no <RuntimeIdentifier>win-x64</RuntimeIdentifier> here --></Project>",
    ]);
    expect(s.runtimeIdentifiers).toEqual([]);
  });

  test("the repo's own root props declare neither - the premise this lane rests on", () => {
    // Pins the static finding the lane was built on: nothing in the tree asks for a
    // per-platform graph. If someone adds a RuntimeIdentifier or an OS-suffixed TFM to
    // the root props, this fails and the measurement's premise has to be revisited
    // rather than silently inherited.
    const s = declaredPerOsSignals([readFileSync("Directory.Build.props", "utf8")]);
    expect(s.runtimeIdentifiers).toEqual([]);
    expect(s.osSuffixedTfms).toEqual([]);
  });
});

describe("RID shape recognition", () => {
  test.each([
    "runtime.win-x64.Microsoft.NETCore.ILAsm",
    "Microsoft.NETCore.App.Runtime.linux-x64",
    "Microsoft.AspNetCore.App.Runtime.win-x64",
    "Microsoft.NETCore.App.Host.osx-arm64",
  ])("%s is RID-shaped", (name) => {
    expect(isRidShapedPackage(name)).toBe(true);
  });

  test.each(["Apache.Arrow", "FSharp.Core", "System.Text.Json", "Meziantou.Analyzer"])(
    "%s is NOT RID-shaped",
    (name) => {
      expect(isRidShapedPackage(name)).toBe(false);
    },
  );
});

describe("differingEntryKeys names what moved", () => {
  test("identical locks differ nowhere", () => {
    expect(differingEntryKeys(BASE, BASE)).toEqual([]);
  });

  test("a removed package is reported", () => {
    const fewer = lock({ "Apache.Arrow": { resolved: "23.0.0", contentHash: "cU4Zm7byFwnb82Ea9ZRvVnq2nJNf==" } });
    expect(differingEntryKeys(BASE, fewer)).toEqual(["net10.0/FSharp.Core"]);
  });
});
