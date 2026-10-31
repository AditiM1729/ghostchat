import { getAddress, isAddress, zeroAddress } from 'viem';
export interface EncryptedWalletBackup { wallet: string; keystore: string }
export function walletBackupInput(raw: EncryptedWalletBackup): EncryptedWalletBackup {
  if (!raw || !isAddress(raw.wallet || '') || raw.wallet.toLowerCase() === zeroAddress || typeof raw.keystore !== 'string' || raw.keystore.length > 10000) throw new Error('Invalid encrypted wallet backup.');
  const value = JSON.parse(raw.keystore); const data = value.Crypto || value.crypto;
  const hex = (input: unknown, bytes: number) => typeof input === 'string' && new RegExp(`^[a-f0-9]{${bytes * 2}}$`, 'i').test(input);
  if (value.version !== 3 || String(value.address).toLowerCase() !== raw.wallet.slice(2).toLowerCase() || data?.cipher !== 'aes-128-ctr' || data.kdf !== 'scrypt' || !hex(data.cipherparams?.iv, 16) || !hex(data.ciphertext, 32) || !hex(data.mac, 32) || !hex(data.kdfparams?.salt, 32) || data.kdfparams.dklen !== 32 || data.kdfparams.r !== 8 || data.kdfparams.p !== 1 || ![16384,32768,65536,131072].includes(data.kdfparams.n)) throw new Error('Unsupported wallet encryption. Use a GhostChat password-encrypted backup.');
  // Retain only encrypted-keystore fields; never persist arbitrary extra data.
  const keystore = JSON.stringify({ version: 3, address: raw.wallet.slice(2).toLowerCase(), ...(typeof value.id === 'string' && /^[a-f0-9-]{36}$/i.test(value.id) ? { id: value.id } : {}), crypto: { cipher: data.cipher, cipherparams: { iv: data.cipherparams.iv }, ciphertext: data.ciphertext, kdf: data.kdf, kdfparams: { dklen: 32, n: data.kdfparams.n, r: 8, p: 1, salt: data.kdfparams.salt }, mac: data.mac } });
  return { wallet: getAddress(raw.wallet), keystore };
}
