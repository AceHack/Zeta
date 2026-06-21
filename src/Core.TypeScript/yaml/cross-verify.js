// TS cross-verify oracle for the YAML reader.
//
// Run from `tests/cross-verification/yaml/` (CWD): reads the shared `vectors.json`
// fixture, runs L1 `readEvents` over each `yaml` string, asserts the event stream equals
// the fixture's `expected`, and writes `{ [id]: events }` to `ts-output.json` for the
// 4-way `compare.ts`. Non-zero exit on any mismatch (no silent-non-enforcing harness).
import { readEvents } from "../yaml/reader";
const fixture = (await Bun.file("vectors.json").json());
const results = {};
let mismatches = 0;
for (const vector of fixture.vectors) {
    const events = readEvents(vector.yaml);
    results[vector.id] = events;
    if (!Bun.deepEquals(events, vector.expected)) {
        mismatches++;
        console.error(`Event MISMATCH for ${vector.id}`);
        console.error(`  got:      ${JSON.stringify(events)}`);
        console.error(`  expected: ${JSON.stringify(vector.expected)}`);
    }
}
await Bun.write("ts-output.json", JSON.stringify(results, null, 2) + "\n");
console.log(`Cross-verify (TS): ${fixture.vectors.length} vectors. Matched expected ${fixture.vectors.length - mismatches}/${fixture.vectors.length}.`);
if (mismatches > 0) {
    console.error(`FAIL: ${mismatches} vector(s) did not match expected.`);
    process.exit(1);
}
