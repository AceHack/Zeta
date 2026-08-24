// markdownlint-cli2.d.ts — a minimal, honest declaration for the one entry point
// `audit-linter-coverage-vs-invocation.ts` uses.
//
// `markdownlint-cli2` ships no types. The alternative to this file is an `any` at the import
// site, which under this repo's strict settings is the same defect the audit is about: a
// boundary that reports nothing and cannot fail. Declared narrowly rather than completely —
// only `main`, only the options actually passed — so the declaration cannot quietly claim
// more of the package's surface than has been checked against its behaviour.
//
// Precedent: `src/Core.QSharp.ReferenceOracle/quantum-circuit.d.ts`.

declare module "markdownlint-cli2" {
  /** A rule invoked per file; the audit's probe uses it only to record `params.name`. */
  export interface MarkdownlintCli2ProbeRule {
    readonly names: readonly string[];
    readonly description: string;
    readonly tags: readonly string[];
    readonly parser: "none" | "markdownit" | "micromark";
    readonly function: (params: { readonly name: string }) => void;
  }

  export interface MarkdownlintCli2Options {
    /** Repo root to resolve globs and `.markdownlint-cli2.jsonc` from. */
    readonly directory?: string;
    readonly argv: readonly string[];
    readonly logMessage?: (msg: string) => void;
    readonly logError?: (msg: string) => void;
    readonly optionsOverride?: {
      readonly customRules?: readonly MarkdownlintCli2ProbeRule[];
      readonly config?: Readonly<Record<string, unknown>>;
    };
    readonly outputFormatters?: readonly (readonly unknown[])[];
  }

  /** Resolves to the process exit code the CLI would have used. */
  export function main(options: MarkdownlintCli2Options): Promise<number>;
}
