import type { IAceStorage } from "./IAceStorage.ts";
import type { AcePackage, InstallResult, TrustedKey, LoadedTrustEntry, Registry, RegistryEntry, RegistriesConfig, RemoteRegistryConfig, InstalledPackage } from "../store.ts";

export class ZetaStorage implements IAceStorage {
  // TODO: Inject ZetaStore instance here when wiring up the bootstrapper

  async listInstalled(_storePath: string): Promise<InstalledPackage[]> {
    throw new Error("ZetaStorage.listInstalled not implemented");
  }

  async installPackage(_storePath: string, _pkg: AcePackage): Promise<InstallResult> {
    throw new Error("ZetaStorage.installPackage not implemented");
  }

  async loadTrustStore(_bundledPath: string, _userPath: string): Promise<Map<string, LoadedTrustEntry>> {
    throw new Error("ZetaStorage.loadTrustStore not implemented");
  }

  async addTrustedKey(_entry: TrustedKey, _userPath: string): Promise<{ added: boolean }> {
    throw new Error("ZetaStorage.addTrustedKey not implemented");
  }

  async listTrustedKeys(_bundledPath: string, _userPath: string): Promise<Array<{ key_id: string; label?: string; source: "bundled" | "user" }>> {
    throw new Error("ZetaStorage.listTrustedKeys not implemented");
  }

  async loadRegistry(_bundledPath: string, _userPath: string): Promise<Registry> {
    throw new Error("ZetaStorage.loadRegistry not implemented");
  }

  async addRegistryEntry(_name: string, _version: string, _entry: RegistryEntry, _userPath: string): Promise<{ added: boolean; updated: boolean }> {
    throw new Error("ZetaStorage.addRegistryEntry not implemented");
  }

  async listRegistry(_bundledPath: string, _userPath: string): Promise<Array<{ name: string; version: string; url: string; source: "bundled" | "user" }>> {
    throw new Error("ZetaStorage.listRegistry not implemented");
  }

  async readRegistriesConfig(_p: string): Promise<RegistriesConfig> {
    throw new Error("ZetaStorage.readRegistriesConfig not implemented");
  }

  async writeRegistryRemote(_entry: RemoteRegistryConfig, _p: string): Promise<{ added: boolean; updated: boolean }> {
    throw new Error("ZetaStorage.writeRegistryRemote not implemented");
  }

  async removeRegistryRemote(_url: string, _p: string): Promise<{ removed: boolean }> {
    throw new Error("ZetaStorage.removeRegistryRemote not implemented");
  }
}
