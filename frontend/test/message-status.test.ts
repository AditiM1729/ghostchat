import test from 'node:test';
import assert from 'node:assert/strict';
import { accountLabel, messageStatus, unreadAfterMarker } from '../src/messenger/messageStatus.ts';

test('server acceptance is sent, and only another participant read receipt means seen', () => {
  assert.equal(messageStatus(null, false), 'sent');
  assert.equal(messageStatus('sent', false), 'sent');
  assert.equal(messageStatus(null, true), 'seen');
  assert.equal(messageStatus('sending', true), 'sending');
  assert.equal(messageStatus('not_sent', true), 'failed');
});
test('a successful read marker clears stale server badges, but later incoming messages remain unread', () => {
  const events = [{ id: 'old', sender: 'friend' }, { id: 'mine', sender: 'self' }, { id: 'latest', sender: 'friend' }];
  assert.equal(unreadAfterMarker(events, 'latest', 'self', 3), 0);
  assert.equal(unreadAfterMarker([...events, { id: 'new', sender: 'friend' }], 'latest', 'self', 4), 1);
  assert.equal(unreadAfterMarker([...events, { id: 'own-new', sender: 'self' }], 'latest', 'self', 4), 0);
  assert.equal(unreadAfterMarker(events, undefined, 'self', 3), 3);
});
test('redacted messages do not create new unread badges, and missing markers use server state', () => {
  assert.equal(unreadAfterMarker([{id:'read',sender:'self'}, {id:'removed',sender:'friend',redacted:true}], 'read', 'self', 8), 0);
  assert.equal(unreadAfterMarker([{id:'loaded',sender:'friend'}], 'older-unloaded', 'self', 8), 8);
});
test('normal account labels hide raw wallet identities and homeserver names', () => {
  assert.equal(accountLabel('@w_6ecbd2b54d31c6d1ca80fadf94ec282218e86f91:ghostchat.example'), 'GhostChat member');
  assert.equal(accountLabel('@alice:matrix.example'), '@alice');
  assert.equal(accountLabel('@ved_malkunaik'), '@ved_malkunaik');
});
