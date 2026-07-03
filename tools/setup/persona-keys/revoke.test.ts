import { test, expect } from "bun:test";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { caPublicKeyPath } from "./ca.ts";
import type { BiometricAuth } from "./biometric.ts";
import { machineCertPath } from "./teardown.ts";
import { krlPath, krlRelPath, revokeCert, type RevokeEffects } from "./revoke.ts";

const CA = "test-ca";
const HOST = "revoke-host";

function fakeBiometricOk(): BiometricAuth {
  return async () => ({ ok: true, platform: "macos-touchid" as const });
}

function makeSandbox() {
  const repoRoot = mkdtempSync(join(tmpdir(), "zeta-revoke-repo-"));
  return {
    repoRoot,
    cleanup: () => rmSync(repoRoot, { recursive: true, force: true }),
  };
}

function seedCert(repoRoot: string): { cert: string; caPub: string } {
  mkdirSync(join(repoRoot, "maintainers", CA), { recursive: true });
  mkdirSync(join(repoRoot, "machines"), { recursive: true });
  const caPub = caPublicKeyPath(repoRoot, CA);
  const cert = machineCertPath(repoRoot, HOST);
  writeFileSync(caPub, "ssh-ed25519 AAAAFAKECAP comment\n");
  writeFileSync(cert, "ssh-ed25519-cert-v01@openssh.com AAAAFAKECERT\n");
  return { cert, caPub };
}

function fakeFx(revoked: { calls: number }): RevokeEffects {
  return {
    exists: existsSync,
    revokeCertInKrl: () => {
      revoked.calls += 1;
      return true;
    },
    stageRepoWrite: () => true,
  };
}

test("dry-run: would-revoke without touching KRL", async () => {
  const sb = makeSandbox();
  try {
    seedCert(sb.repoRoot);
    const revoked = { calls: 0 };
    const r = await revokeCert(fakeFx(revoked), {
      ca: CA,
      repoRoot: sb.repoRoot,
      hostname: HOST,
      dryRun: true,
    });
    expect(r.action).toBe("would-revoke");
    expect(revoked.calls).toBe(0);
    expect(r.krlRelPath).toBe(krlRelPath(CA));
  } finally {
    sb.cleanup();
  }
});

test("confirm + biometric: revokes cert and stages KRL", async () => {
  const sb = makeSandbox();
  try {
    seedCert(sb.repoRoot);
    const revoked = { calls: 0 };
    const auth: BiometricAuth = fakeBiometricOk();
    const r = await revokeCert(fakeFx(revoked), {
      ca: CA,
      repoRoot: sb.repoRoot,
      hostname: HOST,
      confirm: true,
      dryRun: false,
      biometricAuth: auth,
      reason: "compromised",
    });
    expect(r.action).toBe("revoked");
    expect(revoked.calls).toBe(1);
    expect(r.staged).toBe(true);
    expect(r.krlPath).toBe(krlPath(sb.repoRoot, CA));
  } finally {
    sb.cleanup();
  }
});

test("absent cert is a clean no-op", async () => {
  const sb = makeSandbox();
  try {
    const r = await revokeCert(fakeFx({ calls: 0 }), {
      ca: CA,
      repoRoot: sb.repoRoot,
      hostname: HOST,
      dryRun: true,
    });
    expect(r.action).toBe("absent");
  } finally {
    sb.cleanup();
  }
});
