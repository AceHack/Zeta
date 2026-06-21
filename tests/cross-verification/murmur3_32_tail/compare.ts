import { runNWayDiff } from "../_harness/nway-diff.ts";
process.exit(await runNWayDiff({ dir: import.meta.dir }));
