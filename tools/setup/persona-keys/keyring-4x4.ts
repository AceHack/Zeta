// Keyring 4x4 treaty — the SERIALIZER axis. The deterministic public keyring is
// encoded as a language-neutral `Tagged` value and locked across the repo's canonical
// serializers (canonical-JSON + canonical-CBOR), REUSING src/Core.TypeScript/dynamic-value
// (not reinventing). CBOR bytes are stored hex-in-JSON (text, per no-binary-in-proof-lineage).
// This is the "4 serializers" half of the keyring 4x4; the "4 oracles" half (F#/C#/Rust)
// replays the SAME byte-locked golden vector this TS oracle seeds. The seed is the treaty.
import { deriveKeyring } from "./derive.ts";
import { canonicalJson, fromCanonicalJson, type Tagged, type EncodeResult } from "../../../src/Core.TypeScript/dynamic-value/json.ts";
import { canonicalCbor, fromCanonicalCbor, toHex, fromHex } from "../../../src/Core.TypeScript/dynamic-value/cbor.ts";
import { canonicalXml, fromCanonicalXml } from "../../../src/Core.TypeScript/dynamic-value/xml.ts";

type Pub = ReturnType<typeof deriveKeyring>["pub"];

function ok<T>(res: EncodeResult<T>): T {
  if (!res.ok) throw new Error(`Encoding failed: ${res.error}`);
  return res.value;
}

/** Public keyring -> language-neutral Tagged (all fields are strings; insertion order
 *  is canonical and stable because derive.ts builds `pub` with a fixed literal order). */
export function keyringToTagged(v: unknown): Tagged {
  if (typeof v === "string") return { t: "str", v };
  if (Array.isArray(v)) return { t: "arr", v: v.map(keyringToTagged) };
  if (v && typeof v === "object") return { t: "obj", v: Object.entries(v).map(([k, c]) => [k, keyringToTagged(c)] as [string, Tagged]) };
  throw new Error(`keyring Tagged: unexpected non-string leaf: ${typeof v}`);
}

/** Serialize a public keyring across the locked serializers (3 of 4: JSON + CBOR + XML;
 *  Arrow is the F#/C# shredded-node-table — no TS encoder yet). CBOR as hex (text-in-JSON). */
export function serializeKeyring(pub: Pub) {
  const tagged = keyringToTagged(pub);
  return { json: ok(canonicalJson(tagged)), cborHex: toHex(ok(canonicalCbor(tagged))), xml: ok(canonicalXml(tagged)) };
}

/** Decode each serialized form back to a Tagged (for the commute / round-trip proof). */
export function deserializeKeyring(json: string, cborHex: string, xml: string) {
  return { fromJson: fromCanonicalJson(json), fromCbor: fromCanonicalCbor(fromHex(cborHex)), fromXml: fromCanonicalXml(xml) };
}

/** Derive + serialize in one step (the treaty's emit path). */
export function keyring4x4(mnemonic: string, user = "zeta") {
  return serializeKeyring(deriveKeyring(mnemonic, user).pub);
}
