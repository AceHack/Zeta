// zeta-creds-persist-restore.test.ts — 081KSKBP80008QG0R003AX2A69.2b CLI integration tests.
//
// Covers the full persist → restore round-trip via temp-dir filesystem
// (not just pure-function units; the CLI surfaces have FS I/O).

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildBlob, composeBundle, parseArgs as parsePersistArgs } from "./zeta-creds-persist";
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

  it("rejects missing --usb-uuid", () => {
    const result = parsePersistArgs(["--output", "/tmp/x", "--passphrase-env", "PP"], { PP: "x" });
    expect("error" in result).toBe(true);
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
    const firstGhPath = resolveCredPaths(
      DEFAULT_MANIFEST.credentials.find((c) => c.id === "gh-cli")!,
      firstRoot,
    )[0]!;
    expect(readFileSync(firstGhPath, "utf8")).toBe("RETENTION-TOKEN-VALUE");

    // Simulates root reformat: target root is removed while ESP blob remains.
    rmSync(firstRoot, { recursive: true, force: true });
    const secondRoot = join(tmp, "retention-root-b");
    const reformatPlan = planRestore(readFileSync(persistArgs.output), UUID, PASS, null, secondRoot);
    if ("error" in reformatPlan) throw new Error(reformatPlan.error);
    expect(applyPlan(reformatPlan)).toBe(1);
    const secondGhPath = resolveCredPaths(
      DEFAULT_MANIFEST.credentials.find((c) => c.id === "gh-cli")!,
      secondRoot,
    )[0]!;
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

  it("default target-root is /", () => {
    const result = parseRestoreArgs(["--usb-uuid", UUID, "--input", "/x", "--passphrase-env", "PP"], { PP: "x" });
    if ("error" in result) throw new Error(result.error);
    expect(result.targetRoot).toBe("/");
  });
});
