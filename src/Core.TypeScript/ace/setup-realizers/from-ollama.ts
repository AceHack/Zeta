import { existsSync, mkdirSync, writeFileSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { curlFetchToFile } from "./curl-fetch.ts";
import { finishResult, readManifestFile, type SetupRealizer } from "./shared.ts";

const MANIFEST = "tools/setup/manifests/from-ollama";

function mget(text: string, key: string): string {
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (line.startsWith(`${key} `)) {
      const parts = line.split(/\s+/);
      return parts[1] ?? "";
    }
  }
  return "";
}

function shouldSkipNonInteractive(): boolean {
  return !process.stdin.isTTY && process.env.ZETA_INSTALL_FULL !== "1";
}

function linuxArch(): string | null {
  const uname = spawnSync("uname", ["-m"], { encoding: "utf8" });
  const m = (uname.stdout ?? "").trim();
  if (m === "x86_64" || m === "amd64") return "amd64";
  if (m === "aarch64" || m === "arm64") return "arm64";
  return null;
}

async function curlReachable(host: string): Promise<boolean> {
  const proc = Bun.spawn(["curl", "-fsS", `${host}/api/version`], { stdout: "ignore", stderr: "ignore" });
  return (await proc.exited) === 0;
}

async function ensureOllamaBinary(ctx: Parameters<SetupRealizer>[0]): Promise<boolean> {
  if (Bun.which("ollama") !== null) return true;

  if (process.platform === "darwin") {
    ctx.warn("ollama not found on macOS — expected via manifests/brew (brew install ollama).");
    ctx.warn("      Skipping model pull; re-run after the brew step installs it.");
    return false;
  }

  if (process.platform !== "linux") {
    ctx.warn(`unknown OS '${process.platform}' for ollama install; skipping local-llm`);
    return false;
  }

  if (existsSync("/etc/NIXOS")) {
    ctx.log("↓ NixOS detected — installing ollama via nix (FHS-safe)...");
    const gcRoot = join(process.env.HOME ?? "", ".local/state/zeta/ollama-result");
    mkdirSync(join(gcRoot, ".."), { recursive: true });
    mkdirSync(join(process.env.HOME ?? "", ".local/bin"), { recursive: true });

    if (ctx.dryRun) {
      ctx.actions.push("dry-run: nix build nixpkgs#ollama");
      return true;
    }

    const build = Bun.spawn(
      [
        "nix",
        "--extra-experimental-features",
        "nix-command flakes",
        "build",
        "--out-link",
        gcRoot,
        "nixpkgs#ollama",
      ],
      { stdout: "inherit", stderr: "inherit" },
    );
    if ((await build.exited) !== 0 || !existsSync(join(gcRoot, "bin/ollama"))) {
      ctx.warn("nix build ollama failed; skipping local-llm (tests fall back to mock)");
      return false;
    }

    const wrapper = join(process.env.HOME ?? "", ".local/bin/ollama");
    writeFileSync(
      wrapper,
      `#!/usr/bin/env bash\nexec env -u LD_LIBRARY_PATH ${gcRoot}/bin/ollama "$@"\n`,
    );
    chmodSync(wrapper, 0o755);
    ctx.log(`  ✓ ollama via nix build (GC-rooted out-link ${gcRoot}) + LD_LIBRARY_PATH-clean wrapper`);
    process.env.PATH = `${join(process.env.HOME ?? "", ".local/bin")}:${process.env.PATH ?? ""}`;
    return Bun.which("ollama") !== null;
  }

  const oarch = linuxArch();
  if (oarch === null) {
    ctx.warn(`unsupported arch for ollama; skipping local-llm`);
    return false;
  }

  const url = `https://github.com/ollama/ollama/releases/latest/download/ollama-linux-${oarch}.tar.zst`;
  ctx.log(`↓ installing ollama (latest, linux-${oarch})...`);
  if (ctx.dryRun) {
    ctx.actions.push(`dry-run: curl ${url}`);
    return true;
  }

  const tmp = mkdtemp();
  try {
    await curlFetchToFile(join(tmp, "ollama.tar.zst"), url);
    const tar = Bun.spawn(["tar", "-C", join(process.env.HOME ?? "", ".local"), "--zstd", "-xf", join(tmp, "ollama.tar.zst")], {
      stdout: "inherit",
      stderr: "inherit",
    });
    if ((await tar.exited) !== 0) {
      ctx.warn("ollama extract failed (zstd?); skipping local-llm (tests fall back to mock)");
      return false;
    }
    process.env.PATH = `${join(process.env.HOME ?? "", ".local/bin")}:${process.env.PATH ?? ""}`;
    return Bun.which("ollama") !== null;
  } catch {
    ctx.warn("ollama download failed; skipping local-llm (tests fall back to mock)");
    return false;
  } finally {
    rmTmp(tmp);
  }
}

function mkdtemp(): string {
  return spawnSync("mktemp", ["-d"], { encoding: "utf8" }).stdout?.trim() ?? "";
}

function rmTmp(dir: string): void {
  spawnSync("rm", ["-rf", dir]);
}

async function ensureDaemon(ctx: Parameters<SetupRealizer>[0], host: string): Promise<boolean> {
  if (await curlReachable(host)) return true;

  ctx.log("↓ starting ollama serve (background)...");
  if (!ctx.dryRun) {
    Bun.spawn(["ollama", "serve"], { stdout: "ignore", stderr: "ignore" });
    for (let i = 0; i < 30; i++) {
      if (await curlReachable(host)) return true;
      await Bun.sleep(1000);
    }
  }
  return ctx.dryRun;
}

async function modelPresent(model: string): Promise<boolean> {
  const proc = Bun.spawn(["ollama", "list"], { stdout: "pipe", stderr: "ignore" });
  const out = await new Response(proc.stdout).text();
  await proc.exited;
  return out
    .split("\n")
    .slice(1)
    .some((line) => line.split(/\s+/)[0] === model);
}

export const realizeFromOllama: SetupRealizer = async (ctx) => {
  const text = readManifestFile(ctx.repoRoot, MANIFEST);
  if (text === null) {
    ctx.log("✓ no local-llm manifest; skipping");
    return finishResult("from-ollama", ctx, true);
  }

  const model = mget(text, "model");
  const host = mget(text, "host") || "http://127.0.0.1:11434";

  if (model.length === 0) {
    ctx.warn("local-llm manifest has no 'model'; skipping");
    return finishResult("from-ollama", ctx, true);
  }

  if (shouldSkipNonInteractive()) {
    ctx.log(
      "✓ local-llm: skipping Ollama/model install (non-interactive run; best-effort; set ZETA_INSTALL_FULL=1 to exercise; interactive dev shells run it by default)",
    );
    return finishResult("from-ollama", ctx, true);
  }

  if (!(await ensureOllamaBinary(ctx))) {
    return finishResult("from-ollama", ctx, true);
  }

  if (!(await ensureDaemon(ctx, host))) {
    ctx.warn(`ollama daemon not reachable at ${host}; skipping model pull (tests fall back to mock)`);
    return finishResult("from-ollama", ctx, true);
  }

  if (!ctx.dryRun && (await modelPresent(model))) {
    ctx.log(`✓ local-llm model ${model} already present`);
  } else {
    ctx.log(`↓ pulling ${model} (~400MB, one-time)...`);
    ctx.actions.push(ctx.dryRun ? `dry-run: ollama pull ${model}` : `ollama pull ${model}`);
    if (!ctx.dryRun) {
      const pull = Bun.spawn(["ollama", "pull", model], { stdout: "inherit", stderr: "inherit" });
      if ((await pull.exited) !== 0) {
        ctx.warn(`'ollama pull ${model}' failed; skipping (tests fall back to mock)`);
        return finishResult("from-ollama", ctx, true);
      }
    }
  }

  const ver = spawnSync("ollama", ["--version"], { encoding: "utf8" });
  ctx.log(
    `✓ local-llm primitive ready: ${model} via ollama ${(ver.stdout ?? "").split("\n")[0] ?? "(version unknown)"}`,
  );
  return finishResult("from-ollama", ctx, false);
};
