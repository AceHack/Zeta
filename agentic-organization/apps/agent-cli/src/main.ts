#!/usr/bin/env -S node --experimental-strip-types

import { runAgentCliMain } from "./agent-cli-main.ts";

const exitCode = await runAgentCliMain({
  argv: process.argv.slice(2),
  now: () => new Date().toISOString(),
  env: process.env,
  writeStdout: (text) => {
    process.stdout.write(text);
  },
  writeStderr: (text) => {
    process.stderr.write(text);
  },
});

if (exitCode !== 0) {
  process.exit(exitCode);
}
