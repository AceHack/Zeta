import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Keep the Windows install graph in sync + symmetric with Unix (operator 2026-05-30): every
// system tool in manifests/apt + manifests/brew must EITHER appear in manifests/windows OR be an
// allowlisted exception with a documented reason (Windows built-in / prebuilt / scoop-bundled).
// A new apt/brew tool with no Windows disposition fails this test — so the OSes can't drift apart
// silently. (Per .claude/rules/automated-tests-are-the-shield-assert-dont-skip.md: this asserts.)

const setupDir = join(import.meta.dir, "..", "setup");

function parseManifest(name: string): string[] {
  let raw: string;
  try {
    raw = readFileSync(join(setupDir, "manifests", name), "utf8");
  } catch {
    return [];
  }
  return raw
    .split(/\r?\n/)
    .map((l) => l.replace(/#.*$/, "").trim())
    .filter((l) => l.length > 0)
    .map((l) => l.split(/\s+/)[0]!); // first token = the package id
}

// Windows disposition for Unix system tools NOT carried in manifests/windows.
// Each entry needs a reason (why it doesn't need a scoop/winget/choco line).
const WINDOWS_EXCEPTIONS: Record<string, string> = {
  "build-essential": "Linux compilers; Zeta's toolchain is prebuilt on Windows (mise/bun/dotnet)",
  curl: "built into Windows 10+ (curl.exe ships in-box)",
  "ca-certificates": "Windows manages the trust store via the OS cert store",
  "p7zip-full": "scoop bundles 7zip for archive extraction; tar/curl are Windows built-ins",
  p7zip: "scoop bundles 7zip (brew's 7zip formula; sibling of apt's p7zip-full)",
  "hermes-agent":
    "NousResearch agent; upstream install is a Linux/macOS curl script (WebSearch 2026-05-30); Windows + cross-platform (uv/npm?) install TBD — deferred from manifests/windows pending an install-graph decision",
};

test("manifests/windows covers every apt/brew system tool (or an allowlisted exception)", () => {
  const unixTools = new Set([...parseManifest("apt"), ...parseManifest("brew")]);
  const windowsTools = new Set(parseManifest("windows"));
  const undealt = [...unixTools].filter((t) => !windowsTools.has(t) && !(t in WINDOWS_EXCEPTIONS));
  // Each Unix system tool must be in manifests/windows OR WINDOWS_EXCEPTIONS — no silent drift.
  expect(undealt).toEqual([]);
});

test("git is present in manifests/windows (loop clone + repo-ops prerequisite)", () => {
  expect(parseManifest("windows")).toContain("git");
});

test("no stale WINDOWS_EXCEPTIONS (each must still be a real apt/brew tool)", () => {
  const unixTools = new Set([...parseManifest("apt"), ...parseManifest("brew")]);
  const stale = Object.keys(WINDOWS_EXCEPTIONS).filter((t) => !unixTools.has(t));
  expect(stale).toEqual([]);
});
