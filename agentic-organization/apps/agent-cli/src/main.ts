import {
  createAgentCliHierarchyFromEnv,
  createAgentCliMetricAgentsFromEnv,
  createAgentCliPromptFlowTasksFromEnv,
  createAgentCliSelectorFromEnv,
  runAgentCliCycle,
} from "./agent-cli.ts";

const result = await runAgentCliCycle({
  argv: process.argv.slice(2),
  now: () => new Date().toISOString(),
  writeStdout: (text) => {
    process.stdout.write(text);
  },
  writeStderr: (text) => {
    process.stderr.write(text);
  },
  metricAgents: createAgentCliMetricAgentsFromEnv({
    env: process.env,
    now: () => new Date().toISOString(),
  }),
  promptFlowTasks: createAgentCliPromptFlowTasksFromEnv({
    env: process.env,
  }),
  hierarchy: createAgentCliHierarchyFromEnv({
    env: process.env,
  }),
  selectSlot: createAgentCliSelectorFromEnv({
    env: process.env,
  }),
  runCommand: async (commandType, command) => ({
    status: "not_wired",
    commandType,
    command,
  }),
  dispatchTool: async (tool, args) => ({
    status: "not_wired",
    tool,
    args,
  }),
});

if (result.exitCode !== 0) {
  process.exit(result.exitCode);
}
