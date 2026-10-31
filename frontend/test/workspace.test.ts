import test from 'node:test';
import assert from 'node:assert/strict';
import { isWorkspacePath, workspacePanel } from '../src/messenger/workspace.ts';

test('messaging and existing financial deep links share the workspace without rewriting proof parameters', () => {
  for (const path of ['/chat', '/chat/room', '/create', '/payments', '/dashboard', '/trade', '/setup', '/pay/12', '/pay/v2/91562037/0xabc/12', '/campaign/91562037/0xabc/4']) assert.equal(isWorkspacePath(path), true, path);
  assert.equal(workspacePanel('/'), undefined);
  assert.equal(workspacePanel('/chat'), undefined);
  assert.equal(workspacePanel('/trade'), 'trade');
  assert.equal(workspacePanel('/pay/v2/91562037/0xabc/12'), 'payment');
  assert.equal(workspacePanel('/campaign/91562037/0xabc/4'), 'payment');
  const link = new URL('https://ghost.example/trade?sandbox=0xabc&creation=0xdef&trade=7');
  workspacePanel(link.pathname);
  assert.equal(link.search, '?sandbox=0xabc&creation=0xdef&trade=7');
});
test('public information pages and unrelated or incomplete URLs do not become payment actions', () => {
  for (const path of ['/', '/start', '/about', '/privacy', '/overview', '/trades', '/payment', '/pay/v2/91562037', '/api/deployment']) {
    assert.equal(isWorkspacePath(path), false, path);
    assert.equal(workspacePanel(path), undefined, path);
  }
});
