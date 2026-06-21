// machine.ts conformance — the two-part (user × machine) presence check + the gated
// device-key generation. ALL tests run against a THROWAWAY temp dir via injected
// effects (or mktemp -d for the real-ssh-keygen path) — NEVER real ~/.ssh, NEVER real
// maintainer paths, NEVER committing a generated key. Conformance/structure only.
// Run: bun test machine.test.ts   (from tools/setup/persona-keys)
import { test, expect } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  checkPresence,
  ensureMachineKey,
  formatStatus,
  publishPubPath,
  sanitizeHostname,
  userKeyringPublicPath,
  type MachineEffects,
} from "./machine.ts";

// A fully in-memory-ish fake: deterministic fake key generation, real temp filesystem
// for the public-artifact writes. The fake NEVER shells out and NEVER touches secrets.
function fakeEffects(host: string, opts?: { genCount?: { n: number } }): MachineEffects {
  return {
    hostname: () => host,
    exists: (p) => existsSync(p),
    readText: (p) => readFileSync(p, "utf8"),
    writeText: (p, c) => writeFileSync(p, c),
    mkdirp: (p) => mkdirSync(p, { recursive: true }),
    genEd25519: (keyPath, comment) => {
      if (opts?.genCount) opts.genCount.n += 1;
      // Simulate ssh-keygen: write a (fake) private + public file locally.
      mkdirSync(keyPath.slice(0, keyPath.lastIndexOf("/")), { recursive: true });
      writeFileSync(keyPath, "FAKE-PRIVATE-DO-NOT-USE\n", { mode: 0o600 });
      const pub = `ssh-ed25519 AAAAFAKEPUBKEY ${comment}\n`;
      writeFileSync(keyPath + ".pub", pub);
      return pub;
    },
  };
}

test("status: both absent -> userKeyPresent=n, machine key present=n (READ-ONLY, generates nothing)", () => {
  const tmp = mkdtempSync(join(tmpdir(), "zeta-machine-"));
  try {
    const fx = fakeEffects("dev-box-1");
    const s = checkPresence(fx, { user: "tester", repoRoot: tmp, home: tmp });
    expect(s.userKeyPresent).toBe(false);
    expect(s.machineKeyPresentLocal).toBe(false);
    expect(s.machineKeyPublished).toBe(false);
    expect(formatStatus(s)).toContain("user=tester present=n");
    expect(formatStatus(s)).toContain("machine=dev-box-1 key present=n");
    // pure inspection: no files were created
    expect(existsSync(s.devicePrivatePath)).toBe(false);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("status: detects an existing user keyring + machine key independently (two-axis)", () => {
  const tmp = mkdtempSync(join(tmpdir(), "zeta-machine-"));
  try {
    // user key present, machine key NOT (the common 'new flasher box' case from the workitem)
    mkdirSync(join(tmp, "maintainers", "tester"), { recursive: true });
    writeFileSync(userKeyringPublicPath(tmp, "tester"), JSON.stringify({ user: "tester" }));
    const fx = fakeEffects("dev-box-2");
    const s = checkPresence(fx, { user: "tester", repoRoot: tmp, home: tmp });
    expect(s.userKeyPresent).toBe(true);
    expect(s.machineKeyPresentLocal).toBe(false); // independent: user set up, this machine not
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("--dry-run generates NOTHING and reports would-generate", () => {
  const tmp = mkdtempSync(join(tmpdir(), "zeta-machine-"));
  try {
    const genCount = { n: 0 };
    const fx = fakeEffects("dev-box-3", { genCount });
    const r = ensureMachineKey(fx, { user: "tester", repoRoot: tmp, home: tmp, dryRun: true, publish: true });
    expect(r.dryRun).toBe(true);
    expect(r.action).toBe("would-generate");
    expect(r.published).toBe(false);
    expect(genCount.n).toBe(0); // nothing generated
    expect(existsSync(r.devicePrivatePath)).toBe(false); // nothing written
    expect(existsSync(r.devicePublicPath)).toBe(false);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("machine: generates a device key (fake) and publishes ONLY the public half; private never published", () => {
  const tmp = mkdtempSync(join(tmpdir(), "zeta-machine-"));
  try {
    const fx = fakeEffects("dev-box-4");
    const r = ensureMachineKey(fx, { user: "tester", repoRoot: tmp, home: tmp, publish: true });
    expect(r.action).toBe("generated");
    expect(r.published).toBe(true);
    // the PUBLISH path holds ONLY the public key — no private bytes anywhere in it
    const publishedPath = publishPubPath(tmp, "tester", "dev-box-4");
    expect(existsSync(publishedPath)).toBe(true);
    const published = readFileSync(publishedPath, "utf8");
    expect(published).toContain("ssh-ed25519");
    expect(published).not.toContain("PRIVATE");
    expect(published).not.toMatch(/BEGIN .*PRIVATE KEY/);
    // the private key file stays at the LOCAL path, NOT under maintainers/
    expect(r.devicePrivatePath.includes("maintainers")).toBe(false);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("machine: idempotent — a second run is a no-op ('exists'), does not regenerate", () => {
  const tmp = mkdtempSync(join(tmpdir(), "zeta-machine-"));
  try {
    const genCount = { n: 0 };
    const fx = fakeEffects("dev-box-5", { genCount });
    const first = ensureMachineKey(fx, { user: "tester", repoRoot: tmp, home: tmp });
    expect(first.action).toBe("generated");
    expect(genCount.n).toBe(1);
    const second = ensureMachineKey(fx, { user: "tester", repoRoot: tmp, home: tmp });
    expect(second.action).toBe("exists"); // idempotent: apply-N == apply-once effect
    expect(genCount.n).toBe(1); // NOT regenerated
    expect(second.publicKey).toBe(first.publicKey); // same public key returned
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("sanitizeHostname: filesystem-safe, ordinal-stable, never empty", () => {
  expect(sanitizeHostname("Dev Box!.local")).toBe("dev-box-.local");
  expect(sanitizeHostname("  ")).toBe("unknown-host");
  expect(sanitizeHostname("aaron-MBP")).toBe("aaron-mbp");
});

// REAL ssh-keygen, but ONLY into a throwaway temp dir (never ~/.ssh, never committed).
// Proves the production seam actually produces a valid ed25519 pubkey and that the
// private key never leaves the local temp path. Skips cleanly if ssh-keygen absent.
test("real ssh-keygen into a temp dir produces a valid ed25519 pubkey, private stays local", async () => {
  const probe = spawnSync("ssh-keygen", ["-A", "-?"], { encoding: "utf8" });
  const haveSshKeygen = probe.error === undefined;
  if (!haveSshKeygen) {
    return; // environment without ssh-keygen — conformance covered by the fake-effects tests
  }
  const tmp = mkdtempSync(join(tmpdir(), "zeta-machine-real-"));
  try {
    const { realEffects, ensureMachineKey: ensure, deviceKeyPath } = await import("./machine.ts");
    const fx = realEffects();
    // pin HOME to the temp dir so the REAL device path resolves inside temp, never ~/.ssh
    const r = ensure(fx, { user: "tester", repoRoot: tmp, home: tmp, publish: true });
    expect(r.action).toBe("generated");
    const priv = deviceKeyPath(tmp);
    expect(priv.startsWith(tmp)).toBe(true); // private key is inside the temp dir
    expect(existsSync(priv)).toBe(true);
    expect(existsSync(priv + ".pub")).toBe(true);
    // private key is not group/other readable (umask 077 honored by ssh-keygen)
    const mode = statSync(priv).mode & 0o077;
    expect(mode).toBe(0);
    // published artifact is the PUBLIC key only
    const published = readFileSync(publishPubPath(tmp, "tester", fx.hostname()), "utf8");
    expect(published).toContain("ssh-ed25519");
    expect(published).not.toMatch(/PRIVATE/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
