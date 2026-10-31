import test from 'node:test';
import assert from 'node:assert/strict';
import { onboardingDestination, profileMatchesWallet } from '../src/wallet/onboarding.ts';
test('onboarding preserves internal payment destinations but rejects external and looping destinations', () => {
  assert.equal(onboardingDestination(null), '/chat');
  assert.equal(onboardingDestination('/trade?sandbox=0xabc&trade=7#details'), '/trade?sandbox=0xabc&trade=7#details');
  for (const value of ['https://attacker.example', '//attacker.example', '/\\attacker.example', 'javascript:alert(1)', '/start?next=/start', '/', '/api/account/me', '/unknown']) assert.equal(onboardingDestination(value), '/chat');
});
test('opening the workspace requires a completed profile for the connected wallet', () => {
  const wallet = '0x1111111111111111111111111111111111111111';
  assert.equal(profileMatchesWallet(null, wallet), false);
  assert.equal(profileMatchesWallet({ wallet }, wallet), false);
  assert.equal(profileMatchesWallet({ wallet, username: 'prem' }), false);
  assert.equal(profileMatchesWallet({ wallet, username: 'prem' }, '0x2222222222222222222222222222222222222222'), false);
  assert.equal(profileMatchesWallet({ wallet, username: 'prem' }, wallet), true);
});
