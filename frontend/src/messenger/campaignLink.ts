import { campaignReference, type CampaignReference } from '../../../shared/community';

/** Recognize our claim links, not arbitrary websites claiming to be GhostChat. */
export function campaignFromText(body: unknown, appOrigin?: string): CampaignReference | undefined {
  if (typeof body !== 'string' || body.length > 16000) return;
  const origins = new Set(['https://ghostchat-rho.vercel.app']);
  if (appOrigin) { try { origins.add(new URL(appOrigin).origin); } catch { /* Ignore invalid application origins. */ } }
  const found = new Map<string, CampaignReference>();
  for (const token of body.match(/https?:\/\/[^\s<>"']+/g) || []) {
    try {
      const url = new URL(token.replace(/[),.!;]+$/, ''));
      if (!origins.has(url.origin) || url.username || url.password || url.hash) continue;
      const path = url.pathname.match(/^\/campaign\/(\d{1,10})\/(0x[\da-fA-F]{40})\/([1-9]\d{0,76})\/?$/);
      if (!path || url.searchParams.getAll('deployment').length !== 1 || [...url.searchParams.keys()].some(k => k !== 'deployment')) continue;
      const ref = campaignReference({ version: 4, chainId: Number(path[1]), contract: path[2], campaignId: path[3], deploymentHash: url.searchParams.get('deployment') });
      if (ref) found.set(`${ref.chainId}:${ref.contract}:${ref.campaignId}:${ref.deploymentHash.toLowerCase()}`, ref);
    } catch { /* Plain text remains plain text if it is not a valid claim reference. */ }
  }
  // Never silently select one payment when the message contains conflicting links.
  return found.size === 1 ? found.values().next().value : undefined;
}
