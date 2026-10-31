import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { parseEther } from 'viem';
import type { CheckPrivateTrade } from './privateTradeDetails.js';

export type BuyOffer = { id: string; buyer: string; seller?: string; amount: string; rate: string; paise: string; status: string; created: number; escrow?: string; creation?: string; tradeId?: string };
const fail = (message: string, status = 400): never => { throw Object.assign(new Error(message), { status }); };
export class BuyOffers {
  constructor(private db: DatabaseSync, private check: CheckPrivateTrade) {
    db.exec('CREATE TABLE IF NOT EXISTS buy_offers (id TEXT PRIMARY KEY, buyer TEXT NOT NULL, seller TEXT, status TEXT NOT NULL, payload TEXT NOT NULL)');
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS buy_offers_funded_trade ON buy_offers(lower(json_extract(payload,'$.escrow')),json_extract(payload,'$.tradeId')) WHERE status='funded'");
  }
  async access(wallet: string, action: string, input: any) {
    wallet = wallet.toLowerCase();
    if (action === 'list') {
      const rows = this.db.prepare("SELECT payload FROM buy_offers WHERE status = 'open' OR buyer = ? OR seller = ? ORDER BY rowid DESC LIMIT 200").all(wallet, wallet) as { payload: string }[];
      return { offers: rows.map(r => JSON.parse(r.payload) as BuyOffer) };
    }
    if (action === 'create') {
      if (!/^\d{1,2}(?:\.\d{1,18})?$/.test(input?.amount || '') || !/^\d{1,6}(?:\.\d{1,2})?$/.test(input?.rate || '')) return fail('Enter a token amount and INR rate with at most two decimal places.');
      const units = parseEther(input.amount); const [whole, fraction = ''] = input.rate.split('.');
      const ratePaise = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
      const paise = (units * ratePaise + 10n ** 18n - 1n) / (10n ** 18n);
      if (units <= 0n || units > parseEther('10') || ratePaise <= 0n || paise < 100n || paise > 10000000n) return fail('Use up to 10 tMSTC and a total of ₹1–₹100,000.');
      const count = this.db.prepare("SELECT COUNT(*) AS n FROM buy_offers WHERE buyer = ? AND status IN ('open','selected')").get(wallet) as { n: number };
      if (count.n >= 10) return fail('You already have ten active buy requests.', 409);
      const offer: BuyOffer = { id: randomUUID(), buyer: wallet, amount: input.amount, rate: input.rate, paise: String(paise), status: 'open', created: Date.now() };
      this.db.prepare('INSERT INTO buy_offers VALUES(?,?,NULL,?,?)').run(offer.id, wallet, 'open', JSON.stringify(offer));
      return offer;
    }
    const row = this.db.prepare('SELECT payload FROM buy_offers WHERE id = ?').get(typeof input?.id === 'string' ? input.id : '') as { payload: string } | undefined;
    if (!row) return fail('Buy request not found.', 404);
    const offer: BuyOffer = JSON.parse(row.payload);
    if (action === 'select') {
      if (offer.buyer === wallet) return fail('You cannot sell to your own buy request.');
      if (offer.status === 'selected' && offer.seller === wallet) return offer;
      const next = { ...offer, seller: wallet, status: 'selected' };
      const changed = this.db.prepare("UPDATE buy_offers SET seller=?, status='selected', payload=? WHERE id=? AND status='open'").run(wallet, JSON.stringify(next), offer.id);
      if (!changed.changes) return fail('Another seller already selected this request.', 409);
      return next;
    }
    if (action === 'cancel') {
      if (offer.buyer !== wallet || offer.status !== 'open') return fail('Only the buyer can withdraw an open request.', 403);
      offer.status = 'withdrawn';
      this.db.prepare("UPDATE buy_offers SET status='withdrawn',payload=? WHERE id=? AND status='open'").run(JSON.stringify(offer), offer.id);
      return offer;
    }
    if (action === 'link') {
      if (offer.seller !== wallet || !['selected', 'funded'].includes(offer.status)) return fail('Only the selected seller can link this trade.', 403);
      if (!/^0x[\da-f]{40}$/i.test(input.escrow || '') || !/^0x[\da-f]{64}$/i.test(input.creation || '') || !/^[1-9]\d{0,76}$/.test(input.tradeId || '') || BigInt(input.tradeId) >= 2n ** 256n) return fail('Invalid trade reference.');
      if (offer.status === 'funded') {
        if (offer.escrow !== input.escrow || offer.tradeId !== input.tradeId || offer.creation !== input.creation) return fail('Request already has a funded trade.', 409);
        return offer;
      }
      const t = await this.check(input.escrow, BigInt(input.tradeId), input.creation);
      if (!t.state || t.seller.toLowerCase() !== wallet || t.buyer.toLowerCase() !== offer.buyer || t.amount !== parseEther(offer.amount) || t.inrPaise !== BigInt(offer.paise)) return fail('Confirmed trade does not match this buy request.');
      Object.assign(offer, { status: 'funded', escrow: input.escrow, creation: input.creation, tradeId: input.tradeId });
      this.db.prepare("UPDATE buy_offers SET status='funded',payload=? WHERE id=? AND status='selected'").run(JSON.stringify(offer), offer.id);
      return offer;
    }
    return fail('Unknown offer action.', 404);
  }
}
