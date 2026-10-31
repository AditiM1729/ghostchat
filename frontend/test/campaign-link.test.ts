import { it } from 'node:test';
import assert from 'node:assert/strict';
import { getAddress } from 'viem';
import { campaignPath, type CampaignReference } from '../../shared/community';
import { campaignFromText } from '../src/messenger/campaignLink';
import { paymentFromMessage } from '../src/messenger/model';

const ref: CampaignReference = { version: 4, chainId: 91562037, contract: getAddress('0x7b3676df9a2118385f13b2af23f96e14450409ae'), campaignId: '3', deploymentHash: `0x${'ab'.repeat(32)}` };
const link = `https://ghostchat-rho.vercel.app${campaignPath(ref)}`;
it('restores the community eligibility card from a pasted campaign link, including existing text messages', () => {
  assert.deepEqual(campaignFromText(link), ref);
  assert.deepEqual(paymentFromMessage(undefined, `Claim your allocation: ${link}.`), ref);
  assert.deepEqual(campaignFromText(link.replace('/3?', '/3/?')), ref);
  assert.deepEqual(campaignFromText(`http://localhost:5173${campaignPath(ref)}`, 'http://localhost:5173'), ref);
});
it('preserves structured payment references and refuses conflicting, malformed or foreign claim URLs', () => {
  const another = { ...ref, campaignId: '4' };
  assert.deepEqual(paymentFromMessage(another, link), another);
  assert.equal(campaignFromText(`${link} https://ghostchat-rho.vercel.app${campaignPath(another)}`), undefined);
  assert.equal(campaignFromText(link.replace('ghostchat-rho.vercel.app', 'fake.example')), undefined);
  assert.equal(campaignFromText(link.replace('/3?', '/0?')), undefined);
  assert.equal(campaignFromText(link.split('?')[0]), undefined);
  assert.equal(campaignFromText(`${link}&deployment=${ref.deploymentHash}`), undefined);
  assert.equal(campaignFromText(`${link}&redirect=https://fake.example`), undefined);
  assert.equal(campaignFromText(link.replace('https://', 'https://user:secret@')), undefined);
});
