import { useSyncExternalStore } from 'react';
import { Modal } from '../messenger/Modal';
import { answerEmbeddedApproval, embeddedWalletSnapshot, subscribeEmbeddedWallet } from './embeddedWallet';
export function EmbeddedApproval() {
  const { approval } = useSyncExternalStore(subscribeEmbeddedWallet, embeddedWalletSnapshot);
  if (!approval) return null;
  return <Modal title={approval.title} eyebrow="YOUR GHOSTCHAT WALLET" onClose={() => answerEmbeddedApproval(false)} wide>
    <p className="ms-modal-copy">Review the exact details before approving. A signature can authorize access to funds.</p>
    <dl className="gw-approval-details">{approval.rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 180, overflow: 'auto', margin: 0 }}>{value}</pre></dd></div>)}</dl>
    <div className="ms-inline-actions"><button className="ms-button ms-secondary" onClick={() => answerEmbeddedApproval(false)}>Cancel</button><button className="ms-button ms-primary" onClick={() => answerEmbeddedApproval(true)}>Approve</button></div>
  </Modal>;
}
