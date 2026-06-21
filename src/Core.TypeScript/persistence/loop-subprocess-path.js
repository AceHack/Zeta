// Pure helper for the OS-conditional subprocess PATH used by .claude/bin/claude-loop-tick.ts.
//
// Lives here (NOT next to the tick in .claude/bin/) for two reasons:
//   1. `.claude/bin/` is gitignored (.gitignore `bin/`), so a new file there would never
//      commit — the tick itself is only grandfathered-tracked.
//   2. Extracting the logic to a side-effect-free module makes it unit-testable; the tick
//      runs acquireLock()/heartbeat() at module top-level (not behind import.meta.main),
//      so it cannot be imported in a test without side effects.
//
// macOS/Linux: the launchd/systemd worker starts with a minimal PATH, so the tick must
// inject the standard tool dirs. Windows: the Task Scheduler task runs in the user session
// and inherits the full user PATH (bun/git/gh/dotnet already resolvable), so REPLACING PATH
// with a POSIX list would erase it and break every subprocess.
import { posix } from "node:path";
export function resolveSubprocessPath(platform, home, existingPath) {
    if (platform === "win32") {
        return existingPath ?? "";
    }
    // posix.join (not the host-dependent join) so the POSIX PATH is always "/"-joined
    // regardless of which host renders it — correct for the darwin/linux target and makes
    // the helper host-independent for testing.
    return `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${posix.join(home, ".local/bin")}`;
}
