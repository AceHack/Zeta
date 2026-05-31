import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  AgentLoopMode,
  WorkerKeepAliveConfigDefault,
  WorkerProcessEnvName,
  WorkerRuntimeConfigError,
  WorkerRuntimeConfigErrorCode,
  parseWorkerRuntimeConfigFromEnv,
  type WorkerProcessEnvironment,
} from "../src/index.ts";

describe("worker runtime config parsing", () => {
  test("parses typed runtime config from process env", () => {
    deepEqual(
      parseWorkerRuntimeConfigFromEnv({
        [WorkerProcessEnvName.AgenticOrgEnv]: " dev ",
        [WorkerProcessEnvName.AgenticOrgId]: " org-lfg ",
        [WorkerProcessEnvName.CockroachDatabaseUrl]: " postgresql://agentic-org@cockroachdb-public:26257/agentic_org ",
        [WorkerProcessEnvName.NatsServers]:
          " nats://nats.nats.svc.cluster.local:4222, nats://nats-backup.nats.svc.cluster.local:4222 ",
        [WorkerProcessEnvName.NatsStream]: " agentic-org-events ",
        [WorkerProcessEnvName.NatsDurable]: " agentic-org-v0-automation-planner ",
        [WorkerProcessEnvName.NatsInboundBatchSize]: "25",
        [WorkerProcessEnvName.WorkerInboundBatchSize]: "15",
        [WorkerProcessEnvName.WorkerOutboxBatchSize]: "10",
        [WorkerProcessEnvName.WorkerReactionPlanBatchSize]: "8",
        [WorkerProcessEnvName.WorkerReactionPlanLeaseMs]: "300000",
      }),
      {
        cockroachDatabaseUrl: "postgresql://agentic-org@cockroachdb-public:26257/agentic_org",
        environment: "dev",
        organizationId: "org-lfg",
        natsServers: ["nats://nats.nats.svc.cluster.local:4222", "nats://nats-backup.nats.svc.cluster.local:4222"],
        natsStreamName: "agentic-org-events",
        natsDurableName: "agentic-org-v0-automation-planner",
        natsInboundBatchSize: 25,
        workerInboundBatchSize: 15,
        workerOutboxBatchSize: 10,
        workerReactionPlanBatchSize: 8,
        workerReactionPlanLeaseMs: 300000,
        workerKeepAliveOrgHeartbeatDeadlineMs: WorkerKeepAliveConfigDefault.OrgHeartbeatDeadlineMs,
        agentLoopMode: AgentLoopMode.Legacy,
      },
    );
  });

  test("defaults the keep-alive org-heartbeat deadline when the env value is omitted", () => {
    const config = parseWorkerRuntimeConfigFromEnv(createMinimalValidEnv());

    equal(config.workerKeepAliveOrgHeartbeatDeadlineMs, WorkerKeepAliveConfigDefault.OrgHeartbeatDeadlineMs);
  });

  test("honors an explicit keep-alive org-heartbeat deadline override", () => {
    const config = parseWorkerRuntimeConfigFromEnv({
      ...createMinimalValidEnv(),
      [WorkerProcessEnvName.WorkerKeepAliveOrgHeartbeatDeadlineMs]: "45000",
    });

    equal(config.workerKeepAliveOrgHeartbeatDeadlineMs, 45000);
  });

  test("parses observe-act foreground loop mode", () => {
    const shadow = parseWorkerRuntimeConfigFromEnv({
      ...createMinimalValidEnv(),
      [WorkerProcessEnvName.AgentLoopMode]: " observe_act_shadow ",
    });
    const primary = parseWorkerRuntimeConfigFromEnv({
      ...createMinimalValidEnv(),
      [WorkerProcessEnvName.AgentLoopMode]: "observe_act_primary",
    });

    equal(shadow.agentLoopMode, AgentLoopMode.ObserveActShadow);
    equal(primary.agentLoopMode, AgentLoopMode.ObserveActPrimary);
  });

  test("rejects invalid observe-act foreground loop mode", () => {
    assertConfigError(
      { ...createMinimalValidEnv(), [WorkerProcessEnvName.AgentLoopMode]: "observe_act" },
      WorkerRuntimeConfigErrorCode.InvalidAgentLoopMode,
    );
  });

  test("rejects an invalid keep-alive org-heartbeat deadline override", () => {
    try {
      parseWorkerRuntimeConfigFromEnv({
        ...createMinimalValidEnv(),
        [WorkerProcessEnvName.WorkerKeepAliveOrgHeartbeatDeadlineMs]: "not-a-number",
      });
      throw new Error("expected config parsing to fail");
    } catch (error) {
      equal(error instanceof WorkerRuntimeConfigError, true);
      equal(
        (error as WorkerRuntimeConfigError).code,
        WorkerRuntimeConfigErrorCode.InvalidWorkerKeepAliveOrgHeartbeatDeadlineMs,
      );
    }
  });

  test("rejects missing required env values with typed errors", () => {
    assertConfigError(
      {
        [WorkerProcessEnvName.AgenticOrgId]: "org-lfg",
        [WorkerProcessEnvName.CockroachDatabaseUrl]: "postgresql://agentic-org@cockroachdb-public:26257/agentic_org",
        [WorkerProcessEnvName.NatsServers]: "nats://nats.nats.svc.cluster.local:4222",
        [WorkerProcessEnvName.NatsStream]: "agentic-org-events",
        [WorkerProcessEnvName.NatsDurable]: "agentic-org-v0-automation-planner",
        [WorkerProcessEnvName.NatsInboundBatchSize]: "25",
        [WorkerProcessEnvName.WorkerInboundBatchSize]: "15",
        [WorkerProcessEnvName.WorkerOutboxBatchSize]: "10",
        [WorkerProcessEnvName.WorkerReactionPlanBatchSize]: "8",
        [WorkerProcessEnvName.WorkerReactionPlanLeaseMs]: "300000",
      },
      WorkerRuntimeConfigErrorCode.MissingEnvironment,
    );
    assertConfigError(
      {
        [WorkerProcessEnvName.AgenticOrgEnv]: "dev",
        [WorkerProcessEnvName.AgenticOrgId]: "org-lfg",
        [WorkerProcessEnvName.NatsServers]: "nats://nats.nats.svc.cluster.local:4222",
        [WorkerProcessEnvName.NatsStream]: "agentic-org-events",
        [WorkerProcessEnvName.NatsDurable]: "agentic-org-v0-automation-planner",
        [WorkerProcessEnvName.NatsInboundBatchSize]: "25",
        [WorkerProcessEnvName.WorkerInboundBatchSize]: "15",
        [WorkerProcessEnvName.WorkerOutboxBatchSize]: "10",
        [WorkerProcessEnvName.WorkerReactionPlanBatchSize]: "8",
        [WorkerProcessEnvName.WorkerReactionPlanLeaseMs]: "300000",
      },
      WorkerRuntimeConfigErrorCode.MissingCockroachDatabaseUrl,
    );
    assertConfigError(
      {
        [WorkerProcessEnvName.AgenticOrgEnv]: "dev",
        [WorkerProcessEnvName.AgenticOrgId]: "org-lfg",
        [WorkerProcessEnvName.CockroachDatabaseUrl]: "postgresql://agentic-org@cockroachdb-public:26257/agentic_org",
        [WorkerProcessEnvName.NatsStream]: "agentic-org-events",
        [WorkerProcessEnvName.NatsDurable]: "agentic-org-v0-automation-planner",
        [WorkerProcessEnvName.NatsInboundBatchSize]: "25",
        [WorkerProcessEnvName.WorkerInboundBatchSize]: "15",
        [WorkerProcessEnvName.WorkerOutboxBatchSize]: "10",
      },
      WorkerRuntimeConfigErrorCode.MissingNatsServers,
    );
  });

  test("rejects invalid numeric env values with typed errors", () => {
    try {
      parseWorkerRuntimeConfigFromEnv({
        [WorkerProcessEnvName.AgenticOrgEnv]: "dev",
        [WorkerProcessEnvName.AgenticOrgId]: "org-lfg",
        [WorkerProcessEnvName.CockroachDatabaseUrl]: "postgresql://agentic-org@cockroachdb-public:26257/agentic_org",
        [WorkerProcessEnvName.NatsServers]: "nats://nats.nats.svc.cluster.local:4222",
        [WorkerProcessEnvName.NatsStream]: "agentic-org-events",
        [WorkerProcessEnvName.NatsDurable]: "agentic-org-v0-automation-planner",
        [WorkerProcessEnvName.NatsInboundBatchSize]: "not-a-number",
        [WorkerProcessEnvName.WorkerInboundBatchSize]: "15",
        [WorkerProcessEnvName.WorkerOutboxBatchSize]: "10",
        [WorkerProcessEnvName.WorkerReactionPlanBatchSize]: "8",
        [WorkerProcessEnvName.WorkerReactionPlanLeaseMs]: "300000",
      });
      throw new Error("expected config parsing to fail");
    } catch (error) {
      equal(error instanceof WorkerRuntimeConfigError, true);
      equal((error as WorkerRuntimeConfigError).code, WorkerRuntimeConfigErrorCode.InvalidNatsInboundBatchSize);
    }
  });

  test("rejects non-decimal or unsafe batch sizes with typed errors", () => {
    for (const batchSize of ["1.5", "1e3", "9007199254740992"]) {
      assertConfigError(
        {
          [WorkerProcessEnvName.AgenticOrgEnv]: "dev",
          [WorkerProcessEnvName.AgenticOrgId]: "org-lfg",
          [WorkerProcessEnvName.CockroachDatabaseUrl]: "postgresql://agentic-org@cockroachdb-public:26257/agentic_org",
          [WorkerProcessEnvName.NatsServers]: "nats://nats.nats.svc.cluster.local:4222",
          [WorkerProcessEnvName.NatsStream]: "agentic-org-events",
          [WorkerProcessEnvName.NatsDurable]: "agentic-org-v0-automation-planner",
          [WorkerProcessEnvName.NatsInboundBatchSize]: batchSize,
          [WorkerProcessEnvName.WorkerInboundBatchSize]: "15",
          [WorkerProcessEnvName.WorkerOutboxBatchSize]: "10",
          [WorkerProcessEnvName.WorkerReactionPlanBatchSize]: "8",
          [WorkerProcessEnvName.WorkerReactionPlanLeaseMs]: "300000",
        },
        WorkerRuntimeConfigErrorCode.InvalidNatsInboundBatchSize,
      );
      assertConfigError(
        {
          [WorkerProcessEnvName.AgenticOrgEnv]: "dev",
          [WorkerProcessEnvName.AgenticOrgId]: "org-lfg",
          [WorkerProcessEnvName.CockroachDatabaseUrl]: "postgresql://agentic-org@cockroachdb-public:26257/agentic_org",
          [WorkerProcessEnvName.NatsServers]: "nats://nats.nats.svc.cluster.local:4222",
          [WorkerProcessEnvName.NatsStream]: "agentic-org-events",
          [WorkerProcessEnvName.NatsDurable]: "agentic-org-v0-automation-planner",
          [WorkerProcessEnvName.NatsInboundBatchSize]: "25",
          [WorkerProcessEnvName.WorkerInboundBatchSize]: batchSize,
          [WorkerProcessEnvName.WorkerOutboxBatchSize]: "10",
          [WorkerProcessEnvName.WorkerReactionPlanBatchSize]: "8",
          [WorkerProcessEnvName.WorkerReactionPlanLeaseMs]: "300000",
        },
        WorkerRuntimeConfigErrorCode.InvalidWorkerInboundBatchSize,
      );
      assertConfigError(
        {
          [WorkerProcessEnvName.AgenticOrgEnv]: "dev",
          [WorkerProcessEnvName.AgenticOrgId]: "org-lfg",
          [WorkerProcessEnvName.CockroachDatabaseUrl]: "postgresql://agentic-org@cockroachdb-public:26257/agentic_org",
          [WorkerProcessEnvName.NatsServers]: "nats://nats.nats.svc.cluster.local:4222",
          [WorkerProcessEnvName.NatsStream]: "agentic-org-events",
          [WorkerProcessEnvName.NatsDurable]: "agentic-org-v0-automation-planner",
          [WorkerProcessEnvName.NatsInboundBatchSize]: "25",
          [WorkerProcessEnvName.WorkerInboundBatchSize]: "15",
          [WorkerProcessEnvName.WorkerOutboxBatchSize]: batchSize,
          [WorkerProcessEnvName.WorkerReactionPlanBatchSize]: "8",
          [WorkerProcessEnvName.WorkerReactionPlanLeaseMs]: "300000",
        },
        WorkerRuntimeConfigErrorCode.InvalidWorkerOutboxBatchSize,
      );
      assertConfigError(
        {
          [WorkerProcessEnvName.AgenticOrgEnv]: "dev",
          [WorkerProcessEnvName.AgenticOrgId]: "org-lfg",
          [WorkerProcessEnvName.CockroachDatabaseUrl]: "postgresql://agentic-org@cockroachdb-public:26257/agentic_org",
          [WorkerProcessEnvName.NatsServers]: "nats://nats.nats.svc.cluster.local:4222",
          [WorkerProcessEnvName.NatsStream]: "agentic-org-events",
          [WorkerProcessEnvName.NatsDurable]: "agentic-org-v0-automation-planner",
          [WorkerProcessEnvName.NatsInboundBatchSize]: "25",
          [WorkerProcessEnvName.WorkerInboundBatchSize]: "15",
          [WorkerProcessEnvName.WorkerOutboxBatchSize]: "10",
          [WorkerProcessEnvName.WorkerReactionPlanBatchSize]: batchSize,
          [WorkerProcessEnvName.WorkerReactionPlanLeaseMs]: "300000",
        },
        WorkerRuntimeConfigErrorCode.InvalidWorkerReactionPlanBatchSize,
      );
      assertConfigError(
        {
          [WorkerProcessEnvName.AgenticOrgEnv]: "dev",
          [WorkerProcessEnvName.AgenticOrgId]: "org-lfg",
          [WorkerProcessEnvName.CockroachDatabaseUrl]: "postgresql://agentic-org@cockroachdb-public:26257/agentic_org",
          [WorkerProcessEnvName.NatsServers]: "nats://nats.nats.svc.cluster.local:4222",
          [WorkerProcessEnvName.NatsStream]: "agentic-org-events",
          [WorkerProcessEnvName.NatsDurable]: "agentic-org-v0-automation-planner",
          [WorkerProcessEnvName.NatsInboundBatchSize]: "25",
          [WorkerProcessEnvName.WorkerInboundBatchSize]: "15",
          [WorkerProcessEnvName.WorkerOutboxBatchSize]: "10",
          [WorkerProcessEnvName.WorkerReactionPlanBatchSize]: "8",
          [WorkerProcessEnvName.WorkerReactionPlanLeaseMs]: batchSize,
        },
        WorkerRuntimeConfigErrorCode.InvalidWorkerReactionPlanLeaseMs,
      );
    }
  });

  test("rejects empty NATS server entries with a typed error", () => {
    assertConfigError(
      {
        [WorkerProcessEnvName.AgenticOrgEnv]: "dev",
        [WorkerProcessEnvName.AgenticOrgId]: "org-lfg",
        [WorkerProcessEnvName.CockroachDatabaseUrl]: "postgresql://agentic-org@cockroachdb-public:26257/agentic_org",
        [WorkerProcessEnvName.NatsServers]:
          "nats://nats.nats.svc.cluster.local:4222, , nats://nats-backup.nats.svc.cluster.local:4222",
        [WorkerProcessEnvName.NatsStream]: "agentic-org-events",
        [WorkerProcessEnvName.NatsDurable]: "agentic-org-v0-automation-planner",
        [WorkerProcessEnvName.NatsInboundBatchSize]: "25",
        [WorkerProcessEnvName.WorkerInboundBatchSize]: "15",
        [WorkerProcessEnvName.WorkerOutboxBatchSize]: "10",
        [WorkerProcessEnvName.WorkerReactionPlanBatchSize]: "8",
        [WorkerProcessEnvName.WorkerReactionPlanLeaseMs]: "300000",
      },
      WorkerRuntimeConfigErrorCode.InvalidNatsServers,
    );
  });

  test("throws on partial LLM config — only LLM_BASE_URL is set", () => {
    assertConfigError(
      { ...createMinimalValidEnv(), [WorkerProcessEnvName.LlmBaseUrl]: "http://ollama:11434" },
      WorkerRuntimeConfigErrorCode.PartialLlmConfig,
    );
  });

  test("throws on partial LLM config — only LLM_MODEL is set", () => {
    assertConfigError(
      { ...createMinimalValidEnv(), [WorkerProcessEnvName.LlmModel]: "qwen2:0.5b" },
      WorkerRuntimeConfigErrorCode.PartialLlmConfig,
    );
  });

  test("accepts both LLM env vars together", () => {
    const config = parseWorkerRuntimeConfigFromEnv({
      ...createMinimalValidEnv(),
      [WorkerProcessEnvName.LlmBaseUrl]: " http://ollama:11434 ",
      [WorkerProcessEnvName.LlmModel]: " qwen2:0.5b ",
    });
    equal(config.llmBaseUrl, "http://ollama:11434");
    equal(config.llmModel, "qwen2:0.5b");
  });

  test("accepts optional OTLP exporter endpoint", () => {
    const config = parseWorkerRuntimeConfigFromEnv({
      ...createMinimalValidEnv(),
      [WorkerProcessEnvName.OtelExporterOtlpEndpoint]: " http://otel-collector:4318/ ",
    });

    equal(config.otelExporterOtlpEndpoint, "http://otel-collector:4318/");
  });

  test("omits LLM config when neither env var is set (deterministic-composer mode)", () => {
    const config = parseWorkerRuntimeConfigFromEnv(createMinimalValidEnv());
    equal(config.llmBaseUrl, undefined);
    equal(config.llmModel, undefined);
  });
});

function createMinimalValidEnv(): WorkerProcessEnvironment {
  return {
    [WorkerProcessEnvName.AgenticOrgEnv]: "dev",
    [WorkerProcessEnvName.AgenticOrgId]: "org-lfg",
    [WorkerProcessEnvName.CockroachDatabaseUrl]: "postgresql://agentic-org@cockroachdb-public:26257/agentic_org",
    [WorkerProcessEnvName.NatsServers]: "nats://nats.nats.svc.cluster.local:4222",
    [WorkerProcessEnvName.NatsStream]: "agentic-org-events",
    [WorkerProcessEnvName.NatsDurable]: "agentic-org-v0-automation-planner",
    [WorkerProcessEnvName.NatsInboundBatchSize]: "25",
    [WorkerProcessEnvName.WorkerInboundBatchSize]: "15",
    [WorkerProcessEnvName.WorkerOutboxBatchSize]: "10",
    [WorkerProcessEnvName.WorkerReactionPlanBatchSize]: "8",
    [WorkerProcessEnvName.WorkerReactionPlanLeaseMs]: "300000",
  };
}

function assertConfigError(
  env: Parameters<typeof parseWorkerRuntimeConfigFromEnv>[0],
  code: WorkerRuntimeConfigErrorCode,
): void {
  try {
    parseWorkerRuntimeConfigFromEnv(env);
    throw new Error("expected config parsing to fail");
  } catch (error) {
    equal(error instanceof WorkerRuntimeConfigError, true);
    equal((error as WorkerRuntimeConfigError).code, code);
  }
}
