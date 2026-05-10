import { useState, useEffect, useRef, ReactNode, MouseEvent as RMouseEvent } from 'react';
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
  Users,
  Globe,
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
    <div className="bg-ink-50 text-ink-900 antialiased overflow-x-clip">
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
        className="h-full bg-gradient-to-r from-brand-700 via-brand-500 to-brand-700 bg-[length:200%_100%] animate-gradient-shift"
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
      className={`fixed bottom-6 right-6 z-40 w-11 h-11 rounded-full bg-ink-900 text-white shadow-elevated flex items-center justify-center transition-all duration-300 hover:bg-ink-800 ${
        visible
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
  const Component = Tag as keyof JSX.IntrinsicElements;
  return (
    <Component
      ref={ref as never}
      style={{ transitionDelay: `${delay}ms` }}
      className={`${cls} ${inView ? 'in' : ''} ${className}`}
    >
      {children}
    </Component>
  );
}

/* ─────────────────────────── Nav ─────────────────────────── */

function LandingNav() {
  const [open, setOpen] = useState(false);
  const y = useScroll();
  const elevated = y > 8;

  const links = [
    { href: '#features', label: 'Features' },
    { href: '#how', label: 'How it works' },
    { href: '#pricing', label: 'Pricing' },
    { href: '#faq', label: 'FAQ' },
  ];

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 ${
        elevated
          ? 'bg-white/80 backdrop-blur-xl border-b border-ink-100 shadow-soft'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="relative w-8 h-8 rounded-lg bg-brand-gradient flex items-center justify-center shadow-soft group-hover:shadow-brand-glow transition-shadow">
              <ShieldCheck className="w-4 h-4 text-white relative z-10" />
              <span className="absolute inset-0 rounded-lg bg-brand-500 opacity-0 group-hover:opacity-50 blur-md transition-opacity" />
            </div>
            <span className="font-semibold text-ink-900 tracking-tight">Examify</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="relative text-sm font-medium text-ink-600 hover:text-ink-900 transition-colors group"
              >
                {l.label}
                <span className="absolute -bottom-1 left-0 right-0 h-px bg-brand-700 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300" />
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link to="/login" className="hidden sm:inline-flex btn btn-md btn-ghost">
              Sign in
            </Link>
            <Link to="/signup" className="btn btn-md btn-primary group">
              Start free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <button
              onClick={() => setOpen(!open)}
              className="md:hidden p-2 rounded-md hover:bg-ink-100 ml-1"
              aria-label="Toggle menu"
            >
              <ChevronDown className={`w-5 h-5 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {open && (
          <div className="md:hidden pb-4 animate-slide-down">
            <nav className="flex flex-col gap-1 pt-2 border-t border-ink-100">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="px-3 py-2.5 rounded-md text-sm font-medium text-ink-700 hover:bg-ink-50"
                >
                  {l.label}
                </a>
              ))}
              <Link
                to="/login"
                className="px-3 py-2.5 rounded-md text-sm font-medium text-ink-700 hover:bg-ink-50"
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
  const tiltRef = useMouseTilt<HTMLDivElement>(6);

  return (
    <section className="relative overflow-hidden -mt-16 pt-16">
      {/* Layered animated background */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-aurora-soft animate-aurora" />
        <div className="absolute inset-0 bg-grid-faint mask-radial-fade opacity-70" />
        {/* Floating orbs with scroll parallax */}
        <div
          className="absolute -top-24 -left-32 w-[420px] h-[420px] rounded-full bg-brand-200/45 blur-3xl animate-float-slow"
          style={{ transform: `translate3d(0, ${y * -0.18}px, 0)` }}
        />
        <div
          className="absolute top-40 -right-24 w-[380px] h-[380px] rounded-full bg-brand-100/60 blur-3xl animate-float"
          style={{ transform: `translate3d(0, ${y * -0.12}px, 0)` }}
        />
        <div
          className="absolute bottom-0 left-1/3 w-[300px] h-[300px] rounded-full bg-brand-300/30 blur-3xl animate-float-x"
          style={{ transform: `translate3d(0, ${y * -0.08}px, 0)` }}
        />
        {/* Faint top hairline */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-200 to-transparent" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-28 lg:pt-28 lg:pb-36">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          {/* Copy */}
          <div className="lg:col-span-6">
            <Reveal>
              <div className="inline-flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full glass shadow-soft">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-brand-50 text-brand-800 text-2xs font-semibold tracking-wide ring-1 ring-inset ring-brand-200">
                  <Sparkles className="w-3 h-3" /> NEW
                </span>
                <span className="text-xs text-ink-700 font-medium">
                  AI gaze tracking is now 4× faster
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-ink-400" />
              </div>
            </Reveal>

            <Reveal delay={80}>
              <h1 className="mt-6 text-4xl sm:text-5xl lg:text-[4rem] font-semibold tracking-tight2 text-ink-900 text-balance leading-[1.04]">
                Exam integrity,
                <br />
                finally{' '}
                <span className="relative inline-block">
                  <span className="text-gradient-brand animate-gradient-shift">automated.</span>
                  <svg
                    aria-hidden
                    viewBox="0 0 220 14"
                    className="absolute -bottom-2 left-0 w-full h-3 text-brand-300"
                  >
                    <path
                      d="M2 8 C 60 2, 160 2, 218 7"
                      stroke="currentColor"
                      strokeWidth="3"
                      fill="none"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </h1>
            </Reveal>

            <Reveal delay={160}>
              <p className="mt-7 text-lg text-ink-600 leading-relaxed max-w-xl">
                Examify is the AI-powered proctoring platform universities and training
                organizations trust to deliver fair, secure online exams — without hiring a
                single human invigilator.
              </p>
            </Reveal>

            <Reveal delay={240}>
              <div className="mt-9 flex flex-col sm:flex-row gap-3">
                <Link to="/signup" className="btn btn-xl btn-primary shadow-elevated group">
                  Start free trial
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <a href="#showcase" className="btn btn-xl btn-secondary group">
                  <span className="w-7 h-7 rounded-full bg-brand-50 ring-1 ring-brand-200 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Play className="w-3 h-3 fill-brand-700 text-brand-700" />
                  </span>
                  Watch 90s demo
                </a>
              </div>
            </Reveal>

            <Reveal delay={320}>
              <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-ink-500">
                {[
                  'No credit card required',
                  '5-minute setup',
                  'FERPA & GDPR ready',
                ].map((t) => (
                  <span key={t} className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-success-600" />
                    {t}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>

          {/* Hero visual with mouse-tracked tilt + scroll parallax */}
          <div className="lg:col-span-6 perspective-1500">
            <Reveal variant="scale" delay={120}>
              <div
                ref={tiltRef}
                className="relative will-change-transform"
                style={{ transform: `translate3d(0, ${y * -0.04}px, 0)` }}
              >
                <HeroVisual />
              </div>
            </Reveal>
          </div>
        </div>

        {/* Scroll cue */}
        <div className="hidden lg:flex absolute bottom-6 left-1/2 -translate-x-1/2 flex-col items-center gap-2 text-ink-400">
          <span className="text-2xs font-semibold uppercase tracking-[0.2em]">Scroll</span>
          <div className="w-5 h-8 rounded-full border border-ink-300 relative overflow-hidden">
            <span className="absolute left-1/2 top-1.5 -translate-x-1/2 w-1 h-1.5 rounded-full bg-brand-700 animate-tick" />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroVisual() {
  return (
    <div className="relative">
      {/* Soft glows behind */}
      <div className="absolute -top-8 -right-6 w-44 h-44 rounded-full bg-brand-200/60 blur-3xl animate-glow-pulse" />
      <div className="absolute -bottom-12 -left-6 w-52 h-52 rounded-full bg-brand-100/70 blur-3xl animate-glow-pulse" style={{ animationDelay: '1.5s' }} />

      {/* Browser frame */}
      <div className="relative card shadow-elevated overflow-hidden bg-white">
        <div className="flex items-center gap-2 px-4 py-3 bg-ink-50 border-b border-ink-100">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-ink-200" />
            <span className="w-2.5 h-2.5 rounded-full bg-ink-200" />
            <span className="w-2.5 h-2.5 rounded-full bg-ink-200" />
          </div>
          <div className="flex-1 mx-3">
            <div className="px-3 py-1 bg-white border border-ink-100 rounded-md text-2xs text-ink-500 font-mono inline-flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-success-600" />
              examify.app/instructor/proctoring
            </div>
          </div>
          <span className="live-indicator text-danger-600">LIVE</span>
        </div>

        <div className="grid grid-cols-5 gap-0">
          {/* Camera feed */}
          <div className="col-span-3 relative bg-gradient-to-br from-ink-900 via-ink-800 to-ink-950 aspect-[16/12] overflow-hidden">
            {/* Scanning sweep */}
            <div
              className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-brand-400/20 to-transparent pointer-events-none animate-pulse-soft"
            />
            <svg
              className="absolute inset-0 w-full h-full opacity-90"
              viewBox="0 0 320 240"
              preserveAspectRatio="xMidYMid slice"
            >
              <defs>
                <radialGradient id="bg" cx="50%" cy="35%" r="60%">
                  <stop offset="0%" stopColor="#43403c" />
                  <stop offset="100%" stopColor="#0d0c0c" />
                </radialGradient>
                <radialGradient id="head" cx="50%" cy="40%" r="50%">
                  <stop offset="0%" stopColor="#56524d" />
                  <stop offset="100%" stopColor="#2a2826" />
                </radialGradient>
              </defs>
              <rect width="320" height="240" fill="url(#bg)" />
              <ellipse cx="160" cy="240" rx="120" ry="60" fill="#1a1817" />
              <circle cx="160" cy="115" r="48" fill="url(#head)" />
              <circle cx="146" cy="110" r="2.5" fill="#f7f6f5" opacity="0.85" />
              <circle cx="174" cy="110" r="2.5" fill="#f7f6f5" opacity="0.85" />
            </svg>

            {/* Face detection box */}
            <div
              className="absolute border-2 border-success-400 rounded-md animate-pulse-soft"
              style={{ top: '22%', left: '32%', width: '36%', height: '46%' }}
            >
              <div className="absolute -top-6 left-0 px-1.5 py-0.5 bg-success-500 text-white text-2xs font-semibold rounded uppercase tracking-wide">
                Face · 98%
              </div>
              <span className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-success-400" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-success-400" />
              <span className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-success-400" />
              <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-success-400" />
            </div>

            {/* Gaze ray */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 320 240">
              <line x1="160" y1="115" x2="245" y2="65" stroke="rgba(244,206,213,0.5)" strokeWidth="1.5" strokeDasharray="3 3" />
              <circle cx="245" cy="65" r="6" fill="rgba(255,255,255,0.85)" />
              <circle cx="245" cy="65" r="3" fill="#7a2238" />
            </svg>

            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded-md glass-dark text-white text-2xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-danger-500 animate-pulse-soft" />
              REC · 00:12:48
            </div>

            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md glass-dark text-white">
                <ScanFace className="w-3.5 h-3.5" />
                <span className="text-2xs font-medium">Identity verified</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md glass-dark text-white">
                <Mic className="w-3.5 h-3.5" />
                <span className="text-2xs font-medium">Audio · Quiet</span>
              </div>
            </div>
          </div>

          {/* Side panel */}
          <div className="col-span-2 bg-white border-l border-ink-100 p-4 flex flex-col gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xs font-semibold uppercase tracking-wider text-ink-500">
                  Integrity score
                </span>
                <span className="pill pill-success">Trusted</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-semibold text-ink-900 tabular-nums tracking-tight2">94</span>
                <span className="text-sm font-medium text-ink-500">/ 100</span>
              </div>
              <div className="risk-meter-track mt-2">
                <div className="risk-meter-fill bg-gradient-to-r from-success-500 to-success-600" style={{ width: '94%' }} />
              </div>
            </div>

            <div className="border-t border-ink-100 pt-3">
              <div className="text-2xs font-semibold uppercase tracking-wider text-ink-500 mb-2">Active session</div>
              <div className="text-sm font-semibold text-ink-900">CS-301 · Final</div>
              <div className="text-xs text-ink-500">Sara N. · 28 min remaining</div>
            </div>

            <div className="border-t border-ink-100 pt-3 flex-1 min-h-0">
              <div className="text-2xs font-semibold uppercase tracking-wider text-ink-500 mb-2">Recent events</div>
              <ul className="space-y-2">
                <EventRow level="success" label="Identity confirmed" time="12:01" />
                <EventRow level="info" label="Calibration complete" time="12:02" />
                <EventRow level="warn" label="Looked away · 1.2s" time="12:09" />
                <EventRow level="success" label="Face stable" time="12:10" />
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Floating mini-card */}
      <div className="hidden sm:flex absolute -bottom-6 -left-4 lg:-left-10 items-center gap-3 bg-white rounded-xl shadow-elevated border border-ink-100 px-4 py-3 animate-float">
        <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center">
          <Brain className="w-4 h-4 text-brand-700" />
        </div>
        <div>
          <div className="text-xs text-ink-500">Detected just now</div>
          <div className="text-sm font-semibold text-ink-900">Multi-face attempt blocked</div>
        </div>
      </div>

      {/* Floating "Live integrity" pill */}
      <div className="hidden sm:flex absolute -top-5 -right-3 items-center gap-2 bg-white rounded-full shadow-elevated border border-ink-100 pl-2 pr-4 py-1.5 animate-float" style={{ animationDelay: '1s' }}>
        <span className="status-dot status-dot-good" />
        <span className="text-xs font-semibold text-ink-900">Live integrity 94</span>
      </div>
    </div>
  );
}

function EventRow({
  level,
  label,
  time,
}: {
  level: 'success' | 'info' | 'warn' | 'danger';
  label: string;
  time: string;
}) {
  const dot =
    level === 'success'
      ? 'bg-success-500'
      : level === 'warn'
      ? 'bg-warning-500'
      : level === 'danger'
      ? 'bg-danger-500'
      : 'bg-info-500';
  return (
    <li className="flex items-center justify-between gap-2 text-xs">
      <span className="flex items-center gap-2 min-w-0">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
        <span className="text-ink-800 truncate">{label}</span>
      </span>
      <span className="font-mono text-ink-400 tabular-nums shrink-0">{time}</span>
    </li>
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
    <section className="py-14 border-y border-ink-100 bg-white/60 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <p className="text-center text-2xs font-semibold uppercase tracking-[0.18em] text-ink-500 mb-8">
            Trusted by leading universities &amp; training organizations
          </p>
        </Reveal>
        <div className="relative mask-fade-x">
          <div className="marquee-track animate-marquee gap-12">
            {items.map((o, i) => (
              <div
                key={`${o}-${i}`}
                className="flex items-center gap-2 text-ink-400 hover:text-ink-700 transition-colors shrink-0"
              >
                <ShieldCheck className="w-4 h-4 opacity-60" />
                <span className="font-display font-semibold tracking-tight text-base whitespace-nowrap">
                  {o}
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
    { value: 99.2, suffix: '%', label: 'Detection accuracy', sub: 'Across 4M+ sessions', decimals: 1 },
    { value: 2, prefix: '<', suffix: 's', label: 'Real-time alert latency', sub: 'From event to dashboard' },
    { value: 200, suffix: '+', label: 'Institutions onboarded', sub: '32 countries' },
    { value: 4.9, suffix: '/5', label: 'Instructor satisfaction', sub: 'NPS +72', decimals: 1 },
  ];

  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <section className="py-16 lg:py-24 relative">
      <div
        aria-hidden
        className="absolute inset-0 bg-grid-dots opacity-50 mask-radial-fade pointer-events-none"
      />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          ref={ref}
          className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-ink-100 rounded-2xl overflow-hidden border border-ink-100 shadow-card"
        >
          {stats.map((s, i) => (
            <StatCell
              key={s.label}
              {...s}
              start={inView}
              delay={i * 120}
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
  const v = useCountUp(value, 1800, start);
  const display = decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString();
  return (
    <div
      className="bg-white p-6 sm:p-8 reveal"
      style={{ transitionDelay: `${delay}ms` }}
      data-in={start ? 'true' : undefined}
      // toggle .in via data + class manually:
      ref={(el) => {
        if (el && start) el.classList.add('in');
      }}
    >
      <div className="text-3xl sm:text-4xl font-semibold tracking-tight2 text-ink-900 tabular-nums">
        {prefix}
        {display}
        {suffix}
      </div>
      <div className="mt-2 text-sm font-medium text-ink-800">{label}</div>
      <div className="text-xs text-ink-500 mt-0.5">{sub}</div>
    </div>
  );
}

/* ─────────────────────────── Features ─────────────────────────── */

function Features() {
  const features = [
    {
      icon: ScanFace,
      title: 'AI identity verification',
      body: 'Match the test-taker to their ID in under three seconds — face, liveness, and document checks in one frictionless step.',
    },
    {
      icon: Eye,
      title: 'Gaze & attention tracking',
      body: 'Continuous eye-tracking flags off-screen glances, second monitors, and looking away — without false positives.',
    },
    {
      icon: Brain,
      title: 'Behavioral risk scoring',
      body: 'A live integrity score per student, blending 30+ signals into a single number you can defend in any appeal.',
    },
    {
      icon: Mic,
      title: 'Ambient audio analysis',
      body: 'Detect a second voice, whispering, or audio cues from another device — locally, with no recordings stored.',
    },
    {
      icon: AlertTriangle,
      title: 'Smart violation feed',
      body: 'Instructors see only the moments that matter, with timestamped clips, evidence, and one-click review.',
    },
    {
      icon: BarChart3,
      title: 'Cohort analytics',
      body: 'Spot anomalies across an entire class. Compare integrity trends, question difficulty, and time spent.',
    },
  ];

  return (
    <section id="features" className="py-24 lg:py-32 bg-white border-y border-ink-100 relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 bg-grid-faint opacity-50 mask-radial-fade pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Capabilities"
          title="Everything you need to run a defensible online exam."
          subtitle="Examify replaces a room full of invigilators with a single AI agent that watches, scores, and explains itself — so instructors can trust every grade."
        />

        <div className="mt-16 grid md:grid-cols-2 lg:grid-cols-3 gap-5 perspective-1000">
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
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    const rx = (0.5 - y) * 4;
    const ry = (x - 0.5) * 4;
    el.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
  };
  const onLeave = (e: RMouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = '';
  };
  return (
    <div
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="group relative card spotlight p-6 transition-all duration-300 hover:shadow-elevated will-change-transform h-full"
      style={{ transformStyle: 'preserve-3d', transition: 'transform 240ms cubic-bezier(.21,.94,.4,1), box-shadow 300ms' }}
    >
      <div className="relative z-10">
        <div className="w-11 h-11 rounded-xl bg-brand-50 ring-1 ring-inset ring-brand-100 flex items-center justify-center mb-5 group-hover:bg-brand-100 group-hover:ring-brand-200 transition-colors">
          <Icon className="w-5 h-5 text-brand-700" />
        </div>
        <h3 className="text-base font-semibold text-ink-900 mb-1.5">{title}</h3>
        <p className="text-sm text-ink-600 leading-relaxed">{body}</p>
        <div className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
          Learn more <ArrowRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Product Showcase ─────────────────────────── */

function ProductShowcase() {
  const { ref: parRef, offset } = useParallax<HTMLDivElement>(0.08);
  const tiltRef = useMouseTilt<HTMLDivElement>(4);

  const points = [
    {
      icon: Camera,
      title: 'One-glance student view',
      body: 'See every active test-taker in a unified live grid. Pop into any session in a click.',
    },
    {
      icon: Activity,
      title: 'Timeline-first review',
      body: 'Every flag is anchored to a moment in the exam. Click a violation, see the clip, decide.',
    },
    {
      icon: FileCheck,
      title: 'Audit-ready reports',
      body: 'Export a signed PDF report per student that holds up under formal academic appeal.',
    },
  ];

  return (
    <section id="showcase" className="py-24 lg:py-32 relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 grid-spotlight pointer-events-none" />
      <div
        aria-hidden
        className="absolute -top-20 right-[10%] w-72 h-72 rounded-full bg-brand-100/60 blur-3xl animate-blob pointer-events-none"
      />
      <div
        aria-hidden
        className="absolute -bottom-20 left-[5%] w-80 h-80 rounded-full bg-brand-200/50 blur-3xl animate-blob pointer-events-none"
        style={{ animationDelay: '4s' }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          <div className="lg:col-span-5">
            <Reveal>
              <SectionHeading
                align="left"
                eyebrow="The proctoring console"
                title="An invigilator's chair, redesigned for the AI era."
                subtitle="Instructors move from watching webcams to acting on evidence. Everything Examify flags is timestamped, ranked, and one click away from a decision."
              />
            </Reveal>

            <ul className="mt-10 space-y-6">
              {points.map((p, i) => (
                <Reveal key={p.title} delay={120 + i * 100}>
                  <li className="flex gap-4 group">
                    <div className="shrink-0 w-10 h-10 rounded-lg bg-white border border-ink-100 shadow-soft flex items-center justify-center group-hover:bg-brand-50 group-hover:border-brand-200 transition-colors">
                      <p.icon className="w-4 h-4 text-brand-700" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-ink-900">{p.title}</div>
                      <div className="text-sm text-ink-600 mt-0.5 leading-relaxed">{p.body}</div>
                    </div>
                  </li>
                </Reveal>
              ))}
            </ul>

            <Reveal delay={500}>
              <div className="mt-10">
                <Link to="/signup" className="btn btn-lg btn-primary group">
                  Try it yourself
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </Reveal>
          </div>

          <div className="lg:col-span-7 perspective-1500" ref={parRef}>
            <Reveal variant="scale" delay={120}>
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
      <div className="absolute inset-0 -z-10 rounded-3xl bg-brand-gradient-soft blur-3xl opacity-50" />
      <div className="card shadow-elevated overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-ink-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md bg-brand-gradient flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-ink-900">CS-301 · Final exam</div>
              <div className="text-2xs text-ink-500">42 active · 2h 00m duration</div>
            </div>
          </div>
          <span className="live-indicator text-danger-600">LIVE</span>
        </div>

        <div className="grid grid-cols-12 gap-0">
          <div className="hidden md:block col-span-3 border-r border-ink-100 bg-ink-50/60 p-3">
            <div className="text-2xs font-semibold uppercase tracking-wider text-ink-500 mb-2">
              Active rooms
            </div>
            <ul className="space-y-1">
              {[
                ['CS-301 · Final', '42', true],
                ['MATH-210 · Quiz 4', '18', false],
                ['BIO-115 · Midterm', '67', false],
                ['ECON-220 · Re-sit', '9', false],
              ].map(([n, c, active]) => (
                <li
                  key={n as string}
                  className={`flex items-center justify-between px-2.5 py-2 rounded-md text-xs transition-colors ${
                    active
                      ? 'bg-white border border-ink-100 shadow-soft text-ink-900 font-semibold'
                      : 'text-ink-700 hover:bg-white/60'
                  }`}
                >
                  <span className="truncate">{n as string}</span>
                  <span className="pill pill-neutral text-[10px] py-0">{c as string}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-span-12 md:col-span-9 p-4 sm:p-5 bg-ink-50/60">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { name: 'Sara N.', score: 94, status: 'good' as const, viol: 0 },
                { name: 'Daniel K.', score: 71, status: 'warn' as const, viol: 2 },
                { name: 'Maya R.', score: 88, status: 'good' as const, viol: 1 },
                { name: 'Omar B.', score: 42, status: 'bad' as const, viol: 5 },
                { name: 'Ines T.', score: 96, status: 'good' as const, viol: 0 },
                { name: 'Theo P.', score: 79, status: 'warn' as const, viol: 2 },
              ].map((s) => (
                <StudentTile key={s.name} {...s} />
              ))}
            </div>

            <div className="mt-4 panel p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xs font-semibold uppercase tracking-wider text-ink-500">
                  Live alerts
                </span>
                <span className="text-2xs text-ink-400">auto-refresh 0.5s</span>
              </div>
              <ul className="space-y-1.5">
                <AlertRow severity="bad" who="Omar B." what="Multi-face detected" time="12:14:02" />
                <AlertRow severity="warn" who="Daniel K." what="Looked away > 3s" time="12:13:48" />
                <AlertRow severity="warn" who="Theo P." what="Background voice" time="12:13:21" />
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
  viol,
}: {
  name: string;
  score: number;
  status: 'good' | 'warn' | 'bad';
  viol: number;
}) {
  const ring =
    status === 'good' ? 'ring-success-200' : status === 'warn' ? 'ring-warning-200' : 'ring-danger-200';
  const dot =
    status === 'good' ? 'status-dot-good' : status === 'warn' ? 'status-dot-warn' : 'status-dot-bad';
  const fillClass =
    status === 'good' ? 'bg-success-500' : status === 'warn' ? 'bg-warning-500' : 'bg-danger-500';
  return (
    <div
      className={`bg-white rounded-lg border border-ink-100 ring-1 ring-inset ${ring} p-2.5 hover:shadow-card hover:-translate-y-0.5 transition-all`}
    >
      <div className="aspect-video rounded-md bg-gradient-to-br from-ink-700 to-ink-900 mb-2 relative overflow-hidden">
        <svg className="absolute inset-0 w-full h-full opacity-90" viewBox="0 0 200 110" preserveAspectRatio="xMidYMid slice">
          <ellipse cx="100" cy="110" rx="80" ry="40" fill="#1a1817" />
          <circle cx="100" cy="55" r="22" fill="#43403c" />
        </svg>
        <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/40 backdrop-blur text-[10px] font-semibold text-white">
          <span className={`status-dot ${dot}`} />
          LIVE
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-ink-900 truncate">{name}</span>
        <span className="text-xs font-semibold tabular-nums text-ink-700">{score}</span>
      </div>
      <div className="risk-meter-track mt-1.5 h-1">
        <div className={`risk-meter-fill ${fillClass}`} style={{ width: `${score}%` }} />
      </div>
      <div className="mt-1.5 text-[10px] text-ink-500">
        {viol === 0 ? 'No violations' : `${viol} violation${viol > 1 ? 's' : ''}`}
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
  const pill = severity === 'bad' ? 'pill-danger' : 'pill-warning';
  return (
    <li className="flex items-center gap-2 text-xs animate-slide-down">
      <span className={`pill ${pill} text-[10px] py-0`}>{severity === 'bad' ? 'Critical' : 'Warning'}</span>
      <span className="font-medium text-ink-900">{who}</span>
      <span className="text-ink-600 truncate">{what}</span>
      <span className="ml-auto font-mono text-ink-400 tabular-nums">{time}</span>
    </li>
  );
}

/* ─────────────────────────── How it works ─────────────────────────── */

function HowItWorks() {
  const steps = [
    {
      n: '01',
      title: 'Bring your exam',
      body: 'Import from any LMS or build a question set in our editor. Set policies for ID, breaks, and what counts as a violation.',
      icon: FileCheck,
    },
    {
      n: '02',
      title: 'Students take it anywhere',
      body: 'Browser-only. No installs, no plug-ins. Examify guides each student through camera, mic, and ID checks.',
      icon: Globe,
    },
    {
      n: '03',
      title: 'You get clean evidence',
      body: 'Receive a ranked report per student with score, flagged moments, and clips — ready to grade or appeal.',
      icon: BarChart3,
    },
  ];
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <section id="how" className="py-24 lg:py-32 bg-white border-y border-ink-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="How it works"
          title="From exam draft to defensible grade in three steps."
          subtitle="No new infrastructure. No invigilator training. Examify slots into the workflow your team already runs."
        />

        <div ref={ref} className="mt-16 grid md:grid-cols-3 gap-5 lg:gap-6 relative">
          {/* Animated connector line */}
          <svg
            aria-hidden
            viewBox="0 0 1000 8"
            preserveAspectRatio="none"
            className="hidden md:block absolute top-12 left-[16%] right-[16%] h-2 -translate-y-1/2 pointer-events-none"
            style={{ width: 'calc(68%)' }}
          >
            <line
              x1="0" y1="4" x2="1000" y2="4"
              stroke="#d8cfd0"
              strokeWidth="1"
              strokeDasharray="4 6"
              style={{
                strokeDashoffset: inView ? '0' : '1000',
                transition: 'stroke-dashoffset 1800ms cubic-bezier(.21,.94,.4,1)',
              }}
            />
          </svg>

          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 160}>
              <div className="relative card p-6 lg:p-7 hover:shadow-elevated transition-all hover:-translate-y-1 duration-300 group">
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative w-12 h-12 rounded-xl bg-brand-gradient text-white flex items-center justify-center shadow-soft group-hover:shadow-brand-glow transition-shadow">
                    <s.icon className="w-5 h-5 relative z-10" />
                    <span className="absolute inset-0 rounded-xl bg-brand-500 opacity-0 group-hover:opacity-50 blur-md transition-opacity" />
                  </div>
                  <span className="font-mono text-2xs font-semibold tracking-widest text-ink-400">
                    STEP {s.n}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-ink-900 tracking-tight">{s.title}</h3>
                <p className="mt-1.5 text-sm text-ink-600 leading-relaxed">{s.body}</p>
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
      title: 'Universities',
      body: 'Run thousands of concurrent finals across faculties. Faculty-level policies, deans-office reporting, and SSO baked in.',
      points: ['Concurrent capacity', 'Department-level admin', 'Academic appeal export'],
    },
    {
      icon: Briefcase,
      title: 'Training & certification',
      body: 'Issue credentials your customers actually trust. Tamper-evident sessions and signed PDF reports per candidate.',
      points: ['Signed evidence reports', 'Public verifier link', 'Pay-per-exam billing'],
    },
    {
      icon: Building2,
      title: 'Corporate L&D',
      body: 'Compliance training that proves attention. Replace honor-system quizzes with auditable assessments.',
      points: ['SCIM provisioning', 'Audit log retention', 'BYO storage region'],
    },
  ];
  return (
    <section className="py-24 lg:py-32 relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 bg-grid-dots opacity-40 mask-radial-fade pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            eyebrow="Built for the way you assess"
            title="One platform. Three audiences. Zero compromises."
          />
        </Reveal>
        <div className="mt-14 grid md:grid-cols-3 gap-5">
          {cases.map((c, i) => (
            <Reveal key={c.title} delay={i * 120}>
              <div className="card spotlight p-7 hover:shadow-elevated hover:-translate-y-1 transition-all duration-300 h-full group">
                <div className="w-12 h-12 rounded-xl bg-brand-50 ring-1 ring-inset ring-brand-100 flex items-center justify-center mb-5 group-hover:bg-brand-100 group-hover:ring-brand-200 transition-colors">
                  <c.icon className="w-5 h-5 text-brand-700" />
                </div>
                <h3 className="text-lg font-semibold text-ink-900 tracking-tight">{c.title}</h3>
                <p className="mt-1.5 text-sm text-ink-600 leading-relaxed">{c.body}</p>
                <ul className="mt-5 space-y-2">
                  {c.points.map((p) => (
                    <li key={p} className="flex items-center gap-2 text-sm text-ink-700">
                      <CheckCircle2 className="w-4 h-4 text-brand-700 shrink-0" />
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
    { label: 'Setup time', legacy: '2–4 weeks', examify: '5 minutes' },
    { label: 'Student install required', legacy: true, examify: false },
    { label: 'Per-exam human invigilator', legacy: true, examify: false },
    { label: 'Real-time integrity score', legacy: false, examify: true },
    { label: 'Evidence-grade audit report', legacy: false, examify: true },
    { label: 'Works on Chromebook', legacy: false, examify: true },
    { label: 'Per-session cost', legacy: '$8–$20', examify: 'From $0.30' },
  ];
  return (
    <section className="py-24 lg:py-32 bg-white border-y border-ink-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            eyebrow="Examify vs. legacy proctoring"
            title="A modern stack, not a webcam babysitter."
          />
        </Reveal>
        <Reveal delay={120}>
          <div className="mt-12 card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-ink-50/70 border-b border-ink-100">
                <tr>
                  <th className="text-left font-semibold text-ink-700 px-5 py-3.5 w-1/2">Capability</th>
                  <th className="text-left font-semibold text-ink-500 px-5 py-3.5">Legacy proctoring</th>
                  <th className="text-left font-semibold text-brand-800 px-5 py-3.5">Examify</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <ComparisonRow key={r.label} row={r} last={i === rows.length - 1} delay={i * 70} />
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function ComparisonRow({
  row: r,
  last,
  delay,
}: {
  row: { label: string; legacy: string | boolean; examify: string | boolean };
  last: boolean;
  delay: number;
}) {
  const { ref, inView } = useInView<HTMLTableRowElement>();
  return (
    <tr
      ref={ref}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(8px)',
        transition: `opacity 600ms cubic-bezier(.21,.94,.4,1) ${delay}ms, transform 600ms cubic-bezier(.21,.94,.4,1) ${delay}ms`,
      }}
      className={!last ? 'border-b border-ink-100 hover:bg-ink-50/50 transition-colors' : 'hover:bg-ink-50/50 transition-colors'}
    >
      <td className="px-5 py-3.5 font-medium text-ink-800">{r.label}</td>
      <td className="px-5 py-3.5 text-ink-500">
        {typeof r.legacy === 'boolean' ? (
          <span className="pill pill-neutral">{r.legacy ? 'Yes' : 'No'}</span>
        ) : (
          r.legacy
        )}
      </td>
      <td className="px-5 py-3.5 font-semibold text-ink-900">
        {typeof r.examify === 'boolean' ? (
          <span className="pill pill-success">
            <CheckCircle2 className="w-3.5 h-3.5" /> {r.examify ? 'Yes' : 'No'}
          </span>
        ) : (
          r.examify
        )}
      </td>
    </tr>
  );
}

/* ─────────────────────────── Security ─────────────────────────── */

function Security() {
  const badges = ['SOC 2 Type II', 'GDPR', 'FERPA', 'ISO 27001', 'WCAG 2.2 AA'];
  const pillars = [
    {
      icon: Lock,
      title: 'Encrypted end to end',
      body: 'AES-256 at rest, TLS 1.3 in transit. Per-tenant keys with optional BYOK.',
    },
    {
      icon: Server,
      title: 'Region-pinned data',
      body: 'Store evidence in EU, US, or your private region. Nothing leaves without a signed URL.',
    },
    {
      icon: Shield,
      title: 'Privacy-respecting AI',
      body: 'Models run locally in the browser when possible. We never sell or train on your data.',
    },
  ];
  return (
    <section className="py-24 lg:py-32 relative overflow-hidden">
      <div
        aria-hidden
        className="absolute -top-32 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-brand-100/40 blur-3xl pointer-events-none"
      />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-14 items-start">
          <Reveal>
            <div>
              <SectionHeading
                align="left"
                eyebrow="Trust & compliance"
                title="Built for institutions that can't afford a data incident."
                subtitle="Every byte is encrypted, every event auditable, every model documented. We took the long road on compliance so your privacy office doesn't have to."
              />
              <div className="mt-7 flex flex-wrap gap-2">
                {badges.map((b) => (
                  <span
                    key={b}
                    className="pill pill-neutral text-xs px-3 py-1 bg-white border border-ink-200 hover:border-brand-300 hover:text-brand-800 transition-colors cursor-default"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-brand-700" />
                    {b}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>

          <div className="grid gap-3">
            {pillars.map((p, i) => (
              <Reveal key={p.title} delay={120 + i * 100}>
                <div className="card spotlight p-5 flex gap-4 hover:shadow-elevated transition-shadow duration-300 group">
                  <div className="shrink-0 w-10 h-10 rounded-lg bg-brand-50 ring-1 ring-inset ring-brand-100 flex items-center justify-center group-hover:bg-brand-100 transition-colors">
                    <p.icon className="w-5 h-5 text-brand-700" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-ink-900">{p.title}</div>
                    <div className="text-sm text-ink-600 mt-0.5 leading-relaxed">{p.body}</div>
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
        'We replaced 14 invigilator contracts and a creaky desktop tool with Examify in one semester. Appeals dropped 38%.',
      author: 'Dr. Lina Farouk',
      role: 'Vice-Dean, Riverbend University',
    },
    {
      quote:
        'The integrity score is the single most useful number we have ever shown to a faculty review board.',
      author: 'Marcus Aldridge',
      role: 'Head of Online Programs, Northgate Tech',
    },
    {
      quote:
        'Onboarding 12,000 candidates took an afternoon. Our certification finally feels like one worth issuing.',
      author: 'Priya Raman',
      role: 'Director of Credentialing, Elara Institute',
    },
  ];
  return (
    <section className="py-24 lg:py-32 bg-gradient-to-b from-brand-50/40 via-white to-white border-y border-ink-100 relative overflow-hidden">
      <div
        aria-hidden
        className="absolute top-0 right-0 w-96 h-96 rounded-full bg-brand-100/40 blur-3xl animate-glow-pulse pointer-events-none"
      />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading eyebrow="What instructors say" title="Loved by the people grading the work." />
        </Reveal>
        <div className="mt-14 grid md:grid-cols-3 gap-5">
          {quotes.map((q, i) => (
            <Reveal key={q.author} delay={i * 140}>
              <figure className="card spotlight p-7 flex flex-col hover:shadow-elevated hover:-translate-y-1 transition-all duration-300 h-full relative">
                <span className="absolute top-5 right-5 text-7xl font-display text-brand-100 leading-none select-none">&ldquo;</span>
                <div className="flex gap-0.5 text-brand-700 mb-4 relative">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Star key={idx} className="w-4 h-4 fill-brand-700" />
                  ))}
                </div>
                <blockquote className="text-base text-ink-900 leading-relaxed flex-1 relative">
                  {q.quote}
                </blockquote>
                <figcaption className="mt-5 pt-5 border-t border-ink-100">
                  <div className="text-sm font-semibold text-ink-900">{q.author}</div>
                  <div className="text-xs text-ink-500">{q.role}</div>
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
      name: 'Starter',
      blurb: 'For individual instructors and small classes.',
      monthly: 0,
      annual: 0,
      cta: 'Start free',
      to: '/signup',
      highlight: false,
      features: ['Up to 50 sessions / month', 'AI face & gaze tracking', 'Single integrity score', 'Email support'],
    },
    {
      name: 'Pro',
      blurb: 'For departments and online programs.',
      monthly: 99,
      annual: 79,
      cta: 'Start 14-day trial',
      to: '/signup',
      highlight: true,
      features: [
        '1,000 sessions / month',
        'Cohort analytics & exports',
        'LMS & SSO integrations',
        'Audit-grade PDF reports',
        'Priority support · 4h SLA',
      ],
    },
    {
      name: 'Enterprise',
      blurb: 'For universities and certification bodies.',
      monthly: null as number | null,
      annual: null as number | null,
      cta: 'Contact sales',
      to: '/signup',
      highlight: false,
      features: [
        'Unlimited sessions',
        'Region-pinned storage / BYOK',
        'SCIM, audit log streaming',
        'Dedicated solutions architect',
        '99.95% uptime SLA',
      ],
    },
  ];

  return (
    <section id="pricing" className="py-24 lg:py-32 relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 bg-grid-faint opacity-40 mask-radial-fade pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            eyebrow="Pricing"
            title="One platform. Pricing that scales with you."
            subtitle="Pay only for sessions you proctor. No per-seat fees, no per-instructor markup."
          />
        </Reveal>

        <Reveal delay={120}>
          <div className="mt-8 flex justify-center">
            <div className="inline-flex items-center p-1 bg-white border border-ink-200 rounded-full shadow-soft text-sm">
              <button
                onClick={() => setAnnual(false)}
                className={`px-4 py-1.5 rounded-full font-medium transition-all ${
                  !annual ? 'bg-brand-700 text-white shadow-soft' : 'text-ink-600 hover:text-ink-900'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setAnnual(true)}
                className={`px-4 py-1.5 rounded-full font-medium transition-all inline-flex items-center gap-2 ${
                  annual ? 'bg-brand-700 text-white shadow-soft' : 'text-ink-600 hover:text-ink-900'
                }`}
              >
                Annual
                <span className={`text-2xs font-semibold ${annual ? 'text-brand-100' : 'text-success-600'}`}>
                  −20%
                </span>
              </button>
            </div>
          </div>
        </Reveal>

        <div className="mt-12 grid md:grid-cols-3 gap-5 items-stretch">
          {tiers.map((t, i) => (
            <Reveal key={t.name} delay={i * 120} variant="scale">
              <div
                className={`relative flex flex-col p-7 rounded-2xl border transition-all duration-300 hover:-translate-y-1 h-full ${
                  t.highlight
                    ? 'bg-ink-900 text-white border-ink-900 shadow-elevated hover:shadow-modal'
                    : 'bg-white border-ink-100 shadow-card hover:shadow-elevated'
                }`}
              >
                {t.highlight && (
                  <>
                    <div
                      aria-hidden
                      className="absolute -inset-px rounded-2xl bg-gradient-to-br from-brand-500/40 via-brand-700/0 to-brand-700/40 opacity-50 blur-md -z-10 animate-glow-pulse"
                    />
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-gradient text-white text-2xs font-semibold tracking-wide uppercase shadow-elevated">
                        <Sparkles className="w-3 h-3" />
                        Most popular
                      </span>
                    </div>
                  </>
                )}
                <div>
                  <div className={`text-sm font-semibold tracking-tight ${t.highlight ? 'text-brand-200' : 'text-brand-700'}`}>
                    {t.name}
                  </div>
                  <p className={`mt-1 text-sm ${t.highlight ? 'text-ink-300' : 'text-ink-600'}`}>{t.blurb}</p>
                </div>

                <div className="mt-6 flex items-baseline gap-1">
                  {t.monthly === null ? (
                    <span className="text-3xl font-semibold tracking-tight2">Custom</span>
                  ) : (
                    <>
                      <span className="text-4xl font-semibold tracking-tight2 tabular-nums">
                        ${annual ? t.annual : t.monthly}
                      </span>
                      <span className={`text-sm ${t.highlight ? 'text-ink-400' : 'text-ink-500'}`}>/month</span>
                    </>
                  )}
                </div>
                {annual && t.monthly !== null && t.monthly > 0 && (
                  <div className={`text-2xs ${t.highlight ? 'text-ink-400' : 'text-ink-500'}`}>
                    Billed ${(t.annual ?? 0) * 12} annually
                  </div>
                )}

                <ul className="mt-6 space-y-2.5 flex-1">
                  {t.features.map((f) => (
                    <li
                      key={f}
                      className={`flex items-start gap-2 text-sm ${t.highlight ? 'text-ink-100' : 'text-ink-700'}`}
                    >
                      <CheckCircle2
                        className={`w-4 h-4 shrink-0 mt-0.5 ${t.highlight ? 'text-brand-300' : 'text-brand-700'}`}
                      />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  to={t.to}
                  className={`mt-7 btn btn-lg w-full group ${
                    t.highlight ? 'bg-white text-ink-900 hover:bg-ink-100' : 'btn-primary'
                  }`}
                >
                  {t.cta}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
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
      q: 'Do students need to install anything?',
      a: 'No. Examify runs entirely in the browser — Chrome, Edge, Safari, Firefox. Students need only a webcam and a microphone, both of which are checked during onboarding.',
    },
    {
      q: 'How accurate is the AI?',
      a: 'Across 4M+ sessions our composite detection accuracy is 99.2%, with a false-positive rate below 0.4%. Every flag is timestamped and reviewable, so instructors decide — never the AI alone.',
    },
    {
      q: 'Is Examify GDPR and FERPA compliant?',
      a: 'Yes. We are SOC 2 Type II certified, GDPR-compliant, and FERPA-aligned. Data residency can be pinned to EU, US, or a private region, and BYOK is available on Enterprise.',
    },
    {
      q: 'Will it work on a Chromebook or low-end laptop?',
      a: 'Yes. Models are quantized to run on devices with as little as 4 GB of RAM, and we gracefully degrade signal capture when bandwidth is constrained.',
    },
    {
      q: 'What about students with accessibility needs?',
      a: 'Examify is WCAG 2.2 AA conformant. Instructors can grant per-student accommodations — extra time, screen reader compatibility, alternate ID flows — without affecting the integrity score weighting.',
    },
    {
      q: 'Can I integrate with my LMS?',
      a: 'We offer native integrations for Canvas, Moodle, Blackboard, and Brightspace via LTI 1.3, plus a typed REST API and webhooks for everything else.',
    },
  ];

  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="py-24 lg:py-32 bg-white border-y border-ink-100">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading eyebrow="FAQ" title="Answers to the questions every privacy office asks." />
        </Reveal>
        <div className="mt-12 divide-y divide-ink-100 border-y border-ink-100">
          {items.map((it, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={i} delay={i * 60}>
                <div>
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="w-full flex items-center justify-between gap-4 py-5 text-left group"
                    aria-expanded={isOpen}
                  >
                    <span className="text-base font-semibold text-ink-900 group-hover:text-brand-700 transition-colors">
                      {it.q}
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 shrink-0 text-ink-500 transition-all duration-300 ${
                        isOpen ? 'rotate-180 text-brand-700' : ''
                      }`}
                    />
                  </button>
                  <div
                    className="grid transition-[grid-template-rows] duration-300 ease-out"
                    style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
                  >
                    <div className="overflow-hidden">
                      <div className="pb-5 pr-9 text-sm text-ink-600 leading-relaxed">{it.a}</div>
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
    <section className="py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal variant="scale">
          <div
            ref={ctaRef}
            onMouseMove={onMove}
            className="relative overflow-hidden rounded-3xl bg-brand-gradient text-white px-6 py-20 sm:px-12 sm:py-24 shadow-elevated"
          >
            {/* Animated mesh */}
            <div
              aria-hidden
              className="absolute inset-0 bg-aurora-deep animate-aurora opacity-80"
            />
            {/* Grid overlay */}
            <div
              aria-hidden
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  'linear-gradient(to right, rgba(255,255,255,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.18) 1px, transparent 1px)',
                backgroundSize: '64px 64px',
                maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
                WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
              }}
            />
            {/* Mouse spotlight */}
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'radial-gradient(420px circle at var(--mx,50%) var(--my,50%), rgba(255,255,255,0.18), transparent 60%)',
              }}
            />
            {/* Floating orbs */}
            <div
              aria-hidden
              className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-brand-300/30 blur-3xl animate-float-slow"
            />
            <div
              aria-hidden
              className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full bg-brand-400/25 blur-3xl animate-float"
            />

            <div className="relative max-w-2xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur text-2xs font-semibold uppercase tracking-[0.18em] text-brand-100">
                <Sparkles className="w-3 h-3" /> Ready when you are
              </div>
              <h2 className="mt-6 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight2 leading-[1.05]">
                Run your next exam without a single human watching.
              </h2>
              <p className="mt-6 text-base sm:text-lg text-brand-100/90">
                Set up your first proctored session in five minutes. Free for the first 50
                students — no credit card, no sales call.
              </p>
              <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  to="/signup"
                  className="btn btn-xl bg-white text-ink-900 hover:bg-ink-100 shadow-elevated group"
                >
                  Start free
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <Link
                  to="/login"
                  className="btn btn-xl bg-white/10 text-white hover:bg-white/20 border border-white/20"
                >
                  Talk to sales
                </Link>
              </div>
              <div className="mt-8 flex items-center justify-center gap-6 text-2xs text-brand-100/80">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> 200+ institutions
                </span>
                <span className="w-1 h-1 rounded-full bg-brand-100/50" />
                <span className="inline-flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> 5-minute setup
                </span>
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
    { title: 'Product', links: ['Features', 'Pricing', 'Security', 'Changelog'] },
    { title: 'Company', links: ['About', 'Customers', 'Careers', 'Press kit'] },
    { title: 'Resources', links: ['Documentation', 'API reference', 'Help center', 'Status'] },
    { title: 'Legal', links: ['Privacy', 'Terms', 'DPA', 'Subprocessors'] },
  ];
  return (
    <footer className="bg-ink-950 text-ink-300 relative overflow-hidden">
      <div
        aria-hidden
        className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1000px] h-[400px] rounded-full bg-brand-700/15 blur-3xl pointer-events-none"
      />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-brand-gradient flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-white tracking-tight">Examify</span>
            </Link>
            <p className="mt-4 text-sm text-ink-400 leading-relaxed max-w-sm">
              The AI-powered proctoring platform for universities and training organizations
              that take integrity seriously.
            </p>
            <div className="mt-6 flex gap-2">
              {[Twitter, Linkedin, Github].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 hover:scale-110 transition-all flex items-center justify-center"
                  aria-label="social"
                >
                  <Icon className="w-4 h-4 text-ink-300" />
                </a>
              ))}
            </div>
          </div>

          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-8">
            {cols.map((c) => (
              <div key={c.title}>
                <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-white mb-4">
                  {c.title}
                </div>
                <ul className="space-y-2.5">
                  {c.links.map((l) => (
                    <li key={l}>
                      <a
                        href="#"
                        className="text-sm text-ink-400 hover:text-white transition-colors relative group inline-block"
                      >
                        {l}
                        <span className="absolute -bottom-0.5 left-0 right-0 h-px bg-brand-500 scale-x-0 group-hover:scale-x-100 origin-left transition-transform" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-ink-500">© {new Date().getFullYear()} Examify, Inc. All rights reserved.</p>
          <div className="flex items-center gap-4 text-xs text-ink-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success-500 animate-pulse-soft" />
              All systems operational
            </span>
            <span>·</span>
            <span>Built for academic integrity</span>
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
    <div className={`max-w-2xl ${alignClass}`}>
      {eyebrow && (
        <div className="inline-flex items-center gap-2 text-2xs font-semibold uppercase tracking-[0.18em] text-brand-700">
          <span className="w-6 h-px bg-brand-300" />
          {eyebrow}
        </div>
      )}
      <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight2 text-ink-900 text-balance leading-[1.1]">
        {title}
      </h2>
      {subtitle && <p className="mt-4 text-base text-ink-600 leading-relaxed">{subtitle}</p>}
    </div>
  );
}

// Silence unused import warning for useEffect in case tree-shaker complains
void useEffect;
