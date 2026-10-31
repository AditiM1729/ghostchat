import { isAddress, zeroAddress } from 'viem';
import { username, type GhostProfile } from '../../../shared/identity';

/** Resolve public usernames using the same wallet-derived identity as Matrix JWT login. */
export async function resolveChatUsers(inputs: string[], homeserver: string, lookup: (name: string) => Promise<GhostProfile | null>): Promise<string[]> {
  const resolved = new Map<string, Promise<string>>();
  const users = await Promise.all(inputs.map(async input => {
    const value = input.trim();
    if (/^@[^\s:]+:[^\s]+$/.test(value)) return value;
    if (value.includes(':')) throw new Error('Use a GhostChat @username or a complete Matrix ID, such as @name:server.example.');
    const name = username(value);
    if (!resolved.has(name)) resolved.set(name, (async () => {
      const profile = await lookup(name);
      if (!profile || profile.username !== name || !isAddress(profile.wallet) || profile.wallet.toLowerCase() === zeroAddress) throw new Error(`@${name} is not registered. Ask them to finish their GhostChat profile and open chat first.`);
      const server = new URL(homeserver);
      if (server.protocol !== 'https:' || server.username || server.password || server.pathname !== '/' || server.search || server.hash) throw new Error('The GhostChat messaging server is not configured correctly.');
      return `@w_${profile.wallet.slice(2).toLowerCase()}:${server.hostname}`;
    })());
    return resolved.get(name)!;
  }));
  return [...new Set(users)];
}
