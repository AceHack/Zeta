import { closeSync, existsSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { parseMechanismManifest } from "../setup-manifest.ts";
import {
  commandOnPath,
  finishResult,
  readManifestFile,
  runCommand,
  type RealizeContext,
  type SetupRealizer,
} from "./shared.ts";

const MANIFEST = "tools/setup/manifests/from-opam-git";

function opamRoot(): string {
  return process.env.OPAMROOT ?? join(process.env.HOME ?? "", ".opam");
}

async function runOpamShell(ctx: RealizeContext, label: string, script: string): Promise<boolean> {
  return runCommand(ctx, label, ["bash", "-lc", script]);
}

// ── Why the heavy steps below do NOT inherit stdout ──────────────────────────
//
// tlapm's `dune build` runs an upstream rule (deps/isabelle) that unpacks and
// builds a ~1GB Isabelle distribution. Somewhere in that tree a child flips
// O_NONBLOCK on the *shared* stdout descriptor and leaves it set. dune then
// writes the action's (multi-MB) captured output to that descriptor and the
// write returns EAGAIN. Measured consequences, both on `main`:
//
//   2026-07-02  dune raised `Sys_blocked_io` out of `print_user_message`
//               ("Internal error! ... unable to serialize exception") and
//               aborted the build — run 28619870340.
//   2026-08-22  the same rule, at the same point, produced no further output
//               for 49m50s until the 60-minute job cap cancelled the job with
//               `dune` still an orphan process — run 32605525115.
//
// EAGAIN cannot occur on a write to a *regular file*: O_NONBLOCK is ignored
// there. So the whole script's stdout/stderr goes to a file descriptor we open
// ourselves, and the captured log is replayed to the console afterwards. stdin
// is /dev/null so a build that prompts fails instead of blocking forever.
//
// The wall-clock budget is the second half: a hang must become a RED the lane
// can report, never a cancellation. `cancelled` is not a verdict.
const OPAM_GIT_BUDGET_MS = Number(process.env.ZETA_OPAM_GIT_BUDGET_MS ?? 40 * 60 * 1000);
const TIMEOUT_EXIT_CODE = 124;

function timeoutBinary(): string | null {
  return Bun.which("timeout") ?? Bun.which("gtimeout");
}

function readCapturedLog(logPath: string): string {
  try {
    return readFileSync(logPath, "utf8");
  } catch {
    return "(step log unreadable)";
  }
}

/** Run a heavy shell step with its output on a regular file (never the
 *  inherited pipe) and a wall-clock budget. Returns the captured log so the
 *  caller can surface it. Throws on failure, like `runCommand`. */
export async function runHeavyOpamShell(
  ctx: RealizeContext,
  label: string,
  script: string,
  budgetMs: number,
): Promise<void> {
  ctx.log(label);
  ctx.actions.push(ctx.dryRun ? `dry-run: ${label}` : label);
  if (ctx.dryRun) return;

  const dir = mkdtempSync(join(tmpdir(), "opam-git-step-"));
  const scriptPath = join(dir, "step.sh");
  const logPath = join(dir, "step.log");
  writeFileSync(scriptPath, `${script}\n`, "utf8");

  const seconds = Math.max(1, Math.floor(budgetMs / 1000));
  const timeoutBin = timeoutBinary();
  const argv =
    timeoutBin === null
      ? ["bash", "-l", scriptPath]
      : [timeoutBin, "-k", "30s", `${String(seconds)}s`, "bash", "-l", scriptPath];
  if (timeoutBin === null) {
    ctx.warn(`  (no timeout(1) on PATH — '${label}' runs without a wall-clock budget)`);
  }

  const logFd = openSync(logPath, "w");
  let code: number;
  try {
    const proc = Bun.spawn(argv, { stdout: logFd, stderr: logFd, stdin: "ignore" });
    code = await proc.exited;
  } finally {
    closeSync(logFd);
  }

  const captured = readCapturedLog(logPath);
  ctx.log(captured);
  rmSync(dir, { recursive: true, force: true });

  if (code === TIMEOUT_EXIT_CODE) {
    throw new Error(
      `${label} exceeded its ${String(Math.round(budgetMs / 60000))}m wall-clock budget ` +
        "(ZETA_OPAM_GIT_BUDGET_MS) — killed so the lane reports a verdict instead of being cancelled at the job cap",
    );
  }
  if (code !== 0) throw new Error(`${label} exited ${String(code)}`);
}

async function pkgInstalled(switchName: string, pkgName: string): Promise<boolean> {
  const proc = Bun.spawn(["bash", "-lc", `eval "$(opam env --switch=${switchName} --set-switch)" && ${pkgName} --version`], {
    stdout: "ignore",
    stderr: "ignore",
  });
  return (await proc.exited) === 0;
}

export const realizeFromOpamGit: SetupRealizer = async (ctx) => {
  if (process.env.ZETA_INSTALL_FULL !== "1") {
    ctx.log("✓ from-opam-git: skipping (set ZETA_INSTALL_FULL=1 to build opam git deps)");
    return finishResult("from-opam-git", ctx, true);
  }

  const text = readManifestFile(ctx.repoRoot, MANIFEST);
  if (text === null) {
    ctx.log("✓ from-opam-git: no manifest; skipping");
    return finishResult("from-opam-git", ctx, true);
  }

  if (!commandOnPath("opam")) {
    ctx.warn("from-opam-git: opam not on PATH — build skipped.");
    ctx.warn("  opam is declared in manifests/{brew,apt}; ensure the system-package step ran first.");
    return finishResult("from-opam-git", ctx, true);
  }

  // One budget for the whole mechanism, shared across its heavy steps, so the
  // sum cannot overrun the caller's job cap (tlaps-proof.yml: 60 minutes).
  const deadline = Date.now() + OPAM_GIT_BUDGET_MS;
  const remainingMs = (): number => Math.max(60_000, deadline - Date.now());

  for (const entry of parseMechanismManifest(text)) {
    const pkgName = entry.tokens[0];
    const gitRepo = entry.tokens[1];
    if (pkgName === undefined || gitRepo === undefined) continue;

    const commit = entry.attrs.commit;
    if (commit === undefined || commit.length === 0) continue;

    const switchName = entry.attrs.switch ?? `${pkgName}-build`;
    const ocaml = entry.attrs.ocaml ?? "5.1.0";

    if (!ctx.dryRun && !existsSync(opamRoot())) {
      ctx.log("↓ from-opam-git: initializing opam (bare, no shell setup, no sandbox)...");
      await runCommand(ctx, "opam init", [
        "opam",
        "init",
        "--bare",
        "--no-setup",
        "--disable-sandboxing",
        "--yes",
      ]);
    }

    if (!ctx.dryRun) {
      const list = spawnSync("opam", ["switch", "list", "--short"], { encoding: "utf8" });
      const switches = (list.stdout ?? "").split("\n").map((s: string) => s.trim());
      if (!switches.includes(switchName)) {
        ctx.log(`↓ from-opam-git: creating opam switch '${switchName}' (OCaml ${ocaml})...`);
        await runCommand(ctx, `opam switch create ${switchName}`, [
          "opam",
          "switch",
          "create",
          switchName,
          `ocaml-base-compiler.${ocaml}`,
          "--yes",
        ]);
      }
    }

    if (!ctx.dryRun && (await pkgInstalled(switchName, pkgName))) {
      const ver = spawnSync(
        "bash",
        ["-lc", `eval "$(opam env --switch=${switchName} --set-switch)" && ${pkgName} --version`],
        { encoding: "utf8" },
      );
      ctx.log(`✓ from-opam-git ${pkgName} already installed: ${(ver.stdout ?? "").split("\n")[0] ?? ""}`);
      continue;
    }

    ctx.log(`↓ from-opam-git: building ${pkgName} from ${commit}...`);
    ctx.log("  (heavy OCaml build — first run compiles deps + backends)");
    ctx.actions.push(
      ctx.dryRun
        ? `dry-run: opam build ${pkgName} from ${gitRepo}#${commit}`
        : `opam build ${pkgName} from ${gitRepo}#${commit}`,
    );

    if (ctx.dryRun) continue;

    await runOpamShell(
      ctx,
      `opam pin ${pkgName}`,
      `eval "$(opam env --switch=${switchName} --set-switch)" && opam pin add -n -y ${pkgName} '${gitRepo}#${commit}' || true`,
    );

    const srcDir = mkdtempSync(join(tmpdir(), "opam-git-"));
    try {
      await runCommand(ctx, `git clone ${gitRepo}`, ["git", "clone", gitRepo, srcDir]);
      await runCommand(ctx, `git checkout ${commit}`, ["git", "-C", srcDir, "checkout", "-q", commit]);
      await runHeavyOpamShell(
        ctx,
        "opam install --deps-only",
        `eval "$(opam env --switch=${switchName} --set-switch)" && opam install -y '${srcDir}/.' --deps-only`,
        remainingMs(),
      );

      await runHeavyOpamShell(
        ctx,
        `dune build -p ${pkgName}`,
        `eval "$(opam env --switch=${switchName} --set-switch)" && cd '${srcDir}' && dune build -p ${pkgName} @install`,
        remainingMs(),
      );
      await runHeavyOpamShell(
        ctx,
        `dune install -p ${pkgName}`,
        `eval "$(opam env --switch=${switchName} --set-switch)" && cd '${srcDir}' && dune install -p ${pkgName} --prefix="$OPAM_SWITCH_PREFIX"`,
        remainingMs(),
      );

      const postInstallCheck = spawnSync(
        "bash",
        ["-lc", `eval "$(opam env --switch=${switchName} --set-switch)" && test -f "$OPAM_SWITCH_PREFIX/lib/${pkgName}/Makefile.post-install" && echo yes`],
        { encoding: "utf8" },
      );
      if ((postInstallCheck.stdout ?? "").trim() === "yes") {
        await runHeavyOpamShell(
          ctx,
          "make post-install",
          `eval "$(opam env --switch=${switchName} --set-switch)" && make -C "$OPAM_SWITCH_PREFIX/lib/${pkgName}" -f Makefile.post-install`,
          remainingMs(),
        );
      }

      if (await pkgInstalled(switchName, pkgName)) {
        const ver = spawnSync(
          "bash",
          ["-lc", `eval "$(opam env --switch=${switchName} --set-switch)" && ${pkgName} --version`],
          { encoding: "utf8" },
        );
        ctx.log(`✓ from-opam-git ${pkgName}: ${(ver.stdout ?? "").split("\n")[0] ?? ""}`);
      } else {
        ctx.warn(`from-opam-git ${pkgName} build attempted but binary not resolvable; continuing`);
      }
    } finally {
      rmSync(srcDir, { recursive: true, force: true });
    }
  }

  ctx.log("✓ from-opam-git complete");
  return finishResult("from-opam-git", ctx, false);
};
