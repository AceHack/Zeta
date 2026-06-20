import * as os from "os";
import { readFileSync } from "fs";
import { execSync } from "child_process";

interface ProvisionalUli {
  languageCode: string;
  lexiconHash: string;
}

interface ProvisionalUii {
  agentId: string;
  capabilities: string[];
}

interface ProvisionalUti {
  temperature: number;
  decayRate: number;
}

interface ProvisionalUtri {
  rootHash: string;
}

interface ProvisionalExperienceState {
  uli: ProvisionalUli;
  uii: ProvisionalUii;
  uti: ProvisionalUti;
  utri: ProvisionalUtri;
  rootHash: string;
}

type OutputJson = Record<string, ProvisionalExperienceState>;

const ts = JSON.parse(readFileSync("ts-output.json", "utf8")) as OutputJson;
const fsExists = (() => {
  try {
    return JSON.parse(readFileSync("fsharp-output.json", "utf8")) as OutputJson;
  } catch {
    return null;
  }
})();
const csExists = (() => {
  try {
    return JSON.parse(readFileSync("cs-output.json", "utf8")) as OutputJson;
  } catch {
    return null;
  }
})();
const rustExists = (() => {
  try {
    return JSON.parse(readFileSync("rust-output.json", "utf8")) as OutputJson;
  } catch {
    return null;
  }
})();
const mumpsExists = (() => {
  try {
    return JSON.parse(readFileSync("mumps-output.json", "utf8")) as OutputJson;
  } catch {
    return null;
  }
})();

let mismatches = 0;
const keys = Object.keys(ts);

console.log(`Experience layer cross-verification across implementations:`);
console.log(`  TS:    ${keys.length.toString()} vectors`);
console.log(`  F#:    ${fsExists ? Object.keys(fsExists).length.toString() : "MISSING"} vectors`);
console.log(`  C#:    ${csExists ? Object.keys(csExists).length.toString() : "MISSING"} vectors`);
console.log(`  Rust:  ${rustExists ? Object.keys(rustExists).length.toString() : "MISSING"} vectors`);
console.log(`  MUMPS: ${mumpsExists ? Object.keys(mumpsExists).length.toString() : "MISSING"} vectors`);

const tsKeySet = new Set(keys);
for (const [name, impl] of [
  ["F#", fsExists],
  ["C#", csExists],
  ["Rust", rustExists],
  ["MUMPS", mumpsExists],
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
    console.error(`Vector count mismatch: TS=${keys.length.toString()} ${name}=${implKeys.length.toString()}`);
    mismatches++;
  }
}

for (const key of keys) {
  const tsVal = ts[key];
  if (!tsVal) continue;

  if (fsExists) {
    const fsVal = fsExists[key];
    if (tsVal.rootHash !== fsVal?.rootHash) {
      console.error(`Mismatch ${key} rootHash: TS=${tsVal.rootHash} F#=${fsVal?.rootHash ?? "MISSING"}`);
      mismatches++;
    }
  }
  if (csExists) {
    const csVal = csExists[key];
    if (tsVal.rootHash !== csVal?.rootHash) {
      console.error(`Mismatch ${key} rootHash: TS=${tsVal.rootHash} C#=${csVal?.rootHash ?? "MISSING"}`);
      mismatches++;
    }
  }
  if (rustExists) {
    const rustVal = rustExists[key];
    if (tsVal.rootHash !== rustVal?.rootHash) {
      console.error(`Mismatch ${key} rootHash: TS=${tsVal.rootHash} Rust=${rustVal?.rootHash ?? "MISSING"}`);
      mismatches++;
    }
  }
  if (mumpsExists) {
    const mumpsVal = mumpsExists[key];
    if (tsVal.rootHash !== mumpsVal?.rootHash) {
      console.error(`Mismatch ${key} rootHash: TS=${tsVal.rootHash} MUMPS=${mumpsVal?.rootHash ?? "MISSING"}`);
      mismatches++;
    }
  }
}

// --- Provisional Bit-field Layout assertions ---
console.log(`\nBit-field Oracle Verification:`);

function packProvisionalState(state: ProvisionalExperienceState): Buffer {
  const buf = Buffer.alloc(128);
  let offset = 0;

  // 1. Language code (5 bytes UTF-8, padded with 0)
  const lang = Buffer.alloc(5);
  lang.write(state.uli.languageCode);
  lang.copy(buf, offset);
  offset += 5;

  // 2. Lexicon hash (32 bytes binary)
  const lex = Buffer.from(state.uli.lexiconHash, "hex");
  lex.copy(buf, offset);
  offset += 32;

  // 3. Agent ID (16 bytes UTF-8, padded with 0)
  const agent = Buffer.alloc(16);
  agent.write(state.uii.agentId);
  agent.copy(buf, offset);
  offset += 16;

  // 4. Temperature (8 bytes double-precision float)
  buf.writeDoubleLE(state.uti.temperature, offset);
  offset += 8;

  // 5. Decay Rate (8 bytes double-precision float)
  buf.writeDoubleLE(state.uti.decayRate, offset);
  offset += 8;

  // 6. Traversal Root Hash (32 bytes binary)
  const root = Buffer.from(state.rootHash, "hex");
  root.copy(buf, offset);
  offset += 32;

  return buf.subarray(0, offset);
}

function unpackProvisionalState(buf: Buffer) {
  let offset = 0;

  const languageCode = buf
    .subarray(offset, offset + 5)
    .toString("utf8")
    .replace(/\0/g, "");
  offset += 5;

  const lexiconHash = buf.subarray(offset, offset + 32).toString("hex");
  offset += 32;

  const agentId = buf
    .subarray(offset, offset + 16)
    .toString("utf8")
    .replace(/\0/g, "");
  offset += 16;

  const temperature = buf.readDoubleLE(offset);
  offset += 8;

  const decayRate = buf.readDoubleLE(offset);
  offset += 8;

  const rootHash = buf.subarray(offset, offset + 32).toString("hex");

  return { languageCode, lexiconHash, agentId, temperature, decayRate, rootHash };
}

let bitOraclesOk = true;

for (const key of keys) {
  const tsVal = ts[key];
  if (!tsVal) continue;
  const packed = packProvisionalState(tsVal);
  const unpacked = unpackProvisionalState(packed);

  const matches =
    unpacked.languageCode === tsVal.uli.languageCode &&
    unpacked.lexiconHash === tsVal.uli.lexiconHash &&
    unpacked.agentId === tsVal.uii.agentId &&
    unpacked.temperature === tsVal.uti.temperature &&
    unpacked.decayRate === tsVal.uti.decayRate &&
    unpacked.rootHash === tsVal.rootHash;

  if (!matches) {
    console.error(`❌ Bit-field unpack mismatch for vector ${key}`);
    console.error("unpacked:", unpacked);
    console.error("expected:", {
      languageCode: tsVal.uli.languageCode,
      lexiconHash: tsVal.uli.lexiconHash,
      agentId: tsVal.uii.agentId,
      temperature: tsVal.uti.temperature,
      decayRate: tsVal.uti.decayRate,
      rootHash: tsVal.rootHash,
    });
    bitOraclesOk = false;
    mismatches++;
  }
}

if (bitOraclesOk) {
  console.log(`✅ All ${keys.length.toString()} vectors passed provisional bit-field layout assertions.`);
}

// --- Compiler Matrix Info ---
function getVersion(cmd: string): string {
  try {
    // eslint-disable-next-line sonarjs/os-command
    const line = execSync(cmd, { stdio: "pipe" }).toString().trim().split("\n")[0];
    return line ?? "Not Installed";
  } catch {
    return "Not Installed";
  }
}

console.log(`\nCompiler / Toolchain Matrix:`);
const systemOS = `${os.type()} ${os.release()} (${os.arch()})`;
const bunVer = getVersion("bun --version");
const nodeVer = getVersion("node --version");
const dotnetVer = getVersion("dotnet --version");
const rustcVer = getVersion("rustc --version");
const goVer = getVersion("go version");
const pythonVer = getVersion("python3 --version") || getVersion("python --version");

console.log(`| Tool / OS | Version |`);
console.log(`| --- | --- |`);
console.log(`| OS Platform | ${systemOS} |`);
console.log(`| Bun | ${bunVer} |`);
console.log(`| Node.js | ${nodeVer} |`);
console.log(`| .NET (F#/C#) | ${dotnetVer} |`);
console.log(`| Rust (rustc) | ${rustcVer} |`);
console.log(`| Go | ${goVer} |`);
console.log(`| Python | ${pythonVer} |`);

if (mismatches === 0) {
  console.log(`\n✅ All cross-verification, MUMPS, and bit-field assertions PASSED successfully.`);
  process.exit(0);
} else {
  console.log(`\n❌ Found ${mismatches.toString()} mismatches during verification.`);
  process.exit(1);
}
