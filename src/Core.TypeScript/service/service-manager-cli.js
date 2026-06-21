#!/usr/bin/env bun
/**
 * service/service-manager-cli.ts — unified CLI for installing/managing loop services.
 *
 * Usage:
 *   bun service-manager-cli.ts install --persona <name> [--schedule <seconds>]
 *   bun service-manager-cli.ts uninstall --persona <name>
 *   bun service-manager-cli.ts status --persona <name>
 *   bun service-manager-cli.ts list
 */
import { createServiceManager } from "./adapters";
import { getPersona, listPersonas } from "./persona-registry";
const args = process.argv.slice(2);
const command = args[0];
function parsePersona() {
    const idx = args.indexOf("--persona");
    return idx !== -1 ? args[idx + 1] ?? null : null;
}
function parseSchedule() {
    const idx = args.indexOf("--schedule");
    if (idx === -1 || !args[idx + 1])
        return undefined;
    const n = Number(args[idx + 1]);
    return Number.isFinite(n) && n > 0 ? n : undefined;
}
function usage() {
    console.log(`Usage:
  install --persona <name> [--schedule <seconds>]
  uninstall --persona <name>
  status --persona <name>
  list

Valid personas: ${listPersonas().map(p => p.name).join(", ")}`);
}
async function main() {
    if (!command || command === "help" || command === "--help") {
        usage();
        process.exit(0);
    }
    if (command === "list") {
        const personas = listPersonas();
        console.log("Registered personas:");
        for (const p of personas) {
            console.log(`  ${p.name.padEnd(10)} label=${p.label}  interval=${p.scheduleInterval}s  ref=${p.defaultRef}`);
        }
        process.exit(0);
    }
    const persona = parsePersona();
    if (!persona) {
        console.error("Error: --persona <name> is required.");
        usage();
        process.exit(1);
    }
    if (!getPersona(persona)) {
        console.error(`Error: unknown persona "${persona}".`);
        console.error(`Valid: ${listPersonas().map(p => p.name).join(", ")}`);
        process.exit(1);
    }
    const manager = createServiceManager();
    switch (command) {
        case "install": {
            const schedule = parseSchedule();
            const result = await manager.install(persona, schedule ? { schedule } : {});
            console.log(result.ok ? `✓ ${result.message}` : `✗ ${result.message}`);
            process.exit(result.ok ? 0 : 1);
            break;
        }
        case "uninstall": {
            const result = await manager.uninstall(persona);
            console.log(result.ok ? `✓ ${result.message}` : `✗ ${result.message}`);
            process.exit(result.ok ? 0 : 1);
            break;
        }
        case "status": {
            const status = await manager.status(persona);
            console.log(`${persona}: ${status.state} (${status.label})`);
            process.exit(0);
            break;
        }
        default:
            console.error(`Unknown command: ${command}`);
            usage();
            process.exit(1);
    }
}
main().catch(err => {
    console.error(err);
    process.exit(1);
});
