import type { ChatMessage } from './model';
export function messageStatus(status: string | null | undefined, readByAnotherUser: boolean): ChatMessage['state'] {
  if (status === 'not_sent' || status === 'cancelled') return 'failed';
  if (status && status !== 'sent') return 'sending';
  return readByAnotherUser ? 'seen' : 'sent';
}
export function unreadAfterMarker(events: { id: string; sender: string; redacted?: boolean }[], marker: string | undefined, self: string, serverCount: number) {
  const index = marker ? events.findIndex(event => event.id === marker) : -1;
  return index >= 0 ? events.slice(index + 1).filter(event => event.sender !== self && !event.redacted).length : serverCount;
}
export function accountLabel(value: string) {
  if (/^@w_[\da-f]{40}:/i.test(value)) return 'GhostChat member';
  return value.startsWith('@') && value.includes(':') ? value.split(':')[0] : value;
}
