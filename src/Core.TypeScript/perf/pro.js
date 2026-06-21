// pro — the pro(file) verb's TRACE lane (dotnet-trace / EventPipe), glass-side only.
// Usage: bun src/Core.TypeScript/perf/pro.ts [--pid N | -- <cmd...>] [--seconds S] [--out F]
// Analysis lanes: PerfView (Windows, the senior session), TraceEvent, `dotnet-trace report`.
import { acquire, observe, durationOf, parseLaneFlags } from "./glass";
/** Pure: the dotnet-trace argv for a collection — tested without spawning anything. */
export function traceArgsOf(pid, flags) {
    const out = flags.out ?? `pro-${pid}.nettrace`;
    const args = ["collect", "-p", String(pid), "-o", out];
    if (flags.seconds !== undefined)
        args.push("--duration", durationOf(flags.seconds));
    return args;
}
if (import.meta.main) {
    const flags = parseLaneFlags(process.argv.slice(2));
    const t = acquire({ pid: flags.pid, command: flags.command });
    const args = traceArgsOf(t.pid, flags);
    console.error(`pro: attaching through the glass — dotnet-trace ${args.join(" ")}`);
    const status = observe("dotnet-trace", args, t);
    if (status !== 0) {
        console.error(`pro: dotnet-trace exited ${status} (is pid ${t.pid} a .NET process? try \`dotnet-trace ps\`)`);
        process.exit(status);
    }
    console.error(`pro: trace written — analyze with \`dotnet-trace report <file> topN\` or PerfView/TraceEvent`);
}
