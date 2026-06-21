#!/usr/bin/env bun
// Entry point for `zeta shadow` — thin wrapper around shadow-observer run().
import { run, parseConfig } from "./shadow-observer.js";
if (import.meta.main) {
    let config;
    try {
        config = parseConfig(Bun.argv.slice(2));
    }
    catch (err) {
        console.error("Shadow observer error:", err instanceof Error ? err.message : String(err));
        process.exit(1);
    }
    run(config).catch((err) => {
        console.error("Shadow observer fatal error:", err);
        process.exit(1);
    });
}
