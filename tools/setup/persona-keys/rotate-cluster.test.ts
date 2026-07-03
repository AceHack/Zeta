// rotate-cluster.ts — cluster-trust-root rotate preserves peer CAs (081KVP2M1 deferred gap).
// Sandbox-only: temp HOME + temp repoRoot; fake biometric; no real git / network.
// Run: bun test rotate-cluster.test.ts
import { test, expect } from "bun:test";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { setupMachine } from "./setup-machine.ts";
import { realEffects as machineRealFx, deviceKeyPath } from "./machine.ts";
import { caPrivateKeyPath, caPublicKeyPath, realEffects as caRealFx } from "./ca.ts";
import {
  parseTrustSetPeers,
  renderTrustSet,
  trustedUserCaKeysPath,
  type PeerCa,
} from "./setup-cluster.ts";
import { sessionBiometric, type BiometricAuth } from "./biometric.ts";
import type { OnboardEffects } from "./onboard.ts";
import type { GithubTrustEffects } from "./github-trust.ts";
import type { RotateEffects } from "./rotate.ts";
import { rotateCluster } from "./rotate-cluster.ts";

const USER = "cluster-rot";
const HOST = "cluster-rot-host";
const PEERS: readonly PeerCa[] = [
  { name: "peer-east", publicKey: "ssh-ed25519 AAAAPEEREAST peer-east" },
  { name: "peer-west", publicKey: "ssh-ed25519 AAAAPEERWEST peer-west" },
];

interface Sandbox {
  readonly home: string;
  readonly repoRoot: string;
  readonly cleanup: () => void;
}

function makeSandbox(): Sandbox {
  const home = mkdtempSync(join(tmpdir(), "zeta-crot-home-"));
  const repoRoot = mkdtempSync(join(tmpdir(), "zeta-crot-repo-"));
  return {
    home,
    repoRoot,
    cleanup: () => {
      rmSync(home, { recursive: true, force: true });
      rmSync(repoRoot, { recursive: true, force: true });
    },
  };
}

function fakeBiometric(prompts: string[]): BiometricAuth {
  return async (prompt: string) => {
    prompts.push(prompt);
    return { ok: true, platform: "macos-touchid" };
  };
}

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

async function provisionWithPeers(sb: Sandbox): Promise<void> {
  const prompts: string[] = [];
  const session = sessionBiometric(fakeBiometric(prompts));
  const res = await setupMachine(setupEffects(session.door), session, {
    user: USER,
    repoRoot: sb.repoRoot,
    home: sb.home,
    hostname: HOST,
    caConfigured: false,
  });
  expect(res.onboard.cert?.action).toBe("signed");
  expect(existsSync(caPrivateKeyPath(sb.home))).toBe(true);
  expect(existsSync(deviceKeyPath(sb.home))).toBe(true);

  // Seed a multi-CA trust set (self + peers) as setup-cluster would write.
  const selfPub = readFileSync(caPublicKeyPath(sb.repoRoot, USER), "utf8").trim();
  const rendered = renderTrustSet(sb.repoRoot, USER, selfPub, PEERS);
  mkdirSync(dirname(rendered.trustedUserCaKeysPath), { recursive: true });
  writeFileSync(rendered.trustedUserCaKeysPath, rendered.trustedUserCaKeysFile);
}

function rotateFx(staged: { repoRoot: string; relPath: string }[]): RotateEffects {
  const machine = machineRealFx();
  const ca = caRealFx();
  return {
    exists: (p) => existsSync(p),
    readText: (p) => readFileSync(p, "utf8"),
    writeText: (p, c) => {
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, c);
    },
    mkdirp: (p) => mkdirSync(p, { recursive: true }),
    genEd25519: (keyPath, comment) => machine.genEd25519(keyPath, comment),
    movePrivate: (from, to) => {
      for (const suffix of ["", ".pub"]) {
        const src = from + suffix;
        const dst = to + suffix;
        if (existsSync(src)) {
          mkdirSync(dirname(dst), { recursive: true });
          renameSync(src, dst);
        }
      }
    },
    ca,
    stageRepoWrite: (repoRoot, relPath) => {
      staged.push({ repoRoot, relPath });
      return true;
    },
  };
}

test("parseTrustSetPeers extracts peer sources, ignores self", () => {
  const text = renderTrustSet("/repo", "acme", "ssh-ed25519 AAAASELF self", PEERS)
    .trustedUserCaKeysFile;
  const peers = parseTrustSetPeers(text);
  expect(peers.map((p) => p.name).sort()).toEqual(["peer-east", "peer-west"]);
});

test("cluster-trust-root rotate preserves peer CAs across CA overlap", async () => {
  const sb = makeSandbox();
  try {
    await provisionWithPeers(sb);
    const trustPath = trustedUserCaKeysPath(sb.repoRoot, USER);
    expect(parseTrustSetPeers(readFileSync(trustPath, "utf8")).map((p) => p.name).sort()).toEqual([
      "peer-east",
      "peer-west",
    ]);

    const prompts: string[] = [];
    const staged: { repoRoot: string; relPath: string }[] = [];
    const res = await rotateCluster(rotateFx(staged), {
      ca: USER,
      user: USER,
      repoRoot: sb.repoRoot,
      home: sb.home,
      hostname: HOST,
      ports: ["ca-key"],
      dryRun: false,
      confirm: true,
      biometricAuth: fakeBiometric(prompts),
    });

    expect(prompts.length).toBe(1);
    expect(res.rotate.rotations.find((r) => r.port === "ca-key")?.action).toBe("rotated");
    expect([...res.peersBefore].sort()).toEqual(["peer-east", "peer-west"]);
    expect([...res.peersAfter].sort()).toEqual(["peer-east", "peer-west"]);
    expect(res.peersPreserved).toBe(true);

    const trustAfter = readFileSync(trustPath, "utf8");
    const peerNames = parseTrustSetPeers(trustAfter).map((p) => p.name).sort();
    expect(peerNames).toEqual(["peer-east", "peer-west"]);
    // Overlap: two self pubkey lines remain (old + new).
    const selfLines = trustAfter.split("\n").filter((l) => /^#\s+self\s+cluster CA\s*$/.test(l.trim()));
    expect(selfLines.length).toBe(2);
    expect(trustAfter).toContain("AAAAPEEREAST");
    expect(trustAfter).toContain("AAAAPEERWEST");
  } finally {
    sb.cleanup();
  }
});

test("dry-run reports peers and touches nothing", async () => {
  const sb = makeSandbox();
  try {
    await provisionWithPeers(sb);
    const trustPath = trustedUserCaKeysPath(sb.repoRoot, USER);
    const before = readFileSync(trustPath, "utf8");
    const prompts: string[] = [];
    const res = await rotateCluster(rotateFx([]), {
      ca: USER,
      user: USER,
      repoRoot: sb.repoRoot,
      home: sb.home,
      hostname: HOST,
      ports: ["ca-key"],
      dryRun: true,
      biometricAuth: fakeBiometric(prompts),
    });
    expect(prompts.length).toBe(0);
    expect(res.dryRun).toBe(true);
    expect(res.peersBefore).toEqual(["peer-east", "peer-west"]);
    expect(res.peersPreserved).toBe(true);
    expect(readFileSync(trustPath, "utf8")).toBe(before);
  } finally {
    sb.cleanup();
  }
});
