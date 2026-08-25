import type { AcePackage, InstallResult, TrustedKey, LoadedTrustEntry, Registry, RegistryEntry, RegistriesConfig, RemoteRegistryConfig, InstalledPackage } from "../store.ts";

export interface IAceStorage {
  listInstalled(storePath: string): Promise<InstalledPackage[]>;
  installPackage(storePath: string, pkg: AcePackage): Promise<InstallResult>;
  
  loadTrustStore(bundledPath: string, userPath: string): Promise<Map<string, LoadedTrustEntry>>;
  addTrustedKey(entry: TrustedKey, userPath: string): Promise<{ added: boolean }>;
  listTrustedKeys(bundledPath: string, userPath: string): Promise<Array<{ key_id: string; label?: string; source: "bundled" | "user" }>>;
  
  loadRegistry(bundledPath: string, userPath: string): Promise<Registry>;
  addRegistryEntry(name: string, version: string, entry: RegistryEntry, userPath: string): Promise<{ added: boolean; updated: boolean }>;
  listRegistry(bundledPath: string, userPath: string): Promise<Array<{ name: string; version: string; url: string; source: "bundled" | "user" }>>;
  
  readRegistriesConfig(p: string): Promise<RegistriesConfig>;
  writeRegistryRemote(entry: RemoteRegistryConfig, p: string): Promise<{ added: boolean; updated: boolean }>;
  removeRegistryRemote(url: string, p: string): Promise<{ removed: boolean }>;
}
