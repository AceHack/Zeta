#!/usr/bin/env bun
// audit-dangling-symlinks.ts — every git-TRACKED symlink must resolve inside the repo.
//
// Why: the 2026-06-11 db/ migration (#7820) moved 31 dirs but not the relative symlinks
// pointing at/from them — nine links dangled and the GitHub Pages (Jekyll) build crashed on
// realpath for hours (every push, `No such file or directory @ rb_check_realpath_internal`).
// A dangling tracked symlink is invisible to dotnet/bun test suites; this is the guard.
//
// Scope: tracked symlinks only (mode 120000 in the index) — untracked/ignored trees
// (references/, node_modules/, .lake/) are not ours to police here.
// Exit 0 = all resolve · 1 = lists the danglers.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
const root = (() => {
    const r = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" });
    if (r.status !== 0) {
        console.error("audit-dangling-symlinks: not a git repo");
        process.exit(1);
    }
    return r.stdout.trim();
})();
const ls = spawnSync("git", ["ls-files", "-s"], { encoding: "utf8", cwd: root, maxBuffer: 64 * 1024 * 1024 });
if (ls.status !== 0) {
    console.error("audit-dangling-symlinks: git ls-files failed");
    process.exit(1);
}
const danglers = [];
let tracked = 0;
for (const line of ls.stdout.split("\n")) {
    if (!line.startsWith("120000 "))
        continue;
    tracked += 1;
    const path = line.split("\t")[1];
    if (path === undefined)
        continue;
    const abs = resolve(root, path);
    // existsSync follows the link; a link to a link resolves transitively (the kernel's job).
    if (!existsSync(abs)) {
        const target = spawnSync("readlink", [abs], { encoding: "utf8" }).stdout.trim();
        danglers.push(`${path} -> ${target}  (resolves to ${resolve(dirname(abs), target)})`);
    }
}
if (danglers.length > 0) {
    console.error(`FAIL: ${danglers.length} tracked symlink(s) dangle — Jekyll/Pages crashes on these (see header):`);
    for (const d of danglers)
        console.error("  " + d);
    process.exit(1);
}
console.log(`ok: all ${tracked} tracked symlinks resolve`);
