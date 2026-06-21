/* Frontend auth helpers for Project Genesis (identity-only).
 *
 * The flow is entirely top-level redirects + a URL fragment, so there is no
 * CORS or third-party-cookie dependency:
 *   login()             -> redirect to the broker, which redirects to the provider
 *   captureTokenFromUrl -> on return, read #token=<jwt>, store it, clean the URL
 *   getIdentity()       -> decode the stored token for display
 *
 * The token is a short-lived identity JWT minted by the broker. We only DECODE
 * it here for display; it is signed by the broker, which is the party that
 * VERIFIES it (GET /auth/me) for any real authorization decision.
 */

const STORAGE_KEY = "genesis.identity.token";

function cfg() {
  return (typeof window !== "undefined" && window.__GENESIS_AUTH__) || {
    base: "",
    providers: ["github", "gitlab"],
  };
}

export function authBase() {
  return String(cfg().base || "").replace(/\/+$/, "");
}

export function enabledProviders() {
  const p = cfg().providers;
  return Array.isArray(p) && p.length ? p : ["github", "gitlab"];
}

export function isConfigured() {
  return authBase().length > 0;
}

function decodeJwt(token) {
  try {
    const part = token.split(".")[1];
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(b64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function login(provider) {
  const base = authBase();
  if (!base) return;
  // Return to this exact page (works for the /Zeta/genesis/ project path).
  const redirect = window.location.origin + window.location.pathname;
  window.location.href =
    base + "/auth/" + encodeURIComponent(provider) + "/login?redirect=" +
    encodeURIComponent(redirect);
}

export function logout() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/* Capture a token handed back in the URL fragment, persist it, and strip it
 * from the address bar / history so it is not left visible. */
export function captureTokenFromUrl() {
  const hash = window.location.hash || "";
  const m = hash.match(/[#&]token=([^&]+)/);
  if (!m) return;
  const token = decodeURIComponent(m[1]);
  if (decodeJwt(token)) {
    try {
      sessionStorage.setItem(STORAGE_KEY, token);
    } catch {
      /* ignore */
    }
  }
  history.replaceState(null, "", window.location.pathname + window.location.search);
}

export function getIdentity() {
  let token = null;
  try {
    token = sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!token) return null;
  const claims = decodeJwt(token);
  if (!claims) return null;
  if (claims.exp && Date.now() / 1000 >= claims.exp) {
    logout();
    return null;
  }
  return {
    name: claims.name || claims.login || "Signed in",
    login: claims.login || "",
    picture: claims.picture || "",
    provider: claims.provider || "",
  };
}
