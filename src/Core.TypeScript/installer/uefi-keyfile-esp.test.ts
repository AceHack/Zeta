import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "bun:test";
import { attemptBindingScenarioDecrypt, bindingMaterialForContext } from "./credential-binding-model.ts";
import { executeAssembleFatImage, type AssembleStep } from "./multiboot/assemble.ts";
import {
  UEFI_KEYFILE_BIND_MARKER_IMAGE_PATH,
  QEMU_CREDS_PASSPHRASE_IMAGE_PATH,
  QEMU_BAKE_TEST_CRED_IMAGE_PATH,
  UEFI_KEYFILE_BYTES,
  UEFI_KEYFILE_IMAGE_PATH,
  UEFI_KEYFILE_INSTALL_PATH,
  UEFI_KEYFILE_RESTORE_PATH,
  UEFI_KEYFILE_SERIAL,
  generateUefiKeyfile,
  isUefiKeyfileError,
  keyfileBindingMaterial,
  mdirListingHasUefiKeyfile,
  parseKeyfileBindingMaterial,
  planUefiKeyfileEspImage,
  runUefiKeyfileWriteCli,
  writeUefiKeyfile,
} from "./uefi-keyfile-esp.ts";

describe("uefi-keyfile-esp planning", () => {
  it("pins the ESP path under /EFI/ZETA, not /payloads or /boot", () => {
    expect(UEFI_KEYFILE_IMAGE_PATH).toBe("/EFI/ZETA/keyfile");
    expect(UEFI_KEYFILE_IMAGE_PATH.startsWith("/payloads/")).toBe(false);
    expect(UEFI_KEYFILE_IMAGE_PATH.startsWith("/boot/")).toBe(false);
    expect(UEFI_KEYFILE_INSTALL_PATH).toBe("/mnt/boot/EFI/ZETA/keyfile");
    expect(UEFI_KEYFILE_RESTORE_PATH).toBe("/boot/EFI/ZETA/keyfile");
    expect(UEFI_KEYFILE_BIND_MARKER_IMAGE_PATH).toBe("/zeta-bind-uefi-keyfile");
    expect(QEMU_CREDS_PASSPHRASE_IMAGE_PATH).toBe("/zeta-qemu-creds-passphrase");
    expect(QEMU_BAKE_TEST_CRED_IMAGE_PATH).toBe("/zeta-qemu-bake-test-cred");
  });

  it("serial markers do not claim TPM or Touch ID", () => {
    expect(UEFI_KEYFILE_SERIAL.noMetalClaim).toContain("no TPM/Touch ID claim");
    expect(UEFI_KEYFILE_SERIAL.wipeFailsDecrypt).toContain("ESP wipe");
  });

  it("generateUefiKeyfile rejects short RNG output", () => {
    const bad = generateUefiKeyfile(() => new Uint8Array(8));
    expect(isUefiKeyfileError(bad)).toBe(true);
  });

  it("round-trips 32-byte keyfile as lowercase hex binding material", () => {
    const bytes = generateUefiKeyfile(() => new Uint8Array(UEFI_KEYFILE_BYTES).fill(0xab));
    expect(isUefiKeyfileError(bytes)).toBe(false);
    if (isUefiKeyfileError(bytes)) return;
    const material = keyfileBindingMaterial(bytes);
    expect(typeof material).toBe("string");
    if (isUefiKeyfileError(material)) return;
    expect(material).toBe("ab".repeat(UEFI_KEYFILE_BYTES));
    const parsed = parseKeyfileBindingMaterial(material);
    expect(isUefiKeyfileError(parsed)).toBe(false);
    if (isUefiKeyfileError(parsed)) return;
    expect(Buffer.from(parsed).equals(Buffer.from(bytes))).toBe(true);
  });

  it("parseKeyfileBindingMaterial rejects wrong length", () => {
    expect(isUefiKeyfileError(parseKeyfileBindingMaterial("dead"))).toBe(true);
    expect(isUefiKeyfileError(keyfileBindingMaterial(new Uint8Array(1)))).toBe(true);
  });

  it("plans qemu-img + mformat + mmd /EFI /EFI/ZETA + mcopy keyfile", () => {
    const planned = planUefiKeyfileEspImage({
      outputImagePath: "/tmp/zeta-uefi-keyfile.img",
      imageSizeBytes: 2 * 1024 * 1024,
      hostKeyfilePath: "/tmp/keyfile.bin",
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    const cmds = planned.steps
      .filter((s: AssembleStep) => s.kind === "command")
      .map((s: AssembleStep) => (s.kind === "command" ? `${s.command.command} ${s.command.args.join(" ")}` : ""));
    expect(cmds.some((c: string) => c.startsWith("qemu-img create"))).toBe(true);
    expect(cmds.some((c: string) => c.startsWith("mformat"))).toBe(true);
    const mmdDests = planned.steps
      .filter((s: AssembleStep) => s.kind === "command" && s.command.command === "mmd")
      .map((s: AssembleStep) => (s.kind === "command" ? s.command.args.at(-1) : ""));
    expect(mmdDests).toContain("::/EFI");
    expect(mmdDests).toContain("::/EFI/ZETA");
    expect(cmds.some((c: string) => c.includes(`::${UEFI_KEYFILE_IMAGE_PATH}`))).toBe(true);
  });

  it("rejects empty paths and undersized images", () => {
    expect(
      planUefiKeyfileEspImage({
        outputImagePath: "",
        imageSizeBytes: 2 * 1024 * 1024,
        hostKeyfilePath: "/tmp/k",
      }).ok,
    ).toBe(false);
    expect(
      planUefiKeyfileEspImage({
        outputImagePath: "/tmp/x.img",
        imageSizeBytes: 512,
        hostKeyfilePath: "/tmp/k",
      }).ok,
    ).toBe(false);
  });
});

describe("uefi-keyfile-esp binding vs threat-model matrix", () => {
  it("decrypts with keyfile present and fails after esp_wipe", () => {
    const bytes = generateUefiKeyfile(() => new Uint8Array(UEFI_KEYFILE_BYTES).fill(0x11));
    expect(isUefiKeyfileError(bytes)).toBe(false);
    if (isUefiKeyfileError(bytes)) return;
    const material = keyfileBindingMaterial(bytes);
    expect(typeof material).toBe("string");
    if (isUefiKeyfileError(material)) return;

    const encryptCtx = { usbUuid: "ignored-uuid", uefiKeyfile: material };
    expect(bindingMaterialForContext("uefiKeyfile", encryptCtx)).toBe(material);

    const same = attemptBindingScenarioDecrypt({
      factor: "uefiKeyfile",
      scenario: "same_context",
      encryptCtx,
    });
    expect(same.decryptSucceeded).toBe(true);
    expect(same.expected.decrypts).toBe(true);

    const wiped = attemptBindingScenarioDecrypt({
      factor: "uefiKeyfile",
      scenario: "esp_wipe",
      encryptCtx,
    });
    expect(wiped.decryptSucceeded).toBe(false);
    expect(wiped.expected.decrypts).toBe(false);
  });
});

describe("uefi-keyfile-esp mtools FAT round-trip", () => {
  it("writes keyfile onto a FAT image and lists it", () => {
    const qemu = spawnSync("qemu-img", ["--version"], { encoding: "utf8" });
    const mformat = spawnSync("mformat", ["-V"], { encoding: "utf8" });
    if (qemu.status !== 0 || mformat.status !== 0) {
      return;
    }

    const tmpRoot = mkdtempSync(join(tmpdir(), "zeta-uefi-keyfile-"));
    const hostKeyfile = join(tmpRoot, "keyfile.bin");
    const outImg = join(tmpRoot, "esp.img");
    const bytes = generateUefiKeyfile(() => new Uint8Array(UEFI_KEYFILE_BYTES).fill(0xcd));
    expect(isUefiKeyfileError(bytes)).toBe(false);
    if (isUefiKeyfileError(bytes)) return;
    writeFileSync(hostKeyfile, Buffer.from(bytes));

    const planned = planUefiKeyfileEspImage({
      outputImagePath: outImg,
      imageSizeBytes: 2 * 1024 * 1024,
      hostKeyfilePath: hostKeyfile,
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;

    const executed = executeAssembleFatImage(planned.steps, {
      writeFile: (path, content) => {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, content, "utf8");
      },
      runCommand: (command) => {
        const result = spawnSync(command.command, [...command.args], { encoding: "utf8" });
        return { status: result.status ?? 1, stderr: result.stderr ?? undefined };
      },
    });
    expect(executed.ok).toBe(true);

    const listing = spawnSync("mdir", ["-/", "-i", outImg], { encoding: "utf8" });
    expect(listing.status).toBe(0);
    const out = `${listing.stdout}\n${listing.stderr}`;
    expect(mdirListingHasUefiKeyfile(out)).toBe(true);

    const typed = spawnSync("mtype", ["-i", outImg, `::${UEFI_KEYFILE_IMAGE_PATH}`], {
      encoding: "buffer",
    });
    expect(typed.status).toBe(0);
    expect(Buffer.from(typed.stdout ?? []).equals(Buffer.from(bytes))).toBe(true);
  });
});

describe("uefi-keyfile write helper", () => {
  it("writes 32 bytes and mkdirs the parent directory", () => {
    const dirs: string[] = [];
    let writtenPath = "";
    const result = writeUefiKeyfile("/mnt/boot/EFI/ZETA/keyfile", () => new Uint8Array(UEFI_KEYFILE_BYTES).fill(0x7e), {
      mkdir: (dir) => {
        dirs.push(dir);
      },
      writeFile: (path, _data) => {
        writtenPath = path;
      },
    });
    expect(isUefiKeyfileError(result)).toBe(false);
    if (isUefiKeyfileError(result)) return;
    expect(dirs).toContain("/mnt/boot/EFI/ZETA");
    expect(writtenPath).toBe("/mnt/boot/EFI/ZETA/keyfile");
    expect(result.bytes.length).toBe(UEFI_KEYFILE_BYTES);
  });

  it("CLI --write uses the injected RNG and reports the wrote marker", () => {
    const tmpRoot = mkdtempSync(join(tmpdir(), "zeta-uefi-keyfile-write-"));
    const dest = join(tmpRoot, "EFI", "ZETA", "keyfile");
    const ran = runUefiKeyfileWriteCli(["--write", dest], () => new Uint8Array(UEFI_KEYFILE_BYTES).fill(0x42));
    expect(ran.exitCode).toBe(0);
    expect(ran.lines).toContain(UEFI_KEYFILE_SERIAL.wrote);
    expect(ran.lines).toContain(UEFI_KEYFILE_SERIAL.noMetalClaim);
    const onDisk = readFileSync(dest);
    expect(onDisk.equals(Buffer.alloc(UEFI_KEYFILE_BYTES, 0x42))).toBe(true);
  });
});

describe("zeta-install.sh UEFI keyfile opt-in stays coupled to the write helper", () => {
  const script = readFileSync(
    resolve(import.meta.dir, "../../../full-ai-cluster/usb-nixos-installer/zeta-install.sh"),
    "utf8",
  );

  it("writes the keyfile on the target ESP and never copies bytes to /etc", () => {
    expect(script).toContain("src/Core.TypeScript/installer/uefi-keyfile-esp.ts");
    expect(script).toContain("--write");
    expect(script).toContain(UEFI_KEYFILE_INSTALL_PATH);
    expect(script).toContain("ZETA_BIND_UEFI_KEYFILE");
    expect(script).toContain(UEFI_KEYFILE_SERIAL.persistOptInKeyfile);
    expect(script).toContain(UEFI_KEYFILE_SERIAL.persistOptInFallbackUuid);
    expect(script).toContain(UEFI_KEYFILE_SERIAL.persistBothOptInsUuid);
    expect(script).toContain("--uefi-keyfile");
    expect(script).toContain("zeta-bind-uefi-keyfile");
    expect(script).toContain(UEFI_KEYFILE_SERIAL.espFound);
    expect(script).toContain(UEFI_KEYFILE_SERIAL.espMissing);
    expect(script).toContain("zeta-qemu-creds-passphrase");
    expect(script).toContain(UEFI_KEYFILE_SERIAL.espPassphraseFound);
    expect(script).toContain(UEFI_KEYFILE_SERIAL.espPassphraseMissing);
    expect(script).toContain(UEFI_KEYFILE_SERIAL.espPassphraseCaptured);
    expect(script).toContain(UEFI_KEYFILE_SERIAL.espPassphraseEmpty);
    expect(script).toContain("zeta-qemu-bake-test-cred");
    expect(script).toContain(UEFI_KEYFILE_SERIAL.espBakeTestCredFound);
    expect(script).toContain(UEFI_KEYFILE_SERIAL.espBakeTestCredMissing);
    expect(script).toContain(UEFI_KEYFILE_SERIAL.pickerBakeTestCred);
    expect(script).toContain(UEFI_KEYFILE_SERIAL.pickerDeferAll);
    expect(script).toContain("binding $PICKER_BIND_FLAG");
    expect(script).toContain(UEFI_KEYFILE_SERIAL.helperUnavailable);
    expect(script).toContain(UEFI_KEYFILE_SERIAL.helperAbsent);
    expect(script).not.toContain("/mnt/etc/zeta/uefi-keyfile");
    expect(script).not.toContain("/etc/zeta/uefi-keyfile");
  });
});
