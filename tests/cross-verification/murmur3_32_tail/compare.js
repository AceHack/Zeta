import { runNWayDiff } from "../_harness/nway-diff.js";
process.exit(await runNWayDiff({ dir: import.meta.dir }));
