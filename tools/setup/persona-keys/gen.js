// Zeta keyring CLI — a thin shell around the pure treaty oracle (derive.ts).
// SECURITY: the seed phrase is NEVER read from argv (visible in ps/shell history).
// Either --generate a fresh one in-process, or read an existing one from STDIN.
import { deriveKeyring, freshMnemonic } from "./derive.js";
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const user = opt("--user") || "zeta";
const publicOnly = flag("--public-only");
// --emit-mnemonic: print ONLY a fresh 24-word seed phrase and exit (the onboard flow
// shows the human their phrase to write down BEFORE deriving).
if (flag("--emit-mnemonic")) {
    process.stdout.write(freshMnemonic() + "\n");
    process.exit(0);
}
const mnemonic = flag("--generate") ? freshMnemonic() : (await Bun.stdin.text()).trim();
const { full, pub } = deriveKeyring(mnemonic, user);
console.log(JSON.stringify(publicOnly ? pub : full, null, 2));
