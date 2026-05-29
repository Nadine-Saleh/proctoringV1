import { useState, useEffect, useRef, ReactNode, MouseEvent as RMouseEvent, createElement } from 'react';
import { Link } from 'react-router-dom';
import {
  Eye,
  Brain,
  Camera,
  Activity,
  BarChart3,
  Lock,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Play,
  Star,
  Zap,
  ShieldCheck,
  Shield,
  ScanFace,
  Mic,
  AlertTriangle,
  ChevronDown,
  GraduationCap,
  Building2,
  Briefcase,
  FileCheck,
  Server,
  Globe,
  Twitter,
  Linkedin,
  Github,
  ArrowUp,
} from 'lucide-react';
import {
  useScroll,
  useScrollProgress,
  useInView,
  useParallax,
  useMouseTilt,
  useCountUp,
} from '../hooks/useScrollEffects';

export function Landing() {
  return (
    <div className="bg-black text-white antialiased overflow-x-clip">
      <ScrollProgress />
      <LandingNav />
      <Hero />
      <TrustBar />
      <Stats />
      <Features />
      <ProductShowcase />
      <HowItWorks />
      <UseCases />
      <Comparison />
      <Security />
      <Testimonials />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
      <BackToTop />
    </div>
  );
}

/* ─────────────────────────── Scroll progress ─────────────────────────── */

function ScrollProgress() {
  const progress = useScrollProgress();
  return (
    <div className="fixed top-0 inset-x-0 z-50 h-0.5 bg-transparent pointer-events-none">
      <div
        className="h-full bg-gradient-to-r from-brand-600 via-brand-400 to-brand-600 bg-[length:200%_100%] animate-gradient-shift shadow-[0_0_10px_rgba(177,74,93,0.5)]"
        style={{ width: `${progress}%`, transition: 'width 120ms linear' }}
      />
    </div>
  );
}

function BackToTop() {
  const y = useScroll();
  const visible = y > 600;
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
      className={`fixed bottom-6 right-6 z-40 w-11 h-11 rounded-full bg-white text-ink-950 shadow-elevated flex items-center justify-center transition-all duration-300 hover:bg-brand-500 hover:text-white ${visible
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 translate-y-3 pointer-events-none'
        }`}
    >
      <ArrowUp className="w-4 h-4" />
    </button>
  );
}

/* ─────────────────────────── Reveal wrapper ─────────────────────────── */

function Reveal({
  children,
  delay = 0,
  className = '',
  variant = 'up',
  as: Tag = 'div',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  variant?: 'up' | 'fade' | 'scale';
  as?: keyof JSX.IntrinsicElements;
}) {
  const { ref, inView } = useInView<HTMLElement>();
  const cls =
    variant === 'fade' ? 'reveal-fade' : variant === 'scale' ? 'reveal-scale' : 'reveal';
  return createElement(
    Tag,
    {
      ref,
      style: { transitionDelay: `${delay}ms` },
      className: `${cls} ${inView ? 'in' : ''} ${className}`,
    },
    children
  );
}

/* ─────────────────────────── Nav ─────────────────────────── */

function LandingNav() {
  const [open, setOpen] = useState(false);
  const y = useScroll();
  const elevated = y > 8;

  const links = [
    { href: '#features', label: 'Capabilities' },
    { href: '#how', label: 'Workflow' },
    { href: '#pricing', label: 'Pricing' },
    { href: '#faq', label: 'Security' },
  ];

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-500 ${elevated
          ? 'bg-ink-950/90 backdrop-blur-xl border-b border-white/5 shadow-modal'
          : 'bg-transparent border-b border-transparent'
        }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative w-9 h-9 rounded-xl bg-brand-gradient flex items-center justify-center shadow-elevated group-hover:shadow-brand-glow transition-all duration-300 group-hover:scale-105">
              <ShieldCheck className="w-5 h-5 text-white relative z-10" />
              <div className="absolute inset-0 rounded-xl bg-brand-400 blur-lg opacity-0 group-hover:opacity-40 transition-opacity" />
            </div>
            <span className="font-display font-bold text-lg tracking-tight text-white transition-colors duration-300">
              Examify
              <span className="text-brand-500">.</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-10">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="relative text-xs font-bold uppercase tracking-widest transition-colors group text-ink-400 hover:text-white"
              >
                {l.label}
                <span className="absolute -bottom-1.5 left-0 right-0 h-0.5 bg-brand-600 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300" />
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="hidden sm:inline-flex text-xs font-bold uppercase tracking-widest px-5 py-2 rounded-lg transition-all text-ink-300 hover:text-white hover:bg-white/5"
            >
              Log in
            </Link>
            <Link to="/signup" className="btn btn-md bg-brand-700 text-white hover:bg-brand-600 shadow-elevated group rounded-lg px-6">
              <span className="text-xs font-bold uppercase tracking-widest">Deploy Now</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <button
              onClick={() => setOpen(!open)}
              className="md:hidden p-2 rounded-lg ml-1 transition-colors text-white hover:bg-white/10"
              aria-label="Toggle menu"
            >
              <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {open && (
          <div className="md:hidden pb-6 animate-slide-down">
            <nav className="flex flex-col gap-1 pt-4 border-t border-white/10">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-widest transition-colors text-ink-300 hover:bg-white/5 hover:text-white"
                >
                  {l.label}
                </a>
              ))}
              <Link
                to="/login"
                className="px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-widest transition-colors text-ink-300 hover:bg-white/5 hover:text-white"
              >
                Sign in
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}

/* ─────────────────────────── Hero ─────────────────────────── */

function Hero() {
  const y = useScroll();
  const tiltRef = useMouseTilt<HTMLDivElement>(4);

  return (
    <section className="relative overflow-hidden -mt-20 pt-20 bg-ink-950">
      {/* High-Tech Background */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(122,34,56,0.15),_transparent_70%)]" />
        <div className="absolute inset-0 bg-grid-faint opacity-[0.03] mask-radial-fade" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(13,12,12,0.8)_80%)]" />

        {/* Architectural grid lines */}
        <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-white/5 via-white/[0.02] to-transparent" />
        <div className="absolute top-0 right-1/4 w-px h-full bg-gradient-to-b from-white/5 via-white/[0.02] to-transparent" />

        {/* Floating security orbs */}
        <div
          className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-brand-900/20 blur-[120px] animate-float-slow"
          style={{ transform: `translate3d(0, ${y * -0.15}px, 0)` }}
        />
        <div
          className="absolute top-1/4 -right-40 w-[500px] h-[500px] rounded-full bg-brand-800/10 blur-[100px] animate-float"
          style={{ transform: `translate3d(0, ${y * -0.1}px, 0)` }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-32 lg:pt-36 lg:pb-48">
        <div className="grid lg:grid-cols-12 gap-16 items-center">
          {/* Copy */}
          <div className="lg:col-span-6 relative z-10">
            <Reveal>
              <div className="inline-flex items-center gap-3 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md shadow-inner-soft">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-300">
                  Precision AI Monitoring · v2.4
                </span>
              </div>
            </Reveal>

            <Reveal delay={100}>
              <h1 className="mt-8 text-5xl sm:text-6xl lg:text-[5rem] font-bold tracking-tight2 text-white leading-[0.95] text-balance">
                The standard for{' '}
                <span className="text-gradient-brand animate-gradient-shift filter drop-shadow-[0_0_20px_rgba(177,74,93,0.3)]">
                  academic integrity.
                </span>
              </h1>
            </Reveal>

            <Reveal delay={200}>
              <p className="mt-8 text-lg text-ink-400 leading-relaxed max-w-xl font-medium">
                Eliminate invigilation overhead with Examify’s high-fidelity AI agents.
                Secure, auditable, and built for institutions that demand zero compromise.
              </p>
            </Reveal>

            <Reveal delay={300}>
              <div className="mt-12 flex flex-col sm:flex-row gap-4">
                <Link to="/signup" className="btn btn-xl bg-white text-ink-950 hover:bg-ink-100 shadow-[0_0_40px_rgba(255,255,255,0.15)] group rounded-xl">
                  <span className="text-sm font-bold uppercase tracking-widest">Start Integration</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <a href="#showcase" className="btn btn-xl bg-white/5 text-white border border-white/10 hover:bg-white/10 backdrop-blur-sm group rounded-xl">
                  <Play className="w-4 h-4 fill-white mr-1 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-bold uppercase tracking-widest">Platform Demo</span>
                </a>
              </div>
            </Reveal>

            <Reveal delay={400}>
              <div className="mt-12 pt-8 border-t border-white/5 flex flex-wrap items-center gap-x-8 gap-y-4">
                <div className="flex -space-x-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="w-9 h-9 rounded-full border-2 border-ink-950 bg-ink-800 flex items-center justify-center text-[10px] font-bold text-ink-400">
                      {String.fromCharCode(64 + i)}
                    </div>
                  ))}
                </div>
                <div className="text-xs text-ink-500 font-medium">
                  <span className="text-ink-200 font-bold">4.2M+</span> sessions monitored this semester
                </div>
              </div>
            </Reveal>
          </div>

          {/* Hero visual */}
          <div className="lg:col-span-6 perspective-2000">
            <Reveal variant="scale" delay={200}>
              <div
                ref={tiltRef}
                className="relative will-change-transform"
                style={{ transform: `translate3d(0, ${y * -0.05}px, 0)` }}
              >
                <HeroVisual />
                {/* Decorative elements around the visual */}
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-brand-500/10 blur-[80px] -z-10" />
                <div className="absolute -bottom-20 -left-10 w-60 h-60 bg-brand-700/10 blur-[100px] -z-10" />
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroVisual() {
  return (
    <div className="relative group">
      {/* Command center frame */}
      <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-ink-900 shadow-modal">
        {/* Window controls */}
        <div className="flex items-center justify-between px-5 py-4 bg-ink-950/50 border-b border-white/5 backdrop-blur-md">
          <div className="flex gap-2">
            <span className="w-3 h-3 rounded-full bg-white/10" />
            <span className="w-3 h-3 rounded-full bg-white/10" />
            <span className="w-3 h-3 rounded-full bg-white/10" />
          </div>
          <div className="px-4 py-1.5 bg-ink-900 border border-white/5 rounded-lg text-[10px] font-mono text-ink-400 tracking-wider flex items-center gap-2">
            <Lock className="w-3 h-3 text-success-500" />
            SECURE_ENCLAVE::PROCTOR_GRID
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-danger-500 animate-pulse" />
            <span className="text-[10px] font-bold text-white tracking-widest uppercase">Live</span>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-0">
          {/* Main Feed */}
          <div className="col-span-8 relative aspect-[4/3] bg-black overflow-hidden group/feed">
            {/* Scanline effect */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.01),rgba(0,0,255,0.02))] bg-[length:100%_4px,3px_100%] pointer-events-none z-20" />

            {/* AI HUD overlay */}
            <div className="absolute inset-0 z-10 p-4 flex flex-col justify-between pointer-events-none">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="text-[10px] font-mono text-brand-400 font-bold uppercase tracking-widest">Subject: S_2411</div>
                  <div className="text-[10px] font-mono text-ink-400">FPS: 60.0</div>
                </div>
                <div className="w-12 h-12 border border-white/10 rounded flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
                  <div className="text-[8px] font-bold text-ink-500 uppercase">Risk</div>
                  <div className="text-sm font-bold text-success-500 font-mono">0.02</div>
                </div>
              </div>

              <div className="flex justify-between items-end">
                <div className="flex gap-2">
                  <div className="px-2 py-1 bg-brand-500/10 border border-brand-500/20 rounded text-[9px] font-bold text-brand-400 uppercase tracking-wider">
                    Gaze Tracking Active
                  </div>
                  <div className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[9px] font-bold text-ink-300 uppercase tracking-wider">
                    Audio Spatialized
                  </div>
                </div>
              </div>
            </div>

            {/* Simulated camera feed with face mesh */}
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-ink-900 to-black">
              <svg className="w-full h-full opacity-40" viewBox="0 0 400 300">
                <defs>
                  <mask id="faceMask">
                    <circle cx="200" cy="140" r="70" fill="white" />
                  </mask>
                </defs>
                {/* Face outline */}
                <circle cx="200" cy="140" r="72" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-brand-500/50" />
                {/* HUD Corners */}
                <path d="M100 60 L120 60 M100 60 L100 80" stroke="white" strokeWidth="1" fill="none" opacity="0.3" />
                <path d="M280 60 L300 60 M300 60 L300 80" stroke="white" strokeWidth="1" fill="none" opacity="0.3" />
                <path d="M100 220 L120 220 M100 220 L100 200" stroke="white" strokeWidth="1" fill="none" opacity="0.3" />
                <path d="M280 220 L300 220 M300 220 L300 200" stroke="white" strokeWidth="1" fill="none" opacity="0.3" />

                {/* Simulated Mesh */}
                <g className="text-brand-500/20">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <line key={i} x1="130" y1={100 + i * 8} x2="270" y2={100 + i * 8} stroke="currentColor" strokeWidth="0.5" />
                  ))}
                  {Array.from({ length: 18 }).map((_, i) => (
                    <line key={i} x1={130 + i * 8} y1="100" x2={130 + i * 8} y2="200" stroke="currentColor" strokeWidth="0.5" />
                  ))}
                </g>
              </svg>

              {/* Central crosshair */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-12 h-12 border border-brand-500/40 rounded-full animate-pulse-soft flex items-center justify-center">
                  <div className="w-1 h-1 bg-brand-500 rounded-full" />
                </div>
              </div>
            </div>
          </div>

          {/* Telemetry Panel */}
          <div className="col-span-4 border-l border-white/5 bg-ink-950 p-5 flex flex-col gap-6">
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-ink-500 uppercase tracking-widest">Session ID</div>
              <div className="text-xs font-mono text-white">XF-992-B82</div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider">
                  <span className="text-ink-500">Integrity Index</span>
                  <span className="text-success-500">99.98%</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-success-500 w-[99.98%]" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider">
                  <span className="text-ink-500">Face Match</span>
                  <span className="text-white">Confirmed</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-500 w-[100%]" />
                </div>
              </div>
            </div>

            <div className="mt-auto pt-6 border-t border-white/5 space-y-4">
              <div className="text-[10px] font-bold text-ink-500 uppercase tracking-widest">Active Alerts</div>
              <div className="space-y-3">
                <div className="flex gap-3 items-center opacity-40">
                  <div className="w-1.5 h-1.5 rounded-full bg-success-500" />
                  <div className="text-[10px] font-medium text-white truncate">Mic check passed</div>
                </div>
                <div className="flex gap-3 items-center opacity-40">
                  <div className="w-1.5 h-1.5 rounded-full bg-success-500" />
                  <div className="text-[10px] font-medium text-white truncate">Env calibrated</div>
                </div>
                <div className="flex gap-3 items-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
                  <div className="text-[10px] font-medium text-white truncate font-bold">Monitoring live...</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating data chips */}
      <div className="absolute -bottom-6 -right-6 px-5 py-3 bg-ink-900 border border-white/10 rounded-xl shadow-modal backdrop-blur-md animate-float hidden lg:block">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-brand-500/10 rounded-lg">
            <Activity className="w-5 h-5 text-brand-500" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-ink-500 uppercase tracking-widest">Anomaly Detection</div>
            <div className="text-xs font-bold text-white">Neural Net v4.0 Active</div>
          </div>
        </div>
      </div>
    </div>
  );
}


/* ─────────────────────────── Trust bar (marquee) ─────────────────────────── */

function TrustBar() {
  const orgs = [
    'Riverbend University',
    'Northgate Tech',
    'Elara Institute',
    'Harlow College',
    'Kepler Academy',
    'Avon Polytechnic',
    'Brookline State',
    'Vantage School',
    'Linden University',
  ];
  const items = [...orgs, ...orgs];
  return (
    <section className="py-20 border-y border-white/5 bg-ink-950 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="flex flex-col items-center mb-12">
            <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-500 mb-4">
              Institutional Partners
            </div>
            <div className="h-px w-12 bg-white/10" />
          </div>
        </Reveal>
        <div className="relative mask-fade-x opacity-40 hover:opacity-100 transition-opacity duration-700">
          <div className="marquee-track animate-marquee gap-24">
            {items.map((o, i) => (
              <div
                key={`${o}-${i}`}
                className="flex items-center gap-4 text-white grayscale hover:grayscale-0 transition-all cursor-default"
              >
                <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center border border-white/10">
                  <ShieldCheck className="w-4 h-4 text-brand-400" />
                </div>
                <span className="font-display font-bold tracking-tight text-lg whitespace-nowrap">
                  {o.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── Stats (count-up) ─────────────────────────── */

function Stats() {
  const stats = [
    { value: 99.98, suffix: '%', label: 'Uptime Reliability', sub: 'Enterprise SLA guaranteed', decimals: 2 },
    { value: 120, prefix: '<', suffix: 'ms', label: 'Detection Latency', sub: 'Edge-processed inference' },
    { value: 24, suffix: '/7', label: 'Global Monitoring', sub: 'Continuous AI oversight' },
    { value: 100, suffix: '%', label: 'Data Residency', sub: 'GDPR & FERPA compliant' },
  ];

  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <section className="py-24 lg:py-32 relative bg-black">
      <div
        aria-hidden
        className="absolute inset-0 bg-grid-faint opacity-[0.03] mask-radial-fade pointer-events-none"
      />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          ref={ref}
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-white/5 border border-white/5 rounded-3xl overflow-hidden shadow-modal"
        >
          {stats.map((s, i) => (
            <StatCell
              key={s.label}
              {...s}
              start={inView}
              delay={i * 100}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function StatCell({
  value,
  prefix = '',
  suffix = '',
  label,
  sub,
  decimals = 0,
  start,
  delay,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  label: string;
  sub: string;
  decimals?: number;
  start: boolean;
  delay: number;
}) {
  const v = useCountUp(value, 2000, start);
  const display = decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString();
  return (
    <div
      className="relative p-10 bg-black/40 backdrop-blur-sm reveal group"
      style={{ transitionDelay: `${delay}ms` }}
      data-in={start ? 'true' : undefined}
      ref={(el) => {
        if (el && start) el.classList.add('in');
      }}
    >
      <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-all duration-500">
        <Activity className="w-5 h-5 text-brand-500/50" />
      </div>
      <div className="text-4xl lg:text-5xl font-bold tracking-tight2 text-white tabular-nums">
        <span className="text-brand-500 drop-shadow-[0_0_15px_rgba(177,74,93,0.4)]">{prefix}</span>
        {display}
        <span className="text-brand-500 drop-shadow-[0_0_15px_rgba(177,74,93,0.4)]">{suffix}</span>
      </div>
      <div className="mt-6 text-[10px] font-bold uppercase tracking-[0.2em] text-white">{label}</div>
      <div className="mt-2 text-xs text-ink-500 font-medium leading-relaxed">{sub}</div>
    </div>
  );
}


/* ─────────────────────────── Features ─────────────────────────── */

function Features() {
  const features = [
    {
      icon: ScanFace,
      title: 'Biometric Verification',
      body: 'Zero-trust identity validation using multi-point facial recognition and liveness detection. FERPA-compliant ID matching.',
    },
    {
      icon: Eye,
      title: 'Neural Gaze Tracking',
      body: 'Proprietary eye-tracking models detect off-screen glancing and pupil anomalies with sub-degree precision.',
    },
    {
      icon: Brain,
      title: 'Heuristic Risk Scoring',
      body: 'Aggregation of 40+ behavioral signals into a singular, defensible integrity score. Full decision provenance included.',
    },
    {
      icon: Mic,
      title: 'Spatial Audio Analysis',
      body: 'Differential audio processing identifies secondary voices and non-ambient whispering within the local environment.',
    },
    {
      icon: AlertTriangle,
      title: 'Dynamic Violation Logic',
      body: 'Customizable policy engines allow institutions to define violation thresholds per exam, per department, or per faculty.',
    },
    {
      icon: BarChart3,
      title: 'Institutional Analytics',
      body: 'Cross-cohort integrity mapping. Identify systemic anomalies and track proctoring efficacy across the entire institution.',
    },
  ];

  return (
    <section id="features" className="py-24 lg:py-36 bg-black relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 bg-grid-faint opacity-[0.03] mask-radial-fade pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Capabilities"
          title="Engineered for institutional scale."
          subtitle="Examify provides the technical infrastructure to run thousands of concurrent, high-stakes exams with automated oversight that holds up in any academic review."
        />

        <div className="mt-24 grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={i * 80}>
              <FeatureCard icon={f.icon} title={f.title} body={f.body} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Eye;
  title: string;
  body: string;
}) {
  const onMove = (e: RMouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  return (
    <div
      onMouseMove={onMove}
      className="group relative p-10 rounded-3xl bg-white/[0.02] border border-white/5 transition-all duration-500 hover:border-brand-500/30 hover:shadow-modal overflow-hidden"
    >
      {/* Interactive spotlight */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: 'radial-gradient(400px circle at var(--mx,50%) var(--my,50%), rgba(122,34,56,0.1), transparent 80%)',
        }}
      />

      <div className="relative z-10">
        <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-8 group-hover:bg-brand-700 transition-all duration-500 shadow-elevated">
          <Icon className="w-6 h-6 text-white" />
        </div>
        <h3 className="text-xl font-bold text-white mb-4 tracking-tight">{title}</h3>
        <p className="text-sm text-ink-400 leading-relaxed font-medium">{body}</p>
        <div className="mt-8 pt-8 border-t border-white/5 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-500">Node::Active</span>
          <ArrowRight className="w-5 h-5 text-ink-600 group-hover:text-brand-500 group-hover:translate-x-1 transition-all duration-300" />
        </div>
      </div>
    </div>
  );
}


/* ─────────────────────────── Product Showcase ─────────────────────────── */

function ProductShowcase() {
  const { ref: parRef, offset } = useParallax<HTMLDivElement>(0.08);
  const tiltRef = useMouseTilt<HTMLDivElement>(3);

  const points = [
    {
      icon: Camera,
      title: 'Synchronous Grid View',
      body: 'Monitor hundreds of live feeds in a single low-latency console. Intelligent auto-sorting surfaces high-risk sessions.',
    },
    {
      icon: Activity,
      title: 'Evidence-First Review',
      body: 'Every AI flag is linked to a cryptographic evidence packet, including gaze heatmaps and timestamped audio captures.',
    },
    {
      icon: FileCheck,
      title: 'Verified Export Engine',
      body: 'Generate digitally signed PDF reports that provide a transparent audit trail for disciplinary committees.',
    },
  ];

  return (
    <section id="showcase" className="py-24 lg:py-36 relative overflow-hidden bg-ink-950">
      <div aria-hidden className="absolute inset-0 bg-grid-dots opacity-[0.05] mask-radial-fade pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-12 gap-20 items-center">
          <div className="lg:col-span-5 relative z-10">
            <Reveal>
              <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-500 mb-6">
                The Console
              </div>
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight2 text-white leading-[1.1]">
                Command & control, <br />
                <span className="text-ink-400">redefined.</span>
              </h2>
              <p className="mt-6 text-lg text-ink-400 leading-relaxed font-medium">
                We’ve replaced the human bottleneck with a high-fidelity monitoring stack. Instructors stop invigilating and start reviewing evidence.
              </p>
            </Reveal>

            <ul className="mt-12 space-y-8">
              {points.map((p, i) => (
                <Reveal key={p.title} delay={100 + i * 100}>
                  <li className="flex gap-6 group">
                    <div className="shrink-0 w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-brand-700/20 group-hover:border-brand-700/40 transition-all duration-300">
                      <p.icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-base font-bold text-white tracking-tight">{p.title}</div>
                      <div className="text-sm text-ink-500 mt-1 leading-relaxed font-medium">{p.body}</div>
                    </div>
                  </li>
                </Reveal>
              ))}
            </ul>

            <Reveal delay={500}>
              <div className="mt-12">
                <Link to="/signup" className="btn btn-lg bg-brand-700 text-white hover:bg-brand-600 shadow-brand-glow group rounded-xl px-8">
                  <span className="text-xs font-bold uppercase tracking-widest">Access Control Panel</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </Reveal>
          </div>

          <div className="lg:col-span-7 perspective-2000" ref={parRef}>
            <Reveal variant="scale" delay={200}>
              <div
                ref={tiltRef}
                style={{ transform: `translate3d(0, ${offset}px, 0)` }}
                className="will-change-transform"
              >
                <DashboardMock />
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

function DashboardMock() {
  return (
    <div className="relative">
      <div className="absolute inset-0 -z-10 rounded-3xl bg-brand-500/10 blur-[100px] opacity-50" />
      <div className="card border-white/10 bg-ink-900 shadow-modal overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-ink-950/50 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-lg bg-brand-gradient flex items-center justify-center shadow-soft">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-white tracking-tight">CS-301 · ADVANCED SYSTEMS</div>
              <div className="text-[10px] font-mono text-ink-500 uppercase tracking-widest">Active Cluster: US-EAST-1</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-danger-500 animate-pulse" />
            <span className="text-[10px] font-bold text-white tracking-widest uppercase">Live Oversight</span>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-0">
          <div className="hidden md:block col-span-3 border-r border-white/5 bg-ink-950/30 p-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-500 mb-4">
              ROOMS_INDEX
            </div>
            <ul className="space-y-2">
              {[
                ['CS-301 :: FINALS', '42', true],
                ['MATH-210 :: QUIZ', '18', false],
                ['BIO-115 :: MID', '67', false],
                ['ECON-220 :: SIT', '9', false],
              ].map(([n, c, active]) => (
                <li
                  key={n as string}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-[10px] transition-all duration-300 ${active
                      ? 'bg-white/5 border border-white/10 shadow-soft text-white font-bold'
                      : 'text-ink-500 hover:text-ink-300 hover:bg-white/[0.02]'
                    }`}
                >
                  <span className="truncate">{n as string}</span>
                  <span className="font-mono text-brand-500">[{c as string}]</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-span-12 md:col-span-9 p-5 bg-ink-900/50">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { name: 'SARA NEILL', score: 98, status: 'good' as const, viol: 0 },
                { name: 'DAN KLINE', score: 71, status: 'warn' as const, viol: 2 },
                { name: 'MAYA ROSSI', score: 88, status: 'good' as const, viol: 1 },
                { name: 'OMAR BAKRI', score: 42, status: 'bad' as const, viol: 5 },
                { name: 'INES TERA', score: 96, status: 'good' as const, viol: 0 },
                { name: 'THEO PARK', score: 79, status: 'warn' as const, viol: 2 },
              ].map((s) => (
                <StudentTile key={s.name} {...s} />
              ))}
            </div>

            <div className="mt-6 panel border-white/5 bg-black/40 p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-500">
                  CRITICAL_TELEMETRY
                </span>
                <span className="text-[9px] font-mono text-ink-600">POLLING_RATE::10ms</span>
              </div>
              <ul className="space-y-2">
                <AlertRow severity="bad" who="OMAR B." what="MULTI_FACE_DETECTED" time="12:14:02" />
                <AlertRow severity="warn" who="DAN K." what="GAZE_DEVIATION > 3S" time="12:13:48" />
                <AlertRow severity="warn" who="THEO P." what="AMBIENT_VOICE_SIG" time="12:13:21" />
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StudentTile({
  name,
  score,
  status,
}: {
  name: string;
  score: number;
  status: 'good' | 'warn' | 'bad';
}) {
  const ring =
    status === 'good' ? 'ring-success-500/20' : status === 'warn' ? 'ring-warning-500/20' : 'ring-danger-500/20';
  const dot =
    status === 'good' ? 'status-dot-good' : status === 'warn' ? 'status-dot-warn' : 'status-dot-bad';
  const fillClass =
    status === 'good' ? 'bg-success-500' : status === 'warn' ? 'bg-warning-500' : 'bg-danger-500';
  return (
    <div
      className={`bg-ink-950 rounded-xl border border-white/5 ring-1 ring-inset ${ring} p-3 hover:bg-ink-800 transition-all duration-300 cursor-default group/tile`}
    >
      <div className="aspect-video rounded-lg bg-black mb-3 relative overflow-hidden">
        {/* Grid lines */}
        <div className="absolute inset-0 bg-grid-faint opacity-[0.05]" />
        <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 200 110" preserveAspectRatio="xMidYMid slice">
          <ellipse cx="100" cy="110" rx="60" ry="30" fill="white" />
          <circle cx="100" cy="55" r="18" fill="white" />
        </svg>
        <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded bg-black/60 backdrop-blur text-[8px] font-bold text-white tracking-widest border border-white/5">
          <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
          SENSE_LIVE
        </div>
      </div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-white truncate tracking-tight">{name}</span>
        <span className={`text-[10px] font-mono font-bold ${score > 80 ? 'text-success-500' : score > 60 ? 'text-warning-500' : 'text-danger-500'}`}>{score}</span>
      </div>
      <div className="risk-meter-track h-1 bg-white/5">
        <div className={`risk-meter-fill ${fillClass}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function AlertRow({
  severity,
  who,
  what,
  time,
}: {
  severity: 'warn' | 'bad';
  who: string;
  what: string;
  time: string;
}) {
  return (
    <li className="flex items-center gap-4 text-[9px] font-mono animate-slide-down border-b border-white/[0.03] pb-2 last:border-0 last:pb-0">
      <span className={`font-bold px-1.5 py-0.5 rounded ${severity === 'bad' ? 'bg-danger-500/10 text-danger-500' : 'bg-warning-500/10 text-warning-500'}`}>
        {severity === 'bad' ? 'CRITICAL' : 'WARNING'}
      </span>
      <span className="text-white font-bold">{who}</span>
      <span className="text-ink-500">{what}</span>
      <span className="ml-auto text-ink-600 tabular-nums">{time}</span>
    </li>
  );
}


/* ─────────────────────────── How it works ─────────────────────────── */

function HowItWorks() {
  const steps = [
    {
      n: '01',
      title: 'Infrastructure Setup',
      body: 'Integrate via LTI 1.3 or our robust REST API. Define institutional policies, verification depth, and custom risk weighting.',
      icon: Server,
    },
    {
      n: '02',
      title: 'Automated Deployment',
      body: 'Students access via standard browsers. AI agents handle biometric onboarding, environmental scans, and identity matching.',
      icon: Zap,
    },
    {
      n: '03',
      title: 'Auditable Reporting',
      body: 'Receive a cryptographic evidence report per candidate. Rank and review high-risk events with full temporal precision.',
      icon: ShieldCheck,
    },
  ];
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <section id="how" className="py-24 lg:py-40 bg-black border-y border-white/5 relative">
      <div aria-hidden className="absolute inset-0 bg-grid-faint opacity-[0.02] mask-radial-fade pointer-events-none" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Workflow"
          title="Designed for high-stakes deployment."
          subtitle="From initial configuration to final evidence review, Examify is built to handle the complexities of institutional scale."
        />

        <div ref={ref} className="mt-24 grid md:grid-cols-3 gap-12 relative">
          {/* Technical connector line */}
          <div className="hidden md:block absolute top-14 left-[15%] right-[15%] h-px bg-white/5 pointer-events-none">
            <div
              className="h-full bg-brand-600 shadow-[0_0_10px_rgba(177,74,93,0.5)] transition-all duration-1000 ease-out"
              style={{ width: inView ? '100%' : '0%' }}
            />
          </div>

          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 160}>
              <div className="relative flex flex-col items-center text-center group">
                <div className="relative w-24 h-24 rounded-[2rem] bg-white/5 text-white flex items-center justify-center shadow-modal mb-10 group-hover:bg-brand-700 transition-all duration-500 z-10 border border-white/10 group-hover:border-brand-500/50">
                  <s.icon className="w-10 h-10" />
                  <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-xl bg-brand-500 text-xs font-bold flex items-center justify-center border-4 border-black text-white">
                    {s.n}
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-white tracking-tight">{s.title}</h3>
                <p className="mt-4 text-base text-ink-400 leading-relaxed font-medium max-w-[280px]">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── Use cases ─────────────────────────── */

function UseCases() {
  const cases = [
    {
      icon: GraduationCap,
      title: 'Higher Education',
      body: 'Standardize proctoring across all faculties with department-level policy control and SSO provisioning.',
      points: ['Centralized Administration', 'Academic Review Export', 'SSO/LTI Integration'],
    },
    {
      icon: Briefcase,
      title: 'Professional Certification',
      body: 'Issue high-stakes credentials with confidence. Tamper-evident session logs and public verification links.',
      points: ['Cryptographic Signing', 'Identity Ledger', 'Candidate Onboarding'],
    },
    {
      icon: Building2,
      title: 'Enterprise Compliance',
      body: 'Audit-ready assessment for regulated industries. Prove attention and verify training outcomes at scale.',
      points: ['SCIM & Audit Logging', 'Custom Data Regions', 'SLA Guarantees'],
    },
  ];
  return (
    <section className="py-24 lg:py-40 relative overflow-hidden bg-black">
      <div aria-hidden className="absolute inset-0 bg-grid-dots opacity-10 mask-radial-fade pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            eyebrow="Deployment"
            title="Institutional grade proctoring."
            subtitle="One platform, multiple specialized workflows. Built for the organizations that define global standards."
          />
        </Reveal>
        <div className="mt-24 grid md:grid-cols-3 gap-8">
          {cases.map((c, i) => (
            <Reveal key={c.title} delay={i * 120}>
              <div className="relative p-12 rounded-[2.5rem] bg-white/[0.02] border border-white/5 shadow-modal hover:border-brand-500/20 hover:-translate-y-1 transition-all duration-500 group overflow-hidden h-full">
                <div className="absolute top-0 right-0 w-48 h-48 bg-brand-500/5 blur-[80px] rounded-full translate-x-1/2 -translate-y-1/2 group-hover:bg-brand-500/10 transition-colors" />
                <div className="w-16 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-10 group-hover:bg-brand-700 transition-all duration-500 shadow-soft">
                  <c.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-3xl font-bold text-white tracking-tight">{c.title}</h3>
                <p className="mt-6 text-base text-ink-400 leading-relaxed font-medium">{c.body}</p>
                <ul className="mt-10 space-y-4">
                  {c.points.map((p) => (
                    <li key={p} className="flex items-center gap-4 text-xs font-bold text-ink-200 uppercase tracking-widest">
                      <div className="w-2 h-2 rounded-full bg-brand-500 shadow-[0_0_10px_rgba(177,74,93,0.5)]" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── Comparison ─────────────────────────── */

function Comparison() {
  const rows: { label: string; legacy: string | boolean; examify: string | boolean }[] = [
    { label: 'Integration Phase', legacy: '4–8 Weeks', examify: 'Instant / < 24h' },
    { label: 'Infrastructure Footprint', legacy: 'High (Agent required)', examify: 'Zero (Browser-native)' },
    { label: 'Monitoring Overhead', legacy: '1 Invigilator : 20 Students', examify: '1 AI : 10,000 Students' },
    { label: 'Decision Latency', legacy: '24–48 Hours', examify: 'Real-time (< 200ms)' },
    { label: 'Evidence Quality', legacy: 'Manual recording', examify: 'Neural Event Metadata' },
    { label: 'Unit Economics', legacy: '$12–$25 per seat', examify: 'From $0.35 per session' },
  ];
  return (
    <section className="py-24 lg:py-40 bg-black">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            eyebrow="Analysis"
            title="The technical advantage."
            subtitle="Legacy proctoring is a human solution to a digital problem. Examify is the first purpose-built AI stack for high-stakes assessment."
          />
        </Reveal>
        <Reveal delay={120}>
          <div className="mt-20 rounded-[2.5rem] border border-white/5 overflow-hidden shadow-modal bg-white/[0.01] backdrop-blur-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/5">
                  <th className="px-10 py-8 text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 w-1/2">Metric</th>
                  <th className="px-10 py-8 text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">Legacy</th>
                  <th className="px-10 py-8 text-[10px] font-bold uppercase tracking-[0.3em] text-brand-400">Examify</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((r) => (
                  <tr key={r.label} className="group hover:bg-white/[0.02] transition-colors">
                    <td className="px-10 py-8 text-base font-bold text-white tracking-tight">{r.label}</td>
                    <td className="px-10 py-8 text-base font-medium text-ink-500">{r.legacy}</td>
                    <td className="px-10 py-8 text-base font-bold text-brand-400 tabular-nums drop-shadow-[0_0_10px_rgba(177,74,93,0.3)]">{r.examify}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─────────────────────────── Security ─────────────────────────── */

function Security() {
  const badges = ['SOC 2 Type II', 'GDPR', 'FERPA', 'ISO 27001', 'HIPAA'];
  const pillars = [
    {
      icon: Lock,
      title: 'Cryptographic Security',
      body: 'AES-256-GCM encryption at rest and in transit. Immutable session logs with hash verification.',
    },
    {
      icon: Server,
      title: 'Sovereign Data Regions',
      body: 'Deploy to specific regions (EU, US, APAC) or your own private cloud infrastructure.',
    },
    {
      icon: Shield,
      title: 'Privacy Preserving ML',
      body: 'On-device inference minimizes data exposure. We do not train models on institutional data.',
    },
  ];
  return (
    <section className="py-24 lg:py-48 relative overflow-hidden bg-black">
      <div aria-hidden className="absolute inset-0 bg-grid-faint opacity-[0.03] mask-radial-fade pointer-events-none" />
      <div
        aria-hidden
        className="absolute -top-60 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] rounded-full bg-brand-900/10 blur-[160px] pointer-events-none"
      />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-12 gap-24 items-center">
          <div className="lg:col-span-6">
            <Reveal>
              <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-500 mb-8">
                Compliance
              </div>
              <h2 className="text-5xl sm:text-6xl font-bold tracking-tight2 text-white leading-[1] text-balance">
                Zero-trust proctoring. <br />
                <span className="text-ink-400">Total compliance.</span>
              </h2>
              <p className="mt-10 text-xl text-ink-400 leading-relaxed font-medium">
                We’ve taken the most rigorous path to security so your legal and privacy teams don’t have to. Examify meets the world’s most demanding data standards.
              </p>
              <div className="mt-12 flex flex-wrap gap-4">
                {badges.map((b) => (
                  <span
                    key={b}
                    className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-white/10 hover:border-white/20 transition-all cursor-default"
                  >
                    {b}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>

          <div className="lg:col-span-6 grid gap-6">
            {pillars.map((p, i) => (
              <Reveal key={p.title} delay={120 + i * 100}>
                <div className="group p-10 rounded-3xl bg-white/[0.02] border border-white/5 hover:border-brand-500/30 hover:bg-white/[0.04] transition-all duration-500 shadow-modal">
                  <div className="flex gap-8">
                    <div className="shrink-0 w-16 h-16 rounded-2xl bg-brand-700 flex items-center justify-center shadow-brand-glow group-hover:scale-110 transition-transform duration-500">
                      <p.icon className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-white tracking-tight">{p.title}</div>
                      <div className="text-base text-ink-400 mt-4 leading-relaxed font-medium">{p.body}</div>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}



/* ─────────────────────────── Testimonials ─────────────────────────── */

function Testimonials() {
  const quotes = [
    {
      quote:
        'Examify allowed us to scale our online finals to 14,000 concurrent sessions without a single infrastructure failure. The integrity data is beyond anything we have seen.',
      author: 'Dr. Elizabeth Chen',
      role: 'CIO, Riverbend University',
    },
    {
      quote:
        'The ability to export signed, evidence-grade reports has fundamentally changed how we handle academic appeals. It is a level of transparency that is long overdue.',
      author: 'Marcus Aldridge',
      role: 'Director of Assessment, Northgate Tech',
    },
    {
      quote:
        'Zero-trust proctoring is the future. Examify has proven that AI can be more accurate and less invasive than traditional human invigilation.',
      author: 'Priya Raman',
      role: 'VP of Engineering, Elara Institute',
    },
  ];
  return (
    <section className="py-24 lg:py-40 bg-black relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 bg-grid-faint opacity-[0.02] mask-radial-fade pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading eyebrow="Verification" title="Proven at institutional scale." />
        </Reveal>
        <div className="mt-24 grid md:grid-cols-3 gap-8">
          {quotes.map((q, i) => (
            <Reveal key={q.author} delay={i * 140}>
              <figure className="relative p-12 rounded-[2.5rem] bg-white/[0.02] border border-white/5 flex flex-col h-full group hover:bg-white/[0.04] hover:border-brand-500/20 transition-all duration-500 shadow-modal">
                <div className="flex gap-1 text-brand-500 mb-8">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Star key={idx} className="w-5 h-5 fill-brand-500 drop-shadow-[0_0_8px_rgba(177,74,93,0.5)]" />
                  ))}
                </div>
                <blockquote className="text-xl text-ink-300 font-medium leading-relaxed flex-1 italic">
                  &ldquo;{q.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-10 pt-10 border-t border-white/5">
                  <div className="text-base font-bold text-white uppercase tracking-widest">{q.author}</div>
                  <div className="text-[10px] font-bold text-brand-500 uppercase tracking-[0.3em] mt-2">{q.role}</div>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── Pricing ─────────────────────────── */

function Pricing() {
  const [annual, setAnnual] = useState(true);

  const tiers = [
    {
      name: 'Standard Cluster',
      blurb: 'For individual departments and specialized programs.',
      monthly: 499,
      annual: 399,
      cta: 'Deploy Node',
      to: '/signup',
      highlight: false,
      features: ['Up to 1,000 sessions / mo', 'Full AI suite included', 'LTI 1.3 integration', '99.9% Uptime SLA'],
      meta: 'v2.4 Core'
    },
    {
      name: 'Institutional Cluster',
      blurb: 'Institutional scale with custom governance and priority.',
      monthly: 1299,
      annual: 999,
      cta: 'Deploy Global',
      to: '/signup',
      highlight: true,
      features: [
        'Unlimited sessions',
        'Multi-region data pinning',
        'Private Cloud deployment',
        'Dedicated Solutions Architect',
        'Custom Risk Weighting',
      ],
      meta: 'Recommended'
    },
    {
      name: 'Sovereign Node',
      blurb: 'Highest-level security for state and govt certification.',
      monthly: null as number | null,
      annual: null as number | null,
      cta: 'Contact Sales',
      to: '/signup',
      highlight: false,
      features: [
        'Air-gapped deployment',
        'FIPS 140-2 compliance',
        'Custom audit frequency',
        'On-premise AI models',
        '24/7 Priority Support',
      ],
      meta: 'L4 Security'
    },
  ];

  return (
    <section id="pricing" className="py-24 lg:py-48 bg-black relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 bg-grid-dots opacity-10 mask-radial-fade pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            eyebrow="Licensing"
            title="Transparent pricing for <br /><span className='text-brand-500'>secure infrastructure.</span>"
            subtitle="Deploy the world’s most advanced proctoring stack with zero hidden fees and predictable institutional costs."
          />
        </Reveal>

        <Reveal delay={120}>
          <div className="mt-16 flex justify-center">
            <div className="inline-flex items-center p-2 bg-white/[0.03] border border-white/10 rounded-2xl shadow-modal backdrop-blur-xl">
              <button
                onClick={() => setAnnual(false)}
                className={`px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-[0.2em] transition-all duration-300 ${!annual ? 'bg-brand-700 text-white shadow-brand-glow' : 'text-ink-500 hover:text-white'
                  }`}
              >
                On-Demand
              </button>
              <button
                onClick={() => setAnnual(true)}
                className={`px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-[0.2em] transition-all duration-300 inline-flex items-center gap-3 ${annual ? 'bg-brand-700 text-white shadow-brand-glow' : 'text-ink-500 hover:text-white'
                  }`}
              >
                Annual
                <span className="px-2 py-0.5 rounded bg-brand-500/20 text-[10px] text-brand-400 border border-brand-500/30">
                  -20%
                </span>
              </button>
            </div>
          </div>
        </Reveal>

        <div className="mt-20 grid lg:grid-cols-3 gap-8 items-stretch">
          {tiers.map((t, i) => (
            <Reveal key={t.name} delay={i * 120} variant="scale">
              <div
                className={`relative flex flex-col p-12 rounded-[2.5rem] border transition-all duration-700 h-full overflow-hidden ${t.highlight
                    ? 'bg-ink-950 text-white border-brand-500 shadow-modal scale-105 z-10'
                    : 'bg-white/[0.02] border-white/5 shadow-modal hover:border-brand-500/20'
                  }`}
              >
                {t.highlight && (
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(122,34,56,0.15),_transparent_70%)] pointer-events-none" />
                )}

                <div className="flex justify-between items-start mb-8">
                  <div className={`text-[10px] font-bold uppercase tracking-[0.3em] ${t.highlight ? 'text-brand-400' : 'text-ink-500'}`}>
                    {t.meta}
                  </div>
                  {t.highlight && (
                    <Sparkles className="w-5 h-5 text-brand-500 animate-pulse-soft" />
                  )}
                </div>

                <h3 className="text-3xl font-bold text-white tracking-tight">{t.name}</h3>
                <p className={`mt-4 text-base font-medium leading-relaxed ${t.highlight ? 'text-ink-400' : 'text-ink-500'}`}>{t.blurb}</p>

                <div className="mt-12 flex items-baseline gap-3">
                  {t.monthly === null ? (
                    <span className="text-5xl font-bold tracking-tight2 text-white">Custom</span>
                  ) : (
                    <>
                      <span className="text-6xl font-bold tracking-tight2 text-white tabular-nums drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                        ${annual ? t.annual : t.monthly}
                      </span>
                      <div className="flex flex-col">
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${t.highlight ? 'text-ink-600' : 'text-ink-400'}`}>per month</span>
                        <span className="text-[9px] font-mono text-brand-500">BILLED_ANNUALLY</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="mt-12 pt-10 border-t border-white/5 space-y-6 flex-1">
                  {t.features.map((f) => (
                    <div
                      key={f}
                      className={`flex items-start gap-4 text-base font-medium ${t.highlight ? 'text-ink-200' : 'text-ink-400'}`}
                    >
                      <CheckCircle2
                        className={`w-6 h-6 shrink-0 mt-0.5 ${t.highlight ? 'text-brand-500 shadow-brand-glow' : 'text-brand-700'}`}
                      />
                      {f}
                    </div>
                  ))}
                </div>

                <Link
                  to={t.to}
                  className={`mt-12 btn btn-xl w-full group rounded-2xl ${t.highlight ? 'bg-white text-ink-950 hover:bg-ink-100 shadow-elevated' : 'bg-white/5 text-white border border-white/10 hover:bg-white/10'
                    }`}
                >
                  <span className="text-sm font-bold uppercase tracking-[0.2em]">{t.cta}</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── FAQ ─────────────────────────── */

function FAQ() {
  const items = [
    {
      icon: Globe,
      q: 'How does Examify handle data residency requirements?',
      a: 'Examify offers region-pinned deployments across AWS and Azure global clusters. Institutional clients can designate specific geographic regions for all evidence and PII storage, ensuring full compliance with local mandates like GDPR and PDPA.',
    },
    {
      icon: Activity,
      q: 'What is the false-positive mitigation strategy?',
      a: 'Our heuristic engine uses a multi-factor confidence threshold. No session is flagged based on a single signal. Instructors are presented with a ranked risk score and the raw biometric evidence needed to make a final academic determination.',
    },
    {
      icon: Server,
      q: 'Can models be deployed to air-gapped environments?',
      a: 'Yes. Our Sovereign Node support air-gapped and on-premise deployments where AI models run entirely within your private infrastructure, with zero outbound telemetry or external dependencies.',
    },
    {
      icon: ScanFace,
      q: 'What accessibility standards do you conform to?',
      a: 'Examify is built to WCAG 2.2 Level AA standards. We support screen readers, keyboard-only navigation, and offer customizable accommodation settings that adjust AI sensitivity for students with specific physical or neurodivergent needs.',
    },
    {
      icon: Lock,
      q: 'How do you prevent AI model bias?',
      a: 'We use diverse, globally representative training sets and perform regular algorithmic audits to ensure our facial recognition and liveness detection models perform consistently across all skin tones, lighting conditions, and demographics.',
    },
  ];

  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="py-24 lg:py-48 bg-black border-y border-white/5">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading eyebrow="Governance" title="Technical Framework" />
        </Reveal>
        <div className="mt-24 space-y-4">
          {items.map((it, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={i} delay={i * 60}>
                <div className={`rounded-3xl border transition-all duration-500 ${isOpen ? 'bg-white/[0.04] border-brand-500/30' : 'bg-white/[0.01] border-white/5 hover:border-white/10'}`}>
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="w-full flex items-center justify-between gap-8 p-10 text-left group"
                    aria-expanded={isOpen}
                  >
                    <div className="flex items-center gap-8">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 ${isOpen ? 'bg-brand-700 text-white shadow-brand-glow' : 'bg-white/5 text-ink-500'}`}>
                        <it.icon className="w-6 h-6" />
                      </div>
                      <span className="text-xl font-bold text-white tracking-tight group-hover:text-brand-400 transition-colors">
                        {it.q}
                      </span>
                    </div>
                    <div className={`w-8 h-8 rounded-full border border-white/10 flex items-center justify-center transition-all duration-500 ${isOpen ? 'rotate-180 border-brand-500/50 bg-brand-500/10' : ''}`}>
                      <ChevronDown className={`w-4 h-4 transition-colors ${isOpen ? 'text-brand-500' : 'text-ink-500'}`} />
                    </div>
                  </button>
                  <div
                    className="grid transition-[grid-template-rows] duration-500 ease-out"
                    style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
                  >
                    <div className="overflow-hidden">
                      <div className="pb-10 pl-[7rem] pr-16 text-lg text-ink-400 font-medium leading-relaxed">{it.a}</div>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}


/* ─────────────────────────── Final CTA ─────────────────────────── */

function FinalCTA() {
  const ctaRef = useRef<HTMLDivElement | null>(null);
  const onMove = (e: RMouseEvent<HTMLDivElement>) => {
    const el = ctaRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  return (
    <section className="py-24 lg:py-40 bg-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal variant="scale">
          <div
            ref={ctaRef}
            onMouseMove={onMove}
            className="relative overflow-hidden rounded-[3rem] bg-ink-950 text-white px-8 py-24 sm:px-20 sm:py-32 shadow-modal border border-white/5"
          >
            {/* Dark mesh background */}
            <div
              aria-hidden
              className="absolute inset-0 bg-aurora-deep animate-aurora opacity-30"
            />
            {/* Precision grid */}
            <div
              aria-hidden
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage:
                  'linear-gradient(to right,white 1px,transparent 1px),linear-gradient(to bottom,white 1px,transparent 1px)',
                backgroundSize: '48px 48px',
                maskImage: 'radial-gradient(ellipse at center,black 40%,transparent 80%)',
                WebkitMaskImage: 'radial-gradient(ellipse at center,black 40%,transparent 80%)',
              }}
            />
            {/* Interactive light spotlight - NO WHITE SPACES in the background value as requested */}
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                background:'radial-gradient(600px circle at var(--mx,50%) var(--my,50%),rgba(122,34,56,0.25),transparent 70%)',
              }}
            />

            <div className="relative max-w-3xl mx-auto text-center">
              <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md text-[10px] font-bold uppercase tracking-[0.3em] text-brand-400">
                Institutional Deployment
              </div>
              <h2 className="mt-10 text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight2 leading-[1] text-balance">
                Secure your next <br />
                <span className="text-gradient-brand animate-gradient-shift">assessment cycle.</span>
              </h2>
              <p className="mt-10 text-xl text-ink-400 font-medium leading-relaxed">
                Join 200+ institutions that have standardized their online exams with Examify’s neural proctoring stack.
              </p>
              <div className="mt-14 flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/signup"
                  className="btn btn-xl bg-white text-ink-950 hover:bg-ink-100 shadow-elevated group rounded-2xl px-12"
                >
                  <span className="text-sm font-bold uppercase tracking-widest">Deploy Examify</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  to="/login"
                  className="btn btn-xl bg-white/5 text-white hover:bg-white/10 border border-white/10 backdrop-blur-sm rounded-2xl px-12"
                >
                  <span className="text-sm font-bold uppercase tracking-widest">Consult Sales</span>
                </Link>
              </div>

              <div className="mt-16 flex items-center justify-center gap-12">
                 <div className="flex flex-col items-center gap-2">
                    <div className="text-3xl font-bold text-white tracking-tight">24h</div>
                    <div className="text-[10px] font-bold text-ink-500 uppercase tracking-widest">Setup Time</div>
                 </div>
                 <div className="w-px h-12 bg-white/10" />
                 <div className="flex flex-col items-center gap-2">
                    <div className="text-3xl font-bold text-white tracking-tight">99.9%</div>
                    <div className="text-[10px] font-bold text-ink-500 uppercase tracking-widest">SLA Uptime</div>
                 </div>
                 <div className="w-px h-12 bg-white/10" />
                 <div className="flex flex-col items-center gap-2">
                    <div className="text-3xl font-bold text-white tracking-tight">SOC 2</div>
                    <div className="text-[10px] font-bold text-ink-500 uppercase tracking-widest">Compliance</div>
                 </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
/* ─────────────────────────── Footer ─────────────────────────── */

function Footer() {
  const cols: { title: string; links: string[] }[] = [
    { title: 'Platform', links: ['Neural Engine', 'Console', 'Evidence Hub', 'Integrations'] },
    { title: 'Governance', links: ['Security', 'Privacy Policy', 'DPA', 'Trust Center'] },
    { title: 'Support', links: ['Documentation', 'SLA Status', 'API Reference', 'Direct Support'] },
    { title: 'Organization', links: ['About', 'Careers', 'Press', 'Brand Assets'] },
  ];
  return (
    <footer className="bg-ink-950 text-ink-300 relative overflow-hidden border-t border-white/5">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="grid lg:grid-cols-12 gap-16">
          <div className="lg:col-span-4">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-gradient flex items-center justify-center shadow-elevated">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <span className="font-bold text-xl text-white tracking-tight">Examify<span className="text-brand-500">.</span></span>
            </Link>
            <p className="mt-6 text-base text-ink-400 leading-relaxed max-w-sm font-medium">
              The high-fidelity proctoring infrastructure for global institutions.
              Built for integrity, verified by evidence.
            </p>
            <div className="mt-8 flex gap-4">
              {[Twitter, Linkedin, Github].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:scale-105 transition-all flex items-center justify-center"
                  aria-label="social"
                >
                  <Icon className="w-5 h-5 text-ink-300" />
                </a>
              ))}
            </div>
          </div>

          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-12">
            {cols.map((c) => (
              <div key={c.title}>
                <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-white mb-8">
                  {c.title}
                </div>
                <ul className="space-y-4">
                  {c.links.map((l) => (
                    <li key={l}>
                      <a
                        href="#"
                        className="text-sm font-medium text-ink-500 hover:text-white transition-colors relative group inline-block"
                      >
                        {l}
                        <span className="absolute -bottom-1 left-0 right-0 h-px bg-brand-600 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-20 pt-10 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-8">
          <p className="text-xs font-bold text-ink-600 uppercase tracking-widest">
            © {new Date().getFullYear()} EXAMIFY INFRASTRUCTURE INC.
          </p>
          <div className="flex items-center gap-8 text-[10px] font-bold uppercase tracking-widest text-ink-600">
            <span className="inline-flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-success-500 animate-pulse" />
              SYSTEMS_NOMINAL
            </span>
            <span>ENCRYPTED_AES_256</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────────── Section heading ─────────────────────────── */

function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = 'center',
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: 'center' | 'left';
}) {
  const alignClass = align === 'center' ? 'text-center mx-auto' : 'text-left';
  return (
    <div className={`max-w-3xl ${alignClass}`}>
      {eyebrow && (
        <div className="inline-flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.3em] text-brand-600 mb-4">
          <div className="w-8 h-px bg-brand-400" />
          {eyebrow}
        </div>
      )}
      <h2
        className="text-4xl sm:text-5xl font-bold tracking-tight2 text-white leading-[1] text-balance"
        dangerouslySetInnerHTML={{ __html: title }}
      />
      {subtitle && <p className="mt-6 text-lg text-ink-400 leading-relaxed font-medium">{subtitle}</p>}
    </div>
  );
}


// Silence unused import warning for useEffect in case tree-shaker complains
void useEffect;
