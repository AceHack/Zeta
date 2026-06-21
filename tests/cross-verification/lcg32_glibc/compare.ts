import { runNWayDiff } from '../_harness/nway-diff.js';

const dir = new URL('.', import.meta.url).pathname;
const code = runNWayDiff({ dir });
process.exit(code);
