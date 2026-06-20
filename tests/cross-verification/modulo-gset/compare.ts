import { runNWayDiff } from "../_harness/nway-diff";

process.exit(
  runNWayDiff({
    dir: import.meta.dir,
    minOracles: 2,
  }),
);
