import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { profileApi } from './identity';
import type { GhostProfile } from '../../../shared/identity';
import { matrix } from '../messenger/matrix';
export interface AllocationInput { username: string; amount: string }
export function AllocationPicker({ rows, onChange, disabled, equalSplit = false }: { rows: AllocationInput[]; onChange(rows: AllocationInput[]): void; disabled: boolean; equalSplit?: boolean }) {
  const [search, setSearch] = useState('');
  const [community, setCommunity] = useState(''); const [loadingMembers, setLoadingMembers] = useState(false); const [memberError, setMemberError] = useState('');
  const communities = matrix.snapshot().rooms.filter(r => r.kind === 'community');
  const known = [...new Set(matrix.snapshot().rooms.flatMap(r => r.members.map(m => m.name.replace(/^@/, ''))).filter(n => /^[a-z][a-z0-9_]{2,23}$/.test(n)))];
  const query = useQuery<GhostProfile[]>({ queryKey: ['allocation-people', search, known.join(',')], queryFn: () => search.length >= 2 ? profileApi(`/search/${search}`) : profileApi('/resolve', { usernames: known.slice(0, 100) }), enabled: search.length >= 2 || known.length > 0, retry: false });
  const names = [...new Set([...rows.map(r => r.username), ...(query.data || []).map(p => p.username)])];
  function selectNames(values: string[]) {
    const selected = [...new Set([...rows.map(r => r.username), ...values])];
    if (selected.length > 100) throw new Error('This contract supports at most 100 recipients per pool.');
    onChange(selected.map(username => rows.find(r => r.username === username) || { username, amount: '' }));
  }
  async function selectCommunity() {
    setLoadingMembers(true); setMemberError('');
    try {
      const room = matrix.client?.getRoom(community); if (!room) throw new Error('Select a connected community first.');
      await room.loadMembersIfNeeded();
      const members = room.getMembers().filter(m => ['join', 'invite'].includes(m.membership || ''));
      if (members.length > 100) throw new Error('This community has more than 100 members. Fund it in separate pools.');
      const profiles: GhostProfile[] = [];
      for (let i = 0; i < members.length; i += 10) {
        const batch = await Promise.all(members.slice(i, i + 10).map(async member => {
          const match = /^@w_([a-f0-9]{40}):/i.exec(member.userId);
          if (!match) throw new Error('A member has no wallet-linked GhostChat account. Select registered recipients individually.');
          const profile = await profileApi(`/address/0x${match[1]}`) as GhostProfile | null;
          if (!profile) throw new Error('A community member has not registered a payment username. No members were added.');
          return profile;
        })); profiles.push(...batch);
      }
      selectNames(profiles.map(p => p.username));
    } catch (e) { setMemberError((e as Error).message); } finally { setLoadingMembers(false); }
  }
  return <fieldset className="gp-allocation-picker" disabled={disabled || loadingMembers}><legend>Eligible people & amounts</legend>{communities.length>0&&<><label htmlFor="allocation-community">Choose a community</label><select id="allocation-community" value={community} onChange={e=>setCommunity(e.target.value)}><option value="">Choose community</option>{communities.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><button type="button" className="ms-button ms-secondary" disabled={!community||loadingMembers} onClick={()=>{void selectCommunity();}}>Select all community members</button></>}{memberError&&<p role="alert">{memberError}</p>}<label htmlFor="allocation-search">Find an existing username</label><input id="allocation-search" value={search} onChange={e => setSearch(e.target.value.toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '').slice(0, 24))} placeholder="Search usernames"/>{query.isFetching && <p role="status">Finding people…</p>}{query.error && <p role="alert">{query.error.message}</p>}{names.length>0&&<div className="gp-trade-actions"><button type="button" className="ms-button ms-secondary" onClick={()=>{try{selectNames(names);}catch(e){setMemberError((e as Error).message);}}}>Select all listed</button><button type="button" className="ms-button ms-secondary" onClick={()=>onChange([])}>Clear selection</button></div>}{names.map(name => { const row = rows.find(r => r.username === name); return <div className="gp-allocation-person" key={name}><label><input type="checkbox" checked={!!row} onChange={e => onChange(e.target.checked ? [...rows, { username: name, amount: '' }] : rows.filter(r => r.username !== name))}/><span>@{name}</span></label>{row && !equalSplit && <input aria-label={`Amount for @${name}`} value={row.amount} placeholder="Amount" inputMode="decimal" onChange={e => onChange(rows.map(r => r.username === name ? { ...r, amount: e.target.value } : r))}/>}</div>; })}{!names.length && !query.isFetching && <p className="ms-fine">Search for a username, then select each recipient and enter their amount.</p>}<p className="ms-fine">Selected: {rows.length} of 100. Each allocation is fixed after funding.</p></fieldset>;
}
