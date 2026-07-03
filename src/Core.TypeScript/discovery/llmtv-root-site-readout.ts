// llmtv-root-site-readout -- canonical root-site paths for the LLMTV live surface.
//
// The browser should read static same-origin artifacts, not poll GitHub or own the live
// mesh. This adapter pins the root-site contract around the source-owned live readout:
// data/llmtv-live.replay.json is the replay ledger, hall/tv/index.html is the zero-JS
// LLMTV page the Iris root site already links to.

import { join } from "node:path";
import {
  createLlmtvLiveReadout,
  type LlmtvLiveReadout,
  type LlmtvLiveReadoutIo,
  type LlmtvLiveReadoutOptions,
} from "./llmtv-live-readout";
import type { LlmtvLiveReplayBridge } from "./llmtv-live-replay-bridge";
import type { Scheduler } from "./llmtv-node";

export const ROOT_SITE_LLMTV_REPLAY_RELATIVE_PATH = "data/llmtv-live.replay.json";
export const ROOT_SITE_LLMTV_HTML_RELATIVE_PATH = "hall/tv/index.html";
export const ROOT_SITE_LLMTV_GENERATED_BY = "llmtv-root-site-readout";
export const ROOT_SITE_LLMTV_TITLE = "Zeta — LLMTV (live root-site readout)";

export interface RootSiteLlmtvPaths {
  readonly replayPath: string;
  readonly htmlPath: string;
}

export interface RootSiteLlmtvLiveReadoutOptions extends Omit<
  LlmtvLiveReadoutOptions,
  "replayPath" | "htmlPath" | "generatedBy" | "title"
> {
  readonly rootDir: string;
  readonly generatedBy?: string;
  readonly title?: string;
}

function joinRelative(rootDir: string, relativePath: string): string {
  return join(rootDir, ...relativePath.split("/"));
}

export function rootSiteLlmtvPaths(rootDir: string): RootSiteLlmtvPaths {
  return {
    replayPath: joinRelative(rootDir, ROOT_SITE_LLMTV_REPLAY_RELATIVE_PATH),
    htmlPath: joinRelative(rootDir, ROOT_SITE_LLMTV_HTML_RELATIVE_PATH),
  };
}

export function createRootSiteLlmtvLiveReadout(
  bridge: LlmtvLiveReplayBridge,
  scheduler: Scheduler,
  io: LlmtvLiveReadoutIo,
  options: RootSiteLlmtvLiveReadoutOptions,
): LlmtvLiveReadout {
  const paths = rootSiteLlmtvPaths(options.rootDir);
  return createLlmtvLiveReadout(bridge, scheduler, io, {
    ...options,
    ...paths,
    generatedBy: options.generatedBy ?? ROOT_SITE_LLMTV_GENERATED_BY,
    title: options.title ?? ROOT_SITE_LLMTV_TITLE,
  });
}
