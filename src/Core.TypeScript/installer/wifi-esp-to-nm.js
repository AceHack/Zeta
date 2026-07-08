export const WIFI_ESP_INSTALL_SERIAL = {
  found: "[iter-5-wifi] found zeta-wifi-credentials.json on boot USB ESP",
  wroteProfile: "[iter-5-wifi] wrote NetworkManager profile to installed system",
  associationDeferred: "[iter-5-wifi] association deferred (physical-gated; no radio claim)",
  skip: "[iter-5-wifi] no zeta-wifi-credentials.json on boot USB ESP; skipping wifi injection",
  invalid: "[iter-5-wifi] invalid zeta-wifi-credentials.json; skipping profile write"
};
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}
export function parseWifiEspCredentialsJson(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: !1, error: "wifi ESP JSON is not valid JSON" };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))
    return { ok: !1, error: "wifi ESP JSON must be an object with ssid and password" };
  const record = parsed, ssid = record.ssid, password = record.password ?? record.psk;
  if (!isNonEmptyString(ssid))
    return { ok: !1, error: "wifi ESP JSON requires a non-empty string ssid" };
  if (!isNonEmptyString(password))
    return { ok: !1, error: "wifi ESP JSON requires a non-empty string password (or psk)" };
  return { ok: !0, value: { ssid: ssid.trim(), password } };
}
export function wifiProfileBasename(ssid) {
  const slug = ssid.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  return `zeta-esp-${slug.length > 0 ? slug : "wifi"}.nmconnection`;
}
export function composeNmConnectionFromWifiEsp(credentials) {
  const ssid = credentials.ssid.trim();
  if (ssid.length === 0)
    return { ok: !1, error: "ssid must be non-empty" };
  if (credentials.password.length === 0)
    return { ok: !1, error: "password must be non-empty" };
  const escapeKeyfile = (value) => value.replace(/\\/g, "\\\\").replace(/;/g, "\\;"), id = `zeta-esp-${ssid}`;
  return {
    ok: !0,
    value: [
      "[connection]",
      `id=${escapeKeyfile(id)}`,
      "type=wifi",
      "autoconnect=true",
      "",
      "[wifi]",
      "mode=infrastructure",
      `ssid=${escapeKeyfile(ssid)}`,
      "",
      "[wifi-security]",
      "key-mgmt=wpa-psk",
      `psk=${escapeKeyfile(credentials.password)}`,
      "",
      "[ipv4]",
      "method=auto",
      "",
      "[ipv6]",
      "method=auto",
      ""
    ].join(`
`),
    profileBasename: wifiProfileBasename(ssid)
  };
}
export function composeNmConnectionFromWifiEspJson(raw) {
  const parsed = parseWifiEspCredentialsJson(raw);
  if (!parsed.ok)
    return parsed;
  return composeNmConnectionFromWifiEsp(parsed.value);
}
async function main(argv) {
  let input = null, output = null;
  for (let i = 0;i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--input" && argv[i + 1])
      input = argv[++i];
    else if (arg === "--output" && argv[i + 1])
      output = argv[++i];
  }
  if (!input || !output) {
    console.error("usage: wifi-esp-to-nm.ts --input <json> --output <nmconnection>");
    return 2;
  }
  const { readFileSync, writeFileSync } = await import("node:fs");
  let raw;
  try {
    raw = readFileSync(input, "utf8");
  } catch {
    console.error("wifi-esp-to-nm: failed to read input");
    return 3;
  }
  const composed = composeNmConnectionFromWifiEspJson(raw);
  if (!composed.ok) {
    console.error(`wifi-esp-to-nm: ${composed.error}`);
    return 4;
  }
  try {
    writeFileSync(output, composed.value, { mode: 384 });
  } catch {
    console.error("wifi-esp-to-nm: failed to write output");
    return 5;
  }
  console.log(composed.profileBasename);
  return 0;
}
if (import.meta.main)
  main(process.argv.slice(2)).then((code) => process.exit(code));
