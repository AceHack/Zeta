// gcdump — the pro(file) verb's HEAP-SNAPSHOT lane (dotnet-gcdump), glass-side only.
// Usage: bun src/Core.TypeScript/perf/gcdump.ts --pid N [--out F]
// (Snapshot of a live heap — no spawn mode: a heap worth dumping already exists.)
import { acquire, observe, parseLaneFlags } from "./glass";
/** Pure: the dotnet-gcdump argv for one snapshot. */
export function gcdumpArgsOf(pid, flags) {
    const args = ["collect", "-p", String(pid)];
    if (flags.out !== undefined)
        args.push("-o", flags.out);
    return args;
}
if (import.meta.main) {
    const flags = parseLaneFlags(process.argv.slice(2));
    const t = acquire({ pid: flags.pid, command: flags.command });
    const args = gcdumpArgsOf(t.pid, flags);
    console.error(`gcdump: snapshotting through the glass — dotnet-gcdump ${args.join(" ")}`);
    process.exit(observe("dotnet-gcdump", args, t));
}
