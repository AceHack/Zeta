// eslint.config.ts — Zeta's TypeScript lint configuration.
//
// Shape mirrors SQLSharp's (see `../SQLSharp/eslint.config.ts`) —
// strict-type-checked + stylistic-type-checked from typescript-eslint,
// plus eslint-plugin-sonarjs recommended, plus `@eslint/js` recommended.
// Same rule-strictness; different scaffolding (SQLSharp pulls rules
// from a `tools/automation/format/repo-file-globs.ts` helper module
// that Zeta does not yet have — when Zeta grows a parallel automation
// library, this file can refactor to consume it).
//
// Rationale for adopting this strictness on day one rather than
// easing in incrementally: the whole reason for picking bun+TypeScript
// over bash in the post-setup scripting ADR was *static types on
// automation code*. Running with loose lint settings would neutralize
// that argument. Crank it up from day one.
//
// Decision provenance:
//   docs/DECISIONS/2026-04-20-tools-scripting-language.md

import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sonarjs from "eslint-plugin-sonarjs";
import tseslint from "typescript-eslint";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const typeCheckedProject = path.join(repoRoot, "tsconfig.json");
const typeScriptFilePatterns = ["**/*.ts"];

const nodeGlobals = {
  ...globals.node,
  ...globals.nodeBuiltin,
};

const sonarjsRecommended = sonarjs.configs?.recommended;
if (!sonarjsRecommended || Array.isArray(sonarjsRecommended)) {
  throw new Error("eslint-plugin-sonarjs did not expose the expected flat recommended config.");
}

const sonarjsConfig = {
  plugins: { sonarjs },
  rules: sonarjsRecommended.rules ?? {},
  ...(sonarjsRecommended.settings ? { settings: sonarjsRecommended.settings } : {}),
};

const typeCheckedConfigOverrides = [
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
].map((config) => ({
  ...config,
  files: typeScriptFilePatterns,
}));

const disableTypeCheckedConfig = {
  ...tseslint.configs.disableTypeChecked,
  files: ["eslint.config.ts"],
};

// Excludes — must cover every heavy directory in the Zeta tree or
// eslint's glob walk becomes minutes per invocation. Doubled patterns
// (root-level + `**/...`) catch nested occurrences (e.g. a transient
// `tools/foo/node_modules` created by a script). Inherited shape from
// SQLSharp `tools/automation/format/repo-file-globs.ts`
// (`defaultRepoPathIgnorePatterns`) with Zeta-specific additions for
// the Lake build store (`tools/lean4/.lake`, ~7 GB) and solver JAR
// stores (`tools/alloy`, `tools/tla`).
const ignorePatterns = [
  "node_modules/**",
  "**/node_modules/**",
  ".git/**",
  "bin/**",
  "obj/**",
  "**/bin/**",
  "**/obj/**",
  "BenchmarkDotNet.Artifacts/**",
  "**/BenchmarkDotNet.Artifacts/**",
  "TestResults/**",
  "**/TestResults/**",
  "artifacts/**",
  "**/artifacts/**",
  "references/prior-art/**",
  ".lake/**",
  "**/.lake/**",
  "tools/lean4/.lake/**",
  "tools/alloy/**",
  "tools/tla/**",
];

export default defineConfig(
  { ignores: ignorePatterns },
  js.configs.recommended,
  sonarjsConfig,
  {
    files: typeScriptFilePatterns,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: nodeGlobals,
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
    rules: {
      "no-console": "off",

      // ── sonarjs/no-alphabetical-sort: OFF, and this is a correctness decision ──
      //
      // The rule's message is: "Provide a compare function that depends on
      // `String.localeCompare`, to reliably sort elements alphabetically."
      //
      // In this repo that advice is **wrong, and actively harmful**.
      // `.claude/rules/culture-invariant-by-default.md` bans `localeCompare`
      // outright: it is linguistic and ICU-version-dependent, so two machines can
      // order the same keys differently — which breaks DST replay and the
      // N-oracle byte-lock. It is enforced at compiler-error level for C#
      // (CA1304/1305/1307/1310 in .editorconfig) and, since 2026-08-16, by
      // `src/Core.TypeScript/hygiene/lint-no-culture-sensitive-collation.ts` for
      // TypeScript. Leaving this rule on left the two lints in direct
      // contradiction, with this one telling every agent to introduce the very
      // call the other one bans.
      //
      // It has already bitten: see the comment at
      // `src/Core.TypeScript/hygiene/unexecuted-test-files.ts:79` —
      // "NOT localeCompare, which the lint rule suggests".
      //
      // Turning it off does not lose anything real. The behaviour it warns about
      // — bare `Array.prototype.sort()` coercing to string — is **deterministic
      // here**: ECMA-262 SortCompare with `comparefn` undefined uses ToString plus
      // the abstract relational comparison, i.e. UTF-16 code-unit order, with no
      // locale consulted (verified: byte-identical output under `LC_ALL=C` and
      // `LC_ALL=sv_SE.UTF-8`). The genuine hazard it also covers — numbers sorting
      // as strings — is caught by `@typescript-eslint`'s type-aware rules, which
      // have the types to know the difference.
      //
      // The canonical comparator is `stringCompare` in
      // `src/Core.TypeScript/collation/collation.ts` (code point ≡ UTF-8 byte
      // order — the collation treaty).
      "sonarjs/no-alphabetical-sort": "off",
    },
  },
  // ── No credential may be written to Web Storage ────────────────────────
  //
  // `localStorage` / `sessionStorage` are plain text, readable synchronously by
  // ANY script running on the origin, and `localStorage` additionally survives
  // the tab, the browser restart, and the user's memory that they ever typed
  // the secret. There is no expiry, no HttpOnly equivalent, and no per-script
  // gate: one XSS, one bad dependency, or one browser extension with host
  // permissions reads the whole store. So a credential does not belong there,
  // and this rule refuses the write instead of trusting each new browser
  // surface to rediscover why.
  //
  // WHY A LINT AND NOT A REVIEW NOTE: the defect this replaces
  // (`zeta_llm_api_key` in src/apps/twitch-ai/src/main.ts) was written
  // carefully — the key was never echoed back into the DOM, clearing was an
  // explicit button, and the label said out loud that it went to localStorage.
  // Care at the call site did not help, because the problem was the LOCATION,
  // not the handling. A tripwire catches the location.
  //
  // HONEST LIMITS, stated so nobody reads this as a proof:
  //  - It matches STRING LITERAL key names only. A key passed as a variable
  //    (`setItem(CREDENTIAL_STORAGE_KEY, …)`) is invisible to it.
  //  - Bare "key" is deliberately NOT in the pattern: `sortKey`, `cacheKey`
  //    and friends would drown the signal. Compound forms (`api_key`,
  //    `apiKey`, `privateKey`) are matched.
  //  - It says nothing about the VALUE. Storing a secret under the name
  //    "preferences" passes this rule and is still wrong.
  // It is a tripwire on the cheapest, most common shape, not a guarantee.
  //
  // The direction credentials should go instead is
  // `src/Core.TypeScript/secrets/credential.ts`: fetched at point of use,
  // handed to one consumer, never parked in an ambient store. That is the
  // browser-side statement of the same §13 noninterference discipline
  // `lint-no-ambient-credential-hoist.ts` enforces for shell environments.
  {
    files: typeScriptFilePatterns,
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            'CallExpression[callee.object.name=/^(localStorage|sessionStorage)$/][callee.property.name="setItem"][arguments.0.value=/(token|secret|passwd|password|credential|api[-_]?key|apikey|auth|bearer|private[-_]?key|privatekey)/i]',
          message:
            "Do not write a credential to Web Storage: it is clear text, readable by any script on the origin, and localStorage outlives the tab. Fetch it at point of use instead (src/Core.TypeScript/secrets/credential.ts), or do not collect it at all. See src/apps/twitch-ai/src/main.ts for the worked removal.",
        },
      ],
    },
  },
  ...typeCheckedConfigOverrides,
  {
    files: typeScriptFilePatterns,
    languageOptions: {
      parserOptions: {
        project: [typeCheckedProject],
        tsconfigRootDir: repoRoot,
      },
    },
  },
  disableTypeCheckedConfig,
);
