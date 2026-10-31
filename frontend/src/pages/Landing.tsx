import { useEffect, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { AtmosphereCanvas } from '../landing/components/AtmosphereCanvas';
import { MessagingScrollBackground } from '../landing/components/MessagingScrollBackground';
import { Navbar } from '../landing/components/Navbar';
import { HeroSection } from '../landing/components/HeroSection';
import { StatementSection } from '../landing/components/StatementSection';
import { computeSlidesMotion } from '../landing/utils/glowMath';
import '../landing/design.css';
import '../landing/integration.css';

export function Landing() {
  const [scrollY, setScrollY] = useState(0);
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const title = document.title; document.title = 'GhostChat — Your people. Your payments.';
    document.body.classList.add('gc-landing-active');
    const initial = requestAnimationFrame(() => setReady(true));
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(preference.matches); preference.addEventListener('change', change);
    let frame = 0;
    const update = () => { if (!frame) frame = requestAnimationFrame(() => { setScrollY(window.scrollY); frame = 0; }); };
    window.addEventListener('scroll', update, { passive: true }); window.addEventListener('resize', update); update();
    return () => {
      cancelAnimationFrame(initial); cancelAnimationFrame(frame); document.title = title;
      document.body.classList.remove('gc-landing-active'); preference.removeEventListener('change', change);
      window.removeEventListener('scroll', update); window.removeEventListener('resize', update);
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    };
  }, []);
  const motion = computeSlidesMotion(scrollY / (window.innerHeight || 1), 5);
  const stopped = paused || reduced;
  return <div className={`gc-landing ${ready ? 'ready' : ''} ${stopped ? 'is-paused' : ''} ${reduced ? 'is-reduced' : ''}`}>
    <a href="#gc-main" className="gc-skip">Skip to content</a>
    <AtmosphereCanvas paused={stopped}/><MessagingScrollBackground scrollY={scrollY} paused={stopped}/>
    <Navbar isOn={motion.navOn}/>
    <main id="gc-main"><HeroSection paused={stopped}/><StatementSection slides={motion.slides} reduced={reduced}/></main>
    <button className="gc-motion" onClick={() => setPaused(value => !value)} aria-label={reduced ? 'Animation reduced to match your device preference' : stopped ? 'Resume background animation' : 'Pause background animation'} disabled={reduced}>{stopped ? <Play size={16}/> : <Pause size={16}/>}</button>
  </div>;
}
