import { test, expect } from "bun:test";
import { resolveSubprocessPath } from "./loop-subprocess-path";
test("win32 inherits the existing PATH unchanged (no POSIX override)", () => {
    const existing = "C:\\Users\\x\\.bun\\bin;C:\\Windows\\system32";
    expect(resolveSubprocessPath("win32", "C:\\Users\\x", existing)).toBe(existing);
});
test("win32 with undefined PATH yields empty string (not 'undefined')", () => {
    expect(resolveSubprocessPath("win32", "C:\\Users\\x", undefined)).toBe("");
});
test("darwin prepends the POSIX tool dirs + ~/.local/bin", () => {
    const p = resolveSubprocessPath("darwin", "/Users/x", "/existing");
    expect(p).toBe("/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/Users/x/.local/bin");
});
test("linux uses the same POSIX list as darwin", () => {
    expect(resolveSubprocessPath("linux", "/home/x", "/existing"))
        .toBe("/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/home/x/.local/bin");
});
