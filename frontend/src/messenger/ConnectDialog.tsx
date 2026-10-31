import { useState } from 'react';
import { useAccount } from 'wagmi';
import { ShieldCheck, Wallet } from 'lucide-react';
import { Modal } from './Modal';
import { ensureWalletMatrix } from './matrix';
import { useMessenger } from './MessengerContext';
import { accountApi, type PrivateProfile } from '../wallet/accountApi';
export function ConnectDialog({ onClose }: { onClose(): void }) {
  const chat = useMessenger(); const account = useAccount(); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function connect() {
    setBusy(true); setError('');
    try {
      if (!account.address) throw new Error('Sign in with BridgeKey first.');
      const profile = await accountApi<PrivateProfile | null>('/me');
      if (!profile) throw new Error('Complete your profile before starting chat.');
      await chat.connect(await ensureWalletMatrix(account.address, profile.username)); onClose();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <Modal title="Your conversations. Your wallet." eyebrow="CONNECT MESSAGING" onClose={() => { if (!busy) onClose(); }}>
    <p className="ms-modal-copy">Connect your wallet-linked Matrix account. Your first connection creates it automatically; no separate login or Matrix password is needed.</p>
    <button className="ms-button ms-primary ms-full" disabled={busy} onClick={() => { void connect(); }}><Wallet size={17}/>{busy ? 'Connecting…' : 'Connect messaging'}</button>
    {error && <p className="ms-alert" role="alert">{error}</p>}
    <div className="ms-modal-note"><ShieldCheck size={18}/><span>Your wallet key stays in BridgeKey. Chat encryption and device recovery remain separate.</span></div>
  </Modal>;
}
