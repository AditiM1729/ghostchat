import { LetterRevealText, type TextToken } from './LetterRevealText';
import type { SlideState } from '../utils/glowMath';

const statements = [
  'Your conversations, your people,\nyour payments. Together in one messenger,\nwith a wallet that stays yours.',
  'Connect BridgeKey. Choose your @username.\nCreate your wallet-linked Matrix account\nand keep the conversation going.',
  'Message through Matrix.\nFind a recipient by @username.\nReview every payment in your wallet.',
  'Try P2P, step by step.\nLock faucet tMSTC. Make a mock INR payment.\nVerify it, then approve the token release.',
  'Built on MST. Designed for your community.\nTestnet trading today.\nClear confirmations at every step.',
];
const details = [
  { label: '01 / ONE SHARED SPACE', text: 'For friends, builders and community contributors. Keep the conversation and its payment context together.' },
  { label: '02 / YOUR IDENTITY', text: 'Sign a wallet-ownership message in BridgeKey. Choose a public username; your mobile number stays private and is not verified.' },
  { label: '03 / CONVERSATIONS & CONTROL', text: 'Create encrypted direct chats and groups. Find registered people by username and review the recipient and amount before sending.' },
  { label: '04 / TEST THE COMPLETE FLOW', text: 'Explore escrow and Razorpay Test Mode with test assets. A verified mock payment is part of the demo, not evidence of a real bank credit.' },
  { label: '05 / WHAT COMES NEXT', text: 'Today: wallet-linked chat and testnet payment tools. A seller-confirmed UPI trading flow is planned and is not yet live.' },
];
function tokenize(text: string): TextToken[] { return text.split(/(\n| )/).filter(Boolean).map(word => word === '\n' ? { type: 'br' } : word === ' ' ? { type: 'space' } : { type: 'word', text: word }); }
const tokens = statements.map(tokenize);
export function StatementSection({ slides, reduced }: { slides: SlideState[]; reduced: boolean }) {
  return <section className="statement" id="gc-story" aria-label="How GhostChat works"><div className="pin">
    {slides.map((slide, i) => reduced || slide.isActive ? <div key={i} className="stmt-slide" style={reduced ? undefined : { opacity: slide.opacity, transform: `translateY(${slide.translateY.toFixed(1)}px)` }}>
      <div className="gc-story-copy"><p className="gc-story-label">{details[i].label}</p><p className="stmt-text" aria-label={statements[i].replace(/\n/g, ' ')}><span aria-hidden="true"><LetterRevealText tokens={tokens[i]} progress={reduced ? 1 : slide.revealP} spread={0.16} ghostRgb={[70, 100, 90]} accentRgb={[0, 229, 192]} finalRgb={[255, 255, 255]}/></span></p><p className="gc-story-detail">{details[i].text}</p>{i === statements.length - 1 && <a className="gc-story-start" href="/start">Start with BridgeKey <span aria-hidden="true">→</span></a>}</div>
    </div> : null)}
  </div></section>;
}
