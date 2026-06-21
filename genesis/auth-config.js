/* Project Genesis — runtime auth config.
 *
 * Edit this file AFTER deploying. It is a plain static file (not bundled), so
 * you can change it directly in the deployed genesis/ folder WITHOUT rebuilding.
 *
 * Set `base` to the public URL of your self-hosted .NET OAuth broker
 * (no trailing slash). While it is empty, the sign-in widget shows a
 * "configure backend" hint instead of live buttons.
 */
window.__GENESIS_AUTH__ = {
  base: "", // e.g. "https://genesis-auth.example.com"
  providers: ["github", "gitlab"],
};
