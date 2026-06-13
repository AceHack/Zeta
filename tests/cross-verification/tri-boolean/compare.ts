import { readFileSync } from "fs";

// 4-way TriBoolean cross-verification. Each `<lang>-output.json` is a Record<string, any>
// representing the evaluated properties of the test vectors.

const ts = (() => {
  try {
    return JSON.parse(readFileSync("ts-output.json", "utf8")) as Record<string, any>;
  } catch {
    console.error("ts-output.json missing — run the TS cross-verify first.");
    process.exit(1);
  }
})();

const fsExists = (() => {
  try {
    return JSON.parse(readFileSync("fsharp-output.json", "utf8")) as Record<string, any>;
  } catch {
    return null;
  }
})();

const csExists = (() => {
  try {
    return JSON.parse(readFileSync("cs-output.json", "utf8")) as Record<string, any>;
  } catch {
    return null;
  }
})();

const rustExists = (() => {
  try {
    return JSON.parse(readFileSync("rust-output.json", "utf8")) as Record<string, any>;
  } catch {
    return null;
  }
})();

// Read vectors.yaml to assert each impl against the canonical expected values.
interface UnaryVec {
  id: string;
  type: "unary";
  state: string;
  is_living: boolean;
  is_certain: boolean;
  not_state: string;
  cooperate_state: string;
  measure_ok: boolean;
  measure_value: boolean;
  measure_feedback: string;
  map_not: string;
  bind_not: string;
  bind_to_t: string;
}

interface BinaryVec {
  id: string;
  type: "binary";
  left: string;
  right: string;
  expected_and: string;
  expected_or: string;
}

interface FloatVec {
  id: string;
  type: "float";
  high: string;
  decoder: string;
  low: string;
  expected_ok: boolean;
  expected_value: number;
  expected_feedback: string;
  encode_value?: number;
  expected_encode_ok?: boolean;
  expected_encode_high?: string;
  expected_encode_decoder?: string;
  expected_encode_low?: string;
  expected_encode_detail?: string;
}

type Vec = UnaryVec | BinaryVec | FloatVec;

const parsedYaml = Bun.YAML.parse(await Bun.file("vectors.yaml").text()) as { vectors: Vec[] };
const expectedByKey = new Map<string, Vec>(parsedYaml.vectors.map((v) => [v.id, v]));

let mismatches = 0;
const keys = Object.keys(ts);

console.log(`Cross-verification across implementations (tri-boolean):`);
console.log(`  TS:   ${keys.length} vectors`);
console.log(`  F#:   ${fsExists ? Object.keys(fsExists).length : "MISSING"} vectors`);
console.log(`  C#:   ${csExists ? Object.keys(csExists).length : "MISSING"} vectors`);
console.log(`  Rust: ${rustExists ? Object.keys(rustExists).length : "MISSING"} vectors`);

// Key-set equality: every present impl must have exactly the TS key set.
const tsKeySet = new Set(keys);
for (const [name, impl] of [
  ["F#", fsExists],
  ["C#", csExists],
  ["Rust", rustExists],
] as const) {
  if (!impl) continue;
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
  const assertAgainstCanonical = (implName: string, val: any) => {
    if (!val) return;
    if (canonical.type === "unary") {
      const u = canonical as UnaryVec;
      const checks: [string, string | boolean][] = [
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
        if (val[prop as string] !== expected) {
          console.error(
            `${implName} mismatch on ${key}.${prop}: got=${val[prop as string]} expected=${expected}`
          );
          mismatches++;
        }
      }
    } else if (canonical.type === "binary") {
      const b = canonical as BinaryVec;
      const checks: [string, string][] = [
        ["type", "binary"],
        ["left", b.left],
        ["right", b.right],
        ["expectedAnd", b.expected_and],
        ["expectedOr", b.expected_or],
      ];
      for (const [prop, expected] of checks) {
        if (val[prop] !== expected) {
          console.error(
            `${implName} mismatch on ${key}.${prop}: got=${val[prop]} expected=${expected}`
          );
          mismatches++;
        }
      }
    } else {
      const f = canonical as FloatVec;
      const checks: [string, any][] = [
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
        } else {
          checks.push(["expectedEncodeDetail", f.expected_encode_detail]);
        }
      }
      for (const [prop, expected] of checks) {
        if (val[prop] !== expected) {
          console.error(
            `${implName} mismatch on ${key}.${prop}: got=${val[prop]} expected=${expected}`
          );
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
}

if (mismatches === 0) {
  console.log(`✅ All implementations agree on ${keys.length} vectors.`);
  process.exit(0);
} else {
  console.log(`❌ ${mismatches} mismatches.`);
  process.exit(1);
}
