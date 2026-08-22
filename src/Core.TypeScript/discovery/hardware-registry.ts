export interface HwBeacon {
  type: "hw_beacon";
  role: string;
  host: string;
  model: string;
  timestamp: number;
}

export interface HardwareNode {
  role: string;
  host: string;
  model: string;
  lastSeen: number;
}

export class HardwareRegistry {
  start() {
    console.log("[HardwareRegistry] UDP Multicast discovery disabled in PWA mode.");
  }

  getActiveNode(_roleName: string): HardwareNode | undefined {
    return undefined;
  }
  
  close() {}
}
