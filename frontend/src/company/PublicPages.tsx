import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ArrowRight, Check, Ghost, Mail, ShieldCheck } from 'lucide-react';
import { project, walkthrough } from './content';
import './public.css';

function Section({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return <section className="gp-public-section" id={id}><h2>{title}</h2>{children}</section>;
}

export default function PublicPages() {
  const { pathname } = useLocation();
  const page = pathname.replace(/\/$/, '');
  const [step, setStep] = useState(0);
  const titles: Record<string, string> = { '/about': 'About GhostChat', '/demo': 'Product walkthrough', '/privacy': 'Privacy notice', '/terms': 'Testnet demo terms', '/contact': 'Contact GhostChat' };
  useEffect(() => {
    const oldTitle = document.title;
    document.title = `${titles[page]} — GhostChat`;
    window.scrollTo(0, 0);
    return () => { document.title = oldTitle; };
  }, [page]);
  return <div className="gp-public">
    <a className="gp-public-skip" href="#public-main">Skip to content</a>
    <header className="gp-public-header">
      <Link to="/" className="gp-public-logo"><Ghost size={24} aria-hidden="true"/>GhostChat</Link>
      <nav aria-label="Project navigation"><NavLink to="/about">About</NavLink><NavLink to="/demo">Walkthrough</NavLink><NavLink to="/contact">Contact</NavLink></nav>
      <Link to="/start" className="gp-public-button">Get started <ArrowRight size={15}/></Link>
    </header>
    <main id="public-main" className="gp-public-main">
      <p className="gp-public-eyebrow">MESSAGING · MST PAYMENTS · P2P TEST DEMO</p>
      <h1>{titles[page]}</h1>
      {page === '/about' && <>
        <p className="gp-public-intro">Your conversations. Your payments. One place.</p>
        <p>{project.description} GhostChat is being built for people and communities who want to talk, send payments and coordinate exchanges without leaving their conversation workspace.</p>
        <div className="gp-public-notice"><ShieldCheck size={20}/><p>Use test coins only. GhostChat is experimental and unaudited. Payment addresses, amounts and blockchain activity are public.</p></div>
        <Section title="The problem we are working on"><p>Conversations, wallet addresses and payment updates often live in different apps. People have to switch between them to agree on a payment, identify the recipient and check what happened. GhostChat brings those steps together while keeping wallet approvals explicit.</p></Section>
        <Section title="Three parts of one messenger"><div className="gp-public-grid">
          <article><span>01</span><h3>Matrix conversations</h3><p>Connect a Matrix account for messaging and configure end-to-end encryption for supported chats. A working homeserver is required for delivery.</p></article>
          <article><span>02</span><h3>MST payments</h3><p>Look up a registered @username or enter a full wallet address. Review the destination, then send testnet tokens, share a payment link or fund community allocations.</p></article>
          <article><span>03</span><h3>P2P test trading</h3><p>Lock native faucet tMSTC in escrow, try a mock INR payment through Razorpay Test Mode and approve release after server verification.</p></article>
        </div></Section>
        <Section title="What you can try today"><ul className="gp-public-list"><li><Check size={17}/>BridgeKey wallet sign-in and a unique payment username.</li><li><Check size={17}/>One workspace for conversations, testnet payments and P2P tools.</li><li><Check size={17}/>A native tMSTC escrow with Razorpay Test Mode payment verification.</li></ul><p>Live Matrix messaging needs a configured homeserver and cross-device verification. Test Checkout requires configured Razorpay credentials. The P2P demo uses no real INR or mainnet MSTC. Its server attestation is not a zero-knowledge proof, and a funded public end-to-end run remains to be verified.</p></Section>
        <Section title="Where we are going"><div className="gp-public-grid"><article><span>NEXT</span><h3>Connected pilots</h3><p>Verify messaging across devices and run the test-payment-to-token-release flow with two wallets.</p></article><article><span>THEN</span><h3>Reliable recovery</h3><p>Improve messaging backups, payment notifications, monitoring and recovery when a provider or device goes offline.</p></article><article><span>PLANNED</span><h3>Seller-confirmed trading</h3><p>Explore a UPI flow where the seller checks payment in their own bank app before approving escrow release. This flow is not yet implemented.</p></article></div></Section>
        <Section title="Built by an independent founder"><p>{project.founder} is developing GhostChat as a self-funded, pre-incorporation project. The founder plans to seek investment as the product and pilot evidence develop. GhostChat is currently a testnet experiment and is not a licensed financial service.</p><div className="gp-public-actions"><Link className="gp-public-button" to="/demo">Explore the workflow <ArrowRight size={16}/></Link><Link className="gp-public-secondary" to="/contact">Talk to the founder</Link></div></Section>
      </>}
      {page === '/demo' && <>
        <p className="gp-public-intro">From your first conversation to a test payment.</p><p>This is an explanatory walkthrough of the account, messaging and payment flow. Changing steps does not connect an account, submit a transaction or create a payment. The linked app screens let you explore the actual tools.</p>
        <div className="gp-walkthrough"><nav aria-label="Walkthrough steps">{walkthrough.map((item, index) => <button key={item.title} onClick={() => setStep(index)} aria-current={step === index ? 'step' : undefined}><span>{String(index + 1).padStart(2, '0')}</span>{item.title}</button>)}</nav><section className="gp-walkthrough-detail" aria-live="polite" aria-atomic="true"><p className="gp-public-eyebrow">STEP {step + 1} OF {walkthrough.length} · {walkthrough[step].role}</p><h2>{walkthrough[step].title}</h2><p>{walkthrough[step].text}</p><div className="gp-public-notice"><ShieldCheck size={20}/><p>{walkthrough[step].detail}</p></div><Link className="gp-public-button" to={walkthrough[step].to}>{walkthrough[step].action}<ArrowRight size={16}/></Link><div className="gp-walkthrough-controls"><button disabled={step === 0} onClick={() => setStep(step - 1)}>Previous</button><span>{step + 1} / {walkthrough.length}</span><button disabled={step === walkthrough.length - 1} onClick={() => setStep(step + 1)}>Next step</button></div></section></div>
        <Section title="Before using the testnet app"><p>Use different seller and buyer wallets with faucet tMSTC for deposits and gas. Confirm the intended recipient’s full wallet address. Keep the submitted transaction hash and trade link; the P2P demo saves public pending-transaction references on this device for recovery.</p></Section>
        <Section title="What this walkthrough does not promise"><p>No live INR trading, sponsored gas, guaranteed delivery, private blockchain payments, ZK payment verification or independent security audit is provided. Local preview messages stay in your browser; delivered chats need a connected Matrix account and homeserver.</p></Section>
      </>}
      {page === '/contact' && <>
        <p className="gp-public-intro">Talk to the person building GhostChat.</p><Section title={project.founder}><p>Founder · GhostChat · Pre-incorporation project</p><p>For product questions, pilot feedback, privacy requests or startup-program verification, email the founder.</p><a className="gp-public-button" href={`mailto:${project.email}`}><Mail size={17}/>{project.email}</a><p className="gp-public-small">This is the current personal contact address. A business-domain mailbox has not been set up yet.</p></Section><Section title="Review the project"><p>The source, tests and implementation notes are available in the public repository. Do not send private keys, seed phrases, passwords or sensitive financial documents by email or in a public issue.</p><a className="gp-public-secondary" href={project.repository} target="_blank" rel="noreferrer">View the GitHub repository <ArrowRight size={16}/></a></Section>
      </>}
      {page === '/privacy' && <>
        <p className="gp-public-intro">How this testnet MVP handles information.</p><p className="gp-public-small">Updated {project.updated}. Operator: {project.founder}, an independent developer.</p>
        <Section title="Public blockchain and directory information"><p>Wallet addresses, transaction amounts, contract state and transaction history are public on the blockchain. Signed claim requests and approvals are readable through the relay API. Registered usernames and wallet bindings are publicly searchable. Avoid putting personal or confidential information in campaign titles or public records.</p></Section>
        <Section title="Browser storage"><p>The app stores preview messages, preferences and local payment history on your device. Matrix session information uses browser session storage; its SDK also uses local browser storage for messaging and encryption state. BridgeKey stores and manages wallet signing keys; GhostChat stores its login session only in memory. Public app assets may be stored by the service worker for offline use. Clearing browser storage can remove local chat data and encryption keys; keep your chat recovery backup.</p></Section>
        <Section title="Hosted services and providers"><p>The hosted relay stores claim requests, signatures, username registrations and rate-limit records. Its rate limiter hashes the connecting IP address into time-window keys. Hosting, RPC, wallet and messaging providers may separately process IP addresses, device information and request metadata under their policies.</p><p>Providers used by the application include Vercel, Cloudflare, Reown and public blockchain RPC services. Price lookups use CoinGecko or Coinbase. Connecting to a Matrix homeserver shares account and messaging metadata with that server. End-to-end encryption does not make all metadata private; the local messenger preview is neither delivered nor end-to-end encrypted.</p></Section>
        <Section title="Retention and requests"><p>Blockchain records cannot be deleted by GhostChat. The username service currently treats registrations as permanent and does not offer a self-service rename or deletion flow. Retention periods for hosted claim records and operational logs are not yet formalized. Contact the founder about access or deletion requests; some public, contractual or technical records may not be removable. This MVP has no self-service data export or deletion dashboard.</p></Section>
        <Section title="Contact"><p>Questions about data handling can be sent to <a href={`mailto:${project.email}`}>{project.email}</a>. Do not include signing keys or seed phrases.</p></Section>
      </>}
      {page === '/terms' && <>
        <p className="gp-public-intro">Conditions for exploring the experimental demo.</p><p className="gp-public-small">Updated {project.updated}. Provided by {project.founder} as a pre-incorporation project.</p>
        <Section title="Testnet use only"><p>Use supported testnets and test coins. Do not use GhostChat to send real money, make real INR/UPI payments or hold assets of value. The current P2P demo uses native faucet tMSTC and mock INR through Razorpay Test Mode. The legacy sandbox uses freely minted gpUSD. GhostChat is not offering banking, investment, exchange or guaranteed settlement services.</p></Section>
        <Section title="Wallet control and transactions"><p>You control your wallet and are responsible for reviewing the network, contract, destination, amount and wallet prompts. Never share your seed phrase or private key. Transactions consume network gas and confirmed transfers may be irreversible. The P2P test server can sign payment attestations after verification; it does not hold your wallet key or submit the buyer’s release transaction.</p></Section>
        <Section title="Expiry and recovery"><p>Recovery depends on the selected flow. Unclaimed payment links and community funds support their contract-specific expiry refunds. An accepted P2P trade cannot be reclaimed by the seller on timeout; the buyer can intentionally return its allocation. Test funds may remain locked if payment evidence or buyer cooperation is unavailable. Browser history is not a wallet backup or a complete payment index. Save transaction hashes, links and your encrypted wallet backup.</p></Section>
        <Section title="Availability and limitations"><p>The demo is experimental, unaudited and provided without a service-level or recovery guarantee. Providers may fail or rate-limit requests. Live messaging, physical-device behavior and funded flows on additional testnets need further verification. Features, infrastructure and these notices may change as the project develops.</p></Section>
        <Section title="Appropriate use and contact"><p>Do not impersonate others, abuse shared infrastructure or submit confidential information to public blockchain or directory records. Questions and problems can be reported to <a href={`mailto:${project.email}`}>{project.email}</a>. These demo conditions do not assert any regulatory approval or independent security certification.</p></Section>
      </>}
    </main>
    <footer className="gp-public-footer"><p>GhostChat · Test coins only · Experimental and unaudited</p><nav aria-label="Project information"><Link to="/about">About</Link><Link to="/demo">Walkthrough</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Demo terms</Link><Link to="/contact">Contact</Link><a href={project.repository} target="_blank" rel="noreferrer">GitHub</a></nav></footer>
  </div>;
}
