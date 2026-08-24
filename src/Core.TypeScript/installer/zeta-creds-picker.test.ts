// zeta-creds-picker.test.ts — 081KSKBP80008QG0R003AX2A69.3a picker tests.
//
// Tests parseArgs (pure) + runPicker (against a mock readline-like interface).

import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { parseArgs, runPicker, buildVerifyArgs, buildPersistArgs, shouldDeferAllPrompts } from "./zeta-creds-picker";

describe("parseArgs", () => {
  it("accepts well-formed args with --passphrase-env", () => {
    const r = parseArgs(["--usb-uuid", "u1", "--output", "/o", "--passphrase-env", "P"]);
    if ("error" in r) throw new Error(r.error);
    expect(r.usbUuid).toBe("u1");
    expect(r.output).toBe("/o");
    expect(r.passphraseEnv).toBe("P");
    expect(r.persona).toBe(null);
    expect(r.dryRun).toBe(false);
  });

  it("accepts --persona + --dry-run", () => {
    const r = parseArgs([
      "--usb-uuid", "u1", "--output", "/o", "--passphrase-file", "/pp",
      "--persona", "otto", "--dry-run",
    ]);
    if ("error" in r) throw new Error(r.error);
    expect(r.persona).toBe("otto");
    expect(r.dryRun).toBe(true);
    expect(r.passphraseFile).toBe("/pp");
  });

  it("rejects missing binding factor", () => {
    const r = parseArgs(["--output", "/o", "--passphrase-env", "P"]);
    expect("error" in r).toBe(true);
  });

  it("accepts --usb-iserial without --usb-uuid", () => {
    const r = parseArgs(["--usb-iserial", "ZETA-STICK-001", "--output", "/o", "--passphrase-env", "P"]);
    if ("error" in r) throw new Error(r.error);
    expect(r.usbISerial).toBe("ZETA-STICK-001");
    expect(r.usbUuid).toBe(null);
  });

  it("accepts --uefi-keyfile without --usb-uuid", () => {
    const r = parseArgs(["--uefi-keyfile", "/esp/EFI/ZETA/keyfile", "--output", "/o", "--passphrase-env", "P"]);
    if ("error" in r) throw new Error(r.error);
    expect(r.uefiKeyfile).toBe("/esp/EFI/ZETA/keyfile");
    expect(r.usbUuid).toBe(null);
  });

  it("rejects --usb-iserial and --uefi-keyfile together", () => {
    const r = parseArgs([
      "--usb-iserial", "ZETA-STICK-001",
      "--uefi-keyfile", "/esp/EFI/ZETA/keyfile",
      "--output", "/o",
      "--passphrase-env", "P",
    ]);
    expect("error" in r).toBe(true);
    if (!("error" in r)) return;
    expect(r.error).toContain("mutually exclusive");
  });

  it("rejects missing --output", () => {
    const r = parseArgs(["--usb-uuid", "u1", "--passphrase-env", "P"]);
    expect("error" in r).toBe(true);
  });

  it("rejects no passphrase source", () => {
    const r = parseArgs(["--usb-uuid", "u1", "--output", "/o"]);
    expect("error" in r).toBe(true);
  });

  it("rejects unknown flag", () => {
    const r = parseArgs(["--bogus"]);
    expect("error" in r).toBe(true);
  });

  it("--verify flag is opt-in (default false)", () => {
    const r = parseArgs(["--usb-uuid", "u1", "--output", "/o", "--passphrase-env", "P"]);
    if ("error" in r) throw new Error(r.error);
    expect(r.verify).toBe(false);
  });

  it("--verify flag parsed when passed", () => {
    const r = parseArgs(["--usb-uuid", "u1", "--output", "/o", "--passphrase-env", "P", "--verify"]);
    if ("error" in r) throw new Error(r.error);
    expect(r.verify).toBe(true);
  });

  it("--defer-all is off by default and parsed when passed", () => {
    const off = parseArgs(["--usb-uuid", "u1", "--output", "/o", "--passphrase-env", "P"]);
    if ("error" in off) throw new Error(off.error);
    expect(off.deferAll).toBe(false);
    const on = parseArgs(["--usb-uuid", "u1", "--output", "/o", "--passphrase-env", "P", "--defer-all"]);
    if ("error" in on) throw new Error(on.error);
    expect(on.deferAll).toBe(true);
  });
});

describe("shouldDeferAllPrompts", () => {
  it("is true for the flag or a non-TTY, false only for an interactive TTY without the flag", () => {
    expect(shouldDeferAllPrompts(true, true)).toBe(true);
    expect(shouldDeferAllPrompts(false, false)).toBe(true);
    expect(shouldDeferAllPrompts(true, false)).toBe(true);
    expect(shouldDeferAllPrompts(false, true)).toBe(false);
  });
});

describe("buildVerifyArgs", () => {
  it("composes restore CLI args with --dry-run + provided tmpdir", () => {
    const parsed = parseArgs(["--usb-uuid", "u1", "--output", "/mnt/boot/zeta-creds.enc", "--passphrase-env", "ZETA_PP", "--verify"]);
    if ("error" in parsed) throw new Error(parsed.error);
    const args = buildVerifyArgs(parsed, "/tmp/verify-x");
    expect(args).toContain("src/Core.TypeScript/installer/zeta-creds-restore.ts");
    // The spawned script must EXIST; asserting the string alone is what let
    // this argv keep pointing at the pre-#8050 `tools/` path while green.
    expect(existsSync(args[0]!)).toBe(true);
    expect(args).toContain("--usb-uuid"); expect(args).toContain("u1");
    expect(args).toContain("--input"); expect(args).toContain("/mnt/boot/zeta-creds.enc");
    expect(args).toContain("--target-root"); expect(args).toContain("/tmp/verify-x");
    expect(args).toContain("--dry-run");
    expect(args).toContain("--passphrase-env"); expect(args).toContain("ZETA_PP");
  });

  it("propagates --passphrase-file when picker used file source", () => {
    const parsed = parseArgs(["--usb-uuid", "u2", "--output", "/o", "--passphrase-file", "/pp"]);
    if ("error" in parsed) throw new Error(parsed.error);
    const args = buildVerifyArgs(parsed, "/tmp/t");
    expect(args).toContain("--passphrase-file");
    expect(args).toContain("/pp");
    expect(args).not.toContain("--passphrase-env");
  });

  it("propagates --persona when set", () => {
    const parsed = parseArgs(["--usb-uuid", "u3", "--output", "/o", "--passphrase-env", "P", "--persona", "otto"]);
    if ("error" in parsed) throw new Error(parsed.error);
    const args = buildVerifyArgs(parsed, "/tmp/t");
    expect(args).toContain("--persona");
    expect(args).toContain("otto");
  });

  it("forwards --usb-iserial and omits --usb-uuid when uuid was not given", () => {
    const parsed = parseArgs(["--usb-iserial", "ZETA-STICK-001", "--output", "/o", "--passphrase-env", "P"]);
    if ("error" in parsed) throw new Error(parsed.error);
    const args = buildVerifyArgs(parsed, "/tmp/t");
    expect(args).toContain("--usb-iserial");
    expect(args).toContain("ZETA-STICK-001");
    expect(args).not.toContain("--usb-uuid");
  });
});

describe("buildPersistArgs", () => {
  it("default uuid path still forwards --usb-uuid", () => {
    const parsed = parseArgs(["--usb-uuid", "u1", "--output", "/o", "--passphrase-env", "P"]);
    if ("error" in parsed) throw new Error(parsed.error);
    const args = buildPersistArgs(parsed, ["gh-cli=x"]);
    expect(existsSync(args[0]!)).toBe(true);
    expect(args).toContain("--usb-uuid");
    expect(args).toContain("u1");
    expect(args).not.toContain("--usb-iserial");
    expect(args).toContain("--bake-cred");
    expect(args).toContain("gh-cli=x");
  });

  it("forwards --usb-iserial so persist binds the stick, not the FAT UUID", () => {
    const parsed = parseArgs(["--usb-iserial", "ZETA-STICK-001", "--output", "/o", "--passphrase-env", "P"]);
    if ("error" in parsed) throw new Error(parsed.error);
    const args = buildPersistArgs(parsed, []);
    expect(args).toContain("--usb-iserial");
    expect(args).toContain("ZETA-STICK-001");
    expect(args).not.toContain("--usb-uuid");
  });

  it("forwards --uefi-keyfile", () => {
    const parsed = parseArgs(["--uefi-keyfile", "/esp/EFI/ZETA/keyfile", "--output", "/o", "--passphrase-file", "/pp"]);
    if ("error" in parsed) throw new Error(parsed.error);
    const args = buildPersistArgs(parsed, []);
    expect(args).toContain("--uefi-keyfile");
    expect(args).toContain("/esp/EFI/ZETA/keyfile");
    expect(args).not.toContain("--usb-uuid");
  });
});

// Mock readline-like interface for testing runPicker against scripted answers.
function mockRl(answers: string[]) {
  let idx = 0;
  return {
    question: (_prompt: string) => Promise.resolve(answers[idx++] ?? ""),
    close: () => {},
  } as unknown as Parameters<typeof runPicker>[0];
}

describe("runPicker", () => {
  it("returns no bake-args when operator defers everything (no persona)", async () => {
    const rl = mockRl([
      "d", // gh-cli
      // claude/gemini/codex auto-skip (persona-scoped + no persona)
      // ssh-host-keys / ssh-operator-pubkey: prompt depending on handler/scope
      "d", "d", "d", "d", "d", "d", "d", "d",
    ]);
    const args = await runPicker(rl, null);
    expect(args.length).toBe(0);
  });

  it("--defer-all returns no bake-args and never asks", async () => {
    let asked = 0;
    const rl = {
      question: () => {
        asked += 1;
        return Promise.resolve("b");
      },
      close: () => {},
    } as unknown as Parameters<typeof runPicker>[0];
    const args = await runPicker(rl, null, true);
    expect(args).toEqual([]);
    expect(asked).toBe(0);
  });

  it("bakes gh-cli with literal value when chosen", async () => {
    // Skip persona-scoped (no persona); gh-cli is the first global cred.
    // Answers: bake, literal, value, then defer remaining
    const rl = mockRl([
      "b", "l", "ghp_test_value",
      "d", "d", "d", "d", "d", "d", "d", "d",
    ]);
    const args = await runPicker(rl, null);
    expect(args.length).toBeGreaterThanOrEqual(1);
    const gh = args.find((a) => a.startsWith("gh-cli="));
    expect(gh).toBe("gh-cli=ghp_test_value");
  });

  it("skips empty literal value", async () => {
    const rl = mockRl([
      "b", "l", "", // gh-cli bake, literal, EMPTY
      "d", "d", "d", "d", "d", "d", "d", "d",
    ]);
    const args = await runPicker(rl, null);
    expect(args.find((a) => a.startsWith("gh-cli="))).toBeUndefined();
  });

  it("uses @file syntax when operator picks file source", async () => {
    const rl = mockRl([
      "b", "f", "/tmp/test-file",
      "d", "d", "d", "d", "d", "d", "d", "d",
    ]);
    const args = await runPicker(rl, null);
    const gh = args.find((a) => a.startsWith("gh-cli="));
    expect(gh).toBe("gh-cli=@/tmp/test-file");
  });

  it("uses env: syntax when operator picks env source", async () => {
    const rl = mockRl([
      "b", "e", "GH_TOKEN",
      "d", "d", "d", "d", "d", "d", "d", "d",
    ]);
    const args = await runPicker(rl, null);
    const gh = args.find((a) => a.startsWith("gh-cli="));
    expect(gh).toBe("gh-cli=env:GH_TOKEN");
  });

  it("auto-skips persona-scoped creds when no persona", async () => {
    const rl = mockRl(Array(15).fill("d"));
    const args = await runPicker(rl, null);
    // claude/gemini/codex are persona-scoped; auto-skip means NO prompt fired
    // for them. With persona=null, only the global ones get bake/defer prompts.
    expect(args.find((a) => a.startsWith("claude="))).toBeUndefined();
    expect(args.find((a) => a.startsWith("gemini="))).toBeUndefined();
    expect(args.find((a) => a.startsWith("codex="))).toBeUndefined();
  });

  it("bakes persona-scoped cred when persona supplied", async () => {
    // With persona, claude/gemini/codex are baked-capable. Order matches
    // DEFAULT_MANIFEST iteration.
    const rl = mockRl([
      "d", // gh-cli
      "b", "l", '{"creds":"otto-claude"}', // claude bake literal
      "d", "d", // gemini, codex
      "d", "d", "d", "d", "d", "d", // remaining
    ]);
    const args = await runPicker(rl, "otto");
    expect(args.find((a) => a.startsWith("claude="))).toBe('claude={"creds":"otto-claude"}');
  });

  it("treats empty choice as defer", async () => {
    const rl = mockRl(Array(15).fill(""));
    const args = await runPicker(rl, null);
    expect(args.length).toBe(0);
  });

  it("treats unrecognized choice as defer", async () => {
    const rl = mockRl(Array(15).fill("xyz"));
    const args = await runPicker(rl, null);
    expect(args.length).toBe(0);
  });

  it("skip explicit returns no bake", async () => {
    const rl = mockRl(Array(15).fill("s"));
    const args = await runPicker(rl, null);
    expect(args.length).toBe(0);
  });
});
