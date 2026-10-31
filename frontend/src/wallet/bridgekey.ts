import { MST_CHAIN_ID } from '../../../shared/network';

// Wallet names are self-reported discovery metadata, not an authenticity check.
// Never choose the first external connector when the user requested BridgeKey.
export function isBridgeKey(connector: { id: string; name: string }) { return connector.id !== 'ghostpay-local' && /^bridgekey(?:wallet)?$/i.test(connector.name.replace(/[\s_-]/g, '')); }
export function bridgeKeyConnection<T extends { id: string; name: string }>(connectors: readonly T[]) {
  const matches = connectors.filter(isBridgeKey);
  if (matches.length !== 1) throw new Error(matches.length ? 'Multiple BridgeKey connections were found. Disable duplicate wallet extensions and reload.' : 'BridgeKey was not detected. Install and unlock its official extension, then reload. This flow requires BridgeKey to announce a named browser provider; generic providers are not selected automatically.');
  return { connector: matches[0], chainId: MST_CHAIN_ID };
}

export function bridgeKeyError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Could not connect BridgeKey.';
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
  if (code === 4001 || /user rejected|user denied|rejected the request/i.test(message)) return 'Connection cancelled. You can try again when ready.';
  return message.slice(0, 420);
}
