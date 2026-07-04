// DynamicValue canonical MessagePack codec — the TS oracle.
// MessagePack is a compact binary format that is total over all 8 DynamicValue shapes.
// Map keys are kept in insertion order (order-significant) just like CBOR and JSON.
//
// Tagged is the language-neutral tagged form: float v = IEEE-754 f64 bit pattern in hex;
// int v = decimal string; bytes v = hex string.

export type Tagged =
  | { t: "null" }
  | { t: "bool"; v: boolean }
  | { t: "int"; v: string }
  | { t: "float"; v: string }
  | { t: "str"; v: string }
  | { t: "bytes"; v: string }
  | { t: "arr"; v: Tagged[] }
  | { t: "obj"; v: [string, Tagged][] };

export type DecodeError =
  | "UnexpectedEnd"
  | "TrailingData"
  | "Unsupported"
  | "IntegerOverflow"
  | "NonTextKey"
  | "NonCanonical";

export type DecodeResult = { ok: true; value: Tagged } | { ok: false; error: DecodeError };

// --- Float/BigInt helpers ---

function f64Bits(v: number): bigint {
  const dv = new DataView(new ArrayBuffer(8));
  dv.setFloat64(0, v, false);
  return dv.getBigUint64(0, false);
}

export function f64ToBitsHex(v: number): string {
  return f64Bits(v).toString(16).padStart(16, "0");
}

function fromHex(hex: string): Uint8Array {
  const len = hex.length / 2;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i]!.toString(16).padStart(2, "0");
  }
  return out;
}

// --- MessagePack Encode ---

function pushBE(out: number[], arg: bigint, bytes: number): void {
  for (let i = bytes - 1; i >= 0; i--) {
    out.push(Number((arg >> BigInt(i * 8)) & 0xffn));
  }
}

function encodeInt(out: number[], v: bigint): void {
  if (v >= 0n) {
    if (v <= 127n) {
      out.push(Number(v));
    } else if (v <= 255n) {
      out.push(0xcc);
      pushBE(out, v, 1);
    } else if (v <= 65535n) {
      out.push(0xcd);
      pushBE(out, v, 2);
    } else if (v <= 4294967295n) {
      out.push(0xce);
      pushBE(out, v, 4);
    } else {
      out.push(0xcf);
      pushBE(out, v, 8);
    }
  } else {
    if (v >= -32n) {
      // negative fixint (0xe0 - 0xff) -> -32 to -1
      out.push(Number(0xe0n | (v & 0x1fn)));
    } else if (v >= -128n) {
      out.push(0xd0);
      pushBE(out, v & 0xffn, 1);
    } else if (v >= -32768n) {
      out.push(0xd1);
      pushBE(out, v & 0xffffn, 2);
    } else if (v >= -2147483648n) {
      out.push(0xd2);
      pushBE(out, v & 0xffffffffn, 4);
    } else {
      out.push(0xd3);
      pushBE(out, v, 8);
    }
  }
}

function encodeFloat(out: number[], v: string): void {
  out.push(0xcb);
  const bits = BigInt("0x" + v);
  pushBE(out, bits, 8);
}

function encodeStr(out: number[], s: string): void {
  const bytes = new TextEncoder().encode(s);
  const len = bytes.length;
  if (len <= 31) {
    out.push(0xa0 | len);
  } else if (len <= 255) {
    out.push(0xd9, len);
  } else if (len <= 65535) {
    out.push(0xda);
    pushBE(out, BigInt(len), 2);
  } else {
    out.push(0xdb);
    pushBE(out, BigInt(len), 4);
  }
  for (let i = 0; i < len; i++) out.push(bytes[i]!);
}

function encodeBytes(out: number[], hex: string): void {
  const bytes = fromHex(hex);
  const len = bytes.length;
  if (len <= 255) {
    out.push(0xc4, len);
  } else if (len <= 65535) {
    out.push(0xc5);
    pushBE(out, BigInt(len), 2);
  } else {
    out.push(0xc6);
    pushBE(out, BigInt(len), 4);
  }
  for (let i = 0; i < len; i++) out.push(bytes[i]!);
}

function encodeArray(out: number[], arr: Tagged[]): void {
  const len = arr.length;
  if (len <= 15) {
    out.push(0x90 | len);
  } else if (len <= 65535) {
    out.push(0xdc);
    pushBE(out, BigInt(len), 2);
  } else {
    out.push(0xdd);
    pushBE(out, BigInt(len), 4);
  }
  for (const item of arr) encodeValue(out, item);
}

function encodeMap(out: number[], obj: [string, Tagged][]): void {
  const len = obj.length;
  if (len <= 15) {
    out.push(0x80 | len);
  } else if (len <= 65535) {
    out.push(0xde);
    pushBE(out, BigInt(len), 2);
  } else {
    out.push(0xdf);
    pushBE(out, BigInt(len), 4);
  }
  for (const [k, v] of obj) {
    encodeStr(out, k);
    encodeValue(out, v);
  }
}

function encodeValue(out: number[], n: Tagged): void {
  switch (n.t) {
    case "null":
      out.push(0xc0);
      break;
    case "bool":
      out.push(n.v ? 0xc3 : 0xc2);
      break;
    case "int":
      encodeInt(out, BigInt(n.v));
      break;
    case "float":
      encodeFloat(out, n.v);
      break;
    case "str":
      encodeStr(out, n.v);
      break;
    case "bytes":
      encodeBytes(out, n.v);
      break;
    case "arr":
      encodeArray(out, n.v);
      break;
    case "obj":
      encodeMap(out, n.v);
      break;
  }
}

export function toCanonicalMsgpack(value: Tagged): Uint8Array {
  const out: number[] = [];
  encodeValue(out, value);
  return new Uint8Array(out);
}

// --- MessagePack Decode ---

export function fromCanonicalMsgpack(input: Uint8Array | number[]): DecodeResult {
  const bytes = input instanceof Uint8Array ? input : Uint8Array.from(input);
  let pos = 0;

  function fail(e: DecodeError): never {
    throw new Error(e);
  }

  function readBE(n: number): bigint {
    if (pos + n > bytes.length) fail("UnexpectedEnd");
    let v = 0n;
    for (let i = 0; i < n; i++) {
      v = (v << 8n) | BigInt(bytes[pos + i]!);
    }
    pos += n;
    return v;
  }

  function readValue(): Tagged {
    if (pos >= bytes.length) fail("UnexpectedEnd");
    const initial = bytes[pos++];
    if (initial === undefined) fail("UnexpectedEnd");

    // positive fixint: 0x00 - 0x7f
    if (initial <= 0x7f) {
      return { t: "int", v: initial.toString() };
    }

    // fixmap: 0x80 - 0x8f
    if (initial >= 0x80 && initial <= 0x8f) {
      return readMap(initial & 0x0f);
    }

    // fixarray: 0x90 - 0x9f
    if (initial >= 0x90 && initial <= 0x9f) {
      return readArray(initial & 0x0f);
    }

    // fixstr: 0xa0 - 0xbf
    if (initial >= 0xa0 && initial <= 0xbf) {
      return readStr(initial & 0x1f);
    }

    // negative fixint: 0xe0 - 0xff (value -32 to -1)
    if (initial >= 0xe0) {
      const val = initial - 256;
      return { t: "int", v: val.toString() };
    }

    switch (initial) {
      case 0xc0: // nil
        return { t: "null" };
      case 0xc2: // false
        return { t: "bool", v: false };
      case 0xc3: // true
        return { t: "bool", v: true };

      // bin formats
      case 0xc4:
        return readBytes(Number(readBE(1)));
      case 0xc5:
        return readBytes(Number(readBE(2)));
      case 0xc6:
        return readBytes(Number(readBE(4)));

      // float formats
      case 0xca: { // float 32
        const bits = readBE(4);
        const dv = new DataView(new ArrayBuffer(4));
        dv.setUint32(0, Number(bits), false);
        const f = dv.getFloat32(0, false);
        return { t: "float", v: f64ToBitsHex(f) };
      }
      case 0xcb: { // float 64
        const bits = readBE(8);
        return { t: "float", v: bits.toString(16).padStart(16, "0") };
      }

      // uint formats
      case 0xcc:
        return { t: "int", v: readBE(1).toString() };
      case 0xcd:
        return { t: "int", v: readBE(2).toString() };
      case 0xce:
        return { t: "int", v: readBE(4).toString() };
      case 0xcf:
        return { t: "int", v: readBE(8).toString() };

      // int formats
      case 0xd0: {
        let val = readBE(1);
        if (val >= 128n) val -= 256n;
        return { t: "int", v: val.toString() };
      }
      case 0xd1: {
        let val = readBE(2);
        if (val >= 32768n) val -= 65536n;
        return { t: "int", v: val.toString() };
      }
      case 0xd2: {
        let val = readBE(4);
        if (val >= 2147483648n) val -= 4294967296n;
        return { t: "int", v: val.toString() };
      }
      case 0xd3: {
        const val = BigInt.asIntN(64, readBE(8));
        return { t: "int", v: val.toString() };
      }

      // str formats
      case 0xd9:
        return readStr(Number(readBE(1)));
      case 0xda:
        return readStr(Number(readBE(2)));
      case 0xdb:
        return readStr(Number(readBE(4)));

      // array formats
      case 0xdc:
        return readArray(Number(readBE(2)));
      case 0xdd:
        return readArray(Number(readBE(4)));

      // map formats
      case 0xde:
        return readMap(Number(readBE(2)));
      case 0xdf:
        return readMap(Number(readBE(4)));

      default:
        fail("Unsupported");
    }
  }

  function readStr(len: number): Tagged {
    if (pos + len > bytes.length) fail("UnexpectedEnd");
    const slice = bytes.subarray(pos, pos + len);
    pos += len;
    return { t: "str", v: new TextDecoder().decode(slice) };
  }

  function readBytes(len: number): Tagged {
    if (pos + len > bytes.length) fail("UnexpectedEnd");
    const slice = bytes.subarray(pos, pos + len);
    pos += len;
    return { t: "bytes", v: toHex(slice) };
  }

  function readArray(len: number): Tagged {
    const arr: Tagged[] = [];
    for (let i = 0; i < len; i++) {
      arr.push(readValue());
    }
    return { t: "arr", v: arr };
  }

  function readMap(len: number): Tagged {
    const obj: [string, Tagged][] = [];
    for (let i = 0; i < len; i++) {
      const keyVal = readValue();
      if (keyVal.t !== "str") fail("NonTextKey");
      const val = readValue();
      obj.push([keyVal.v, val]);
    }
    return { t: "obj", v: obj };
  }

  try {
    const value = readValue();
    if (pos !== bytes.length) fail("TrailingData");

    // canonical fixed-point validation
    const reEncoded = toCanonicalMsgpack(value);
    let match = reEncoded.length === bytes.length;
    if (match) {
      for (let i = 0; i < bytes.length; i++) {
        if (reEncoded[i] !== bytes[i]) {
          match = false;
          break;
        }
      }
    }
    if (!match) fail("NonCanonical");

    return { ok: true, value };
  } catch (e: any) {
    return { ok: false, error: e.message as DecodeError };
  }
}
