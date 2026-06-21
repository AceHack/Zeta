import { describe, expect, test } from "bun:test";
import { serialFirstBootInProgress } from "./serial-markers";
describe("serialFirstBootInProgress", () => {
    test("idle serial-getty shell alone is not first-boot progress", () => {
        expect(serialFirstBootInProgress("nixos@zeta-installer:~$")).toBe(false);
    });
    test("mirrored first-boot banner suppresses getty-race false positive", () => {
        const serial = "nixos@zeta-installer:~$\n  Zeta cluster installer\nRole selected: control-plane";
        expect(serialFirstBootInProgress(serial)).toBe(true);
    });
});
