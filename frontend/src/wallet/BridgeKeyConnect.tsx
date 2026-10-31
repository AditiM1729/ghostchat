import { useState } from 'react';
import { useConnect } from 'wagmi';
import { LoaderCircle, Wallet } from 'lucide-react';
import { bridgeKeyConnection, bridgeKeyError } from './bridgekey';

export function BridgeKeyConnect({ disabled = false, onConnected }: { disabled?: boolean; onConnected?(): void }) {
  const { connectors, connectAsync } = useConnect();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function connect() {
    setError(''); setBusy(true);
    try { await connectAsync(bridgeKeyConnection(connectors)); onConnected?.(); }
    catch (error) { setError(bridgeKeyError(error)); }
    finally { setBusy(false); }
  }
  return <>
    <button className="ms-button ms-primary ms-full" disabled={disabled || busy} onClick={() => { void connect(); }}>{busy ? <LoaderCircle className="spin" size={17}/> : <Wallet size={17}/>}Connect BridgeKey</button>
    <p className="ms-fine">Use the official BridgeKey extension on MST Testnet. Review the wallet name and requested permissions before approval. <a href="https://bridgekey.io/" target="_blank" rel="noreferrer">Get BridgeKey</a></p>
    {error && <p className="ms-alert" role="alert">{error}</p>}
  </>;
}
