/**
 * Pure multiboot USB layout planner.
 *
 * Turns parsed images.manifest entries (+ optional resolved latest pins and
 * ISO kernel/initrd paths) into a deterministic layout plan. No network, no
 * disk writes — execute/fetch lands in a follow-up.
 *
 * Identity namespace (USB-IDENTITY-THREAT-MODEL): Zeta ESP/boot paths stay
 * under /boot/; flash payloads under /payloads/ — never mix creds into
 * MyNode flash artifacts.
 */

import type { MultibootManifestEntry } from "./images-manifest.ts";

export type MultibootLayoutKind = "grub-iso" | "flash-payload";

export type MultibootLayoutItem = {
  readonly name: string;
  readonly layoutKind: MultibootLayoutKind;
  /** Path on the composite image (POSIX, leading slash). */
  readonly imagePath: string;
  readonly source:
    | { readonly kind: "flake-build"; readonly flakeAttr: string }
    | { readonly kind: "url"; readonly url: string; readonly sha256: string }
    | {
        readonly kind: "url-latest";
        readonly checksumsUrl: string;
        readonly selectGlob: string;
        /** Filled when resolveLatest provided a pin. */
        readonly resolvedUrl?: string;
        readonly resolvedSha256?: string;
        readonly resolvedFilename?: string;
      };
  /** GRUB menuentry only for grub-iso layout items. */
  readonly grubMenuTitle?: string;
};

export type MultibootPlan = {
  readonly items: readonly MultibootLayoutItem[];
  readonly grubCfgPath: "/boot/grub/grub.cfg";
  readonly outputImageName: "zeta-multiboot.img";
  /** Paths that must stay Zeta-only (no flash-payload writes). */
  readonly zetaNamespacePrefixes: readonly ["/boot/"];
  /** Paths for appliance flash payloads only. */
  readonly payloadNamespacePrefixes: readonly ["/payloads/"];
};

export type LatestPin = {
  readonly name: string;
  readonly filename: string;
  readonly url: string;
  readonly sha256: string;
};

export type PlanMultibootInput = {
  readonly entries: readonly MultibootManifestEntry[];
  /** Optional resolved pins for flash-img-latest entries (by name). */
  readonly latestPins?: ReadonlyMap<string, LatestPin>;
};

export type PlanMultibootResult =
  | { readonly ok: true; readonly plan: MultibootPlan }
  | { readonly ok: false; readonly error: string };

function grubIsoPath(name: string): string {
  return `/boot/iso/${name}.iso`;
}

function flashPayloadPath(name: string): string {
  return `/payloads/${name}.img.gz`;
}

/**
 * Plan composite USB layout from manifest entries.
 * flash-img-latest without a matching latestPins entry still plans the
 * checksums fetch step (resolvedUrl omitted) — execute fills it later.
 */
export function planMultibootUsb(input: PlanMultibootInput): PlanMultibootResult {
  if (input.entries.length === 0) {
    return { ok: false, error: "plan requires at least one manifest entry" };
  }

  const items: MultibootLayoutItem[] = [];
  let hasGrubBoot = false;

  for (const entry of input.entries) {
    if (entry.kind === "grub-iso-local") {
      hasGrubBoot = true;
      items.push({
        name: entry.name,
        layoutKind: "grub-iso",
        imagePath: grubIsoPath(entry.name),
        source: { kind: "flake-build", flakeAttr: entry.flakeAttr },
        grubMenuTitle: `Zeta NixOS Installer (${entry.name})`,
      });
      continue;
    }
    if (entry.kind === "grub-iso") {
      hasGrubBoot = true;
      items.push({
        name: entry.name,
        layoutKind: "grub-iso",
        imagePath: grubIsoPath(entry.name),
        source: { kind: "url", url: entry.url, sha256: entry.sha256 },
        grubMenuTitle: entry.name,
      });
      continue;
    }
    if (entry.kind === "flash-img") {
      items.push({
        name: entry.name,
        layoutKind: "flash-payload",
        imagePath: flashPayloadPath(entry.name),
        source: { kind: "url", url: entry.url, sha256: entry.sha256 },
      });
      continue;
    }
    // flash-img-latest
    const pin = input.latestPins?.get(entry.name);
    const checksumsUrl = `${entry.baseUrl}${entry.checksumsFile}`;
    items.push({
      name: entry.name,
      layoutKind: "flash-payload",
      imagePath: flashPayloadPath(entry.name),
      source: {
        kind: "url-latest",
        checksumsUrl,
        selectGlob: entry.selectGlob,
        ...(pin === undefined
          ? {}
          : {
              resolvedUrl: pin.url,
              resolvedSha256: pin.sha256,
              resolvedFilename: pin.filename,
            }),
      },
    });
  }

  if (!hasGrubBoot) {
    return {
      ok: false,
      error: "manifest must include at least one grub-iso or grub-iso-local boot entry",
    };
  }

  // Namespace isolation: no flash payload may land under /boot/
  for (const item of items) {
    if (item.layoutKind === "flash-payload" && item.imagePath.startsWith("/boot/")) {
      return {
        ok: false,
        error: `flash payload "${item.name}" must not use /boot/ path (identity namespace)`,
      };
    }
    if (item.layoutKind === "grub-iso" && item.imagePath.startsWith("/payloads/")) {
      return {
        ok: false,
        error: `grub-iso "${item.name}" must not use /payloads/ path (identity namespace)`,
      };
    }
  }

  return {
    ok: true,
    plan: {
      items,
      grubCfgPath: "/boot/grub/grub.cfg",
      outputImageName: "zeta-multiboot.img",
      zetaNamespacePrefixes: ["/boot/"],
      payloadNamespacePrefixes: ["/payloads/"],
    },
  };
}

/**
 * Resolve nixos-25.11 (and legacy) kernel/initrd paths from an ISO path listing.
 * Reuses the audit-installer-iso-content suffix-pattern contract.
 */
export function resolveIsoKernelInitrdPaths(
  isoPaths: readonly string[],
): { readonly ok: true; readonly kernel: string; readonly initrd: string } | { readonly ok: false; readonly error: string } {
  const kernel = isoPaths.find((p) => p.startsWith("boot/") && p.endsWith("/bzImage"));
  const initrd =
    isoPaths.find((p) => p.startsWith("boot/") && p.endsWith("/initrd")) ??
    isoPaths.find((p) => p.startsWith("boot/") && p.endsWith("/initrd.img"));
  if (kernel === undefined) {
    return { ok: false, error: "no boot/.../bzImage path in ISO listing" };
  }
  if (initrd === undefined) {
    return { ok: false, error: "no boot/.../initrd path in ISO listing" };
  }
  return { ok: true, kernel, initrd };
}

/**
 * Fill @KERNEL@ / @INITRD@ placeholders in the grub.cfg template.
 */
export function renderGrubCfgTemplate(
  template: string,
  paths: { readonly kernel: string; readonly initrd: string },
): string {
  return template
    .replaceAll("@KERNEL@", paths.kernel)
    .replaceAll("@INITRD@", paths.initrd);
}
