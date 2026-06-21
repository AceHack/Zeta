// counters — the pro(file) verb's LIVE-METRICS lane (dotnet-counters), glass-side only.
// Usage: bun src/Core.TypeScript/perf/counters.ts [--pid N | -- <cmd...>] [--seconds S] [--out F]
// With --out: collects to csv. Without: live monitor in the terminal.
import { acquire, observe, durationOf, parseLaneFlags } from "./glass";
/** Pure: the dotnet-counters argv — monitor (no out) or collect-to-csv (out). */
export function countersArgsOf(pid, flags) {
    const args = [flags.out !== undefined ? "collect" : "monitor", "-p", String(pid)];
    if (flags.out !== undefined)
        args.push("-o", flags.out, "--format", "csv");
    if (flags.seconds !== undefined)
        args.push("--duration", durationOf(flags.seconds));
    return args;
}
if (import.meta.main) {
    const flags = parseLaneFlags(process.argv.slice(2));
    const t = acquire({ pid: flags.pid, command: flags.command });
    const args = countersArgsOf(t.pid, flags);
    console.error(`counters: watching through the glass — dotnet-counters ${args.join(" ")}`);
    process.exit(observe("dotnet-counters", args, t));
}
