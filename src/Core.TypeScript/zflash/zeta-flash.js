#!/usr/bin/env bun
/**
 * zeta-flash.ts — unified router for `zeta flash` (F# shell) and MCP callers.
 *
 * Dispatches to platform-specific zflash CLIs without exposing raw bun paths:
 *   zeta flash usb [--agent] …          → cli.ts (mac) or flash-usb-windows.ts (win)
 *   zeta flash inject <dev> <key> [log] → flash-and-inject.ts (win removable)
 *   zeta flash inspect <dev> <off> [log] → fat-inspect.ts
 *   zeta flash …                        → cli.ts passthrough (mac zflash)
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
const ZFLASH_DIR = import.meta.dir;
function usage() {
    console.error(`usage: zeta flash <usb|inject|inspect> [args…]
       zeta flash [zflash args…]   (mac installer; same as cli.ts)

  usb     Flash installer ISO to USB (platform-specific backend)
  inject  Windows removable USB: raw ISO + FAT12 pubkey inject
  inspect Read-only FAT12 ESP inspector (elevated Windows)`);
    process.exit(2);
}
function reexec(script, args) {
    const scriptPath = join(ZFLASH_DIR, script);
    const result = spawnSync(process.execPath, [scriptPath, ...args], {
        stdio: "inherit",
        env: process.env,
    });
    process.exit(result.status ?? 1);
}
function main(argv) {
    const [sub, ...rest] = argv;
    if (!sub || sub === "-h" || sub === "--help")
        usage();
    switch (sub) {
        case "usb":
            reexec(process.platform === "win32" ? "flash-usb-windows.ts" : "cli.ts", rest);
        case "inject":
            reexec("flash-and-inject.ts", rest);
        case "inspect":
            reexec("fat-inspect.ts", rest);
        default:
            reexec("cli.ts", argv);
    }
}
if (import.meta.main) {
    main(process.argv.slice(2));
}
