// zeta-cred-handlers.test.ts — B-0852.10 acceptance tests.
//
// Covers the three layers of the per-cred-type handler pipeline:
//   1. parseBakeCredArg     — pure parser; <id>=<source> split
//   2. resolveValueSource   — literal / @file / env: source resolution
//   3. validateValue        — per-cred-type validation (PAT / JSON / SSH pubkey)
//   4. resolveBakeCred      — full pipeline composing 1+2+3 + supportedSources gate
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CLAUDE_HANDLER, CODEX_HANDLER, DEFAULT_HANDLERS, GEMINI_HANDLER, GH_CLI_HANDLER, INSTALL_ANSWERS_HANDLER, SSH_HOST_KEYS_HANDLER, SSH_OPERATOR_PUBKEY_HANDLER, WIFI_HANDLER, parseBakeCredArg, resolveBakeCred, resolveValueSource, } from "./zeta-cred-handlers";
describe("parseBakeCredArg", () => {
    it("parses well-formed arg", () => {
        const result = parseBakeCredArg("gh-cli=TEST-NOT-A-REAL-TOKEN-xxxx");
        if ("error" in result)
            throw new Error(result.error);
        expect(result.id).toBe("gh-cli");
        expect(result.source).toBe("TEST-NOT-A-REAL-TOKEN-xxxx");
    });
    it("parses arg with @ source", () => {
        const result = parseBakeCredArg("claude=@~/.config/claude/credentials.json");
        if ("error" in result)
            throw new Error(result.error);
        expect(result.id).toBe("claude");
        expect(result.source).toBe("@~/.config/claude/credentials.json");
    });
    it("parses arg with env: source", () => {
        const result = parseBakeCredArg("gh-cli=env:GH_TOKEN");
        if ("error" in result)
            throw new Error(result.error);
        expect(result.id).toBe("gh-cli");
        expect(result.source).toBe("env:GH_TOKEN");
    });
    it("preserves = signs in value (JSON or = inside value)", () => {
        const result = parseBakeCredArg('claude={"k":"v=foo"}');
        if ("error" in result)
            throw new Error(result.error);
        expect(result.id).toBe("claude");
        expect(result.source).toBe('{"k":"v=foo"}');
    });
    it("rejects missing =", () => {
        expect("error" in parseBakeCredArg("gh-cli-without-equals")).toBe(true);
    });
    it("rejects empty id", () => {
        expect("error" in parseBakeCredArg("=value")).toBe(true);
    });
    it("rejects empty value-source", () => {
        expect("error" in parseBakeCredArg("gh-cli=")).toBe(true);
    });
});
describe("resolveValueSource — literal", () => {
    it("returns utf8 bytes of literal string", () => {
        const result = resolveValueSource("hello world");
        if ("error" in result)
            throw new Error(result.error);
        expect(result.toString("utf8")).toBe("hello world");
    });
    it("preserves multi-line literals", () => {
        const result = resolveValueSource("line1\nline2");
        if ("error" in result)
            throw new Error(result.error);
        expect(result.toString("utf8")).toBe("line1\nline2");
    });
});
describe("resolveValueSource — env: source", () => {
    it("returns env var contents", () => {
        const result = resolveValueSource("env:TEST_VAR", { TEST_VAR: "value-from-env" });
        if ("error" in result)
            throw new Error(result.error);
        expect(result.toString("utf8")).toBe("value-from-env");
    });
    it("rejects missing env var", () => {
        const result = resolveValueSource("env:NONEXISTENT", {});
        expect("error" in result).toBe(true);
    });
    it("rejects empty env var", () => {
        const result = resolveValueSource("env:EMPTY", { EMPTY: "" });
        expect("error" in result).toBe(true);
    });
    it("rejects env: without var name", () => {
        const result = resolveValueSource("env:", {});
        expect("error" in result).toBe(true);
    });
});
describe("resolveValueSource — @file source", () => {
    let tmp;
    let testFile;
    beforeAll(() => {
        tmp = mkdtempSync(join(tmpdir(), "zeta-creds-handler-test-"));
        testFile = join(tmp, "fixture.txt");
        writeFileSync(testFile, "file contents from disk");
    });
    afterAll(() => {
        // Always runs even on test failure (unlike a dedicated "teardown" test
        // which is skip-filterable + order-dependent). Cleanup is best-effort —
        // tmpdir is under OS-managed /tmp so a leaked dir is harmless.
        rmSync(tmp, { recursive: true, force: true });
    });
    it("reads file contents at absolute path", () => {
        const result = resolveValueSource(`@${testFile}`);
        if ("error" in result)
            throw new Error(result.error);
        expect(result.toString("utf8")).toBe("file contents from disk");
    });
    it("rejects missing file", () => {
        const result = resolveValueSource(`@${tmp}/does-not-exist.txt`);
        expect("error" in result).toBe(true);
    });
    it("rejects @ without path", () => {
        const result = resolveValueSource("@");
        expect("error" in result).toBe(true);
    });
});
describe("GH_CLI_HANDLER", () => {
    it("accepts non-empty value", () => {
        expect(GH_CLI_HANDLER.validateValue(Buffer.from("TEST-NOT-A-REAL-TOKEN-anything"))).toBeNull();
    });
    it("rejects empty value", () => {
        expect(typeof GH_CLI_HANDLER.validateValue(Buffer.alloc(0))).toBe("string");
    });
    it("rejects whitespace-only value", () => {
        expect(typeof GH_CLI_HANDLER.validateValue(Buffer.from("   \n  "))).toBe("string");
    });
    it("supports all three sources", () => {
        expect(GH_CLI_HANDLER.supportedSources).toContain("literal");
        expect(GH_CLI_HANDLER.supportedSources).toContain("file");
        expect(GH_CLI_HANDLER.supportedSources).toContain("env");
    });
});
describe("JSON handlers (claude / gemini / codex)", () => {
    for (const handler of [CLAUDE_HANDLER, GEMINI_HANDLER, CODEX_HANDLER]) {
        it(`${handler.id} accepts valid JSON object`, () => {
            expect(handler.validateValue(Buffer.from('{"key": "value"}'))).toBeNull();
        });
        it(`${handler.id} rejects empty value`, () => {
            expect(typeof handler.validateValue(Buffer.alloc(0))).toBe("string");
        });
        it(`${handler.id} rejects malformed JSON`, () => {
            expect(typeof handler.validateValue(Buffer.from("not json {{"))).toBe("string");
        });
        it(`${handler.id} rejects JSON null`, () => {
            expect(typeof handler.validateValue(Buffer.from("null"))).toBe("string");
        });
        it(`${handler.id} rejects JSON array (must be object)`, () => {
            expect(typeof handler.validateValue(Buffer.from("[1, 2, 3]"))).toBe("string");
        });
        it(`${handler.id} rejects JSON string/number`, () => {
            expect(typeof handler.validateValue(Buffer.from('"just a string"'))).toBe("string");
            expect(typeof handler.validateValue(Buffer.from("42"))).toBe("string");
        });
        it(`${handler.id} does NOT support env (creds are JSON files, not short tokens)`, () => {
            expect(handler.supportedSources).not.toContain("env");
        });
    }
});
describe("SSH_OPERATOR_PUBKEY_HANDLER", () => {
    it("accepts ssh-ed25519 pubkey", () => {
        expect(SSH_OPERATOR_PUBKEY_HANDLER.validateValue(Buffer.from("ssh-ed25519 AAAAC3Nz...== user@host"))).toBeNull();
    });
    it("accepts ssh-rsa pubkey", () => {
        expect(SSH_OPERATOR_PUBKEY_HANDLER.validateValue(Buffer.from("ssh-rsa AAAAB3Nz...== user@host"))).toBeNull();
    });
    it("accepts ecdsa pubkey", () => {
        expect(SSH_OPERATOR_PUBKEY_HANDLER.validateValue(Buffer.from("ecdsa-sha2-nistp256 AAAAE2VjZHN... user@host"))).toBeNull();
    });
    it("accepts sk-ssh-ed25519@openssh.com pubkey (FIDO U2F)", () => {
        expect(SSH_OPERATOR_PUBKEY_HANDLER.validateValue(Buffer.from("sk-ssh-ed25519@openssh.com AAAAGnNr... user@host"))).toBeNull();
    });
    it("rejects empty value", () => {
        expect(typeof SSH_OPERATOR_PUBKEY_HANDLER.validateValue(Buffer.alloc(0))).toBe("string");
    });
    it("rejects unrecognized key-type prefix", () => {
        expect(typeof SSH_OPERATOR_PUBKEY_HANDLER.validateValue(Buffer.from("not-a-key BLAH== user@host"))).toBe("string");
    });
});
describe("SSH_HOST_KEYS_HANDLER (Phase 1 deferred)", () => {
    it("declares empty supportedSources (no bake-in at Phase 1)", () => {
        expect(SSH_HOST_KEYS_HANDLER.supportedSources.length).toBe(0);
    });
    it("rejects any value with Phase 1 deferral message", () => {
        const result = SSH_HOST_KEYS_HANDLER.validateValue(Buffer.from("any value"));
        expect(typeof result).toBe("string");
        expect(result).toContain("Phase 1");
    });
});
describe("DEFAULT_HANDLERS registry", () => {
    it("registers all 8 default manifest entries", () => {
        expect(Object.keys(DEFAULT_HANDLERS).sort()).toEqual([
            "claude",
            "codex",
            "gemini",
            "gh-cli",
            "install-answers",
            "ssh-host-keys",
            "ssh-operator-pubkey",
            "wifi",
        ].sort());
    });
});
describe("resolveBakeCred — full pipeline", () => {
    it("happy path: gh-cli literal", () => {
        const result = resolveBakeCred("gh-cli=TEST-NOT-A-REAL-TOKEN-xxxxxxxx");
        if ("error" in result)
            throw new Error(result.error);
        expect(result.ok.id).toBe("gh-cli");
        expect(result.ok.value.toString("utf8")).toBe("TEST-NOT-A-REAL-TOKEN-xxxxxxxx");
    });
    it("happy path: gh-cli env source", () => {
        const result = resolveBakeCred("gh-cli=env:GH_TOKEN_TEST", DEFAULT_HANDLERS, {
            GH_TOKEN_TEST: "TEST-NOT-A-REAL-TOKEN-from-env",
        });
        if ("error" in result)
            throw new Error(result.error);
        expect(result.ok.value.toString("utf8")).toBe("TEST-NOT-A-REAL-TOKEN-from-env");
    });
    it("happy path: claude JSON literal", () => {
        const result = resolveBakeCred('claude={"version":"1","creds":"opaque"}');
        if ("error" in result)
            throw new Error(result.error);
        expect(result.ok.id).toBe("claude");
    });
    it("rejects unknown cred id", () => {
        const result = resolveBakeCred("unknown-cred=value");
        expect("error" in result).toBe(true);
    });
    it("rejects unsupported source type for cred", () => {
        // claude doesn't support env: source (only literal + file)
        const result = resolveBakeCred("claude=env:CLAUDE_CREDS", DEFAULT_HANDLERS, { CLAUDE_CREDS: '{"k":"v"}' });
        if (!("error" in result))
            throw new Error("expected error for unsupported source");
        expect(result.error).toContain("env source");
    });
    it("rejects validation failure (invalid JSON for claude)", () => {
        const result = resolveBakeCred("claude=not-json");
        expect("error" in result).toBe(true);
    });
    it("rejects ssh-host-keys (Phase 1 deferred; empty supportedSources)", () => {
        const result = resolveBakeCred("ssh-host-keys=anything");
        expect("error" in result).toBe(true);
    });
    it("rejects malformed --bake-cred arg (no =)", () => {
        const result = resolveBakeCred("no-equals-sign");
        expect("error" in result).toBe(true);
    });
    it("ssh-operator-pubkey from @file source", () => {
        const tmp = mkdtempSync(join(tmpdir(), "zeta-handlers-pubkey-"));
        const path = join(tmp, "operator.pub");
        writeFileSync(path, "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITESTKEY operator@host\n");
        try {
            const result = resolveBakeCred(`ssh-operator-pubkey=@${path}`);
            if ("error" in result)
                throw new Error(result.error);
            expect(result.ok.value.toString("utf8")).toContain("ssh-ed25519");
        }
        finally {
            rmSync(tmp, { recursive: true, force: true });
        }
    });
});
describe("WIFI_HANDLER", () => {
    it("is registered in DEFAULT_HANDLERS", () => {
        expect(DEFAULT_HANDLERS["wifi"]).toBe(WIFI_HANDLER);
    });
    it("accepts JSON with an ssid field", () => {
        expect(WIFI_HANDLER.validateValue(Buffer.from(JSON.stringify({ ssid: "home-net", psk: "secret" })))).toBeNull();
    });
    it("accepts .nmconnection-style text with an ssid= line", () => {
        expect(WIFI_HANDLER.validateValue(Buffer.from("[wifi]\nssid=home-net\n[wifi-security]\npsk=secret\n"))).toBeNull();
    });
    it("rejects empty value", () => {
        expect(WIFI_HANDLER.validateValue(Buffer.from(""))).not.toBeNull();
    });
    it("rejects JSON object without an ssid", () => {
        expect(WIFI_HANDLER.validateValue(Buffer.from(JSON.stringify({ psk: "secret" })))).not.toBeNull();
    });
    it("rejects text with no ssid reference", () => {
        expect(WIFI_HANDLER.validateValue(Buffer.from("just some bytes"))).not.toBeNull();
    });
    it("never echoes the value (PSK) in its error message", () => {
        const err = WIFI_HANDLER.validateValue(Buffer.from("top-secret-psk-no-ssid"));
        expect(err).not.toBeNull();
        expect(err).not.toContain("top-secret-psk");
    });
});
describe("INSTALL_ANSWERS_HANDLER", () => {
    it("is registered in DEFAULT_HANDLERS", () => {
        expect(DEFAULT_HANDLERS["install-answers"]).toBe(INSTALL_ANSWERS_HANDLER);
    });
    it("accepts a JSON object of saved answers", () => {
        expect(INSTALL_ANSWERS_HANDLER.validateValue(Buffer.from(JSON.stringify({ hostname: "node-1", timezone: "UTC" })))).toBeNull();
    });
    it("rejects non-JSON", () => {
        expect(INSTALL_ANSWERS_HANDLER.validateValue(Buffer.from("not json"))).not.toBeNull();
    });
});
