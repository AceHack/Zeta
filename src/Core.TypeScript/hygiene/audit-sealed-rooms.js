#!/usr/bin/env bun
// audit-sealed-rooms.ts — 081KTSZN10008QG0R002J0GE0Z Reticulum-only enforcement, the LINT half.
//
// THE CLAUSE (Aaron, 081KTSZN10008QG0R002J0GE0Z): "at no point do our tests need to interact with hdd or git or tool
// or anything other than reticulum… it will force us to have cache loaded in the room at
// startup." The runtime half is THE DOUBLE-RUN CHECK in TestLoop.run (ambient ENTROPY is a
// mechanical failure); this audit is the AMBIENT-CHANNEL half: .NET has no reliable in-process
// syscall hook, so the seal is self-declared and mechanically swept — any file whose head
// carries the marker `SEALED-ROOM` must contain ZERO ambient-channel tokens. Declaring the
// marker is opt-in; breaking it is a gate failure, never a review convention.
//
// Banned inside a sealed room (the ambient doors, per noninterference #13):
//   filesystem (System.IO/File./Directory./Path.GetTemp), process/env (Process/Environment.),
//   network (HttpClient/Socket/Dns), clocks (DateTime.Now|UtcNow/Stopwatch), entropy
//   (Guid.NewGuid/Random(), RandomNumberGenerator), threadpool spawn (Task.Run — the un-knobbed
//   thread, per async-all-the-way).
//
// Exit 0 = every sealed room is sealed. Exit 1 = lists file:line token findings.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
const MARKER = "SEALED-ROOM";
const BANNED = [
    [/\bSystem\.IO\b/, "filesystem namespace"],
    [/\bFile\./, "filesystem"],
    [/\bDirectory\./, "filesystem"],
    [/\bPath\.GetTemp/, "filesystem (temp)"],
    [/\bProcess\b/, "process spawn"],
    [/\bEnvironment\./, "ambient environment"],
    [/\bHttpClient\b/, "network"],
    [/\bSocket\b/, "network"],
    [/\bDns\b/, "network"],
    [/\bDateTime\.(Now|UtcNow)\b/, "wall clock"],
    [/\bStopwatch\b/, "wall clock"],
    [/\bGuid\.NewGuid\b/, "ambient entropy"],
    [/\bRandom\s*\(/, "ambient entropy"],
    [/\bRandomNumberGenerator\b/, "ambient entropy"],
    [/\bTask\.Run\b/, "un-knobbed thread spawn"],
];
const root = process.argv[2] ?? ".";
const findings = [];
let sealedCount = 0;
function walk(dir) {
    let entries;
    try {
        entries = readdirSync(dir);
    }
    catch {
        return;
    }
    for (const name of entries) {
        if (["node_modules", ".git", "references", "bin", "obj", ".lake"].includes(name))
            continue;
        const path = join(dir, name);
        let st;
        try {
            st = statSync(path);
        }
        catch {
            continue;
        }
        if (st.isDirectory())
            walk(path);
        else if (/\.(fs|cs|ts|rs)$/.test(name))
            inspect(path);
    }
}
function inspect(path) {
    if (path.endsWith("audit-sealed-rooms.ts") || path.endsWith("audit-sealed-rooms.test.ts"))
        return; // this auditor documents the marker + tokens
    const text = readFileSync(path, "utf8");
    const head = text.split("\n", 30).join("\n");
    if (!head.includes(MARKER))
        return;
    sealedCount += 1;
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes(MARKER))
            continue; // the declaration line itself may name the banned doors
        if (line.includes("SEAL-WAIVER:"))
            continue; // explicit, visible, per-line waiver (falsifiers PROVE the boundary rejects these tokens — the waiver names why)
        for (const [re, why] of BANNED) {
            if (re.test(line))
                findings.push(`${path}:${i + 1} — ${why}: ${line.trim().slice(0, 90)}`);
        }
    }
}
walk(root);
if (findings.length > 0) {
    console.error(`FAIL: ${findings.length} ambient-channel token(s) inside SEALED-ROOM files (081KTSZN10008QG0R002J0GE0Z Reticulum-only clause):`);
    for (const f of findings)
        console.error("  " + f);
    process.exit(1);
}
console.log(`ok: ${sealedCount} sealed room(s) swept — zero ambient-channel tokens (the warm cache holds)`);
