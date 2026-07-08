import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import {
  extractInstallCompleteBannerSource,
  installCompletePasswordDisclosureFailures,
} from "./install-complete-banner.ts";

const ROOT = join(import.meta.dir, "../../..");
const INSTALLER_PATH = join(ROOT, "full-ai-cluster/usb-nixos-installer/zeta-install.sh");

describe("081KSGS9H0008QG0R00120EEHM install-complete password disclosure guard", () => {
  it("accepts the installer completion banner non-disclosure copy", () => {
    const installerSource = readFileSync(INSTALLER_PATH, "utf8");
    const bannerSource = extractInstallCompleteBannerSource(installerSource);

    expect(bannerSource).not.toBeNull();
    expect(installCompletePasswordDisclosureFailures(bannerSource ?? "")).toEqual([]);
  });

  it("rejects the old default-password completion banner fixture", () => {
    const oldDefaultBanner = [
      'echo "  ZETA CLUSTER NODE INSTALL COMPLETE"',
      'echo "    user:     zeta"',
      'echo "    password: zeta-change-me   (iter-4.x default)"',
    ].join("\n");

    expect(installCompletePasswordDisclosureFailures(oldDefaultBanner)).toContain(
      "line 3: discloses default password zeta-change-me",
    );
  });

  it("rejects completion banners that print a concrete custom password", () => {
    const customPasswordBanner = [
      'echo "  ZETA CLUSTER NODE INSTALL COMPLETE"',
      'echo "    user:     zeta"',
      'echo "    password: correct-horse-battery-staple"',
    ].join("\n");

    expect(installCompletePasswordDisclosureFailures(customPasswordBanner)).toContain(
      "line 3: password banner line does not use non-disclosure copy",
    );
  });
});
