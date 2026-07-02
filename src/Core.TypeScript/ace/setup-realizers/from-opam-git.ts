import { existsSync, mkdtempSync, rmSync } from "node:fs";
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
      await runOpamShell(
        ctx,
        "opam install --deps-only",
        `eval "$(opam env --switch=${switchName} --set-switch)" && opam install -y '${srcDir}/.' --deps-only`,
      );

      await runOpamShell(
        ctx,
        `dune build -p ${pkgName}`,
        `eval "$(opam env --switch=${switchName} --set-switch)" && cd '${srcDir}' && dune build -p ${pkgName} @install`,
      );
      await runOpamShell(
        ctx,
        `dune install -p ${pkgName}`,
        `eval "$(opam env --switch=${switchName} --set-switch)" && cd '${srcDir}' && dune install -p ${pkgName} --prefix="$OPAM_SWITCH_PREFIX"`,
      );

      const postInstallCheck = spawnSync(
        "bash",
        ["-lc", `eval "$(opam env --switch=${switchName} --set-switch)" && test -f "$OPAM_SWITCH_PREFIX/lib/${pkgName}/Makefile.post-install" && echo yes`],
        { encoding: "utf8" },
      );
      if ((postInstallCheck.stdout ?? "").trim() === "yes") {
        await runOpamShell(
          ctx,
          "make post-install",
          `eval "$(opam env --switch=${switchName} --set-switch)" && make -C "$OPAM_SWITCH_PREFIX/lib/${pkgName}" -f Makefile.post-install`,
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
