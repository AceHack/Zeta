// publish.ts conformance — the biometric-gated GitHub PUBLIC-key publisher. EVERY test
// runs against FIXTURES via the injected PublishEffects — NEVER a real biometric prompt,
// NEVER a real `gh ssh-key add`, NEVER a network call, NEVER a secret. Proves the security
// contract: biometric gate FIRST + fail-closed (ghAddKey NOT called when biometric returns
// false; IS called with the PUBLIC key when true), PUBLIC-key-only refusal, --dry-run does
// NO prompt + NO write, and the readout shape.
//
// PURE-KEY MODEL (Aaron 2026-06-21): a MACHINE key is NOT a user's GitHub auth key, so
// `keyPath` is REQUIRED (the USER's pubkey to upload) — there is no machine-key default.
// Run: bun test publish.test.ts   (from tools/setup/persona-keys)
import { test, expect } from "bun:test";
import {
  detectBiometricPlatform,
  formatResult,
  looksPrivate,
  publicKeyFingerprint,
  publishKey,
  publishTitle,
  type BiometricResult,
  type PublishEffects,
} from "./publish.ts";

const PUB = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDwJVbQNiFzUCiOhc aaron@mymac (zeta-device)";
// PURE-KEY MODEL: `keyPath` is REQUIRED — the explicit USER pubkey to upload (a person's
// GitHub auth key). There is NO machine-key default; a machine key never reaches GitHub.
const USER_KEY = "/repo/maintainers/aaron/keyring-ssh.pub";
// NON-KEYS. These fixtures only exercise looksPrivate's header match — there is no real
// key material. The "PRIVATE KEY" token is split (`PK`) so the source never contains the
// contiguous header literal that GitHub secret-scanning false-positives on; the runtime
// string still contains "PRIVATE KEY" so looksPrivate matches.
const PK = "PRIVATE" + " KEY";
const PRIVATE_PEM = `-----BEGIN OPENSSH ${PK}-----\nNOT-A-REAL-KEY-test-fixture\n-----END OPENSSH ${PK}-----`;

/** A spying fixture door. Records every biometric call + ghAddKey call so a test can
 *  assert ORDER (biometric before write) and that the write NEVER happens when the gate
 *  fails. The biometric outcome is whatever `biometric` is set to (fake — no real prompt). */
function fixtureEffects(opts: {
  keyText?: string;
  keyExists?: boolean;
  biometric: BiometricResult;
}): {
  fx: PublishEffects;
  calls: { biometricPrompts: string[]; ghAdds: { publicKey: string; title: string; keyType: string }[] };
} {
  const calls = {
    biometricPrompts: [] as string[],
    ghAdds: [] as { publicKey: string; title: string; keyType: string }[],
  };
  const fx: PublishEffects = {
    biometricAuth: async (prompt) => {
      calls.biometricPrompts.push(prompt);
      return opts.biometric;
    },
    exists: () => opts.keyExists ?? true,
    readText: () => opts.keyText ?? PUB + "\n",
    ghAddKey: async ({ publicKey, title, keyType }) => {
      calls.ghAdds.push({ publicKey, title, keyType });
    },
  };
  return { fx, calls };
}

test("gated-success: biometric ok:true → ghAddKey IS called with the PUBLIC key + title", async () => {
  const { fx, calls } = fixtureEffects({ biometric: { ok: true, platform: "macos-touchid" } });
  const res = await publishKey(fx, { user: "aaron", repoRoot: "/repo", hostname: "mymac", keyPath: USER_KEY });
  expect(res.action).toBe("published");
  expect(calls.biometricPrompts).toHaveLength(1); // gate WAS invoked
  expect(calls.ghAdds).toHaveLength(1); // write happened
  expect(calls.ghAdds[0]?.publicKey).toContain("ssh-ed25519");
  expect(calls.ghAdds[0]?.title).toBe("aaron@mymac (zeta)");
  expect(calls.ghAdds[0]?.keyType).toBe("authentication");
});

test("FAIL-CLOSED: biometric ok:false → ghAddKey is NEVER called, publish aborts", async () => {
  const { fx, calls } = fixtureEffects({
    biometric: { ok: false, platform: "macos-touchid", reason: "declined" },
  });
  const res = await publishKey(fx, { user: "aaron", repoRoot: "/repo", hostname: "mymac", keyPath: USER_KEY });
  expect(res.action).toBe("aborted-biometric");
  expect(calls.biometricPrompts).toHaveLength(1); // gate WAS invoked first
  expect(calls.ghAdds).toHaveLength(0); // NO GitHub write on biometric failure
  expect(res.error).toContain("declined");
});

test("FAIL-CLOSED: unsupported platform (biometric ok:false) → no write", async () => {
  const { fx, calls } = fixtureEffects({
    biometric: { ok: false, platform: "unsupported", reason: "no biometric on this host" },
  });
  const res = await publishKey(fx, { user: "aaron", repoRoot: "/repo", keyPath: USER_KEY });
  expect(res.action).toBe("aborted-biometric");
  expect(calls.ghAdds).toHaveLength(0);
});

test("PUBLIC-ONLY: a private-key payload aborts BEFORE the biometric prompt + NO write", async () => {
  const { fx, calls } = fixtureEffects({
    keyText: PRIVATE_PEM,
    biometric: { ok: true, platform: "macos-touchid" }, // even with a passing gate…
  });
  const res = await publishKey(fx, { user: "aaron", repoRoot: "/repo", hostname: "mymac", keyPath: USER_KEY });
  expect(res.action).toBe("aborted-private-material");
  expect(calls.biometricPrompts).toHaveLength(0); // never even prompted
  expect(calls.ghAdds).toHaveLength(0); // never uploaded
});

test("the uploaded payload NEVER matches /PRIVATE KEY/ (public-only invariant)", async () => {
  const { fx, calls } = fixtureEffects({ biometric: { ok: true, platform: "macos-touchid" } });
  await publishKey(fx, { user: "aaron", repoRoot: "/repo", hostname: "mymac", keyPath: USER_KEY });
  expect(calls.ghAdds).toHaveLength(1);
  expect(calls.ghAdds[0]?.publicKey).not.toMatch(/PRIVATE KEY/);
});

test("aborted-no-key: missing pubkey → abort, no prompt, no write", async () => {
  const { fx, calls } = fixtureEffects({
    keyExists: false,
    biometric: { ok: true, platform: "macos-touchid" },
  });
  const res = await publishKey(fx, { user: "aaron", repoRoot: "/repo", hostname: "mymac", keyPath: USER_KEY });
  expect(res.action).toBe("aborted-no-key");
  expect(calls.biometricPrompts).toHaveLength(0);
  expect(calls.ghAdds).toHaveLength(0);
});

test("--dry-run: NO biometric prompt, NO GitHub write, reports would-publish", async () => {
  const { fx, calls } = fixtureEffects({ biometric: { ok: true, platform: "macos-touchid" } });
  const res = await publishKey(fx, { user: "aaron", repoRoot: "/repo", hostname: "mymac", dryRun: true, keyPath: USER_KEY });
  expect(res.action).toBe("would-publish");
  expect(calls.biometricPrompts).toHaveLength(0); // dry-run NEVER prompts
  expect(calls.ghAdds).toHaveLength(0); // dry-run NEVER writes
  expect(res.fingerprint).toBeDefined();
  expect(formatResult(res)).toContain("NO biometric prompt performed");
  expect(formatResult(res)).toContain("NO GitHub write performed");
});

test("signing key type flows through to ghAddKey", async () => {
  const { fx, calls } = fixtureEffects({ biometric: { ok: true, platform: "macos-touchid" } });
  const res = await publishKey(fx, {
    user: "aaron",
    repoRoot: "/repo",
    hostname: "mymac",
    keyType: "signing",
    keyPath: USER_KEY,
  });
  expect(res.action).toBe("published");
  expect(calls.ghAdds[0]?.keyType).toBe("signing");
});

test("REQUIRED keyPath: the explicit USER pubkey is read (no machine-key default, pure-key model)", async () => {
  const { fx, calls } = fixtureEffects({ biometric: { ok: true, platform: "macos-touchid" } });
  const res = await publishKey(fx, {
    user: "aaron",
    repoRoot: "/repo",
    hostname: "mymac",
    keyPath: "/some/explicit/user.pub",
  });
  // The supplied keyPath is honored verbatim — never overridden by a machine-key convention.
  expect(res.keyPath).toBe("/some/explicit/user.pub");
  expect(res.keyPath).not.toContain("machines/"); // a machine key is not the publish target
  expect(res.action).toBe("published");
  expect(calls.ghAdds).toHaveLength(1);
});

test("looksPrivate: catches OpenSSH/PEM/PGP private headers, passes a public line", () => {
  expect(looksPrivate(PRIVATE_PEM)).toBe(true);
  expect(looksPrivate(`-----BEGIN RSA ${PK}-----\nx\n-----END RSA ${PK}-----`)).toBe(true);
  expect(looksPrivate(`-----BEGIN PGP ${PK} BLOCK-----\nx`)).toBe(true);
  expect(looksPrivate(PUB)).toBe(false);
});

test("publishTitle + fingerprint: stable, public-derived, recognizable", () => {
  expect(publishTitle("aaron", "MyMac.local")).toBe("aaron@mymac.local (zeta)");
  // fingerprint is deterministic over the public line + never leaks the key bytes verbatim
  const fp = publicKeyFingerprint(PUB);
  expect(fp).toMatch(/^key-[0-9a-f]{16}$/);
  expect(publicKeyFingerprint(PUB)).toBe(fp); // stable
  expect(fp).not.toContain("AAAAC3"); // not the key blob itself
});

test("detectBiometricPlatform: darwin→touchid, win32→hello, else→unsupported", () => {
  expect(detectBiometricPlatform("darwin")).toBe("macos-touchid");
  expect(detectBiometricPlatform("win32")).toBe("windows-hello");
  expect(detectBiometricPlatform("linux")).toBe("unsupported");
});

test("formatResult published readout: shows biometric → ✅ → published <fp> github:<user>", () => {
  const line = formatResult({
    dryRun: false,
    user: "aaron",
    hostname: "mymac",
    keyPath: "/repo/maintainers/aaron/machines/mymac.pub",
    keyType: "authentication",
    title: "aaron@mymac (zeta)",
    action: "published",
    fingerprint: "key-0123456789abcdef",
    biometric: { ok: true, platform: "macos-touchid" },
  });
  expect(line).toContain("biometric");
  expect(line).toContain("published");
  expect(line).toContain("github:aaron");
  expect(line).toContain("key-0123456789abcdef");
});
