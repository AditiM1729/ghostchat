export type WorkspacePanel = 'create' | 'history' | 'trade' | 'payment' | 'setup';

export function workspacePanel(pathname: string): WorkspacePanel | undefined {
  if (pathname === '/create') return 'create';
  if (pathname === '/payments' || pathname === '/dashboard') return 'history';
  if (pathname === '/trade') return 'trade';
  if (pathname === '/setup') return 'setup';
  if (/^\/pay\/(?:v2\/[^/]+\/[^/]+\/[^/]+|[^/]+)$/.test(pathname) || /^\/campaign\/[^/]+\/[^/]+\/[^/]+$/.test(pathname)) return 'payment';
  return undefined;
}

export function isWorkspacePath(pathname: string) {
  return pathname === '/chat' || pathname.startsWith('/chat/') || !!workspacePanel(pathname);
}
