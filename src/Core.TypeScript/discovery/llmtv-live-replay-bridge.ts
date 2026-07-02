// llmtv-live-replay-bridge -- live node frames to replay artifacts.
//
// The physical mesh runner owns sockets. The UI owns rendering. This bridge owns the
// narrow join between them: wrap an injected broadcast transport with the replay recorder,
// then run the ordinary LLMTV node over that recorded port.

import type { DiscoveryTransport } from "./discovery-beacon";
import type { BroadcastTransport } from "./llmtv-broadcast";
import { createLlmtvNode, type LlmtvNodeConfig, type LlmtvNodeHandle, type Scheduler } from "./llmtv-node";
import type { ReplayArtifact } from "./llmtv-replay";
import {
  createReplayRecorder,
  recordBroadcastTransport,
  type RecordingBroadcastOptions,
  type ReplayRecorder,
  type ReplayRecorderOptions,
  type ReplayRecorderSnapshotOptions,
} from "./llmtv-replay-recorder";

export interface LlmtvLiveReplayBridgeOptions extends ReplayRecorderOptions, RecordingBroadcastOptions {
  readonly generatedBy?: string;
}

export interface LlmtvLiveReplayBridge {
  readonly node: LlmtvNodeHandle;
  readonly recorder: ReplayRecorder;
  artifact(options: ReplayRecorderSnapshotOptions): ReplayArtifact;
  encode(options: ReplayRecorderSnapshotOptions): string;
  drain(options: ReplayRecorderSnapshotOptions): ReplayArtifact;
}

function withDefaultGeneratedBy(
  options: ReplayRecorderSnapshotOptions,
  generatedBy: string,
): ReplayRecorderSnapshotOptions {
  return options.generatedBy === undefined ? { ...options, generatedBy } : options;
}

export function createLlmtvLiveReplayBridge(
  config: LlmtvNodeConfig,
  discovery: DiscoveryTransport,
  broadcast: BroadcastTransport,
  scheduler: Scheduler,
  options: LlmtvLiveReplayBridgeOptions = {},
): LlmtvLiveReplayBridge {
  const { generatedBy, recordInbound, recordOutbound, outboundFrom, ...recorderOptions } = options;
  const recorder = createReplayRecorder(() => scheduler.now(), recorderOptions);
  const recordingOptions: RecordingBroadcastOptions = {
    ...(recordInbound === undefined ? {} : { recordInbound }),
    ...(recordOutbound === undefined ? {} : { recordOutbound }),
    outboundFrom: outboundFrom ?? config.source.zid,
  };
  const recordedBroadcast = recordBroadcastTransport(broadcast, recorder, recordingOptions);
  const node = createLlmtvNode(config, discovery, recordedBroadcast, scheduler);
  const defaultGeneratedBy = generatedBy ?? "llmtv-live-replay-bridge";

  return {
    node,
    recorder,
    artifact(snapshot) {
      return recorder.artifact(withDefaultGeneratedBy(snapshot, defaultGeneratedBy));
    },
    encode(snapshot) {
      return recorder.encode(withDefaultGeneratedBy(snapshot, defaultGeneratedBy));
    },
    drain(snapshot) {
      const artifact = recorder.artifact(withDefaultGeneratedBy(snapshot, defaultGeneratedBy));
      recorder.clear();
      return artifact;
    },
  };
}
