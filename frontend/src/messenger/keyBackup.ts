const encode = (bytes: Uint8Array) => btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''));
const decode = (text: string) => Uint8Array.from(atob(text), c => c.charCodeAt(0));
async function key(password: string, salt: Uint8Array<ArrayBuffer>) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function encryptChatKeys(plain: string, password: string) {
  if (password.length < 12) throw new Error('Use a backup password of at least 12 characters.');
  const salt = crypto.getRandomValues(new Uint8Array(16)); const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(password, salt), new TextEncoder().encode(plain));
  return JSON.stringify({ format: 'ghostchat-room-keys', version: 1, salt: encode(salt), iv: encode(iv), ciphertext: encode(new Uint8Array(ciphertext)) });
}
export async function decryptChatKeys(file: string, password: string) {
  if (file.length > 15000000) throw new Error('Backup file is too large.');
  try {
    const data = JSON.parse(file);
    if (data.format !== 'ghostchat-room-keys' || data.version !== 1) throw new Error();
    const salt = decode(data.salt); const iv = decode(data.iv);
    if (salt.length !== 16 || iv.length !== 12) throw new Error();
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await key(password, salt), decode(data.ciphertext));
    return new TextDecoder().decode(plain);
  } catch { throw new Error('Could not unlock this backup. Check the file and backup password.'); }
}
