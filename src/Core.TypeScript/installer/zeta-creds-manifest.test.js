// zeta-creds-manifest.test.ts — B-0852.5 acceptance tests.
//
// Validates schema definition + validator behavior:
//   - DEFAULT_MANIFEST is internally consistent (passes its own validator)
//   - validateManifest accepts well-formed input
//   - validateManifest rejects malformed input with specific error messages
//   - Per-credential validation: id, paths, flags, notes
import { describe, expect, it } from "bun:test";
import { DEFAULT_MANIFEST, validateManifest } from "./zeta-creds-manifest";
describe("DEFAULT_MANIFEST", () => {
    it("passes its own validator", () => {
        const result = validateManifest(DEFAULT_MANIFEST);
        if ("error" in result) {
            throw new Error(`DEFAULT_MANIFEST validation failed: ${result.error.join("; ")}`);
        }
        expect(result.ok.credentials.length).toBe(DEFAULT_MANIFEST.credentials.length);
    });
    it("declares all 4 vendor credentials Phase 1 needs (gh + claude + gemini + codex)", () => {
        const ids = DEFAULT_MANIFEST.credentials.map((c) => c.id);
        expect(ids).toContain("gh-cli");
        expect(ids).toContain("claude");
        expect(ids).toContain("gemini");
        expect(ids).toContain("codex");
    });
    it("declares ssh-host-keys as optional (required:false; regen on fresh OK)", () => {
        const entry = DEFAULT_MANIFEST.credentials.find((c) => c.id === "ssh-host-keys");
        expect(entry).toBeDefined();
        expect(entry.required).toBe(false);
    });
    it("declares ssh-operator-pubkey as required (composes with iter-4.2 ESP write)", () => {
        const entry = DEFAULT_MANIFEST.credentials.find((c) => c.id === "ssh-operator-pubkey");
        expect(entry).toBeDefined();
        expect(entry.required).toBe(true);
    });
    it("declares vendor CLIs as personaScoped:true (per-AI identity B-0847)", () => {
        for (const id of ["claude", "gemini", "codex"]) {
            const entry = DEFAULT_MANIFEST.credentials.find((c) => c.id === id);
            expect(entry.personaScoped).toBe(true);
        }
    });
    it("declares gh-cli as personaScoped:false (today; future B-0847 may flip)", () => {
        const entry = DEFAULT_MANIFEST.credentials.find((c) => c.id === "gh-cli");
        expect(entry.personaScoped).toBe(false);
    });
    it("declares all entries with non-empty paths", () => {
        for (const entry of DEFAULT_MANIFEST.credentials) {
            expect(entry.paths.length).toBeGreaterThan(0);
        }
    });
    it("declares wifi as optional, host-level (Aaron 2026-06-07: save WiFi creds too)", () => {
        const entry = DEFAULT_MANIFEST.credentials.find((c) => c.id === "wifi");
        expect(entry).toBeDefined();
        expect(entry.required).toBe(false);
        expect(entry.personaScoped).toBe(false);
    });
    it("declares install-answers as optional (reused unless new questions / fresh reformat)", () => {
        const entry = DEFAULT_MANIFEST.credentials.find((c) => c.id === "install-answers");
        expect(entry).toBeDefined();
        expect(entry.required).toBe(false);
    });
});
describe("validateManifest — accepts well-formed input", () => {
    it("accepts minimal valid manifest (1 entry)", () => {
        const minimal = {
            schemaVersion: 1,
            credentials: [
                {
                    id: "test",
                    paths: ["~/.test/creds"],
                    personaScoped: false,
                    required: true,
                },
            ],
        };
        const result = validateManifest(minimal);
        expect("ok" in result).toBe(true);
    });
    it("accepts entries with optional notes field", () => {
        const withNotes = {
            schemaVersion: 1,
            credentials: [
                {
                    id: "test",
                    paths: ["~/.test/creds"],
                    personaScoped: false,
                    required: true,
                    notes: "test fixture",
                },
            ],
        };
        const result = validateManifest(withNotes);
        expect("ok" in result).toBe(true);
    });
});
describe("validateManifest — rejects malformed input", () => {
    it("rejects non-object input", () => {
        expect("error" in validateManifest(null)).toBe(true);
        expect("error" in validateManifest(undefined)).toBe(true);
        expect("error" in validateManifest("string")).toBe(true);
        expect("error" in validateManifest(42)).toBe(true);
        expect("error" in validateManifest([])).toBe(true);
    });
    it("rejects wrong schemaVersion", () => {
        const result = validateManifest({
            schemaVersion: 2,
            credentials: [{ id: "x", paths: ["/x"], personaScoped: false, required: true }],
        });
        if (!("error" in result))
            throw new Error("expected error");
        expect(result.error.some((e) => e.includes("schemaVersion"))).toBe(true);
    });
    it("rejects missing credentials array", () => {
        const result = validateManifest({ schemaVersion: 1 });
        expect("error" in result).toBe(true);
    });
    it("rejects empty credentials array", () => {
        const result = validateManifest({ schemaVersion: 1, credentials: [] });
        if (!("error" in result))
            throw new Error("expected error");
        expect(result.error.some((e) => e.includes("non-empty"))).toBe(true);
    });
    it("rejects duplicate ids", () => {
        const dup = {
            schemaVersion: 1,
            credentials: [
                { id: "x", paths: ["/x"], personaScoped: false, required: true },
                { id: "x", paths: ["/y"], personaScoped: true, required: false },
            ],
        };
        const result = validateManifest(dup);
        if (!("error" in result))
            throw new Error("expected error");
        expect(result.error.some((e) => e.includes("duplicates"))).toBe(true);
    });
    it("rejects empty id", () => {
        const result = validateManifest({
            schemaVersion: 1,
            credentials: [{ id: "", paths: ["/x"], personaScoped: false, required: true }],
        });
        expect("error" in result).toBe(true);
    });
    it("rejects empty paths array", () => {
        const result = validateManifest({
            schemaVersion: 1,
            credentials: [{ id: "x", paths: [], personaScoped: false, required: true }],
        });
        expect("error" in result).toBe(true);
    });
    it("rejects paths containing empty strings", () => {
        const result = validateManifest({
            schemaVersion: 1,
            credentials: [{ id: "x", paths: ["/x", ""], personaScoped: false, required: true }],
        });
        expect("error" in result).toBe(true);
    });
    it("rejects non-boolean personaScoped", () => {
        const result = validateManifest({
            schemaVersion: 1,
            credentials: [{ id: "x", paths: ["/x"], personaScoped: "yes", required: true }],
        });
        expect("error" in result).toBe(true);
    });
    it("rejects non-boolean required", () => {
        const result = validateManifest({
            schemaVersion: 1,
            credentials: [{ id: "x", paths: ["/x"], personaScoped: false, required: "yes" }],
        });
        expect("error" in result).toBe(true);
    });
    it("rejects non-string notes", () => {
        const result = validateManifest({
            schemaVersion: 1,
            credentials: [{ id: "x", paths: ["/x"], personaScoped: false, required: true, notes: 42 }],
        });
        expect("error" in result).toBe(true);
    });
    it("accumulates multiple errors in one pass", () => {
        const result = validateManifest({
            schemaVersion: 99,
            credentials: [
                { id: "", paths: [], personaScoped: "no", required: 1 },
                { id: "", paths: ["x"], personaScoped: false, required: true },
            ],
        });
        if (!("error" in result))
            throw new Error("expected error");
        expect(result.error.length).toBeGreaterThan(2);
    });
});
