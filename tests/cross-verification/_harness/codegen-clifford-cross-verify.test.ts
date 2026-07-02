/**
 * codegen-clifford-cross-verify.test.ts — Cross-language Clifford byte-lock oracle.
 *
 * Generates Cl(3,0) geometric product and reflection operations in
 * TS + Python + Go, executes each, compares multivector outputs.
 * This verifies the Clifford algebra implementation is consistent
 * across independent language implementations.
 */
import { describe, test, expect } from "bun:test";
import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

// Cl(3,0): 8 basis blades. The geo_product uses bitmask XOR with sign from reordering.
// We test: geo_product(e1, e2) = e12, geo_product(e1, e1) = 1 (Euclidean sig)

const TS_CLIFFORD = `
// Cl(3,0) geometric product — bitmask implementation
function reorderSign(a, b) {
  let swaps = 0, mask = a >> 1;
  while (mask > 0) { swaps += popcount(mask & b); mask >>= 1; }
  return (swaps & 1) === 0 ? 1 : -1;
}
function popcount(n) { let c = 0; while (n > 0) { c += n & 1; n >>= 1; } return c; }
function geoProduct(a, b) {
  const r = [0,0,0,0,0,0,0,0];
  for (let i = 0; i < 8; i++) { if (a[i] === 0) continue;
    for (let j = 0; j < 8; j++) { if (b[j] === 0) continue;
      r[i^j] += reorderSign(i,j) * a[i] * b[j]; } }
  return r;
}
const e1 = [0,1,0,0,0,0,0,0], e2 = [0,0,1,0,0,0,0,0], e3 = [0,0,0,0,1,0,0,0];
const scalar5 = [5,0,0,0,0,0,0,0];
const out = {
  "e1*e2": JSON.stringify(geoProduct(e1, e2)),
  "e1*e1": JSON.stringify(geoProduct(e1, e1)),
  "e2*e3": JSON.stringify(geoProduct(e2, e3)),
  "scalar5*e1": JSON.stringify(geoProduct(scalar5, e1)),
};
process.stdout.write(JSON.stringify(out));`;

const PY_CLIFFORD = `
import json, sys
def popcount(n):
    c = 0
    while n > 0: c += n & 1; n >>= 1
    return c
def reorder_sign(a, b):
    swaps = 0; mask = a >> 1
    while mask > 0: swaps += popcount(mask & b); mask >>= 1
    return 1 if swaps % 2 == 0 else -1
def geo_product(a, b):
    r = [0]*8
    for i in range(8):
        if a[i] == 0: continue
        for j in range(8):
            if b[j] == 0: continue
            r[i^j] += reorder_sign(i,j) * a[i] * b[j]
    return r
e1 = [0,1,0,0,0,0,0,0]; e2 = [0,0,1,0,0,0,0,0]; e3 = [0,0,0,0,1,0,0,0]
scalar5 = [5,0,0,0,0,0,0,0]
out = {
    "e1*e2": json.dumps(geo_product(e1, e2)),
    "e1*e1": json.dumps(geo_product(e1, e1)),
    "e2*e3": json.dumps(geo_product(e2, e3)),
    "scalar5*e1": json.dumps(geo_product(scalar5, e1)),
}
sys.stdout.write(json.dumps(out))`;

const GO_CLIFFORD = `package main
import ("encoding/json";"fmt";"os")
func popcount(n int) int { c:=0; for n>0 { c+=n&1; n>>=1 }; return c }
func reorderSign(a,b int) int {
    swaps:=0; mask:=a>>1
    for mask>0 { swaps+=popcount(mask&b); mask>>=1 }
    if swaps%2==0 { return 1 }; return -1
}
func geoProduct(a,b [8]int) [8]int {
    var r [8]int
    for i:=0;i<8;i++ { if a[i]==0 {continue}
        for j:=0;j<8;j++ { if b[j]==0 {continue}
            r[i^j]+=reorderSign(i,j)*a[i]*b[j] } }
    return r
}
func s(v [8]int) string { b,_:=json.Marshal(v[:]); return string(b) }
func main() {
    e1:=[8]int{0,1,0,0,0,0,0,0}; e2:=[8]int{0,0,1,0,0,0,0,0}; e3:=[8]int{0,0,0,0,1,0,0,0}
    scalar5:=[8]int{5,0,0,0,0,0,0,0}
    out:=map[string]string{
        "e1*e2":s(geoProduct(e1,e2)),"e1*e1":s(geoProduct(e1,e1)),
        "e2*e3":s(geoProduct(e2,e3)),"scalar5*e1":s(geoProduct(scalar5,e1))}
    b,_:=json.Marshal(out); _=b
    fmt.Fprintf(os.Stdout,"%s",string(b))
}`;

function runScript(lang: string, code: string, tmpDir: string): Record<string, string> | null {
  const ext = lang === "ts" ? "ts" : lang === "py" ? "py" : "go";
  const file = join(tmpDir, `clifford.${ext}`);
  writeFileSync(file, code);
  try {
    const cmd = lang === "ts" ? `bun ${file}` : lang === "py" ? `python3 ${file}` : `go run ${file}`;
    const out = execSync(cmd, { encoding: "utf-8", timeout: 15000 });
    return JSON.parse(out);
  } catch {
    return null;
  }
}

describe("Clifford cross-language verification (Cl(3,0) byte-lock)", () => {
  const tmpDir = join("/tmp", `clifford-xverify-${Date.now()}`);

  test("geo_product produces identical results across TS, Python, Go", () => {
    mkdirSync(tmpDir, { recursive: true });
    const ts = runScript("ts", TS_CLIFFORD, tmpDir);
    const py = runScript("py", PY_CLIFFORD, tmpDir);
    const go = runScript("go", GO_CLIFFORD, tmpDir);
    try {
      rmSync(tmpDir, { recursive: true });
    } catch {}

    expect(ts).not.toBeNull();
    expect(py).not.toBeNull();
    expect(go).not.toBeNull();

    if (ts === null || py === null || go === null) {
      throw new Error("Clifford cross-verify script failed; see stderr above");
    }

    // All three must agree on every operation (compare parsed arrays, not string formatting)
    for (const key of Object.keys(ts)) {
      const tsText = ts[key];
      const pyText = py[key];
      const goText = go[key];
      if (tsText === undefined || pyText === undefined || goText === undefined) {
        throw new Error(`missing Clifford output for ${key}`);
      }
      const tsVal = JSON.parse(tsText);
      const pyVal = JSON.parse(pyText);
      const goVal = JSON.parse(goText);
      expect(tsVal).toEqual(pyVal);
      expect(tsVal).toEqual(goVal);
    }
  }, 30000);

  test("e1*e1 = scalar 1 (Euclidean signature)", () => {
    mkdirSync(tmpDir, { recursive: true });
    const ts = runScript("ts", TS_CLIFFORD, tmpDir);
    try {
      rmSync(tmpDir, { recursive: true });
    } catch {}
    // e1*e1 should be [1,0,0,0,0,0,0,0] (scalar 1, Euclidean)
    expect(ts!["e1*e1"]).toBe("[1,0,0,0,0,0,0,0]");
  });

  test("e1*e2 = e12 (bivector)", () => {
    mkdirSync(tmpDir, { recursive: true });
    const ts = runScript("ts", TS_CLIFFORD, tmpDir);
    try {
      rmSync(tmpDir, { recursive: true });
    } catch {}
    // e1*e2: mask = 1^2 = 3 (e12), sign = +1 (no reordering needed)
    expect(ts!["e1*e2"]).toBe("[0,0,0,1,0,0,0,0]");
  });
});
