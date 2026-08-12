import { createUdpMeshTransport, type UdpMeshTransport } from "./udp-transport";

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
  private transport?: UdpMeshTransport;
  private nodes: Map<string, HardwareNode> = new Map(); // Keyed by role
  private readonly TTL_MS = 15000; // 15 seconds

  start() {
    this.transport = createUdpMeshTransport({
      group: "239.255.42.99",
      port: 4000,
      loopback: true
    });

    this.transport.onMessage((text: string, _from: string) => {
      try {
        const beacon = JSON.parse(text);
        if (beacon && beacon.type === "hw_beacon") {
          const hwBeacon = beacon as HwBeacon;
          const node: HardwareNode = {
            role: hwBeacon.role,
            host: hwBeacon.host,
            model: hwBeacon.model,
            lastSeen: Date.now()
          };
          this.nodes.set(hwBeacon.role, node);
          console.log(`[HardwareRegistry] Discovered hardware node for ${hwBeacon.role} at ${hwBeacon.host} (${hwBeacon.model})`);
        }
      } catch (e) {
        // Ignore parse errors from other UDP traffic
      }
    });
  }

  getActiveNode(roleName: string): HardwareNode | undefined {
    const node = this.nodes.get(roleName);
    if (!node) return undefined;
    
    // Evict stale nodes
    if (Date.now() - node.lastSeen > this.TTL_MS) {
      this.nodes.delete(roleName);
      console.log(`[HardwareRegistry] Evicted stale hardware node for ${roleName}`);
      return undefined;
    }
    
    return node;
  }
  
  close() {
    this.transport?.close();
  }
}
