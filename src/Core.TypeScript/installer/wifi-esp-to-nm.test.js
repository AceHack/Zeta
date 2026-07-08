import { describe, expect, it } from "bun:test";
import {
  WIFI_ESP_INSTALL_SERIAL,
  composeNmConnectionFromWifiEsp,
  composeNmConnectionFromWifiEspJson,
  parseWifiEspCredentialsJson,
  wifiProfileBasename
} from "./wifi-esp-to-nm.ts";
describe("wifi-esp-to-nm", () => {
  it("parses ssid+password JSON", () => {
    const result = parseWifiEspCredentialsJson('{"ssid":"Homelab","password":"secret"}');
    expect(result.ok).toBe(!0);
    if (result.ok) {
      expect(result.value.ssid).toBe("Homelab");
      expect(result.value.password).toBe("secret");
    }
  });
  it("accepts psk alias without echoing secrets on error", () => {
    const result = parseWifiEspCredentialsJson('{"ssid":"Homelab","psk":"secret"}');
    expect(result.ok).toBe(!0);
    const bad = parseWifiEspCredentialsJson('{"ssid":"Homelab"}');
    expect(bad.ok).toBe(!1);
    if (!bad.ok)
      expect(bad.error).not.toContain("secret");
  });
  it("composes nmconnection with ssid and deferred-association contract markers", () => {
    const composed = composeNmConnectionFromWifiEsp({ ssid: "Homelab", password: "super-secret" });
    expect(composed.ok).toBe(!0);
    if (composed.ok) {
      expect(composed.profileBasename).toBe("zeta-esp-homelab.nmconnection");
      expect(composed.value).toContain("ssid=Homelab");
      expect(composed.value).toContain("psk=super-secret");
      expect(composed.value).toContain("key-mgmt=wpa-psk");
      expect(composed.value).toContain("autoconnect=true");
    }
    expect(WIFI_ESP_INSTALL_SERIAL.associationDeferred).toContain("physical-gated");
    expect(WIFI_ESP_INSTALL_SERIAL.wroteProfile).toContain("NetworkManager profile");
  });
  it("composeNmConnectionFromWifiEspJson round-trips ESP payload", () => {
    const result = composeNmConnectionFromWifiEspJson(`{"ssid":"Cafe WiFi","password":"x"}
`);
    expect(result.ok).toBe(!0);
    if (result.ok) {
      expect(result.profileBasename).toBe("zeta-esp-cafe-wifi.nmconnection");
      expect(result.value).toContain("ssid=Cafe WiFi");
    }
  });
  it("wifiProfileBasename sanitizes", () => {
    expect(wifiProfileBasename("  My Net!! ")).toBe("zeta-esp-my-net.nmconnection");
  });
});
