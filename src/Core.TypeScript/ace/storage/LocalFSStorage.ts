import type { IAceStorage } from "./IAceStorage.ts";
import type { AcePackage, InstallResult, TrustedKey, LoadedTrustEntry, Registry, RegistryEntry, RegistriesConfig, RemoteRegistryConfig, InstalledPackage } from "../store.ts";
import {
  listInstalled as fsListInstalled,
  installPackage as fsInstallPackage,
  loadTrustStore as fsLoadTrustStore,
  addTrustedKey as fsAddTrustedKey,
  listTrustedKeys as fsListTrustedKeys,
  loadRegistry as fsLoadRegistry,
  addRegistryEntry as fsAddRegistryEntry,
  listRegistry as fsListRegistry,
  readRegistriesConfig as fsReadRegistriesConfig,
  writeRegistryRemote as fsWriteRegistryRemote,
  removeRegistryRemote as fsRemoveRegistryRemote
} from "../store.ts";

export class LocalFSStorage implements IAceStorage {
  async listInstalled(storePath: string): Promise<InstalledPackage[]> {
    return fsListInstalled(storePath);
  }

  async installPackage(storePath: string, pkg: AcePackage): Promise<InstallResult> {
    return fsInstallPackage(storePath, pkg);
  }

  async loadTrustStore(bundledPath: string, userPath: string): Promise<Map<string, LoadedTrustEntry>> {
    return fsLoadTrustStore(bundledPath, userPath);
  }

  async addTrustedKey(entry: TrustedKey, userPath: string): Promise<{ added: boolean }> {
    return fsAddTrustedKey(entry, userPath);
  }

  async listTrustedKeys(bundledPath: string, userPath: string): Promise<Array<{ key_id: string; label?: string; source: "bundled" | "user" }>> {
    return fsListTrustedKeys(bundledPath, userPath);
  }

  async loadRegistry(bundledPath: string, userPath: string): Promise<Registry> {
    return fsLoadRegistry(bundledPath, userPath);
  }

  async addRegistryEntry(name: string, version: string, entry: RegistryEntry, userPath: string): Promise<{ added: boolean; updated: boolean }> {
    return fsAddRegistryEntry(name, version, entry, userPath);
  }

  async listRegistry(bundledPath: string, userPath: string): Promise<Array<{ name: string; version: string; url: string; source: "bundled" | "user" }>> {
    return fsListRegistry(bundledPath, userPath);
  }

  async readRegistriesConfig(p: string): Promise<RegistriesConfig> {
    return fsReadRegistriesConfig(p);
  }

  async writeRegistryRemote(entry: RemoteRegistryConfig, p: string): Promise<{ added: boolean; updated: boolean }> {
    return fsWriteRegistryRemote(entry, p);
  }

  async removeRegistryRemote(url: string, p: string): Promise<{ removed: boolean }> {
    return fsRemoveRegistryRemote(url, p);
  }
}
