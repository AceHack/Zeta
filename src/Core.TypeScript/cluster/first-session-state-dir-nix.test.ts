#!/usr/bin/env bun
/**
 * first-session-state-dir-nix.test.ts — the first-session marker + journal directory
 * must belong to the user who writes them.
 *
 * THE DEFECT. `zeta-first-session.nix` declared
 *     "d /var/lib/zeta-first-session 0755 root root -"
 * beside a comment claiming "marker write uses sudo in profile hook". The profile hook
 * has no sudo: it runs the conductor (`first-session-run.ts`) as the logged-in user, and
 * that process does `mkdirSync(dirname(marker))`, `writeFileSync(marker)` and appends the
 * journal (`journalPathFor(marker)` — a sibling file) itself. Against a root-owned 0755
 * directory each is EACCES, so the marker never lands and the credential adventure re-ran
 * on every interactive login for the life of the node.
 *
 * `nix flake check` is not run by any workflow on this flake; this file reads the module as
 * text (the `zeta-creds-to-k8s-nix.test.ts` pattern) and is the gate that still fires.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { journalPathFor } from "../observe/first-session-journal";

const MODULE = fileURLToPath(
  new URL("../../../full-ai-cluster/nixos/modules/zeta-first-session.nix", import.meta.url),
);
const text = readFileSync(MODULE, "utf8");
/** Nix with `#` comment lines removed, so a comment can neither satisfy nor trip a check. */
const code = text
  .split("\n")
  .filter((l) => !/^\s*#/.test(l))
  .join("\n");

/** Split a tmpfiles line into fields, keeping a Nix `${...}` interpolation (which may hold a space) whole. */
function fieldsOf(rule: string): string[] {
  return rule.match(/\$\{[^}]*\}|\S+/g) ?? [];
}

function tmpfilesRules(): string[] {
  const block = code.match(/systemd\.tmpfiles\.rules\s*=\s*\[([^\]]*)\]/s)?.[1] ?? "";
  return [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
}

describe("zeta-first-session.nix state directory ownership", () => {
  test("the marker's directory is created owned by the conductor's user, never root", () => {
    const rules = tmpfilesRules();
    const dir = rules.find((r) => r.startsWith("d "));
    expect(dir).toBeDefined();
    // `d <path> <mode> <user> <group> <age>`
    const fields = fieldsOf(dir!);
    expect(fields[1]).toBe("${builtins.dirOf cfg.markerPath}");
    expect(fields[3]).toBe("${cfg.user}");
    expect(fields[3]).not.toBe("root");
  });

  test("a directory an earlier generation left root-owned is repaired (Z)", () => {
    const fix = tmpfilesRules().find((r) => r.startsWith("Z "));
    expect(fix).toBeDefined();
    const fields = fieldsOf(fix!);
    expect(fields[1]).toBe("${builtins.dirOf cfg.markerPath}");
    expect(fields[3]).toBe("${cfg.user}");
  });

  test("the conductor really does write the journal beside the marker, as itself", () => {
    // If the journal ever moved out of the marker's directory, owning that
    // directory would no longer be sufficient and this guard must grow with it.
    const marker = "/var/lib/zeta-first-session/complete.marker";
    expect(journalPathFor(marker).replaceAll("\\", "/").startsWith("/var/lib/zeta-first-session/")).toBe(true);
  });

  test("the profile hook runs the conductor as the logged-in user (no sudo to blame)", () => {
    // The old comment excused the root-owned directory with a sudo that does not exist.
    expect(code).not.toMatch(/sudo\b[^\n]*markerPath/);
    expect(code).toContain('if [ "$(id -un)" = "${cfg.user}" ]; then');
  });
});
