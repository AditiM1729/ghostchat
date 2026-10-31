import type { MatrixSession } from './model';
const key = 'ghostpay.matrix.session.v1';
export function readMatrixSession(persistent: Storage, tab: Storage): MatrixSession | undefined {
  for (const storage of [tab, persistent]) {
    try {
      const s = JSON.parse(storage.getItem(key) || 'null');
      if (s && ['homeserver', 'userId', 'deviceId', 'accessToken'].every(k => typeof s[k] === 'string' && s[k].length)) {
        persistent.setItem(key, JSON.stringify(s)); return s;
      }
    } catch { /* Try the remaining storage without discarding keys. */ }
  }
}
export function saveMatrixSession(s: MatrixSession) {
  localStorage.setItem(key, JSON.stringify(s)); sessionStorage.setItem(key, JSON.stringify(s));
}
export function removeMatrixSession() { localStorage.removeItem(key); sessionStorage.removeItem(key); }
