export const utrConfirmationTypes = { UTRConfirmation: [
  { name: 'tradeId', type: 'uint256' }, { name: 'actor', type: 'address' }, { name: 'commitment', type: 'bytes32' },
] } as const;
export function utrDomain(chainId: number, verifyingContract: `0x${string}`) {
  return { name: 'GhostChat Mutual UTR', version: '1', chainId, verifyingContract } as const;
}
export function normalizeUTR(value: unknown) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9 -]{8,48}$/.test(value)) throw new Error('Enter the bank transaction reference using 8–32 letters or digits.');
  const result = value.replace(/[ -]/g, '').toUpperCase();
  if (!/^[A-Z0-9]{8,32}$/.test(result)) throw new Error('Enter the bank transaction reference using 8–32 letters or digits.');
  return result;
}
