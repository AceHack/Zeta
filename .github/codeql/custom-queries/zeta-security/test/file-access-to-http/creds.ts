// Shared shape: a credential record read off disk. Both consumers below get
// their credential from here, so the ONLY difference between them is the guard.
import { readFileSync } from "node:fs";

export interface Creds {
  readonly baseUrl: string;
  readonly token: string;
}

export function readCreds(path: string): Creds {
  const raw = JSON.parse(readFileSync(path, "utf-8")) as Record<string, string>;
  return { baseUrl: String(raw["baseUrl"]), token: String(raw["token"]) };
}
