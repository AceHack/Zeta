import { readFileSync } from 'fs';

const ts = JSON.parse(readFileSync('ts-output.json', 'utf8'));
const fsExists = (() => { try { return JSON.parse(readFileSync('fsharp-output.json', 'utf8')); } catch { return null; } })();
const csExists = (() => { try { return JSON.parse(readFileSync('cs-output.json', 'utf8')); } catch { return null; } })();

let mismatches = 0;
const keys = Object.keys(ts);

console.log(`Cross-verification across implementations:`);
console.log(`  TS:  ${keys.length} vectors`);
console.log(`  F#:  ${fsExists ? Object.keys(fsExists).length : 'MISSING'} vectors`);
console.log(`  C#:  ${csExists ? Object.keys(csExists).length : 'MISSING'} vectors`);

for (const key of keys) {
  const tsHex = typeof ts[key] === 'string' ? ts[key] : ts[key].hex;
  if (fsExists) {
    const fsHex = typeof fsExists[key] === 'string' ? fsExists[key] : fsExists[key]?.hex;
    if (tsHex !== fsHex) {
      console.error(`Mismatch ${key}: TS=${tsHex} F#=${fsHex ?? 'MISSING'}`);
      mismatches++;
    }
  }
  if (csExists) {
    const csHex = typeof csExists[key] === 'string' ? csExists[key] : csExists[key]?.hex;
    if (tsHex !== csHex) {
      console.error(`Mismatch ${key}: TS=${tsHex} C#=${csHex ?? 'MISSING'}`);
      mismatches++;
    }
  }
}

if (mismatches === 0) {
  console.log(`✅ All implementations agree on ${keys.length} vectors.`);
  process.exit(0);
} else {
  console.log(`❌ ${mismatches} mismatches.`);
  process.exit(1);
}
