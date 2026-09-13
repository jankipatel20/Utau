import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

const GOLD = '#C9922A';
const GOLD_BRIGHT = '#E8B84B';
const CRIMSON = '#C0392B';
const COPPER = '#B87333';

/* ── Google Fonts inject ── */
function FontLoader() {
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;500;600&family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap';
    document.head.appendChild(link);
  }, []);
  return null;
}

/* ── CSS Variables + Global Styles ── */
const GLOBAL_CSS = `
  :root {
    --gold: #C9922A;
    --gold-bright: #E8B84B;
    --gold-dim: rgba(201,146,42,0.08);
    --gold-glow: 0 0 40px rgba(201,146,42,0.25);
    --crimson: #C0392B;
    --copper: #B87333;
    --bg: #080807;
    --bg-panel: #0E0D0C;
    --bg-card: #121110;
    --border: rgba(201,146,42,0.12);
    --border-light: rgba(201,146,42,0.06);
    --text: #F0EBE0;
    --text-muted: #7A7060;
    --text-dim: #3D3830;
    --font-display: 'Bebas Neue', sans-serif;
    --font-mono: 'IBM Plex Mono', monospace;
    --font-serif: 'Playfair Display', serif;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--font-mono);
    overflow-x: hidden;
    line-height: 1;
  }
  body::before {
    content: '';
    position: fixed; inset: 0;
    background-image:
      linear-gradient(rgba(201,146,42,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(201,146,42,0.03) 1px, transparent 1px);
    background-size: 60px 60px;
    pointer-events: none;
    z-index: 0;
  }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes pulse-inner { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.7)} }
  @keyframes blink { 0%,90%,100%{opacity:1} 45%{opacity:.2} }
  @keyframes ticker { from{transform:translateX(0)} to{transform:translateX(-50%)} }
  @keyframes countup { from{opacity:0;transform:scale(.8)} to{opacity:1;transform:scale(1)} }
  .ring { position: absolute; border-radius: 50%; border: 1px solid var(--border); }
  .ring-1 { inset: 0; animation: spin 40s linear infinite; }
  .ring-2 { inset: 40px; animation: spin 25s linear infinite reverse; }
  .ring-3 { inset: 80px; animation: spin 60s linear infinite; }
  .ring-1::after, .ring-2::after {
    content: '';
    position: absolute;
    width: 8px; height: 8px;
    background: var(--gold);
    border-radius: 50%;
    top: 50%; left: -4px;
    transform: translateY(-50%);
    box-shadow: 0 0 10px var(--gold);
  }
  .ring-2::after { background: var(--copper); box-shadow: 0 0 10px var(--copper); }
  .nodes-spin { animation: spin 20s linear infinite; }
  .logo-icon-inner { animation: pulse-inner 2s ease-in-out infinite; }
  .eyebrow-dot { animation: blink 2.5s ease-in-out infinite; }
  .live-dot { animation: blink 1.5s ease-in-out infinite; }
  .ticker-track { animation: ticker 30s linear infinite; }
  .core-value-anim { animation: countup 1s ease-out forwards; }
  .fade-in { opacity: 0; transform: translateY(20px); transition: opacity .7s ease, transform .7s ease; }
  .fade-in.visible { opacity: 1; transform: translateY(0); }
  .blink-cursor { animation: blink 1s step-end infinite; }
  .glass-card { background: rgba(28,26,23,0.5); backdrop-filter: blur(12px); border: 1px solid rgba(201,146,42,0.15); border-radius: 8px; }
  @keyframes turbineSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`;

function GlobalStyles() {
  return <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />;
}

/* ── TICKER DATA ── */
const TICKER_ITEMS = [
  { dot: 'green', text: 'SOLAR ARRAY ALPHA', val: '99.8%', unit: 'EFFICIENCY' },
  { dot: 'amber', text: 'INVERTER TH-12', val: '+2.4°C', unit: 'DRIFT' },
  { dot: 'green', text: 'KAFKA INGEST', val: '48,291', unit: 'MSG/S' },
  { dot: 'green', text: 'PREDICTION CONFIDENCE', val: '98.9%', unit: '' },
  { dot: 'red', text: 'CRITICAL: GEARBOX VIBRATION BREACH — WIND TURBINE W-07 — MITIGATION PROTOCOL ACTIVE', val: '', unit: '' },
  { dot: 'green', text: 'REVENUE LOSS PREVENTED', val: '$14,280', unit: 'YTD' },
  { dot: 'green', text: 'AI POLICY UPDATE', val: 'CYCLE 1,847', unit: '' },
  { dot: 'amber', text: 'PANEL SOILING DETECTED', val: 'SECTOR 4', unit: '' },
];

const dotColors = {
  green: { bg: '#27AE60', shadow: '#27AE60' },
  amber: { bg: GOLD, shadow: GOLD },
  red: { bg: CRIMSON, shadow: CRIMSON },
};

function Ticker() {
  const doubled = [...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <div style={{
      background: 'rgba(201,146,42,0.05)',
      borderBottom: '1px solid var(--border-light)',
      padding: '8px 0',
      overflow: 'hidden',
      position: 'relative',
      zIndex: 10,
    }}>
      <div className="ticker-track" style={{ display: 'flex', gap: 80, whiteSpace: 'nowrap', width: 'max-content' }}>
        {doubled.map((item, i) => {
          const dc = dotColors[item.dot];
          return (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500, letterSpacing: '0.15em', color: 'var(--text-muted)' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: dc.bg, boxShadow: `0 0 6px ${dc.shadow}`, flexShrink: 0, display: 'inline-block' }} />
              {item.text}&nbsp;
              {item.val && <span style={{ color: 'var(--text)', fontWeight: 600 }}>{item.val}</span>}
              {item.unit && <>&nbsp;{item.unit}</>}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ── NAV ── */
function Nav({ onLaunch }) {
  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 32px', height: 72,
      background: 'rgba(8,8,7,0.92)',
      borderBottom: '1px solid var(--border)',
      backdropFilter: 'blur(12px)',
    }}>
      {/* Brand */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, border: '1.5px solid var(--gold)', transform: 'rotate(45deg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="logo-icon-inner" style={{ width: 12, height: 12, background: 'var(--gold)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: '0.2em', color: '#F0EBE0', lineHeight: 1 }}>UTAU</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 500, color: '#A09D94', letterSpacing: '0.35em', lineHeight: 1 }}>RENEWABLE ENERGY HUB</div>
          </div>
        </div>
      </div>

      {/* Center Nav Pills */}
      <div style={{ flex: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(28,26,23,0.5)', padding: '4px', borderRadius: 6, border: '1px solid rgba(201,146,42,0.15)' }}>
          {['ARCHITECTURE', 'TELEMETRY', 'GOVERNANCE', 'DOCS'].map(l => (
            <button key={l} style={{
              padding: '6px 16px', borderRadius: 4, background: 'transparent', border: '1px solid transparent',
              fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, letterSpacing: '0.15em',
              color: '#A09D94', cursor: 'pointer', transition: 'all 0.2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.color = '#F0EBE0'; e.currentTarget.style.background = 'rgba(201,146,42,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#A09D94'; e.currentTarget.style.background = 'transparent'; }}
            >{l}</button>
          ))}
        </div>
      </div>

      {/* Right */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <button onClick={onLaunch} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 24px', borderRadius: 4,
          border: '1px solid var(--gold)', background: 'rgba(201,146,42,0.1)',
          fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, letterSpacing: '0.15em',
          color: 'var(--gold-bright)', cursor: 'pointer', transition: 'all .2s',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(201,146,42,0.2)'; e.currentTarget.style.boxShadow = 'var(--gold-glow)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(201,146,42,0.1)'; e.currentTarget.style.boxShadow = 'none'; }}
        >
          INITIALIZE SYSTEM →
        </button>
      </div>
    </nav>
  );
}

/* ── HERO CANVAS BACKGROUND ── */
function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const stateRef = useRef({ rot: 0, t: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersRM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const w = canvas.offsetWidth, h = canvas.offsetHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const isMob = canvas.offsetWidth < 640;
    const N = isMob ? 650 : 1100;
    const GA = Math.PI * (3 - Math.sqrt(5));
    const pts = Array.from({ length: N }, (_, i) => {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const th = GA * i;
      return {
        nx: Math.cos(th) * r, ny: y, nz: Math.sin(th) * r,
        sz: 0.5 + Math.random() * 1.2,
        op: 0.18 + Math.random() * 0.52,
        gold: Math.random() < 0.11,
      };
    });

    const stars = Array.from({ length: 175 }, () => ({
      x: Math.random(), y: Math.random(),
      sz: 0.4 + Math.random() * 1.8,
      op: 0.04 + Math.random() * 0.28,
      ph: Math.random() * Math.PI * 2,
      sp: 0.3 + Math.random() * 0.6,
    }));

    const N_T = 30;
    const trails = Array.from({ length: N_T }, (_, i) => ({
      // origin scattered across the whole hero width/height, not just bottom-center
      originX: 0.08 + Math.random() * 0.84,
      originY: 0.55 + Math.random() * 0.55,
      spread: (Math.random() - 0.5) * 2.6,
      len: 160 + Math.random() * 340,
      curve: (Math.random() - 0.5) * 220,
      speed: 0.4 + Math.random() * 1.1,
      dashOff: Math.random() * 600,
      gold: Math.random() < 0.22,
      lw: 0.6 + Math.random() * 0.7,
    }));

    let visible = true;
    const onVis = () => { visible = !document.hidden; };
    document.addEventListener('visibilitychange', onVis);

    const draw = () => {
      animRef.current = requestAnimationFrame(draw);
      if (!visible) return;
      const w = canvas.offsetWidth, h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);
      if (!prefersRM) {
        stateRef.current.t += 0.01;
        stateRef.current.rot += (2 * Math.PI) / (75 * 60);
      }
      const { t, rot } = stateRef.current;
      const cosR = Math.cos(rot), sinR = Math.sin(rot);

      // STARS
      stars.forEach(s => {
        const tw = 0.6 + 0.4 * Math.sin(t * s.sp + s.ph);
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.sz, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(240,235,224,${s.op * tw})`;
        ctx.fill();
      });

      // COMET TRAILS — each has its own scattered origin so they cover the entire hero
      trails.forEach(trail => {
        if (!prefersRM) trail.dashOff -= trail.speed * 2;
        const ox = w * trail.originX, oy = h * trail.originY;
        const ex = ox + Math.sin(trail.spread) * trail.len;
        const ey = oy - Math.cos(trail.spread) * trail.len * 0.85;
        const cpx = ox + Math.sin(trail.spread) * trail.len * 0.4 + trail.curve;
        const cpy = oy - trail.len * 0.42;
        const totalLen = trail.len * 1.5;
        const dashLen = totalLen * 0.2;
        const rgb = trail.gold ? '201,146,42' : '240,235,224';
        const a = trail.gold ? 0.2 : 0.1;
        const grad = ctx.createLinearGradient(ox, oy, ex, ey);
        grad.addColorStop(0, `rgba(${rgb},${a * 1.6})`);
        grad.addColorStop(0.55, `rgba(${rgb},${a})`);
        grad.addColorStop(1, `rgba(${rgb},0)`);
        ctx.save();
        ctx.setLineDash([dashLen, totalLen]);
        ctx.lineDashOffset = trail.dashOff;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.quadraticCurveTo(cpx, cpy, ex, ey);
        ctx.strokeStyle = grad;
        ctx.lineWidth = trail.lw;
        ctx.stroke();
        ctx.restore();
      });

      // PARTICLE SPHERE — spans the hero but weighted toward the right side
      const sphereR = Math.min(w, h) * (isMob ? 0.42 : 0.62);
      const fov = 900;
      const cx = w * (isMob ? 0.5 : 0.74), cy = h * 0.46;
      const projected = pts.map(p => {
        const rx = p.nx * cosR + p.nz * sinR;
        const rz = -p.nx * sinR + p.nz * cosR;
        const depth = (rz + 1) * 0.5;
        const persp = fov / (fov + rz * sphereR);
        return {
          x: rx * sphereR * persp + cx,
          y: p.ny * sphereR * persp + cy,
          z: rz,
          sz: Math.max(0.2, p.sz * persp * 0.85),
          op: p.op * (0.12 + 0.88 * depth),
          gold: p.gold,
        };
      });
      projected.sort((a, b) => a.z - b.z);
      projected.forEach(p => {
        if (p.z < -0.85) return;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.sz, 0, Math.PI * 2);
        ctx.fillStyle = p.gold
          ? `rgba(201,146,42,${p.op})`
          : `rgba(240,235,224,${p.op})`;
        ctx.fill();
      });
    };

    draw();
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        zIndex: 1, pointerEvents: 'none',
      }}
    />
  );
}

/* ── WIND TURBINE VISUAL ── */
function WindTurbineVisual() {
  const [health, setHealth] = useState('98.3');
  useEffect(() => {
    const t = setInterval(() => {
      setHealth((97.8 + Math.random() * 0.8).toFixed(1));
    }, 3000);
    return () => clearInterval(t);
  }, []);

  // Primary (foreground) turbine geometry — offset right-of-center, not dead-straight
  const HUB_X = 335, HUB_Y = 198, BLADE_R = 124;
  const BR = BLADE_R + 14;
  const TOWER_BASE_X = 335, TOWER_TILT = 3.5; // slight lean for a natural, non-rigid stance

  // Refined tapered blade path — wider at root, sharp swept tip, slight curvature for realism
  const BLADE = `M0,0
    C-7,-4 -9,-14 -8,-26
    C-7,-52 -6,-86 -4,-114
    C-3,-126 -1.5,-${BLADE_R - 4} 0,-${BLADE_R}
    C1.5,-${BLADE_R - 4} 3,-126 4,-114
    C6,-86 7,-52 8,-26
    C9,-14 7,-4 0,0 Z`;
  const BLADE_SPINE = `M0,-10 C-1,-46 -0.5,-86 0,-${BLADE_R - 6}`;
  const BLADE_EDGE_HI = `M-6,-20 C-5,-56 -3,-92 -1,-${BLADE_R - 8}`;

  // Background (smaller, distant) turbine geometry — softer, hazier, offset lower-left, closer to horizon
  const HUB2_X = 78, HUB2_Y = 168, BLADE2_R = 56;
  const BR2 = BLADE2_R + 8;
  const TOWER2_TILT = -2.5;
  const BLADE2 = `M0,0
    C-4,-3 -5,-9 -4,-15
    C-3,-30 -3,-50 -2,-64
    C-1,-70 -0.8,-${BLADE2_R - 2} 0,-${BLADE2_R}
    C0.8,-${BLADE2_R - 2} 1,-70 2,-64
    C3,-50 3,-30 4,-15
    C5,-9 4,-3 0,0 Z`;

  const nodes = [
    { val: '4.2ms', lbl: 'LATENCY', s: { top: 14, left: 14 } },
    { val: '48K/s', lbl: 'MSG/S', s: { top: 14, right: 14 } },
    { val: '1,847', lbl: 'CYCLES', s: { bottom: 96, right: 14 } },
    { val: '0.3%', lbl: 'ERR RATE', s: { bottom: 96, left: 14 } },
  ];

  // Deterministic "random" stars/birds so SSR/CSR stay stable
  const birds = [
    { x: 360, y: 88, s: 1, op: 0.5 },
    { x: 400, y: 70, s: 0.8, op: 0.4 },
    { x: 330, y: 110, s: 0.7, op: 0.35 },
  ];

  return (
    <div style={{ position: 'relative', width: 540, height: 540 }}>
      {/* ── Atmospheric backdrop: sky gradient + horizon glow ── */}
      <svg width={540} height={540} viewBox="0 0 540 540" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <radialGradient id="skyGlow" cx="55%" cy="38%" r="65%">
            <stop offset="0" stopColor="#C9922A" stopOpacity="0.10" />
            <stop offset="45%" stopColor="#C9922A" stopOpacity="0.03" />
            <stop offset="1" stopColor="#C9922A" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="horizonFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#C9922A" stopOpacity="0" />
            <stop offset="1" stopColor="#C9922A" stopOpacity="0.05" />
          </linearGradient>
          <radialGradient id="turbGnd" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#C9922A" stopOpacity="0.16" />
            <stop offset="1" stopColor="#C9922A" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="turbGnd2" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#C9922A" stopOpacity="0.08" />
            <stop offset="1" stopColor="#C9922A" stopOpacity="0" />
          </radialGradient>
          <filter id="hubGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="softBlur" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="0.6" />
          </filter>
          <linearGradient id="towerBody" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#161412" />
            <stop offset="0.45" stopColor="#0E0D0C" />
            <stop offset="0.55" stopColor="#0A0908" />
            <stop offset="1" stopColor="#020202" />
          </linearGradient>
          <linearGradient id="towerBody2" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#100F0D" />
            <stop offset="1" stopColor="#020202" />
          </linearGradient>
          <linearGradient id="bladeFill" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#1C1A17" />
            <stop offset="0.5" stopColor="#131210" />
            <stop offset="1" stopColor="#0A0908" />
          </linearGradient>
          <linearGradient id="nacelleFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1E1B17" />
            <stop offset="1" stopColor="#100E0C" />
          </linearGradient>
        </defs>

        {/* soft sky glow behind everything */}
        <rect x={0} y={0} width={540} height={540} fill="url(#skyGlow)" />

        {/* Faint distant mountain / horizon silhouette line for grounding */}
        <path d="M0,470 L60,458 L120,466 L180,450 L240,462 L300,448 L360,460 L420,452 L480,464 L540,456 L540,540 L0,540 Z"
          fill="rgba(201,146,42,0.025)" />

        {/* Drifting birds for life/scale */}
        {birds.map((b, i) => (
          <path key={i} d={`M${b.x - 6 * b.s},${b.y} Q${b.x - 2 * b.s},${b.y - 4 * b.s} ${b.x},${b.y} Q${b.x + 2 * b.s},${b.y - 4 * b.s} ${b.x + 6 * b.s},${b.y}`}
            fill="none" stroke={`rgba(201,146,42,${b.op})`} strokeWidth={0.8} strokeLinecap="round" />
        ))}

        {/* ═════ BACKGROUND TURBINE (distant but clearly visible, slight lean) ═════ */}
        <g opacity={0.85} transform={`rotate(${TOWER2_TILT} ${HUB2_X} 410)`}>
          <ellipse cx={HUB2_X} cy={410} rx={46} ry={7} fill="url(#turbGnd2)" />
          <polygon
            points={`${HUB2_X - 5},410 ${HUB2_X + 5},410 ${HUB2_X + 3},${HUB2_Y + 14} ${HUB2_X - 3},${HUB2_Y + 14}`}
            fill="url(#towerBody2)" stroke="rgba(201,146,42,0.3)" strokeWidth={1}
          />
          <rect x={HUB2_X - 17} y={HUB2_Y - 6} width={34} height={14} rx={2} fill="rgba(14,13,12,0.97)" stroke="rgba(201,146,42,0.45)" strokeWidth={0.8} />
          <circle cx={HUB2_X} cy={HUB2_Y} r={6} fill="rgba(10,9,8,1)" stroke="rgba(201,146,42,0.6)" strokeWidth={1.2} />
        </g>
      </svg>

      {/* Background turbine blades — separate spin layer, slower + offset phase, matching tower lean */}
      <div style={{
        position: 'absolute',
        left: HUB2_X - BR2,
        top: HUB2_Y - BR2,
        width: BR2 * 2,
        height: BR2 * 2,
        transform: `rotate(${TOWER2_TILT}deg)`,
        opacity: 0.85,
      }}>
        <div style={{
          width: '100%',
          height: '100%',
          animation: 'turbineSpin 8s linear infinite',
          transformOrigin: 'center',
        }}>
          <svg width={BR2 * 2} height={BR2 * 2} viewBox={`${-BR2} ${-BR2} ${BR2 * 2} ${BR2 * 2}`}>
            {[0, 120, 240].map(deg => (
              <g key={deg} transform={`rotate(${deg})`}>
                <path d={BLADE2} fill="rgba(18,16,14,0.98)" stroke="rgba(201,146,42,0.4)" strokeWidth={0.8} />
              </g>
            ))}
          </svg>
        </div>
      </div>

      {/* ═════ MAIN SVG: ground, foreground tower, decorative rings — slight lean for a natural stance ═════ */}
      <svg width={540} height={540} viewBox="0 0 540 540" style={{ position: 'absolute', inset: 0 }}>
        <g transform={`rotate(${TOWER_TILT} ${TOWER_BASE_X} 502)`}>
          {/* Ground contact glow */}
          <ellipse cx={HUB_X} cy={504} rx={130} ry={17} fill="url(#turbGnd)" />
          <ellipse cx={HUB_X} cy={502} rx={92} ry={10} fill="none" stroke="rgba(201,146,42,0.16)" strokeWidth={1} />
          <ellipse cx={HUB_X} cy={502} rx={58} ry={5.5} fill="none" stroke="rgba(201,146,42,0.1)" strokeWidth={0.8} />

          {/* Foundation base */}
          <ellipse cx={HUB_X} cy={502} rx={32} ry={10} fill="rgba(12,11,10,0.95)" stroke="rgba(201,146,42,0.32)" strokeWidth={1} />
          <ellipse cx={HUB_X} cy={499} rx={24} ry={6} fill="rgba(201,146,42,0.05)" />

          {/* Access door detail at base */}
          <rect x={HUB_X - 6} y={478} width={12} height={20} rx={1.5} fill="rgba(6,5,4,0.9)" stroke="rgba(201,146,42,0.25)" strokeWidth={0.7} />

          {/* Tower body — tapered, gradient-shaded for 3D roundness */}
          <polygon
            points={`${HUB_X - 13},502 ${HUB_X + 13},502 ${HUB_X + 6},${HUB_Y + 22} ${HUB_X - 6},${HUB_Y + 22}`}
            fill="url(#towerBody)" stroke="rgba(201,146,42,0.22)" strokeWidth={1}
          />
          {/* Tower highlight edge (light catching the curve) */}
          <line x1={HUB_X - 8} y1={496} x2={HUB_X - 4} y2={HUB_Y + 24} stroke="rgba(232,184,75,0.16)" strokeWidth={1} />
          {/* Tower center seam */}
          <line x1={HUB_X} y1={502} x2={HUB_X} y2={HUB_Y + 22} stroke="rgba(0,0,0,0.25)" strokeWidth={1} />

          {/* Tower stiffener rings + rivet flanges */}
          {[440, 380, 320, 265].map((y, i) => {
            const topY = HUB_Y + 22, botY = 502;
            const pct = (botY - y) / (botY - topY);
            const rx = 6 + (1 - pct) * 7;
            return (
              <g key={i}>
                <ellipse cx={HUB_X} cy={y} rx={rx} ry={2.6} fill="none" stroke="rgba(201,146,42,0.13)" strokeWidth={0.8} />
                <ellipse cx={HUB_X} cy={y + 3} rx={rx * 0.96} ry={2.2} fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth={0.6} />
              </g>
            );
          })}

          {/* Warning stripe near top of tower */}
          <rect x={HUB_X - 6.4} y={HUB_Y + 24} width={12.8} height={5} fill="rgba(192,57,43,0.22)" />

          {/* Nacelle housing — rounded gradient box with panel seams */}
          <rect x={HUB_X - 30} y={HUB_Y - 16} width={62} height={28} rx={5} fill="url(#nacelleFill)" stroke="rgba(201,146,42,0.5)" strokeWidth={1} />
          <line x1={HUB_X - 30} y1={HUB_Y - 4} x2={HUB_X + 32} y2={HUB_Y - 4} stroke="rgba(201,146,42,0.08)" strokeWidth={0.6} />
          <rect x={HUB_X - 26} y={HUB_Y - 20} width={52} height={5} rx={1.5} fill="rgba(201,146,42,0.2)" stroke="rgba(201,146,42,0.4)" strokeWidth={0.7} />
          {/* Anemometer mast on nacelle */}
          <line x1={HUB_X + 24} y1={HUB_Y - 16} x2={HUB_X + 24} y2={HUB_Y - 28} stroke="rgba(201,146,42,0.35)" strokeWidth={1} />
          <circle cx={HUB_X + 24} cy={HUB_Y - 29} r={1.6} fill="rgba(201,146,42,0.4)" />

          {/* Beacon light (aviation warning) */}
          <circle cx={HUB_X + 30} cy={HUB_Y - 18} r={2.6} fill="#C0392B">
            <animate attributeName="opacity" values="0;1;0" dur="1.5s" repeatCount="indefinite" />
          </circle>

          {/* Hub — layered rings for depth + glow */}
          <circle cx={HUB_X} cy={HUB_Y} r={15} fill="rgba(8,7,6,1)" stroke="rgba(201,146,42,0.6)" strokeWidth={1.5} filter="url(#hubGlow)" />
          <circle cx={HUB_X} cy={HUB_Y} r={9.5} fill="rgba(14,13,11,1)" stroke="rgba(201,146,42,0.75)" strokeWidth={1} />
          <circle cx={HUB_X} cy={HUB_Y} r={4.5} fill="#C9922A" />
          <circle cx={HUB_X - 1.4} cy={HUB_Y - 1.4} r={1.6} fill="#F4D9A0" opacity={0.85} />

          {/* Decorative telemetry orbit rings around hub */}
          <circle cx={HUB_X} cy={HUB_Y} r={210} fill="none" stroke="rgba(201,146,42,0.045)" strokeWidth={1} strokeDasharray="4 9" />
          <circle cx={HUB_X} cy={HUB_Y} r={164} fill="none" stroke="rgba(201,146,42,0.06)" strokeWidth={1} strokeDasharray="2 7" />
          <circle cx={HUB_X} cy={HUB_Y} r={118} fill="none" stroke="rgba(201,146,42,0.045)" strokeWidth={0.8} strokeDasharray="1 6" />

          {/* Tiny satellite telemetry blips orbiting (purely decorative, static positions) */}
          <circle cx={HUB_X + 164} cy={HUB_Y - 14} r={1.8} fill="var(--gold-bright)" opacity={0.6} />
          <circle cx={HUB_X - 118} cy={HUB_Y + 46} r={1.4} fill="var(--gold-bright)" opacity={0.4} />
        </g>
      </svg>

      {/* ═════ CSS-animated blade group — foreground turbine, matching tower lean ═════ */}
      <div style={{
        position: 'absolute',
        left: HUB_X - BR,
        top: HUB_Y - BR,
        width: BR * 2,
        height: BR * 2,
        transform: `rotate(${TOWER_TILT}deg)`,
        transformOrigin: `${BR}px ${BR + (502 - HUB_Y)}px`,
      }}>
        <div style={{
          width: '100%',
          height: '100%',
          animation: 'turbineSpin 5s linear infinite',
          transformOrigin: 'center',
        }}>
          <svg width={BR * 2} height={BR * 2} viewBox={`${-BR} ${-BR} ${BR * 2} ${BR * 2}`}>
            <defs>
              <linearGradient id="bladeShade" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0" stopColor="#171512" />
                <stop offset="1" stopColor="#0B0A08" />
              </linearGradient>
            </defs>
            {[0, 120, 240].map(deg => (
              <g key={deg} transform={`rotate(${deg})`}>
                <path d={BLADE} fill="url(#bladeShade)" stroke="rgba(201,146,42,0.26)" strokeWidth={0.9} />
                {/* leading-edge highlight for a subtle 3D pitch */}
                <path d={BLADE_EDGE_HI} fill="none" stroke="rgba(232,184,75,0.18)" strokeWidth={0.6} strokeLinecap="round" />
                {/* center spine shadow line */}
                <path d={BLADE_SPINE} fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth={0.5} />
                {/* root reinforcement collar */}
                <ellipse cx={0} cy={-14} rx={7} ry={4} fill="none" stroke="rgba(201,146,42,0.15)" strokeWidth={0.6} />
              </g>
            ))}
            {/* subtle motion-blur arcs to sell rotation speed */}
            <circle cx={0} cy={0} r={BLADE_R * 0.94} fill="none" stroke="rgba(201,146,42,0.035)" strokeWidth={10} />
          </svg>
        </div>
      </div>

      {/* Data nodes — 4 corners, clear of blade sweep zone */}
      {nodes.map((n, i) => (
        <div key={i} style={{
          position: 'absolute', width: 66, height: 52,
          background: 'rgba(14,13,12,0.88)',
          border: '1px solid rgba(201,146,42,0.2)',
          backdropFilter: 'blur(8px)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 2,
          ...n.s,
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: GOLD }}>{n.val}</div>
          <div style={{ fontSize: 7, fontWeight: 600, letterSpacing: '0.12em', color: '#7A7060', textAlign: 'center' }}>{n.lbl}</div>
        </div>
      ))}

      {/* Health score */}
      {/* <div style={{
        position: 'absolute', bottom: 92, left: '50%', transform: 'translateX(-50%)',
        textAlign: 'center', pointerEvents: 'none',
      }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 34, color: GOLD, lineHeight: 1 }}>{health}</div>
        <div style={{ fontSize: 8, fontWeight: 600, letterSpacing: '0.2em', color: '#7A7060', marginTop: 3 }}>HEALTH SCORE</div>
        <div style={{ fontSize: 9, color: '#27AE60', letterSpacing: '0.1em', marginTop: 3 }}>● OPERATIONAL</div>
      </div> */}
    </div>
  );
}

function TypewriterText({ text, speed = 40 }) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    let i = 0;
    const t = setInterval(() => {
      setDisplayed(text.slice(0, i + 1));
      i++;
      if (i >= text.length) clearInterval(t);
    }, speed);
    return () => clearInterval(t);
  }, [text, speed]);
  return <span>{displayed}<span className="blink-cursor">|</span></span>;
}

function Hero({ onLaunch }) {
  return (
    <section style={{
      position: 'relative', zIndex: 10,
      minHeight: 'calc(100vh - 72px - 37px)',
      display: 'grid', gridTemplateColumns: '1fr 1fr',
      alignItems: 'center',
      padding: '0 48px 0 64px', gap: 0, overflow: 'hidden',
    }}>
      <HeroCanvas />

      {/* Left */}
      <motion.div
        initial={{ x: -50, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        style={{ paddingRight: 48 }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 40, padding: '4px 12px', borderRadius: 50, border: '1px solid rgba(39, 174, 96, 0.3)', background: 'rgba(39, 174, 96, 0.08)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#27AE60', display: 'inline-block' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#1B5E20' }}>SYSTEMS NOMINAL</span>
          <span style={{ color: 'rgba(39, 174, 96, 0.3)', margin: '0 4px' }}>|</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', color: '#1B5E20' }}>V4.2.1</span>
        </div>

        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(72px, 8vw, 108px)', lineHeight: 0.9, letterSpacing: '0.02em', color: 'var(--text)', marginBottom: 12 }}>
          AUTONOMOUS<br />
          <span style={{ color: 'var(--gold)' }}>RENEWABLE</span><br />
          <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 'clamp(52px, 5.5vw, 72px)', fontWeight: 400, color: 'var(--text-muted)', letterSpacing: '0.01em', display: 'block' }}>
            intelligence.
          </span>
        </h1>

        <div style={{ width: 80, height: 1, background: 'linear-gradient(90deg, var(--gold), transparent)', margin: '32px 0' }} />

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, lineHeight: 1.8, color: 'var(--gold)', maxWidth: 480, marginBottom: 48, minHeight: 60, fontWeight: 500 }}>
          <TypewriterText text="UTAU: Advanced spatio-temporal telemetry analysis for zero-downtime renewable energy infrastructures." speed={25} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <button onClick={onLaunch} style={{
            display: 'inline-flex', alignItems: 'center', gap: 12,
            padding: '15px 32px', background: 'var(--gold)', borderRadius: 4,
            border: '1px solid var(--gold-bright)',
            fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, letterSpacing: '0.15em',
            color: '#0A0800', cursor: 'pointer', transition: 'all .2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = GOLD_BRIGHT; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(201,146,42,0.3)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = GOLD; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
          >ENTER DASHBOARD →</button>
        </div>
      </motion.div>

      {/* Right */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <WindTurbineVisual />
      </motion.div>
    </section>
  );
}

/* ── STATS BAR ── */
const STATS = [
  { idx: '01', val: '14', suffix: '.2K', label: 'Revenue Loss Mitigated', delta: '+2.4K' },
  { idx: '02', val: '98', suffix: '.9%', label: 'Anomaly Prediction Acc.', delta: '+1.2%' },
  { idx: '03', val: '48', suffix: 'K/s', label: 'Telemetry Throughput', delta: null },
  { idx: '04', val: '0.4', suffix: 'ms', label: 'AI Inference Latency', delta: '-0.1ms' },
];

function StatsBar() {
  return (
    <div style={{ position: 'relative', zIndex: 10, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
      {STATS.map((s, i) => (
        <StatCell key={i} {...s} isLast={i === STATS.length - 1} delay={i * 0.1} />
      ))}
    </div>
  );
}

function StatCell({ idx, val, suffix, label, delta, isLast, delay }) {
  const [hov, setHov] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.6, delay: delay * 0.5 }}
      style={{
        padding: '40px 48px',
        borderRight: isLast ? 'none' : '1px solid var(--border)',
        position: 'relative', overflow: 'hidden',
        background: hov ? 'var(--gold-dim)' : 'transparent',
        transition: 'background .3s',
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {/* bottom line on hover */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: 'var(--gold)', transform: hov ? 'scaleX(1)' : 'scaleX(0)', transition: 'transform .3s', transformOrigin: 'left' }} />
      <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.15em', color: 'var(--text-dim)', marginBottom: 12 }}>{idx}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 56, lineHeight: 1, color: 'var(--text)', marginBottom: 8, letterSpacing: '0.02em' }}>
        {val}<span style={{ color: 'var(--gold)' }}>{suffix}</span>
      </div>
      <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</div>
      {delta && (
        <div style={{ position: 'absolute', top: 40, right: 48, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#27AE60', display: 'flex', alignItems: 'center', gap: 4 }}>
          ▲ {delta}
        </div>
      )}
    </motion.div>
  );
}

/* ── ARCHITECTURE ── */
const ARCH_CARDS = [
  {
    num: '01', labelClass: 'gold', label: 'INGEST LAYER',
    pipeline: ['KAFKA', 'INFLUXDB', 'REDIS'],
    title: 'STREAMING\nINGEST ENGINE',
    desc: 'Zero-latency event bus ingesting highly concurrent multi-dimensional telemetry feeds directly from distributed solar arrays and wind turbines.',
  },
  {
    num: '02', labelClass: 'red', label: 'INTELLIGENCE LAYER',
    pipeline: ['RECON', 'FORECAST', 'CORRELATE'],
    title: 'STP-TranAD\nFORECASTING',
    desc: 'Tri-metric contextual modeling isolates structural degradation (e.g., gearbox wear, panel soiling) leveraging environment-aware contextual features.',
  },
  {
    num: '03', labelClass: 'copper', label: 'GOVERNANCE LAYER',
    pipeline: ['RL POLICY', 'CANARY', 'MITIGATE'],
    title: 'AUTONOMIC\nPRIORITIZATION',
    desc: 'Dynamic fleet-level prioritization and closed-loop feedback instantly ranks at-risk assets based on anomaly severity and revenue-at-risk.',
  },
];

const labelColors = { gold: GOLD, red: CRIMSON, copper: COPPER };

function ArchSection() {
  return (
    <section style={{ position: 'relative', zIndex: 10, padding: '100px 64px 40px 64px' }}>
      <SectionLabel num="02" text="ENTERPRISE ARCHITECTURE" />
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(48px,6vw,80px)', letterSpacing: '0.02em', lineHeight: 0.95, color: 'var(--text)', marginBottom: 24 }}>
        ENGINEERED<br />FOR RESILIENCE.
        <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.7em', fontWeight: 400, display: 'block' }}>
          Three pillars. Zero tolerance.
        </span>
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, border: '1px solid var(--border)', background: 'var(--border)', marginTop: 64 }}>
        {ARCH_CARDS.map((c, i) => <ArchCard key={i} {...c} delay={i * 0.15} />)}
      </div>
    </section>
  );
}

function ArchCard({ num, labelClass, label, pipeline, title, desc, delay }) {
  const [hov, setHov] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.1 }} transition={{ duration: 0.6, delay: delay * 0.5 }}
      style={{
        background: hov ? 'var(--bg-card)' : 'var(--bg-panel)',
        padding: '56px 48px', position: 'relative', overflow: 'hidden',
        transition: 'background .3s',
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {/* big background number */}
      <div style={{ position: 'absolute', right: 32, top: 32, fontFamily: 'var(--font-display)', fontSize: 80, letterSpacing: '0.02em', color: 'rgba(201,146,42,0.05)', lineHeight: 1, pointerEvents: 'none' }}>{num}</div>

      <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.2em', marginBottom: 32, padding: '4px 10px', display: 'inline-block', border: '1px solid', color: labelColors[labelClass], borderColor: `${labelColors[labelClass]}33` }}>
        {label}
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 24 }}>
        {pipeline.map((p, i) => (
          <React.Fragment key={i}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--gold-bright)', padding: '4px 10px', border: '1px solid rgba(201,146,42,0.3)', borderRadius: 4, background: 'rgba(201,146,42,0.1)' }}>{p}</span>
            {i < pipeline.length - 1 && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>→</span>}
          </React.Fragment>
        ))}
      </div>

      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 28, letterSpacing: '0.05em', color: 'var(--text)', marginBottom: 16, lineHeight: 1.1, whiteSpace: 'pre-line' }}>{title}</h3>
      <p style={{ fontFamily: 'var(--font-serif)', fontSize: 16, lineHeight: 1.65, color: 'var(--text-muted)' }}>{desc}</p>
    </motion.div>
  );
}

/* ── SIGNAL CHART (canvas) ── */
function SignalChart({ title = 'VIBRATION SPECTRUM — WIND TURBINE W-07', seed = 0 }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);
  const intervalRef = useRef<any>(null);
  const dataRef = useRef(Array(20).fill(0.5));

  useEffect(() => {
    const NUM = 80;
    function genSignal() {
      const d = [];
      for (let i = 0; i < NUM; i++) {
        let v = 0.5 + Math.sin(i * (0.18 + seed * 0.05)) * 0.25 + Math.random() * 0.12;
        if (i > 55 && i < 68) v += (i - 55) * 0.07 + Math.random() * 0.2;
        d.push(parseFloat(v.toFixed(2)));
      }
      return d;
    }
    dataRef.current = genSignal();

    // Dynamically load Chart.js
    const load = (cb: () => void) => {
      if ((window as any).Chart) { cb(); return; }
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
      s.setAttribute('data-chartjs', '1');
      s.onload = cb;
      document.head.appendChild(s);
    };

    load(() => {
      if (!canvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d');
      chartRef.current = new (window as any).Chart(ctx, {
        type: 'line',
        data: {
          labels: Array.from({ length: NUM }, (_, i) => i),
          datasets: [
            {
              data: dataRef.current,
              borderColor: GOLD,
              borderWidth: 1.5,
              pointRadius: 0,
              fill: true,
              backgroundColor: (context) => {
                const c = context.chart.ctx;
                const g = c.createLinearGradient(0, 0, 0, 160);
                g.addColorStop(0, 'rgba(201,146,42,0.2)');
                g.addColorStop(1, 'rgba(201,146,42,0)');
                return g;
              },
              tension: 0.4,
            },
            {
              data: dataRef.current.map(v => parseFloat((v + 0.1).toFixed(2))),
              borderColor: 'rgba(192,57,43,0.5)',
              borderWidth: 1,
              borderDash: [4, 4],
              pointRadius: 0,
              fill: false,
              tension: 0.4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: {
            x: { display: false },
            y: {
              display: true,
              grid: { color: 'rgba(201,146,42,0.06)', drawBorder: false },
              ticks: { color: '#3D3830', font: { size: 9, family: "'IBM Plex Mono', monospace" }, maxTicksLimit: 4 },
              border: { display: false },
            },
          },
        },
      });

      const intervalId = setInterval(() => {
        if (!chartRef.current) return;
        dataRef.current.shift();
        const v = parseFloat((0.5 + Math.sin(Date.now() * 0.001) * 0.25 + Math.random() * 0.12).toFixed(2));
        dataRef.current.push(v);
        chartRef.current.data.datasets[0].data = dataRef.current;
        chartRef.current.data.datasets[1].data = dataRef.current.map(d => parseFloat((d + 0.1).toFixed(2)));
        chartRef.current.update();
      }, 800);

      intervalRef.current = intervalId;
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    };
  }, []);

  return (
    <div style={{ border: '1px solid var(--border)', background: 'var(--bg)', padding: '24px 32px', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', color: 'var(--text-muted)' }}>{title}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, fontWeight: 600, letterSpacing: '0.15em', color: '#27AE60' }}>
          <span className="live-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#27AE60', boxShadow: '0 0 6px #27AE60', display: 'inline-block' }} />
          LIVE FEED
        </span>
      </div>
      <div style={{ position: 'relative', height: 120 }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: 120 }} />
        {/* Anomaly marker */}
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${(60 / 80) * 100}%`, width: 1, background: 'rgba(192,57,43,0.6)', pointerEvents: 'none' }}>
          <span style={{ position: 'absolute', top: -20, left: 4, fontSize: 8, fontWeight: 600, letterSpacing: '0.12em', color: CRIMSON }}>ANOMALY</span>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
        {['T-60s', 'T-45s', 'T-30s', 'T-15s', 'NOW'].map(l => (
          <span key={l} style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: '0.08em' }}>{l}</span>
        ))}
      </div>
    </div>
  );
}

/* ── ALERT CARDS ── */
const ALERTS = [
  {
    sev: 'critical', badge: 'CRITICAL', time: '00:42:17',
    title: 'Gearbox Wear Progression',
    desc: 'Wind Turbine W-07 shows 3σ deviation in vibration signature independent of wind speed load.',
    metricVal: '847', metricUnit: 'Hz', metricLabel: 'PEAK FREQUENCY',
    action: 'DISPATCH TECH ↗', actionNote: 'EST. LOSS $120/hr',
  },
  {
    sev: 'warning', badge: 'WARNING', time: '00:38:52',
    title: 'Panel Hotspot Detected',
    desc: 'Solar Array S-12 reporting +2.4°C above expected irradiance-adjusted thermal envelope.',
    metricVal: '+2.4', metricUnit: '°C', metricLabel: 'DELTA TEMP',
    action: 'MONITORING', actionNote: 'EFFICIENCY -4.2%',
  },
  {
    sev: 'nominal', badge: 'NOMINAL', time: '00:35:00',
    title: 'Inverter String I-02',
    desc: 'All output metrics aligned with weather context. Model baseline stable.',
    metricVal: '99.9', metricUnit: '%', metricLabel: 'EXPECTED YIELD',
    action: null, actionNote: null,
  },
];

const sevColors = { critical: CRIMSON, warning: GOLD, nominal: '#27AE60' };
const sevBg = { critical: 'rgba(192,57,43,0.1)', warning: 'var(--gold-dim)', nominal: 'rgba(39,174,96,0.08)' };

function AlertCard({ alert, delay }) {
  const c = sevColors[alert.sev];
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: delay * 0.5 }}
      style={{
        background: 'var(--bg)', border: `1px solid var(--border)`, borderLeft: `2px solid ${c}`,
        padding: '20px 24px', borderRadius: 4
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 8, fontWeight: 600, letterSpacing: '0.15em', padding: '2px 8px', color: c, background: sevBg[alert.sev] }}>{alert.badge}</span>
        <span style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: '0.08em' }}>{alert.time}</span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.05em', color: 'var(--text)', marginBottom: 4 }}>{alert.title}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.05em', lineHeight: 1.5 }}>{alert.desc}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-light)' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, letterSpacing: '0.05em', color: c }}>
            {alert.metricVal}<span style={{ fontSize: 14 }}>{alert.metricUnit}</span>
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: '0.1em' }}>{alert.metricLabel}</div>
        </div>
        {alert.action && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: c, letterSpacing: '0.1em', fontWeight: 600 }}>{alert.action}</div>
            <div style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: '0.08em', marginTop: 2 }}>{alert.actionNote}</div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ── MONITOR SECTION ── */
function MonitorSection() {
  return (
    <div style={{ position: 'relative', zIndex: 10, padding: '40px 64px 80px 64px', background: 'var(--bg-panel)' }}>
      <SectionLabel num="03" text="LIVE SIGNAL MONITOR" />
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 48, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <SignalChart title="VIBRATION SPECTRUM — WIND TURBINE W-07" seed={0} />
          <SignalChart title="THERMAL ENVELOPE — SOLAR ARRAY S-12" seed={1} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {ALERTS.map((a, i) => <AlertCard key={i} alert={a} delay={i * 0.15} />)}
        </div>
      </div>
    </div>
  );
}

/* ── FOOTER CTA ── */
function FooterCTA({ onLaunch }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.8 }}
      style={{
        position: 'relative', zIndex: 10,
        padding: '120px 64px',
        borderTop: '1px solid var(--border)',
        display: 'grid', gridTemplateColumns: '1fr auto',
        alignItems: 'center', gap: 48,
        background: 'var(--bg)', overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', left: 64, bottom: -60, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(201,146,42,0.04) 0%, transparent 60%)', pointerEvents: 'none' }} />
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.2em', color: 'var(--text-muted)', marginBottom: 20 }}>INITIALIZE DEPLOYMENT</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(48px,5vw,72px)', lineHeight: 0.95, color: 'var(--text)', letterSpacing: '0.02em' }}>
          READY TO<br />
          <span style={{ color: 'var(--gold)', display: 'block' }}>DEPLOY UTAU?</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-end' }}>
        <button onClick={onLaunch} style={{
          display: 'inline-flex', alignItems: 'center', gap: 12,
          padding: '15px 32px', background: 'var(--gold)',
          border: '1px solid var(--gold-bright)', whiteSpace: 'nowrap',
          fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, letterSpacing: '0.15em',
          color: '#0A0800', cursor: 'pointer',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = GOLD_BRIGHT; }}
          onMouseLeave={e => { e.currentTarget.style.background = GOLD; }}
        >ACCESS DASHBOARD →</button>
        <button style={{
          display: 'inline-flex', alignItems: 'center', gap: 10,
          padding: '15px 32px', background: 'transparent',
          border: '1px solid var(--text-dim)', whiteSpace: 'nowrap',
          fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, letterSpacing: '0.15em',
          color: 'var(--text-muted)', cursor: 'pointer',
        }}>REQUEST ENTERPRISE DEMO</button>
        <div style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: '0.12em', textAlign: 'right' }}>
          SOC 2 TYPE II · ISO 27001 · NERC CIP COMPLIANT
        </div>
      </div>
    </motion.div>
  );
}

/* ── BOTTOM BAR ── */
function BottomBar() {
  return (
    <div style={{
      position: 'relative', zIndex: 10,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '20px 64px',
      borderTop: '1px solid var(--border-light)',
      background: 'var(--bg-panel)',
    }}>
      <div style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: '0.1em' }}>© 2026 UTAU SYSTEMS. ALL RIGHTS RESERVED.</div>
      <div style={{ display: 'flex', gap: 24 }}>
        {['PRIVACY', 'SECURITY', 'COMPLIANCE', 'STATUS'].map(l => (
          <a key={l} href="#" style={{ fontSize: 9, color: 'var(--text-dim)', textDecoration: 'none', letterSpacing: '0.1em' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-muted)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
          >{l}</a>
        ))}
      </div>
    </div>
  );
}

/* ── SECTION LABEL ── */
function SectionLabel({ num, text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 64 }}>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: '0.2em', color: 'var(--gold)' }}>{num}</span>
      <span style={{ flex: '0 0 40px', height: 1, background: 'var(--border)' }} />
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.2em', color: 'var(--text-muted)' }}>{text}</span>
    </div>
  );
}

/* ── ROOT ── */
export default function LandingPage({ onLaunch = () => { } }) {
  return (
    <>
      <FontLoader />
      <GlobalStyles />
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <Nav onLaunch={onLaunch} />
        <Ticker />
        <Hero onLaunch={onLaunch} />
        <StatsBar />
        <ArchSection />
        <MonitorSection />
        <FooterCTA onLaunch={onLaunch} />
        <BottomBar />
      </div>
    </>
  );
}