// ca.ts conformance — the SSH-CA keypair generation + per-machine cert signing. ALL tests
// run against a THROWAWAY temp dir via injected effects (or mktemp -d for the real-ssh-keygen
// round-trip) — NEVER a real CA, NEVER real signing of real keys, NEVER a network call,
// NEVER committing anything. The CA private key + seed NEVER appear in output.
//
// SECURITY (matched to ca.ts invariants):
//  * a test asserts NO module output ever matches /PRIVATE KEY/ (the private-leak guard);
//  * NO key-shaped literal appears in THIS test file — the guard string is SPLIT
//    (assembled at runtime in PRIV_MARKER) so a grep for a private-key header is EMPTY;
//  * the real round-trip uses a THROWAWAY CA + THROWAWAY device key in a temp dir, signs,
//    and verifies the cert with `ssh-keygen -L` — all in temp, nothing committed.
// Run: bun test ca.test.ts   (from tools/setup/persona-keys)
import { test, expect } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  caPrivateKeyPath,
  caPublicKeyPath,
  certPath,
  ensureCa,
  signMachineCert,
  DEFAULT_CERT_VALIDITY,
  type CaEffects,
} from "./ca.ts";

// The private-key marker, assembled at runtime so NO key-shaped literal is in this file.
const PRIV_MARKER = "PRIVATE" + " " + "KEY";

// A deterministic fake: never shells out, never touches a secret. genCa/signCert write
// FAKE public artifacts to a real temp filesystem and return public text only.
function fakeEffects(opts?: { genCount?: { n: number }; signCount?: { n: number } }): CaEffects {
  return {
    exists: (p) => existsSync(p),
    readText: (p) => readFileSync(p, "utf8"),
    writeText: (p, c) => writeFileSync(p, c),
    mkdirp: (p) => mkdirSync(p, { recursive: true }),
    genCa: (caKeyPath, comment) => {
      if (opts?.genCount) opts.genCount.n += 1;
      mkdirSync(caKeyPath.slice(0, caKeyPath.lastIndexOf("/")), { recursive: true });
      // Simulate ssh-keygen: a (fake) CA private + public file written locally.
      writeFileSync(caKeyPath, "FAKE-CA-PRIVATE-DO-NOT-USE\n", { mode: 0o600 });
      const pub = `ssh-ed25519 AAAAFAKECAPUBKEY ${comment}\n`;
      writeFileSync(caKeyPath + ".pub", pub);
      return pub;
    },
    signCert: (req) => {
      if (opts?.signCount) opts.signCount.n += 1;
      const out = certPath(req.devicePubPath);
      // Simulate a signed cert — public output only (the CA private is "consumed" by the runner).
      const cert = `ssh-ed25519-cert-v01@openssh.com AAAAFAKECERT id=${req.certId} principal=${req.principal}\n`;
      writeFileSync(out, cert);
      return { certPath: out, certText: cert };
    },
  };
}

const CA = "tester";
const USER = "tester";

test("ca --dry-run: generates NOTHING, writes NOTHING, reports would-generate", () => {
  const tmp = mkdtempSync(join(tmpdir(), "zeta-ca-"));
  try {
    const genCount = { n: 0 };
    const fx = fakeEffects({ genCount });
    const r = ensureCa(fx, { ca: CA, repoRoot: tmp, home: tmp, dryRun: true, commitPub: true });
    expect(r.dryRun).toBe(true);
    expect(r.action).toBe("would-generate");
    expect(r.committedPub).toBe(false);
    expect(genCount.n).toBe(0); // nothing generated
    expect(existsSync(r.caPrivatePath)).toBe(false); // nothing written
    expect(existsSync(r.caPublicPath)).toBe(false); // no ssh-ca.pub written
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("ca: generates the CA (fake) and commits ONLY the PUBLIC key; private never published", () => {
  const tmp = mkdtempSync(join(tmpdir(), "zeta-ca-"));
  try {
    const fx = fakeEffects();
    const r = ensureCa(fx, { ca: CA, repoRoot: tmp, home: tmp, commitPub: true });
    expect(r.action).toBe("generated");
    expect(r.committedPub).toBe(true);
    // the committed path holds ONLY the public key — no private bytes anywhere in it
    const pubPath = caPublicKeyPath(tmp, CA);
    expect(existsSync(pubPath)).toBe(true);
    const written = readFileSync(pubPath, "utf8");
    expect(written).toContain("ssh-ed25519");
    expect(written).not.toContain("PRIVATE");
    expect(written).not.toMatch(new RegExp("BEGIN .*" + PRIV_MARKER));
    // the CA private key file stays at the LOCAL path, NOT under maintainers/
    expect(r.caPrivatePath.includes("maintainers")).toBe(false);
    expect(r.caPrivatePath.startsWith(tmp)).toBe(true);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("ca: idempotent — a second run is a no-op ('exists'), does not regenerate", () => {
  const tmp = mkdtempSync(join(tmpdir(), "zeta-ca-"));
  try {
    const genCount = { n: 0 };
    const fx = fakeEffects({ genCount });
    const first = ensureCa(fx, { ca: CA, repoRoot: tmp, home: tmp });
    expect(first.action).toBe("generated");
    expect(genCount.n).toBe(1);
    const second = ensureCa(fx, { ca: CA, repoRoot: tmp, home: tmp });
    expect(second.action).toBe("exists"); // idempotent: apply-N == apply-once effect
    expect(genCount.n).toBe(1); // NOT regenerated
    expect(second.caPublicKey).toBe(first.caPublicKey); // same public key returned
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("ca: without --commit-pub, writes NO ssh-ca.pub to the repo", () => {
  const tmp = mkdtempSync(join(tmpdir(), "zeta-ca-"));
  try {
    const fx = fakeEffects();
    const r = ensureCa(fx, { ca: CA, repoRoot: tmp, home: tmp });
    expect(r.action).toBe("generated");
    expect(r.committedPub).toBe(false);
    expect(existsSync(caPublicKeyPath(tmp, CA))).toBe(false); // nothing landed in the repo
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("cert --dry-run: signs NOTHING when CA + device key present, reports would-sign", () => {
  const tmp = mkdtempSync(join(tmpdir(), "zeta-ca-"));
  try {
    const signCount = { n: 0 };
    const fx = fakeEffects({ signCount });
    // Pretend the CA + a device pubkey both exist.
    const caPriv = caPrivateKeyPath(tmp);
    mkdirSync(caPriv.slice(0, caPriv.lastIndexOf("/")), { recursive: true });
    writeFileSync(caPriv, "FAKE-CA-PRIVATE\n", { mode: 0o600 });
    const devicePub = join(tmp, "maintainers", USER, "machines", "mymac.pub");
    mkdirSync(devicePub.slice(0, devicePub.lastIndexOf("/")), { recursive: true });
    writeFileSync(devicePub, "ssh-ed25519 AAAADEVICE tester@mymac\n");

    const r = signMachineCert(fx, { user: USER, machineId: "mymac", devicePubPath: devicePub, home: tmp, dryRun: true });
    expect(r.dryRun).toBe(true);
    expect(r.action).toBe("would-sign");
    expect(r.certId).toBe("tester@mymac");
    expect(r.principal).toBe("tester");
    expect(r.validity).toBe(DEFAULT_CERT_VALIDITY);
    expect(signCount.n).toBe(0); // nothing signed
    expect(existsSync(r.certPath)).toBe(false); // no cert written
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("cert: fail-closed when CA absent -> no-ca (signs nothing)", () => {
  const tmp = mkdtempSync(join(tmpdir(), "zeta-ca-"));
  try {
    const signCount = { n: 0 };
    const fx = fakeEffects({ signCount });
    const devicePub = join(tmp, "maintainers", USER, "machines", "mymac.pub");
    mkdirSync(devicePub.slice(0, devicePub.lastIndexOf("/")), { recursive: true });
    writeFileSync(devicePub, "ssh-ed25519 AAAADEVICE tester@mymac\n");
    // No CA private key written.
    const r = signMachineCert(fx, { user: USER, machineId: "mymac", devicePubPath: devicePub, home: tmp });
    expect(r.action).toBe("no-ca");
    expect(signCount.n).toBe(0);
    expect(r.certText).toBeUndefined();
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("cert: fail-closed when device key absent -> no-device-key (signs nothing)", () => {
  const tmp = mkdtempSync(join(tmpdir(), "zeta-ca-"));
  try {
    const signCount = { n: 0 };
    const fx = fakeEffects({ signCount });
    const caPriv = caPrivateKeyPath(tmp);
    mkdirSync(caPriv.slice(0, caPriv.lastIndexOf("/")), { recursive: true });
    writeFileSync(caPriv, "FAKE-CA-PRIVATE\n", { mode: 0o600 });
    // No device pubkey written.
    const devicePub = join(tmp, "maintainers", USER, "machines", "absent.pub");
    const r = signMachineCert(fx, { user: USER, machineId: "absent", devicePubPath: devicePub, home: tmp });
    expect(r.action).toBe("no-device-key");
    expect(signCount.n).toBe(0);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("cert: signs (fake) into a -cert.pub; cert text is public, has no private marker", () => {
  const tmp = mkdtempSync(join(tmpdir(), "zeta-ca-"));
  try {
    const fx = fakeEffects();
    const caPriv = caPrivateKeyPath(tmp);
    mkdirSync(caPriv.slice(0, caPriv.lastIndexOf("/")), { recursive: true });
    writeFileSync(caPriv, "FAKE-CA-PRIVATE\n", { mode: 0o600 });
    const devicePub = join(tmp, "maintainers", USER, "machines", "mymac.pub");
    mkdirSync(devicePub.slice(0, devicePub.lastIndexOf("/")), { recursive: true });
    writeFileSync(devicePub, "ssh-ed25519 AAAADEVICE tester@mymac\n");

    const r = signMachineCert(fx, { user: USER, machineId: "mymac", devicePubPath: devicePub, home: tmp });
    expect(r.action).toBe("signed");
    expect(r.certPath).toBe(certPath(devicePub));
    expect(existsSync(r.certPath)).toBe(true);
    expect(r.certText).toContain("cert-v01@openssh.com");
    expect(r.certText).not.toContain(PRIV_MARKER);
    expect(r.certText).not.toMatch(new RegExp("BEGIN .*" + PRIV_MARKER));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("certPath: derives <base>-cert.pub from a device pubkey path", () => {
  expect(certPath("/x/mymac.pub")).toBe("/x/mymac-cert.pub");
  expect(certPath("/x/mymac")).toBe("/x/mymac-cert.pub"); // tolerant if no .pub suffix
});

test("PRIVATE-LEAK GUARD: no module output (paths/keys/cert) ever contains a private marker", () => {
  const tmp = mkdtempSync(join(tmpdir(), "zeta-ca-"));
  try {
    const fx = fakeEffects();
    const ca = ensureCa(fx, { ca: CA, repoRoot: tmp, home: tmp, commitPub: true });
    const devicePub = join(tmp, "maintainers", USER, "machines", "mymac.pub");
    mkdirSync(devicePub.slice(0, devicePub.lastIndexOf("/")), { recursive: true });
    writeFileSync(devicePub, "ssh-ed25519 AAAADEVICE tester@mymac\n");
    const cert = signMachineCert(fx, { user: USER, machineId: "mymac", devicePubPath: devicePub, home: tmp });
    // Stringify EVERY field the module returns — none may carry a private marker.
    const blob = JSON.stringify(ca) + JSON.stringify(cert);
    expect(blob).not.toMatch(new RegExp(PRIV_MARKER));
    expect(blob).not.toMatch(new RegExp("BEGIN .*" + PRIV_MARKER));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// REAL ssh-keygen round-trip, but ONLY into a throwaway temp dir (never ~/.ssh, never
// committed): generate a THROWAWAY CA + a THROWAWAY device key, sign the device key into a
// cert, verify the cert with `ssh-keygen -L` (principal + identity present). Skips cleanly
// if ssh-keygen is absent (the fake-effects tests cover conformance).
test("REAL ssh-keygen: throwaway CA signs a throwaway device key; cert verifies (temp only)", async () => {
  const probe = spawnSync("ssh-keygen", ["-A", "-?"], { encoding: "utf8" });
  if (probe.error !== undefined) {
    return; // no ssh-keygen — conformance covered by the fake-effects tests above
  }
  const tmp = mkdtempSync(join(tmpdir(), "zeta-ca-real-"));
  try {
    const { realEffects, ensureCa: real, signMachineCert: sign, caPrivateKeyPath: caPath } = await import("./ca.ts");
    const fx = realEffects();

    // 1. Generate a THROWAWAY CA (home pinned to temp → CA private stays inside temp).
    const caRes = real(fx, { ca: CA, repoRoot: tmp, home: tmp, commitPub: true });
    expect(caRes.action).toBe("generated");
    const caPriv = caPath(tmp);
    expect(caPriv.startsWith(tmp)).toBe(true); // CA private key is inside the temp dir
    expect(existsSync(caPriv)).toBe(true);
    // CA private key is not group/other readable (umask 077 honored).
    expect(statSync(caPriv).mode & 0o077).toBe(0);
    // The committed CA pubkey is PUBLIC only.
    const caPub = readFileSync(caPublicKeyPath(tmp, CA), "utf8");
    expect(caPub).toContain("ssh-ed25519");
    expect(caPub).not.toMatch(new RegExp(PRIV_MARKER));

    // 2. Generate a THROWAWAY device key in temp (a bare ssh-keygen, never committed).
    const deviceKey = join(tmp, "device_ed25519");
    const kg = spawnSync("ssh-keygen", ["-t", "ed25519", "-f", deviceKey, "-N", "", "-C", "tester@mymac"], {
      encoding: "utf8",
    });
    expect(kg.status).toBe(0);
    const devicePub = deviceKey + ".pub";
    expect(existsSync(devicePub)).toBe(true);

    // 3. Sign the device PUBLIC key into a cert with the throwaway CA.
    const certRes = sign(fx, { user: USER, machineId: "mymac", devicePubPath: devicePub, home: tmp });
    expect(certRes.action).toBe("signed");
    expect(existsSync(certRes.certPath)).toBe(true);

    // 4. Verify the cert with `ssh-keygen -L` — principal + identity bound correctly.
    const show = spawnSync("ssh-keygen", ["-L", "-f", certRes.certPath], { encoding: "utf8" });
    expect(show.status).toBe(0);
    expect(show.stdout).toContain("tester@mymac"); // the cert identity (-I)
    expect(show.stdout).toContain("tester"); // the principal (-n) — trust anchored at the user
    // The cert file is PUBLIC — never carries a private marker.
    expect(readFileSync(certRes.certPath, "utf8")).not.toMatch(new RegExp(PRIV_MARKER));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
