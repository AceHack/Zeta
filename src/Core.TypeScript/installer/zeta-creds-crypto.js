import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync } from "node:crypto";
function hkdfHmacSync(hashAlgo, ikm, salt, info, keyLen) {
  const prk = createHmac(hashAlgo, salt.length ? salt : new Uint8Array(32)).update(ikm).digest(), okm = Buffer.alloc(keyLen);
  let t = Buffer.alloc(0), offset = 0, counter = 1;
  while (offset < keyLen) {
    const hmac = createHmac(hashAlgo, prk);
    hmac.update(t);
    hmac.update(info);
    hmac.update(Buffer.from([counter]));
    t = hmac.digest();
    const chunkLen = Math.min(t.length, keyLen - offset);
    t.copy(okm, offset, 0, chunkLen);
    offset += chunkLen;
    counter++;
  }
  return okm;
}
export const KEY_LEN = 32, IV_LEN = 12, TAG_LEN = 16, SALT_LEN = 32, HKDF_INFO = Buffer.from("zeta-b0852-cred-persistence-v1"), SCRYPT_N = 131072, SCRYPT_R = 8, SCRYPT_P = 1, SCRYPT_MAXMEM = 268435456, SCRYPT_STRETCHED_LEN = 32;
export function deriveKeyFromBindingMaterial(bindingMaterial, passphrase, salt) {
  if (salt.length !== SALT_LEN)
    throw Error(`salt must be ${SALT_LEN} bytes; got ${salt.length}`);
  if (bindingMaterial.length === 0)
    throw Error("bindingMaterial must be non-empty");
  const saltCopy = Buffer.from(salt), stretched = scryptSync(passphrase, saltCopy, SCRYPT_STRETCHED_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM
  }), ikm = Buffer.concat([
    Buffer.from(bindingMaterial, "utf8"),
    Buffer.from("|", "utf8"),
    stretched
  ]), derived = hkdfHmacSync("sha256", ikm, saltCopy, HKDF_INFO, KEY_LEN);
  return Buffer.from(derived);
}
export function deriveKey(usbUuid, passphrase, salt) {
  return deriveKeyFromBindingMaterial(usbUuid, passphrase, salt);
}
export function encryptWithBindingMaterial(plaintext, bindingMaterial, passphrase) {
  const salt = randomBytes(SALT_LEN), iv = randomBytes(IV_LEN), key = deriveKeyFromBindingMaterial(bindingMaterial, passphrase, salt), cipher = createCipheriv("aes-256-gcm", key, iv), ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]), tag = cipher.getAuthTag();
  return { salt, iv, tag, ciphertext };
}
export function encrypt(plaintext, usbUuid, passphrase) {
  return encryptWithBindingMaterial(plaintext, usbUuid, passphrase);
}
export function decrypt(envelope, bindingMaterial, passphrase) {
  if (envelope.salt.length !== SALT_LEN)
    return { error: `salt must be ${SALT_LEN} bytes; got ${envelope.salt.length}` };
  if (envelope.iv.length !== IV_LEN)
    return { error: `iv must be ${IV_LEN} bytes; got ${envelope.iv.length}` };
  if (envelope.tag.length !== TAG_LEN)
    return { error: `tag must be ${TAG_LEN} bytes; got ${envelope.tag.length}` };
  const key = deriveKeyFromBindingMaterial(bindingMaterial, passphrase, envelope.salt), decipher = createDecipheriv("aes-256-gcm", key, envelope.iv);
  decipher.setAuthTag(envelope.tag);
  try {
    return Buffer.concat([decipher.update(envelope.ciphertext), decipher.final()]);
  } catch (err) {
    return {
      error: `decryption failed (wrong passphrase / wrong binding / tampered blob): ${err instanceof Error ? err.message : String(err)}`
    };
  }
}
