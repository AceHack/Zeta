import { readFileSync } from "fs";
const ts = JSON.parse(readFileSync("ts-output.json", "utf8"));
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
const vectorFile = Bun.YAML.parse(await Bun.file("vectors.yaml").text())
    .vectors;
const expectedByKey = new Map(vectorFile.map((v) => [v.id, v.expected_hex]));
let mismatches = 0;
const keys = Object.keys(ts);
console.log(`Cross-verification across implementations:`);
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
// Per-key hex equality across all present impls + assert against canonical expected_hex.
for (const key of keys) {
    const tsHex = typeof ts[key] === "string" ? ts[key] : ts[key]?.hex;
    // Assert TS against canonical expected_hex from vectors.yaml.
    const canonical = expectedByKey.get(key);
    if (canonical !== undefined && tsHex !== canonical) {
        console.error(`TS hex vs canonical MISMATCH ${key}: TS=${tsHex ?? "MISSING"} expected=${canonical}`);
        mismatches++;
    }
    if (fsExists) {
        const fsHex = typeof fsExists[key] === "string" ? fsExists[key] : fsExists[key]?.hex;
        if (tsHex !== fsHex) {
            console.error(`Mismatch ${key}: TS=${tsHex ?? "MISSING"} F#=${fsHex ?? "MISSING"}`);
            mismatches++;
        }
        // Assert F# against canonical too.
        if (canonical !== undefined && fsHex !== canonical) {
            console.error(`F# hex vs canonical MISMATCH ${key}: F#=${fsHex ?? "MISSING"} expected=${canonical}`);
            mismatches++;
        }
    }
    if (csExists) {
        const csHex = typeof csExists[key] === "string" ? csExists[key] : csExists[key]?.hex;
        if (tsHex !== csHex) {
            console.error(`Mismatch ${key}: TS=${tsHex ?? "MISSING"} C#=${csHex ?? "MISSING"}`);
            mismatches++;
        }
        if (canonical !== undefined && csHex !== canonical) {
            console.error(`C# hex vs canonical MISMATCH ${key}: C#=${csHex ?? "MISSING"} expected=${canonical}`);
            mismatches++;
        }
    }
    if (rustExists) {
        const rustHex = typeof rustExists[key] === "string" ? rustExists[key] : rustExists[key]?.hex;
        if (tsHex !== rustHex) {
            console.error(`Mismatch ${key}: TS=${tsHex ?? "MISSING"} Rust=${rustHex ?? "MISSING"}`);
            mismatches++;
        }
        if (canonical !== undefined && rustHex !== canonical) {
            console.error(`Rust hex vs canonical MISMATCH ${key}: Rust=${rustHex ?? "MISSING"} expected=${canonical}`);
            mismatches++;
        }
    }
    if (pyExists) {
        const pyHex = typeof pyExists[key] === "string" ? pyExists[key] : pyExists[key]?.hex;
        if (tsHex !== pyHex) {
            console.error(`Mismatch ${key}: TS=${tsHex ?? "MISSING"} Py=${pyHex ?? "MISSING"}`);
            mismatches++;
        }
        if (canonical !== undefined && pyHex !== canonical) {
            console.error(`Py hex vs canonical MISMATCH ${key}: Py=${pyHex ?? "MISSING"} expected=${canonical}`);
            mismatches++;
        }
    }
    if (goExists) {
        const goHex = typeof goExists[key] === "string" ? goExists[key] : goExists[key]?.hex;
        if (tsHex !== goHex) {
            console.error(`Mismatch ${key}: TS=${tsHex ?? "MISSING"} Go=${goHex ?? "MISSING"}`);
            mismatches++;
        }
        if (canonical !== undefined && goHex !== canonical) {
            console.error(`Go hex vs canonical MISMATCH ${key}: Go=${goHex ?? "MISSING"} expected=${canonical}`);
            mismatches++;
        }
    }
}
if (mismatches === 0) {
    console.log(`All implementations agree on ${keys.length} vectors.`);
    process.exit(0);
}
else {
    console.log(`${mismatches} mismatches.`);
    process.exit(1);
}
