import { it } from 'node:test';
import assert from 'node:assert/strict';
import { splitPool } from '../../shared/allocationPlan';
it('allocates an entire pool across 70 recipients without losing units', () => {
  const total = 100n * 10n ** 18n; const parts = splitPool(total, 70);
  assert.equal(parts.length, 70); assert.equal(parts.reduce((a,b) => a+b, 0n), total);
  assert.ok(parts.every(value => value > 0n)); assert.ok(parts[0] - parts[69] <= 1n);
});
it('rejects zero shares and recipient counts beyond contract limits', () => {
  assert.throws(() => splitPool(2n, 3), /too small/);
  assert.throws(() => splitPool(1000n, 101), /1–100/);
});
