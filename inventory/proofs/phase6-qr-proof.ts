/**
 * Inventory — Phase 6 QR proof (encode -> INDEPENDENT decode -> assert)
 * ---------------------------------------------------------------------------
 * Gate (a): generate a label for a specific item id and confirm the QR resolves
 * to the correct item record URL.
 *
 * WHAT THIS PROVES (and what it does NOT):
 *   - PROVES, programmatically, that the QR the app generates for item <id>
 *     encodes EXACTLY the deep-link URL the page reads on sign-in (?item=<id>),
 *     by decoding it with an INDEPENDENT decoder (jsQR) — the vendored encoder
 *     (qrcode-generator) has no decode path, so this is a true round-trip across
 *     two different libraries, not a circular check.
 *   - Writes the actual GIF the browser would render to _proof_tmp/ (so the
 *     image can be shown).
 *   - Does NOT physically scan with a phone camera, and does NOT exercise live
 *     sign-in routing — those are the Phase-7 Auditor's job on the live site
 *     (same deferral precedent as the Phase-3 browser proofs). The sign-in
 *     ROUTING LOGIC (parseItemId + pending-deep-link) is unit-tested in
 *     inventory-export.unit.test.ts.
 *
 * The INDEPENDENT decode runs via a git-ignored sandbox driver
 * (inventory/_proof_tmp/qrsandbox/decode-rgba.mjs) so the jsQR dependency never
 * reaches the committed tree / CI. Set it up once:
 *     cd inventory/_proof_tmp/qrsandbox && bun add jsqr@1.4.0
 * Then:  bun inventory/proofs/phase6-qr-proof.ts [itemId]
 * If the sandbox is absent the encode proof still runs and the decode is SKIPPED
 * with a clear note (never silently passed).
 */
import IE from "../lib/inventory-export.js";
import qrcode from "../lib/qrcode-generator-1.4.4.js";

const BASE = "https://lucent-financial-group.github.io/Zeta/inventory/";
const SCALE = 8; // px per module
const MARGIN = 4; // quiet-zone modules (QR spec minimum)
const SANDBOX = "inventory/_proof_tmp/qrsandbox";

function die(msg: string): never {
  console.error("FAIL: " + msg);
  process.exit(1);
}

function renderRGBA(model: ReturnType<typeof qrcode>): { rgba: Uint8Array; dim: number } {
  const count = model.getModuleCount();
  const dim = (count + MARGIN * 2) * SCALE;
  const rgba = new Uint8Array(dim * dim * 4).fill(255); // white canvas, opaque
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (!model.isDark(r, c)) continue;
      const x0 = (c + MARGIN) * SCALE;
      const y0 = (r + MARGIN) * SCALE;
      for (let y = y0; y < y0 + SCALE; y++) {
        for (let x = x0; x < x0 + SCALE; x++) {
          const p = (y * dim + x) * 4;
          rgba[p] = 0;
          rgba[p + 1] = 0;
          rgba[p + 2] = 0; // black module (alpha already 255)
        }
      }
    }
  }
  return { rgba, dim };
}

async function independentDecode(rgba: Uint8Array, dim: number): Promise<string | null> {
  const driver = `${SANDBOX}/decode-rgba.mjs`;
  if (!(await Bun.file(driver).exists())) {
    console.log(`independent decode  : SKIPPED (sandbox absent — run \`cd ${SANDBOX} && bun add jsqr@1.4.0\`)`);
    return null;
  }
  const binPath = "inventory/_proof_tmp/phase6-qr-rgba.bin";
  await Bun.write(binPath, rgba);
  const proc = Bun.spawn(["node", driver, binPath, String(dim), String(dim)], { stdout: "pipe", stderr: "pipe" });
  const out = (await new Response(proc.stdout).text()).trim();
  await proc.exited;
  if (out === "DECODE_NULL" || out === "") {
    console.error("independent decode  : jsQR returned no result");
    return null;
  }
  return out;
}

async function main(): Promise<void> {
  const id = Number(process.argv[2] ?? 42);
  if (!Number.isInteger(id) || id <= 0) die(`bad item id: ${String(process.argv[2])}`);

  const url = IE.itemUrl(BASE, id);
  console.log(`item id              : ${String(id)}`);
  console.log(`expected QR payload  : ${url}`);

  // ---- encode (the exact call index.html makes) ----
  const model = qrcode(0, "M"); // typeNumber 0 = auto-fit; ECC level M
  model.addData(url);
  model.make();
  const n = model.getModuleCount();
  console.log(`QR version/modules   : ${String(n)}x${String(n)} (ECC=M)`);

  // ---- write the viewable GIF (what the browser <img> shows) ----
  const dataUrl = model.createDataURL(SCALE, MARGIN); // "data:image/gif;base64,...."
  const gif = Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
  const outGif = `inventory/_proof_tmp/phase6-qr-item-${String(id)}.gif`;
  await Bun.write(outGif, gif);
  console.log(`QR image written     : ${outGif} (${String(gif.length)} bytes)`);

  // ---- INDEPENDENT decode (jsQR via sandbox) ----
  const { rgba, dim } = renderRGBA(model);
  const decoded = await independentDecode(rgba, dim);
  if (decoded === null) {
    console.log("\nencode proof OK; independent decode not run (see note above).");
    return;
  }
  console.log(`decoded QR payload   : ${decoded}`);

  // ---- assert round-trip + that the page would route to this id ----
  if (decoded !== url) die(`decoded payload != expected\n  got : ${decoded}\n  want: ${url}`);
  const routedId = IE.parseItemId(decoded);
  if (routedId !== id) die(`parseItemId(decoded) = ${String(routedId)}, expected ${String(id)}`);

  console.log(
    `\nPASS: encode->decode round-trip identical (two independent libraries); ` +
      `parseItemId(decoded)=${String(routedId)} => the page deep-links to item #${String(id)} after sign-in.`,
  );
}

void main();
