export const project = {
  name: 'GhostChat',
  founder: 'Prem Bharne',
  email: 'prembhrane455@gmail.com',
  repository: 'https://github.com/prembharne/GHostPay',
  audience: 'People and communities who want messaging and payments in one place',
  description: 'Bring Matrix messaging, wallet-linked usernames, MST payments and a P2P test trading flow into one messenger.',
  updated: 'October 29, 2026',
};

export const informationPaths = ['/about', '/demo', '/privacy', '/terms', '/contact'] as const;
export const isInformationPath = (path: string) => informationPaths.some(route => route === path.replace(/\/$/, ''));

export const walkthrough = [
  { title: 'Create your account', role: 'You', text: 'Connect BridgeKey, sign a wallet ownership message, then choose your name, mobile number and unique @username.', detail: 'Your username links to your wallet for payment lookup. Your mobile number is private and collecting it does not verify ownership. Keep your BridgeKey recovery phrase private.', to: '/start', action: 'Get started' },
  { title: 'Connect your conversations', role: 'You and your contacts', text: 'Your wallet-linked Matrix account is created automatically on first connection when the server is configured. Your chat list, conversation and payment tools share one workspace.', detail: 'Live messaging requires a configured Matrix homeserver. Encryption and recovery use Matrix’s own setup; a local preview is not a delivered or encrypted conversation.', to: '/chat', action: 'Open the messenger' },
  { title: 'Send a test payment', role: 'Sender and recipient', text: 'Look up a registered @username, review the exact wallet and send testnet tokens. Payment links and community allocations are also available from the payment tools.', detail: 'Review every wallet approval. Direct transfers have no escrow refund; payment links and community allocations have their own claim and expiry rules.', to: '/create', action: 'Explore payments' },
  { title: 'Try P2P trading', role: 'Seller and buyer', text: 'The seller locks faucet tMSTC for a named buyer. The buyer accepts the exact terms and makes a mock INR payment through Razorpay Test Mode.', detail: 'Test credentials must be configured. No real INR reaches a seller’s bank. Both wallets need testnet gas, and the mock INR amount is not a market-price quote.', to: '/trade', action: 'Explore the P2P demo' },
  { title: 'Verify and release', role: 'Buyer', text: 'After the server checks a captured test payment, the buyer approves a transaction that releases the escrowed tMSTC to the agreed wallet. Track the confirmed result in the P2P popup.', detail: 'This uses a trusted test-payment attestation, not a ZK proof. An accepted P2P trade has no automatic seller timeout refund; the buyer can intentionally return the allocation.', to: '/trade', action: 'Open test trading' },
] as const;
