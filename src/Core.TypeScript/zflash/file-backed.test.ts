import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseFileBackedZflashArgs, runFileBackedZflashCli } from "./file-backed.ts";

describe("parseFileBackedZflashArgs", () => {
  test("parses the file-backed QEMU image CLI shape", () => {
    const parsed = parseFileBackedZflashArgs([
      "--iso",
      "artifacts/zeta-installer.iso",
      "--output",
      "artifacts/zflash-baked.img",
      "--esp-offset-bytes",
      "1048576",
      "--ssh-key",
      "fixtures/id_ed25519.pub",
      "--host",
      "pikachu",
      "--credential-blob",
      "artifacts/zeta-creds.enc",
      "--wifi-ssid",
      "Homelab",
      "--wifi-password",
      "super-secret",
    ]);

    expect(parsed).toEqual({
      kind: "run",
      options: {
        credentialBlobPath: "artifacts/zeta-creds.enc",
        espOffsetBytes: 1_048_576,
        hostname: "pikachu",
        isoPath: "artifacts/zeta-installer.iso",
        outputImagePath: "artifacts/zflash-baked.img",
        pubkeyPath: "fixtures/id_ed25519.pub",
        wifiPassword: "super-secret",
        wifiSsid: "Homelab",
      },
    });
  });

  test("rejects missing required arguments before any runtime effects", () => {
    expect(parseFileBackedZflashArgs(["--iso", "installer.iso"])).toEqual({
      error: "--output is required",
      kind: "error",
    });
    expect(
      parseFileBackedZflashArgs(["--iso", "installer.iso", "--output", "out.img", "--esp-offset-bytes", "0"]),
    ).toEqual({
      error: "--esp-offset-bytes must be a positive safe integer",
      kind: "error",
    });
  });

  test("parses --bind-uefi-keyfile-marker as a boolean opt-in", () => {
    const parsed = parseFileBackedZflashArgs([
      "--iso",
      "artifacts/zeta-installer.iso",
      "--output",
      "artifacts/zflash-baked.img",
      "--esp-offset-bytes",
      "1048576",
      "--ssh-key",
      "fixtures/id_ed25519.pub",
      "--bind-uefi-keyfile-marker",
    ]);

    expect(parsed).toEqual({
      kind: "run",
      options: {
        bindUefiKeyfileMarker: true,
        espOffsetBytes: 1_048_576,
        isoPath: "artifacts/zeta-installer.iso",
        outputImagePath: "artifacts/zflash-baked.img",
        pubkeyPath: "fixtures/id_ed25519.pub",
      },
    });
  });

  test("parses --qemu-creds-passphrase-file without putting the secret in argv options as a flag name", () => {
    const dir = mkdtempSync(join(tmpdir(), "zeta-qemu-pp-"));
    const ppPath = join(dir, "pp.txt");
    writeFileSync(ppPath, "qemu-test-secret\n");
    const parsed = parseFileBackedZflashArgs([
      "--iso",
      "artifacts/zeta-installer.iso",
      "--output",
      "artifacts/zflash-baked.img",
      "--esp-offset-bytes",
      "1048576",
      "--ssh-key",
      "fixtures/id_ed25519.pub",
      "--qemu-creds-passphrase-file",
      ppPath,
    ]);

    expect(parsed).toEqual({
      kind: "run",
      options: {
        espOffsetBytes: 1_048_576,
        isoPath: "artifacts/zeta-installer.iso",
        outputImagePath: "artifacts/zflash-baked.img",
        pubkeyPath: "fixtures/id_ed25519.pub",
        qemuCredsPassphrase: "qemu-test-secret",
      },
    });
  });

  test("maps a missing --qemu-creds-passphrase-file to not found without echoing the path", () => {
    const missingPath = join(tmpdir(), "zeta-qemu-pp-missing", "no-such-passphrase.txt");
    const parsed = parseFileBackedZflashArgs([
      "--iso",
      "artifacts/zeta-installer.iso",
      "--output",
      "artifacts/zflash-baked.img",
      "--esp-offset-bytes",
      "1048576",
      "--qemu-creds-passphrase-file",
      missingPath,
    ]);

    expect(parsed).toEqual({
      kind: "error",
      error: "--qemu-creds-passphrase-file not found",
    });
    expect(JSON.stringify(parsed)).not.toContain(missingPath);
  });
});

describe("runFileBackedZflashCli", () => {
  test("creates a baked raw image and returns the QEMU retention boot env", () => {
    const observed: string[] = [];
    const result = runFileBackedZflashCli(
      {
        credentialBlobPath: "artifacts/zeta-creds.enc",
        espOffsetBytes: 1_048_576,
        hostname: "pikachu",
        isoPath: "artifacts/zeta-installer.iso",
        outputImagePath: "artifacts/zflash-baked.img",
        pubkeyPath: "fixtures/id_ed25519.pub",
        wifiPassword: "super-secret",
        wifiSsid: "Homelab",
      },
      {
        createInlineStagingDirectory: () => "/private/tmp/zflash-inline-abc123",
        executor: {
          runCommand: (command) => {
            observed.push(`${command.command} ${command.args.join(" ")}`);
            return { exitCode: 0, stderr: "", stdout: "" };
          },
          writeFile: (file) => {
            observed.push(`write ${file.path} ${file.destination} ${file.content}`);
          },
        },
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(observed).toEqual([
      "qemu-img convert -f raw -O raw artifacts/zeta-installer.iso artifacts/zflash-baked.img",
      "mcopy -o -i artifacts/zflash-baked.img@@1048576 fixtures/id_ed25519.pub ::/zeta-authorized-keys.pub",
      "write /private/tmp/zflash-inline-abc123/zeta-hostname.txt /zeta-hostname.txt pikachu\n",
      "mcopy -o -i artifacts/zflash-baked.img@@1048576 /private/tmp/zflash-inline-abc123/zeta-hostname.txt ::/zeta-hostname.txt",
      "mcopy -o -i artifacts/zflash-baked.img@@1048576 artifacts/zeta-creds.enc ::/zeta-creds.enc",
      'write /private/tmp/zflash-inline-abc123/zeta-wifi-credentials.json /zeta-wifi-credentials.json {"ssid":"Homelab","password":"super-secret"}\n',
      "mcopy -o -i artifacts/zflash-baked.img@@1048576 /private/tmp/zflash-inline-abc123/zeta-wifi-credentials.json ::/zeta-wifi-credentials.json",
    ]);
    expect(result.value.retentionBootImageEnvironment).toEqual({
      ZFLASH_QEMU_RETENTION_BOOT_IMAGE: "artifacts/zflash-baked.img",
    });
    expect(result.value.inlineStagingDirectory).toBe("/private/tmp/zflash-inline-abc123");
  });

  test("fails closed when a planned qemu-img or mcopy command fails", () => {
    const result = runFileBackedZflashCli(
      {
        espOffsetBytes: 1_048_576,
        isoPath: "artifacts/zeta-installer.iso",
        outputImagePath: "artifacts/zflash-baked.img",
        pubkeyPath: "fixtures/id_ed25519.pub",
      },
      {
        executor: {
          runCommand: () => ({ exitCode: 17, stderr: "convert failed", stdout: "" }),
          writeFile: () => {
            throw new Error("unexpected inline write");
          },
        },
      },
    );

    expect(result).toEqual({
      error:
        "command failed (qemu-img convert -f raw -O raw artifacts/zeta-installer.iso artifacts/zflash-baked.img) with exit 17: convert failed",
      ok: false,
    });
  });

  test("verifies ESP writes and succeeds when all planned files are present (081KZHJPJCF)", () => {
    const result = runFileBackedZflashCli(
      {
        espOffsetBytes: 1_048_576,
        hostname: "pikachu",
        isoPath: "artifacts/zeta-installer.iso",
        outputImagePath: "artifacts/zflash-baked.img",
        pubkeyPath: "fixtures/id_ed25519.pub",
        wifiPassword: "super-secret",
        wifiSsid: "Homelab",
      },
      {
        createInlineStagingDirectory: () => "/private/tmp/zflash-inline-abc123",
        verifyEspWrites: true,
        executor: {
          runCommand: (command) =>
            command.command === "mdir"
              ? {
                  exitCode: 0,
                  stderr: "",
                  stdout: "zeta-authorized-keys.pub\nzeta-hostname.txt\nzeta-wifi-credentials.json\n",
                }
              : { exitCode: 0, stderr: "", stdout: "" },
          writeFile: () => {},
        },
      },
    );

    expect(result.ok).toBe(true);
  });

  test("fails loud when a planned ESP write is silently absent after bake (081KZHJPJCF)", () => {
    // mcopy reports exit 0 for every write, but the ESP read-back omits the wifi file —
    // the observed CI silent-drop. Verification must catch it and name the missing file.
    const result = runFileBackedZflashCli(
      {
        espOffsetBytes: 1_048_576,
        hostname: "pikachu",
        isoPath: "artifacts/zeta-installer.iso",
        outputImagePath: "artifacts/zflash-baked.img",
        pubkeyPath: "fixtures/id_ed25519.pub",
        wifiPassword: "super-secret",
        wifiSsid: "Homelab",
      },
      {
        createInlineStagingDirectory: () => "/private/tmp/zflash-inline-abc123",
        verifyEspWrites: true,
        executor: {
          runCommand: (command) =>
            command.command === "mdir"
              ? { exitCode: 0, stderr: "", stdout: "zeta-authorized-keys.pub\nzeta-hostname.txt\n" }
              : { exitCode: 0, stderr: "", stdout: "" },
          writeFile: () => {},
        },
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected verification failure");
    expect(result.error).toContain("zeta-wifi-credentials.json");
    expect(result.error).toContain("silent drop");
  });

  test("rejects malformed wifi flags without printing the password", () => {
    const result = runFileBackedZflashCli(
      {
        espOffsetBytes: 1_048_576,
        isoPath: "artifacts/zeta-installer.iso",
        outputImagePath: "artifacts/zflash-baked.img",
        pubkeyPath: "fixtures/id_ed25519.pub",
        wifiPassword: "super-secret",
        wifiSsid: "",
      },
      {
        executor: {
          runCommand: () => {
            throw new Error("unexpected command");
          },
          writeFile: () => {
            throw new Error("unexpected inline write");
          },
        },
      },
    );

    expect(result).toEqual({
      error: "wifi credentials ssid is required",
      ok: false,
    });
    if (!result.ok) {
      expect(result.error).not.toContain("super-secret");
    }
  });
});

// ---------------------------------------------------------------------------
// JOIN-TOKEN MATERIAL IS CHECKED AT THE CALL SITE, not merely validatable
// ---------------------------------------------------------------------------
//
// `validateJoinTokenMaterial` is pure and has its own suite in
// firstboot-role.test.ts. These tests exist for a different question: is it
// REACHED? The plan only carries a `sourcePath`, so nothing downstream ever
// opens the token file — a validator nobody calls would look exactly like a
// guard and hold nothing. Real files on disk, real `runFileBackedZflashCli`.

describe("runFileBackedZflashCli refuses a join token with no CA hash", () => {
  const tokenDir = mkdtempSync(join(tmpdir(), "zflash-join-token-"));
  const goodToken = join(tokenDir, "node-token");
  const badToken = join(tokenDir, "bare-secret");
  writeFileSync(goodToken, `K10${"a".repeat(64)}::server:0123456789abcdef\n`);
  writeFileSync(badToken, "hunter2\n");

  const joinerRole = {
    kind: "joiner",
    serverUrl: "https://control-plane:6443",
    tokenEspPath: "/zeta-join-token",
  } as const;

  const baseOptions = {
    espOffsetBytes: 1_048_576,
    isoPath: "artifacts/zeta-installer.iso",
    outputImagePath: "artifacts/zflash-baked.img",
    pubkeyPath: "fixtures/id_ed25519.pub",
  };

  const noopExecutor = {
    runCommand: () => ({ exitCode: 0, stderr: "", stdout: "" }),
    writeFile: () => undefined,
  };

  test("a bare shared secret is refused BEFORE any command runs", () => {
    const ran: string[] = [];
    const result = runFileBackedZflashCli(
      { ...baseOptions, firstbootRole: joinerRole, joinTokenSourcePath: badToken },
      {
        createInlineStagingDirectory: () => "/private/tmp/zflash-inline-abc123",
        executor: {
          runCommand: (command) => {
            ran.push(command.command);
            return { exitCode: 0, stderr: "", stdout: "" };
          },
          writeFile: () => undefined,
        },
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected a refusal");
    expect(result.error).toContain("CA hash");
    expect(result.error).toContain(badToken);
    // Fail-closed means fail EARLY: nothing was written to the image.
    expect(ran).toEqual([]);
  });

  test("the token k3s itself writes passes and the bake proceeds", () => {
    const result = runFileBackedZflashCli(
      { ...baseOptions, firstbootRole: joinerRole, joinTokenSourcePath: goodToken },
      {
        createInlineStagingDirectory: () => "/private/tmp/zflash-inline-abc123",
        executor: noopExecutor,
      },
    );
    expect(result.ok).toBe(true);
  });

  test("a missing token file is refused rather than silently skipped", () => {
    const result = runFileBackedZflashCli(
      {
        ...baseOptions,
        firstbootRole: joinerRole,
        joinTokenSourcePath: join(tokenDir, "does-not-exist"),
      },
      { createInlineStagingDirectory: () => "/private/tmp/x", executor: noopExecutor },
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected a refusal");
    expect(result.error).toContain("not found");
  });
});
