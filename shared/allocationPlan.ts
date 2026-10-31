export function splitPool(total: bigint, count: number): bigint[] {
  if (!Number.isSafeInteger(count) || count < 1 || count > 100) throw new Error('Select 1–100 recipients.');
  if (total < BigInt(count)) throw new Error('The pool is too small to give every recipient a positive allocation.');
  const base = total / BigInt(count); const remainder = total % BigInt(count);
  return Array.from({ length: count }, (_, i) => base + (BigInt(i) < remainder ? 1n : 0n));
}
