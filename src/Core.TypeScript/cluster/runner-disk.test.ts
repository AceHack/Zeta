import { describe, expect, test } from "bun:test";
import {
  RECLAIM_CANDIDATES,
  REFUSED_CANDIDATES,
  auditEnvelopeDisk,
  dockerRootDir,
  filesystemFor,
  measureDisk,
  parseDf,
  reclaim,
  type Runner,
} from "./runner-disk.ts";

const GIB = 1024 ** 3;

const DF = [
  "Filesystem     1024-blocks      Used Available Capacity Mounted on",
  "/dev/root         76026616  62000000  14026616      82% /",
  "/dev/sdb1         77851836   4000000  69851836       6% /mnt",
  "tmpfs              8177128         0   8177128       0% /dev/shm",
  "/dev/loop 3          61440     61440         0     100% /snap/core/with space",
].join("\n");

/** A runner whose answers are declared per (command, first arg) — no real machine touched. */
function fakeRunner(
  du: Readonly<Record<string, number | null>>,
  seen: string[][] = [],
): { run: Runner; seen: string[][] } {
  const run: Runner = (command, args) => {
    seen.push([command, ...args]);
    if (command === "df") return { status: 0, stdout: DF, stderr: "" };
    if (command === "docker") return { status: 0, stdout: "/var/lib/docker\n", stderr: "" };
    if (command === "du") {
      const path = args[1] ?? "";
      const bytes = du[path];
      if (bytes === null || bytes === undefined) return { status: 1, stdout: "", stderr: "No such file or directory" };
      return { status: 0, stdout: `${String(Math.round(bytes / 1024))}\t${path}\n`, stderr: "" };
    }
    return { status: 0, stdout: "", stderr: "" };
  };
  return { run, seen };
}

describe("parseDf", () => {
  test("reads 1024-byte blocks as bytes and keeps the mount point whole", () => {
    const rows = parseDf(DF);
    expect(rows.map((row) => row.mountedOn)).toEqual(["/", "/mnt", "/dev/shm", "/snap/core/with space"]);
    expect(rows[0]?.availableBytes).toBe(14026616 * 1024);
    expect(rows[1]?.totalBytes).toBe(77851836 * 1024);
  });

  test("the header line is not a filesystem", () => {
    expect(parseDf(DF).some((row) => row.filesystem === "Filesystem")).toBe(false);
  });
});

describe("filesystemFor", () => {
  // The whole point: `/` is a prefix of every path, so a first-match reading
  // reports the root disk for a path on the second one.
  test("longest prefix wins, so /mnt/x is on /mnt and not on /", () => {
    expect(filesystemFor("/mnt/docker", parseDf(DF))?.mountedOn).toBe("/mnt");
    expect(filesystemFor("/var/lib/docker", parseDf(DF))?.mountedOn).toBe("/");
  });

  test("a prefix must end at a path separator — /mnt does not own /mnt-other", () => {
    expect(filesystemFor("/mnt-other/docker", parseDf(DF))?.mountedOn).toBe("/");
  });

  test("no matching filesystem is null, never a default", () => {
    expect(filesystemFor("relative/path", parseDf(DF))).toBeNull();
  });
});

describe("auditEnvelopeDisk", () => {
  test("smaller than declared convicts", () => {
    const findings = auditEnvelopeDisk(14, filesystemFor("/var/lib/docker", parseDf(DF)), "/var/lib/docker");
    expect(findings.length).toBe(1);
    expect(findings[0]?.problem).toContain("too generous");
  });

  test("bigger than declared is slack, not a defect", () => {
    expect(auditEnvelopeDisk(10, filesystemFor("/var/lib/docker", parseDf(DF)), "/var/lib/docker")).toEqual([]);
  });

  test("an unread comparator is a finding, not a pass", () => {
    const findings = auditEnvelopeDisk(14, null, "/var/lib/docker");
    expect(findings.length).toBe(1);
    expect(findings[0]?.problem).toContain("UNVERIFIED");
  });

  test("exactly equal passes — the convicting comparison is strict", () => {
    const exact = { filesystem: "x", totalBytes: 20 * GIB, usedBytes: 6 * GIB, availableBytes: 14 * GIB, mountedOn: "/" };
    expect(auditEnvelopeDisk(14, exact, "/var/lib/docker")).toEqual([]);
  });
});

describe("measureDisk", () => {
  test("an absent candidate is null, never zero", () => {
    const { run } = fakeRunner({ "/opt/ghc": 3 * GIB });
    const measurement = measureDisk(run);
    const ghc = measurement.candidates.find((candidate) => candidate.path === "/opt/ghc");
    const android = measurement.candidates.find((candidate) => candidate.path === "/usr/local/lib/android");
    expect(ghc?.bytes).toBe(3 * GIB);
    expect(android?.bytes).toBeNull();
    expect(measurement.candidateBytes).toBe(3 * GIB);
  });

  test("docker root falls back to /var/lib/docker only when docker cannot answer", () => {
    const run: Runner = (command) =>
      command === "docker"
        ? { status: 1, stdout: "", stderr: "Cannot connect to the Docker daemon" }
        : { status: 0, stdout: DF, stderr: "" };
    expect(dockerRootDir(run)).toBe("/var/lib/docker");
  });
});

describe("reclaim", () => {
  test("deletes ONLY allowlisted paths that exist, and nothing else", () => {
    const { run, seen } = fakeRunner({ "/opt/ghc": 3 * GIB, "/usr/share/swift": 1 * GIB });
    const outcome = reclaim(run, () => 0);
    // The elevator is now an ABSOLUTE resolved path, never the bare name — a by-name
    // elevator is substitutable by any writable directory earlier on `PATH`
    // (docs/BUGS.md P1, 2026-08-24). Matching on `endsWith("/sudo")` keeps the assertion
    // portable across /usr/bin and /run/wrappers/bin while still refusing a bare name.
    const removed = seen
      .filter((call) => (call[0] ?? "").endsWith("/sudo") && call[1] === "rm")
      .map((call) => call[3]);
    expect(removed.toSorted()).toEqual(["/opt/ghc", "/usr/share/swift"]);
    expect(outcome.deleted.length).toBe(2);
    // The falsifier: a bare `sudo` would satisfy the old assertion and must not satisfy
    // this one. Nothing spawned here may be resolved through PATH.
    for (const call of seen) expect(call[0]).not.toBe("sudo");
  });

  test("no refused path is ever a delete target", () => {
    const refused = new Set(REFUSED_CANDIDATES.map((entry) => entry.path));
    for (const candidate of RECLAIM_CANDIDATES) expect(refused.has(candidate.path)).toBe(false);
  });

  // The one that would hurt: the repo's build gate is `dotnet build -c Release`.
  test("the .NET SDK is refused BY NAME, with the user of it recorded", () => {
    const dotnet = REFUSED_CANDIDATES.find((entry) => entry.path === "/usr/share/dotnet");
    expect(dotnet).toBeDefined();
    expect(dotnet?.usedBy).toContain("dotnet build");
  });

  test("every candidate carries a reason, and no reason is 'it is big'", () => {
    for (const candidate of RECLAIM_CANDIDATES) {
      expect(candidate.why.length).toBeGreaterThan(40);
      expect(candidate.why.toLowerCase()).not.toContain("it is big");
    }
  });
});
