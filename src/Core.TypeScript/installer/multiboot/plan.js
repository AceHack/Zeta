function grubIsoPath(name) {
  return `/boot/iso/${name}.iso`;
}
function flashPayloadPath(name) {
  return `/payloads/${name}.img.gz`;
}
export function planMultibootUsb(input) {
  if (input.entries.length === 0)
    return { ok: !1, error: "plan requires at least one manifest entry" };
  const items = [];
  let hasGrubBoot = !1;
  for (const entry of input.entries) {
    if (entry.kind === "grub-iso-local") {
      hasGrubBoot = !0;
      items.push({
        name: entry.name,
        layoutKind: "grub-iso",
        imagePath: grubIsoPath(entry.name),
        source: { kind: "flake-build", flakeAttr: entry.flakeAttr },
        grubMenuTitle: `Zeta NixOS Installer (${entry.name})`
      });
      continue;
    }
    if (entry.kind === "grub-iso") {
      hasGrubBoot = !0;
      items.push({
        name: entry.name,
        layoutKind: "grub-iso",
        imagePath: grubIsoPath(entry.name),
        source: { kind: "url", url: entry.url, sha256: entry.sha256 },
        grubMenuTitle: entry.name
      });
      continue;
    }
    if (entry.kind === "flash-img") {
      items.push({
        name: entry.name,
        layoutKind: "flash-payload",
        imagePath: flashPayloadPath(entry.name),
        source: { kind: "url", url: entry.url, sha256: entry.sha256 }
      });
      continue;
    }
    const pin = input.latestPins?.get(entry.name), checksumsUrl = `${entry.baseUrl}${entry.checksumsFile}`;
    items.push({
      name: entry.name,
      layoutKind: "flash-payload",
      imagePath: flashPayloadPath(entry.name),
      source: {
        kind: "url-latest",
        checksumsUrl,
        selectGlob: entry.selectGlob,
        ...pin === void 0 ? {} : {
          resolvedUrl: pin.url,
          resolvedSha256: pin.sha256,
          resolvedFilename: pin.filename
        }
      }
    });
  }
  if (!hasGrubBoot)
    return {
      ok: !1,
      error: "manifest must include at least one grub-iso or grub-iso-local boot entry"
    };
  for (const item of items) {
    if (item.layoutKind === "flash-payload" && item.imagePath.startsWith("/boot/"))
      return {
        ok: !1,
        error: `flash payload "${item.name}" must not use /boot/ path (identity namespace)`
      };
    if (item.layoutKind === "grub-iso" && item.imagePath.startsWith("/payloads/"))
      return {
        ok: !1,
        error: `grub-iso "${item.name}" must not use /payloads/ path (identity namespace)`
      };
  }
  return {
    ok: !0,
    plan: {
      items,
      grubCfgPath: "/boot/grub/grub.cfg",
      outputImageName: "zeta-multiboot.img",
      zetaNamespacePrefixes: ["/boot/"],
      payloadNamespacePrefixes: ["/payloads/"]
    }
  };
}
export function resolveIsoKernelInitrdPaths(isoPaths) {
  const kernel = isoPaths.find((p) => p.startsWith("boot/") && p.endsWith("/bzImage")), initrd = isoPaths.find((p) => p.startsWith("boot/") && p.endsWith("/initrd")) ?? isoPaths.find((p) => p.startsWith("boot/") && p.endsWith("/initrd.img"));
  if (kernel === void 0)
    return { ok: !1, error: "no boot/.../bzImage path in ISO listing" };
  if (initrd === void 0)
    return { ok: !1, error: "no boot/.../initrd path in ISO listing" };
  return { ok: !0, kernel, initrd };
}
export function renderGrubCfgTemplate(template, paths) {
  return template.replaceAll("@KERNEL@", paths.kernel).replaceAll("@INITRD@", paths.initrd);
}
