// zeta-creds-persist-restore.test.ts — 081KSKBP80008QG0R003AX2A69.2b CLI integration tests.
//
// Covers the full persist → restore round-trip via temp-dir filesystem
// (not just pure-function units; the CLI surfaces have FS I/O).

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildBlob, composeBundle, parseArgs as parsePersistArgs, writePersistOutputs } from "./zeta-creds-persist";
import { bindingFactorSidecarPath } from "./installer-binding-cli.ts";
import { applyPlan, parseArgs as parseRestoreArgs, planRestore, resolveCredPaths } from "./zeta-creds-restore";
import { DEFAULT_MANIFEST } from "./zeta-creds-manifest";

const UUID = "test-uuid-1234-5678-9abc";
const PASS = "integration-test-passphrase";

describe("parsePersistArgs", () => {
  it("accepts well-formed args with --passphrase-env", () => {
    const result = parsePersistArgs(
      ["--usb-uuid", UUID, "--output", "/tmp/blob", "--passphrase-env", "TP", "--bake-cred", "gh-cli=ghp_x"],
      { TP: PASS },
    );
    if ("error" in result) throw new Error(result.error);
    expect(result.usbUuid).toBe(UUID);
    expect(result.output).toBe("/tmp/blob");
    expect(result.passphrase).toBe(PASS);
    expect(result.bakeCredArgs.length).toBe(1);
  });

  it("rejects missing binding factor", () => {
    const result = parsePersistArgs(["--output", "/tmp/x", "--passphrase-env", "PP"], { PP: "x" });
    expect("error" in result).toBe(true);
  });

  it("accepts --usb-iserial without --usb-uuid", () => {
    const result = parsePersistArgs(
      ["--usb-iserial", "ZETA-STICK-001", "--output", "/tmp/blob", "--passphrase-env", "TP"],
      { TP: PASS },
    );
    if ("error" in result) throw new Error(result.error);
    expect(result.bindingMaterial).toBe("ZETA-STICK-001");
    expect(result.usbISerial).toBe("ZETA-STICK-001");
    expect(result.bindingFactor).toBe("usbISerial");
  });

  it("accepts --uefi-keyfile without --usb-uuid", () => {
    const dir = mkdtempSync(join(tmpdir(), "zcreds-keyfile-"));
    const keyfile = join(dir, "keyfile");
    writeFileSync(keyfile, Buffer.alloc(32, 0xab));
    const result = parsePersistArgs(["--uefi-keyfile", keyfile, "--output", "/tmp/blob", "--passphrase-env", "TP"], {
      TP: PASS,
    });
    if ("error" in result) throw new Error(result.error);
    expect(result.bindingFactor).toBe("uefiKeyfile");
    expect(result.bindingMaterial).toBe("ab".repeat(32));
  });

  it("rejects missing --output", () => {
    const result = parsePersistArgs(["--usb-uuid", UUID, "--passphrase-env", "PP"], { PP: "x" });
    expect("error" in result).toBe(true);
  });

  it("rejects empty --passphrase-env", () => {
    const result = parsePersistArgs(["--usb-uuid", UUID, "--output", "/tmp/x", "--passphrase-env", "MISSING"], {});
    expect("error" in result).toBe(true);
  });

  it("rejects unknown flag", () => {
    const result = parsePersistArgs(["--bogus"], {});
    expect("error" in result).toBe(true);
  });
});

describe("composeBundle", () => {
  it("composes global cred (gh-cli; personaScoped:false)", () => {
    const args = {
      usbUuid: UUID,
      output: "x",
      passphrase: PASS,
      persona: null,
      bakeCredArgs: ["gh-cli=test-token-value"],
    };
    const bundle = composeBundle(args);
    if ("error" in bundle) throw new Error(bundle.error);
    expect(bundle.globalCreds["gh-cli"]).toBeDefined();
    expect(Object.keys(bundle.personaCreds).length).toBe(0);
  });

  it("composes persona cred when --persona given", () => {
    const args = {
      usbUuid: UUID,
      output: "x",
      passphrase: PASS,
      persona: "otto",
      bakeCredArgs: ['claude={"creds":"value"}'],
    };
    const bundle = composeBundle(args);
    if ("error" in bundle) throw new Error(bundle.error);
    expect(bundle.personaCreds.otto!.claude).toBeDefined();
  });

  it("rejects personaScoped cred without --persona", () => {
    const args = {
      usbUuid: UUID,
      output: "x",
      passphrase: PASS,
      persona: null,
      bakeCredArgs: ['claude={"creds":"value"}'],
    };
    const result = composeBundle(args);
    expect("error" in result).toBe(true);
  });

  it("rejects unknown cred id", () => {
    const args = {
      usbUuid: UUID,
      output: "x",
      passphrase: PASS,
      persona: null,
      bakeCredArgs: ["nonexistent=value"],
    };
    const result = composeBundle(args);
    expect("error" in result).toBe(true);
  });

  it("empty bake list is a valid empty envelope (QEMU --defer-all)", () => {
    const bundle = composeBundle({ persona: null, bakeCredArgs: [] });
    if ("error" in bundle) throw new Error(bundle.error);
    expect(Object.keys(bundle.globalCreds)).toEqual([]);
    expect(Object.keys(bundle.personaCreds)).toEqual([]);
  });
});

describe("resolveCredPaths", () => {
  const entry = DEFAULT_MANIFEST.credentials.find((c) => c.id === "gh-cli")!;

  it("expands ~ to home dir under target-root", () => {
    const paths = resolveCredPaths(entry, "/mnt");
    expect(paths[0]).toContain("/mnt/");
    expect(paths[0]).toContain(".config/gh/hosts.yml");
  });

  it("respects target-root for absolute paths", () => {
    const sshEntry = DEFAULT_MANIFEST.credentials.find((c) => c.id === "ssh-operator-pubkey")!;
    const paths = resolveCredPaths(sshEntry, "/mnt");
    expect(paths[0]).toBe("/mnt/etc/zeta/operator-authorized-keys");
  });
});

describe("persist → restore round-trip via tmpdir", () => {
  let tmp: string;

  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), "zeta-creds-2b-test-"));
  });

  afterAll(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("global cred (gh-cli) round-trips via blob through tmpdir", () => {
    // Persist
    const persistArgs = {
      usbUuid: UUID,
      output: join(tmp, "blob1.enc"),
      passphrase: PASS,
      persona: null,
      bakeCredArgs: ["gh-cli=PERSISTED-TOKEN-VALUE"],
    };
    const bundle = composeBundle(persistArgs);
    if ("error" in bundle) throw new Error(bundle.error);
    const blob = buildBlob(bundle, persistArgs.usbUuid, persistArgs.passphrase);
    writeFileSync(persistArgs.output, blob);

    // Restore
    const restoreRoot = join(tmp, "restore-target");
    const blobRead = readFileSync(persistArgs.output);
    const plan = planRestore(blobRead, UUID, PASS, null, restoreRoot);
    if ("error" in plan) throw new Error(plan.error);
    const written = applyPlan(plan);
    expect(written).toBe(1);
    // gh-cli writes to <root>/<homedir>/.config/gh/hosts.yml
    const ghPath = resolveCredPaths(DEFAULT_MANIFEST.credentials.find((c) => c.id === "gh-cli")!, restoreRoot)[0]!;
    const restored = readFileSync(ghPath, "utf8");
    expect(restored).toBe("PERSISTED-TOKEN-VALUE");
  });

  it("round-trips when bound to usb iSerial instead of FAT UUID", () => {
    const serial = "ZETA-STICK-001";
    const persistArgs = {
      usbUuid: UUID,
      output: join(tmp, "blob-iserial.enc"),
      passphrase: PASS,
      persona: null,
      bakeCredArgs: ["gh-cli=ISERIAL-TOKEN"],
    };
    const bundle = composeBundle(persistArgs);
    if ("error" in bundle) throw new Error(bundle.error);
    const blob = buildBlob(bundle, serial, persistArgs.passphrase);
    writeFileSync(persistArgs.output, blob);

    const restoreRoot = join(tmp, "restore-iserial");
    const wrongUuid = planRestore(readFileSync(persistArgs.output), UUID, PASS, null, restoreRoot);
    expect("error" in wrongUuid).toBe(true);

    const plan = planRestore(readFileSync(persistArgs.output), serial, PASS, null, restoreRoot);
    if ("error" in plan) throw new Error(plan.error);
    expect(applyPlan(plan)).toBe(1);
  });

  it("keeps ESP blob usable across root reformat and skips already-present restores", () => {
    const persistArgs = {
      usbUuid: UUID,
      output: join(tmp, "esp-retention", "zeta-creds.enc"),
      passphrase: PASS,
      persona: null,
      bakeCredArgs: ["gh-cli=RETENTION-TOKEN-VALUE"],
    };
    mkdirSync(join(tmp, "esp-retention"), { recursive: true });
    const bundle = composeBundle(persistArgs);
    if ("error" in bundle) throw new Error(bundle.error);
    const blob = buildBlob(bundle, persistArgs.usbUuid, persistArgs.passphrase);
    writeFileSync(persistArgs.output, blob);

    const firstRoot = join(tmp, "retention-root-a");
    const firstPlan = planRestore(readFileSync(persistArgs.output), UUID, PASS, null, firstRoot);
    if ("error" in firstPlan) throw new Error(firstPlan.error);
    expect(applyPlan(firstPlan)).toBe(1);
    const firstGhPath = resolveCredPaths(DEFAULT_MANIFEST.credentials.find((c) => c.id === "gh-cli")!, firstRoot)[0]!;
    expect(readFileSync(firstGhPath, "utf8")).toBe("RETENTION-TOKEN-VALUE");

    // Simulates root reformat: target root is removed while ESP blob remains.
    rmSync(firstRoot, { recursive: true, force: true });
    const secondRoot = join(tmp, "retention-root-b");
    const reformatPlan = planRestore(readFileSync(persistArgs.output), UUID, PASS, null, secondRoot);
    if ("error" in reformatPlan) throw new Error(reformatPlan.error);
    expect(applyPlan(reformatPlan)).toBe(1);
    const secondGhPath = resolveCredPaths(DEFAULT_MANIFEST.credentials.find((c) => c.id === "gh-cli")!, secondRoot)[0]!;
    expect(readFileSync(secondGhPath, "utf8")).toBe("RETENTION-TOKEN-VALUE");

    const idempotentPlan = planRestore(readFileSync(persistArgs.output), UUID, PASS, null, secondRoot);
    if ("error" in idempotentPlan) throw new Error(idempotentPlan.error);
    expect(idempotentPlan.writes).toHaveLength(0);
    expect(idempotentPlan.skipped).toContainEqual({ id: "gh-cli", reason: "already-present" });
    expect(applyPlan(idempotentPlan)).toBe(0);
  });

  it("persona cred (claude under otto) round-trips", () => {
    const persistArgs = {
      usbUuid: UUID,
      output: join(tmp, "blob2.enc"),
      passphrase: PASS,
      persona: "otto",
      bakeCredArgs: ['claude={"creds":"OTTO-CLAUDE"}'],
    };
    const bundle = composeBundle(persistArgs);
    if ("error" in bundle) throw new Error(bundle.error);
    const blob = buildBlob(bundle, persistArgs.usbUuid, persistArgs.passphrase);
    writeFileSync(persistArgs.output, blob);

    const restoreRoot = join(tmp, "restore-target-2");
    const plan = planRestore(readFileSync(persistArgs.output), UUID, PASS, "otto", restoreRoot);
    if ("error" in plan) throw new Error(plan.error);
    const written = applyPlan(plan);
    expect(written).toBe(1);
    const claudePath = resolveCredPaths(DEFAULT_MANIFEST.credentials.find((c) => c.id === "claude")!, restoreRoot)[0]!;
    const restored = readFileSync(claudePath, "utf8");
    expect(restored).toBe('{"creds":"OTTO-CLAUDE"}');
  });

  it("planRestore reports wrong passphrase as code 5", () => {
    const persistArgs = {
      usbUuid: UUID,
      output: join(tmp, "blob3.enc"),
      passphrase: PASS,
      persona: null,
      bakeCredArgs: ["gh-cli=ANY"],
    };
    const bundle = composeBundle(persistArgs);
    if ("error" in bundle) throw new Error(bundle.error);
    const blob = buildBlob(bundle, persistArgs.usbUuid, persistArgs.passphrase);

    const plan = planRestore(blob, UUID, "WRONG-PASSPHRASE", null, "/tmp/dontcare");
    if (!("error" in plan)) throw new Error("expected error from wrong passphrase");
    expect(plan.code).toBe(5);
  });

  it("planRestore reports wrong UUID as code 5 (defeats copy-to-different-USB)", () => {
    const persistArgs = {
      usbUuid: UUID,
      output: join(tmp, "blob4.enc"),
      passphrase: PASS,
      persona: null,
      bakeCredArgs: ["gh-cli=ANY"],
    };
    const bundle = composeBundle(persistArgs);
    if ("error" in bundle) throw new Error(bundle.error);
    const blob = buildBlob(bundle, persistArgs.usbUuid, persistArgs.passphrase);

    const plan = planRestore(blob, "different-uuid", PASS, null, "/tmp/dontcare");
    if (!("error" in plan)) throw new Error("expected error from wrong UUID");
    expect(plan.code).toBe(5);
  });

  it("planRestore reports tampered blob as code 5", () => {
    const persistArgs = {
      usbUuid: UUID,
      output: join(tmp, "blob5.enc"),
      passphrase: PASS,
      persona: null,
      bakeCredArgs: ["gh-cli=ANY"],
    };
    const bundle = composeBundle(persistArgs);
    if ("error" in bundle) throw new Error(bundle.error);
    const blob = buildBlob(bundle, persistArgs.usbUuid, persistArgs.passphrase);

    // Flip a byte in the middle of the ciphertext region
    const tampered = Buffer.from(blob);
    tampered[blob.length - 10] = tampered[blob.length - 10]! ^ 0x01;

    const plan = planRestore(tampered, UUID, PASS, null, "/tmp/dontcare");
    if (!("error" in plan)) throw new Error("expected error from tampered blob");
    expect(plan.code).toBe(5);
  });

  it("empty bake bound to uefi keyfile still decrypts (wrote 0 creds)", () => {
    const dir = mkdtempSync(join(tmpdir(), "zcreds-empty-bake-"));
    const keyfile = join(dir, "keyfile");
    const output = join(dir, "zeta-creds.enc");
    writeFileSync(keyfile, Buffer.alloc(32, 0xab));
    const parsed = parsePersistArgs(["--uefi-keyfile", keyfile, "--output", output, "--passphrase-env", "TP"], {
      TP: PASS,
    });
    if ("error" in parsed) throw new Error(parsed.error);
    expect(parsed.bakeCredArgs).toEqual([]);
    expect(parsed.bindingFactor).toBe("uefiKeyfile");
    const bundle = composeBundle(parsed);
    if ("error" in bundle) throw new Error(bundle.error);
    const blob = buildBlob(bundle, parsed.bindingMaterial, parsed.passphrase);
    writePersistOutputs(output, blob, parsed.bindingFactor);
    expect(readFileSync(bindingFactorSidecarPath(output), "utf8")).toBe("uefiKeyfile\n");

    const plan = planRestore(blob, parsed.bindingMaterial, PASS, null, join(dir, "root"));
    if ("error" in plan) throw new Error(plan.error);
    expect(plan.writes).toHaveLength(0);
    expect(applyPlan(plan)).toBe(0);

    const wrong = planRestore(blob, "00".repeat(32), PASS, null, join(dir, "root-wrong"));
    expect("error" in wrong).toBe(true);
  });

  it("planRestore reports invalid magic header as code 4", () => {
    const plan = planRestore(
      Buffer.from("not a valid blob at all just text bytes" + "x".repeat(200)),
      UUID,
      PASS,
      null,
      "/tmp/dontcare",
    );
    if (!("error" in plan)) throw new Error("expected error from invalid header");
    expect(plan.code).toBe(4);
  });
});

describe("parseRestoreArgs", () => {
  it("accepts well-formed args", () => {
    const result = parseRestoreArgs(
      [
        "--usb-uuid",
        UUID,
        "--input",
        "/x.enc",
        "--passphrase-env",
        "PP",
        "--persona",
        "otto",
        "--target-root",
        "/mnt",
        "--dry-run",
      ],
      { PP: PASS },
    );
    if ("error" in result) throw new Error(result.error);
    expect(result.persona).toBe("otto");
    expect(result.targetRoot).toBe("/mnt");
    expect(result.dryRun).toBe(true);
  });

  /**
   * ARGV-BOUNDS + EMPTY-PASSPHRASE GUARDS.
   *
   * Both found 2026-08-01 by mutation sweep of the restore path. Neither was reachable by any
   * existing test, so both were load-bearing and unproven — the same shape as the binding-material
   * guard in zeta-creds-crypto.test.ts.
   *
   * These matter specifically at RESTORE time, which is the moment a USB hands real credentials to
   * a machine. A trailing flag with no value (`--passphrase-file` as the last argv entry) and an
   * empty passphrase file are both operator-typo territory, not adversary territory — which is
   * exactly why they need pinning: the failure is quiet and the operator is mid-provisioning.
   */
  it("a trailing flag with no value is refused, not read past the end of argv", () => {
    // `next()` guards `i + 1 >= argv.length`. Mutating that bound survived the suite.
    // parseArgs catches the internal throw and returns it as a structured error — the
    // no-throw contract callers rely on. What must hold is that it REFUSES, with the reason.
    const a = parseRestoreArgs(["--usb-uuid"], {});
    expect("error" in a && /requires a value/.test(a.error)).toBe(true);
    const b = parseRestoreArgs(["--usb-uuid", UUID, "--input"], {});
    expect("error" in b && /requires a value/.test(b.error)).toBe(true);
  });

  it("an EMPTY passphrase file is refused — never derives a key from the empty string", () => {
    const dir = mkdtempSync(join(tmpdir(), "zcreds-empty-"));
    const empty = join(dir, "empty.pass");
    writeFileSync(empty, "");
    const result = parseRestoreArgs(["--usb-uuid", UUID, "--input", "/x.enc", "--passphrase-file", empty], {});
    expect("error" in result).toBe(true);
  });

  it("a passphrase file holding only a newline is empty after trimming, and refused", () => {
    // The reader strips one trailing \r?\n. A file containing just that is indistinguishable
    // from an empty one and must land on the same refusal.
    const dir = mkdtempSync(join(tmpdir(), "zcreds-nl-"));
    const nl = join(dir, "nl.pass");
    writeFileSync(nl, "\n");
    const result = parseRestoreArgs(["--usb-uuid", UUID, "--input", "/x.enc", "--passphrase-file", nl], {});
    expect("error" in result).toBe(true);
  });

  it("default target-root is /", () => {
    const result = parseRestoreArgs(["--usb-uuid", UUID, "--input", "/x", "--passphrase-env", "PP"], { PP: "x" });
    if ("error" in result) throw new Error(result.error);
    expect(result.targetRoot).toBe("/");
  });
});

describe("writePersistOutputs binding-factor sidecar", () => {
  it("writes usbISerial next to the blob so restore does not guess UUID", () => {
    const dir = mkdtempSync(join(tmpdir(), "zcreds-factor-"));
    const blob = join(dir, "zeta-creds.enc");
    writePersistOutputs(blob, Buffer.from("not-a-real-blob"), "usbISerial");
    expect(readFileSync(blob).equals(Buffer.from("not-a-real-blob"))).toBe(true);
    expect(readFileSync(bindingFactorSidecarPath(blob), "utf8")).toBe("usbISerial\n");
  });

  it("writes usbUuid for the default persist path", () => {
    const dir = mkdtempSync(join(tmpdir(), "zcreds-factor-uuid-"));
    const blob = join(dir, "zeta-creds.enc");
    writePersistOutputs(blob, Buffer.from("x"), "usbUuid");
    expect(readFileSync(bindingFactorSidecarPath(blob), "utf8")).toBe("usbUuid\n");
  });

  it("writes uefiKeyfile so restore does not guess UUID", () => {
    const dir = mkdtempSync(join(tmpdir(), "zcreds-factor-uefi-"));
    const blob = join(dir, "zeta-creds.enc");
    writePersistOutputs(blob, Buffer.from("x"), "uefiKeyfile");
    expect(readFileSync(bindingFactorSidecarPath(blob), "utf8")).toBe("uefiKeyfile\n");
  });
});
