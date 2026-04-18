#!/usr/bin/env bash
# Profiling helper — installs dotnet diagnostic tools (idempotent) and runs
# a common set of captures against a long-running DBSP circuit.
#
# Usage:
#   ./tools/profile.sh install              # install/update all tools
#   ./tools/profile.sh counters <pid>       # live runtime counters
#   ./tools/profile.sh trace <pid>          # session trace for speedscope
#   ./tools/profile.sh gcdump <pid>         # heap dump for PerfView
#   ./tools/profile.sh bench                # run BDN with DisassemblyDiagnoser

set -eu

case "${1:-}" in
    install)
        dotnet tool update --global dotnet-counters   || dotnet tool install --global dotnet-counters
        dotnet tool update --global dotnet-trace      || dotnet tool install --global dotnet-trace
        dotnet tool update --global dotnet-dump       || dotnet tool install --global dotnet-dump
        dotnet tool update --global dotnet-gcdump     || dotnet tool install --global dotnet-gcdump
        dotnet tool update --global dotnet-symbol     || dotnet tool install --global dotnet-symbol
        dotnet tool update --global dotnet-sos        || dotnet tool install --global dotnet-sos
        dotnet tool update --global dotnet-reportgenerator-globaltool \
            || dotnet tool install --global dotnet-reportgenerator-globaltool
        echo "All tools installed."
        ;;

    counters)
        pid="${2:?usage: $0 counters <pid>}"
        dotnet-counters monitor --process-id "$pid" \
            --counters System.Runtime,System.Runtime.Gc,System.Threading.ThreadPool
        ;;

    trace)
        pid="${2:?usage: $0 trace <pid>}"
        dotnet-trace collect --process-id "$pid" \
            --providers 'Microsoft-DotNETCore-SampleProfiler,Microsoft-Windows-DotNETRuntime:0x1CCBDCC:4' \
            --duration 00:00:30
        dotnet-trace convert --format speedscope trace.nettrace
        echo "Open trace.speedscope.json at https://www.speedscope.app"
        ;;

    gcdump)
        pid="${2:?usage: $0 gcdump <pid>}"
        dotnet-gcdump collect -p "$pid"
        ;;

    bench)
        cd "$(dirname "$0")/.."
        dotnet run --project bench/Dbsp.Benchmarks -c Release -- \
            --filter "${2:-*}" --memoryRandomization --runOncePerIteration
        ;;

    coverage)
        cd "$(dirname "$0")/.."
        dotnet test Dbsp.sln -c Release \
            /p:CollectCoverage=true \
            /p:CoverletOutputFormat=cobertura \
            /p:CoverletOutput=./TestResults/ \
            /p:Exclude="[Dbsp.Tests.*]*"
        reportgenerator -reports:'tests/**/TestResults/coverage.cobertura.xml' \
            -targetdir:./coverage-report -reporttypes:Html
        echo "Coverage HTML at ./coverage-report/index.html"
        ;;

    *)
        cat <<EOF
DBSP profiling helper.

  $0 install            # install all dotnet diagnostic tools
  $0 counters <pid>     # live runtime + GC + thread-pool counters
  $0 trace <pid>        # session trace for speedscope.app
  $0 gcdump <pid>       # heap dump for PerfView
  $0 bench [filter]     # BenchmarkDotNet run with memory diagnoser
  $0 coverage           # run tests with coverage, emit HTML

Typical flow for finding a hot spot:
  dotnet run --project samples/Dbsp.Demo -c Release &
  PID=\$!
  $0 counters \$PID     # watch live — confirm alloc-rate trend
  $0 trace \$PID        # capture a 30-s snapshot, view in speedscope
EOF
        ;;
esac
