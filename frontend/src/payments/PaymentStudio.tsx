import { useEffect, useState } from 'react';
import { Link2, Send, Users } from 'lucide-react';
import { Modal } from '../messenger/Modal';
import type { PaymentReference } from '../messenger/model';
import { NativeComposer } from './NativeComposer';
import { DirectPayment } from './DirectPayment';
import { CampaignComposer } from './CampaignComposer';
import './payments.css';
export function PaymentStudio({onClose,onShare,recipient,group=false,standalone=false,onLockChange}:{onClose():void;onShare?:(body:string,ref:PaymentReference)=>Promise<void>;recipient?:string;group?:boolean;standalone?:boolean;onLockChange?(locked:boolean):void}){
 const [mode,setMode]=useState<'person'|'community'|'link'>(()=>{const requested=new URLSearchParams(window.location.search).get('mode');return group||requested==='community'?'community':requested==='link'?'link':'person';});const [locked,setLocked]=useState(false);
 const [linkAccess,setLinkAccess]=useState<'single'|'pool'>(group?'pool':'single');
 const title=mode==='person'?'A familiar name. A direct payment.':mode==='community'?'A little for everyone.':'A payment, without the address.';
 useEffect(()=>()=>onLockChange?.(false),[onLockChange]);
 const content=<><div className="gp-payment-tabs" role="tablist" aria-label="Payment type">{([{id:'person',name:'Pay a person',Icon:Send},{id:'community',name:'Community fund',Icon:Users},{id:'link',name:'Payment link',Icon:Link2}] as const).map(tab=><button type="button" key={tab.id} role="tab" aria-selected={mode===tab.id} disabled={locked&&mode!==tab.id} onClick={()=>setMode(tab.id)}><tab.Icon size={16}/><span>{tab.name}</span></button>)}</div><div role="tabpanel" aria-label={mode==='person'?'Direct payment':mode==='community'?'Community campaign':'Payment link'}>{mode==='person'?<DirectPayment recipient={recipient} onShare={onShare} onLock={setLocked} onBusyChange={onLockChange}/>:mode==='community'?<CampaignComposer recipient={recipient} onShare={onShare} onLock={setLocked} onBusyChange={onLockChange}/>:<><label className="ms-fine" htmlFor="link-access">Who can claim this payment link?</label><select id="link-access" className="ms-input" value={linkAccess} disabled={locked} onChange={e=>setLinkAccess(e.target.value as 'single'|'pool')}><option value="single">One recipient · your approval required</option><option value="pool">Selected people · approved together upfront</option></select><p className="ms-fine">For a large community, choose selected people. Each allocated wallet can claim once without another approval; the link stays restricted to that list.</p>{linkAccess==='pool'?<CampaignComposer recipient={recipient} onShare={onShare} onLock={setLocked} onBusyChange={onLockChange}/>:<NativeComposer inline onClose={onClose} recipient={recipient} onShare={onShare} onLock={setLocked} onBusyChange={onLockChange}/>}</>}</div></>;
 return standalone?<section className="gp-native-standalone ms-modal-body"><p className="ms-kicker">PEOPLE FIRST. PAYMENTS SECOND.</p><h1>{title}</h1>{content}</section>:<Modal title={title} eyebrow="A PAYMENT, INSIDE THE CONVERSATION" onClose={onClose}>{content}</Modal>;
}
