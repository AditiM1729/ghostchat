export type PaymentSnapshot = { scope: string; ready: boolean; details?: { upiId: string; qr: string }; error?: string };
export function mergePaymentSnapshot(previous: PaymentSnapshot | undefined, scope: string, update: Partial<Omit<PaymentSnapshot, 'scope'>>) {
  return { ...(previous?.scope === scope ? previous : { scope, ready: false }), ...update, scope };
}
export function paymentForScope(value: PaymentSnapshot | undefined, scope: string) {
  return value?.scope === scope ? value : undefined;
}
