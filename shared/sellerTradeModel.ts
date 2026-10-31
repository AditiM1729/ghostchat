import { zeroAddress, type Address } from 'viem';
export type CanonicalTrade = readonly [Address, Address, Address, bigint, bigint, number, boolean];
export function normalizeSellerTrade(value: unknown, simple: boolean): CanonicalTrade {
  if (!simple) return value as CanonicalTrade;
  const t = value as readonly [Address, Address, bigint, bigint, number];
  const state = [0, 1, 2, 3, 5, 6, 4][t[4]];
  if (state === undefined) throw new Error('Unknown seller-confirmed trade state.');
  return [t[0], t[1], zeroAddress, t[2], t[3], state, true];
}
