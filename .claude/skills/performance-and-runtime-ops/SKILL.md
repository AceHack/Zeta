---
name: performance-and-runtime-ops
description: Performance and runtime ops — tuning, benchmarking, profiling, concurrency, SIMD, containers, CI, observability.
---

# performance and runtime ops

Category skill (blueprint pack). The `description` above is the only thing the
router sees — broad and generic on purpose. The fat detail lives in the
blueprints below; open the one that matches and read it in full.

Governs its own form per `.claude/rules/rules-are-small-carved-sentences-pointing-to-docs.md`
and `.claude/rules/mirror-beacon-register-discipline.md` (carved sentence = hub /
Beacon; blueprint = satellite / Mirror). The directory is an independent shipping unit.

## Blueprints

- [`performance-engineer`](blueprints/performance-engineer.md) — Hot-path tuning — allocation audits, cache-line behaviour, SIMD dispatch, benchmark-driven optimization.
- [`performance-analysis-expert`](blueprints/performance-analysis-expert.md) — Performance analysis — queueing theory, USE/RED, Amdahl, flame graphs, AOT/PGO trade-offs, top-down uarch analysis.
- [`benchmark-authoring-expert`](blueprints/benchmark-authoring-expert.md) — BenchmarkDotNet authoring — MemoryDiagnoser, warmups, Params sweeps, baselines, allocations, outlier detection.
- [`profiling-expert`](blueprints/profiling-expert.md) — Profiling — CPU/off-CPU/memory sampling, flame graphs, dotnet-trace/PerfView, eBPF, differential analysis.
- [`threading-expert`](blueprints/threading-expert.md) — Threading/concurrency — OS threads, pools, lock-free structures, memory models, .NET Task/async, F# MailboxProcessor.
- [`hardware-intrinsics-expert`](blueprints/hardware-intrinsics-expert.md) — .NET hardware intrinsics — Vector128/256/512, SSE/AVX/AdvSimd, IsSupported, cache alignment, branchless SIMD.
- [`jit-codegen-expert`](blueprints/jit-codegen-expert.md) — Query JIT codegen — Hyper/Umbra/LLVM-style pipeline fusion, .NET Reflection.Emit/DynamicMethod/Expressions.
- [`networking-expert`](blueprints/networking-expert.md) — Networking / transport — TCP/UDP/QUIC internals, TLS, socket APIs, gRPC, load balancing, service mesh, kernel-bypass.
- [`serialization-and-wire-format-expert`](blueprints/serialization-and-wire-format-expert.md) — Serialization / wire formats — MessagePack, Protobuf, FlatBuffers, Arrow, Parquet, schema evolution, zero-copy, fuzzing.
- [`docker-expert`](blueprints/docker-expert.md) — Docker / containerisation — multi-stage builds, devcontainer, layer caching, pinned images, .dockerignore, Codespaces.
- [`github-actions-expert`](blueprints/github-actions-expert.md) — GitHub Actions — workflow idioms, security hardening, concurrency, caching, matrix, reusable workflows, SHA pinning.
- [`devops-engineer`](blueprints/devops-engineer.md) — DevOps — install script parity, GitHub Actions design, runner pinning, least privilege, upstream PRs.
- [`alerting-expert`](blueprints/alerting-expert.md) — Alerting — AlertManager, burn-rate SLOs, alert fatigue, PagerDuty routing, runbooks, deadman switches.
- [`metrics-expert`](blueprints/metrics-expert.md) — Metrics — Prometheus, OpenMetrics, counter/gauge/histogram, cardinality, RED/USE signals, SLI, exemplars.
- [`logging-expert`](blueprints/logging-expert.md) — "Logging — ILogger/Serilog/NLog, log levels, correlation IDs, Loki/Splunk/Datadog, PII risks, log-as-metric traps."
- [`structured-logging-expert`](blueprints/structured-logging-expert.md) — Structured logging — OTel Logs, ECS fields, message templates, PII redaction, correlation IDs, schema-as-API.
- [`observability-and-tracing-expert`](blueprints/observability-and-tracing-expert.md) — "Observability — OpenTelemetry, distributed tracing, metrics/logs/traces, sampling, continuous profiling."
- [`error-tracking-expert`](blueprints/error-tracking-expert.md) — Error tracking — Sentry/Rollbar fingerprinting, releases, PII in exceptions, regressions, Result-over-exception.
- [`operations-monitoring-expert`](blueprints/operations-monitoring-expert.md) — SRE operations — SLI/SLO/error budgets, on-call, incident command, runbooks, chaos engineering, toil reduction.
- [`lightlike-observability-discipline`](blueprints/lightlike-observability-discipline.md) — Lightlike-substrate observability design-rule — OTel, Kubernetes, Argo, Prometheus, Git instrumentation.
