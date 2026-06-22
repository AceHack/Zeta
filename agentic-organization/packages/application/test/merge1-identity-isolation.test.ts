import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  agentIdentityFromSpiffe,
  createMockSpiffeIdentityProvider,
  trustDomainOf,
  validateSpiffeIdentity,
  type SpiffeIdentity,
} from "../src/spiffe-identity.ts";
import {
  isAllowedEgress,
  isAllowedHttpEgress,
  isAllowedServiceAccount,
  type EgressPolicy,
} from "../src/egress-policy.ts";
import { createVaultCredentialProxy, type VaultResult } from "../src/vault-credential-proxy.ts";
import { buildBwrapArgs, createMockSandbox } from "../src/bwrap-sandbox.ts";
import {
  createCredentialBootstrap,
  encryptCredentials,
  type RestoredCredential,
  type ScryptParams,
} from "../src/credential-bootstrap.ts";

// --- §6.2 SPIFFE identity ---------------------------------------------------

const SAMPLE_SPIFFE: SpiffeIdentity = {
  spiffeId: "spiffe://zeta.local/agent/otto",
  trustDomain: "zeta.local",
  svid: { type: "jwt", token: "..." },
  expiresAt: "2099-12-31T23:59:59.000Z",
};

test("SPIFFE identity → AgentIdentity (last segment + full subject)", () => {
  const identity = agentIdentityFromSpiffe(SAMPLE_SPIFFE);
  equal(identity.agentId, "otto");
  equal(identity.subject, "spiffe://zeta.local/agent/otto");
});

test("trustDomainOf parses the trust domain", () => {
  equal(trustDomainOf("spiffe://zeta.local/agent/otto"), "zeta.local");
  equal(trustDomainOf("not-a-spiffe-id"), undefined);
});

test("mock SPIFFE provider is deterministic", async () => {
  const p = createMockSpiffeIdentityProvider();
  const a = await p.fetchIdentity("otto");
  const b = await p.fetchIdentity("otto");
  deepEqual(a, b);
  ok(a.outcome === "ok");
  equal(a.value.spiffeId, "spiffe://zeta.local/agent/otto");
});

test("mock SPIFFE provider flags an empty workload id", async () => {
  const p = createMockSpiffeIdentityProvider();
  const r = await p.fetchIdentity("");
  ok(r.outcome === "feedback");
  equal(r.error.kind, "workload_not_found");
});

test("validateSpiffeIdentity rejects trust-domain mismatch + expiry", () => {
  const mismatch = validateSpiffeIdentity(SAMPLE_SPIFFE, "other.local", "2026-01-01T00:00:00.000Z");
  ok(mismatch.outcome === "feedback" && mismatch.error.kind === "trust_domain_mismatch");
  const expired = validateSpiffeIdentity(
    { ...SAMPLE_SPIFFE, expiresAt: "2000-01-01T00:00:00.000Z" },
    "zeta.local",
    "2026-01-01T00:00:00.000Z",
  );
  ok(expired.outcome === "feedback" && expired.error.kind === "svid_expired");
  const valid = validateSpiffeIdentity(SAMPLE_SPIFFE, "zeta.local", "2026-01-01T00:00:00.000Z");
  equal(valid.outcome, "ok");
});

// --- §6.5 egress policy -----------------------------------------------------

test("egress policy blocks non-allowed hosts (L3/L4)", () => {
  const policy: EgressPolicy = { hosts: ["api.github.com"], requireMtls: true };
  ok(isAllowedEgress(policy, "api.github.com"));
  ok(!isAllowedEgress(policy, "evil.com"));
});

test("egress policy enforces L7 method/path rules", () => {
  const policy: EgressPolicy = {
    hosts: ["api.github.com"],
    requireMtls: true,
    httpRules: [{ host: "api.github.com", methods: ["GET"], paths: ["/repos/"] }],
  };
  ok(isAllowedHttpEgress(policy, "api.github.com", "GET", "/repos/x/y"));
  ok(!isAllowedHttpEgress(policy, "api.github.com", "POST", "/repos/x/y"));
  ok(!isAllowedHttpEgress(policy, "api.github.com", "GET", "/users/x"));
  ok(!isAllowedHttpEgress(policy, "evil.com", "GET", "/repos/x/y"));
});

test("egress policy gates SPIFFE service accounts", () => {
  const open: EgressPolicy = { hosts: [], requireMtls: false };
  ok(isAllowedServiceAccount(open, "spiffe://zeta.local/agent/x"));
  const scoped: EgressPolicy = {
    hosts: [],
    requireMtls: true,
    allowedServiceAccounts: ["spiffe://zeta.local/agent/x"],
  };
  ok(isAllowedServiceAccount(scoped, "spiffe://zeta.local/agent/x"));
  ok(!isAllowedServiceAccount(scoped, "spiffe://zeta.local/agent/y"));
});

// --- §6.3 Vault credential proxy -------------------------------------------

test("Vault credential proxy returns one grant per granted hat", async () => {
  const proxy = createVaultCredentialProxy("https://vault.vault.svc:8200", {
    fetchSvid: () => Promise.resolve({ type: "jwt", token: "test" }),
    requestSecret: (): Promise<VaultResult> =>
      Promise.resolve({ outcome: "ok", value: { leaseId: "l1", leaseDurationSeconds: 3600, data: { token: "s" } } }),
  });
  const grants = await proxy.grantsFor({ agentId: "otto", subject: "spiffe://zeta.local/otto" }, ["hat-1"]);
  equal(grants.length, 1);
  equal(grants[0]!.tool, "tool:hat-1");
  equal(grants[0]!.credentialScope, "vault:zeta/hats/hat-1/tool-grant");
});

test("Vault credential proxy skips denied secrets (Result, not throw)", async () => {
  const proxy = createVaultCredentialProxy("https://vault.vault.svc:8200", {
    fetchSvid: () => Promise.resolve({ type: "jwt", token: "test" }),
    requestSecret: (path): Promise<VaultResult> =>
      path.includes("hat-deny")
        ? Promise.resolve({ outcome: "feedback", error: { kind: "permission_denied", path } })
        : Promise.resolve({ outcome: "ok", value: { leaseId: "l", leaseDurationSeconds: 60, data: {} } }),
  });
  const grants = await proxy.grantsFor({ agentId: "o", subject: "spiffe://zeta.local/o" }, ["hat-deny", "hat-ok"]);
  equal(grants.length, 1);
  equal(grants[0]!.tool, "tool:hat-ok");
});

// --- §3.4 bwrap sandbox -----------------------------------------------------

test("buildBwrapArgs locks down the namespace", () => {
  const args = buildBwrapArgs(["echo", "hi"], {
    workspaceMount: "/ws",
    egress: { hosts: [], requireMtls: false },
    env: { FOO: "bar" },
    revokeOnExpiry: true,
  });
  ok(args.includes("--unshare-all"));
  ok(args.includes("--die-with-parent"));
  ok(!args.includes("--share-net")); // no egress hosts → network stays unshared
  const sep = args.indexOf("--");
  deepEqual(args.slice(sep + 1), ["echo", "hi"]);
});

test("buildBwrapArgs shares the network when egress is permitted", () => {
  const args = buildBwrapArgs(["curl", "x"], {
    workspaceMount: "/ws",
    egress: { hosts: ["api.github.com"], requireMtls: true },
    env: {},
    revokeOnExpiry: true,
  });
  ok(args.includes("--share-net"));
});

test("mock sandbox runs deterministically in-process", async () => {
  const sandbox = createMockSandbox({ stdout: "done", exitCode: 0 });
  const result = await sandbox.spawn(["echo", "hi"], {
    workspaceMount: "/ws",
    egress: { hosts: [], requireMtls: false },
    env: {},
    revokeOnExpiry: true,
  });
  ok(result.outcome === "ok");
  const out = await result.value.wait();
  equal(out.exitCode, 0);
  equal(out.stdout, "done");
  await result.value.kill();
});

// --- §6.4 credential bootstrap ---------------------------------------------

const TEST_SCRYPT: ScryptParams = { logN: 14, r: 8, p: 1 }; // fast params for tests
const TEST_CREDS: readonly RestoredCredential[] = [
  { name: "ssh-pubkey", path: "/etc/ssh/key.pub", contentClass: "public_identifier", value: "ssh-ed25519 AAAA" },
  { name: "wifi-psk", path: "/run/secrets/wifi", contentClass: "secret_material", value: "hunter2" },
];

test("credential bootstrap round-trips an encrypted blob", async () => {
  const blob = encryptCredentials(TEST_CREDS, "test-passphrase", TEST_SCRYPT);
  const bootstrap = createCredentialBootstrap();
  const result = await bootstrap.restore(blob, "test-passphrase");
  ok(result.outcome === "ok");
  deepEqual(result.value, TEST_CREDS);
});

test("credential bootstrap rejects an empty passphrase", async () => {
  const blob = encryptCredentials(TEST_CREDS, "test-passphrase", TEST_SCRYPT);
  const bootstrap = createCredentialBootstrap();
  const result = await bootstrap.restore(blob, "");
  ok(result.outcome === "feedback" && result.error.kind === "passphrase_required");
});

test("credential bootstrap fails on a wrong passphrase (auth-tag)", async () => {
  const blob = encryptCredentials(TEST_CREDS, "right", TEST_SCRYPT);
  const bootstrap = createCredentialBootstrap();
  const result = await bootstrap.restore(blob, "wrong");
  ok(result.outcome === "feedback" && result.error.kind === "decryption_failed");
});

test("credential bootstrap rejects a tampered blob", async () => {
  const blob = encryptCredentials(TEST_CREDS, "pp", TEST_SCRYPT);
  blob[blob.length - 1] = blob[blob.length - 1]! ^ 0xff;
  const bootstrap = createCredentialBootstrap();
  const result = await bootstrap.restore(blob, "pp");
  ok(result.outcome === "feedback" && result.error.kind === "decryption_failed");
});

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

test("encrypted blobs are non-deterministic (random salt+iv) but both decrypt", async () => {
  const a = encryptCredentials(TEST_CREDS, "pp", TEST_SCRYPT);
  const b = encryptCredentials(TEST_CREDS, "pp", TEST_SCRYPT);
  ok(!bytesEqual(a, b));
  const bootstrap = createCredentialBootstrap();
  const ra = await bootstrap.restore(a, "pp");
  const rb = await bootstrap.restore(b, "pp");
  ok(ra.outcome === "ok" && rb.outcome === "ok");
});
