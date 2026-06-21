// setup-cluster.ts conformance — the ONE-command, ONE-fingerprint cluster trust-root setup +
// cross-cluster trust. EVERY test uses FIXTURES — NEVER a real biometric prompt, NEVER real
// keygen, NEVER a real CA/cert, NEVER a secret. Proves:
//   * one-fingerprint: the HUMAN biometric door fires EXACTLY ONCE to generate the CA;
//   * FAIL-CLOSED: a declined approval generates NO CA (and the human is prompted once);
//   * CROSS-CLUSTER TRUST: --trust-peer adds a peer CA PUBLIC key to the rendered multi-CA
//     TrustedUserCAKeys set; a PRIVATE-looking or non-pubkey peer input is REJECTED;
//   * --dry-run is inert: NO prompt, NO keygen, NO CA write.
// Run: bun test setup-cluster.test.ts   (from tools/setup/persona-keys)
import { test, expect } from "bun:test";
import type { CaEffects } from "./ca.ts";
import { sessionBiometric, type BiometricAuth } from "./biometric.ts";
import {
  setupCluster,
  renderTrustSet,
  looksLikePublicKey,
  looksLikePrivateKey,
  formatSetupCluster,
  type SetupClusterOptions,
} from "./setup-cluster.ts";

const SELF_CA = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAASELF self-ca";
const PEER_CA = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAPEER peer-ca";

function countingDoor(ok: boolean): { door: BiometricAuth; prompts: () => string[] } {
  const prompts: string[] = [];
  const door: BiometricAuth = async (prompt: string) => {
    prompts.push(prompt);
    return ok ? { ok: true, platform: "macos-touchid" } : { ok: false, platform: "macos-touchid", reason: "declined" };
  };
  return { door, prompts: () => prompts };
}

/** A CA effects fixture — counts genCa; returns the self CA pubkey. No real keygen. */
function caFixture(opts: { exists?: boolean } = {}): { fx: CaEffects; genCalls: () => number; writes: () => string[] } {
  let genCalls = 0;
  const writes: string[] = [];
  const fx: CaEffects = {
    exists: () => opts.exists === true,
    readText: () => SELF_CA + "\n",
    writeText: (p) => {
      writes.push(p);
    },
    mkdirp: () => {},
    genCa: () => {
      genCalls += 1;
      return SELF_CA + "\n";
    },
    signCert: () => ({ certPath: "/x-cert.pub", certText: "cert" }),
  };
  return { fx, genCalls: () => genCalls, writes: () => writes };
}

const baseOpts = (over: Partial<SetupClusterOptions> = {}): SetupClusterOptions => ({
  ca: "acme",
  repoRoot: "/repo",
  home: "/home/aaron",
  ...over,
});

test("one fingerprint: the HUMAN door fires EXACTLY ONCE to generate the CA", async () => {
  const { door, prompts } = countingDoor(true);
  const session = sessionBiometric(door);
  const f = caFixture({ exists: false });

  const res = await setupCluster(f.fx, session, baseOpts());

  expect(prompts().length).toBe(1);
  expect(res.biometricApprovals).toBe(1);
  expect(res.caResult.action).toBe("generated");
  expect(f.genCalls()).toBe(1);
  // Self CA is the first (and only) line of the rendered trust set.
  expect(res.rendered.lines.length).toBe(1);
  expect(res.rendered.lines[0]?.source).toBe("self");
});

test("FAIL-CLOSED: a DECLINED approval generates NO CA, prompted once", async () => {
  const { door, prompts } = countingDoor(false);
  const session = sessionBiometric(door);
  const f = caFixture({ exists: false });

  const res = await setupCluster(f.fx, session, baseOpts());

  expect(prompts().length).toBe(1);
  expect(res.caResult.action).toBe("aborted-biometric");
  expect(f.genCalls()).toBe(0);
});

test("cross-cluster trust: --trust-peer adds a peer CA pubkey to the multi-CA trust set", async () => {
  const { door } = countingDoor(true);
  const session = sessionBiometric(door);
  const f = caFixture({ exists: false });

  const res = await setupCluster(
    f.fx,
    session,
    baseOpts({ peers: [{ name: "peer-east", publicKey: PEER_CA }] }),
  );

  expect(res.rendered.lines.length).toBe(2);
  expect(res.rendered.lines.map((l) => l.source)).toEqual(["self", "peer-east"]);
  // The rendered file carries BOTH CA public keys (sshd trusts a cert from either) — federation.
  expect(res.rendered.trustedUserCaKeysFile).toContain(SELF_CA);
  expect(res.rendered.trustedUserCaKeysFile).toContain(PEER_CA);
  // Still ONE approval — the peer add is pure rendering, no extra gate.
  expect(res.biometricApprovals).toBe(1);
});

test("renderTrustSet REJECTS a PRIVATE-looking peer input (PUBLIC-only trust set)", () => {
  const privText = "-----BEGIN OPENSSH " + "PRIVATE" + " " + "KEY-----\nabc\n-----END-----";
  expect(() => renderTrustSet("/repo", "acme", SELF_CA, [{ name: "bad", publicKey: privText }])).toThrow(
    /PRIVATE/,
  );
});

test("renderTrustSet REJECTS a non-pubkey peer input", () => {
  expect(() => renderTrustSet("/repo", "acme", SELF_CA, [{ name: "bad", publicKey: "not a key" }])).toThrow(
    /SSH PUBLIC key/,
  );
});

test("looksLikePublicKey / looksLikePrivateKey classify correctly", () => {
  expect(looksLikePublicKey(SELF_CA)).toBe(true);
  expect(looksLikePublicKey("ssh-rsa AAAAB3 foo")).toBe(true);
  expect(looksLikePublicKey("garbage")).toBe(false);
  expect(looksLikePrivateKey("-----BEGIN RSA " + "PRIVATE" + " " + "KEY-----")).toBe(true);
  expect(looksLikePrivateKey(SELF_CA)).toBe(false);
});

test("--dry-run is inert: NO prompt, NO keygen, NO CA write", async () => {
  const { door, prompts } = countingDoor(true);
  const session = sessionBiometric(door);
  const f = caFixture({ exists: false });

  const res = await setupCluster(f.fx, session, baseOpts({ dryRun: true, peers: [{ name: "peer", publicKey: PEER_CA }] }));

  expect(prompts().length).toBe(0);
  expect(res.biometricApprovals).toBe(0);
  expect(f.genCalls()).toBe(0);
  expect(f.writes().length).toBe(0);
  expect(res.caResult.action).toBe("would-generate");
  // The plan still renders the trust set (placeholder self CA + the peer) for legibility.
  expect(res.rendered.lines.length).toBe(2);
  expect(formatSetupCluster(res)).toContain("DRY RUN");
});
