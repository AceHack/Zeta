// THE CA TRUST-SET CLOSING BOUND — the proof for the two halves of the 2026-08-23 fix.
//
// Mateo's P0 (docs/BUGS.md, pinned by rotate-refusals.test.ts RR-4): `rotateCaKey` wrote the trust
// set as `[currentActive, new]`, so rotation #2 evicted CA1 while certs it signed were still valid.
// The obvious repair — union the sets — trades that defect for a slower one: every retired CA
// becomes a PERMANENT trust root. So the fix has two halves, and this file proves BOTH, because
// either half alone is a defect:
//
//   OPENING  (CB-1, CB-2)  a rotation is ADDITIVE. Rotate twice, three times: every CA trusted
//                          before is still trusted after, along with peers and unrecognised lines.
//   CLOSING  (CB-3..CB-7)  a CA can still LEAVE — but only through `--finalize`, only on census
//                          evidence that no UNEXPIRED certificate names it, and only with an
//                          approval whose text names each CA being dropped.
//
// Every closing test carries its DISCRIMINATION arm: the identical `--finalize` call, on the same
// sandbox, with only the evidence changed, must reach the opposite verdict. A finalize that always
// refuses would pass a one-armed version of these tests and would be useless.
//
// ┌─ ABSOLUTE SAFETY (sandbox-only) ──────────────────────────────────────────────────────────────┐
// │ mktemp HOME + mktemp repoRoot per test. The biometric door is ALWAYS a FAKE — `realBiometric`  │
// │ is never imported, so no Touch ID prompt and no `sudo` can occur from this file. Nothing       │
// │ touches ~/.config/zeta, 1Password, real `git`, or any live key. `ssh-keygen` runs for real,    │
// │ aimed wholly at the temp dirs. NO SECRET VALUE IS READ, PRINTED OR ASSERTED ON — every key is  │
// │ compared by SHA256 FINGERPRINT ONLY.                                                           │
// └────────────────────────────────────────────────────────────────────────────────────────────────┘
import { test, expect } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { setupMachine } from "./setup-machine.ts";
import { realEffects as machineRealFx, machinePubPath } from "./machine.ts";
import { caPrivateKeyPath, certPath, realEffects as caRealFx, signMachineCert } from "./ca.ts";
import { parseTrustSet, trustedUserCaKeysPath } from "./setup-cluster.ts";
import { sshPublicKeyFingerprint } from "./ssh-cert-census.ts";
import { sessionBiometric, type BiometricAuth } from "./biometric.ts";
import type { OnboardEffects } from "./onboard.ts";
import type { GithubTrustEffects } from "./github-trust.ts";
import {
  rotate, formatRotate, allocateRetiredSlot, retiredCaKeyPath, MAX_RETIRED_GENERATIONS,
  type RotateEffects, type RotatePort,
} from "./rotate.ts";

const USER = "tester";
const HOST = "cb-host";
const OTHER_HOST = "cb-other";

interface Sandbox {
  readonly home: string;
  readonly repoRoot: string;
  readonly cleanup: () => void;
}

function makeSandbox(): Sandbox {
  const home = mkdtempSync(join(tmpdir(), "zeta-cb-home-"));
  const repoRoot = mkdtempSync(join(tmpdir(), "zeta-cb-repo-"));
  return {
    home,
    repoRoot,
    cleanup: () => {
      rmSync(home, { recursive: true, force: true });
      rmSync(repoRoot, { recursive: true, force: true });
    },
  };
}

function approving(prompts: string[]): BiometricAuth {
  return async (prompt: string) => {
    prompts.push(prompt);
    return { ok: true, platform: "macos-touchid", factor: "biometric" };
  };
}

interface FxOpts {
  /** Omit the census doors entirely — the "no evidence available" case. */
  readonly noCensus?: boolean;
  /** Override the instant expiry is judged against (DST: time is injected, never ambient). */
  readonly now?: number;
}

function rotateEffects(staged: { repoRoot: string; relPath: string }[], o: FxOpts = {}): RotateEffects {
  const machine = machineRealFx();
  const base = {
    exists: (p: string) => existsSync(p),
    readText: (p: string) => readFileSync(p, "utf8"),
    writeText: (p: string, c: string) => {
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, c);
    },
    mkdirp: (p: string) => mkdirSync(p, { recursive: true }),
    genEd25519: (keyPath: string, comment: string) => machine.genEd25519(keyPath, comment),
    movePrivate: (from: string, to: string) => {
      for (const suffix of ["", ".pub"]) {
        if (existsSync(from + suffix)) {
          mkdirSync(dirname(to + suffix), { recursive: true });
          renameSync(from + suffix, to + suffix);
        }
      }
    },
    ca: caRealFx(),
    // NEVER shells real git, NEVER pushes.
    stageRepoWrite: (repoRoot: string, relPath: string) => {
      staged.push({ repoRoot, relPath });
      return true;
    },
  };
  if (o.noCensus === true) return base;
  return {
    ...base,
    listCerts: (repoRoot: string) => {
      const dir = join(repoRoot, "machines");
      if (!existsSync(dir)) return [];
      return readdirSync(dir).filter((f) => f.endsWith("-cert.pub")).sort().map((f) => join(dir, f));
    },
    nowEpochSeconds: () => o.now ?? Math.floor(Date.now() / 1000),
  };
}

async function provision(sb: Sandbox): Promise<void> {
  const session = sessionBiometric(approving([]));
  const trust: GithubTrustEffects = {
    exists: () => false, readText: () => "", listDir: () => [],
    fetchKeys: async () => "", fetchGpg: async () => "",
  };
  const fx: OnboardEffects = {
    machine: { ...machineRealFx(), hostname: () => HOST },
    trust, ca: caRealFx(), biometricAuth: session.door,
  };
  const res = await setupMachine(fx, session, {
    user: USER, repoRoot: sb.repoRoot, home: sb.home, hostname: HOST, caConfigured: false,
  });
  expect(res.onboard.cert?.action).toBe("signed");
}

// ── fingerprints: PUBLIC halves only, never a secret byte ─────────────────────────────────────

function pubFingerprint(pubPath: string): string {
  return sshPublicKeyFingerprint(readFileSync(pubPath, "utf8"));
}

/** The set sshd would consult, as fingerprints. Empty before the first CA rotation writes the file
 *  (setup-machine provisions a CA; rendering the multi-CA trust set is setup-cluster's / rotate's job). */
function trustedCaFingerprints(sb: Sandbox): string[] {
  const path = trustedUserCaKeysPath(sb.repoRoot, USER);
  if (!existsSync(path)) return [];
  const text = readFileSync(path, "utf8");
  return text.split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"))
    .map((l) => sshPublicKeyFingerprint(l));
}

/** The rule sshd applies, read straight out of the certificate (differentially checked in
 *  ssh-cert-census.test.ts against `ssh-keygen -L`). */
function certSigningCa(certFilePath: string): string {
  const r = spawnSync("ssh-keygen", ["-L", "-f", certFilePath], { encoding: "utf8" });
  expect(r.status).toBe(0);
  return /Signing CA:\s+\S+\s+(SHA256:\S+)/.exec(r.stdout)![1]!;
}

interface RunOpts {
  readonly ports?: readonly RotatePort[];
  readonly finalize?: boolean;
  readonly dryRun?: boolean;
  readonly confirm?: boolean;
  readonly fxOpts?: FxOpts;
  readonly prompts?: string[];
  readonly certValidity?: string;
}

async function runRotate(sb: Sandbox, o: RunOpts = {}) {
  const staged: { repoRoot: string; relPath: string }[] = [];
  const res = await rotate(rotateEffects(staged, o.fxOpts ?? {}), {
    user: USER, ca: USER, repoRoot: sb.repoRoot, home: sb.home, hostname: HOST,
    ports: o.ports ?? ["ca-key"],
    dryRun: o.dryRun ?? false,
    confirm: o.confirm ?? true,
    ...(o.finalize === true ? { finalize: true } : {}),
    ...(o.certValidity !== undefined ? { certValidity: o.certValidity } : {}),
    biometricAuth: approving(o.prompts ?? []),
  });
  return { res, staged };
}

/** Sign a SECOND machine's certificate with the CURRENT active CA and a chosen validity window.
 *  Used to give a retired CA a dependant whose EXPIRY is the only variable under test. */
async function signSecondMachineCert(sb: Sandbox, validity: string): Promise<void> {
  const keyPath = join(sb.home, `.cb-${OTHER_HOST}-key`);
  machineRealFx().genEd25519(keyPath, `${OTHER_HOST} (zeta-machine)`);
  const regPath = machinePubPath(sb.repoRoot, OTHER_HOST);
  mkdirSync(dirname(regPath), { recursive: true });
  writeFileSync(regPath, readFileSync(keyPath + ".pub", "utf8"));
  const res = await signMachineCert(caRealFx(), {
    user: USER, machineId: OTHER_HOST, devicePubPath: regPath, home: sb.home,
    validity, dryRun: false, biometricAuth: approving([]),
  });
  expect(res.action).toBe("signed");
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// CB-1 — THE OPENING HALF. Rotate the CA THREE times. Every CA ever trusted is still trusted, and
// the certificate signed by CA1 — still well inside its `-V` window — still verifies.
//
// This is the exact scenario that was broken: rotation #2 used to evict CA1. The third rotation is
// here because a fix that only unions the LAST TWO would pass at N=2 the same way the original
// passed at N=1, which is the failure this whole file exists to prevent recurring.
// ══════════════════════════════════════════════════════════════════════════════════════════════
test("CB-1: rotating the CA three times NEVER drops a CA whose certificates are still unexpired", async () => {
  const sb = makeSandbox();
  try {
    await provision(sb);
    const certFile = certPath(machinePubPath(sb.repoRoot, HOST));
    const protectedBy = certSigningCa(certFile);
    const ca1 = pubFingerprint(caPrivateKeyPath(sb.home) + ".pub");
    expect(protectedBy).toBe(ca1);

    const generations: string[] = [ca1];
    for (let n = 1; n <= 3; n++) {
      const before = trustedCaFingerprints(sb);
      const { res } = await runRotate(sb, { ports: ["ca-key"] });
      expect(res.rotations.find((x) => x.port === "ca-key")?.action).toBe("rotated");
      generations.push(pubFingerprint(caPrivateKeyPath(sb.home) + ".pub"));
      const after = trustedCaFingerprints(sb);

      // THE PROPERTY, asserted identically at every N (this is what failed at N=2 before the fix).
      for (const fp of before) expect(after).toContain(fp);
      expect(after).toContain(protectedBy);
      // Rotation #1 also CREATES the file (0 -> {outgoing, incoming}); after that each rotation
      // adds exactly the new signer and removes nothing.
      expect(after.length).toBe(n === 1 ? 2 : before.length + 1);

      // ...and the run MEASURED it rather than claiming it.
      const trust = res.rotations.find((x) => x.port === "ca-key")?.trust;
      expect(trust?.supersetOfBefore).toBe(true);
      expect([...(trust?.dropped ?? [])]).toEqual([]);
      expect([...(trust?.after ?? [])].sort()).toEqual([...after].sort());
    }

    // Four distinct CA generations, all trusted; the cert signed by the first one still verifies.
    expect(new Set(generations).size).toBe(4);
    for (const fp of generations) expect(trustedCaFingerprints(sb)).toContain(fp);
    expect(trustedCaFingerprints(sb)).toContain(certSigningCa(certFile));
  } finally {
    sb.cleanup();
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// CB-2 — the superset property is TOTAL, not just over lines rotate recognises. A peer CA and a
// hand-added line with no marker both survive repeated rotation. The unmarked line is the sharper
// case: the old parser dropped anything without a recognised comment, so "we preserve peers" was
// true and "we preserve trust roots" was not.
// ══════════════════════════════════════════════════════════════════════════════════════════════
test("CB-2: peer CAs AND unrecognised trust lines survive repeated rotation verbatim", async () => {
  const sb = makeSandbox();
  try {
    await provision(sb);
    // A peer CA and an unmarked line, both real ed25519 public keys.
    const peerKey = join(sb.home, ".cb-peer");
    const strayKey = join(sb.home, ".cb-stray");
    machineRealFx().genEd25519(peerKey, "peer-cluster (zeta-ssh-ca)");
    machineRealFx().genEd25519(strayKey, "hand-added (zeta-ssh-ca)");
    const peerLine = readFileSync(peerKey + ".pub", "utf8").trim();
    const strayLine = readFileSync(strayKey + ".pub", "utf8").trim();

    // The trust-set file is written by the first CA rotation; append the two extra roots after it.
    await runRotate(sb, { ports: ["ca-key"] });
    const trustPath = trustedUserCaKeysPath(sb.repoRoot, USER);
    writeFileSync(
      trustPath,
      readFileSync(trustPath, "utf8") +
        `# peer-cluster cluster CA\n${peerLine}\n${strayLine}\n`,
    );
    expect(parseTrustSet(readFileSync(trustPath, "utf8")).unclassified).toEqual([strayLine]);

    for (let n = 1; n <= 2; n++) await runRotate(sb, { ports: ["ca-key"] });

    const after = readFileSync(trustPath, "utf8");
    const parsed = parseTrustSet(after);
    expect(parsed.peers.map((p) => p.name)).toContain("peer-cluster");
    expect(parsed.peers.map((p) => p.publicKey)).toContain(peerLine);
    // Still unclassified — preserved, and NOT silently promoted to a peer this cluster never agreed to.
    expect(parsed.unclassified).toEqual([strayLine]);
    expect(trustedCaFingerprints(sb)).toContain(sshPublicKeyFingerprint(strayLine));
  } finally {
    sb.cleanup();
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// CB-3 — THE CLOSING HALF, AND ITS DISCRIMINATION. The IDENTICAL `--finalize --confirm` call:
//   ARM A  while an UNEXPIRED certificate names CA1  -> REFUSES, and says why.
//   ARM B  after that certificate is re-signed by CA3 -> DROPS CA1 and CA2, keeps CA3.
// One sandbox, one call shape, opposite verdicts, driven only by the evidence.
// ══════════════════════════════════════════════════════════════════════════════════════════════
test("CB-3: --finalize keeps a CA an unexpired cert still names, and drops it once none does", async () => {
  const sb = makeSandbox();
  try {
    await provision(sb);
    const certFile = certPath(machinePubPath(sb.repoRoot, HOST));
    const ca1 = pubFingerprint(caPrivateKeyPath(sb.home) + ".pub");
    await runRotate(sb, { ports: ["ca-key"] });
    const ca2 = pubFingerprint(caPrivateKeyPath(sb.home) + ".pub");
    await runRotate(sb, { ports: ["ca-key"] });
    const ca3 = pubFingerprint(caPrivateKeyPath(sb.home) + ".pub");
    expect(trustedCaFingerprints(sb).sort()).toEqual([ca1, ca2, ca3].sort());
    expect(certSigningCa(certFile)).toBe(ca1); // the cert still names CA1, and is unexpired

    // ── ARM A: the sweep is PER-CA. CA1 is HELD (a live cert names it); CA2 signed nothing and is
    // pure trust-root surface, so it goes; CA3 is the active signer and is never a candidate. ──
    const promptsA: string[] = [];
    const a = await runRotate(sb, { ports: ["ca-key"], finalize: true, prompts: promptsA });
    const ra = a.res.rotations.find((x) => x.port === "ca-key")!;
    expect(ra.action).toBe("finalized");
    expect([...(ra.trust?.dropped ?? [])]).toEqual([ca2]);
    expect(trustedCaFingerprints(sb).sort()).toEqual([ca1, ca3].sort());
    expect(certSigningCa(certFile)).toBe(ca1);
    expect(trustedCaFingerprints(sb)).toContain(certSigningCa(certFile)); // the cert STILL verifies

    // THE AUTHORIZATION NAMES THE ACT — and names ONLY what is actually dropped.
    expect(promptsA.length).toBe(1);
    expect(promptsA[0]).toContain("FINALIZE");
    expect(promptsA[0]).toContain(ca2);
    expect(promptsA[0]).toContain("STOP verifying");
    expect(promptsA[0]).not.toContain(ca1);
    expect(promptsA[0]).not.toContain(ca3);

    // ── Change ONE fact: re-sign the cert under the current CA (CA3). ─────────────────────────
    await runRotate(sb, { ports: ["device-cert"] });
    expect(certSigningCa(certFile)).toBe(ca3);

    // ── ARM B: the SAME call now drops CA1 — the identical candidate, opposite verdict. ───────
    const promptsB: string[] = [];
    const b = await runRotate(sb, { ports: ["ca-key"], finalize: true, prompts: promptsB });
    const rb = b.res.rotations.find((x) => x.port === "ca-key")!;
    expect(rb.action).toBe("finalized");
    expect([...(rb.trust?.dropped ?? [])]).toEqual([ca1]);
    expect(trustedCaFingerprints(sb)).toEqual([ca3]);
    expect(b.staged.some((s) => s.relPath.endsWith("trusted-user-ca-keys.pub"))).toBe(true);
    expect(promptsB.length).toBe(1);
    expect(promptsB[0]).toContain(ca1);

    // ── ARM C: a third sweep has nothing left to do — and does NOT prompt. A gate fired for a
    // no-op is a gate people learn to approve without reading. ────────────────────────────────
    const promptsC: string[] = [];
    const c = await runRotate(sb, { ports: ["ca-key"], finalize: true, prompts: promptsC });
    expect(c.res.rotations.find((x) => x.port === "ca-key")!.action).toBe("finalize-refused");
    expect(c.res.rotations.find((x) => x.port === "ca-key")!.detail).toContain("ACTIVE signer");
    expect(promptsC.length).toBe(0);
    expect(c.staged.length).toBe(0);
    expect(trustedCaFingerprints(sb)).toEqual([ca3]);
  } finally {
    sb.cleanup();
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// CB-4 — EXPIRY IS THE VARIABLE, NOT PRESENCE. A certificate signed by CA1 stays on disk across
// both arms; only its validity window differs. Unexpired -> CA1 retained. Expired -> CA1 dropped.
// A census that merely counted "is there a cert naming this CA" would fail the second arm; one
// that ignored certs entirely would fail the first.
// ══════════════════════════════════════════════════════════════════════════════════════════════
test("CB-4: a cert whose window has CLOSED stops holding its CA in the trust set (expiry decides)", async () => {
  for (const [label, validity, expectDropped] of [
    ["unexpired dependant", "+52w", false],
    ["expired dependant", "-52w:-1w", true],
  ] as const) {
    const sb = makeSandbox();
    try {
      await provision(sb);
      // A SECOND machine's cert, signed by CA1, with the window under test.
      await signSecondMachineCert(sb, validity);
      const ca1 = pubFingerprint(caPrivateKeyPath(sb.home) + ".pub");
      await runRotate(sb, { ports: ["ca-key"] });
      const ca2 = pubFingerprint(caPrivateKeyPath(sb.home) + ".pub");
      // Re-sign the FIRST machine's cert under CA2 so the only thing still naming CA1 is the
      // second machine's certificate — whose expiry is the single variable across the two arms.
      await runRotate(sb, { ports: ["device-cert"] });
      expect(existsSync(certPath(machinePubPath(sb.repoRoot, OTHER_HOST)))).toBe(true);

      const r = await runRotate(sb, { ports: ["ca-key"], finalize: true });
      const rot = r.res.rotations.find((x) => x.port === "ca-key")!;
      const trusted = trustedCaFingerprints(sb);
      if (expectDropped) {
        expect(rot.action).toBe("finalized");
        expect(trusted).not.toContain(ca1);
        expect(trusted).toContain(ca2);
      } else {
        expect(rot.action).toBe("finalize-refused");
        expect(trusted).toContain(ca1);
        expect(trusted).toContain(ca2);
      }
      expect(label.length).toBeGreaterThan(0);
    } finally {
      sb.cleanup();
    }
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// CB-5 — FAIL-CLOSED ON MISSING OR DAMAGED EVIDENCE. Three ways the census can fail to support a
// drop, each paired with the arm that DOES drop, so "refuses" is never trivially true:
//   (a) the census doors were not wired at all       -> refuse
//   (b) a certificate file cannot be parsed          -> refuse (it might be the one that names it)
//   (c) the census found ZERO certificates           -> refuse (a wrong --repo-root looks like this)
// ══════════════════════════════════════════════════════════════════════════════════════════════
test("CB-5: finalize drops NOTHING without complete, non-empty census evidence", async () => {
  // (a) NO census doors.
  {
    const sb = makeSandbox();
    try {
      await provision(sb);
      const ca1 = pubFingerprint(caPrivateKeyPath(sb.home) + ".pub");
      await runRotate(sb, { ports: ["ca-key"] });
      await runRotate(sb, { ports: ["device-cert"] }); // nothing unexpired names CA1 any more
      const noDoors = await runRotate(sb, { ports: ["ca-key"], finalize: true, fxOpts: { noCensus: true } });
      expect(noDoors.res.rotations[0]!.action).toBe("finalize-refused");
      expect(noDoors.res.rotations[0]!.detail).toContain("no certificate census available");
      expect(trustedCaFingerprints(sb)).toContain(ca1);

      // DISCRIMINATION: the identical call WITH the doors drops it.
      const withDoors = await runRotate(sb, { ports: ["ca-key"], finalize: true });
      expect(withDoors.res.rotations[0]!.action).toBe("finalized");
      expect(trustedCaFingerprints(sb)).not.toContain(ca1);
    } finally {
      sb.cleanup();
    }
  }

  // (b) an UNPARSEABLE certificate poisons the census.
  {
    const sb = makeSandbox();
    try {
      await provision(sb);
      const ca1 = pubFingerprint(caPrivateKeyPath(sb.home) + ".pub");
      await runRotate(sb, { ports: ["ca-key"] });
      await runRotate(sb, { ports: ["device-cert"] });
      const junk = join(sb.repoRoot, "machines", "corrupt-cert.pub");
      writeFileSync(junk, "ssh-ed25519-cert-v01@openssh.com NOT-BASE64-AT-ALL\n");
      const poisoned = await runRotate(sb, { ports: ["ca-key"], finalize: true });
      expect(poisoned.res.rotations[0]!.action).toBe("finalize-refused");
      expect(poisoned.res.rotations[0]!.detail).toContain("census INCOMPLETE");
      expect(trustedCaFingerprints(sb)).toContain(ca1);

      // DISCRIMINATION: remove the one bad file and the identical call drops it.
      rmSync(junk);
      const clean = await runRotate(sb, { ports: ["ca-key"], finalize: true });
      expect(clean.res.rotations[0]!.action).toBe("finalized");
      expect(trustedCaFingerprints(sb)).not.toContain(ca1);
    } finally {
      sb.cleanup();
    }
  }

  // (c) an EMPTY census is not evidence of absence.
  {
    const sb = makeSandbox();
    try {
      await provision(sb);
      const ca1 = pubFingerprint(caPrivateKeyPath(sb.home) + ".pub");
      await runRotate(sb, { ports: ["ca-key"] });
      for (const f of readdirSync(join(sb.repoRoot, "machines"))) {
        if (f.endsWith("-cert.pub")) rmSync(join(sb.repoRoot, "machines", f));
      }
      const empty = await runRotate(sb, { ports: ["ca-key"], finalize: true });
      expect(empty.res.rotations[0]!.action).toBe("finalize-refused");
      expect(empty.res.rotations[0]!.detail).toContain("census found NO certificates");
      expect(trustedCaFingerprints(sb)).toContain(ca1);
    } finally {
      sb.cleanup();
    }
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// CB-6 — FINALIZE IS DEFAULT-SAFE and never rotates. A dry run names the drops and touches nothing;
// an unconfirmed run touches nothing; and neither ever mints a key. The CA private key fingerprint
// is identical before and after both, which is the check that "finalize does not rotate" is real.
// ══════════════════════════════════════════════════════════════════════════════════════════════
test("CB-6: --finalize is dry-run-safe, never prompts without --confirm, and rotates nothing", async () => {
  const sb = makeSandbox();
  try {
    await provision(sb);
    const ca1 = pubFingerprint(caPrivateKeyPath(sb.home) + ".pub");
    await runRotate(sb, { ports: ["ca-key"] });
    await runRotate(sb, { ports: ["device-cert"] });
    const activeBefore = pubFingerprint(caPrivateKeyPath(sb.home) + ".pub");
    const trustBefore = readFileSync(trustedUserCaKeysPath(sb.repoRoot, USER), "utf8");

    for (const mode of [{ dryRun: true, confirm: true }, { dryRun: false, confirm: false }]) {
      const prompts: string[] = [];
      const r = await runRotate(sb, { ports: ["ca-key"], finalize: true, prompts, ...mode });
      const rot = r.res.rotations.find((x) => x.port === "ca-key")!;
      expect(["would-finalize", "skipped-not-confirmed"]).toContain(rot.action);
      expect(prompts.length).toBe(0);
      expect(r.staged.length).toBe(0);
      expect(readFileSync(trustedUserCaKeysPath(sb.repoRoot, USER), "utf8")).toBe(trustBefore);
      expect(pubFingerprint(caPrivateKeyPath(sb.home) + ".pub")).toBe(activeBefore);
    }
    // The dry run NAMED what it would do — a plan nobody can read is not a plan.
    const dry = await runRotate(sb, { ports: ["ca-key"], finalize: true, dryRun: true });
    expect(formatRotate(dry.res)).toContain(ca1);
    expect(formatRotate(dry.res)).toContain("Re-run with --confirm");

    // DISCRIMINATION: the confirmed run does what the dry run described.
    const real = await runRotate(sb, { ports: ["ca-key"], finalize: true });
    expect(real.res.rotations[0]!.action).toBe("finalized");
    expect(trustedCaFingerprints(sb)).not.toContain(ca1);
  } finally {
    sb.cleanup();
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// CB-7 — THE READOUT REPORTS THE MEASUREMENT. A rotation says VERIFIED with counts; a finalize
// says NARROWED and names what left; and the two are DIFFERENT STRINGS on runs with different
// truth values. That difference is the whole repair to the old unconditional guarantee line.
// ══════════════════════════════════════════════════════════════════════════════════════════════
test("CB-7: the readout distinguishes a verified rotation from a deliberate narrowing", async () => {
  const sb = makeSandbox();
  try {
    await provision(sb);
    const r1 = await runRotate(sb, { ports: ["ca-key"] });
    const r2 = await runRotate(sb, { ports: ["ca-key"] });
    const rotationReadout = formatRotate(r2.res);
    expect(rotationReadout).toContain("∅-blast-radius VERIFIED");
    expect(rotationReadout).toContain("0 dropped");
    expect(rotationReadout).not.toContain("NOT ESTABLISHED");
    // Both rotations verified — but the counts DIFFER, so the line carries information about the
    // run rather than being a constant (which is exactly what the old line was).
    expect(formatRotate(r1.res)).not.toBe(rotationReadout);

    await runRotate(sb, { ports: ["device-cert"] });
    const fin = await runRotate(sb, { ports: ["ca-key"], finalize: true });
    const finalizeReadout = formatRotate(fin.res);
    expect(finalizeReadout).toContain("Trust set NARROWED on purpose");
    expect(finalizeReadout).not.toContain("∅-blast-radius VERIFIED");

    // A run that never touched the trust set makes NO claim about it.
    const machineOnly = await runRotate(sb, { ports: ["machine-key"] });
    expect(formatRotate(machineOnly.res)).not.toContain("∅-blast-radius");
  } finally {
    sb.cleanup();
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// CB-8 — THE RETIRED ARCHIVE REFUSES RATHER THAN CLOBBERS. `allocateRetiredSlot` hands back the
// first FREE generation; when every generation is occupied it THROWS. Destroying retired key
// material is `export-or-destroy-key` in ceremony-gate.ts — a ceremony, never a rename.
// ══════════════════════════════════════════════════════════════════════════════════════════════
test("CB-8: retired slots are generational, and a full archive refuses instead of overwriting", () => {
  const occupied = new Set<string>();
  const fx = { exists: (p: string) => occupied.has(p) } as unknown as RotateEffects;
  const base = retiredCaKeyPath("/nowhere");

  expect(allocateRetiredSlot(fx, base)).toBe(base);
  occupied.add(base);
  expect(allocateRetiredSlot(fx, base)).toBe(base + ".2");
  occupied.add(base + ".2");
  occupied.add(base + ".3.pub"); // a stray PUBLIC half alone still counts as occupied
  expect(allocateRetiredSlot(fx, base)).toBe(base + ".4");

  const full = { exists: () => true } as unknown as RotateEffects;
  expect(() => allocateRetiredSlot(full, base)).toThrow(/Refusing to overwrite retired key material/);
  expect(MAX_RETIRED_GENERATIONS).toBeGreaterThan(1);
});
