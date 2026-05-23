import { registerPlugin } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";

type CameraBridgeEvent =
  | "cameraBridgeState"
  | "cameraBridgeError"
  | "cameraBridgeBytes";

/** Matches native `@CapacitorPlugin(name = "CameraBridge")`. */
export interface CameraBridgePlugin {
  start(options: {
    rtspUrl: string;
    patientId: string;
    sfuOrigin: string;
    jwt: string;
    iceJson?: string;
    useUdp?: boolean;
  }): Promise<{ ok?: boolean; state?: string }>;
  stop(): Promise<{ ok?: boolean }>;
  getStatus(): Promise<{ bytesTransferred?: number }>;
  addListener(
    eventName: CameraBridgeEvent,
    listenerFunc: (data: {
      state?: string;
      error?: string;
      bytesTransferred?: number;
    }) => void,
  ): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

export const CameraBridge = registerPlugin<CameraBridgePlugin>("CameraBridge", {
  web: () =>
    ({
      async start() {
        throw new Error("CameraBridge is not available on web");
      },
      async stop() {
        return { ok: true };
      },
      async getStatus() {
        return { bytesTransferred: 0 };
      },
      async addListener() {
        return { remove: async () => {} };
      },
      async removeAllListeners() {
        /* no-op on web */
      },
    }) as unknown as CameraBridgePlugin,
});
