// teardown.ts conformance — the DESTRUCTIVE inverse of setup (local private-key wipe + repo
// public-artifact unregister). ALL tests run against THROWAWAY temp dirs via injected effects +
// FAKE biometric/git doors — NEVER the real ~/.config/zeta, NEVER a real `git rm` on a real repo,
// NEVER a real key deleted, NEVER a network call. NO key-shaped literal appears in this file (the
// private-key header marker is SPLIT + assembled at runtime so a grep for it is EMPTY).
//
// Proves: dry-run wipes/rm NOTHING + never prompts; a confirmed run (fake fs + fake biometric ok)
// deletes the fake local dirs + stages the fake repo pubkey/cert removals + fires the human gate
// EXACTLY once; declined biometric => nothing deleted; a non-confirmed real run => nothing touched;
// idempotent re-run => clean no-op; no secret bytes echoed.
// Run: bun test teardown.test.ts   (from tools/setup/persona-keys)
import { test, expect } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ZETA_LOCAL_DIRS,
  caPublicRel,
  format1PasswordNote,
  formatTeardown,
  machineCertPath,
  teardown,
  zetaLocalDirPath,
  type TeardownEffects,
} from "./teardown.ts";
import { caPublicKeyPath } from "./ca.ts";
import { machinePubPath } from "./machine.ts";
import type { BiometricAuth, BiometricResult } from "./biometric.ts";

// The private-key marker, assembled at runtime so NO key-shaped literal is in this file.
const PRIV_MARKER = "PRIVATE" + " " + "KEY";

const CA = "tester";
const HOST = "test-host";

// A FAKE biometric door (no real Touch ID / Hello). `ok` controls approval; `calls` records every
// prompt so a test can assert the gate fired EXACTLY once + fail-closed semantics.
function fakeBiometric(ok: boolean, calls?: string[]): BiometricAuth {
  return async (prompt: string): Promise<BiometricResult> => {
    if (calls) calls.push(prompt);
    return ok
      ? { ok: true, platform: "macos-touchid" }
      : { ok: false, platform: "macos-touchid", reason: "declined" };
  };
}

// A deterministic fake effects over a REAL temp filesystem — but the "secure remove" + "git rm"
// doors are FAKE (a plain unlink / a recorded staging). Never shells out, never touches a secret.
function fakeEffects(opts?: {
  removed?: string[];
  gitRmStaged?: { repoRoot: string; relPath: string }[];
}): TeardownEffects {
  return {
    exists: (p) => existsSync(p),
    listFiles: (dir) => {
      if (!existsSync(dir)) return [];
      const out: string[] = [];
      // shallow is fine for the test fixtures (one level of files per dir)
      for (const name of readdirSync(dir)) {
        out.push(join(dir, name));
      }
      return out;
    },
    securelyRemove: (path) => {
      if (opts?.removed) opts.removed.push(path);
      if (existsSync(path)) rmSync(path, { force: true });
      return !existsSync(path);
    },
    removeDir: (dir) => {
      if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    },
    gitRm: (repoRoot, relPath) => {
      if (opts?.gitRmStaged) opts.gitRmStaged.push({ repoRoot, relPath });
      // Fake the staging: actually remove the file from the temp "repo" so re-run is idempotent.
      const full = join(repoRoot, relPath);
      if (existsSync(full)) rmSync(full, { force: true });
      return true;
    },
  };
}

// Build a populated fixture: a temp home with the four private dirs (each with a fake private file)
// and a temp repo with the three registered public artifacts.
function makeFixture(): { home: string; repoRoot: string; cleanup: () => void } {
  const home = mkdtempSync(join(tmpdir(), "zeta-td-home-"));
  const repoRoot = mkdtempSync(join(tmpdir(), "zeta-td-repo-"));
  for (const dir of ZETA_LOCAL_DIRS) {
    const d = zetaLocalDirPath(dir, home);
    mkdirSync(d, { recursive: true });
    // a fake PRIVATE file — content is a harmless placeholder, never a real key header
    writeFileSync(join(d, "secret.bin"), "FAKE-PRIVATE-PLACEHOLDER-DO-NOT-USE\n", { mode: 0o600 });
  }
  const caPub = caPublicKeyPath(repoRoot, CA);
  const mPub = machinePubPath(repoRoot, HOST);
  const mCert = machineCertPath(repoRoot, HOST);
  for (const p of [caPub, mPub, mCert]) {
    mkdirSync(p.slice(0, p.lastIndexOf("/")), { recursive: true });
    writeFileSync(p, "ssh-ed25519 AAAAFAKEPUBKEY placeholder\n");
  }
  return {
    home,
    repoRoot,
    cleanup: () => {
      rmSync(home, { recursive: true, force: true });
      rmSync(repoRoot, { recursive: true, force: true });
    },
  };
}

test("dry-run (default): wipes/rm NOTHING, never prompts, reports would-*", async () => {
  const { home, repoRoot, cleanup } = makeFixture();
  try {
    const removed: string[] = [];
    const gitRmStaged: { repoRoot: string; relPath: string }[] = [];
    const prompts: string[] = [];
    const fx = fakeEffects({ removed, gitRmStaged });
    const res = await teardown(fx, {
      ca: CA,
      repoRoot,
      home,
      hostname: HOST,
      dryRun: true,
      biometricAuth: fakeBiometric(true, prompts),
    });
    // Nothing destructive happened.
    expect(removed.length).toBe(0);
    expect(gitRmStaged.length).toBe(0);
    expect(prompts.length).toBe(0); // NEVER prompts on dry-run
    expect(res.dryRun).toBe(true);
    expect(res.hadWork).toBe(true);
    // Everything reported as would-*.
    expect(res.localWipe.every((l) => l.action === "would-wipe")).toBe(true);
    expect(res.repoUnregister.every((r) => r.action === "would-unregister")).toBe(true);
    // All the real files still exist.
    for (const dir of ZETA_LOCAL_DIRS) expect(existsSync(zetaLocalDirPath(dir, home))).toBe(true);
    expect(existsSync(caPublicKeyPath(repoRoot, CA))).toBe(true);
    expect(existsSync(machinePubPath(repoRoot, HOST))).toBe(true);
    expect(existsSync(machineCertPath(repoRoot, HOST))).toBe(true);
    // No biometric outcome recorded (gate never invoked).
    expect(res.biometric).toBeUndefined();
  } finally {
    cleanup();
  }
});

test("confirmed + biometric ok: wipes local dirs, stages all three repo removals, fires gate once", async () => {
  const { home, repoRoot, cleanup } = makeFixture();
  try {
    const removed: string[] = [];
    const gitRmStaged: { repoRoot: string; relPath: string }[] = [];
    const prompts: string[] = [];
    const fx = fakeEffects({ removed, gitRmStaged });
    const res = await teardown(fx, {
      ca: CA,
      repoRoot,
      home,
      hostname: HOST,
      dryRun: false,
      confirm: true,
      biometricAuth: fakeBiometric(true, prompts),
    });
    // The human gate fired EXACTLY once.
    expect(prompts.length).toBe(1);
    expect(res.biometric?.ok).toBe(true);
    // Every local private file was securely removed (4 dirs × 1 file).
    expect(removed.length).toBe(ZETA_LOCAL_DIRS.length);
    for (const dir of ZETA_LOCAL_DIRS) expect(existsSync(zetaLocalDirPath(dir, home))).toBe(false);
    // All three repo artifacts staged for removal + actually gone from the temp repo.
    expect(gitRmStaged.length).toBe(3);
    expect(res.unregisteredPaths.length).toBe(3);
    expect(existsSync(caPublicKeyPath(repoRoot, CA))).toBe(false);
    expect(existsSync(machinePubPath(repoRoot, HOST))).toBe(false);
    expect(existsSync(machineCertPath(repoRoot, HOST))).toBe(false);
    // Every staged git rm operated ONLY under the passed repoRoot (shared-checkout-is-view-only).
    expect(gitRmStaged.every((s) => s.repoRoot === repoRoot)).toBe(true);
    expect(res.localWipe.every((l) => l.action === "wiped")).toBe(true);
    expect(res.repoUnregister.every((r) => r.action === "unregistered")).toBe(true);
  } finally {
    cleanup();
  }
});

test("declined biometric: fail-closed — NOTHING deleted, NOTHING staged", async () => {
  const { home, repoRoot, cleanup } = makeFixture();
  try {
    const removed: string[] = [];
    const gitRmStaged: { repoRoot: string; relPath: string }[] = [];
    const prompts: string[] = [];
    const fx = fakeEffects({ removed, gitRmStaged });
    const res = await teardown(fx, {
      ca: CA,
      repoRoot,
      home,
      hostname: HOST,
      dryRun: false,
      confirm: true,
      biometricAuth: fakeBiometric(false, prompts), // DECLINED
    });
    expect(prompts.length).toBe(1); // it asked once
    expect(res.biometric?.ok).toBe(false);
    expect(removed.length).toBe(0);
    expect(gitRmStaged.length).toBe(0);
    expect(res.unregisteredPaths.length).toBe(0);
    // Everything still present.
    for (const dir of ZETA_LOCAL_DIRS) expect(existsSync(zetaLocalDirPath(dir, home))).toBe(true);
    expect(existsSync(caPublicKeyPath(repoRoot, CA))).toBe(true);
    expect(res.localWipe.every((l) => l.action === "skipped-biometric")).toBe(true);
    expect(res.repoUnregister.every((r) => r.action === "skipped-biometric")).toBe(true);
  } finally {
    cleanup();
  }
});

test("real run WITHOUT confirm: nothing touched, never prompts", async () => {
  const { home, repoRoot, cleanup } = makeFixture();
  try {
    const removed: string[] = [];
    const gitRmStaged: { repoRoot: string; relPath: string }[] = [];
    const prompts: string[] = [];
    const fx = fakeEffects({ removed, gitRmStaged });
    const res = await teardown(fx, {
      ca: CA,
      repoRoot,
      home,
      hostname: HOST,
      dryRun: false,
      confirm: false, // NOT confirmed
      biometricAuth: fakeBiometric(true, prompts),
    });
    expect(prompts.length).toBe(0); // never prompts without confirm
    expect(removed.length).toBe(0);
    expect(gitRmStaged.length).toBe(0);
    expect(res.biometric).toBeUndefined();
    expect(res.localWipe.every((l) => l.action === "skipped-not-confirmed")).toBe(true);
    expect(res.repoUnregister.every((r) => r.action === "skipped-not-confirmed")).toBe(true);
    for (const dir of ZETA_LOCAL_DIRS) expect(existsSync(zetaLocalDirPath(dir, home))).toBe(true);
  } finally {
    cleanup();
  }
});

test("idempotent: re-run after a teardown is a clean no-op (already clean, no prompt)", async () => {
  const { home, repoRoot, cleanup } = makeFixture();
  try {
    const prompts1: string[] = [];
    const fx = fakeEffects();
    // First teardown removes everything.
    await teardown(fx, {
      ca: CA,
      repoRoot,
      home,
      hostname: HOST,
      dryRun: false,
      confirm: true,
      biometricAuth: fakeBiometric(true, prompts1),
    });
    expect(prompts1.length).toBe(1);
    // Second run: nothing present => clean no-op, NO prompt.
    const prompts2: string[] = [];
    const res2 = await teardown(fx, {
      ca: CA,
      repoRoot,
      home,
      hostname: HOST,
      dryRun: false,
      confirm: true,
      biometricAuth: fakeBiometric(true, prompts2),
    });
    expect(prompts2.length).toBe(0); // nothing destructive => no approval needed
    expect(res2.hadWork).toBe(false);
    expect(res2.biometric).toBeUndefined();
    expect(res2.unregisteredPaths.length).toBe(0);
    expect(res2.localWipe.every((l) => l.action === "absent")).toBe(true);
    expect(res2.repoUnregister.every((r) => r.action === "absent")).toBe(true);
    expect(formatTeardown(res2)).toContain("Already clean");
  } finally {
    cleanup();
  }
});

test("partial state: only local present (repo already clean) — wipes local, no repo staging", async () => {
  const home = mkdtempSync(join(tmpdir(), "zeta-td-home-"));
  const repoRoot = mkdtempSync(join(tmpdir(), "zeta-td-repo-")); // empty repo
  try {
    for (const dir of ZETA_LOCAL_DIRS) {
      const d = zetaLocalDirPath(dir, home);
      mkdirSync(d, { recursive: true });
      writeFileSync(join(d, "secret.bin"), "FAKE\n");
    }
    const removed: string[] = [];
    const gitRmStaged: { repoRoot: string; relPath: string }[] = [];
    const fx = fakeEffects({ removed, gitRmStaged });
    const res = await teardown(fx, {
      ca: CA,
      repoRoot,
      home,
      hostname: HOST,
      dryRun: false,
      confirm: true,
      biometricAuth: fakeBiometric(true),
    });
    expect(res.hadWork).toBe(true);
    expect(removed.length).toBe(ZETA_LOCAL_DIRS.length);
    expect(gitRmStaged.length).toBe(0); // repo had nothing to unregister
    expect(res.repoUnregister.every((r) => r.action === "absent")).toBe(true);
    expect(res.localWipe.every((l) => l.action === "wiped")).toBe(true);
  } finally {
    rmSync(home, { recursive: true, force: true });
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test("readouts + 1Password note are PUBLIC only — no private-key bytes ever echoed", async () => {
  const { home, repoRoot, cleanup } = makeFixture();
  try {
    const fx = fakeEffects();
    const res = await teardown(fx, {
      ca: CA,
      repoRoot,
      home,
      hostname: HOST,
      dryRun: false,
      confirm: true,
      biometricAuth: fakeBiometric(true),
    });
    const out = formatTeardown(res) + "\n" + format1PasswordNote();
    expect(out).not.toContain(PRIV_MARKER); // no private-key header in any readout
    expect(out).toContain("zeta-ca-private"); // the 1Password note names the items
    expect(out).toContain("Operator approval: 1 approval");
    // The fixture door declares no factor, so the readout must say so rather than print
    // the ATTEMPTED mechanism as if it were the ESTABLISHED one (081M06DSQ0Q087G0R000H91391).
    expect(out).toContain("factor established: unattributed");
  } finally {
    cleanup();
  }
});

test("relUnder helper (caPublicRel): repo-relative path for git rm", () => {
  // The repo-unregister paths are repo-root-relative (what `git rm` wants under -C repoRoot).
  const rel = caPublicRel("/tmp/myrepo", CA);
  expect(rel).toBe(`maintainers/${CA}/ssh-ca.pub`);
});
