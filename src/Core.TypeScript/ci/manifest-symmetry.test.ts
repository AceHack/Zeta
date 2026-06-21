import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Keep the Windows install graph in sync + symmetric with Unix (operator 2026-05-30): every
// system tool in manifests/apt + manifests/brew must EITHER appear in manifests/windows OR be an
// allowlisted exception with a documented reason (Windows built-in / prebuilt / scoop-bundled).
// A new apt/brew tool with no Windows disposition fails this test — so the OSes can't drift apart
// silently. (Per .claude/rules/automated-tests-are-the-shield-assert-dont-skip.md: this asserts.)

const repoRoot = join(import.meta.dir, "..", "..", "..");
const setupDir = join(repoRoot, "tools", "setup");

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

function expectMiseTool(name: string, version: string): void {
  // the host-tier split (workitem 081KTWQZY7F): full-tier pins live in .mise.full.toml,
  // merged via MISE_ENV=full — symmetry holds across the PAIR, not one file.
  const raw =
    readFileSync(join(repoRoot, ".mise.toml"), "utf8") + "\n" + readFileSync(join(repoRoot, ".mise.full.toml"), "utf8");
  expect(raw).toMatch(miseToolPattern(name, version));
}

function escapeRegExpLiteral(value: string): string {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

function miseToolPattern(name: string, version: string): RegExp {
  return new RegExp(`^${escapeRegExpLiteral(name)}\\s*=\\s*"${escapeRegExpLiteral(version)}"$`, "m");
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
  // #6123 local-LLM substrate deps (added to apt/brew). The Linux runtime libs below are provided
  // natively by Windows; zstd's extraction need is covered by Windows tar / scoop. (ollama itself
  // GRADUATED to manifests/windows on 2026-05-31 — Windows-native local-LLM parity; it is no longer
  // an exception.)
  zstd: "compression lib (Linux runtime dep for the local-LLM substrate); Windows tar supports zstd in-box + scoop has zstd if needed",
  libicu74: "Linux ICU runtime lib for the dotnet/local-LLM stack; Windows provides ICU natively",
  libssl3t64: "Linux OpenSSL runtime lib; Windows uses Schannel / native TLS",
  "libgssapi-krb5-2": "Linux Kerberos/GSSAPI runtime lib; Windows uses SSPI natively",
  tzdata: "Linux timezone database; Windows ships its own timezone data",
  "qemu-system-x86": "covered on Windows by the qemu manifest line; apt splits qemu-system-* from qemu-utils",
  "qemu-utils": "covered on Windows by the qemu manifest line; apt splits qemu-img utilities from qemu-system-*",
  mtools:
    "file-backed zflash ESP-image writer for Unix/NixOS QEMU proof; no scoop/winget/choco package source is declared yet, so Windows keeps QEMU-only coverage until a Windows package source is selected",
  // Rootless-podman helpers (added to apt with podman; B-0964 §2). Linux-only: on
  // Windows podman runs its Linux VM via WSL2, which provides user-namespace mapping,
  // networking, and overlay storage inside the VM — these host packages have no
  // Windows-native equivalent (the WSL2 distro carries them).
  uidmap: "Linux rootless user-namespace mapping (newuidmap/newgidmap); Windows podman uses WSL2's VM",
  slirp4netns: "Linux rootless container networking; Windows podman uses WSL2's VM networking",
  "fuse-overlayfs": "Linux rootless overlay storage driver; Windows podman uses WSL2's VM storage",
  opam: "OCaml package manager; only needed on Unix to build tlapm from source. Windows tlapm installs via prebuilt MSI/zip.",
  z3: "SMT solver; on Windows, Z3 is either scoop-installed or used via JS z3-solver npm package.",
  cvc5: "SMT solver; on Windows, cvc5 is either scoop-installed or downloaded directly.",
  eprover: "first-order ATP; on Windows, E prover is typically run in WSL or downloaded directly.",
  "headscale-cli":
    "headscale SERVER-side CLI — mesh coordination ops run on Linux/macOS hosts; Windows dev boxes join the mesh as tailscale clients (manifests/windows tailscale line).",
  "r-base":
    "R statistical runtime (charting/grammar-of-graphics lens-finder); covered on Windows by the `r` manifest line (scoop r / winget RProject.R / choco R.Project). apt names the package r-base; brew + scoop name it r.",
  tailscale:
    "mesh VPN client; on Windows, Tailscale installs natively via MSI/installer or winget (Tailscale.Tailscale).",
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

test("USB/QEMU and cluster integration tools are declared in install substrate", () => {
  expect(parseManifest("apt")).toEqual(expect.arrayContaining(["qemu-system-x86", "qemu-utils", "mtools"]));
  expect(parseManifest("brew")).toEqual(expect.arrayContaining(["qemu", "mtools"]));
  expect(parseManifest("windows")).toContain("qemu");

  expectMiseTool("k3d", "5.8.3");
  expectMiseTool("kind", "0.31.0");
  expectMiseTool("kubectl", "1.36.1");
  expectMiseTool("helm", "4.2.0");
});

test("mise tool matcher treats names and versions as literals", () => {
  const pattern = miseToolPattern("helm", "4.2.0");

  expect('helm = "4.2.0"').toMatch(pattern);
  expect('helm = "4x2x0"').not.toMatch(pattern);
});

test("Windows agent CLI install consumes the shared agent-clis manifest", () => {
  const installPs1 = readFileSync(join(setupDir, "install.ps1"), "utf8");
  const agentCliManifest = readFileSync(join(setupDir, "manifests", "agent-clis"), "utf8");

  expect(installPs1).toContain("manifests\\agent-clis");
  expect(agentCliManifest).toContain("@anthropic-ai/claude-code");
  expect(agentCliManifest).toContain("@openai/codex");
  expect(agentCliManifest).toContain("bin=claude");
  expect(agentCliManifest).toContain("bin=codex");

  // Install adapters consume the manifest; package ids do not belong hardcoded in install.ps1.
  expect(installPs1).not.toContain("@anthropic-ai/claude-code");
  expect(installPs1).not.toContain("@openai/codex");
  expect(installPs1).not.toContain("@google/gemini-cli");
});

test("Codex CLI setup migrates the deprecated service_tier default value", () => {
  const installPs1 = readFileSync(join(setupDir, "install.ps1"), "utf8");
  const agentClisSh = readFileSync(join(setupDir, "common", "agent-clis.sh"), "utf8");

  for (const installer of [installPs1, agentClisSh]) {
    expect(installer).toContain("service_tier");
    expect(installer).toContain('"default"');
    expect(installer).toContain("flex");
  }

  expect(installPs1).toContain("Repair-CodexConfigServiceTier");
  expect(agentClisSh).toContain("repair_codex_service_tier_config");
});

test("NixOS install shield validates agent-clis manifest, not one hardcoded CLI", () => {
  const dockerfile = readFileSync(
    join(repoRoot, "src", "Core.TypeScript", "ci", "dockerfiles", "nixos-install-sh-test", "Dockerfile"),
    "utf8",
  );

  expect(dockerfile).toContain("tools/setup/manifests/agent-clis");
  expect(dockerfile).toContain("bin=*)");
  expect(dockerfile).not.toContain("bun install --global @anthropic-ai/claude-code");
  expect(dockerfile).not.toContain("bun install --global @openai/codex");
  expect(dockerfile).not.toContain("bun install --global @google/gemini-cli");
});

test("local-llm install defaults to skip outside interactive/full install contexts", () => {
  const localLlm = readFileSync(join(setupDir, "common", "local-llm.sh"), "utf8");
  const ubuntuDockerfile = readFileSync(
    join(repoRoot, "src", "Core.TypeScript", "ci", "dockerfiles", "ubuntu-install-sh-test", "Dockerfile"),
    "utf8",
  );

  expect(localLlm).toContain('[ ! -t 0 ] && [ "${ZETA_INSTALL_FULL:-0}" != "1" ]');
  expect(localLlm).toContain("local-llm: skipping Ollama/model install");

  // The install shields are the explicit non-interactive opt-in path that asserts real Ollama.
  expect(ubuntuDockerfile).toContain("ZETA_INSTALL_FULL=1 \\\n    GITHUB_TOKEN=");
  expect(ubuntuDockerfile).toContain("if ! ZETA_INSTALL_FULL=1 ./tools/setup/install.sh");

  const jammyDockerfile = readFileSync(
    join(repoRoot, "src", "Core.TypeScript", "ci", "dockerfiles", "ubuntu-jammy-install-sh-test", "Dockerfile"),
    "utf8",
  );
  expect(jammyDockerfile).toContain("ubuntu:22.04@");
  expect(jammyDockerfile).toContain("ZETA_INSTALL_FULL=1 \\\n    GITHUB_TOKEN=");
  expect(jammyDockerfile).toContain("if ! ZETA_INSTALL_FULL=1 ./tools/setup/install.sh");
});

test("NixOS and USB installer surfaces delegate agent/runtime drift to install graph", () => {
  const commonNix = readFileSync(join(repoRoot, "full-ai-cluster", "nixos", "modules", "common.nix"), "utf8");
  const aiAgentNix = readFileSync(join(repoRoot, "full-ai-cluster", "nixos", "modules", "zeta-ai-agent.nix"), "utf8");
  const installerNix = readFileSync(
    join(repoRoot, "full-ai-cluster", "usb-nixos-installer", "nixos", "installer", "configuration.nix"),
    "utf8",
  );
  const zetaInstall = readFileSync(join(repoRoot, "full-ai-cluster", "usb-nixos-installer", "zeta-install.sh"), "utf8");
  const fullClusterFlake = readFileSync(join(repoRoot, "full-ai-cluster", "flake.nix"), "utf8");
  const usbInstallerFlake = readFileSync(join(repoRoot, "full-ai-cluster", "usb-nixos-installer", "flake.nix"), "utf8");

  // Installed NixOS gets declarative system packages from Nix, but runtime/agent CLI drift
  // comes from the same install.sh manifest graph as dev machines and CI.
  expect(commonNix).toContain("mise");
  expect(commonNix).toContain("mtools");
  expect(commonNix).toContain("tools/setup/manifests/agent-clis");
  expect(aiAgentNix).toContain("tools/setup/manifests/agent-clis");

  // The live USB bakes zeta-install declaratively, then the target bootstrap enters the
  // canonical install graph with the live-ISO guard explicitly overridden for the target.
  expect(installerNix).toContain('writeShellScriptBin "zeta-install"');
  expect(installerNix).toContain("p7zip");
  expect(installerNix).toContain("gh");
  expect(installerNix).toContain("mtools");
  expect(fullClusterFlake).toContain("qemu mtools");
  expect(usbInstallerFlake).toContain("mtools");
  expect(zetaInstall).toContain("ZETA_INSTALL_NIXOS_MODE=installed");
  expect(zetaInstall).toContain("ZETA_INSTALL_FULL=1");
  expect(zetaInstall).toContain("tools/setup/manifests/agent-clis");
  expect(zetaInstall).toContain("tools/setup/manifests/from-installer");

  // No NixOS module should name individual bun-global agent packages; package selection lives
  // in tools/setup/manifests/agent-clis.
  for (const nixText of [commonNix, aiAgentNix]) {
    expect(nixText).not.toContain("@anthropic-ai/claude-code");
    expect(nixText).not.toContain("@openai/codex");
    expect(nixText).not.toContain("@google/gemini-cli");
  }
});

test("no stale WINDOWS_EXCEPTIONS (each must still be a real apt/brew tool)", () => {
  const unixTools = new Set([...parseManifest("apt"), ...parseManifest("brew")]);
  const stale = Object.keys(WINDOWS_EXCEPTIONS).filter((t) => !unixTools.has(t));
  expect(stale).toEqual([]);
});
