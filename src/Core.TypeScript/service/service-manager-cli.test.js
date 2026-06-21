import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
const CLI_PATH = join(import.meta.dir, "service-manager-cli.ts");
function runCli(args) {
    const result = spawnSync("bun", [CLI_PATH, ...args], {
        encoding: "utf8",
        timeout: 10_000,
    });
    return {
        status: result.status ?? 1,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
    };
}
describe("service-manager-cli", () => {
    test("list shows all registered personas", () => {
        const r = runCli(["list"]);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain("kiro");
        expect(r.stdout).toContain("otto");
        expect(r.stdout).toContain("riven");
    });
    test("help shows usage", () => {
        const r = runCli(["help"]);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain("install");
        expect(r.stdout).toContain("uninstall");
        expect(r.stdout).toContain("status");
    });
    test("install rejects unknown persona", () => {
        const r = runCli(["install", "--persona", "nonexistent"]);
        expect(r.status).toBe(1);
        expect(r.stderr).toContain("unknown persona");
    });
    test("status for valid persona returns state", () => {
        const r = runCli(["status", "--persona", "kiro"]);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain("kiro:");
    });
});
