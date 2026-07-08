/**
 * ESP wifi JSON → NetworkManager .nmconnection (software-only).
 *
 * zflash bakes `/zeta-wifi-credentials.json` as `{ssid,password}`.
 * Install copies a profile onto the target; association stays physical-gated.
 */

export interface WifiEspCredentials {
  readonly ssid: string;
  readonly password: string;
}

export type WifiEspParseResult =
  | { readonly ok: true; readonly value: WifiEspCredentials }
  | { readonly ok: false; readonly error: string };

export type NmConnectionComposeResult =
  | { readonly ok: true; readonly value: string; readonly profileBasename: string }
  | { readonly ok: false; readonly error: string };

/** Serial markers for QEMU / install logs (no association claim). */
export const WIFI_ESP_INSTALL_SERIAL = {
  found: "[iter-5-wifi] found zeta-wifi-credentials.json on boot USB ESP",
  wroteProfile: "[iter-5-wifi] wrote NetworkManager profile to installed system",
  associationDeferred: "[iter-5-wifi] association deferred (physical-gated; no radio claim)",
  skip: "[iter-5-wifi] no zeta-wifi-credentials.json on boot USB ESP; skipping wifi injection",
  invalid: "[iter-5-wifi] invalid zeta-wifi-credentials.json; skipping profile write",
} as const;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Parse ESP JSON without echoing secrets in errors. */
export function parseWifiEspCredentialsJson(raw: string): WifiEspParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "wifi ESP JSON is not valid JSON" };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "wifi ESP JSON must be an object with ssid and password" };
  }
  const record = parsed as Record<string, unknown>;
  const ssid = record.ssid;
  const password = record.password ?? record.psk;
  if (!isNonEmptyString(ssid)) {
    return { ok: false, error: "wifi ESP JSON requires a non-empty string ssid" };
  }
  if (!isNonEmptyString(password)) {
    return { ok: false, error: "wifi ESP JSON requires a non-empty string password (or psk)" };
  }
  return { ok: true, value: { ssid: ssid.trim(), password } };
}

/** Sanitize SSID into a safe .nmconnection basename (no secrets). */
export function wifiProfileBasename(ssid: string): string {
  const slug = ssid
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `zeta-esp-${slug.length > 0 ? slug : "wifi"}.nmconnection`;
}

/**
 * Compose a minimal NetworkManager keyfile for WPA-PSK.
 * Does not activate or associate — install-time write only.
 */
export function composeNmConnectionFromWifiEsp(
  credentials: WifiEspCredentials,
): NmConnectionComposeResult {
  const ssid = credentials.ssid.trim();
  if (ssid.length === 0) {
    return { ok: false, error: "ssid must be non-empty" };
  }
  if (credentials.password.length === 0) {
    return { ok: false, error: "password must be non-empty" };
  }
  // Escape for keyfile: backslash and semicolon are special in NM keyfiles.
  const escapeKeyfile = (value: string): string =>
    value.replace(/\\/g, "\\\\").replace(/;/g, "\\;");

  const id = `zeta-esp-${ssid}`;
  const body = [
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
    "",
  ].join("\n");

  return {
    ok: true,
    value: body,
    profileBasename: wifiProfileBasename(ssid),
  };
}

export function composeNmConnectionFromWifiEspJson(raw: string): NmConnectionComposeResult {
  const parsed = parseWifiEspCredentialsJson(raw);
  if (!parsed.ok) return parsed;
  return composeNmConnectionFromWifiEsp(parsed.value);
}

async function main(argv: readonly string[]): Promise<number> {
  // Usage:
  //   bun wifi-esp-to-nm.ts --input <json-path> --output <nmconnection-path>
  // Prints profile basename on stdout; errors on stderr without secrets.
  let input: string | null = null;
  let output: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--input" && argv[i + 1]) input = argv[++i]!;
    else if (arg === "--output" && argv[i + 1]) output = argv[++i]!;
  }
  if (!input || !output) {
    console.error("usage: wifi-esp-to-nm.ts --input <json> --output <nmconnection>");
    return 2;
  }
  const { readFileSync, writeFileSync } = await import("node:fs");
  let raw: string;
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
    writeFileSync(output, composed.value, { mode: 0o600 });
  } catch {
    console.error("wifi-esp-to-nm: failed to write output");
    return 5;
  }
  console.log(composed.profileBasename);
  return 0;
}

if (import.meta.main) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
