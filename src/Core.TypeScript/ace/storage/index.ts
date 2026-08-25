import type { IAceStorage } from "./IAceStorage.ts";
import { LocalFSStorage } from "./LocalFSStorage.ts";

export let storage: IAceStorage = new LocalFSStorage();

export function setStorage(newStorage: IAceStorage): void {
  storage = newStorage;
}
