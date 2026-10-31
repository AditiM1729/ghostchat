import type { Address } from 'viem';
export const TEST_TRADE_CHAIN = 91562037;
export const testPaymentTypes = { TestPayment: [
  { name: 'tradeId', type: 'uint256' }, { name: 'termsHash', type: 'bytes32' },
  { name: 'paymentId', type: 'bytes32' }, { name: 'paidAt', type: 'uint256' }, { name: 'validUntil', type: 'uint256' },
] } as const;
export function testPaymentDomain(address: Address, chainId = TEST_TRADE_CHAIN) {
  if (chainId !== TEST_TRADE_CHAIN && chainId !== 31337) throw new Error('Test trades cannot use mainnet.');
  return { name: 'GhostChat Razorpay Test', version: '1', chainId, verifyingContract: address };
}
export function testOrderMessage(address: Address, tradeId: string, timestamp: number) {
  return `GhostChat Razorpay TEST payment\nChain: ${TEST_TRADE_CHAIN}\nEscrow: ${address.toLowerCase()}\nTrade: ${tradeId}\nTimestamp: ${timestamp}\nCreate or verify a mock INR payment for this testnet trade. No real INR or MSTC.`;
}
