// openssh-cert.ts — PROTOCOL.certkeys encoder (081KWPHRNE).
// Run: bun test openssh-cert.test.ts
import { test, expect } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { frostKeygen, frostThresholdSign, frostVerify } from "./frost.ts";
import {
  buildEd25519UserCertSignable,
  finalizeEd25519UserCert,
  formatSshEd25519CertLine,
  formatSshEd25519PublicKeyLine,
  parseSshEd25519PublicKeyLine,
  parseValidityWindow,
  SSH_ED25519_CERT_TYPE,
} from "./openssh-cert.ts";

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

test("parseValidityWindow +52w", () => {
  const w = parseValidityWindow("+52w", 1_700_000_000);
  expect(w.validAfter).toBe(1_700_000_000);
  expect(w.validBefore - w.validAfter).toBe(52 * 7 * 24 * 3600);
});

test("round-trip ssh-ed25519 public key line", () => {
  const kg = frostKeygen(2, 2, lcg(1));
  const line = formatSshEd25519PublicKeyLine(kg.groupPublicKey, "ca");
  const pk = parseSshEd25519PublicKeyLine(line);
  expect(pk).toEqual(kg.groupPublicKey);
});

test("frost-signed OpenSSH user cert is accepted by ssh-keygen -L", () => {
  const dir = mkdtempSync(join(tmpdir(), "zeta-openssh-cert-"));
  try {
    const deviceKey = join(dir, "device");
    const gen = spawnSync("ssh-keygen", ["-t", "ed25519", "-f", deviceKey, "-N", "", "-C", "device"], {
      encoding: "utf8",
    });
    expect(gen.status).toBe(0);
    const devicePubLine = readFileSync(deviceKey + ".pub", "utf8").trim();
    const devicePk = parseSshEd25519PublicKeyLine(devicePubLine);

    const kg = frostKeygen(2, 3, lcg(42));
    const { signable } = buildEd25519UserCertSignable({
      devicePublicKey: devicePk,
      caPublicKey: kg.groupPublicKey,
      keyId: "testhost",
      principals: ["alice", "bob"],
      validAfter: 1_700_000_000,
      validBefore: 1_700_000_000 + 3600,
      nonce: new Uint8Array(32).fill(7),
    });
    const sig = frostThresholdSign(
      kg.groupPublicKey,
      [kg.shares[0]!, kg.shares[1]!],
      signable,
      lcg(9),
      2,
    );
    expect(frostVerify(kg.groupPublicKey, signable, sig)).toBe(true);
    const certBlob = finalizeEd25519UserCert(signable, sig);
    const certLine = formatSshEd25519CertLine(certBlob, "testhost");
    expect(certLine.startsWith(SSH_ED25519_CERT_TYPE)).toBe(true);

    const certPath = join(dir, "device-cert.pub");
    writeFileSync(certPath, certLine);
    const listed = spawnSync("ssh-keygen", ["-L", "-f", certPath], { encoding: "utf8" });
    expect(listed.status).toBe(0);
    expect(listed.stdout).toContain("alice");
    expect(listed.stdout).toContain("bob");
    expect(listed.stdout).toContain("testhost");
    expect(listed.stdout.toLowerCase()).toContain("ed25519");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
