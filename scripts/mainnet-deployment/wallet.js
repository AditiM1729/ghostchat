import { BrowserProvider, ContractFactory, formatEther } from 'ethers';
const $=id=>document.getElementById(id), config=await(await fetch('/config')).json();
const providers=new Map(); let selected, signer, txRequest, busy=false, receipt;
const pendingKey='ghostchat.mainnet-suite.pending.v1';
if(config.recorded){receipt=config.recorded;$('result').textContent=JSON.stringify(receipt,null,2);$('download').disabled=false;}
window.addEventListener('eip6963:announceProvider',event=>{const d=event.detail; if(/^bridgekey(?:wallet)?$/i.test(d.info.name.replace(/[\s_-]/g,''))) providers.set(d.info.uuid,d.provider);});
window.dispatchEvent(new Event('eip6963:requestProvider'));
let pending=localStorage.getItem(pendingKey); if(pending) { $('hash').value=pending; $('status').textContent='A deployment may already be pending. Use Verify and update README before deploying again.'; }
function state(){ $('deploy').disabled=busy||!!receipt||!signer||!$('ack').checked||!!localStorage.getItem(pendingKey); $('connect').disabled=busy; $('recover').disabled=busy; }
function fail(e){$('status').textContent=e.shortMessage||e.message||String(e);}
async function checkWallet(){ if(await selected.request({method:'eth_chainId'})!=='0x1226') throw Error('Switch BridgeKey to MST Mainnet (4646), then connect again.'); const accounts=await selected.request({method:'eth_accounts'}); if(accounts[0]?.toLowerCase()!==(await signer.getAddress()).toLowerCase()) throw Error('Wallet account changed. Connect again to review the estimate.'); }
$('ack').onchange=state;
$('connect').onclick=async()=>{busy=true;state();try{
  signer=undefined; window.dispatchEvent(new Event('eip6963:requestProvider')); await new Promise(r=>setTimeout(r,400));
  if(providers.size!==1) throw Error('Install and unlock exactly one official BridgeKey extension. Generic wallet providers are not selected.');
  selected=[...providers.values()][0]; await selected.request({method:'eth_requestAccounts'});
  try {await selected.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x1226'}]});} catch(e){if(e.code!==4902)throw e; await selected.request({method:'wallet_addEthereumChain',params:[{chainId:'0x1226',chainName:'MST Mainnet',nativeCurrency:{name:'MST Native Coin',symbol:'MSTC',decimals:18},rpcUrls:['https://mariorpc.mstblockchain.com'],blockExplorerUrls:['https://mstscan.com']}]});}
  const provider=new BrowserProvider(selected); signer=await provider.getSigner(); await checkWallet();
  const factory=new ContractFactory(config.abi,config.bytecode,signer); txRequest=await factory.getDeployTransaction();
  const estimate=await signer.estimateGas({...txRequest,value:0n}); const fees=await provider.getFeeData(); const price=fees.maxFeePerGas||fees.gasPrice; if(!price)throw Error('No gas price returned.');
  const balance=await provider.getBalance(await signer.getAddress()); const max=estimate*120n/100n*price;
  $('estimate').textContent=`Account: ${await signer.getAddress()}\nNetwork: MST Mainnet, 4646\nGas estimate: ${estimate}\nEstimated gas ceiling with 20% margin: ${formatEther(max)} MSTC\nBalance: ${formatEther(balance)} MSTC\nTransfer value: 0 MSTC`;
  if(balance<max) {signer=undefined;throw Error('Insufficient MSTC for the gas estimate.');} $('status').textContent='Review the estimate and checkbox before deployment.';
}catch(e){signer=undefined;fail(e);}finally{busy=false;state();}};
async function record(hash){const r=await fetch('/record',{method:'POST',headers:{'Content-Type':'application/json','X-Deployment-Token':config.token},body:JSON.stringify({hash})});const data=await r.json();if(!r.ok)throw Error(data.error);receipt=data;$('result').textContent=JSON.stringify(data,null,2);$('download').disabled=false;localStorage.removeItem(pendingKey);$('status').textContent='Verified. Local README.md and deployments/mst-mainnet.json now contain the Mainnet addresses. No Git commit or push was made.';}
$('deploy').onclick=async()=>{busy=true;state();try{await checkWallet(); if(localStorage.getItem(pendingKey))throw Error('Recover the existing transaction first.');
  $('status').textContent='Review and confirm the single deployment transaction in BridgeKey.';
  const estimate=await signer.estimateGas({...txRequest,value:0n}); const tx=await signer.sendTransaction({...txRequest,value:0n,gasLimit:estimate*120n/100n});
  localStorage.setItem(pendingKey,tx.hash);$('hash').value=tx.hash;$('status').textContent=`Submitted: ${tx.hash}\nWaiting for two confirmations. Keep this tool running.`;
  const mined=await tx.wait(2); if(mined.status!==1)throw Error('Deployment reverted.');await record(tx.hash);
}catch(e){fail(e);}finally{busy=false;state();}};
$('recover').onclick=async()=>{busy=true;state();try{await record($('hash').value.trim());}catch(e){fail(e);}finally{busy=false;state();}};
$('download').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(receipt,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='ghostchat-mst-mainnet.json';a.click();URL.revokeObjectURL(url);};
state();
