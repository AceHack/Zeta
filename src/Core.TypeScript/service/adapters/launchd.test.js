import { describe, expect, test } from "bun:test";
import { LaunchdAdapter } from "./launchd";
describe("LaunchdAdapter", () => {
    test("install rejects unknown persona", async () => {
        const adapter = new LaunchdAdapter("/tmp/fake-repo");
        const result = await adapter.install("nonexistent");
        expect(result.ok).toBe(false);
        expect(result.message).toContain("Unknown persona");
    });
    test("uninstall rejects unknown persona", async () => {
        const adapter = new LaunchdAdapter("/tmp/fake-repo");
        const result = await adapter.uninstall("nonexistent");
        expect(result.ok).toBe(false);
    });
    test("status returns not-installed for unknown persona", async () => {
        const adapter = new LaunchdAdapter("/tmp/fake-repo");
        const result = await adapter.status("nonexistent");
        expect(result.state).toBe("not-installed");
    });
    test("status returns not-installed or installed for valid persona", async () => {
        const adapter = new LaunchdAdapter("/tmp/fake-repo");
        const result = await adapter.status("kiro");
        // Valid persona — state depends on whether actually installed
        expect(["not-installed", "installed-running", "installed-stopped"]).toContain(result.state);
        expect(result.label).toBe("com.lucent.zeta.kiro-loop");
        expect(result.persona).toBe("kiro");
    });
});
