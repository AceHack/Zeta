// These two constants used to be re-exported from "@shared/const". That import was
// dangling by construction: tsconfig maps "@shared/*" to "./shared/*", and this project
// has NEVER had a shared/ directory — `git log --all -- 'src/Renderers/website/shared/**'`
// is empty, only client/ was ever committed from the Manus scaffold. So `tsc --noEmit`
// reported TS2307 on this line from the project's first commit onward.
//
// They are defined locally rather than deleted, to keep the scaffold's export surface
// intact (the sibling demo/identity-dla-site made the same call in 0e96bdd31f). Both
// values are INERT: nothing in this project imports COOKIE_NAME or ONE_YEAR_MS —
// verified by grep across client/. Treat them as placeholders, not as configuration
// anything reads; if a consumer ever appears, the value is theirs to choose.
export const COOKIE_NAME = "identity-dla";
export const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
