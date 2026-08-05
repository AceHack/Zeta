/* Project Genesis — runtime auth config.
 *
 * Edit this file AFTER deploying. It is a plain static file (not bundled), so
 * you can change it directly in the deployed genesis/ folder WITHOUT rebuilding.
 *
 * Set `base` to the public URL of your OAuth broker (no trailing slash). Two
 * brokers implement the same contract — use whichever you prefer:
 *   - Free, zero-host Cloudflare Worker:  genesis/broker-cloudflare/README.md
 *   - Self-hosted .NET service:           genesis/_src/auth-backend/README.md
 * While `base` is empty, the sign-in widget shows a "configure backend" hint
 * instead of live buttons.
 */
window.__GENESIS_AUTH__ = {
  base: "", // e.g. "https://genesis-auth.<subdomain>.workers.dev"
  providers: ["github", "gitlab"],
};
