import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TPM_CHAR_DEVICE } from "../cluster/bao-load-site.ts";
import { parseFileBackedZflashArgs, runFileBackedZflashCli } from "./file-backed.ts";
import { NIXOS_HOST_BAO, nixosHostBaoAsk, planFirstbootConfWithNamedBaoElf } from "./firstboot-bao-elf.ts";
import type { FileBackedZflashImageExecutor } from "./lib.ts";

/**
 * An executor that behaves like a working ESP: it remembers what each `mcopy`
 * put where, then answers `mdir` and `mtype` from that memory.
 *
 * 081M39CJP96087G0R001T4J2R3 (WP29) — the previous fixtures returned a
 * hand-written `mdir` listing and an empty string for everything else, which
 * could only ever exercise "is the name in the listing". The post-bake
 * read-back now also reads CONTENT back through the FAT chain, and a mock
 * that cannot hold content cannot falsify that. Each option below injects
 * exactly one real failure mode.
 */
function espSimulatingExecutor(
  damage: {
    /** Names to omit from the `mdir` listing — the 081KZHJPJCF silent drop. */
    readonly dropFromListing?: readonly string[];
    /** Listed, but its data cannot be read back — a name with no bytes behind it. */
    readonly unreadable?: string;
    /** Listed and readable, but the bytes came back different. */
    readonly corruptTo?: { readonly destination: string; readonly content: string };
  } = {},
): FileBackedZflashImageExecutor {
  const staged = new Map<string, string>();
  const onEsp = new Map<string, string>();
  return {
    writeFile: (file) => {
      staged.set(file.path, file.content);
    },
    runCommand: (command) => {
      const ok = { exitCode: 0, stderr: "", stdout: "" } as const;
      if (command.command === "mcopy") {
        // mcopy -o -i <spec> <source> ::<destination>
        const source = command.args.at(-2) ?? "";
        const destination = (command.args.at(-1) ?? "").replace(/^::/, "");
        onEsp.set(destination, staged.get(source) ?? `<bytes of ${source}>`);
        return ok;
      }
      if (command.command === "mdir") {
        const names = [...onEsp.keys()]
          .map((destination) => destination.replace(/^\/+/, ""))
          .filter((name) => !(damage.dropFromListing ?? []).includes(name));
        return { exitCode: 0, stderr: "", stdout: `${names.join("\n")}\n` };
      }
      if (command.command === "mtype") {
        const destination = (command.args.at(-1) ?? "").replace(/^::/, "");
        if (damage.unreadable !== undefined && destination === damage.unreadable) {
          return { exitCode: 1, stderr: "mtype: Input/output error", stdout: "" };
        }
        if (damage.corruptTo !== undefined && destination === damage.corruptTo.destination) {
          return { exitCode: 0, stderr: "", stdout: damage.corruptTo.content };
        }
        return { exitCode: 0, stderr: "", stdout: onEsp.get(destination) ?? "" };
      }
      return ok;
    },
  };
}

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

  test("parses --qemu-bake-test-cred-marker as a boolean opt-in", () => {
    const parsed = parseFileBackedZflashArgs([
      "--iso",
      "artifacts/zeta-installer.iso",
      "--output",
      "artifacts/zflash-baked.img",
      "--esp-offset-bytes",
      "1048576",
      "--ssh-key",
      "fixtures/id_ed25519.pub",
      "--qemu-bake-test-cred-marker",
    ]);

    expect(parsed).toEqual({
      kind: "run",
      options: {
        qemuBakeTestCredMarker: true,
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

  test("parses --bao-load-site and --bao-path with --role into namedBaoElf", () => {
    const parsed = parseFileBackedZflashArgs([
      "--iso",
      "installer.iso",
      "--output",
      "out.img",
      "--esp-offset-bytes",
      "1048576",
      "--ssh-key",
      "fixtures/id_ed25519.pub",
      "--role",
      "first-control-plane",
      "--bao-load-site",
      "on-host",
      "--bao-path",
      NIXOS_HOST_BAO,
    ]);
    expect(parsed).toEqual({
      kind: "run",
      options: {
        espOffsetBytes: 1_048_576,
        firstbootRole: { kind: "first-control-plane" },
        isoPath: "installer.iso",
        namedBaoElf: nixosHostBaoAsk(),
        outputImagePath: "out.img",
        pubkeyPath: "fixtures/id_ed25519.pub",
      },
    });
  });

  test("refuses --bao-load-site without --bao-path", () => {
    expect(
      parseFileBackedZflashArgs([
        "--iso",
        "installer.iso",
        "--output",
        "out.img",
        "--esp-offset-bytes",
        "1048576",
        "--role",
        "first-control-plane",
        "--bao-load-site",
        "on-host",
      ]),
    ).toEqual({
      kind: "error",
      error: "--bao-load-site requires --bao-path",
    });
  });

  test("refuses --bao-path without --bao-load-site and does not fill NIXOS_HOST_BAO", () => {
    expect(
      parseFileBackedZflashArgs([
        "--iso",
        "installer.iso",
        "--output",
        "out.img",
        "--esp-offset-bytes",
        "1048576",
        "--bao-path",
        NIXOS_HOST_BAO,
      ]),
    ).toEqual({
      kind: "error",
      error: "--bao-path requires --bao-load-site",
    });
  });

  test("refuses an unknown --bao-load-site", () => {
    expect(
      parseFileBackedZflashArgs([
        "--iso",
        "installer.iso",
        "--output",
        "out.img",
        "--esp-offset-bytes",
        "1048576",
        "--bao-load-site",
        "tpmrm0",
        "--bao-path",
        NIXOS_HOST_BAO,
      ]),
    ).toEqual({
      kind: "error",
      error: "--bao-load-site must be on-host or in-chart-image",
    });
  });

  test("parses tpmrm0 --bao-path as namedBaoElf null", () => {
    const parsed = parseFileBackedZflashArgs([
      "--iso",
      "installer.iso",
      "--output",
      "out.img",
      "--esp-offset-bytes",
      "1048576",
      "--ssh-key",
      "fixtures/id_ed25519.pub",
      "--role",
      "first-control-plane",
      "--bao-load-site",
      "on-host",
      "--bao-path",
      TPM_CHAR_DEVICE,
    ]);
    expect(parsed).toEqual({
      kind: "run",
      options: {
        espOffsetBytes: 1_048_576,
        firstbootRole: { kind: "first-control-plane" },
        isoPath: "installer.iso",
        namedBaoElf: null,
        outputImagePath: "out.img",
        pubkeyPath: "fixtures/id_ed25519.pub",
      },
    });
  });

  test("parses both bao flags without --role; a non-null ask is still an ask", () => {
    const parsed = parseFileBackedZflashArgs([
      "--iso",
      "installer.iso",
      "--output",
      "out.img",
      "--esp-offset-bytes",
      "1048576",
      "--ssh-key",
      "fixtures/id_ed25519.pub",
      "--bao-load-site",
      "on-host",
      "--bao-path",
      NIXOS_HOST_BAO,
    ]);
    expect(parsed).toEqual({
      kind: "run",
      options: {
        espOffsetBytes: 1_048_576,
        isoPath: "installer.iso",
        namedBaoElf: nixosHostBaoAsk(),
        outputImagePath: "out.img",
        pubkeyPath: "fixtures/id_ed25519.pub",
      },
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
        executor: espSimulatingExecutor(),
      },
    );

    expect(result.ok).toBe(true);
  });

  test("says SO when the read-back passes — the good case is visible too (081M39CJP96087G0R001T4J2R3)", () => {
    // A bake that verified everything and a bake that verified nothing used to
    // print the same thing: nothing. So "was this image checked, and how?" was
    // unanswerable from a log, which is how the root-cause hunt for the lost
    // injections ended up downloading an ISO artifact and parsing its MBR by
    // hand. Secrets stay out: counts, not names.
    const lines: string[] = [];
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
        executor: espSimulatingExecutor(),
        log: (line) => lines.push(line),
      },
    );

    expect(result.ok).toBe(true);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe(
      "zflash: ESP read-back ok — 3 planned file(s) present in a RECURSIVE listing, 2 of them byte-compared " +
        "through the FAT chain (1 source-file write(s) checked by presence only). Verified at " +
        "artifacts/zflash-baked.img@@1048576.",
    );
  });

  test("says NOTHING on the success path when the read-back is off", () => {
    // The line is evidence that verification RAN. It must not appear when it
    // did not, or it becomes the vacuity class one layer up: a log claiming a
    // check that never happened.
    const lines: string[] = [];
    const result = runFileBackedZflashCli(
      {
        espOffsetBytes: 1_048_576,
        hostname: "pikachu",
        isoPath: "artifacts/zeta-installer.iso",
        outputImagePath: "artifacts/zflash-baked.img",
        pubkeyPath: "fixtures/id_ed25519.pub",
      },
      {
        createInlineStagingDirectory: () => "/private/tmp/zflash-inline-abc123",
        verifyEspWrites: false,
        executor: espSimulatingExecutor(),
        log: (line) => lines.push(line),
      },
    );

    expect(result.ok).toBe(true);
    expect(lines).toEqual([]);
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
        executor: espSimulatingExecutor({ dropFromListing: ["zeta-wifi-credentials.json"] }),
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected verification failure");
    expect(result.error).toContain("zeta-wifi-credentials.json");
    expect(result.error).toContain("silent drop");
  });

  test("walks the ESP recursively, not just its root directory (081M39CJP96087G0R001T4J2R3)", () => {
    // MEASURED on the real 1.67 GiB installer ISO of run 36044770870, baked
    // through this path and then truncated to 1_000_000 and 2_000_000 bytes:
    // `mdir -i <img>@@<off> ::` exited 0 both times. A FAT12 root directory
    // sits at byte 5_632 of the ESP, so a root listing is satisfied by the
    // first ~143 KB of the image and says nothing about the rest. `-/` walks
    // every directory cluster through the FAT instead.
    const commands: string[] = [];
    const esp = espSimulatingExecutor();
    const result = runFileBackedZflashCli(
      {
        espOffsetBytes: 1_048_576,
        hostname: "pikachu",
        isoPath: "artifacts/zeta-installer.iso",
        outputImagePath: "artifacts/zflash-baked.img",
        pubkeyPath: "fixtures/id_ed25519.pub",
      },
      {
        createInlineStagingDirectory: () => "/private/tmp/zflash-inline-abc123",
        verifyEspWrites: true,
        executor: {
          writeFile: (file) => esp.writeFile(file),
          runCommand: (command) => {
            commands.push(`${command.command} ${command.args.join(" ")}`);
            return esp.runCommand(command);
          },
        },
      },
    );

    expect(result.ok).toBe(true);
    const mdirCommands = commands.filter((line) => line.startsWith("mdir "));
    expect(mdirCommands).toHaveLength(1);
    expect(mdirCommands[0]).toBe("mdir -i artifacts/zflash-baked.img@@1048576 -/ ::");
  });

  test("fails when a listed ESP file's CONTENT cannot be read back (081M39CJP96087G0R001T4J2R3)", () => {
    // A name in the directory with unreachable data behind it is exactly what
    // a guest reports as a missing injection, and the root listing that used
    // to be the whole check cannot tell the two apart.
    const result = runFileBackedZflashCli(
      {
        espOffsetBytes: 1_048_576,
        hostname: "pikachu",
        isoPath: "artifacts/zeta-installer.iso",
        outputImagePath: "artifacts/zflash-baked.img",
        pubkeyPath: "fixtures/id_ed25519.pub",
      },
      {
        createInlineStagingDirectory: () => "/private/tmp/zflash-inline-abc123",
        verifyEspWrites: true,
        executor: espSimulatingExecutor({ unreadable: "/zeta-hostname.txt" }),
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected verification failure");
    expect(result.error).toContain("/zeta-hostname.txt");
    expect(result.error).toContain("could not be read back");
  });

  test("fails when an ESP file reads back with different bytes, and never prints them", () => {
    // The wifi blob is a plaintext secret on a FAT partition
    // (railFindingsForEspWrites says so). A mismatch must name the
    // destination and the byte counts and nothing else.
    //
    // Asserted by EXACT EQUALITY on the whole message rather than by a pair of
    // `not.toContain` absence checks: an absence assertion witnesses one
    // rendering of a leak and never its absence (audit-check-arity-nonequality
    // R5), whereas a string that EQUALS this one cannot contain the ssid or the
    // password by construction.
    const result = runFileBackedZflashCli(
      {
        espOffsetBytes: 1_048_576,
        isoPath: "artifacts/zeta-installer.iso",
        outputImagePath: "artifacts/zflash-baked.img",
        pubkeyPath: "fixtures/id_ed25519.pub",
        wifiPassword: "super-secret",
        wifiSsid: "Homelab",
      },
      {
        createInlineStagingDirectory: () => "/private/tmp/zflash-inline-abc123",
        verifyEspWrites: true,
        executor: espSimulatingExecutor({
          corruptTo: { destination: "/zeta-wifi-credentials.json", content: "{}" },
        }),
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected verification failure");
    expect(result.error).toBe(
      "ESP write verification failed — /zeta-wifi-credentials.json read back with different bytes than " +
        "were written (081M39CJP96087G0R001T4J2R3): planned 45 byte(s), read 2 byte(s). Contents are not " +
        "printed — some ESP destinations carry plaintext secrets.",
    );
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

  test("refuses a non-null namedBaoElf with no role before any command runs", () => {
    const ran: string[] = [];
    const result = runFileBackedZflashCli(
      {
        espOffsetBytes: 1_048_576,
        isoPath: "artifacts/zeta-installer.iso",
        namedBaoElf: nixosHostBaoAsk(),
        outputImagePath: "artifacts/zflash-baked.img",
        pubkeyPath: "fixtures/id_ed25519.pub",
      },
      {
        createInlineStagingDirectory: () => "/private/tmp/zflash-inline-bao",
        executor: {
          runCommand: (command) => {
            ran.push(command.command);
            return { exitCode: 0, stderr: "", stdout: "" };
          },
          writeFile: () => undefined,
        },
      },
    );
    expect(result).toEqual({
      ok: false,
      error: "namedBaoElf requires firstbootRole; bao names with no role conf are never read",
    });
    expect(ran).toEqual([]);
  });

  test("writes option D bao names onto /zeta-firstboot.conf when CLI names both with a role", () => {
    const role = { kind: "first-control-plane" as const };
    const ask = nixosHostBaoAsk();
    const joined = planFirstbootConfWithNamedBaoElf(role, ask);
    if (!joined.ok) throw new Error(joined.error);
    const writes: Array<{ destination: string; content: string }> = [];
    const result = runFileBackedZflashCli(
      {
        espOffsetBytes: 1_048_576,
        firstbootRole: role,
        isoPath: "artifacts/zeta-installer.iso",
        namedBaoElf: ask,
        outputImagePath: "artifacts/zflash-baked.img",
        pubkeyPath: "fixtures/id_ed25519.pub",
      },
      {
        createInlineStagingDirectory: () => "/private/tmp/zflash-inline-bao",
        executor: {
          runCommand: () => ({ exitCode: 0, stderr: "", stdout: "" }),
          writeFile: (file) => {
            writes.push({ destination: file.destination, content: file.content });
          },
        },
      },
    );
    expect(result.ok).toBe(true);
    expect(writes).toEqual([{ destination: "/zeta-firstboot.conf", content: joined.value }]);
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
