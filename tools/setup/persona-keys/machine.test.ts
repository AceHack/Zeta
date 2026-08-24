// machine.ts conformance — the two-part (user × machine) presence check + the gated PURE
// machine-key generation. ALL tests run against a THROWAWAY temp dir via injected effects
// (or mktemp -d for the real-ssh-keygen path) — NEVER real ~/.ssh, NEVER real maintainer
// paths, NEVER committing a generated key. Conformance/structure only.
//
// PURE-KEY MODEL (Aaron 2026-06-21): a machine key is a HOST identity, USER-INDEPENDENT. These
// tests assert the key LABEL has NO `user@` (machine-only), the public key registers in the
// user-independent `machines/<host>.pub` (NOT under maintainers/<user>/), and the (user ×
// machine) pairing is NOT present in this module (it lives ONLY in the CA cert — see ca.test.ts
// / onboard.test.ts). Fail-closed biometric tests preserved.
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
  machineKeyLabel,
  machinePubPath,
  sanitizeHostname,
  userKeyringPublicPath,
  type MachineEffects,
} from "./machine.ts";
import type { BiometricAuth, BiometricResult } from "./biometric.ts";

// A FAKE biometric door (no real Touch ID / Hello). `ok` controls approval; a `calls` array
// records every prompt so a test can assert the gate WAS invoked + fail-closed semantics.
function fakeBiometric(ok: boolean, calls?: string[]): BiometricAuth {
  return async (prompt: string): Promise<BiometricResult> => {
    if (calls) calls.push(prompt);
    return ok
      ? { ok: true, platform: "macos-touchid" }
      : { ok: false, platform: "macos-touchid", reason: "declined" };
  };
}
// A passing approval, the default for the happy-path tests below.
const APPROVE = fakeBiometric(true);

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

test("--dry-run generates NOTHING and reports would-generate (and never prompts)", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "zeta-machine-"));
  try {
    const genCount = { n: 0 };
    const prompts: string[] = [];
    const fx = fakeEffects("dev-box-3", { genCount });
    const r = await ensureMachineKey(fx, {
      repoRoot: tmp,
      home: tmp,
      dryRun: true,
      publish: true,
      biometricAuth: fakeBiometric(true, prompts),
    });
    expect(r.dryRun).toBe(true);
    expect(r.action).toBe("would-generate");
    expect(r.published).toBe(false);
    expect(r.keyLabel).toBe("dev-box-3 (zeta-machine)"); // PURE label — no user@
    expect(genCount.n).toBe(0); // nothing generated
    expect(prompts).toHaveLength(0); // dry-run NEVER prompts
    expect(existsSync(r.devicePrivatePath)).toBe(false); // nothing written
    expect(existsSync(r.devicePublicPath)).toBe(false);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("PURE LABEL: machine key comment is the MACHINE only — NO user@ anywhere", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "zeta-machine-"));
  try {
    const fx = fakeEffects("studio-7");
    // An `owner` is supplied — it must be attribution metadata ONLY, never in the key label.
    const r = await ensureMachineKey(fx, { repoRoot: tmp, home: tmp, owner: "tester", publish: true, biometricAuth: APPROVE });
    expect(r.action).toBe("generated");
    expect(r.keyLabel).toBe("studio-7 (zeta-machine)");
    expect(r.keyLabel).not.toContain("@"); // NO user@ in the label
    expect(r.keyLabel).not.toContain("tester"); // the owner NEVER leaks into the label
    // The published pubkey comment carries the same pure label (the fake echoes the comment).
    const published = readFileSync(r.devicePublicPath, "utf8");
    expect(published).toContain("(zeta-machine)");
    // ARITY. `not.toContain("tester@")` searches for ONE spelling of an owner leak; the claim
    // beside it is that the owner never enters the registered key at all. The equality below is
    // the claim: the registered artifact is byte-identical to the public half, so no rendering
    // of the owner -- or of anything else -- can be in it.
    expect(published).not.toContain("tester@"); // no user@host hybrid in the registered key
    expect(published.trim()).toBe(readFileSync(r.devicePrivatePath + ".pub", "utf8").trim());
    // machineKeyLabel is the single source of the label shape.
    expect(machineKeyLabel("studio-7")).toBe("studio-7 (zeta-machine)");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("USER-INDEPENDENT REGISTRY: public key registers under machines/<host>.pub, NOT maintainers/<user>/", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "zeta-machine-"));
  try {
    const fx = fakeEffects("dev-box-4");
    const r = await ensureMachineKey(fx, { repoRoot: tmp, home: tmp, owner: "tester", publish: true, biometricAuth: APPROVE });
    expect(r.action).toBe("generated");
    expect(r.published).toBe(true);
    // the registry path is user-independent: machines/<host>.pub (NOT under maintainers/)
    const registryPath = machinePubPath(tmp, "dev-box-4");
    expect(registryPath).toBe(join(tmp, "machines", "dev-box-4.pub"));
    expect(r.devicePublicPath).toBe(registryPath);
    expect(r.devicePublicPath.includes("maintainers")).toBe(false); // SHARED, not per-user
    expect(existsSync(registryPath)).toBe(true);
    // the registry holds ONLY the public key — no private bytes anywhere in it
    const published = readFileSync(registryPath, "utf8");
    expect(published).toContain("ssh-ed25519");
    // ARITY. The two lines below witness ONE RENDERING of a leak, not the absence of one:
    // a claim of "no private bytes anywhere in it" discharged by searching for the ASCII
    // token `PRIVATE`. The whole private key, base64-encoded, carries no such token and
    // passes both -- measured, not supposed (see the sabotage note on the equality below).
    // They are kept because they are cheap and they do constrain the armored rendering.
    expect(published).not.toContain("PRIVATE");
    // The marker is assembled at runtime so NO key-shaped header literal appears in this file.
    expect(published).not.toMatch(new RegExp("BEGIN .*" + "PRIVATE" + " " + "KEY"));
    // ...and THIS is the check that carries the claim. The registered artifact must be
    // BYTE-IDENTICAL to the public half the generator produced -- so no extra byte, in any
    // encoding, can ride along. An absence search enumerates leak shapes and always misses
    // one; equality against the intended artifact admits none.
    expect(published.trim()).toBe(readFileSync(r.devicePrivatePath + ".pub", "utf8").trim());
    // the private key file stays at the LOCAL path, NOT under maintainers/ or machines/
    expect(r.devicePrivatePath.includes("maintainers")).toBe(false);
    expect(r.devicePrivatePath.includes("/machines/")).toBe(false);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("machine: idempotent — a second run is a no-op ('exists'), does not regenerate", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "zeta-machine-"));
  try {
    const genCount = { n: 0 };
    const secondPrompts: string[] = [];
    const fx = fakeEffects("dev-box-5", { genCount });
    const first = await ensureMachineKey(fx, { repoRoot: tmp, home: tmp, biometricAuth: APPROVE });
    expect(first.action).toBe("generated");
    expect(genCount.n).toBe(1);
    const second = await ensureMachineKey(fx, {
      repoRoot: tmp,
      home: tmp,
      biometricAuth: fakeBiometric(true, secondPrompts),
    });
    expect(second.action).toBe("exists"); // idempotent: apply-N == apply-once effect
    expect(genCount.n).toBe(1); // NOT regenerated
    expect(secondPrompts).toHaveLength(0); // the idempotent no-op does NOT prompt (no keygen)
    expect(second.publicKey).toBe(first.publicKey); // same public key returned
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("FAIL-CLOSED: biometric declined -> genEd25519 NEVER called, NO key, aborted-biometric", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "zeta-machine-"));
  try {
    const genCount = { n: 0 };
    const prompts: string[] = [];
    const fx = fakeEffects("dev-box-deny", { genCount });
    const r = await ensureMachineKey(fx, {
      repoRoot: tmp,
      home: tmp,
      publish: true,
      biometricAuth: fakeBiometric(false, prompts),
    });
    expect(r.action).toBe("aborted-biometric");
    expect(prompts).toHaveLength(1); // the gate WAS invoked
    expect(genCount.n).toBe(0); // the keygen door was NEVER called
    expect(r.published).toBe(false);
    expect(existsSync(r.devicePrivatePath)).toBe(false); // nothing written
    expect(existsSync(r.devicePublicPath)).toBe(false); // no public artifact either
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("FAIL-CLOSED: NO biometric door provided -> keygen NEVER runs (default fail-closed)", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "zeta-machine-"));
  try {
    const genCount = { n: 0 };
    const fx = fakeEffects("dev-box-nodoor", { genCount });
    // No biometricAuth wired at all — requireBiometric returns ok:false (fail-closed).
    const r = await ensureMachineKey(fx, { repoRoot: tmp, home: tmp });
    expect(r.action).toBe("aborted-biometric");
    expect(genCount.n).toBe(0); // never generated without an approval door
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
    // pin HOME to the temp dir so the REAL device path resolves inside temp, never ~/.ssh.
    // A FAKE biometric (approve) so this test never needs a real Touch ID prompt — the gate
    // is exercised against the fake; the keygen itself is the real ssh-keygen.
    const r = await ensure(fx, { repoRoot: tmp, home: tmp, publish: true, biometricAuth: APPROVE });
    expect(r.action).toBe("generated");
    const priv = deviceKeyPath(tmp);
    expect(priv.startsWith(tmp)).toBe(true); // private key is inside the temp dir
    expect(existsSync(priv)).toBe(true);
    expect(existsSync(priv + ".pub")).toBe(true);
    // private key is not group/other readable (umask 077 honored by ssh-keygen)
    const mode = statSync(priv).mode & 0o077;
    expect(mode).toBe(0);
    // registered artifact is the PUBLIC key only, at the user-independent machines/<host>.pub
    const published = readFileSync(machinePubPath(tmp, fx.hostname()), "utf8");
    expect(published).toContain("ssh-ed25519");
    // ARITY (same class as above, and here the key is a REAL one). `/PRIVATE/` matches the
    // PEM armor only. Strip the armor -- the base64 body ALONE is the entire private key --
    // and this line passes while the secret is published in full.
    expect(published).not.toMatch(/PRIVATE/);
    // The claim is "the registered artifact is the PUBLIC key only". That is an equality,
    // and stating it as one is what makes it unfalsifiable-proof: byte-identical to the
    // `.pub` file ssh-keygen itself wrote, so nothing else can be in the file.
    expect(published.trim()).toBe(readFileSync(priv + ".pub", "utf8").trim());
    // the REAL ssh-keygen comment is the PURE machine label — no user@ in the registered key
    expect(published).toContain("(zeta-machine)");
    expect(published).not.toMatch(/\S+@\S+\s+\(zeta-/); // no `user@host (zeta-...)` hybrid
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
