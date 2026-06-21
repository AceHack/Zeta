import { readFileSync } from "fs";
// 4-way TriBoolean cross-verification. Each `<lang>-output.json` is a Record<string, any>
// representing the evaluated properties of the test vectors.
const ts = (() => {
    try {
        return JSON.parse(readFileSync("ts-output.json", "utf8"));
    }
    catch {
        console.error("ts-output.json missing — run the TS cross-verify first.");
        process.exit(1);
    }
})();
const fsExists = (() => {
    try {
        return JSON.parse(readFileSync("fsharp-output.json", "utf8"));
    }
    catch {
        return null;
    }
})();
const csExists = (() => {
    try {
        return JSON.parse(readFileSync("cs-output.json", "utf8"));
    }
    catch {
        return null;
    }
})();
const rustExists = (() => {
    try {
        return JSON.parse(readFileSync("rust-output.json", "utf8"));
    }
    catch {
        return null;
    }
})();
const pyExists = (() => {
    try {
        return JSON.parse(readFileSync("python-output.json", "utf8"));
    }
    catch {
        return null;
    }
})();
const goExists = (() => {
    try {
        return JSON.parse(readFileSync("go-output.json", "utf8"));
    }
    catch {
        return null;
    }
})();
const parsedYaml = Bun.YAML.parse(await Bun.file("vectors.yaml").text());
const expectedByKey = new Map(parsedYaml.vectors.map((v) => [v.id, v]));
let mismatches = 0;
const keys = Object.keys(ts);
console.log(`Cross-verification across implementations (tri-boolean):`);
console.log(`  TS:   ${keys.length} vectors`);
console.log(`  F#:   ${fsExists ? Object.keys(fsExists).length : "MISSING"} vectors`);
console.log(`  C#:   ${csExists ? Object.keys(csExists).length : "MISSING"} vectors`);
console.log(`  Rust: ${rustExists ? Object.keys(rustExists).length : "MISSING"} vectors`);
console.log(`  Py:   ${pyExists ? Object.keys(pyExists).length : "MISSING"} vectors`);
console.log(`  Go:   ${goExists ? Object.keys(goExists).length : "MISSING"} vectors`);
// Key-set equality: every present impl must have exactly the TS key set.
const tsKeySet = new Set(keys);
for (const [name, impl] of [
    ["F#", fsExists],
    ["C#", csExists],
    ["Rust", rustExists],
    ["Python", pyExists],
    ["Go", goExists],
]) {
    if (!impl)
        continue;
    const implKeys = Object.keys(impl);
    for (const k of implKeys) {
        if (!tsKeySet.has(k)) {
            console.error(`Extra vector in ${name} not present in TS: ${k}`);
            mismatches++;
        }
    }
    if (implKeys.length !== keys.length) {
        console.error(`Vector count mismatch: TS=${keys.length} ${name}=${implKeys.length}`);
        mismatches++;
    }
}
// Compare implementation results against canonical vectors and against each other.
for (const key of keys) {
    const tsVal = ts[key];
    const canonical = expectedByKey.get(key);
    if (!canonical) {
        console.error(`No fixture vector for key: ${key}`);
        mismatches++;
        continue;
    }
    // Assert TS against canonical expected values
    const assertAgainstCanonical = (implName, val) => {
        if (!val)
            return;
        if (canonical.type === "unary") {
            const u = canonical;
            const checks = [
                ["type", "unary"],
                ["state", u.state],
                ["isLiving", u.is_living],
                ["isCertain", u.is_certain],
                ["notState", u.not_state],
                ["cooperateState", u.cooperate_state],
                ["measureOk", u.measure_ok],
                ["measureValue", u.measure_value],
                ["measureFeedback", u.measure_feedback],
                ["mapNot", u.map_not],
                ["bindNot", u.bind_not],
                ["bindToT", u.bind_to_t],
            ];
            for (const [prop, expected] of checks) {
                if (val[prop] !== expected) {
                    console.error(`${implName} mismatch on ${key}.${prop}: got=${val[prop]} expected=${expected}`);
                    mismatches++;
                }
            }
        }
        else if (canonical.type === "binary") {
            const b = canonical;
            const checks = [
                ["type", "binary"],
                ["left", b.left],
                ["right", b.right],
                ["expectedAnd", b.expected_and],
                ["expectedOr", b.expected_or],
            ];
            for (const [prop, expected] of checks) {
                if (val[prop] !== expected) {
                    console.error(`${implName} mismatch on ${key}.${prop}: got=${val[prop]} expected=${expected}`);
                    mismatches++;
                }
            }
        }
        else {
            const f = canonical;
            const checks = [
                ["type", "float"],
                ["high", f.high],
                ["decoder", f.decoder],
                ["low", f.low],
                ["expectedOk", f.expected_ok],
                ["expectedValue", f.expected_value],
                ["expectedFeedback", f.expected_feedback],
            ];
            if (f.encode_value !== undefined) {
                checks.push(["encodeValue", f.encode_value]);
                checks.push(["expectedEncodeOk", f.expected_encode_ok]);
                if (f.expected_encode_ok) {
                    checks.push(["expectedEncodeHigh", f.expected_encode_high]);
                    checks.push(["expectedEncodeDecoder", f.expected_encode_decoder]);
                    checks.push(["expectedEncodeLow", f.expected_encode_low]);
                }
                else {
                    checks.push(["expectedEncodeDetail", f.expected_encode_detail]);
                }
            }
            for (const [prop, expected] of checks) {
                if (val[prop] !== expected) {
                    console.error(`${implName} mismatch on ${key}.${prop}: got=${val[prop]} expected=${expected}`);
                    mismatches++;
                }
            }
        }
    };
    assertAgainstCanonical("TS", tsVal);
    if (fsExists) {
        const fsVal = fsExists[key];
        if (!Bun.deepEquals(tsVal, fsVal)) {
            console.error(`Mismatch ${key}: TS vs F#`);
            mismatches++;
        }
        assertAgainstCanonical("F#", fsVal);
    }
    if (csExists) {
        const csVal = csExists[key];
        if (!Bun.deepEquals(tsVal, csVal)) {
            console.error(`Mismatch ${key}: TS vs C#`);
            mismatches++;
        }
        assertAgainstCanonical("C#", csVal);
    }
    if (rustExists) {
        const rustVal = rustExists[key];
        if (!Bun.deepEquals(tsVal, rustVal)) {
            console.error(`Mismatch ${key}: TS vs Rust`);
            mismatches++;
        }
        assertAgainstCanonical("Rust", rustVal);
    }
    if (pyExists) {
        const pyVal = pyExists[key];
        if (!Bun.deepEquals(tsVal, pyVal)) {
            console.error(`Mismatch ${key}: TS vs Py`);
            mismatches++;
        }
        assertAgainstCanonical("Py", pyVal);
    }
    if (goExists) {
        const goVal = goExists[key];
        if (!Bun.deepEquals(tsVal, goVal)) {
            console.error(`Mismatch ${key}: TS vs Go`);
            mismatches++;
        }
        assertAgainstCanonical("Go", goVal);
    }
}
if (mismatches === 0) {
    console.log(`✅ All implementations agree on ${keys.length} vectors.`);
    process.exit(0);
}
else {
    console.log(`❌ ${mismatches} mismatches.`);
    process.exit(1);
}
