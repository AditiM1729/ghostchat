import { keccak256, stringToHex } from 'viem';
import type { ICreateRoomOpts } from 'matrix-js-sdk/lib/@types/requests';
import { ClientEvent, EventType, IndexedDBStore, MatrixEventEvent, MsgType, NotificationCountType, Preset, RelationType, RoomEvent, RoomMemberEvent, SyncState, createClient, type MatrixClient, type MatrixEvent } from 'matrix-js-sdk';
import type { RoomMessageEventContent } from 'matrix-js-sdk/lib/@types/events';
import { encryptAttachment, decryptAttachment } from 'matrix-encrypt-attachment';
import { accountApi } from '../wallet/accountApi';
import { readMatrixSession, saveMatrixSession, removeMatrixSession } from './sessionStore';
import { announcementPermissions, completeCommunityGroups, communityNameKey, CommunityCreationQueue, createOrRecoverRoom, type CommunityGroups } from './communitySetup';
import { accountLabel, messageStatus, unreadAfterMarker } from './messageStatus';
import { PAYMENT_CONTENT_KEY, initials, paymentFromMessage, validateHomeserver, type ChatMessage, type ChatRoom, type MatrixSession, type MessengerSnapshot, type PaymentReference } from './model';

const serverKey = 'ghostpay.matrix.homeserver.v1';
export function configuredServer(): string { try { return sessionStorage.getItem(serverKey) || import.meta.env.VITE_MATRIX_HOMESERVER || ''; } catch { return import.meta.env.VITE_MATRIX_HOMESERVER || ''; } }
export function rememberedSession(): MatrixSession | undefined {
  try { const value = readMatrixSession(localStorage, sessionStorage); return value && validateHomeserver(value.homeserver) ? value : undefined; } catch { return; }
}
export function forgetSession() { removeMatrixSession(); }
export async function ensureWalletMatrix(wallet: string, username: string) {
  const ticket = await accountApi<{ homeserver: string; userId: string; token: string }>('/matrix-ticket', {});
  const homeserver = validateHomeserver(ticket.homeserver);
  const expected = `@w_${wallet.slice(2).toLowerCase()}:${new URL(homeserver).hostname}`;
  if (ticket.userId !== expected) throw new Error('Matrix account does not match the connected wallet.');
  const previous = rememberedSession();
  if (previous?.userId === expected && previous.homeserver === homeserver) {
    try { const c = createClient({ baseUrl: homeserver, accessToken: previous.accessToken }); const who = await c.whoami(); if (who.user_id === expected) return previous; }
    catch (error) {
      const e = error as { errcode?: string; httpStatus?: number };
      if (e.errcode !== 'M_UNKNOWN_TOKEN' && e.httpStatus !== 401) throw new Error('Cannot reach your existing chat device. Reconnect and retry; your saved keys have been preserved.');
    }
  }
  await matrix.stop();
  const client = createClient({ baseUrl: homeserver });
  const login = await client.login('org.matrix.login.jwt', { token: ticket.token, initial_device_display_name: 'GhostChat BridgeKey' });
  if (login.user_id !== expected || !login.access_token || !login.device_id) throw new Error('Homeserver returned a different wallet account.');
  const session: MatrixSession = { homeserver, userId: login.user_id, deviceId: login.device_id, accessToken: login.access_token };
  sessionStorage.setItem(serverKey, homeserver); saveMatrixSession(session);
  try { await createClient({ baseUrl: homeserver, accessToken: session.accessToken, userId: session.userId }).setDisplayName(`@${username}`); } catch { /* Display name is optional; private profile name is never published here. */ }
  return session;
}
export async function discoverServer(input: string) {
  const homeserver = validateHomeserver(input);
  const response = await fetch(`${homeserver}/_matrix/client/v3/login`, { signal: AbortSignal.timeout(12000), credentials: 'omit', redirect: 'error' });
  if (!response.ok) throw new Error('Could not discover login options. Check the Matrix server URL.');
  const data = await response.json() as { flows?: { type: string; identity_providers?: { id: string; name: string; brand?: string }[] }[] };
  sessionStorage.setItem(serverKey, homeserver);
  return { homeserver, password: !!data.flows?.some(f => f.type === 'm.login.password'), sso: data.flows?.find(f => f.type === 'm.login.sso') };
}
export function startSso(homeserver: string, idpId?: string) {
  sessionStorage.setItem(serverKey, validateHomeserver(homeserver));
  const redirect = `${window.location.origin}/chat`;
  window.location.assign(createClient({ baseUrl: homeserver }).getSsoLoginUrl(redirect, 'sso', idpId));
}
export async function passwordLogin(homeserver: string, user: string, password: string) {
  const client = createClient({ baseUrl: validateHomeserver(homeserver) });
  const login = await client.login('m.login.password', { identifier: { type: 'm.id.user', user }, password, initial_device_display_name: 'GhostPay Web' });
  const session: MatrixSession = { homeserver, userId: login.user_id, deviceId: login.device_id, accessToken: login.access_token };
  saveMatrixSession(session); return session;
}
export async function consumeSsoToken(): Promise<MatrixSession | undefined> {
  const url = new URL(window.location.href); const token = url.searchParams.get('loginToken'); if (!token) return;
  url.searchParams.delete('loginToken'); window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  const homeserver = configuredServer(); if (!homeserver) throw new Error('Login could not be completed. Return to the connection screen.');
  const client = createClient({ baseUrl: validateHomeserver(homeserver) });
  const login = await client.login('m.login.token', { token, initial_device_display_name: 'GhostPay Web' });
  const session: MatrixSession = { homeserver, userId: login.user_id, deviceId: login.device_id, accessToken: login.access_token };
  saveMatrixSession(session); return session;
}

class MatrixService {
  client?: MatrixClient;
  state = 'disconnected'; error = ''; private listeners = new Set<() => void>();
  private opening?: Promise<void>; private identity = ''; private releaseLock?: () => void; private generation = 0;
  private updateTimer?: ReturnType<typeof setTimeout>;
  private readPositions = new Map<string, string>();
  private reading = new Map<string, Promise<void>>();
  private profileAvatar?: string;
  get avatar() { return this.profileAvatar; }
  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private notify = () => { clearTimeout(this.updateTimer); this.updateTimer = setTimeout(() => this.listeners.forEach(fn => fn()), 40); };
  async start(session: MatrixSession) {
    const identity = `${session.homeserver}/${session.userId}/${session.deviceId}`;
    if (this.identity === identity && this.opening) return this.opening;
    if (this.client) await this.stop(false);
    const generation = ++this.generation; let startingClient: MatrixClient | undefined; let release: (() => void) | undefined;
    const ensureCurrent = () => { if (generation !== this.generation) throw new Error('Connection was cancelled.'); };
    this.identity = identity; this.state = 'connecting'; this.error = ''; this.notify();
    this.opening = new Promise<void>((resolve, reject) => {
      const connect = async () => {
        try {
          ensureCurrent();
          const store = new IndexedDBStore({ indexedDB: window.indexedDB, localStorage: window.localStorage, dbName: `ghostpay.events.${session.userId}.${session.deviceId}` });
          const client = createClient({ baseUrl: validateHomeserver(session.homeserver), accessToken: session.accessToken, userId: session.userId, deviceId: session.deviceId, store });
          this.client = client; startingClient = client;
          await store.startup(); ensureCurrent();
          await client.whoami(); ensureCurrent();
          await client.initRustCrypto({ useIndexedDB: true, cryptoDatabasePrefix: `ghostpay.crypto.${session.userId}.${session.deviceId}` }); ensureCurrent();
          client.on(ClientEvent.Sync, state => { this.state = state === SyncState.Prepared || state === SyncState.Syncing ? 'connected' : state === SyncState.Error ? 'reconnecting' : 'connecting'; this.notify(); });
          client.on(RoomEvent.Timeline, this.notify); client.on(RoomEvent.Name, this.notify); client.on(RoomEvent.MyMembership, this.notify);
          client.on(MatrixEventEvent.Decrypted, this.notify); client.on(RoomMemberEvent.Typing, this.notify);
          client.on(ClientEvent.Room, this.notify); client.on(RoomEvent.Receipt, this.notify); client.on(RoomEvent.LocalEchoUpdated, this.notify);
          client.on(RoomMemberEvent.Name, this.notify); client.on(RoomMemberEvent.Membership, this.notify); client.on(ClientEvent.Event, this.notify);
          void client.getProfileInfo(session.userId).then(profile => { if (generation === this.generation) { this.profileAvatar = profile.avatar_url; this.notify(); } }).catch(() => {});
          await client.startClient({ initialSyncLimit: 40, lazyLoadMembers: true }); ensureCurrent(); resolve();
        } catch (error) { startingClient?.stopClient(); startingClient?.removeAllListeners(); release?.(); if (generation === this.generation) { this.error = error instanceof Error ? error.message : 'Matrix connection failed.'; this.state = 'error'; this.notify(); } reject(error); }
      };
      if (!navigator.locks) { reject(new Error('This browser cannot safely lock encrypted device storage. Use a current browser.')); return; }
      void navigator.locks.request(`ghostpay.matrix.${identity}`, { ifAvailable: true }, async lock => {
        if (!lock) { this.state = 'error'; this.error = 'This messaging device is open in another tab. Close it there before connecting here.'; this.notify(); reject(new Error(this.error)); return; }
        if (generation !== this.generation) { reject(new Error('Connection was cancelled.')); return; }
        const released = new Promise<void>(r => { this.releaseLock = r; release = r; });
        await connect(); if (this.state !== 'error') await released;
      }).catch(reject);
    });
    return this.opening;
  }
  async stop(logout = true) {
    ++this.generation; const client = this.client;
    client?.stopClient(); client?.removeAllListeners(); this.client = undefined; this.opening = undefined; this.identity = ''; this.state = 'disconnected'; this.error = ''; this.releaseLock?.(); this.releaseLock = undefined; this.notify();
    this.readPositions.clear(); this.reading.clear(); this.profileAvatar = undefined;
    if (logout) { forgetSession(); try { await client?.logout(); } catch { /* The local session is still removed. */ } }
  }
  snapshot(): MessengerSnapshot {
    const client = this.client; if (!client) return { rooms: [], messages: {} };
    const messages: Record<string, ChatMessage[]> = {};
    const rooms = client.getRooms().filter(r => ['join', 'invite'].includes(r.getMyMembership()) && (r.getMyMembership() === 'invite' || !!r.currentState.getStateEvents(EventType.RoomCreate, '')) && !(r.getMyMembership() === 'join' && !client.isRoomEncrypted(r.roomId) && !r.getType() && !r.currentState.getStateEvents(EventType.RoomName, '') && r.getJoinedMembers().length <= 1 && !r.getLiveTimeline().getEvents().some(e => e.getType() === EventType.RoomMessage || e.isDecryptionFailure()))).map(room => {
      const members = room.getJoinedMembers().map(member => ({ id: member.userId, name: accountLabel(member.name) }));
      const other = members.filter(member => member.id !== client.getUserId());
      const events = room.getLiveTimeline().getEvents().filter(event => event.getType() === EventType.RoomMessage || event.isDecryptionFailure());
      messages[room.roomId] = events.filter(event => !event.isRedacted() && !event.getContent()['m.relates_to']?.rel_type).map(event => this.message(event));
      const last = messages[room.roomId].at(-1);
      const space = room.getType() === 'm.space';
      const direct = !space && !room.currentState.getStateEvents(EventType.RoomName, '') && members.length <= 2 && room.getMyMembership() !== 'invite';
      const parent = room.currentState.getStateEvents(EventType.SpaceParent).find(event => event.getContent().canonical)?.getStateKey();
      const name = accountLabel(room.name || other[0]?.name || 'New conversation');
      const marker = this.readPositions.get(room.roomId);
      const latestIncoming = events.filter(event => event.getSender() !== client.getUserId() && !event.isRedacted()).at(-1);
      const syncedRead = latestIncoming?.getId() && room.hasUserReadEvent(client.getUserId()!, latestIncoming.getId()!);
      const unread = syncedRead ? 0 : unreadAfterMarker(events.map(event => ({ id: event.getId() || '', sender: event.getSender() || '', redacted: event.isRedacted() })), marker, client.getUserId()!, room.getUnreadNotificationCount(NotificationCountType.Total));
      const avatar = direct ? room.getMember(other[0]?.id || '')?.getMxcAvatarUrl() : room.currentState.getStateEvents(EventType.RoomAvatar, '')?.getContent().url;
      return { id: room.roomId, name, subtitle: room.getMyMembership() === 'invite' ? 'Invitation · review before joining' : direct ? other[0]?.id || 'Private conversation' : `${members.length} members`,
        initials: initials(name), avatar: typeof avatar === 'string' && avatar.startsWith('mxc://') ? avatar : undefined, kind: space ? 'community' : direct ? 'direct' : 'group', communityId: parent, unread, lastAt: last?.timestamp || 0,
        members, canManage: room.currentState.maySendStateEvent(EventType.RoomName, client.getUserId()!), canSend: room.currentState.maySendEvent(EventType.RoomMessage, client.getUserId()!), encrypted: client.isRoomEncrypted(room.roomId), preview: last?.payment ? 'Payment link' : last?.body || 'Start a conversation', invited: room.getMyMembership() === 'invite',
      } satisfies ChatRoom;
    }).sort((a, b) => b.lastAt - a.lastAt);
    return { rooms, messages, selfAvatar: this.profileAvatar };
  }
  private message(event: MatrixEvent): ChatMessage {
    const content = event.getContent(); const room = this.client?.getRoom(event.getRoomId() || '');
    const replyId = content['m.relates_to']?.['m.in_reply_to']?.event_id; const replied = typeof replyId === 'string' ? room?.findEventById(replyId) : undefined;
    const attachment = [MsgType.File, MsgType.Image, MsgType.Audio, MsgType.Video].includes(content.msgtype as MsgType) ? {
      name: String(content.body || 'Attachment'), type: String(content.info?.mimetype || 'application/octet-stream'), size: Number(content.info?.size || 0),
      url: typeof content.url === 'string' ? content.url : undefined, encrypted: content.file as Record<string, unknown> | undefined,
    } : undefined;
    return { id: event.getId() || event.getTxnId() || crypto.randomUUID(), roomId: event.getRoomId() || '', sender: event.getSender() || '', senderName: accountLabel(room?.getMember(event.getSender() || '')?.name || event.getSender() || 'Unknown'),
      body: event.isDecryptionFailure() ? 'Unable to decrypt this message on this device. Verify your device or restore your keys.' : String(content.body || ''),
      timestamp: event.getTs(), own: event.getSender() === this.client?.getUserId(), state: messageStatus(event.status, !!room && !!event.getId() && room.getJoinedMembers().some(member => member.userId !== this.client?.getUserId() && room.hasUserReadEvent(member.userId, event.getId()!))),
      payment: !attachment && !event.isDecryptionFailure() ? paymentFromMessage(content[PAYMENT_CONTENT_KEY], content.body, window.location.origin) : undefined, attachment,
      ...(typeof replyId === 'string' ? { reply: { id: replyId, body: String(replied?.getContent().body || 'Earlier message'), sender: room?.getMember(replied?.getSender() || '')?.name || 'Reply' } } : {}),
    };
  }
  async send(roomId: string, body: string, payment?: PaymentReference, reply?: ChatMessage) {
    const client = this.require(); if (!client.isRoomEncrypted(roomId)) throw new Error('GhostPay only sends to encrypted rooms. Create an encrypted conversation first.');
    if (!body.trim() || body.length > 16000) throw new Error('Messages must contain 1–16,000 characters.');
    const reference = paymentFromMessage(payment, body, window.location.origin);
    const content = { msgtype: MsgType.Text as const, body, ...(reference ? { [PAYMENT_CONTENT_KEY]: reference } : {}), ...(reply ? { 'm.relates_to': { 'm.in_reply_to': { event_id: reply.id } } } : {}) };
    await client.sendMessage(roomId, content); this.notify();
  }
  async createRoom(users: string[], name?: string, communityId?: string, announcements = false, stableAlias?: string) {
    const client = this.require(); if ((!name && users.length !== 1) || users.some(user => !/^@[^\s:]+:[^\s]+$/.test(user))) throw new Error('Enter complete Matrix IDs, such as @name:server.example.');
    const creator = client.getUserId()!;
    if (!name && !communityId) {
      const wanted = new Set([creator, ...users]);
      const existing = client.getRooms().find(room => {
        const members = room.getMembers().filter(member => ['join', 'invite'].includes(member.membership || '')).map(member => member.userId);
        return room.getMyMembership() === 'join' && client.isRoomEncrypted(room.roomId) && !room.getType() && !room.currentState.getStateEvents(EventType.RoomName, '') && members.length === wanted.size && members.every(member => wanted.has(member));
      });
      if (existing) return existing.roomId;
    }
    const response = await this.createRoomOnce({ ...(stableAlias ? { room_alias_name: stableAlias } : {}), preset: Preset.PrivateChat, invite: [...new Set(users)], is_direct: !name,
      ...(name ? { name } : {}), initial_state: [{ type: EventType.RoomEncryption, state_key: '', content: { algorithm: 'm.megolm.v1.aes-sha2' } }],
      ...(announcements ? { power_level_content_override: announcementPermissions } : {}),
    });
    if (communityId) {
      const server = creator.split(':').slice(1).join(':');
      await client.sendStateEvent(communityId, EventType.SpaceChild, { via: [server], suggested: true }, response.room_id);
      await client.sendStateEvent(response.room_id, EventType.SpaceParent, { via: [server], canonical: true }, communityId);
    }
    this.notify(); return response.room_id;
  }
  private communityCreates = new CommunityCreationQueue();
  private roomAlias(namespace: string, value: string) {
    return `gc-${namespace}-${keccak256(stringToHex(value)).slice(2, 42)}`;
  }
  private async createRoomOnce(options: ICreateRoomOpts) {
    const client = this.require(); const creator = client.getUserId()!;
    if (!options.room_alias_name) return client.createRoom(options);
    const server = creator.split(':').slice(1).join(':');
    const expectedType = (options.creation_content as { type?: string } | undefined)?.type;
    return createOrRecoverRoom(() => client.createRoom(options), async () => {
      const resolved = await client.getRoomIdForAlias(`#${options.room_alias_name}:${server}`);
      const state = await client.roomState(resolved.room_id);
      const create = state.find(e => e.type === EventType.RoomCreate);
      if (create?.sender !== creator || create?.content.type !== expectedType) throw new Error('Existing room alias belongs to a different creator or room type.');
      if (!expectedType && state.find(e => e.type === EventType.RoomEncryption)?.content.algorithm !== 'm.megolm.v1.aes-sha2') throw new Error('Existing channel is not encrypted.');
      return { room_id: resolved.room_id };
    });
  }
  async createCommunity(users: string[], name: string) {
    const client = this.require(); if (!name.trim() || name.length > 80 || users.some(user => !/^@[^\s:]+:[^\s]+$/.test(user))) throw new Error('Use a community name and complete Matrix member IDs.');
    const creator = client.getUserId()!; const nameKey = communityNameKey(name);
    return this.communityCreates.run(`${client.getHomeserverUrl()}:${creator}:${nameKey}`, async () => {
      const key = `ghostchat.community.drafts.${client.getHomeserverUrl()}.${creator}`;
      let drafts: Record<string, string> = {}; try { drafts = JSON.parse(localStorage.getItem(key) || '{}'); } catch { /* Recover via deterministic server alias below. */ }
      const existing = client.getRooms().filter(room => room.getType() === 'm.space' && communityNameKey(room.name) === nameKey && room.currentState.getStateEvents(EventType.RoomCreate, '')?.getSender() === creator);
      if (existing.length > 1) throw new Error('Several older communities already have this name. Open Communities and finish setup on the one you want; no new duplicate was created.');
      let spaceId = drafts[nameKey] || drafts[name.trim()] || existing[0]?.roomId;
      if (!spaceId) spaceId = (await this.createRoomOnce({ name: name.trim(), room_alias_name: this.roomAlias('community', `${creator}:${nameKey}`), creation_content: { type: 'm.space' }, preset: Preset.PrivateChat, invite: [...new Set(users)] })).room_id;
      drafts[nameKey] = spaceId; try { localStorage.setItem(key, JSON.stringify(drafts)); } catch { /* Server alias still makes retries idempotent. */ }
      return this.repairCommunity(spaceId);
    });
  }
  private repairingCommunities = new Set<string>();
  async repairCommunity(spaceId: string) {
    if (this.repairingCommunities.has(spaceId)) throw new Error('This community is already being set up.');
    this.repairingCommunities.add(spaceId);
    const client = this.require(); const user = client.getUserId()!;
    const journalKey = `ghostchat.community.groups.${client.getHomeserverUrl()}.${user}.${spaceId}`;
    try {
      const state = await client.roomState(spaceId);
      const create = state.find(e => e.type === EventType.RoomCreate);
      if (create?.content.type !== 'm.space' || create.sender !== user) throw new Error('Only the creator can finish this community setup.');
      const name = String(state.find(e => e.type === EventType.RoomName)?.content.name || 'Community');
      const users = state.filter(e => e.type === EventType.RoomMember && ['join', 'invite'].includes(String(e.content.membership))).map(e => e.state_key).filter(id => id && id !== user);
      let groups: CommunityGroups = {}; try { groups = JSON.parse(localStorage.getItem(journalKey) || '{}'); } catch { /* Recover from server links below. */ }
      for (const edge of state.filter(e => e.type === EventType.SpaceChild && Array.isArray(e.content.via) && e.content.via.length)) {
        const child = await client.roomState(edge.state_key);
        const childName = child.find(e => e.type === EventType.RoomName)?.content.name;
        if (childName === `${name} · General`) groups.general ||= edge.state_key;
        if (childName === `${name} · Announcements`) groups.announcements ||= edge.state_key;
      }
      const server = user.split(':').slice(1).join(':');
      const result = await completeCommunityGroups(groups, {
        create: role => this.createRoom(users, `${name} · ${role === 'general' ? 'General' : 'Announcements'}`, undefined, role === 'announcements', this.roomAlias('channel', `${user}:${spaceId}:${role}`)),
        save: value => { try { localStorage.setItem(journalKey, JSON.stringify(value)); } catch { /* Stable child aliases preserve recovery even when browser storage is full. */ } },
        link: async roomId => {
          await client.sendStateEvent(spaceId, EventType.SpaceChild, { via: [server], suggested: true }, roomId);
          await client.sendStateEvent(roomId, EventType.SpaceParent, { via: [server], canonical: true }, spaceId);
        },
      });
      this.notify(); return { spaceId, generalId: result.generalId };
    } catch (error) {
      this.notify(); const e = error as { errcode?: string; message?: string };
      throw new Error(`Community setup paused. Open Communities → Finish setup to resume. ${e.errcode || e.message || 'Check your connection.'}`.slice(0, 300));
    } finally { this.repairingCommunities.delete(spaceId); }
  }

  async invite(roomId: string, userId: string) { if (!/^@[^\s:]+:[^\s]+$/.test(userId)) throw new Error('Enter a complete Matrix ID.'); await this.require().invite(roomId, userId); this.notify(); }
  async rename(roomId: string, name: string) { if (!name.trim() || name.length > 80) throw new Error('Use a name of 1–80 characters.'); await this.require().setRoomName(roomId, name.trim()); this.notify(); }
  async removeMember(roomId: string, userId: string) { await this.require().kick(roomId, userId, 'Removed by a group administrator'); this.notify(); }
  async join(roomId: string) { await this.require().joinRoom(roomId); this.notify(); }
  async leave(roomId: string) { await this.require().leave(roomId); this.notify(); }
  async react(roomId: string, eventId: string, key: string) {
    const client = this.require(); await client.sendEvent(roomId, EventType.Reaction, { 'm.relates_to': { rel_type: RelationType.Annotation, event_id: eventId, key } });
  }
  async redact(roomId: string, eventId: string) { await this.require().redactEvent(roomId, eventId); this.notify(); }
  async earlier(roomId: string) { const client = this.require(); const room = client.getRoom(roomId); if (room) await client.paginateEventTimeline(room.getLiveTimeline(), { backwards: true, limit: 40 }); this.notify(); }
  typing(roomId: string, active: boolean) { void this.client?.sendTyping(roomId, active, 6000).catch(() => {}); }
  typingNames(roomId: string) { return this.client?.getRoom(roomId)?.getJoinedMembers().filter(m => m.typing && m.userId !== this.client?.getUserId()).map(m => m.name) || []; }
  async markRead(roomId: string, shareReceipt = true): Promise<void> {
    const client = this.require(); const room = client.getRoom(roomId);
    if (!room || room.getMyMembership() !== 'join') return;
    const event = room.getLiveTimeline().getEvents().filter(item => !item.status && !!item.getId() && (item.getType() === EventType.RoomMessage || item.isDecryptionFailure())).at(-1);
    const id = event?.getId(); if (!event || !id || this.readPositions.get(roomId) === id) return;
    if (this.reading.has(roomId)) { await this.reading.get(roomId); return this.markRead(roomId, shareReceipt); }
    const generation = this.generation;
    const task = (async () => {
      await client.setRoomReadMarkers(roomId, id, shareReceipt ? event : undefined, shareReceipt ? undefined : event);
      if (generation !== this.generation) return;
      this.readPositions.set(roomId, id);
      room.setUnreadNotificationCount(NotificationCountType.Total, 0);
      room.setUnreadNotificationCount(NotificationCountType.Highlight, 0);
      this.notify();
    })();
    this.reading.set(roomId, task);
    try { await task; } finally { if (this.reading.get(roomId) === task) this.reading.delete(roomId); }
  }
  async setProfilePhoto(file: File | null) {
    const client = this.require(); let url = '';
    if (file) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) throw new Error('Choose a JPG, PNG or WebP photo smaller than 2 MB.');
      const uploaded = await client.uploadContent(file, { name: 'profile-photo', type: file.type, includeFilename: false }); url = uploaded.content_uri;
    }
    await client.setAvatarUrl(url); this.profileAvatar = url || undefined; this.notify();
  }
  async avatarBlob(mxc: string, signal: AbortSignal) {
    const client = this.require();
    if (!mxc.startsWith('mxc://')) throw new Error('Invalid avatar.');
    const url = client.mxcUrlToHttp(mxc, 128, 128, 'crop', false, true, true);
    if (!url || new URL(url).origin !== new URL(client.getHomeserverUrl()).origin) throw new Error('Unexpected avatar server.');
    const response = await fetch(url, { headers: { Authorization: `Bearer ${client.getAccessToken()}` }, redirect: 'error', signal });
    if (!response.ok) throw new Error('Profile photo unavailable.');
    const blob = await response.blob();
    if (!blob.type.startsWith('image/') || blob.type === 'image/svg+xml' || blob.size > 3 * 1024 * 1024) throw new Error('Unsupported profile photo.');
    return blob;
  }
  async upload(roomId: string, file: File) {
    const client = this.require(); if (!client.isRoomEncrypted(roomId)) throw new Error('Attachments require an encrypted room.');
    if (file.size > 15 * 1024 * 1024) throw new Error('Choose a file smaller than 15 MB.');
    const encrypted = await encryptAttachment(await file.arrayBuffer());
    const response = await client.uploadContent(new Blob([encrypted.data as ArrayBuffer], { type: 'application/octet-stream' }), { name: 'encrypted-attachment', type: 'application/octet-stream', includeFilename: false });
    await client.sendMessage(roomId, { msgtype: file.type.startsWith('image/') ? MsgType.Image : file.type.startsWith('audio/') ? MsgType.Audio : MsgType.File, body: file.name,
      info: { size: file.size, mimetype: file.type }, file: { ...encrypted.info, url: response.content_uri },
    } as RoomMessageEventContent); this.notify();
  }
  async download(attachment: NonNullable<ChatMessage['attachment']>) {
    const client = this.require(); const mxc = attachment.encrypted?.url || attachment.url;
    if (typeof mxc !== 'string' || !mxc.startsWith('mxc://')) throw new Error('Invalid attachment location.');
    const url = client.mxcUrlToHttp(mxc, undefined, undefined, undefined, false, true, true); if (!url) throw new Error('Attachment is unavailable.');
    if (new URL(url).origin !== new URL(client.getHomeserverUrl()).origin) throw new Error('Unexpected media origin.');
    const response = await fetch(url, { headers: { Authorization: `Bearer ${client.getAccessToken()}` }, redirect: 'error', signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error('Could not download this attachment.');
    if (Number(response.headers.get('content-length') || 0) > 16 * 1024 * 1024) throw new Error('Attachment is too large.');
    if (!response.body) throw new Error('Attachment data is unavailable.');
    const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
    try { while (true) { const { value, done } = await reader.read(); if (done) break; length += value.byteLength; if (length > 16 * 1024 * 1024) { await reader.cancel(); throw new Error('Attachment is too large.'); } chunks.push(value); } } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; } const data = bytes.buffer;
    if (attachment.encrypted && (!attachment.encrypted.key || typeof attachment.encrypted.iv !== 'string')) throw new Error('Invalid encrypted attachment.');
    const decrypted = attachment.encrypted ? await decryptAttachment(data, attachment.encrypted as unknown as Parameters<typeof decryptAttachment>[1]) : data;
    return new Blob([decrypted as ArrayBuffer], { type: 'application/octet-stream' });
  }
  private require() { if (!this.client) throw new Error('Connect to your Matrix server first.'); return this.client; }
  async exportChatKeys() {
    const api = this.require().getCrypto(); if (!api) throw new Error('Chat encryption is still starting.');
    return api.exportRoomKeysAsJson();
  }
  async recoverLocalChatKeys() {
    const current = this.require(); const userId = current.getUserId()!; const deviceId = current.getDeviceId()!;
    if (!indexedDB.databases || !navigator.locks) throw new Error('This browser cannot inspect older chat devices.');
    const prefix = `ghostpay.crypto.${userId}.`;
    const devices = [...new Set((await indexedDB.databases()).map(db => db.name || '').filter(name => name.startsWith(prefix)).map(name => name.slice(prefix.length).split('::')[0]).filter(id => id && id !== deviceId))];
    let count = 0; let skipped = 0;
    for (const oldDevice of devices) {
      const identity = `${current.getHomeserverUrl()}/${userId}/${oldDevice}`;
      await navigator.locks.request(`ghostpay.matrix.${identity}`, { ifAvailable: true }, async lock => {
        if (!lock) { skipped++; return; }
        // Never log in, sync, upload keys, or reuse an old device identity on the server.
        const old = createClient({ baseUrl: current.getHomeserverUrl(), userId, deviceId: oldDevice, fetchFn: async () => { throw new Error('Local key recovery cannot access the network.'); } });
        try {
          await old.initRustCrypto({ useIndexedDB: true, cryptoDatabasePrefix: `${prefix}${oldDevice}` });
          const json = await old.getCrypto()!.exportRoomKeysAsJson();
          const keys = JSON.parse(json); if (keys.length) { if (this.client !== current) throw new Error('Chat account changed during recovery.'); await this.importChatKeys(json); count += keys.length; }
        } catch { skipped++; } finally { old.stopClient(); old.removeAllListeners(); }
      });
    }
    if (!count) throw new Error(`No recoverable keys found on older devices in this browser.${skipped ? ' Some stores were unavailable; close other GhostChat tabs and retry.' : ''} Keep any existing backup files.`);
    return count;
  }
  async importChatKeys(json: string) {
    const client = this.require(); const api = client.getCrypto(); if (!api) throw new Error('Chat encryption is still starting.');
    const keys = JSON.parse(json); if (!Array.isArray(keys) || !keys.length) throw new Error('This backup contains no room keys.');
    await api.importRoomKeysAsJson(json);
    for (const room of client.getRooms()) for (const event of room.getLiveTimeline().getEvents()) if (event.isDecryptionFailure()) await client.decryptEventIfNeeded(event, { isRetry: true }).catch(() => {});
    this.notify();
  }
}
export const matrix = new MatrixService();
