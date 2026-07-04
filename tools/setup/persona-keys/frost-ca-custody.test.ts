// frost-ca-custody.ts — threshold CA + OpenSSH cert (081KWPHRNE).
// Sandbox-only. Run: bun test frost-ca-custody.test.ts
import { test, expect } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { certPath } from "./ca.ts";
import type { BiometricAuth, BiometricResult } from "./biometric.ts";
import {
  attestationMessage,
  ensureFrostCa,
  frostAttestationPath,
  frostCaPublicKeyPath,
  frostCaSharesDir,
  signFrostDeviceAttestation,
  type FrostCaCustodyEffects,
  type FrostDeviceAttestationV1,
} from "./frost-ca-custody.ts";
import { frostVerify } from "./frost.ts";

const CA = "frost-ca-tester";
const HOST = "frost-host";

function fakeBiometric(ok: boolean, calls?: string[]): BiometricAuth {
  return async (prompt: string): Promise<BiometricResult> => {
    if (calls) calls.push(prompt);
    return ok
      ? { ok: true, platform: "macos-touchid" }
      : { ok: false, platform: "macos-touchid", reason: "declined" };
  };
}

function makeSandbox(): { home: string; repoRoot: string; cleanup: () => void } {
  const home = mkdtempSync(join(tmpdir(), "zeta-frost-ca-home-"));
  const repoRoot = mkdtempSync(join(tmpdir(), "zeta-frost-ca-repo-"));
  return {
    home,
    repoRoot,
    cleanup: () => {
      rmSync(home, { recursive: true, force: true });
      rmSync(repoRoot, { recursive: true, force: true });
    },
  };
}

function fx(): FrostCaCustodyEffects {
  return {
    exists: (p) => existsSync(p),
    readText: (p) => readFileSync(p, "utf8"),
    writeText: (p, c, mode = 0o600) => {
      mkdirSync(dirname(p), { recursive: true, mode: 0o700 });
      writeFileSync(p, c, { mode, encoding: "utf8" });
    },
    mkdirp: (p) => mkdirSync(p, { recursive: true, mode: 0o700 }),
  };
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

test("frost-ca dry-run: no shares written", async () => {
  const sb = makeSandbox();
  try {
    const prompts: string[] = [];
    const r = await ensureFrostCa(fx(), {
      ca: CA,
      repoRoot: sb.repoRoot,
      home: sb.home,
      frost: "2-of-3",
      dryRun: true,
      biometricAuth: fakeBiometric(true, prompts),
    });
    expect(r.action).toBe("skipped-not-confirmed");
    expect(prompts.length).toBe(0);
    expect(existsSync(frostCaSharesDir(sb.home, CA))).toBe(false);
  } finally {
    sb.cleanup();
  }
});

test("frost-ca confirm: writes shares + optional public key; attest verifies", async () => {
  const sb = makeSandbox();
  try {
    const prompts: string[] = [];
    const gen = await ensureFrostCa(fx(), {
      ca: CA,
      repoRoot: sb.repoRoot,
      home: sb.home,
      frost: "2-of-3",
      confirm: true,
      commitPub: true,
      biometricAuth: fakeBiometric(true, prompts),
    });
    expect(gen.action).toBe("generated");
    expect(prompts.length).toBe(1);
    expect(existsSync(frostSharePath(sb))).toBe(true);
    expect(existsSync(frostCaPublicKeyPath(sb.repoRoot, CA))).toBe(true);

    const deviceKey = join(sb.home, "device");
    const keygen = spawnSync("ssh-keygen", ["-t", "ed25519", "-f", deviceKey, "-N", "", "-C", HOST], {
      encoding: "utf8",
    });
    expect(keygen.status).toBe(0);
    const devicePubPath = join(sb.repoRoot, "machines", `${HOST}.pub`);
    mkdirSync(dirname(devicePubPath), { recursive: true });
    writeFileSync(devicePubPath, readFileSync(deviceKey + ".pub"));

    const attPrompts: string[] = [];
    const att = await signFrostDeviceAttestation(fx(), {
      ca: CA,
      repoRoot: sb.repoRoot,
      home: sb.home,
      machineId: HOST,
      devicePubPath,
      users: ["alice"],
      confirm: true,
      biometricAuth: fakeBiometric(true, attPrompts),
      issuedAt: "2026-07-04T00:00:00.000Z",
    });
    expect(att.action).toBe("signed");
    expect(attPrompts.length).toBe(1);
    expect(existsSync(certPath(devicePubPath))).toBe(true);
    const listed = spawnSync("ssh-keygen", ["-L", "-f", certPath(devicePubPath)], {
      encoding: "utf8",
    });
    expect(listed.status).toBe(0);
    expect(listed.stdout).toContain("alice");
    expect(listed.stdout).toContain(HOST);

    const path = frostAttestationPath(sb.repoRoot, HOST);
    expect(existsSync(path)).toBe(true);
    const body = JSON.parse(readFileSync(path, "utf8")) as FrostDeviceAttestationV1;
    expect(body.principals).toEqual(["alice"]);
    const { signatureHex, ...unsigned } = body;
    const msg = attestationMessage(unsigned);
    expect(
      frostVerify(hexToBytes(body.groupPublicKeyHex), msg, hexToBytes(signatureHex)),
    ).toBe(true);
  } finally {
    sb.cleanup();
  }
});

function frostSharePath(sb: { home: string }): string {
  return join(frostCaSharesDir(sb.home, CA), "share-01.json");
}

test("frost-cert fail-closed: no frost CA", async () => {
  const sb = makeSandbox();
  try {
    const devicePubPath = join(sb.repoRoot, "machines", `${HOST}.pub`);
    mkdirSync(dirname(devicePubPath), { recursive: true });
    writeFileSync(devicePubPath, "ssh-ed25519 AAAATESTDEVICE frost-host\n");
    const r = await signFrostDeviceAttestation(fx(), {
      ca: CA,
      repoRoot: sb.repoRoot,
      home: sb.home,
      machineId: HOST,
      devicePubPath,
      users: ["alice"],
      confirm: true,
      biometricAuth: fakeBiometric(true),
    });
    expect(r.action).toBe("no-frost-ca");
  } finally {
    sb.cleanup();
  }
});
