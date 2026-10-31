import { Ghost } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from './Button';

export function Navbar({ isOn }: { isOn: boolean }) {
  return <header className={`nav ${isOn ? 'on' : ''}`}>
    <Link to="/" className="nav-brand" aria-label="GhostChat home"><Ghost size={23}/><span className="brand-name">GhostChat</span></Link>
    <nav className="nav-links" aria-label="Main navigation"><Link to="/about">Platform</Link><Link to="/demo">How it works</Link><Link to="/privacy">Privacy</Link><Link to="/contact">Contact</Link></nav>
    <div className="nav-right"><Link to="/start" className="login-link">Continue</Link><div className="navcta" aria-hidden={!isOn} inert={!isOn}><Button label="Get started" labelClassName="lbl"/></div></div>
  </header>;
}
