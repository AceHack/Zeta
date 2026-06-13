#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function repoRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..");
}

function run(cmd: string, args: string[], cwd?: string): void {
  const result = spawnSync(cmd, args, { stdio: "inherit", cwd });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function installTools(): void {
  const tools = [
    "dotnet-counters",
    "dotnet-trace",
    "dotnet-dump",
    "dotnet-gcdump",
    "dotnet-symbol",
    "dotnet-sos",
    "dotnet-reportgenerator-globaltool",
  ];
  for (const tool of tools) {
    const update = spawnSync("dotnet", ["tool", "update", "--global", tool], {
      stdio: "inherit",
    });
    if (update.status !== 0) {
      run("dotnet", ["tool", "install", "--global", tool]);
    }
  }
  process.stdout.write("All tools installed.\n");
}

function requirePid(argv: string[]): string {
  const pid = argv[1];
  if (!pid) {
    process.stderr.write(`usage: profile.ts ${argv[0]} <pid>\n`);
    process.exit(64);
  }
  return pid;
}

const command = process.argv[2] ?? "";
const rest = process.argv.slice(2);

switch (command) {
  case "install":
    installTools();
    break;

  case "counters":
    run("dotnet-counters", [
      "monitor",
      "--process-id",
      requirePid(rest),
      "--counters",
      "System.Runtime,System.Runtime.Gc,System.Threading.ThreadPool",
    ]);
    break;

  case "trace": {
    const pid = requirePid(rest);
    run("dotnet-trace", [
      "collect",
      "--process-id",
      pid,
      "--providers",
      "Microsoft-DotNETCore-SampleProfiler,Microsoft-Windows-DotNETRuntime:0x1CCBDCC:4",
      "--duration",
      "00:00:30",
    ]);
    run("dotnet-trace", ["convert", "--format", "speedscope", "trace.nettrace"]);
    process.stdout.write(
      "Open trace.speedscope.json at https://www.speedscope.app\n",
    );
    break;
  }

  case "gcdump":
    run("dotnet-gcdump", ["collect", "-p", requirePid(rest)]);
    break;

  case "bench":
    run(
      "dotnet",
      [
        "run",
        "--project",
        "bench/Benchmarks",
        "-c",
        "Release",
        "--",
        "--filter",
        rest[1] ?? "*",
        "--memoryRandomization",
        "--runOncePerIteration",
      ],
      repoRoot(),
    );
    break;

  case "coverage":
    run(
      "dotnet",
      [
        "test",
        "Zeta.sln",
        "-c",
        "Release",
        "/p:CollectCoverage=true",
        "/p:CoverletOutputFormat=cobertura",
        "/p:CoverletOutput=./TestResults/",
        '/p:Exclude=[Dbsp.Tests.*]*',
      ],
      repoRoot(),
    );
    run(
      "reportgenerator",
      [
        "-reports:tests/**/TestResults/coverage.cobertura.xml",
        "-targetdir:./coverage-report",
        "-reporttypes:Html",
      ],
      repoRoot(),
    );
    process.stdout.write("Coverage HTML at ./coverage-report/index.html\n");
    break;

  default:
    process.stdout.write(`DBSP profiling helper.

  bun tools/profile.ts install            # install all dotnet diagnostic tools
  bun tools/profile.ts counters <pid>     # live runtime + GC + thread-pool counters
  bun tools/profile.ts trace <pid>        # session trace for speedscope.app
  bun tools/profile.ts gcdump <pid>       # heap dump for PerfView
  bun tools/profile.ts bench [filter]     # BenchmarkDotNet run with memory diagnoser
  bun tools/profile.ts coverage           # run tests with coverage, emit HTML
`);
    if (command !== "" && command !== "-h" && command !== "--help")
      process.exit(64);
    break;
}
