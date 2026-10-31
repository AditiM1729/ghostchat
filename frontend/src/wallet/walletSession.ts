export interface WalletSession { token: string; wallet: string; expiresAt: number }
let current: WalletSession | undefined; let timer: ReturnType<typeof setTimeout>;
const storageKey = 'ghostchat.wallet.session.v1';
let restored = false;
export function validWalletSession(value: unknown): value is WalletSession {
  const s = value as WalletSession | undefined;
  return !!s && typeof s.token === 'string' && /^[a-f0-9]{64}$/.test(s.token) && typeof s.wallet === 'string' && /^0x[a-f0-9]{40}$/i.test(s.wallet) && Number.isSafeInteger(s.expiresAt) && s.expiresAt * 1000 > Date.now();
}
const listeners = new Set<() => void>();
export const walletSession = () => {
  if (!restored) {
    restored = true;
    try { const value = JSON.parse(localStorage.getItem(storageKey) || 'null'); if (validWalletSession(value)) { current = value; timer = setTimeout(() => setWalletSession(undefined), value.expiresAt * 1000 - Date.now()); } else localStorage.removeItem(storageKey); } catch { /* Storage unavailable: retain in-memory sign-in. */ }
  }
  return current;
};
export const subscribeWalletSession = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export function setWalletSession(session?: WalletSession) {
  restored = true; clearTimeout(timer); current = session && validWalletSession(session) ? session : undefined;
  try { if (current) localStorage.setItem(storageKey, JSON.stringify(current)); else localStorage.removeItem(storageKey); } catch { /* Sign-in remains available for this page. */ }
  listeners.forEach(fn => fn());
  if (current) timer = setTimeout(() => setWalletSession(undefined), Math.max(0, current.expiresAt * 1000 - Date.now()));
}
export async function publicWalletApi(path: string, body: unknown) {
  const r = await fetch(`/api/account${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(20000) });
  const value = await r.json(); if (!r.ok) throw new Error(value.error || 'Wallet login failed.'); return value;
}
