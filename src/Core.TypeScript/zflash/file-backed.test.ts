import { describe, expect, test } from "bun:test";
import {
  parseFileBackedZflashArgs,
  runFileBackedZflashCli,
} from "./file-backed.ts";

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
    expect(parseFileBackedZflashArgs(["--iso", "installer.iso", "--output", "out.img", "--esp-offset-bytes", "0"])).toEqual({
      error: "--esp-offset-bytes must be a positive safe integer",
      kind: "error",
    });
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
      "write /private/tmp/zflash-inline-abc123/zeta-wifi-credentials.json /zeta-wifi-credentials.json {\"ssid\":\"Homelab\",\"password\":\"super-secret\"}\n",
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
      error: "command failed (qemu-img convert -f raw -O raw artifacts/zeta-installer.iso artifacts/zflash-baked.img) with exit 17: convert failed",
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
                  stdout:
                    "zeta-authorized-keys.pub\nzeta-hostname.txt\nzeta-wifi-credentials.json\n",
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
