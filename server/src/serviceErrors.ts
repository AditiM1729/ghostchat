const messages = {
  matrix_not_configured: 'Chat sign-in is not connected yet. Your wallet and profile are saved. The server administrator needs to finish Matrix wallet-login setup.',
  matrix_invalid_configuration: 'The messaging server settings need attention. Your wallet and profile are saved. Ask the administrator to check the Matrix login configuration.',
  escrow_not_configured: 'Payments need an MST Testnet contract deployment. Open the setup screen before creating a payment.',
} as const;

// Only these deliberately public messages may cross the generic 5xx error boundary.
export class ServiceUnavailable extends Error {
  readonly status = 503;
  constructor(readonly code: keyof typeof messages) { super(messages[code]); }
}
