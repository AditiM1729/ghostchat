import { it } from 'node:test';
import assert from 'node:assert/strict';
import { completeCommunityGroups, announcementPermissions, communityNameKey, CommunityCreationQueue, createOrRecoverRoom, type CommunityGroups } from '../src/messenger/communitySetup';
it('coalesces simultaneous creation and retries a failed request without leaving a stale lock', async () => {
  const queue = new CommunityCreationQueue(); let calls = 0;
  const work = async () => { calls++; await Promise.resolve(); return '!same-community'; };
  const results = await Promise.all([queue.run(communityNameKey(' Buildthon '), work), queue.run(communityNameKey('BUILDTHON'), work)]);
  assert.deepEqual(results, ['!same-community', '!same-community']); assert.equal(calls, 1);
  await assert.rejects(queue.run('retry', async () => { throw new Error('network'); }), /network/);
  assert.equal(await queue.run('retry', work), '!same-community');
});
it('recovers a room created before a lost response and never retries an unsafe alias as another new room', async () => {
  let created = 0;
  const id = await createOrRecoverRoom(async () => { created++; throw new Error('lost acknowledgement'); }, async () => ({ room_id: '!already-created' }));
  assert.equal(id.room_id, '!already-created'); assert.equal(created, 1);
  await assert.rejects(createOrRecoverRoom(async () => { throw new Error('M_ROOM_IN_USE'); }, async () => { throw new Error('different creator'); }), /M_ROOM_IN_USE/);
});
it('retries linking a saved child without creating duplicate groups', async () => {
  let journal: CommunityGroups = {}; let created = 0; let fail = true;
  const actions = {
    create: async (role: 'general' | 'announcements') => { created++; return `!${role}`; },
    save: (groups: CommunityGroups) => { journal = { ...groups }; },
    link: async (id: string) => { if (id === '!announcements' && fail) throw new Error('temporary network failure'); },
  };
  await assert.rejects(completeCommunityGroups({}, actions), /temporary network/);
  assert.deepEqual(journal, { general: '!general', announcements: '!announcements' });
  fail = false;
  assert.deepEqual(await completeCommunityGroups({ ...journal }, actions), { generalId: '!general', announcementsId: '!announcements' });
  assert.equal(created, 2);
});
it('retains a General group discovered on the server and creates only the missing Announcements group', async () => {
  const created: string[] = [];
  await completeCommunityGroups({ general: '!existing' }, { create: async role => { created.push(role); return '!new'; }, save: () => {}, link: async () => {} });
  assert.deepEqual(created, ['announcements']);
});
it('keeps announcements admin-only without overriding the Matrix room creator', () => {
  assert.ok(announcementPermissions.events_default > announcementPermissions.users_default);
  assert.ok(!('users' in announcementPermissions));
});
