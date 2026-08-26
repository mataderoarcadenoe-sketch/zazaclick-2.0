import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

export type MeshVariant = 'admin' | 'client' | 'login' | 'minimal' | 'analytics' | 'premium';

export interface InteractiveGravityMeshProps {
  variant?: MeshVariant;
  maxDistance?: number;
  isDark?: boolean;
  className?: string;
  enablePulses?: boolean;
  enableRipples?: boolean;
  enableMouseInteraction?: boolean;
  enableRadarSweep?: boolean;
}

export interface InteractiveGravityMeshRef {
  triggerPulse: (sourceIdx?: number, targetIdx?: number) => void;
  triggerRipple: (x: number, y: number) => void;
  triggerBurst: (nodeId?: number) => void;
  emitEvent: (event: { type: string; payload?: any }) => void;
}

export type HierarchyTier = 'CORE' | 'HUB' | 'RELAY' | 'EDGE';

/* ═══════════════════════════════════════════════════════════════
   ✦ CELESTIAL CONSTELLATION ENGINE — ZAZA CLICK 2.0
   ═══════════════════════════════════════════════════════════════
   A premium living constellation with:
   ★  Multi-layer parallax star field with realistic twinkling
   ✦  Constellation lines connecting major stars
   ☄  Rare spectacular shooting stars / comets
   🛰 Orbiting micro-satellites around gateway nodes
   ✧  Nebula glow halos behind star clusters
   ⚡  Luminous data pulses traveling the network
   🌌  Deep-field background stars for cosmic depth
   ═══════════════════════════════════════════════════════════════ */

// ── Deep-field background stars (tiny, distant, twinkling) ──
interface DeepStar {
  x: number;
  y: number;
  size: number;
  baseAlpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
}

// ── Constellation stars (main network nodes) ──
interface ConstellationStar {
  id: number;
  anchorX: number;
  anchorY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  tier: HierarchyTier;
  radius: number;
  brightness: number;
  phase: number;
  driftRadius: number;
  driftSpeedX: number;
  driftSpeedY: number;
  depth: number;
  activity: number;
  hasCrossFlare: boolean;
}

// ── Constellation lines ──
interface ConstellationLine {
  i: number;
  j: number;
  dist: number;
}

// ── Shooting star / comet ──
interface ShootingStar {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  length: number;
  brightness: number;
  life: number;
  maxLife: number;
  hue: number; // 0 = white, 1 = cyan, 2 = emerald
}

// ── Orbiting satellite ──
interface Satellite {
  parentId: number;
  angle: number;
  speed: number;
  orbitRadius: number;
  size: number;
  trailAngle: number;
}

// ── Data pulse ──
interface DataPulse {
  active: boolean;
  srcIdx: number;
  tgtIdx: number;
  progress: number;
  speed: number;
  color: number; // 0=cyan, 1=emerald
}

// ── Ripple ──
interface Ripple {
  active: boolean;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
}

export const InteractiveGravityMesh = forwardRef<InteractiveGravityMeshRef, InteractiveGravityMeshProps>(
  (
    {
      variant = 'premium',
      maxDistance: _propMaxDistance,
      isDark = true,
      className = 'fixed inset-0 pointer-events-none z-0',
      enablePulses = true,
      enableRipples = true,
      enableMouseInteraction = true,
    },
    ref,
  ) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const starsRef = useRef<ConstellationStar[]>([]);
    const deepStarsRef = useRef<DeepStar[]>([]);
    const connsRef = useRef<ConstellationLine[]>([]);
    const cometsRef = useRef<ShootingStar[]>([]);
    const satellitesRef = useRef<Satellite[]>([]);
    const pulsesRef = useRef<DataPulse[]>([]);
    const ripplesRef = useRef<Ripple[]>([]);
    const mouseRef = useRef({ x: -9999, y: -9999, active: false });

    const fireBurst = (nodeId?: number) => {
      const stars = starsRef.current;
      const conns = connsRef.current;
      const pulses = pulsesRef.current;
      if (!stars.length || !conns.length) return;
      const id = nodeId ?? stars.find(s => s.tier === 'CORE')?.id ?? 0;
      conns
        .filter(c => c.i === id || c.j === id)
        .forEach(c => {
          const p = pulses.find(pp => !pp.active);
          if (p) {
            p.active = true;
            p.srcIdx = c.i === id ? c.i : c.j;
            p.tgtIdx = c.i === id ? c.j : c.i;
            p.progress = 0;
            p.speed = 0.018 + Math.random() * 0.012;
            p.color = Math.random() > 0.5 ? 0 : 1;
          }
        });
      const s = stars.find(ss => ss.id === id);
      if (s) s.activity = 1;
    };

    useImperativeHandle(ref, () => ({
      triggerPulse: () => {
        const conns = connsRef.current;
        if (!conns.length) return;
        const c = conns[Math.floor(Math.random() * conns.length)];
        const p = pulsesRef.current.find(pp => !pp.active);
        if (p) { p.active = true; p.srcIdx = c.i; p.tgtIdx = c.j; p.progress = 0; p.speed = 0.015 + Math.random() * 0.01; p.color = Math.random() > 0.5 ? 0 : 1; }
      },
      triggerRipple: (x: number, y: number) => {
        const r = ripplesRef.current.find(rr => !rr.active);
        if (r) { r.active = true; r.x = x; r.y = y; r.radius = 0; r.maxRadius = 220; r.alpha = 0.5; }
      },
      triggerBurst: fireBurst,
      emitEvent: () => fireBurst(),
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) return;

      let raf: number;
      let W = 0, H = 0, dpr = 1, maxDist = 280;

      /* ─── Color System ─── */
      const C = isDark ? {
        // Stars
        starBright: 'rgba(255, 255, 255, ',
        starCyan: 'rgba(165, 243, 252, ',      // cyan-200
        starEmerald: 'rgba(167, 243, 208, ',    // emerald-200
        starDim: 'rgba(203, 213, 225, ',        // slate-300
        // Constellation lines
        linePrimary: 'rgba(52, 211, 153, ',     // emerald-400
        lineSecondary: 'rgba(103, 232, 249, ',  // cyan-300
        lineFaint: 'rgba(148, 163, 184, ',      // slate-400
        // Nebula
        nebulaEmerald: 'rgba(16, 185, 129, ',
        nebulaCyan: 'rgba(6, 182, 212, ',
        // Comet
        cometHead: '#FFFFFF',
        cometTrailCyan: 'rgba(103, 232, 249, ',
        cometTrailEmerald: 'rgba(52, 211, 153, ',
        cometTrailWhite: 'rgba(255, 255, 255, ',
        // Satellite
        satellite: '#67E8F9',
        satelliteTrail: 'rgba(103, 232, 249, ',
        // Pulse
        pulseCyan: '#67E8F9',
        pulseEmerald: '#34D399',
        pulseTrailCyan: 'rgba(103, 232, 249, ',
        pulseTrailEmerald: 'rgba(52, 211, 153, ',
        // Mouse
        mouseRing: 'rgba(165, 243, 252, 0.25)',
        mouseLine: 'rgba(103, 232, 249, ',
        // Ripple
        ripple: 'rgba(52, 211, 153, ',
        // Cross-flare
        flare: 'rgba(255, 255, 255, ',
      } : {
        starBright: 'rgba(15, 23, 42, ',
        starCyan: 'rgba(14, 116, 144, ',
        starEmerald: 'rgba(4, 120, 87, ',
        starDim: 'rgba(100, 116, 139, ',
        linePrimary: 'rgba(16, 185, 129, ',
        lineSecondary: 'rgba(8, 145, 178, ',
        lineFaint: 'rgba(148, 163, 184, ',
        nebulaEmerald: 'rgba(16, 185, 129, ',
        nebulaCyan: 'rgba(8, 145, 178, ',
        cometHead: '#047857',
        cometTrailCyan: 'rgba(8, 145, 178, ',
        cometTrailEmerald: 'rgba(16, 185, 129, ',
        cometTrailWhite: 'rgba(15, 23, 42, ',
        satellite: '#0891B2',
        satelliteTrail: 'rgba(8, 145, 178, ',
        pulseCyan: '#0891B2',
        pulseEmerald: '#059669',
        pulseTrailCyan: 'rgba(8, 145, 178, ',
        pulseTrailEmerald: 'rgba(16, 185, 129, ',
        mouseRing: 'rgba(14, 116, 144, 0.18)',
        mouseLine: 'rgba(14, 116, 144, ',
        ripple: 'rgba(16, 185, 129, ',
        flare: 'rgba(15, 23, 42, ',
      };

      /* ─── Build Universe ─── */
      const build = () => {
        const isMobile = W < 640;
        const cols = isMobile ? 5 : variant === 'minimal' ? 6 : 8;
        const rows = isMobile ? 6 : variant === 'minimal' ? 4 : 5;
        const cellW = W / cols;
        const cellH = H / rows;
        maxDist = Math.hypot(cellW, cellH) * 1.2;

        // ── Deep-field stars ──
        const deepCount = isMobile ? 60 : 120;
        const deep: DeepStar[] = [];
        for (let i = 0; i < deepCount; i++) {
          deep.push({
            x: Math.random() * W,
            y: Math.random() * H,
            size: Math.random() * 1.4 + 0.4,
            baseAlpha: Math.random() * 0.5 + 0.15,
            twinkleSpeed: 0.015 + Math.random() * 0.025,
            twinklePhase: Math.random() * Math.PI * 2,
          });
        }
        deepStarsRef.current = deep;

        // ── Constellation stars (grid-distributed with jitter) ──
        const stars: ConstellationStar[] = [];
        let id = 0;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const odd = r % 2 === 1 ? cellW * 0.5 : 0;
            const bx = c * cellW + cellW * 0.5 + odd;
            const by = r * cellH + cellH * 0.5;
            if (bx < 25 || bx > W - 25 || by < 25 || by > H - 25) continue;

            const jx = (Math.random() - 0.5) * cellW * 0.55;
            const jy = (Math.random() - 0.5) * cellH * 0.55;
            const ax = bx + jx;
            const ay = by + jy;

            let tier: HierarchyTier = 'EDGE';
            let radius = 1.6;
            let brightness = 0.4;
            const isCorePos =
              (r === 1 && c === 2) ||
              (r === Math.floor(rows / 2) && c === Math.floor(cols / 2)) ||
              (r === rows - 2 && c === cols - 3);
            const isHubPos = ((r + c) % 3 === 0) && !isCorePos;

            if (isCorePos) { tier = 'CORE'; radius = 3.0; brightness = 1.0; }
            else if (isHubPos) { tier = 'HUB'; radius = 2.2; brightness = 0.7; }
            else if (Math.random() < 0.35) { tier = 'RELAY'; radius = 1.8; brightness = 0.55; }

            stars.push({
              id: id++, anchorX: ax, anchorY: ay,
              x: ax, y: ay, vx: 0, vy: 0,
              tier, radius, brightness,
              phase: Math.random() * Math.PI * 2,
              driftRadius: 6 + Math.random() * 10,
              driftSpeedX: (0.002 + Math.random() * 0.003) * (Math.random() > 0.5 ? 1 : -1),
              driftSpeedY: (0.002 + Math.random() * 0.003) * (Math.random() > 0.5 ? 1 : -1),
              depth: 0.6 + Math.random() * 0.4,
              activity: 0,
              hasCrossFlare: tier === 'CORE',
            });
          }
        }
        starsRef.current = stars;

        // ── Satellites on CORE and HUB stars ──
        const sats: Satellite[] = [];
        stars.forEach(s => {
          if (s.tier === 'CORE') {
            sats.push({ parentId: s.id, angle: Math.random() * Math.PI * 2, speed: 0.012 + Math.random() * 0.008, orbitRadius: 18 + Math.random() * 8, size: 1.6, trailAngle: 0 });
            sats.push({ parentId: s.id, angle: Math.random() * Math.PI * 2, speed: -(0.008 + Math.random() * 0.006), orbitRadius: 28 + Math.random() * 6, size: 1.2, trailAngle: 0 });
          } else if (s.tier === 'HUB') {
            sats.push({ parentId: s.id, angle: Math.random() * Math.PI * 2, speed: 0.015 + Math.random() * 0.008, orbitRadius: 14 + Math.random() * 6, size: 1.3, trailAngle: 0 });
          }
        });
        satellitesRef.current = sats;

        // ── Comets pool ──
        const comets: ShootingStar[] = [];
        for (let i = 0; i < 3; i++) {
          comets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, speed: 0, length: 0, brightness: 0, life: 0, maxLife: 0, hue: 0 });
        }
        cometsRef.current = comets;

        // ── Data pulses pool ──
        const pulses: DataPulse[] = [];
        for (let i = 0; i < 8; i++) {
          pulses.push({ active: false, srcIdx: 0, tgtIdx: 0, progress: 0, speed: 0.015, color: 0 });
        }
        pulsesRef.current = pulses;

        // ── Ripples pool ──
        const ripples: Ripple[] = [];
        for (let i = 0; i < 4; i++) {
          ripples.push({ active: false, x: 0, y: 0, radius: 0, maxRadius: 220, alpha: 0 });
        }
        ripplesRef.current = ripples;
      };

      const resize = () => {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = window.innerWidth;
        H = window.innerHeight;
        canvas.width = Math.floor(W * dpr);
        canvas.height = Math.floor(H * dpr);
        build();
      };
      resize();

      /* ─── Input ─── */
      const onMove = (e: MouseEvent) => { if (enableMouseInteraction) { mouseRef.current.x = e.clientX; mouseRef.current.y = e.clientY; mouseRef.current.active = true; } };
      const onLeave = () => { mouseRef.current.active = false; mouseRef.current.x = -9999; };
      const onClick = (e: MouseEvent) => {
        const stars = starsRef.current;
        for (const s of stars) { if (Math.hypot(e.clientX - s.x, e.clientY - s.y) < 28) { fireBurst(s.id); return; } }
        if (enableRipples) { const r = ripplesRef.current.find(rr => !rr.active); if (r) { r.active = true; r.x = e.clientX; r.y = e.clientY; r.radius = 0; r.maxRadius = 220; r.alpha = 0.55; } }
      };

      window.addEventListener('resize', resize);
      window.addEventListener('mousemove', onMove, { passive: true });
      window.addEventListener('mouseleave', onLeave);
      window.addEventListener('click', onClick, { passive: true });

      let t = 0;
      let cometTimer = 200 + Math.random() * 300;

      const frame = () => {
        t += 1;
        const stars = starsRef.current;
        const N = stars.length;
        const mouse = mouseRef.current;

        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, W, H);

        /* ═══ LAYER 1: DEEP-FIELD STARS (twinkling background) ═══ */
        const deep = deepStarsRef.current;
        for (let i = 0; i < deep.length; i++) {
          const d = deep[i];
          d.twinklePhase += d.twinkleSpeed;
          const alpha = d.baseAlpha * (0.5 + 0.5 * Math.sin(d.twinklePhase));

          ctx.beginPath();
          ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
          ctx.fillStyle = `${C.starDim}${alpha.toFixed(3)})`;
          ctx.fill();
        }

        /* ═══ LAYER 2: PHYSICS — constellation stars drift ═══ */
        for (let i = 0; i < N; i++) {
          const s = stars[i];
          const tx = s.anchorX + Math.cos(t * s.driftSpeedX + s.phase) * s.driftRadius;
          const ty = s.anchorY + Math.sin(t * s.driftSpeedY + s.phase * 1.3) * s.driftRadius;

          s.vx += (tx - s.x) * 0.02;
          s.vy += (ty - s.y) * 0.02;

          // repulsion
          for (let j = i + 1; j < N; j++) {
            const o = stars[j];
            const dx = s.x - o.x; const dy = s.y - o.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < 2500 && d2 > 0.01) {
              const d = Math.sqrt(d2);
              const f = (1 - d / 50) * 0.35;
              s.vx += (dx / d) * f; s.vy += (dy / d) * f;
              o.vx -= (dx / d) * f; o.vy -= (dy / d) * f;
            }
          }

          // mouse attraction
          if (mouse.active) {
            const dx = mouse.x - s.x; const dy = mouse.y - s.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < 200 && d > 1) {
              const pull = (1 - d / 200) * 0.6;
              s.vx += (dx / d) * pull * 0.12;
              s.vy += (dy / d) * pull * 0.12;
              s.activity = Math.max(s.activity, pull * 0.6);
            }
          }

          // ripple influence
          for (const rp of ripplesRef.current) {
            if (!rp.active) continue;
            const dx = s.x - rp.x; const dy = s.y - rp.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            const band = Math.abs(d - rp.radius);
            if (band < 30) {
              const f = (1 - band / 30) * rp.alpha * 1.2;
              s.vx += (dx / Math.max(d, 1)) * f * 0.15;
              s.vy += (dy / Math.max(d, 1)) * f * 0.15;
              s.activity = Math.max(s.activity, rp.alpha * 0.4);
            }
          }

          s.vx *= 0.93; s.vy *= 0.93;
          s.x += s.vx; s.y += s.vy;
          if (s.activity > 0) s.activity = Math.max(0, s.activity - 0.006);
        }

        /* ═══ LAYER 3: CONSTELLATION LINES ═══ */
        const conns: ConstellationLine[] = [];
        const maxPerNode = 3;
        const counts = new Uint8Array(N);
        const maxD2 = maxDist * maxDist;

        for (let i = 0; i < N; i++) {
          if (counts[i] >= maxPerNode) continue;
          for (let j = i + 1; j < N; j++) {
            if (counts[j] >= maxPerNode) continue;
            const dx = stars[i].x - stars[j].x;
            const dy = stars[i].y - stars[j].y;
            const d2 = dx * dx + dy * dy;
            if (d2 < maxD2 && d2 > 900) {
              conns.push({ i, j, dist: Math.sqrt(d2) });
              counts[i]++; counts[j]++;
              if (counts[i] >= maxPerNode) break;
            }
          }
        }
        connsRef.current = conns;

        for (const c of conns) {
          const a = stars[c.i]; const b = stars[c.j];
          const ratio = 1 - c.dist / maxDist;
          const boost = Math.max(a.activity, b.activity);
          const isTrunk = (a.tier === 'CORE' || a.tier === 'HUB') && (b.tier === 'CORE' || b.tier === 'HUB');

          const baseAlpha = ratio * (isTrunk ? 0.28 : 0.14) + boost * 0.18;
          const lineColor = isTrunk ? C.linePrimary : (a.tier !== 'EDGE' || b.tier !== 'EDGE') ? C.lineSecondary : C.lineFaint;

          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `${lineColor}${Math.min(0.40, baseAlpha).toFixed(3)})`;
          ctx.lineWidth = isTrunk ? 0.9 : 0.5;
          ctx.stroke();
        }

        /* ═══ LAYER 4: MOUSE INTERACTION ═══ */
        if (mouse.active && enableMouseInteraction) {
          ctx.beginPath();
          ctx.arc(mouse.x, mouse.y, 16 + Math.sin(t * 0.05) * 2, 0, Math.PI * 2);
          ctx.strokeStyle = C.mouseRing;
          ctx.lineWidth = 0.7;
          ctx.stroke();

          for (const s of stars) {
            const d = Math.hypot(mouse.x - s.x, mouse.y - s.y);
            if (d < 180) {
              ctx.beginPath();
              ctx.moveTo(mouse.x, mouse.y);
              ctx.lineTo(s.x, s.y);
              ctx.strokeStyle = `${C.mouseLine}${((1 - d / 180) * 0.18).toFixed(3)})`;
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          }
        }

        /* ═══ LAYER 5: NEBULA GLOW behind CORE stars ═══ */
        for (const s of stars) {
          if (s.tier !== 'CORE') continue;
          const nebulaR = 50 + Math.sin(t * 0.02 + s.phase) * 12 + s.activity * 25;
          const grad = ctx.createRadialGradient(s.x, s.y, 2, s.x, s.y, nebulaR);
          grad.addColorStop(0, `${C.nebulaEmerald}${(0.10 + s.activity * 0.08).toFixed(3)})`);
          grad.addColorStop(0.5, `${C.nebulaCyan}${(0.04 + s.activity * 0.04).toFixed(3)})`);
          grad.addColorStop(1, `${C.nebulaEmerald}0)`);
          ctx.beginPath();
          ctx.arc(s.x, s.y, nebulaR, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
        }

        /* ═══ LAYER 6: DATA PULSES traveling constellation lines ═══ */
        if (enablePulses && conns.length > 0) {
          const pulses = pulsesRef.current;
          for (const p of pulses) {
            if (!p.active) {
              if (Math.random() > 0.004) continue;
              const c = conns[Math.floor(Math.random() * conns.length)];
              p.active = true; p.srcIdx = c.i; p.tgtIdx = c.j;
              p.progress = 0; p.speed = 0.010 + Math.random() * 0.008;
              p.color = Math.random() > 0.5 ? 0 : 1;
            }

            p.progress += p.speed;
            if (p.progress >= 1) { p.active = false; const tn = stars[p.tgtIdx]; if (tn) tn.activity = Math.min(1, tn.activity + 0.4); continue; }

            const s = stars[p.srcIdx]; const e = stars[p.tgtIdx];
            if (!s || !e) continue;
            const tt = p.progress; const u = 1 - tt;
            const hx = u * s.x + tt * e.x;
            const hy = u * s.y + tt * e.y;

            // trail
            const tt2 = Math.max(0, tt - 0.2); const u2 = 1 - tt2;
            const tx = u2 * s.x + tt2 * e.x;
            const ty = u2 * s.y + tt2 * e.y;

            const vis = Math.sin(p.progress * Math.PI);
            const trailColor = p.color === 0 ? C.pulseTrailCyan : C.pulseTrailEmerald;
            const headColor = p.color === 0 ? C.pulseCyan : C.pulseEmerald;

            const grad = ctx.createLinearGradient(tx, ty, hx, hy);
            grad.addColorStop(0, `${trailColor}0)`);
            grad.addColorStop(1, `${trailColor}${(vis * 0.6).toFixed(3)})`);
            ctx.beginPath();
            ctx.moveTo(tx, ty); ctx.lineTo(hx, hy);
            ctx.strokeStyle = grad;
            ctx.lineWidth = 1.8;
            ctx.stroke();

            // glowing head
            ctx.beginPath();
            ctx.arc(hx, hy, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = headColor;
            ctx.shadowColor = headColor;
            ctx.shadowBlur = 10;
            ctx.globalAlpha = vis;
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
          }
        }

        /* ═══ LAYER 7: SHOOTING STARS / COMETS ═══ */
        cometTimer--;
        if (cometTimer <= 0) {
          const comet = cometsRef.current.find(c => !c.active);
          if (comet) {
            const fromLeft = Math.random() > 0.5;
            const angle = (Math.random() * 0.4 + 0.2) * (fromLeft ? 1 : -1); // shallow angle
            comet.active = true;
            comet.x = fromLeft ? -20 : W + 20;
            comet.y = Math.random() * H * 0.6;
            comet.speed = 4 + Math.random() * 5;
            comet.vx = Math.cos(angle) * comet.speed * (fromLeft ? 1 : -1);
            comet.vy = Math.sin(Math.abs(angle)) * comet.speed;
            comet.length = 60 + Math.random() * 80;
            comet.brightness = 0.7 + Math.random() * 0.3;
            comet.life = 0;
            comet.maxLife = 80 + Math.random() * 60;
            comet.hue = Math.floor(Math.random() * 3);
          }
          cometTimer = 300 + Math.random() * 500; // next comet in 5-13 seconds
        }

        for (const comet of cometsRef.current) {
          if (!comet.active) continue;
          comet.x += comet.vx;
          comet.y += comet.vy;
          comet.life++;

          if (comet.life > comet.maxLife || comet.x < -100 || comet.x > W + 100 || comet.y > H + 50) {
            comet.active = false; continue;
          }

          const fadeIn = Math.min(1, comet.life / 12);
          const fadeOut = Math.max(0, 1 - (comet.life - comet.maxLife + 20) / 20);
          const alpha = comet.brightness * fadeIn * fadeOut;

          // direction for trail
          const mag = Math.sqrt(comet.vx * comet.vx + comet.vy * comet.vy);
          const dirX = -comet.vx / mag;
          const dirY = -comet.vy / mag;

          const tailX = comet.x + dirX * comet.length;
          const tailY = comet.y + dirY * comet.length;

          const trailPal = comet.hue === 0 ? C.cometTrailWhite : comet.hue === 1 ? C.cometTrailCyan : C.cometTrailEmerald;

          const grad = ctx.createLinearGradient(tailX, tailY, comet.x, comet.y);
          grad.addColorStop(0, `${trailPal}0)`);
          grad.addColorStop(0.6, `${trailPal}${(alpha * 0.35).toFixed(3)})`);
          grad.addColorStop(1, `${trailPal}${(alpha * 0.8).toFixed(3)})`);

          ctx.beginPath();
          ctx.moveTo(tailX, tailY);
          ctx.lineTo(comet.x, comet.y);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 2;
          ctx.stroke();

          // bright head
          ctx.beginPath();
          ctx.arc(comet.x, comet.y, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = C.cometHead;
          ctx.shadowColor = C.cometHead;
          ctx.shadowBlur = 12;
          ctx.globalAlpha = alpha;
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.shadowBlur = 0;
        }

        /* ═══ LAYER 8: ORBITING SATELLITES ═══ */
        const sats = satellitesRef.current;
        for (const sat of sats) {
          sat.angle += sat.speed;
          sat.trailAngle = sat.angle - sat.speed * 8;

          const parent = stars.find(s => s.id === sat.parentId);
          if (!parent) continue;

          const sx = parent.x + Math.cos(sat.angle) * sat.orbitRadius;
          const sy = parent.y + Math.sin(sat.angle) * sat.orbitRadius;

          // faint orbit ring
          ctx.beginPath();
          ctx.arc(parent.x, parent.y, sat.orbitRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `${C.satelliteTrail}0.06)`;
          ctx.lineWidth = 0.4;
          ctx.stroke();

          // satellite trail arc
          const trailStart = sat.trailAngle;
          const trailEnd = sat.angle;
          ctx.beginPath();
          if (sat.speed > 0) {
            ctx.arc(parent.x, parent.y, sat.orbitRadius, trailStart, trailEnd);
          } else {
            ctx.arc(parent.x, parent.y, sat.orbitRadius, trailEnd, trailStart);
          }
          ctx.strokeStyle = `${C.satelliteTrail}0.20)`;
          ctx.lineWidth = 0.8;
          ctx.stroke();

          // satellite body
          ctx.beginPath();
          ctx.arc(sx, sy, sat.size, 0, Math.PI * 2);
          ctx.fillStyle = C.satellite;
          ctx.shadowColor = C.satellite;
          ctx.shadowBlur = 6;
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        /* ═══ LAYER 9: RIPPLES ═══ */
        for (const r of ripplesRef.current) {
          if (!r.active) continue;
          r.radius += 2.5;
          r.alpha *= 0.975;
          if (r.radius > r.maxRadius || r.alpha < 0.01) { r.active = false; continue; }

          ctx.beginPath();
          ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
          ctx.strokeStyle = `${C.ripple}${(r.alpha * 0.35).toFixed(3)})`;
          ctx.lineWidth = 1.0;
          ctx.stroke();
        }

        /* ═══ LAYER 10: CONSTELLATION STARS (rendered last = on top) ═══ */
        for (const s of stars) {
          const pulse = 0.85 + 0.15 * Math.sin(t * 0.04 + s.phase);
          const alpha = s.brightness * pulse * s.depth + s.activity * 0.3;

          // Cross-flare for CORE stars
          if (s.hasCrossFlare) {
            const flareLen = 8 + Math.sin(t * 0.03 + s.phase) * 3 + s.activity * 6;
            const flareAlpha = (0.20 + s.activity * 0.15) * s.depth;

            ctx.beginPath();
            ctx.moveTo(s.x - flareLen, s.y);
            ctx.lineTo(s.x + flareLen, s.y);
            ctx.strokeStyle = `${C.flare}${flareAlpha.toFixed(3)})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(s.x, s.y - flareLen);
            ctx.lineTo(s.x, s.y + flareLen);
            ctx.strokeStyle = `${C.flare}${flareAlpha.toFixed(3)})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }

          // Halo ring for CORE
          if (s.tier === 'CORE') {
            const haloR = s.radius + 5 + Math.sin(t * 0.025 + s.phase) * 2;
            ctx.beginPath();
            ctx.arc(s.x, s.y, haloR, 0, Math.PI * 2);
            ctx.strokeStyle = `${C.starEmerald}${(0.15 + s.activity * 0.15).toFixed(3)})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }

          // Halo ring for HUB
          if (s.tier === 'HUB') {
            const haloR = s.radius + 3.5 + Math.sin(t * 0.03 + s.phase) * 1.5;
            ctx.beginPath();
            ctx.arc(s.x, s.y, haloR, 0, Math.PI * 2);
            ctx.strokeStyle = `${C.starCyan}${(0.10 + s.activity * 0.12).toFixed(3)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }

          // Star body with glow
          const color = s.tier === 'CORE' ? C.starEmerald : s.tier === 'HUB' ? C.starCyan : C.starDim;
          const r = s.radius + s.activity * 1.0;

          ctx.beginPath();
          ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
          ctx.fillStyle = `${color}${Math.min(0.95, alpha).toFixed(3)})`;
          if (s.tier === 'CORE' || s.tier === 'HUB') {
            ctx.shadowColor = `${color}0.5)`;
            ctx.shadowBlur = s.tier === 'CORE' ? 10 : 6;
          }
          ctx.fill();
          ctx.shadowBlur = 0;

          // Bright inner core
          if (s.tier === 'CORE') {
            ctx.beginPath();
            ctx.arc(s.x, s.y, 1.2, 0, Math.PI * 2);
            ctx.fillStyle = `${C.starBright}${(0.9 * s.depth).toFixed(3)})`;
            ctx.fill();
          }
        }

        ctx.restore();
        raf = requestAnimationFrame(frame);
      };

      frame();

      return () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', resize);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseleave', onLeave);
        window.removeEventListener('click', onClick);
      };
    }, [isDark, enablePulses, enableRipples, enableMouseInteraction, variant, _propMaxDistance]);

    return (
      <canvas
        ref={canvasRef}
        className={className}
        style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 0 }}
      />
    );
  },
);

InteractiveGravityMesh.displayName = 'InteractiveGravityMesh';
