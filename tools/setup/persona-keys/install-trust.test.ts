// install-trust.ts conformance — the GitHub TEMP-TRUST-ROOT installer MECHANISM. EVERY
// test runs against FIXTURE TrustResolution values + temp dirs — NEVER live network,
// NEVER a real operator-ssh-keys write, NEVER a secret. Proves: the render is pure +
// deterministic, each entry is annotated by source, the TEMP-TRUST-ROOT banner is present,
// the rendered output is PUBLIC-ONLY (no private material), --dry-run/render-only writes
// nothing, and the gated --write goes ONLY through the injected effects door (temp dir),
// refusing to clobber without force.
// Run: bun test install-trust.test.ts   (from tools/setup/persona-keys)
import { test, expect } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TEMP_TRUST_ROOT_BANNER, type TrustResolution } from "./github-trust.ts";
import {
  defaultOperatorKeysTxtPath,
  installTrust,
  isPublicOnly,
  renderOperatorSshKeys,
  type InstallTrustEffects,
} from "./install-trust.ts";

const ED = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDwJVbQNiFzUCiOhc aaron@lucent.financial";
const RSA = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQ octocat@github";

/** Build a fixture TrustResolution (as the resolver would PRODUCE) without any network. */
function fixtureResolution(entries: readonly { source: string; key: string }[]): TrustResolution {
  return {
    dryRun: false,
    includeGpg: false,
    identities: [...new Set(entries.map((e) => e.source))],
    perIdentity: [],
    trustSet: entries.map((e) => ({ source: e.source, key: e.key, algo: e.key.split(/\s+/, 1)[0] ?? "" })),
    gpgBlocks: [],
  };
}

/** A FIXTURE effects door: records writes in-memory; only touches the real FS through the
 *  temp paths the test passes. fetchCount-style assertion is unnecessary (no fetch door). */
function recordingEffects(opts?: { existingPaths?: readonly string[] }): {
  fx: InstallTrustEffects;
  writes: { path: string; contents: string }[];
} {
  const writes: { path: string; contents: string }[] = [];
  const existing = new Set(opts?.existingPaths ?? []);
  const fx: InstallTrustEffects = {
    writeText: (path, contents) => {
      writes.push({ path, contents });
      existing.add(path);
    },
    exists: (path) => existing.has(path),
  };
  return { fx, writes };
}

test("renderOperatorSshKeys: txt form annotates each key by source + carries the TEMP banner", () => {
  const res = fixtureResolution([
    { source: "aaron", key: ED },
    { source: "octocat", key: RSA },
  ]);
  const out = renderOperatorSshKeys(res);
  expect(out).toContain(TEMP_TRUST_ROOT_BANNER);
  expect(out).toContain("generated from the GitHub temp-trust-root resolver");
  expect(out).toContain("TEMP until Vault/cert-manager + Headscale");
  expect(out).toContain("# source: gh:aaron");
  expect(out).toContain("# source: gh:octocat");
  expect(out).toContain(ED);
  expect(out).toContain(RSA);
  // each pubkey line follows its source comment
  const lines = out.split("\n");
  const aaronIdx = lines.indexOf("# source: gh:aaron");
  expect(lines[aaronIdx + 1]).toBe(ED);
});

test("renderOperatorSshKeys: deterministic — same input renders byte-identical output", () => {
  const res = fixtureResolution([{ source: "aaron", key: ED }]);
  expect(renderOperatorSshKeys(res)).toBe(renderOperatorSshKeys(res));
});

test("renderOperatorSshKeys: nix-array form emits the authorizedKeys.keys array", () => {
  const res = fixtureResolution([{ source: "aaron", key: ED }]);
  const out = renderOperatorSshKeys(res, { format: "nix-array" });
  expect(out).toContain("users.users.zeta.openssh.authorizedKeys.keys = [");
  expect(out).toContain("# source: gh:aaron");
  expect(out).toContain(`"${ED}"`);
  expect(out).toContain("];");
});

test("renderOperatorSshKeys: empty trust set still renders a valid banner-only file", () => {
  const res = fixtureResolution([]);
  const out = renderOperatorSshKeys(res);
  expect(out).toContain(TEMP_TRUST_ROOT_BANNER);
  expect(out).toContain("(none)");
  expect(isPublicOnly(out)).toBe(true);
});

test("rendered output is PUBLIC-ONLY — never contains private-key material", () => {
  const res = fixtureResolution([
    { source: "aaron", key: ED },
    { source: "octocat", key: RSA },
  ]);
  const out = renderOperatorSshKeys(res);
  // Assemble the forbidden marker at runtime — no contiguous private-key literal in source.
  const marker = "BEGIN OPENSSH " + "PRIVATE" + " KEY";
  expect(out).not.toContain(marker);
  expect(out).not.toContain("PRIVATE" + " KEY");
  expect(isPublicOnly(out)).toBe(true);
});

test("isPublicOnly: refuses text that carries private-key material", () => {
  const tainted = "ssh-ed25519 AAAA ok\n-----" + "BEGIN " + "PRIVATE" + " KEY" + "-----\n";
  expect(isPublicOnly(tainted)).toBe(false);
});

test("installTrust: default (write OFF) renders but writes NOTHING through the door", () => {
  const res = fixtureResolution([{ source: "aaron", key: ED }]);
  const { fx, writes } = recordingEffects();
  const result = installTrust(fx, res, { targetPath: "/tmp/should-not-be-written.txt" });
  expect(result.wrote).toBe(false);
  expect(result.refusedReason).toContain("write not requested");
  expect(writes.length).toBe(0);
});

test("installTrust: gated --write goes ONLY through the injected door (recorded, no real FS)", () => {
  const res = fixtureResolution([{ source: "aaron", key: ED }]);
  const { fx, writes } = recordingEffects();
  const target = "/tmp/install-trust-record-only.txt";
  const result = installTrust(fx, res, { targetPath: target, write: true });
  expect(result.wrote).toBe(true);
  expect(writes.length).toBe(1);
  expect(writes[0]?.path).toBe(target);
  expect(writes[0]?.contents).toContain(ED);
  expect(writes[0]?.contents).toContain(TEMP_TRUST_ROOT_BANNER);
  // and the recorded write performed NO real filesystem mutation
  expect(existsSync(target)).toBe(false);
});

test("installTrust: refuses to clobber an existing target without force", () => {
  const res = fixtureResolution([{ source: "aaron", key: ED }]);
  const target = "/tmp/already-here.txt";
  const { fx, writes } = recordingEffects({ existingPaths: [target] });
  const refused = installTrust(fx, res, { targetPath: target, write: true });
  expect(refused.wrote).toBe(false);
  expect(refused.refusedReason).toContain("target exists");
  expect(writes.length).toBe(0);
  // with force it overwrites
  const forced = installTrust(fx, res, { targetPath: target, write: true, force: true });
  expect(forced.wrote).toBe(true);
  expect(writes.length).toBe(1);
});

test("installTrust: REAL write only touches a temp dir (hermetic, never operator-ssh-keys)", () => {
  const dir = mkdtempSync(join(tmpdir(), "install-trust-"));
  try {
    const target = join(dir, "operator-ssh-keys.txt");
    const res = fixtureResolution([{ source: "aaron", key: ED }]);
    // real effects-shaped door, scoped to the temp dir
    const fx: InstallTrustEffects = {
      writeText: (p, c) => writeFileSync(p, c, "utf8"),
      exists: (p) => existsSync(p),
    };
    const result = installTrust(fx, res, { targetPath: target, write: true });
    expect(result.wrote).toBe(true);
    const written = readFileSync(target, "utf8");
    expect(written).toContain(ED);
    expect(written).toContain("# source: gh:aaron");
    expect(isPublicOnly(written)).toBe(true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("defaultOperatorKeysTxtPath: points at the node-config operator-ssh-keys.txt", () => {
  const p = defaultOperatorKeysTxtPath("/repo");
  expect(p).toBe("/repo/full-ai-cluster/nixos/modules/operator-ssh-keys.txt");
});
