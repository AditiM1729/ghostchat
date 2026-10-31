import { useEffect, useRef, useState } from 'react';
import { Camera, UserRound } from 'lucide-react';
import { matrix } from './matrix';

export function ProfileImage({ source }: { source?: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    setUrl(''); if (!source) return;
    const controller = new AbortController(); let objectUrl = '';
    void matrix.avatarBlob(source, controller.signal).then(blob => {
      if (!controller.signal.aborted) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); }
    }).catch(() => {});
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [source]);
  return url ? <img src={url} alt="" className="ms-profile-image"/> : null;
}

export function ProfilePhotoEditor() {
  const file = useRef<HTMLInputElement>(null);
  const [avatar, setAvatar] = useState(matrix.avatar);
  const [status, setStatus] = useState('');
  useEffect(() => matrix.subscribe(() => setAvatar(matrix.avatar)), []);
  const [busy, setBusy] = useState(false);
  async function update(photo: File | null) {
    setBusy(true);
    try { await matrix.setProfilePhoto(photo); setStatus(photo ? 'Profile photo updated.' : 'Profile photo removed.'); }
    catch (error) { setStatus((error as Error).message); }
    finally { setBusy(false); if (file.current) file.current.value = ''; }
  }
  return <div className="ms-profile-photo-editor"><span className="ms-profile-photo-preview"><UserRound size={30}/><ProfileImage source={avatar}/></span><div><button className="ms-text" disabled={busy || !matrix.client} onClick={() => file.current?.click()}><Camera size={15}/>{busy ? 'Updating photo…' : 'Change profile photo'}</button>{avatar && <button className="ms-text" disabled={busy} onClick={() => { void update(null); }}>Remove photo</button>}<small>Visible to other Matrix users.</small>{status && <small role="status">{status}</small>}</div><input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={event => { const photo = event.target.files?.[0]; if (photo) void update(photo); }}/></div>;
}
