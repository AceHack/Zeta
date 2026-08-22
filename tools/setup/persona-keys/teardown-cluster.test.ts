// teardown-cluster.ts conformance — the DESTRUCTIVE inverse of setup-cluster (CA-private wipe + the
// cluster trust-root PUBLIC artifacts: the CA pubkey + the multi-CA trusted-user-ca-keys.pub trust
// set). ALL tests run against THROWAWAY temp dirs via injected effects + FAKE biometric/git doors —
// NEVER the real ~/.config/zeta, NEVER a real `git rm` on a real repo, NEVER a real key deleted, NEVER
// a network call. NO key-shaped literal appears in this file (the private-key header marker is SPLIT +
// assembled at runtime so a grep for it is EMPTY).
//
// Proves: dry-run wipes/rm NOTHING + never prompts + reports the cascade WARNINGS; a confirmed run
// (fake fs + fake biometric ok) wipes the fake CA-private dir + stages the fake CA-pubkey + trust-set
// removals + fires the human gate EXACTLY once; declined biometric => nothing deleted; a non-confirmed
// real run => nothing touched; idempotent re-run => clean no-op; cascade-with-warnings on extra-care
// nodes (cross-cluster peers + dependent machine certs + unrecoverable private); a STANDALONE round-trip
// (fake cluster state in temp dirs => teardown => re-setup-state => clean) converges; SANDBOX-ONLY
// meta-test asserts every touched path is under tmpdir(); no secret bytes echoed.
// Run: bun test teardown-cluster.test.ts   (from tools/setup/persona-keys)
import { test, expect } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  caLocalDirPath,
  caPublicRel,
  countPeerCas,
  format1PasswordNote,
  formatClusterTeardown,
  teardownCluster,
  trustSetRel,
  type ClusterTeardownEffects,
} from "./teardown-cluster.ts";
import { caPrivateKeyPath, caPublicKeyPath } from "./ca.ts";
import { trustedUserCaKeysPath } from "./setup-cluster.ts";
import { machineCertPath } from "./teardown.ts";
import type { BiometricAuth, BiometricResult } from "./biometric.ts";

// The private-key marker, assembled at runtime so NO key-shaped literal is in this file.
const PRIV_MARKER = "PRIVATE" + " " + "KEY";

const CA = "tester";
const SELF_CA_LINE = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAASELF self-ca";
const PEER_CA_LINE = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAPEER peer-ca";

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

// A deterministic fake effects over a REAL temp filesystem — but the "secure remove" + "git rm" doors
// are FAKE (a plain unlink / a recorded staging). Never shells out, never touches a secret.
function fakeEffects(opts?: {
  removed?: string[];
  gitRmStaged?: { repoRoot: string; relPath: string }[];
}): ClusterTeardownEffects {
  const walk = (dir: string): string[] => {
    if (!existsSync(dir)) return [];
    const out: string[] = [];
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, name.name);
      if (name.isDirectory()) out.push(...walk(full));
      else out.push(full);
    }
    return out;
  };
  return {
    exists: (p) => existsSync(p),
    listFiles: walk,
    readPublic: (p) => (existsSync(p) ? readFileSync(p, "utf8") : ""),
    listMachineCerts: (repoRoot) => {
      const dir = join(repoRoot, "machines");
      if (!existsSync(dir)) return [];
      return readdirSync(dir)
        .filter((n) => n.endsWith("-cert.pub"))
        .map((n) => join(dir, n));
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

/** Write the cluster state setup-cluster would CREATE, into temp dirs: the CA private (local), the CA
 *  pubkey (repo), the multi-CA trust set (repo, self + N peers), and `withCerts` dependent machine
 *  certs (the cascade blast radius). This is the FAKE-state side of the standalone round-trip. */
function makeClusterFixture(opts?: {
  peers?: number;
  withCerts?: number;
}): { home: string; repoRoot: string; cleanup: () => void } {
  const home = mkdtempSync(join(tmpdir(), "zeta-tdc-home-"));
  const repoRoot = mkdtempSync(join(tmpdir(), "zeta-tdc-repo-"));
  // LOCAL: the CA private key file under ~/.config/zeta/ca/.
  const caPriv = caPrivateKeyPath(home);
  mkdirSync(dirname(caPriv), { recursive: true });
  writeFileSync(caPriv, "FAKE-CA-PRIVATE-PLACEHOLDER-DO-NOT-USE\n", { mode: 0o600 });
  // REPO: the CA pubkey + the multi-CA trust set (self + peers).
  const caPub = caPublicKeyPath(repoRoot, CA);
  mkdirSync(dirname(caPub), { recursive: true });
  writeFileSync(caPub, SELF_CA_LINE + "\n");
  const trustPath = trustedUserCaKeysPath(repoRoot, CA);
  const peerN = opts?.peers ?? 0;
  let trust = "# header\n# self cluster CA\n" + SELF_CA_LINE + "\n";
  for (let i = 0; i < peerN; i++) {
    trust += `# peer-${i} cluster CA\n${PEER_CA_LINE}\n`;
  }
  mkdirSync(dirname(trustPath), { recursive: true });
  writeFileSync(trustPath, trust);
  // Optional dependent machine certs (the cascade blast radius for the CA pubkey).
  const certN = opts?.withCerts ?? 0;
  if (certN > 0) {
    const mdir = join(repoRoot, "machines");
    mkdirSync(mdir, { recursive: true });
    for (let i = 0; i < certN; i++) {
      writeFileSync(join(mdir, `host-${i}-cert.pub`), "ssh-ed25519-cert placeholder\n");
    }
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

test("dry-run (default): wipes/rm NOTHING, never prompts, reports would-* + cascade warnings", async () => {
  const { home, repoRoot, cleanup } = makeClusterFixture({ peers: 2, withCerts: 3 });
  try {
    const removed: string[] = [];
    const gitRmStaged: { repoRoot: string; relPath: string }[] = [];
    const prompts: string[] = [];
    const fx = fakeEffects({ removed, gitRmStaged });
    const res = await teardownCluster(fx, {
      ca: CA,
      repoRoot,
      home,
      dryRun: true,
      biometricAuth: fakeBiometric(true, prompts),
    });
    expect(removed.length).toBe(0);
    expect(gitRmStaged.length).toBe(0);
    expect(prompts.length).toBe(0); // NEVER prompts on dry-run
    expect(res.dryRun).toBe(true);
    expect(res.hadWork).toBe(true);
    expect(res.localCaWipe.action).toBe("would-wipe");
    expect(res.clusterUnregister.every((r) => r.action === "would-unregister")).toBe(true);
    // CASCADE WARNINGS present (cross-cluster peers + dependent certs + unrecoverable private).
    const kinds = res.warnings.map((w) => w.kind);
    expect(kinds).toContain("cross-cluster-peer");
    expect(kinds).toContain("dependent-machine-certs");
    expect(kinds).toContain("unrecoverable-private");
    expect(res.warnings.find((w) => w.kind === "cross-cluster-peer")?.blastRadius).toBe(2);
    expect(res.warnings.find((w) => w.kind === "dependent-machine-certs")?.blastRadius).toBe(3);
    // Everything still on disk.
    expect(existsSync(caPrivateKeyPath(home))).toBe(true);
    expect(existsSync(caPublicKeyPath(repoRoot, CA))).toBe(true);
    expect(existsSync(trustedUserCaKeysPath(repoRoot, CA))).toBe(true);
    expect(res.biometric).toBeUndefined();
    // The readout leads with the warnings.
    expect(formatClusterTeardown(res)).toContain("CASCADE WARNINGS");
  } finally {
    cleanup();
  }
});

test("confirmed + biometric ok: wipes CA private, stages CA-pubkey + trust-set removals, fires gate once", async () => {
  const { home, repoRoot, cleanup } = makeClusterFixture({ peers: 1, withCerts: 2 });
  try {
    const removed: string[] = [];
    const gitRmStaged: { repoRoot: string; relPath: string }[] = [];
    const prompts: string[] = [];
    const fx = fakeEffects({ removed, gitRmStaged });
    const res = await teardownCluster(fx, {
      ca: CA,
      repoRoot,
      home,
      dryRun: false,
      confirm: true,
      biometricAuth: fakeBiometric(true, prompts),
    });
    expect(prompts.length).toBe(1); // ONE fingerprint
    expect(res.biometric?.ok).toBe(true);
    // CA private wiped (one file).
    expect(removed.length).toBe(1);
    expect(existsSync(caLocalDirPath(home))).toBe(false);
    // Both cluster artifacts staged for removal + actually gone from the temp repo.
    expect(gitRmStaged.length).toBe(2);
    expect(res.unregisteredPaths.length).toBe(2);
    expect(existsSync(caPublicKeyPath(repoRoot, CA))).toBe(false);
    expect(existsSync(trustedUserCaKeysPath(repoRoot, CA))).toBe(false);
    // Every staged git rm operated ONLY under the passed repoRoot (shared-checkout-is-view-only).
    expect(gitRmStaged.every((s) => s.repoRoot === repoRoot)).toBe(true);
    expect(res.localCaWipe.action).toBe("wiped");
    expect(res.clusterUnregister.every((r) => r.action === "unregistered")).toBe(true);
  } finally {
    cleanup();
  }
});

test("declined biometric: fail-closed — NOTHING deleted, NOTHING staged", async () => {
  const { home, repoRoot, cleanup } = makeClusterFixture({ peers: 1 });
  try {
    const removed: string[] = [];
    const gitRmStaged: { repoRoot: string; relPath: string }[] = [];
    const prompts: string[] = [];
    const fx = fakeEffects({ removed, gitRmStaged });
    const res = await teardownCluster(fx, {
      ca: CA,
      repoRoot,
      home,
      dryRun: false,
      confirm: true,
      biometricAuth: fakeBiometric(false, prompts), // DECLINED
    });
    expect(prompts.length).toBe(1); // it asked once
    expect(res.biometric?.ok).toBe(false);
    expect(removed.length).toBe(0);
    expect(gitRmStaged.length).toBe(0);
    expect(res.unregisteredPaths.length).toBe(0);
    expect(existsSync(caPrivateKeyPath(home))).toBe(true);
    expect(existsSync(caPublicKeyPath(repoRoot, CA))).toBe(true);
    expect(existsSync(trustedUserCaKeysPath(repoRoot, CA))).toBe(true);
    expect(res.localCaWipe.action).toBe("skipped-biometric");
    expect(res.clusterUnregister.every((r) => r.action === "skipped-biometric")).toBe(true);
  } finally {
    cleanup();
  }
});

test("real run WITHOUT confirm: nothing touched, never prompts", async () => {
  const { home, repoRoot, cleanup } = makeClusterFixture();
  try {
    const removed: string[] = [];
    const gitRmStaged: { repoRoot: string; relPath: string }[] = [];
    const prompts: string[] = [];
    const fx = fakeEffects({ removed, gitRmStaged });
    const res = await teardownCluster(fx, {
      ca: CA,
      repoRoot,
      home,
      dryRun: false,
      confirm: false, // NOT confirmed
      biometricAuth: fakeBiometric(true, prompts),
    });
    expect(prompts.length).toBe(0); // never prompts without confirm
    expect(removed.length).toBe(0);
    expect(gitRmStaged.length).toBe(0);
    expect(res.biometric).toBeUndefined();
    expect(res.localCaWipe.action).toBe("skipped-not-confirmed");
    expect(res.clusterUnregister.every((r) => r.action === "skipped-not-confirmed")).toBe(true);
    expect(existsSync(caPrivateKeyPath(home))).toBe(true);
  } finally {
    cleanup();
  }
});

test("idempotent: re-run after a teardown is a clean no-op (already clean, no prompt)", async () => {
  const { home, repoRoot, cleanup } = makeClusterFixture({ peers: 1, withCerts: 1 });
  try {
    const prompts1: string[] = [];
    const fx = fakeEffects();
    await teardownCluster(fx, {
      ca: CA,
      repoRoot,
      home,
      dryRun: false,
      confirm: true,
      biometricAuth: fakeBiometric(true, prompts1),
    });
    expect(prompts1.length).toBe(1);
    // Second run: nothing present => clean no-op, NO prompt, NO warnings.
    const prompts2: string[] = [];
    const res2 = await teardownCluster(fx, {
      ca: CA,
      repoRoot,
      home,
      dryRun: false,
      confirm: true,
      biometricAuth: fakeBiometric(true, prompts2),
    });
    expect(prompts2.length).toBe(0);
    expect(res2.hadWork).toBe(false);
    expect(res2.biometric).toBeUndefined();
    expect(res2.unregisteredPaths.length).toBe(0);
    expect(res2.warnings.length).toBe(0);
    expect(res2.localCaWipe.action).toBe("absent");
    expect(res2.clusterUnregister.every((r) => r.action === "absent")).toBe(true);
    expect(formatClusterTeardown(res2)).toContain("Already clean");
  } finally {
    cleanup();
  }
});

test("partial state: only repo present (CA private already gone) — unregisters repo, no local wipe", async () => {
  const home = mkdtempSync(join(tmpdir(), "zeta-tdc-home-")); // no ~/.config/zeta/ca
  const repoRoot = mkdtempSync(join(tmpdir(), "zeta-tdc-repo-"));
  try {
    const caPub = caPublicKeyPath(repoRoot, CA);
    mkdirSync(dirname(caPub), { recursive: true });
    writeFileSync(caPub, SELF_CA_LINE + "\n");
    const trustPath = trustedUserCaKeysPath(repoRoot, CA);
    writeFileSync(trustPath, "# self cluster CA\n" + SELF_CA_LINE + "\n");
    const removed: string[] = [];
    const gitRmStaged: { repoRoot: string; relPath: string }[] = [];
    const fx = fakeEffects({ removed, gitRmStaged });
    const res = await teardownCluster(fx, {
      ca: CA,
      repoRoot,
      home,
      dryRun: false,
      confirm: true,
      biometricAuth: fakeBiometric(true),
    });
    expect(res.hadWork).toBe(true);
    expect(removed.length).toBe(0); // nothing local to wipe
    expect(res.localCaWipe.action).toBe("absent");
    expect(gitRmStaged.length).toBe(2);
    expect(res.clusterUnregister.every((r) => r.action === "unregistered")).toBe(true);
    // No unrecoverable-private warning (no CA private present); no peers/certs ⇒ no other warnings.
    expect(res.warnings.length).toBe(0);
  } finally {
    rmSync(home, { recursive: true, force: true });
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test("STANDALONE round-trip: setup-state → teardown → re-setup-state → teardown converges (idempotent)", async () => {
  // setup-cluster can't be cleanly sandboxed end-to-end here (its CLI does real keygen via ca.ts), so
  // we model the cluster STATE it CREATES in temp dirs, teardown to clean, RE-CREATE the same state
  // (the new-fork re-setup), and teardown again — asserting both converge to the same clean state.
  const { home, repoRoot, cleanup } = makeClusterFixture({ peers: 1, withCerts: 1 });
  try {
    const fx = fakeEffects();
    // CYCLE 1 teardown.
    const td1 = await teardownCluster(fx, {
      ca: CA, repoRoot, home, dryRun: false, confirm: true, biometricAuth: fakeBiometric(true),
    });
    expect(td1.localCaWipe.action).toBe("wiped");
    expect(td1.unregisteredPaths.length).toBe(2);
    expect(existsSync(caLocalDirPath(home))).toBe(false);
    expect(existsSync(caPublicKeyPath(repoRoot, CA))).toBe(false);
    expect(existsSync(trustedUserCaKeysPath(repoRoot, CA))).toBe(false);

    // RE-SETUP-STATE: re-create exactly what setup-cluster produces (the new-fork first-time path).
    const caPriv = caPrivateKeyPath(home);
    mkdirSync(dirname(caPriv), { recursive: true });
    writeFileSync(caPriv, "FAKE-CA-PRIVATE-PLACEHOLDER-2\n", { mode: 0o600 });
    const caPub = caPublicKeyPath(repoRoot, CA);
    mkdirSync(dirname(caPub), { recursive: true });
    writeFileSync(caPub, SELF_CA_LINE + "\n");
    const trustPath = trustedUserCaKeysPath(repoRoot, CA);
    writeFileSync(trustPath, "# self cluster CA\n" + SELF_CA_LINE + "\n");

    // CYCLE 2 teardown — converges to the same clean state.
    const td2 = await teardownCluster(fx, {
      ca: CA, repoRoot, home, dryRun: false, confirm: true, biometricAuth: fakeBiometric(true),
    });
    expect(td2.localCaWipe.action).toBe("wiped");
    expect(td2.unregisteredPaths.length).toBe(2);
    expect(existsSync(caLocalDirPath(home))).toBe(false);
    expect(existsSync(caPublicKeyPath(repoRoot, CA))).toBe(false);
    expect(existsSync(trustedUserCaKeysPath(repoRoot, CA))).toBe(false);

    // CONVERGENCE: a third teardown on the now-clean sandbox is an idempotent no-op (no prompt).
    const prompts3: string[] = [];
    const td3 = await teardownCluster(fx, {
      ca: CA, repoRoot, home, dryRun: false, confirm: true, biometricAuth: fakeBiometric(true, prompts3),
    });
    expect(td3.hadWork).toBe(false);
    expect(prompts3.length).toBe(0);
  } finally {
    cleanup();
  }
});

test("readouts + 1Password note are PUBLIC only — no private-key bytes ever echoed", async () => {
  const { home, repoRoot, cleanup } = makeClusterFixture({ peers: 1 });
  try {
    const fx = fakeEffects();
    const res = await teardownCluster(fx, {
      ca: CA,
      repoRoot,
      home,
      dryRun: false,
      confirm: true,
      biometricAuth: fakeBiometric(true),
    });
    const out = formatClusterTeardown(res) + "\n" + format1PasswordNote();
    expect(out).not.toContain(PRIV_MARKER); // no private-key header in any readout
    expect(out).toContain("zeta-ca-private"); // the 1Password note names the item
    expect(out).toContain("Operator approval: 1 approval");
    // The fixture door declares no factor, so the readout must say so rather than print
    // the ATTEMPTED mechanism as if it were the ESTABLISHED one (081M06DSQ0Q087G0R000H91391).
    expect(out).toContain("factor established: unattributed");
  } finally {
    cleanup();
  }
});

test("countPeerCas counts only NON-self CA lines (the cross-cluster blast radius)", () => {
  const trust = "# self cluster CA\nssh-ed25519 A self\n# peer-east cluster CA\nssh-ed25519 B east\n# peer-west cluster CA\nssh-ed25519 C west\n";
  expect(countPeerCas(trust)).toBe(2);
  expect(countPeerCas("# self cluster CA\nssh-ed25519 A self\n")).toBe(0);
  expect(countPeerCas("")).toBe(0);
});

test("rel helpers: repo-relative paths for git rm", () => {
  expect(caPublicRel("/tmp/myrepo", CA)).toBe(`maintainers/${CA}/ssh-ca.pub`);
  expect(trustSetRel("/tmp/myrepo", CA)).toBe(`maintainers/${CA}/trusted-user-ca-keys.pub`);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// SANDBOX-ONLY meta-assertion: every path the cluster teardown touches lives strictly under tmpdir().
// A path outside tmpdir() means we drifted toward real state — FAIL LOUD rather than touch it.
// ══════════════════════════════════════════════════════════════════════════════════════════════
test("SANDBOX-ONLY: all wiped/staged paths live strictly under the temp root (never real state)", async () => {
  const { home, repoRoot, cleanup } = makeClusterFixture({ peers: 1, withCerts: 1 });
  try {
    const root = tmpdir();
    const removed: string[] = [];
    const gitRmStaged: { repoRoot: string; relPath: string }[] = [];
    const fx = fakeEffects({ removed, gitRmStaged });
    const res = await teardownCluster(fx, {
      ca: CA,
      repoRoot,
      home,
      dryRun: false,
      confirm: true,
      biometricAuth: fakeBiometric(true),
    });
    // Every securely-removed local path is under the sandbox home (and tmpdir()).
    for (const p of removed) {
      expect(p.startsWith(root)).toBe(true);
      expect(p.startsWith(home)).toBe(true);
    }
    // Every staged git rm is under the sandbox repoRoot (and tmpdir()).
    for (const s of gitRmStaged) {
      expect(s.repoRoot).toBe(repoRoot);
      const full = join(s.repoRoot, s.relPath);
      expect(full.startsWith(root)).toBe(true);
      expect(full.startsWith(repoRoot)).toBe(true);
    }
    // The REAL ~/.config/zeta default CA path is NOT under our sandbox (we never used it).
    expect(caPrivateKeyPath().startsWith(home)).toBe(false);
    expect(caLocalDirPath().startsWith(home)).toBe(false);
    void res;
  } finally {
    cleanup();
  }
});

// Touch machineCertPath import so the dependent-cert blast-radius source is exercised + lint-clean.
test("machineCertPath (teardown.ts) resolves the dependent-cert path used for blast radius", () => {
  expect(machineCertPath("/tmp/r", "h")).toBe("/tmp/r/machines/h-cert.pub");
});
