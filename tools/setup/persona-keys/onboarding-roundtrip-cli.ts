#!/usr/bin/env bun
// Zeta NEW-FORK ONBOARDING ROUND-TRIP runner — a standalone driver for the setup → teardown →
// re-setup convergence loop the harness (onboarding-roundtrip.test.ts) proves. Useful to WATCH
// the lifecycle converge a few times while iterating to tight (Aaron 2026-06-21: *"test them a
// few times and get them right"*). Same SANDBOX-ONLY guarantee as the test: every cycle runs in
// throwaway temp dirs (temp HOME + temp repoRoot) with a FAKE biometric door, a FAKE no-real-git
// `gitRm`, and NO network — it NEVER touches the real ~/.config/zeta, real `op`, real `git`, or
// any real key. It exists to SHOW convergence, not to provision a real machine (use
// setup-machine-cli.ts for that).
//
// Usage:  bun onboarding-roundtrip-cli.ts [--cycles N]
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { setupMachine } from "./setup-machine.ts";
import { teardown, ZETA_LOCAL_DIRS, zetaLocalDirPath, type TeardownEffects } from "./teardown.ts";
import { realEffects as machineRealFx, machinePubPath, deviceKeyPath } from "./machine.ts";
import { caPrivateKeyPath, caPublicKeyPath, certPath, realEffects as caRealFx } from "./ca.ts";
import { sessionBiometric, type BiometricAuth } from "./biometric.ts";
import type { OnboardEffects } from "./onboard.ts";
import type { GithubTrustEffects } from "./github-trust.ts";

const USER = "tester";
const HOST = "roundtrip-host";

function parseCycles(argv: readonly string[]): number {
  const i = argv.indexOf("--cycles");
  if (i >= 0 && i + 1 < argv.length) {
    const n = Number.parseInt(argv[i + 1] ?? "", 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 3;
}

const fakeBiometric: BiometricAuth = async () => ({ ok: true, platform: "macos-touchid" });

function setupEffects(sessionDoor: BiometricAuth): OnboardEffects {
  const machine = { ...machineRealFx(), hostname: () => HOST };
  const trust: GithubTrustEffects = {
    exists: () => false,
    readText: () => "",
    listDir: () => [],
    fetchKeys: async () => "",
    fetchGpg: async () => "",
  };
  return { machine, trust, ca: caRealFx(), biometricAuth: sessionDoor };
}

function teardownEffects(): TeardownEffects {
  return {
    exists: (p) => existsSync(p),
    listFiles: (dir) => {
      if (!existsSync(dir)) return [];
      const out: string[] = [];
      const walk = (d: string): void => {
        for (const name of readdirSync(d, { withFileTypes: true })) {
          const full = join(d, name.name);
          if (name.isDirectory()) walk(full);
          else out.push(full);
        }
      };
      walk(dir);
      return out;
    },
    securelyRemove: (path) => {
      if (existsSync(path)) rmSync(path, { force: true });
      return !existsSync(path);
    },
    removeDir: (dir) => {
      if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    },
    gitRm: (repoRoot, relPath) => {
      const full = join(repoRoot, relPath);
      if (existsSync(full)) rmSync(full, { force: true });
      return true; // fake staging — NEVER real git, NEVER a push
    },
  };
}

function isClean(home: string, repoRoot: string): boolean {
  const devPub = machinePubPath(repoRoot, HOST);
  const paths = [
    deviceKeyPath(home),
    devPub,
    caPrivateKeyPath(home),
    caPublicKeyPath(repoRoot, USER),
    certPath(devPub),
  ];
  const dirsGone = ZETA_LOCAL_DIRS.every((d) => !existsSync(zetaLocalDirPath(d, home)));
  return dirsGone && paths.every((p) => !existsSync(p));
}

async function main(): Promise<void> {
  const cycles = parseCycles(process.argv.slice(2));
  const home = mkdtempSync(join(tmpdir(), "zeta-rt-home-"));
  const repoRoot = mkdtempSync(join(tmpdir(), "zeta-rt-repo-"));
  process.stdout.write(
    `Zeta onboarding round-trip — SANDBOX ONLY (home=${home}, repo=${repoRoot})\n` +
      `Running ${cycles} setup→teardown cycle(s)…\n\n`,
  );
  const shapes: string[] = [];
  try {
    for (let i = 1; i <= cycles; i++) {
      // SETUP (new-fork path: caConfigured probes the sandbox — false on a clean fork).
      const caConfigured = existsSync(caPrivateKeyPath(home));
      const session = sessionBiometric(fakeBiometric);
      const setup = await setupMachine(setupEffects(session.door), session, {
        user: USER,
        repoRoot,
        home,
        hostname: HOST,
        caConfigured,
      });
      const cert = setup.onboard.cert;
      const shape = `keyId=${cert?.certId ?? "?"} principal=${cert?.principal ?? "?"} ca=${setup.caRealized?.action ?? "?"} machine=${setup.onboard.machine.action} cert=${cert?.action ?? "?"} approvals=${setup.biometricApprovals}`;
      shapes.push(shape);
      process.stdout.write(`  cycle ${i}: SETUP    ${shape}\n`);

      // TEARDOWN.
      const td = await teardown(teardownEffects(), {
        ca: USER,
        repoRoot,
        home,
        hostname: HOST,
        dryRun: false,
        confirm: true,
        biometricAuth: fakeBiometric,
      });
      const clean = isClean(home, repoRoot);
      process.stdout.write(
        `  cycle ${i}: TEARDOWN wiped=${td.localWipe.filter((l) => l.action === "wiped").length} unregistered=${td.unregisteredPaths.length} clean=${clean}\n`,
      );
      if (!clean) {
        process.stderr.write("FAIL: sandbox not clean after teardown — drift detected.\n");
        process.exitCode = 1;
        return;
      }
    }
    const converged = shapes.every((s) => s === shapes[0]);
    process.stdout.write(
      `\nConvergence: ${converged ? "PASS" : "FAIL"} — ${converged ? "every cycle produced the same N+M shape" : "shapes diverged across cycles"}.\n`,
    );
    if (!converged) process.exitCode = 1;
  } finally {
    rmSync(home, { recursive: true, force: true });
    rmSync(repoRoot, { recursive: true, force: true });
  }
}

await main();
