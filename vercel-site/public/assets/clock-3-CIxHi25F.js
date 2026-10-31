import{T as c,a6 as r,X as u,Y as g,v as m}from"./index-DG_xLBC_.js";import{g as y}from"./Messenger-EL1ak9Jt.js";async function l(e,t){const{account:s,connector:n,...a}=t;let o;return typeof s=="object"&&s.type==="local"?o=e.getClient():o=await y(e,{account:s,connector:n}),c(o,r,"signMessage")({...a,...s?{account:s}:{}})}function p(e){return{mutationFn(t){return l(e,t)},mutationKey:["signMessage"]}}function $(e={}){const{mutation:t}=e,s=u(e),n=p(s),{mutate:a,mutateAsync:o,...i}=g({...t,...n});return{...i,signMessage:a,signMessageAsync:o}}const f={ClaimAuthorization:[{name:"paymentId",type:"uint256"},{name:"recipient",type:"address"},{name:"deadline",type:"uint256"}]},d=(e,t)=>({name:"GhostPay",version:"1",chainId:e,verifyingContract:t}),h=(e,t,s,n,a)=>`GhostPay claim request
Chain: ${e}
Contract: ${t.toLowerCase()}
Payment: ${s}
Recipient: ${n.toLowerCase()}
Timestamp: ${a}`,q=(e,t,s)=>`GhostPay reject request
Request: ${e}
Chain: ${t}
Contract: ${s.toLowerCase()}`;const k=m("Clock3",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["polyline",{points:"12 6 12 12 16.5 12",key:"1aq6pp"}]]);export{k as C,d as a,q as b,f as c,h as r,$ as u};
