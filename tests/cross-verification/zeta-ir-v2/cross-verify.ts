// zeta-ir-v2 interface-IR oracle.
//
// The interface JSON files are themselves the primitive contract for the
// cross-language codegen lane. This oracle keeps the folder from becoming an
// unchecked primitive: every committed interface row must be schema-shaped,
// named, member-bearing, and law-bearing before cross-verify-all may pass.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Variance = "contravariant" | "covariant" | "invariant";

interface TypeParam {
  readonly name: string;
  readonly variance: Variance;
}

interface Member {
  readonly name: string;
  readonly kind: "method" | "property";
  readonly type?: string;
  readonly params?: readonly { readonly name: string; readonly type: string }[];
  readonly returns?: string;
  readonly doc: string;
}

interface InterfaceIr {
  readonly schema: "zeta-ir-v2-interface";
  readonly name: string;
  readonly typeParams: readonly TypeParam[];
  readonly extends?: readonly string[];
  readonly doc: string;
  readonly members: readonly Member[];
  readonly laws: readonly string[];
}

const expectedNames = new Set(["ICodec", "IDbspOperators", "IGroup", "IKleeneAlgebra", "ILattice", "IMonoid", "IPort", "IRing", "ISemiring", "IStarRing", "IZSetIsa"]);
const allowedVariance = new Set<Variance>(["contravariant", "covariant", "invariant"]);
const dir = join(import.meta.dir, "interfaces");
const files = readdirSync(dir).filter((name) => name.endsWith(".ir.json")).sort();
const observed = new Map<string, InterfaceIr>();

let mismatches = 0;
const fail = (message: string): void => {
  mismatches++;
  console.error(message);
};

for (const file of files) {
  const ir = JSON.parse(readFileSync(join(dir, file), "utf8")) as InterfaceIr;

  if (ir.schema !== "zeta-ir-v2-interface") fail(`${file}: schema mismatch`);
  if (!expectedNames.has(ir.name)) fail(`${file}: unexpected interface ${ir.name}`);
  if (observed.has(ir.name)) fail(`${file}: duplicate interface ${ir.name}`);
  observed.set(ir.name, ir);

  if (!ir.doc || ir.doc.trim().length === 0) fail(`${file}: missing doc`);
  if (!ir.typeParams || ir.typeParams.length === 0) fail(`${file}: missing type params`);
  for (const typeParam of ir.typeParams) {
    if (!typeParam.name) fail(`${file}: unnamed type param`);
    if (!allowedVariance.has(typeParam.variance)) fail(`${file}: invalid variance ${String(typeParam.variance)}`);
  }

  if (!ir.members || ir.members.length === 0) fail(`${file}: missing members`);
  const memberNames = new Set<string>();
  for (const member of ir.members) {
    if (!member.name) fail(`${file}: unnamed member`);
    if (memberNames.has(member.name)) fail(`${file}: duplicate member ${member.name}`);
    memberNames.add(member.name);
    if (member.kind !== "method" && member.kind !== "property") fail(`${file}: invalid member kind ${String(member.kind)}`);
    if (!member.doc || member.doc.trim().length === 0) fail(`${file}: member ${member.name} missing doc`);
    if (member.kind === "method" && !member.returns) fail(`${file}: method ${member.name} missing returns`);
    if (member.kind === "property" && !member.type) fail(`${file}: property ${member.name} missing type`);
  }

  if (!ir.laws || ir.laws.length === 0) fail(`${file}: missing laws`);
}

for (const name of expectedNames) {
  if (!observed.has(name)) fail(`missing interface ${name}`);
}

// IStarRing must BE a semiring — directly, or transitively via IRing → ISemiring
// (the 081KWG9JQ9H split rebased IStarRing onto IRing, so its `extends` is
// ["IRing"] and IRing's is ["ISemiring"]; a direct-only check would wrongly reject
// that legitimate chain).
const extendsSemiring = (name: string, seen = new Set<string>()): boolean => {
  if (seen.has(name)) return false;
  seen.add(name);
  const ir = observed.get(name);
  const ext = ir?.extends ?? [];
  return ext.includes("ISemiring") || ext.some((parent) => extendsSemiring(parent, seen));
};
const starRing = observed.get("IStarRing");
if (starRing && !extendsSemiring("IStarRing")) {
  fail("IStarRing must extend ISemiring (directly or via IRing)");
}

const output = Object.fromEntries(
  [...observed.values()]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((ir) => [
      ir.name,
      {
        typeParams: ir.typeParams.map((param) => `${param.variance}:${param.name}`),
        members: ir.members.map((member) => `${member.kind}:${member.name}`),
        laws: ir.laws.length,
        extends: ir.extends ?? [],
      },
    ]),
);

writeFileSync(join(import.meta.dir, "ts-output.json"), `${JSON.stringify(output, null, 2)}\n`);
console.log(`zeta-ir-v2 interface oracle: files=${files.length}, mismatches=${mismatches}.`);
if (mismatches > 0) process.exit(1);
