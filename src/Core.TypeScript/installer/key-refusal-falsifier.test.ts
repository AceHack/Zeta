/**
 * key-refusal-falsifier.test.ts — the end-to-end refusal test, through the SHIPPED CLIs.
 *
 * WHY THIS EXISTS, AND WHY THE EXISTING TESTS DID NOT COVER IT
 *
 * The claim the whole USB design rests on is: *credentials are USB- and machine-specific;
 * a key lifted off one device is useless on another.* Before this file, that claim was
 * supported by two things, neither of which is this test:
 *
 *  - `credential-binding-model.test.ts` — strong, 23 of 24 factor x scenario cells reach real
 *    crypto. But it tests the MODEL: scenarios are simulated by mutating a fixture context
 *    object in-process. Nothing spawns the tools an operator actually runs.
 *  - `zeta-creds-persist-restore.test.ts` — covers `planRestore` with a wrong UUID at the
 *    library level, in-process.
 *
 * So the shipped path — `bun zeta-creds-persist.ts` writes a blob on machine A, `bun
 * zeta-creds-restore.ts` reads it on machine B — was never once executed across an identity
 * boundary. That is exactly the seam where a refusal is most likely to be lost: a wrapper that
 * swallows an exit code, a CLI that warns instead of failing, a plan that reports an error and
 * writes the files anyway.
 *
 * These run the real binaries as subprocesses and assert on exit codes and on the filesystem.
 *
 * WHAT THIS DOES AND DOES NOT PROVE
 *
 * Proves: the persist/restore CLI pair refuses a foreign identity, refuses it in the same way
 * for every semantically wrong identity shape, and writes NOTHING when it refuses. Boundary
 * whitespace is refused as MALFORMED INPUT before key derivation -- neither silently trimmed
 * into a valid identity nor silently accepted as a different one.
 *
 * Does NOT prove: that the machine-identity FACTOR is read correctly from real hardware.
 * `getPartitionUuid` shells out to `diskutil` (macOS-only), and no test presents a key to a
 * genuinely different physical machine. That remains the one honest gap, and it wants a
 * deliberate hardware cycle rather than another in-process fixture. Naming it here so the
 * presence of this file is not mistaken for closing it.
 */

import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");
const PERSIST = join(REPO_ROOT, "src", "Core.TypeScript", "installer", "zeta-creds-persist.ts");
const RESTORE = join(REPO_ROOT, "src", "Core.TypeScript", "installer", "zeta-creds-restore.ts");

/** Machine/USB identity A — the device the credential is bound to. */
const IDENTITY_A = "AAAAAAAA-1111-2222-3333-444444444444";
/** Machine/USB identity B — a different device entirely. The attacker's, or an RMA replacement. */
const IDENTITY_B = "BBBBBBBB-9999-8888-7777-666666666666";

const PASSPHRASE = "correct horse battery staple";
const SECRET = "TEST-FIXTURE-NOT-A-REAL-TOKEN-deadbeef";

function scratch(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

/** Run a shipped CLI exactly as an operator would, returning its real exit code. */
function runCli(
  script: string,
  args: readonly string[],
  env: Record<string, string> = {},
): { status: number; stdout: string; stderr: string } {
  const result = spawnSync("bun", [script, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    timeout: 120_000,
    env: { ...process.env, ...env },
  });
  return {
    status: result.status ?? -1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

/** Persist a blob bound to `identity`. Returns the blob path. */
function persistBoundTo(identity: string): string {
  const dir = scratch("zcreds-persist-");
  const blob = join(dir, "zeta-creds.enc");
  const result = runCli(
    PERSIST,
    [
      "--usb-uuid", identity,
      "--output", blob,
      "--passphrase-env", "ZETA_TEST_PASSPHRASE",
      "--bake-cred", `gh-cli=${SECRET}`,
    ],
    { ZETA_TEST_PASSPHRASE: PASSPHRASE },
  );
  if (result.status !== 0) {
    throw new Error(`persist failed (${result.status}): ${result.stderr || result.stdout}`);
  }
  if (!existsSync(blob)) throw new Error("persist reported success but wrote no blob");
  return blob;
}

/** Attempt a restore of `blob` using `identity`, into a fresh target root. */
function attemptRestore(
  blob: string,
  identity: string,
  passphrase = PASSPHRASE,
): { status: number; stdout: string; stderr: string; targetRoot: string } {
  const targetRoot = scratch("zcreds-target-");
  const result = runCli(
    RESTORE,
    [
      "--usb-uuid", identity,
      "--input", blob,
      "--passphrase-env", "ZETA_TEST_PASSPHRASE",
      "--target-root", targetRoot,
    ],
    { ZETA_TEST_PASSPHRASE: passphrase },
  );
  return { ...result, targetRoot };
}

/** Every file written anywhere under a target root, recursively. */
function filesUnder(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(full);
    }
  };
  if (existsSync(root)) walk(root);
  return out;
}

describe("POSITIVE CONTROL — the same identity still works", () => {
  test("a blob restores on the device it was bound to", () => {
    // Without this, every refusal below could be a broken pipeline rather than a working
    // guard. A test that only ever proves failure cannot distinguish a lock from a brick.
    const blob = persistBoundTo(IDENTITY_A);
    const result = attemptRestore(blob, IDENTITY_A);
    expect(result.status).toBe(0);
    expect(filesUnder(result.targetRoot).length).toBeGreaterThan(0);
  });

  test("the restored secret is the ACTUAL secret, byte for byte", () => {
    // A restore that "succeeds" while writing garbage is worse than one that fails, and exit
    // code 0 alone cannot tell the difference.
    const blob = persistBoundTo(IDENTITY_A);
    const result = attemptRestore(blob, IDENTITY_A);
    const written = filesUnder(result.targetRoot).map((f) => readFileSync(f, "utf8")).join("\n");
    expect(written).toContain(SECRET);
  });
});

describe("THE FALSIFIER — a key presented to a foreign device is refused", () => {
  test("restore on a DIFFERENT device fails, and fails as a decrypt refusal", () => {
    // The claim, exercised through the shipped binaries: bound on A, presented on B.
    // Code 5 is the decrypt refusal — the AEAD tag rejects, which is the cryptographic
    // guarantee rather than a policy check someone can be talked out of.
    const blob = persistBoundTo(IDENTITY_A);
    const result = attemptRestore(blob, IDENTITY_B);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toMatch(/decrypt|5/);
  });

  test("the refused restore writes NOTHING — no partial credential on the foreign device", () => {
    // The failure that would matter most in practice: a refusal that still leaves fragments
    // behind. A partially-written credential on an attacker's machine is a leak whether or
    // not the process exited non-zero.
    const blob = persistBoundTo(IDENTITY_A);
    const result = attemptRestore(blob, IDENTITY_B);
    expect(result.status).not.toBe(0);
    expect(filesUnder(result.targetRoot)).toEqual([]);
  });

  test("the plaintext secret never appears in output on refusal", () => {
    // An error message that helpfully echoes what it failed to decrypt would hand over the
    // thing the refusal exists to protect.
    const blob = persistBoundTo(IDENTITY_A);
    const result = attemptRestore(blob, IDENTITY_B);
    expect(`${result.stdout}${result.stderr}`).not.toContain(SECRET);
  });
});

describe("binding identity distinguishes semantic changes from malformed input", () => {
  // The verdict-column shape is #11112's and it is an improvement worth keeping: it makes
  // the reason for each refusal legible instead of asserting one blanket outcome. What
  // changed is the whitespace row's verdict and the reason attached to it.
  //
  // HISTORY, because this row has now been wrong twice in opposite directions and the next
  // reader deserves the whole sequence rather than the current answer alone:
  //
  //   #11016  trimmed the KDF input, so `<A> ` and `<A>` derived the SAME key. The blob
  //           bound to one opened on the other.
  //   #11111  removed the trim. Correct on key material, but it left `<A> ` as a silently
  //           accepted DIFFERENT binding -- so an operator who bound with a stray space
  //           and later typed it without one was locked out with no diagnosis.
  //   #11112  read the trim as intended behaviour and set this row to "normalized". It was
  //           written against the pre-#11111 selector and landed minutes after the fix, so
  //           the contract it recorded was the defect's behaviour, not a chosen design.
  //   now     the selector REJECTS boundary whitespace with an error, which is why this row
  //           is "refused" again -- but for a different reason than the rows above it.
  //
  // So the two verdicts here are not one rule: "refused" above means the AEAD tag rejected
  // a foreign identity; "refused" for whitespace means the CLI would not accept a malformed
  // value in the first place. Both write nothing, which is what this file asserts.
  const identityCases: readonly [string, string, "refused" | "malformed"][] = [
    ["a different device", IDENTITY_B, "refused"],
    ["empty identity", "", "refused"],
    ["identity of the right shape but all zeroes", "00000000-0000-0000-0000-000000000000", "refused"],
    ["identity A with one character changed", IDENTITY_A.replace(/.$/, "5"), "refused"],
    ["identity A with case flipped", IDENTITY_A.toLowerCase(), "refused"],
    ["identity A with trailing boundary whitespace", `${IDENTITY_A} `, "malformed"],
  ];

  for (const [label, identity, expected] of identityCases) {
    test(`${expected}: ${label}`, () => {
      // Uniform refusal matters for semantic near-misses: behaving differently would reveal
      // that an attacker is close. Whitespace is not a near-miss identity -- no probe can
      // emit one (see probe-canonicalization-is-the-single-authority in
      // installer-binding-cli.test.ts) -- so it is rejected as malformed input rather than
      // silently rewritten into a valid one.
      const blob = persistBoundTo(IDENTITY_A);
      const result = attemptRestore(blob, identity);
      expect(result.status).not.toBe(0);
      expect(filesUnder(result.targetRoot)).toEqual([]);

      if (expected === "malformed") {
        // The distinguishing claim: refused BEFORE any key derivation, with a diagnosis.
        // Asserted so "reject" cannot quietly decay back into "accept and fail at the tag",
        // which would restore the silent-lockout footgun this verdict exists to remove.
        expect(`${result.stdout}${result.stderr}`).toMatch(/whitespace/i);
      }
    });
  }
});

describe("the passphrase is a SECOND factor, not an alternative to the device", () => {
  test("right device + wrong passphrase is refused", () => {
    const blob = persistBoundTo(IDENTITY_A);
    const result = attemptRestore(blob, IDENTITY_A, "Tr0ub4dor&3");
    expect(result.status).not.toBe(0);
    expect(filesUnder(result.targetRoot)).toEqual([]);
  });

  test("wrong device + RIGHT passphrase is still refused", () => {
    // The load-bearing half of two-factor. If knowing the passphrase were sufficient, the
    // device binding would be decoration, and a leaked passphrase would be a total
    // compromise rather than one of two required factors.
    const blob = persistBoundTo(IDENTITY_A);
    const result = attemptRestore(blob, IDENTITY_B, PASSPHRASE);
    expect(result.status).not.toBe(0);
    expect(filesUnder(result.targetRoot)).toEqual([]);
  });
});

describe("a tampered blob is refused rather than partially trusted", () => {
  test("flipping one byte of the envelope is refused on the CORRECT device", () => {
    // AEAD integrity, through the shipped path. A blob edited in transit must not decrypt
    // even when presented on the device it was genuinely bound to.
    const blob = persistBoundTo(IDENTITY_A);
    const bytes = readFileSync(blob);
    const target = Math.floor(bytes.length / 2);
    bytes[target] = bytes[target]! ^ 0x01;
    writeFileSync(blob, bytes);

    const result = attemptRestore(blob, IDENTITY_A);
    expect(result.status).not.toBe(0);
    expect(filesUnder(result.targetRoot)).toEqual([]);
  });

  test("a truncated blob is refused, not partially applied", () => {
    const blob = persistBoundTo(IDENTITY_A);
    const bytes = readFileSync(blob);
    writeFileSync(blob, bytes.subarray(0, Math.floor(bytes.length / 2)));

    const result = attemptRestore(blob, IDENTITY_A);
    expect(result.status).not.toBe(0);
    expect(filesUnder(result.targetRoot)).toEqual([]);
  });
});

describe("RMA / re-provision — the documented tradeoff, made explicit", () => {
  test("a fresh device gets a fresh binding; the old blob stays useless to it", () => {
    // Aaron 2026-08-01: "there are RMA processes of course but this makes full wipes of data
    // and all keys are lost." That is the intended behaviour, so it gets a test rather than
    // living only in prose — a future change that made old blobs portable to replacement
    // hardware would be a convenience improvement AND a silent removal of the guarantee.
    const oldBlob = persistBoundTo(IDENTITY_A);

    // Replacement device cannot use the old credential.
    const denied = attemptRestore(oldBlob, IDENTITY_B);
    expect(denied.status).not.toBe(0);
    expect(filesUnder(denied.targetRoot)).toEqual([]);

    // But it can be provisioned fresh, and then works on its own terms.
    const newBlob = persistBoundTo(IDENTITY_B);
    const allowed = attemptRestore(newBlob, IDENTITY_B);
    expect(allowed.status).toBe(0);
    expect(filesUnder(allowed.targetRoot).length).toBeGreaterThan(0);
  });

  test("the two devices' blobs are not interchangeable in EITHER direction", () => {
    // Symmetry: neither device is privileged. A test that only checked A->B could miss a
    // binding that happens to be one-way.
    const blobA = persistBoundTo(IDENTITY_A);
    const blobB = persistBoundTo(IDENTITY_B);

    expect(attemptRestore(blobA, IDENTITY_B).status).not.toBe(0);
    expect(attemptRestore(blobB, IDENTITY_A).status).not.toBe(0);
  });
});
