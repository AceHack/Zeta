import { test, expect } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
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
    .map((l) => (l.split("#")[0] ?? "").trim())
    .filter((l) => l.length > 0)
    .map((l) => l.split(/\s+/)[0])
    .filter((token): token is string => token !== undefined && token.length > 0); // first token = the package id
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
  // Rootless-podman helpers (added to apt with podman; 081KT07NV0008QG0R001CBQ2X2 §2). Linux-only: on
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
  // macOS-only PAM module (brew only -- absent from manifests/apt). It re-attaches the PAM
  // stack to the Aqua GUI session so `pam_tid.so` (Touch ID) can reach the fingerprint
  // sensor from tmux/screen/ssh, which is the whole reason Touch-ID-for-sudo is usable in
  // a terminal multiplexer. Windows has no PAM stack at all and no `sudo` in this sense --
  // elevation is UAC, and biometric elevation is Windows Hello via a wholly separate API
  // (no per-command PAM module is involved). So there is nothing to name on the Windows
  // side: this is a genuine platform absence, not a deferred packaging decision.
  "pam-reattach":
    "macOS-only PAM module for Touch-ID sudo under tmux/screen (tools/setup/touchid-sudo.ts); Windows uses UAC + Windows Hello, which has no PAM equivalent",
  agda: "cubical Agda proof lane is Unix-only for now (081KX1VE4G808QG0R003DCK3GV named debt, tlaps/Isabelle precedent); Windows disposition (choco agda / ghcup) deferred until the lane needs a Windows leg.",
  // The multi-compiler WASM lane added these Unix packages in 1dd36bad2. Windows currently has no
  // host-tier filter in manifests/windows, so forcing the large compiler stack into that base
  // manifest would also force it into every constrained Windows installer smoke. Keep each
  // disposition explicit until Windows gains the same tier=standard/full parser as Unix.
  wabt: "WABT is available only in Scoop Extras, while install.ps1 intentionally bootstraps the Main bucket alone; Windows package-source expansion remains a separate installer decision.",
  "lua5.4": "covered on Windows by the `lua` manifest line; apt includes the language version in its package id",
  binaryen:
    "WASM optimizer/compiler support is a full compiler-lane dependency; defer Windows installation until manifests/windows supports host tiers instead of forcing it onto every base host.",
  emscripten:
    "Emscripten is a large full compiler-lane dependency; defer Windows installation until manifests/windows supports host tiers instead of forcing it onto every base host.",
  llvm: "LLVM is a large full compiler-lane dependency; defer Windows installation until manifests/windows supports host tiers instead of forcing it onto every base host.",
  zig: "Zig is already installed cross-platform by mise from .mise.toml; it does not belong in the Windows system-package manifest.",

  // ── YubiKey / YubiHSM (2026-08-20) ──────────────────────────────────────────
  // The three tool entries that stood here -- yubikey-manager, ykman, yubico-piv-tool --
  // were removed once the check they deferred was actually run. Their stated reason was
  // that no scoop/winget id "was verifiable from the host this was authored on", which is
  // an honest exception and also an unrun check. Run against the registries, all three
  // resolve: scoop Main carries yubikey-manager-cli (ykman.exe) and yubico-piv-tool, and
  // winget carries Yubico.YubiKeyManagerCLI and Yubico.PIVTool, versions agreeing with
  // brew. They are declared in manifests/windows now, so no exception is needed.
  //
  // Two of the three remaining entries are NAME-ALIAS exceptions, not missing-tool ones:
  // the same binary is declared in manifests/windows under the ecosystem's own package
  // name. Same shape as lua5.4 (apt) vs lua (brew/windows). The alias is recorded rather
  // than resolved because this matcher compares names literally and has no alias table --
  // adding one is a bigger change than this row needs.
  "yubikey-manager":
    "apt's name for the YubiKey Manager CLI; declared in manifests/windows as scoop `yubikey-manager-cli` (winget Yubico.YubiKeyManagerCLI, v5.9.2, bin ykman.exe). Verified against ScoopInstaller/Main and microsoft/winget-pkgs 2026-08-20 -- present, not absent.",
  ykman:
    "brew's name for the same binary; same Windows row as yubikey-manager above. (yubico-piv-tool needs no entry: scoop, winget, apt and brew all spell it identically, so it matches literally.)",

  // The two below are genuine Windows BUILT-INS -- nothing to install, a different class
  // of reason from the aliases above.
  pcscd:
    "Windows has a built-in smartcard service (SCardSvr); no package to install. The Linux-only entry exists because Linux has no equivalent running by default.",
  libpcsclite1: "PC/SC client library is Linux-only; the Windows equivalent (WinSCard) is an OS component.",
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

test("byte-lock script runtimes are declared once per platform", () => {
  expectMiseTool("go", "1.26.4");

  expect(parseManifest("apt")).toContain("lua5.4");
  expect(parseManifest("brew")).toContain("lua");
  expect(parseManifest("windows")).toContain("lua");

  const linuxInstaller = readFileSync(join(setupDir, "linux.sh"), "utf8");
  expect(linuxInstaller).not.toContain("golang-go");
  expect(linuxInstaller).not.toContain("lua5.4");
});

test("USB/QEMU and cluster integration tools are declared in install substrate", () => {
  const apt = parseManifest("apt");
  const brew = parseManifest("brew");
  const windows = parseManifest("windows");

  for (const tool of ["qemu-system-x86", "qemu-utils", "mtools"]) expect(apt).toContain(tool);
  for (const tool of ["qemu", "mtools"]) expect(brew).toContain(tool);
  expect(windows).toContain("qemu");

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

test("Windows agent CLI install consumes the shared from-bun-global manifest", () => {
  const installPs1 = readFileSync(join(setupDir, "install.ps1"), "utf8");
  const agentCliManifest = readFileSync(join(setupDir, "manifests", "from-bun-global"), "utf8");

  expect(installPs1).toContain("manifests\\from-bun-global");
  expect(agentCliManifest).toContain("@anthropic-ai/claude-code");
  expect(agentCliManifest).toContain("@openai/codex");
  expect(agentCliManifest).toContain("bin=claude");
  expect(agentCliManifest).toContain("bin=codex");

  // Install adapters consume the manifest; package ids do not belong hardcoded in install.ps1.
  expect(installPs1).not.toContain("@anthropic-ai/claude-code");
  expect(installPs1).not.toContain("@openai/codex");
  expect(installPs1).not.toContain("@google/gemini-cli");
});

test("ACE Unix and Windows setup realize the root devDependency graph", () => {
  const setupRealizers = readFileSync(
    join(repoRoot, "src", "Core.TypeScript", "ace", "setup-realizers", "index.ts"),
    "utf8",
  );
  const bunWorkspaceRealizer = readFileSync(
    join(repoRoot, "src", "Core.TypeScript", "ace", "setup-realizers", "from-bun-workspace.ts"),
    "utf8",
  );
  const installPs1 = readFileSync(join(setupDir, "install.ps1"), "utf8");
  const windowsInstallerDockerfile = readFileSync(
    join(repoRoot, "src", "Core.TypeScript", "ci", "dockerfiles", "windows-install-ps1-test", "Dockerfile"),
    "utf8",
  );
  const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
    readonly dependencies?: Readonly<Record<string, string>>;
    readonly devDependencies?: Readonly<Record<string, string>>;
  };
  const bunLock = readFileSync(join(repoRoot, "bun.lock"), "utf8");
  const playwrightVersion = packageJson.devDependencies?.playwright;

  expect(setupRealizers).toContain('"from-bun-workspace"');
  expect(bunWorkspaceRealizer).toContain('["bun", "install"]');
  expect(installPs1).toContain("mise exec -- bun install --frozen-lockfile");
  expect(windowsInstallerDockerfile).toContain("COPY package.json C:/workspace/package.json");
  expect(windowsInstallerDockerfile).toContain("COPY bun.lock C:/workspace/bun.lock");
  expect(playwrightVersion).toBeDefined();
  expect(packageJson.dependencies?.playwright).toBeUndefined();
  expect(bunLock).toContain(`"playwright": "${playwrightVersion}"`);
});

test("Codex CLI setup migrates the deprecated service_tier default value", () => {
  const installPs1 = readFileSync(join(setupDir, "install.ps1"), "utf8");
  const agentClisTs = readFileSync(
    join(repoRoot, "src", "Core.TypeScript", "ace", "setup-realizers", "from-bun-global.ts"),
    "utf8",
  );

  for (const installer of [installPs1, agentClisTs]) {
    expect(installer).toContain("service_tier");
    expect(installer).toContain('"default"');
    expect(installer).toContain("flex");
  }

  expect(installPs1).toContain("Repair-CodexConfigServiceTier");
  expect(agentClisTs).toContain("repairCodexServiceTierConfig");
});

test("NixOS install shield validates from-bun-global manifest, not one hardcoded CLI", () => {
  const dockerfile = readFileSync(
    join(repoRoot, "src", "Core.TypeScript", "ci", "dockerfiles", "nixos-install-sh-test", "Dockerfile"),
    "utf8",
  );

  expect(dockerfile).toContain("tools/setup/manifests/from-bun-global");
  expect(dockerfile).toContain("bin=*)");
  expect(dockerfile).not.toContain("bun install --global @anthropic-ai/claude-code");
  expect(dockerfile).not.toContain("bun install --global @openai/codex");
  expect(dockerfile).not.toContain("bun install --global @google/gemini-cli");
});

test("from-ollama install defaults to skip outside interactive/full install contexts", () => {
  const localLlm = readFileSync(
    join(repoRoot, "src", "Core.TypeScript", "ace", "setup-realizers", "from-ollama.ts"),
    "utf8",
  );
  const ubuntuDockerfile = readFileSync(
    join(repoRoot, "src", "Core.TypeScript", "ci", "dockerfiles", "ubuntu-install-sh-test", "Dockerfile"),
    "utf8",
  );

  expect(localLlm).toContain('!process.stdin.isTTY && process.env.ZETA_INSTALL_FULL !== "1"');
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

  // Installed NixOS gets declarative system packages from Nix, but runtime/agent CLI drift
  // comes from the same install.sh manifest graph as dev machines and CI.
  expect(commonNix).toContain("mise");
  expect(commonNix).toContain("mtools");
  expect(commonNix).toContain("tools/setup/manifests/from-bun-global");
  expect(aiAgentNix).toContain("tools/setup/manifests/from-bun-global");

  // The live USB bakes zeta-install declaratively, then the target bootstrap enters the
  // canonical install graph with the live-ISO guard explicitly overridden for the target.
  expect(installerNix).toContain('writeShellScriptBin "zeta-install"');
  expect(installerNix).toContain("p7zip");
  expect(installerNix).toContain("gh");
  expect(installerNix).toContain("mtools");
  expect(fullClusterFlake).toContain("qemu mtools");
  // 081KZKS9A6B08QG0R0008EG72M retired full-ai-cluster/usb-nixos-installer/flake.nix
  // (it built the installer with no mise-pin overlay, so it shipped a different ISO
  // than CI). full-ai-cluster/flake.nix is now the single definition — asserted here
  // so this test can never be satisfied by a re-added duplicate.
  expect(existsSync(join(repoRoot, "full-ai-cluster", "usb-nixos-installer", "flake.nix"))).toBe(false);
  expect(zetaInstall).toContain("ZETA_INSTALL_NIXOS_MODE=installed");
  expect(zetaInstall).toContain("ZETA_INSTALL_FULL=1");
  expect(zetaInstall).toContain("tools/setup/manifests/from-bun-global");
  expect(zetaInstall).toContain("tools/setup/manifests/from-installer");

  // No NixOS module should name individual bun-global agent packages; package selection lives
  // in tools/setup/manifests/from-bun-global.
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
