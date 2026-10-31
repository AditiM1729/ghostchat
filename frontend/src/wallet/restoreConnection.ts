import { isBridgeKey } from './bridgekey';
export async function waitForBridgeKey<T extends { id: string; name: string }>(options: {
  connectors(): readonly T[];
  connected(): boolean;
  restore(connector: T): Promise<void>;
  pause(): Promise<void>;
  attempts?: number;
}) {
  for (let i = 0; i < (options.attempts ?? 25); i++) {
    if (options.connected()) return;
    const matches = options.connectors().filter(isBridgeKey);
    if (matches.length > 1) return;
    if (matches.length === 1) {
      await options.restore(matches[0]).catch(() => {});
      if (options.connected()) return;
    }
    await options.pause();
  }
}
