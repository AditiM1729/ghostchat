import { getAddress, isAddress, zeroAddress } from 'viem';
import { username } from './identity.js';
export interface AccountInput { name: string; mobile: string; username: string; wallet: string }
export function accountInput(input: AccountInput): AccountInput {
  const name = typeof input.name === 'string' ? input.name.trim().normalize('NFC') : '';
  const mobile = typeof input.mobile === 'string' ? input.mobile.replace(/[ ()-]/g, '') : '';
  if (name.length < 2 || name.length > 80 || /[\p{Cc}\p{Cf}]/u.test(name)) throw new Error('Enter a name between 2 and 80 characters.');
  if (!/^\+[1-9]\d{7,14}$/.test(mobile)) throw new Error('Enter your mobile number with country code, e.g. +919876543210.');
  if (!isAddress(input.wallet || '') || input.wallet.toLowerCase() === zeroAddress) throw new Error('A valid wallet address is required.');
  return { name, mobile, username: username(input.username), wallet: getAddress(input.wallet) };
}
export function accountMessage(origin: string, wallet: string, handle: string, nonce: string, expires: number, digest: string) {
  return `GhostChat account registration v2\nApplication: ${origin}\nWallet: ${getAddress(wallet)}\nUsername: ${username(handle)}\nProfile digest: ${digest}\nNonce: ${nonce}\nExpires: ${expires}\nLink this profile to my wallet. This does not authorize a payment.`;
}
