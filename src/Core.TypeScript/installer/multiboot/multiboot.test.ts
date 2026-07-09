import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseImagesManifest } from "./images-manifest.ts";
import { planMultibootUsb, renderGrubCfgTemplate, resolveIsoKernelInitrdPaths } from "./plan.ts";
import { resolveLatestFromSha256Sums, versionKeyFromFilename } from "./sha256sums.ts";

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
