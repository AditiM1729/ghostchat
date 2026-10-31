export type CommunityGroups = { general?: string; announcements?: string };
export const announcementPermissions = { users_default: 0, events_default: 50, state_default: 50, invite: 50, kick: 50, ban: 50, redact: 50 };
export const communityNameKey = (name: string) => name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
export class CommunityCreationQueue {
  private pending = new Map<string, Promise<unknown>>();
  run<T>(key: string, work: () => Promise<T>): Promise<T> {
    const running = this.pending.get(key); if (running) return running as Promise<T>;
    const promise = Promise.resolve().then(work).finally(() => { if (this.pending.get(key) === promise) this.pending.delete(key); });
    this.pending.set(key, promise); return promise;
  }
}
export async function createOrRecoverRoom(create: () => Promise<{ room_id: string }>, recover: () => Promise<{ room_id: string }>) {
  try { return await create(); } catch (error) { try { return await recover(); } catch { throw error; } }
}
export async function completeCommunityGroups(groups: CommunityGroups, actions: {
  create(role: 'general' | 'announcements'): Promise<string>;
  save(groups: CommunityGroups): void;
  link(id: string): Promise<void>;
}) {
  for (const role of ['general', 'announcements'] as const) {
    if (!groups[role]) { groups[role] = await actions.create(role); actions.save({ ...groups }); }
    await actions.link(groups[role]!);
  }
  return { generalId: groups.general!, announcementsId: groups.announcements! };
}
