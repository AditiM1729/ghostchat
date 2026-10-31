import { isWorkspacePath } from '../messenger/workspace';
export function onboardingDestination(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/chat';
  try {
    const url = new URL(value, 'https://ghostchat.invalid');
    if (url.origin !== 'https://ghostchat.invalid' || !isWorkspacePath(url.pathname)) return '/chat';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return '/chat'; }
}
export function profileMatchesWallet(profile: { wallet?: string; username?: string } | null | undefined, address?: string) {
  return !!address && !!profile?.username && profile.wallet?.toLowerCase() === address.toLowerCase();
}
