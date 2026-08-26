import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { parseImagesManifest } from "./images-manifest.ts";
import { planMultibootUsb, renderGrubCfgTemplate, resolveIsoKernelInitrdPaths } from "./plan.ts";
import { resolveLatestFromSha256Sums, versionKeyFromFilename } from "./sha256sums.ts";
import {
  estimateImageSizeBytes,
  executeAssembleFatImage,
  mdirListingHasGrubEfiEmbed,
  planAssembleFatImage,
  planQemuUeFiBootArgs,
  GRUB_EFI_CFG_PATH,
  GRUB_EFI_IMAGE_PATH,
} from "./assemble.ts";
import { bindResolvedArtifacts, resolveLatestPins } from "./resolve-artifacts.ts";

const REPO_MANIFEST = join(
  import.meta.dir,
  "../../../../full-ai-cluster/usb-nixos-installer/multiboot/images.manifest",
);

describe("parseImagesManifest", () => {
  it("parses the repo images.manifest", () => {
    const text = readFileSync(REPO_MANIFEST, "utf8");
    const result = parseImagesManifest(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]).toEqual({
      name: "zeta-installer",
      kind: "grub-iso-local",
      flakeAttr: "nix:.#installer-iso",
    });
    expect(result.entries[1]).toMatchObject({
      name: "mynode-model-two",
      kind: "flash-img-latest",
      selectGlob: "mynode_amd64_*.img.gz",
      checksumsFile: "SHA256SUMS",
    });
  });

  it("rejects unknown kind and bad sha256", () => {
    expect(parseImagesManifest("x weird-kind a b").ok).toBe(false);
    expect(
      parseImagesManifest(
        "other grub-iso https://example.com/a.iso deadbeef",
      ).ok,
    ).toBe(false);
  });

  it("rejects duplicate names", () => {
    const text = [
      "a grub-iso-local nix:.#installer-iso",
      "a grub-iso-local nix:.#installer-iso",
    ].join("\n");
    const result = parseImagesManifest(text);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("duplicate");
  });
});

describe("resolveLatestFromSha256Sums", () => {
  it("picks highest version matching glob", () => {
    const sums = [
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa  mynode_amd64_0-3-30.img.gz",
      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb  mynode_amd64_0-3-34.img.gz",
      "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc  mynode_amd64_0-2-99.img.gz",
      "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd  other_thing.img.gz",
    ].join("\n");
    const result = resolveLatestFromSha256Sums(sums, "mynode_amd64_*.img.gz");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entry.filename).toBe("mynode_amd64_0-3-34.img.gz");
    expect(result.entry.sha256.startsWith("bbbb")).toBe(true);
  });

  it("versionKeyFromFilename extracts trailing version segment", () => {
    expect(versionKeyFromFilename("mynode_amd64_0-3-34.img.gz").numeric).toEqual([
      0, 3, 34,
    ]);
  });
});

describe("planMultibootUsb", () => {
  it("plans repo manifest with zeta /boot and mynode /payloads namespaces", () => {
    const parsed = parseImagesManifest(readFileSync(REPO_MANIFEST, "utf8"));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const pin = {
      name: "mynode-model-two",
      filename: "mynode_amd64_0-3-34.img.gz",
      url: "https://mynodebtc.com/device/mynode_images/mynode_amd64_0-3-34.img.gz",
      sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    };
    const planned = planMultibootUsb({
      entries: parsed.entries,
      latestPins: new Map([["mynode-model-two", pin]]),
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;

    const zeta = planned.plan.items.find((i) => i.name === "zeta-installer");
    const mynode = planned.plan.items.find((i) => i.name === "mynode-model-two");
    expect(zeta?.imagePath).toBe("/boot/iso/zeta-installer.iso");
    expect(zeta?.layoutKind).toBe("grub-iso");
    expect(mynode?.imagePath).toBe("/payloads/mynode-model-two.img.gz");
    expect(mynode?.layoutKind).toBe("flash-payload");
    expect(mynode?.source.kind).toBe("url-latest");
    if (mynode?.source.kind === "url-latest") {
      expect(mynode.source.resolvedFilename).toBe("mynode_amd64_0-3-34.img.gz");
    }
    expect(planned.plan.zetaNamespacePrefixes).toContain("/boot/");
    expect(planned.plan.payloadNamespacePrefixes).toContain("/payloads/");
  });

  it("rejects manifest with only flash payloads (no GRUB boot)", () => {
    const parsed = parseImagesManifest(
      "only flash-img https://example.com/x.img.gz aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n",
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const planned = planMultibootUsb({ entries: parsed.entries });
    expect(planned.ok).toBe(false);
    if (!planned.ok) expect(planned.error).toContain("grub-iso");
  });
});

describe("resolveIsoKernelInitrdPaths + renderGrubCfgTemplate", () => {
  it("resolves nixos-25.11 store paths and fills placeholders", () => {
    const resolved = resolveIsoKernelInitrdPaths([
      "boot/grub/grub.cfg",
      "boot/nix/store/abc123-linux-6.12.1/bzImage",
      "boot/nix/store/def456-initrd-linux-6.12.1/initrd",
    ]);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const rendered = renderGrubCfgTemplate(
      "linux (loop)/@KERNEL@\ninitrd (loop)/@INITRD@\n",
      resolved,
    );
    expect(rendered).toContain("boot/nix/store/abc123-linux-6.12.1/bzImage");
    expect(rendered).toContain("boot/nix/store/def456-initrd-linux-6.12.1/initrd");
    expect(rendered).not.toContain("@KERNEL@");
  });
});

describe("planAssembleFatImage", () => {
  it("plans qemu-img + mformat + mmd + mcopy with namespace paths", () => {
    const parsed = parseImagesManifest(readFileSync(REPO_MANIFEST, "utf8"));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const pin = {
      name: "mynode-model-two",
      filename: "mynode_amd64_0-3-34.img.gz",
      url: "https://example.com/mynode_amd64_0-3-34.img.gz",
      sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    };
    const planned = planMultibootUsb({
      entries: parsed.entries,
      latestPins: new Map([["mynode-model-two", pin]]),
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;

    const assembled = planAssembleFatImage({
      plan: planned.plan,
      artifacts: [
        {
          name: "zeta-installer",
          imagePath: "/boot/iso/zeta-installer.iso",
          localPath: "/tmp/zeta.iso",
          sizeBytes: 1024,
        },
        {
          name: "mynode-model-two",
          imagePath: "/payloads/mynode-model-two.img.gz",
          localPath: "/tmp/mynode.img.gz",
          sizeBytes: 2048,
        },
      ],
      outputImagePath: "/tmp/zeta-multiboot.img",
      imageSizeBytes: estimateImageSizeBytes([
        { sizeBytes: 1024 },
        { sizeBytes: 2048 },
      ]),
      stagingDir: "/tmp/multiboot-staging",
      grubCfgContent: "linux (loop)/boot/k\ninitrd (loop)/boot/i\n",
    });
    expect(assembled.ok).toBe(true);
    if (!assembled.ok) return;

    const commands = assembled.steps
      .filter((s) => s.kind === "command")
      .map((s) => (s.kind === "command" ? s.command.command : ""));
    expect(commands[0]).toBe("qemu-img");
    expect(commands[1]).toBe("mformat");
    expect(commands).toContain("mmd");
    expect(commands).toContain("mcopy");

    const mcopyArgs = assembled.steps
      .filter((s) => s.kind === "command" && s.command.command === "mcopy")
      .map((s) => (s.kind === "command" ? s.command.args.join(" ") : ""));
    expect(mcopyArgs.some((a) => a.includes("::/boot/iso/zeta-installer.iso"))).toBe(true);
    expect(mcopyArgs.some((a) => a.includes("::/payloads/mynode-model-two.img.gz"))).toBe(true);
    expect(mcopyArgs.some((a) => a.includes("::/boot/grub/grub.cfg"))).toBe(true);
    expect(assembled.grubEfiEmbedded).toBe(false);
  });

  it("embeds EFI/BOOT/BOOTX64.EFI + EFI grub.cfg when grubEfiLocalPath set", () => {
    const planned = planMultibootUsb({
      entries: [
        {
          name: "zeta-installer",
          kind: "grub-iso-local",
          flakeAttr: "nix:.#installer-iso",
        },
      ],
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;

    const assembled = planAssembleFatImage({
      plan: planned.plan,
      artifacts: [
        {
          name: "zeta-installer",
          imagePath: "/boot/iso/zeta-installer.iso",
          localPath: "/tmp/zeta.iso",
          sizeBytes: 1024,
        },
      ],
      outputImagePath: "/tmp/zeta-multiboot.img",
      imageSizeBytes: 4 * 1024 * 1024,
      stagingDir: "/tmp/multiboot-staging",
      grubCfgContent: "menuentry test { true }\n",
      grubEfiLocalPath: "/tmp/BOOTX64.EFI",
    });
    expect(assembled.ok).toBe(true);
    if (!assembled.ok) return;
    expect(assembled.grubEfiEmbedded).toBe(true);
    const mcopyArgs = assembled.steps
      .filter((s) => s.kind === "command" && s.command.command === "mcopy")
      .map((s) => (s.kind === "command" ? s.command.args.join(" ") : ""));
    expect(mcopyArgs.some((a) => a.includes(`::${GRUB_EFI_IMAGE_PATH}`))).toBe(true);
    expect(mcopyArgs.some((a) => a.includes(`::${GRUB_EFI_CFG_PATH}`))).toBe(true);
    const mmdArgs = assembled.steps
      .filter((s) => s.kind === "command" && s.command.command === "mmd")
      .map((s) => (s.kind === "command" ? s.command.args.join(" ") : ""));
    expect(mmdArgs.some((a) => a.includes("::/EFI/BOOT"))).toBe(true);
  });

  it("planQemuUeFiBootArgs builds OVMF argv", () => {
    const planned = planQemuUeFiBootArgs({
      outputImagePath: "/tmp/zeta-multiboot.img",
      ovmfCodePath: "/opt/homebrew/share/qemu/edk2-x86_64-code.fd",
      ovmfVarsPath: "/tmp/ovmf-vars.fd",
      serialLogPath: "/tmp/serial.log",
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    expect(planned.args[0]).toBe("qemu-system-x86_64");
    expect(planned.args.join(" ")).toContain("edk2-x86_64-code.fd");
    expect(planned.args.join(" ")).toContain("zeta-multiboot.img");
    expect(planned.args.join(" ")).toContain("-display none");
    expect(planned.args.join(" ")).not.toContain("-nographic");
    expect(planned.args.join(" ")).toContain("if=virtio");
  });

  it("rejects unresolved grub placeholders and missing artifacts", () => {
    const planned = planMultibootUsb({
      entries: [
        {
          name: "zeta-installer",
          kind: "grub-iso-local",
          flakeAttr: "nix:.#installer-iso",
        },
      ],
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;

    const withPlaceholder = planAssembleFatImage({
      plan: planned.plan,
      artifacts: [
        {
          name: "zeta-installer",
          imagePath: "/boot/iso/zeta-installer.iso",
          localPath: "/tmp/z.iso",
          sizeBytes: 1,
        },
      ],
      outputImagePath: "/tmp/out.img",
      imageSizeBytes: 2 * 1024 * 1024,
      stagingDir: "/tmp/st",
      grubCfgContent: "linux (loop)/@KERNEL@\n",
    });
    expect(withPlaceholder.ok).toBe(false);

    const missing = planAssembleFatImage({
      plan: planned.plan,
      artifacts: [],
      outputImagePath: "/tmp/out.img",
      imageSizeBytes: 2 * 1024 * 1024,
      stagingDir: "/tmp/st",
      grubCfgContent: "ok\n",
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error).toContain("missing local artifact");
  });
});

describe("resolveLatestPins + bindResolvedArtifacts", () => {
  it("resolves latest pin from injected SHA256SUMS fetch", async () => {
    const planned = planMultibootUsb({
      entries: [
        {
          name: "zeta-installer",
          kind: "grub-iso-local",
          flakeAttr: "nix:.#installer-iso",
        },
        {
          name: "mynode-model-two",
          kind: "flash-img-latest",
          baseUrl: "https://example.com/imgs/",
          selectGlob: "mynode_amd64_*.img.gz",
          checksumsFile: "SHA256SUMS",
        },
      ],
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;

    const pins = await resolveLatestPins(planned.plan, async () =>
      [
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa  mynode_amd64_0-3-30.img.gz",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb  mynode_amd64_0-3-34.img.gz",
      ].join("\n"),
    );
    expect(pins.ok).toBe(true);
    if (!pins.ok) return;
    expect(pins.pins.get("mynode-model-two")?.filename).toBe("mynode_amd64_0-3-34.img.gz");
    expect(pins.pins.get("mynode-model-two")?.url).toContain("mynode_amd64_0-3-34.img.gz");
  });

  it("bind requireLocal fails closed without --local", async () => {
    const planned = planMultibootUsb({
      entries: [
        {
          name: "zeta-installer",
          kind: "grub-iso-local",
          flakeAttr: "nix:.#installer-iso",
        },
      ],
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    const bound = await bindResolvedArtifacts({
      plan: planned.plan,
      localByName: new Map(),
      cacheDir: "/tmp/cache",
      pins: new Map(),
      fetchToFile: async () => {
        throw new Error("network should not run");
      },
      requireLocal: true,
    });
    expect(bound.ok).toBe(false);
    if (!bound.ok) expect(bound.error).toContain("requireLocal");
  });
});

// ============================================================================
// THE mtools SMOKE — a LOUD skip, with an escape hatch that makes it required
// ============================================================================
//
// This block used to open with a bare `return` when `qemu-img` or `mformat` were absent.
// A bare return from a test body reports the test as PASSED, so on every runner without
// mtools — which was every CI runner, because nothing installed it — the suite counted a
// green result for a check that never ran. That is the repo's named worst defect class,
// and it was live here.
//
// Two changes, and the second is the one that matters:
//
//   1. The skip is a REAL skip with its reason IN THE TITLE. bun's non-TTY reporter prints
//      the COUNT of skips and not their names, so a reason living only in a comment is
//      invisible in a log. Same treatment `zflash/esp-inject.test.ts` gives its skip.
//   2. `MULTIBOOT_MTOOLS_SMOKE_REQUIRED=1` turns absence into a FAILURE, and
//      `multiboot-qemu-uefi-smoke.yml` — the one job that installs mtools — now sets it and
//      runs this file. Without that second half the skip would be honest and would still
//      never be exercised anywhere, which is only half a fix. Same shape as
//      `MULTIBOOT_UEFI_SMOKE_REQUIRED` in `qemu-uefi-menu-smoke.ts` and
//      `ZETA_REPAIR_LOOPBACK_REQUIRED` in `../repair-mode-existing-install.test.ts`.
const MTOOLS_SMOKE_REQUIRED = process.env["MULTIBOOT_MTOOLS_SMOKE_REQUIRED"] === "1";

function mtoolsSmokeSkipReason(): string | null {
  const missing: string[] = [];
  if (spawnSync("qemu-img", ["--version"], { encoding: "utf8" }).status !== 0) missing.push("qemu-img");
  if (spawnSync("mformat", ["-V"], { encoding: "utf8" }).status !== 0) missing.push("mformat");
  return missing.length === 0 ? null : `missing tooling: ${missing.join(", ")}`;
}

const MTOOLS_SKIP_REASON = mtoolsSmokeSkipReason();

describe("executeAssembleFatImage mtools smoke", () => {
  // With REQUIRED set this runs unconditionally and asserts the tooling is present, so the
  // opt-in can never be satisfied by a skip.
  const runner = MTOOLS_SKIP_REASON !== null && !MTOOLS_SMOKE_REQUIRED ? it.skip : it;
  const suffix = MTOOLS_SKIP_REASON === null ? "" : ` — SKIPPED (${MTOOLS_SKIP_REASON})`;
  runner(`assembles a tiny FAT image and lists /boot + /payloads${suffix}`, () => {
    // Opting in asserts the toolchain is installed. If it is not, that is a broken job
    // definition and must fail, never quietly degrade to a green no-op.
    if (MTOOLS_SMOKE_REQUIRED) expect(MTOOLS_SKIP_REASON).toBeNull();

    const tmpRoot = mkdtempSync(join(tmpdir(), "multiboot-assemble-"));
    const isoPath = join(tmpRoot, "zeta.iso");
    const payloadPath = join(tmpRoot, "payload.img.gz");
    const efiPath = join(tmpRoot, "BOOTX64.EFI");
    const outImg = join(tmpRoot, "zeta-multiboot.img");
    const stagingDir = join(tmpRoot, "staging");
    writeFileSync(isoPath, "fake-iso-bytes");
    writeFileSync(payloadPath, "fake-payload-bytes");
    writeFileSync(efiPath, "fake-grub-efi-stub");
    mkdirSync(stagingDir, { recursive: true });

    const planned = planMultibootUsb({
      entries: [
        {
          name: "zeta-installer",
          kind: "grub-iso-local",
          flakeAttr: "nix:.#installer-iso",
        },
        {
          name: "mynode-model-two",
          kind: "flash-img",
          url: "https://example.com/x.img.gz",
          sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
      ],
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;

    const artifacts = [
      {
        name: "zeta-installer",
        imagePath: "/boot/iso/zeta-installer.iso",
        localPath: isoPath,
        sizeBytes: statSync(isoPath).size,
      },
      {
        name: "mynode-model-two",
        imagePath: "/payloads/mynode-model-two.img.gz",
        localPath: payloadPath,
        sizeBytes: statSync(payloadPath).size,
      },
    ];
    const assembled = planAssembleFatImage({
      plan: planned.plan,
      artifacts,
      outputImagePath: outImg,
      imageSizeBytes: 4 * 1024 * 1024,
      stagingDir,
      grubCfgContent: "menuentry test { true }\n",
      grubEfiLocalPath: efiPath,
    });
    expect(assembled.ok).toBe(true);
    if (!assembled.ok) return;
    expect(assembled.grubEfiEmbedded).toBe(true);

    const executed = executeAssembleFatImage(assembled.steps, {
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
    expect(out).toMatch(/boot/i);
    expect(out).toMatch(/payloads/i);
    expect(out).toMatch(/zeta-installer\.iso/i);
    expect(out).toMatch(/mynode-model-two\.img\.gz/i);
    // FAT 8.3 lists grub.cfg as "grub     cfg"
    expect(out).toMatch(/grub\s+cfg/i);
    expect(mdirListingHasGrubEfiEmbed(out)).toBe(true);
  });
});
