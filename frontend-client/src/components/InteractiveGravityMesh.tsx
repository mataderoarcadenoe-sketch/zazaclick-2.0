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

/* ═══════════════════════════════════════════════════════════════════
   ✦  CELESTIAL CONSTELLATION ENGINE v2 — ZAZA CLICK 2.0
   ═══════════════════════════════════════════════════════════════════
   Enhanced with:
   ★  Multi-temperature star colors (warm / neutral / cool)
   ☄  Comets with particle debris trails
   🛰  Extended satellite trail arcs
   ✴  4-pointed cross-flares on gateway stars
   🌌  Parallax depth on background stars
   🌫  Soft aurora gradient wash
   💫  Constellation breathing rhythm
   ═══════════════════════════════════════════════════════════════════ */

interface DeepStar {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  size: number;
  baseAlpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
  colorIdx: number; // 0=white, 1=warm, 2=cool, 3=emerald
  parallaxFactor: number;
}

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
  colorIdx: number;
}

interface ConstellationLine { i: number; j: number; dist: number; }

interface CometParticle {
  active: boolean;
  x: number; y: number;
  vx: number; vy: number;
  alpha: number; decay: number;
  size: number;
  colorIdx: number;
}

interface ShootingStar {
  active: boolean;
  x: number; y: number;
  vx: number; vy: number;
  speed: number; length: number;
  brightness: number;
  life: number; maxLife: number;
  hue: number;
  size: number;
}

interface Satellite {
  parentId: number;
  angle: number;
  speed: number;
  orbitRadius: number;
  size: number;
}

interface DataPulse {
  active: boolean;
  srcIdx: number; tgtIdx: number;
  progress: number; speed: number;
  color: number;
}

interface Ripple {
  active: boolean;
  x: number; y: number;
  radius: number; maxRadius: number;
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
    const deepRef = useRef<DeepStar[]>([]);
    const connsRef = useRef<ConstellationLine[]>([]);
    const cometsRef = useRef<ShootingStar[]>([]);
    const debrisRef = useRef<CometParticle[]>([]);
    const satsRef = useRef<Satellite[]>([]);
    const pulsesRef = useRef<DataPulse[]>([]);
    const ripplesRef = useRef<Ripple[]>([]);
    const mouseRef = useRef({ x: -9999, y: -9999, smoothX: -9999, smoothY: -9999, active: false });

    const fireBurst = (nodeId?: number) => {
      const stars = starsRef.current;
      const conns = connsRef.current;
      const pulses = pulsesRef.current;
      if (!stars.length || !conns.length) return;
      const id = nodeId ?? stars.find(s => s.tier === 'CORE')?.id ?? 0;
      conns.filter(c => c.i === id || c.j === id).forEach(c => {
        const p = pulses.find(pp => !pp.active);
        if (p) { p.active = true; p.srcIdx = c.i === id ? c.i : c.j; p.tgtIdx = c.i === id ? c.j : c.i; p.progress = 0; p.speed = 0.018 + Math.random() * 0.012; p.color = Math.random() > 0.5 ? 0 : 1; }
      });
      const s = stars.find(ss => ss.id === id);
      if (s) s.activity = 1;
    };

    useImperativeHandle(ref, () => ({
      triggerPulse: () => { const c = connsRef.current; if (!c.length) return; const cc = c[Math.floor(Math.random() * c.length)]; const p = pulsesRef.current.find(pp => !pp.active); if (p) { p.active = true; p.srcIdx = cc.i; p.tgtIdx = cc.j; p.progress = 0; p.speed = 0.015 + Math.random() * 0.01; p.color = Math.random() > 0.5 ? 0 : 1; } },
      triggerRipple: (x: number, y: number) => { const r = ripplesRef.current.find(rr => !rr.active); if (r) { r.active = true; r.x = x; r.y = y; r.radius = 0; r.maxRadius = 220; r.alpha = 0.55; } },
      triggerBurst: fireBurst,
      emitEvent: () => fireBurst(),
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) return;

      let raf: number, W = 0, H = 0, dpr = 1, maxDist = 280;

      // Star temperature palette
      const starColors = isDark
        ? [ 'rgba(255, 255, 255, ',        // 0 white
            'rgba(253, 230, 200, ',        // 1 warm (soft amber)
            'rgba(165, 243, 252, ',        // 2 cool (cyan-200)
            'rgba(167, 243, 208, ', ]      // 3 emerald-200
        : [ 'rgba(15, 23, 42, ',
            'rgba(120, 53, 15, ',
            'rgba(14, 116, 144, ',
            'rgba(4, 120, 87, ', ];

      const C = isDark ? {
        linePrimary: 'rgba(52, 211, 153, ',
        lineSecondary: 'rgba(103, 232, 249, ',
        lineFaint: 'rgba(148, 163, 184, ',
        nebulaA: 'rgba(16, 185, 129, ',
        nebulaB: 'rgba(6, 182, 212, ',
        cometHead: '#FFFFFF',
        cometTrails: ['rgba(255, 255, 255, ', 'rgba(103, 232, 249, ', 'rgba(52, 211, 153, '],
        satellite: '#67E8F9',
        satTrail: 'rgba(103, 232, 249, ',
        pulseCyan: '#67E8F9',
        pulseEmerald: '#34D399',
        pulseTrailCyan: 'rgba(103, 232, 249, ',
        pulseTrailEmerald: 'rgba(52, 211, 153, ',
        mouseRing: 'rgba(165, 243, 252, 0.22)',
        mouseLine: 'rgba(103, 232, 249, ',
        ripple: 'rgba(52, 211, 153, ',
        flare: 'rgba(255, 255, 255, ',
        auroraA: 'rgba(16, 185, 129, 0.025)',
        auroraB: 'rgba(6, 182, 212, 0.02)',
      } : {
        linePrimary: 'rgba(16, 185, 129, ',
        lineSecondary: 'rgba(8, 145, 178, ',
        lineFaint: 'rgba(148, 163, 184, ',
        nebulaA: 'rgba(16, 185, 129, ',
        nebulaB: 'rgba(8, 145, 178, ',
        cometHead: '#047857',
        cometTrails: ['rgba(15, 23, 42, ', 'rgba(8, 145, 178, ', 'rgba(16, 185, 129, '],
        satellite: '#0891B2',
        satTrail: 'rgba(8, 145, 178, ',
        pulseCyan: '#0891B2',
        pulseEmerald: '#059669',
        pulseTrailCyan: 'rgba(8, 145, 178, ',
        pulseTrailEmerald: 'rgba(16, 185, 129, ',
        mouseRing: 'rgba(14, 116, 144, 0.16)',
        mouseLine: 'rgba(14, 116, 144, ',
        ripple: 'rgba(16, 185, 129, ',
        flare: 'rgba(15, 23, 42, ',
        auroraA: 'rgba(16, 185, 129, 0.018)',
        auroraB: 'rgba(8, 145, 178, 0.015)',
      };

      const build = () => {
        const mob = W < 640;
        const cols = mob ? 5 : variant === 'minimal' ? 6 : 8;
        const rows = mob ? 6 : variant === 'minimal' ? 4 : 5;
        const cW = W / cols, cH = H / rows;
        maxDist = Math.hypot(cW, cH) * 1.2;

        // Deep-field stars with parallax
        const dCount = mob ? 70 : 140;
        const deep: DeepStar[] = [];
        for (let i = 0; i < dCount; i++) {
          const bx = Math.random() * W, by = Math.random() * H;
          deep.push({
            x: bx, y: by, baseX: bx, baseY: by,
            size: Math.random() < 0.08 ? (Math.random() * 2.0 + 1.8) : (Math.random() * 1.3 + 0.3),
            baseAlpha: Math.random() < 0.08 ? (0.5 + Math.random() * 0.4) : (0.12 + Math.random() * 0.35),
            twinkleSpeed: 0.012 + Math.random() * 0.028,
            twinklePhase: Math.random() * Math.PI * 2,
            colorIdx: Math.random() < 0.5 ? 0 : Math.random() < 0.3 ? 1 : Math.random() < 0.5 ? 2 : 3,
            parallaxFactor: 0.005 + Math.random() * 0.015,
          });
        }
        deepRef.current = deep;

        // Constellation stars
        const stars: ConstellationStar[] = [];
        let id = 0;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const odd = r % 2 === 1 ? cW * 0.5 : 0;
            const bx = c * cW + cW * 0.5 + odd;
            const by = r * cH + cH * 0.5;
            if (bx < 25 || bx > W - 25 || by < 25 || by > H - 25) continue;
            const ax = bx + (Math.random() - 0.5) * cW * 0.55;
            const ay = by + (Math.random() - 0.5) * cH * 0.55;

            let tier: HierarchyTier = 'EDGE';
            let radius = 1.6, brightness = 0.4;
            const isCorePos = (r === 1 && c === 2) || (r === Math.floor(rows / 2) && c === Math.floor(cols / 2)) || (r === rows - 2 && c === cols - 3);
            const isHubPos = ((r + c) % 3 === 0) && !isCorePos;

            if (isCorePos) { tier = 'CORE'; radius = 3.0; brightness = 1.0; }
            else if (isHubPos) { tier = 'HUB'; radius = 2.2; brightness = 0.7; }
            else if (Math.random() < 0.35) { tier = 'RELAY'; radius = 1.8; brightness = 0.55; }

            const colorIdx = tier === 'CORE' ? 3 : tier === 'HUB' ? 2 : Math.random() < 0.4 ? 0 : Math.random() < 0.5 ? 1 : 2;

            stars.push({
              id: id++, anchorX: ax, anchorY: ay, x: ax, y: ay, vx: 0, vy: 0,
              tier, radius, brightness, phase: Math.random() * Math.PI * 2,
              driftRadius: 6 + Math.random() * 10,
              driftSpeedX: (0.002 + Math.random() * 0.003) * (Math.random() > 0.5 ? 1 : -1),
              driftSpeedY: (0.002 + Math.random() * 0.003) * (Math.random() > 0.5 ? 1 : -1),
              depth: 0.6 + Math.random() * 0.4,
              activity: 0, colorIdx,
            });
          }
        }
        starsRef.current = stars;

        // Satellites
        const sats: Satellite[] = [];
        stars.forEach(s => {
          if (s.tier === 'CORE') {
            sats.push({ parentId: s.id, angle: Math.random() * Math.PI * 2, speed: 0.012 + Math.random() * 0.008, orbitRadius: 18 + Math.random() * 8, size: 1.6 });
            sats.push({ parentId: s.id, angle: Math.random() * Math.PI * 2, speed: -(0.008 + Math.random() * 0.006), orbitRadius: 30 + Math.random() * 6, size: 1.2 });
          } else if (s.tier === 'HUB') {
            sats.push({ parentId: s.id, angle: Math.random() * Math.PI * 2, speed: 0.015 + Math.random() * 0.008, orbitRadius: 14 + Math.random() * 6, size: 1.3 });
          }
        });
        satsRef.current = sats;

        // Pools
        const comets: ShootingStar[] = [];
        for (let i = 0; i < 4; i++) comets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, speed: 0, length: 0, brightness: 0, life: 0, maxLife: 0, hue: 0, size: 2 });
        cometsRef.current = comets;

        const debris: CometParticle[] = [];
        for (let i = 0; i < 80; i++) debris.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, alpha: 0, decay: 0, size: 0, colorIdx: 0 });
        debrisRef.current = debris;

        const pulses: DataPulse[] = [];
        for (let i = 0; i < 8; i++) pulses.push({ active: false, srcIdx: 0, tgtIdx: 0, progress: 0, speed: 0.015, color: 0 });
        pulsesRef.current = pulses;

        const ripples: Ripple[] = [];
        for (let i = 0; i < 4; i++) ripples.push({ active: false, x: 0, y: 0, radius: 0, maxRadius: 220, alpha: 0 });
        ripplesRef.current = ripples;
      };

      const resize = () => {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = window.innerWidth; H = window.innerHeight;
        canvas.width = Math.floor(W * dpr);
        canvas.height = Math.floor(H * dpr);
        build();
      };
      resize();

      const onMove = (e: MouseEvent) => { if (enableMouseInteraction) { mouseRef.current.x = e.clientX; mouseRef.current.y = e.clientY; mouseRef.current.active = true; } };
      const onLeave = () => { mouseRef.current.active = false; mouseRef.current.x = -9999; };
      const onClick = (e: MouseEvent) => {
        for (const s of starsRef.current) { if (Math.hypot(e.clientX - s.x, e.clientY - s.y) < 28) { fireBurst(s.id); return; } }
        if (enableRipples) { const r = ripplesRef.current.find(rr => !rr.active); if (r) { r.active = true; r.x = e.clientX; r.y = e.clientY; r.radius = 0; r.maxRadius = 220; r.alpha = 0.55; } }
      };

      window.addEventListener('resize', resize);
      window.addEventListener('mousemove', onMove, { passive: true });
      window.addEventListener('mouseleave', onLeave);
      window.addEventListener('click', onClick, { passive: true });

      let t = 0;
      let cometTimer = 150 + Math.random() * 200;

      const frame = () => {
        t += 1;
        const stars = starsRef.current;
        const N = stars.length;
        const mouse = mouseRef.current;

        // Smooth mouse
        mouse.smoothX += (mouse.x - mouse.smoothX) * 0.08;
        mouse.smoothY += (mouse.y - mouse.smoothY) * 0.08;

        // Constellation breathing
        const breathe = 0.92 + 0.08 * Math.sin(t * 0.008);

        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, W, H);

        /* ═══ LAYER 0: AURORA GRADIENT WASH ═══ */
        const auroraCx = W * 0.5 + Math.sin(t * 0.003) * W * 0.2;
        const auroraCy = H * 0.3 + Math.cos(t * 0.004) * H * 0.15;
        const auroraGrad = ctx.createRadialGradient(auroraCx, auroraCy, 50, auroraCx, auroraCy, W * 0.6);
        auroraGrad.addColorStop(0, C.auroraA);
        auroraGrad.addColorStop(0.5, C.auroraB);
        auroraGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = auroraGrad;
        ctx.fillRect(0, 0, W, H);

        /* ═══ LAYER 1: DEEP-FIELD STARS (parallax + twinkling) ═══ */
        const deep = deepRef.current;
        const mNormX = mouse.active ? (mouse.smoothX / W - 0.5) : 0;
        const mNormY = mouse.active ? (mouse.smoothY / H - 0.5) : 0;

        for (const d of deep) {
          d.twinklePhase += d.twinkleSpeed;
          const alpha = d.baseAlpha * (0.45 + 0.55 * Math.sin(d.twinklePhase)) * breathe;

          // Parallax: deeper stars move slightly opposite to mouse
          d.x = d.baseX - mNormX * d.parallaxFactor * W;
          d.y = d.baseY - mNormY * d.parallaxFactor * H;

          ctx.beginPath();
          ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
          ctx.fillStyle = `${starColors[d.colorIdx]}${alpha.toFixed(3)})`;
          if (d.size > 2.0) {
            ctx.shadowColor = `${starColors[d.colorIdx]}0.4)`;
            ctx.shadowBlur = 4;
          }
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        /* ═══ LAYER 2: STAR PHYSICS ═══ */
        for (let i = 0; i < N; i++) {
          const s = stars[i];
          const tx = s.anchorX + Math.cos(t * s.driftSpeedX + s.phase) * s.driftRadius;
          const ty = s.anchorY + Math.sin(t * s.driftSpeedY + s.phase * 1.3) * s.driftRadius;
          s.vx += (tx - s.x) * 0.02;
          s.vy += (ty - s.y) * 0.02;

          for (let j = i + 1; j < N; j++) {
            const o = stars[j];
            const dx = s.x - o.x, dy = s.y - o.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < 2500 && d2 > 0.01) {
              const d = Math.sqrt(d2), f = (1 - d / 50) * 0.35;
              s.vx += (dx / d) * f; s.vy += (dy / d) * f;
              o.vx -= (dx / d) * f; o.vy -= (dy / d) * f;
            }
          }

          if (mouse.active) {
            const dx = mouse.smoothX - s.x, dy = mouse.smoothY - s.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < 200 && d > 1) { const pull = (1 - d / 200) * 0.6; s.vx += (dx / d) * pull * 0.12; s.vy += (dy / d) * pull * 0.12; s.activity = Math.max(s.activity, pull * 0.6); }
          }

          for (const rp of ripplesRef.current) {
            if (!rp.active) continue;
            const dx = s.x - rp.x, dy = s.y - rp.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            const band = Math.abs(d - rp.radius);
            if (band < 30) { const f = (1 - band / 30) * rp.alpha * 1.2; s.vx += (dx / Math.max(d, 1)) * f * 0.15; s.vy += (dy / Math.max(d, 1)) * f * 0.15; s.activity = Math.max(s.activity, rp.alpha * 0.4); }
          }

          s.vx *= 0.93; s.vy *= 0.93;
          s.x += s.vx; s.y += s.vy;
          if (s.activity > 0) s.activity = Math.max(0, s.activity - 0.006);
        }

        /* ═══ LAYER 3: CONSTELLATION LINES ═══ */
        const conns: ConstellationLine[] = [];
        const maxPerNode = 3, counts = new Uint8Array(N), maxD2 = maxDist * maxDist;
        for (let i = 0; i < N; i++) {
          if (counts[i] >= maxPerNode) continue;
          for (let j = i + 1; j < N; j++) {
            if (counts[j] >= maxPerNode) continue;
            const dx = stars[i].x - stars[j].x, dy = stars[i].y - stars[j].y;
            const d2 = dx * dx + dy * dy;
            if (d2 < maxD2 && d2 > 900) {
              conns.push({ i, j, dist: Math.sqrt(d2) }); counts[i]++; counts[j]++;
              if (counts[i] >= maxPerNode) break;
            }
          }
        }
        connsRef.current = conns;

        for (const c of conns) {
          const a = stars[c.i], b = stars[c.j];
          const ratio = 1 - c.dist / maxDist;
          const boost = Math.max(a.activity, b.activity);
          const isTrunk = (a.tier === 'CORE' || a.tier === 'HUB') && (b.tier === 'CORE' || b.tier === 'HUB');
          const baseAlpha = (ratio * (isTrunk ? 0.30 : 0.15) + boost * 0.20) * breathe;
          const lineColor = isTrunk ? C.linePrimary : (a.tier !== 'EDGE' || b.tier !== 'EDGE') ? C.lineSecondary : C.lineFaint;

          ctx.beginPath();
          ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `${lineColor}${Math.min(0.42, baseAlpha).toFixed(3)})`;
          ctx.lineWidth = isTrunk ? 0.9 : 0.5;
          ctx.stroke();
        }

        /* ═══ LAYER 4: MOUSE INTERACTION ═══ */
        if (mouse.active && enableMouseInteraction) {
          ctx.beginPath();
          ctx.arc(mouse.smoothX, mouse.smoothY, 16 + Math.sin(t * 0.05) * 2, 0, Math.PI * 2);
          ctx.strokeStyle = C.mouseRing;
          ctx.lineWidth = 0.7;
          ctx.stroke();

          for (const s of stars) {
            const d = Math.hypot(mouse.smoothX - s.x, mouse.smoothY - s.y);
            if (d < 180) {
              ctx.beginPath();
              ctx.moveTo(mouse.smoothX, mouse.smoothY); ctx.lineTo(s.x, s.y);
              ctx.strokeStyle = `${C.mouseLine}${((1 - d / 180) * 0.18).toFixed(3)})`;
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          }
        }

        /* ═══ LAYER 5: NEBULA GLOW ═══ */
        for (const s of stars) {
          if (s.tier !== 'CORE') continue;
          const nr = 55 + Math.sin(t * 0.018 + s.phase) * 14 + s.activity * 28;
          const grad = ctx.createRadialGradient(s.x, s.y, 2, s.x, s.y, nr);
          grad.addColorStop(0, `${C.nebulaA}${(0.11 + s.activity * 0.09).toFixed(3)})`);
          grad.addColorStop(0.5, `${C.nebulaB}${(0.045 + s.activity * 0.04).toFixed(3)})`);
          grad.addColorStop(1, `${C.nebulaA}0)`);
          ctx.beginPath(); ctx.arc(s.x, s.y, nr, 0, Math.PI * 2);
          ctx.fillStyle = grad; ctx.fill();
        }

        /* ═══ LAYER 6: DATA PULSES ═══ */
        if (enablePulses && conns.length > 0) {
          for (const p of pulsesRef.current) {
            if (!p.active) { if (Math.random() > 0.004) continue; const c = conns[Math.floor(Math.random() * conns.length)]; p.active = true; p.srcIdx = c.i; p.tgtIdx = c.j; p.progress = 0; p.speed = 0.010 + Math.random() * 0.008; p.color = Math.random() > 0.5 ? 0 : 1; }
            p.progress += p.speed;
            if (p.progress >= 1) { p.active = false; const tn = stars[p.tgtIdx]; if (tn) tn.activity = Math.min(1, tn.activity + 0.4); continue; }
            const s = stars[p.srcIdx], e = stars[p.tgtIdx]; if (!s || !e) continue;
            const tt = p.progress, u = 1 - tt;
            const hx = u * s.x + tt * e.x, hy = u * s.y + tt * e.y;
            const tt2 = Math.max(0, tt - 0.22), u2 = 1 - tt2;
            const tx = u2 * s.x + tt2 * e.x, ty = u2 * s.y + tt2 * e.y;
            const vis = Math.sin(p.progress * Math.PI);
            const trailC = p.color === 0 ? C.pulseTrailCyan : C.pulseTrailEmerald;
            const headC = p.color === 0 ? C.pulseCyan : C.pulseEmerald;
            const grad = ctx.createLinearGradient(tx, ty, hx, hy);
            grad.addColorStop(0, `${trailC}0)`); grad.addColorStop(1, `${trailC}${(vis * 0.65).toFixed(3)})`);
            ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy);
            ctx.strokeStyle = grad; ctx.lineWidth = 1.8; ctx.stroke();
            ctx.beginPath(); ctx.arc(hx, hy, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = headC; ctx.shadowColor = headC; ctx.shadowBlur = 10;
            ctx.globalAlpha = vis; ctx.fill(); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
          }
        }

        /* ═══ LAYER 7: SHOOTING STARS / COMETS + DEBRIS ═══ */
        cometTimer--;
        if (cometTimer <= 0) {
          const comet = cometsRef.current.find(c => !c.active);
          if (comet) {
            const fromLeft = Math.random() > 0.5;
            const angle = (Math.random() * 0.5 + 0.15) * (fromLeft ? 1 : -1);
            comet.active = true;
            comet.x = fromLeft ? -20 : W + 20;
            comet.y = Math.random() * H * 0.65;
            comet.speed = 5 + Math.random() * 6;
            comet.vx = Math.cos(angle) * comet.speed * (fromLeft ? 1 : -1);
            comet.vy = Math.sin(Math.abs(angle)) * comet.speed;
            comet.length = 70 + Math.random() * 100;
            comet.brightness = 0.75 + Math.random() * 0.25;
            comet.life = 0; comet.maxLife = 80 + Math.random() * 60;
            comet.hue = Math.floor(Math.random() * 3);
            comet.size = 1.8 + Math.random() * 1.5;
          }
          cometTimer = 250 + Math.random() * 400;
        }

        const debris = debrisRef.current;

        for (const comet of cometsRef.current) {
          if (!comet.active) continue;
          comet.x += comet.vx; comet.y += comet.vy;
          comet.life++;
          if (comet.life > comet.maxLife || comet.x < -120 || comet.x > W + 120 || comet.y > H + 60) { comet.active = false; continue; }

          const fadeIn = Math.min(1, comet.life / 10);
          const fadeOut = Math.max(0, 1 - Math.max(0, comet.life - comet.maxLife + 20) / 20);
          const alpha = comet.brightness * fadeIn * fadeOut;

          // Emit debris particles
          if (comet.life % 2 === 0) {
            const dp = debris.find(d => !d.active);
            if (dp) {
              dp.active = true;
              dp.x = comet.x + (Math.random() - 0.5) * 4;
              dp.y = comet.y + (Math.random() - 0.5) * 4;
              dp.vx = -comet.vx * 0.02 + (Math.random() - 0.5) * 0.6;
              dp.vy = -comet.vy * 0.02 + (Math.random() - 0.5) * 0.6 + 0.2;
              dp.alpha = 0.6 + Math.random() * 0.3;
              dp.decay = 0.012 + Math.random() * 0.015;
              dp.size = 0.6 + Math.random() * 1.0;
              dp.colorIdx = comet.hue;
            }
          }

          const mag = Math.sqrt(comet.vx * comet.vx + comet.vy * comet.vy);
          const dx = -comet.vx / mag, dy = -comet.vy / mag;
          const tailX = comet.x + dx * comet.length, tailY = comet.y + dy * comet.length;
          const trailC = C.cometTrails[comet.hue];

          const grad = ctx.createLinearGradient(tailX, tailY, comet.x, comet.y);
          grad.addColorStop(0, `${trailC}0)`);
          grad.addColorStop(0.5, `${trailC}${(alpha * 0.30).toFixed(3)})`);
          grad.addColorStop(1, `${trailC}${(alpha * 0.85).toFixed(3)})`);
          ctx.beginPath(); ctx.moveTo(tailX, tailY); ctx.lineTo(comet.x, comet.y);
          ctx.strokeStyle = grad; ctx.lineWidth = 2.2; ctx.stroke();

          ctx.beginPath(); ctx.arc(comet.x, comet.y, comet.size, 0, Math.PI * 2);
          ctx.fillStyle = C.cometHead;
          ctx.shadowColor = C.cometHead; ctx.shadowBlur = 14;
          ctx.globalAlpha = alpha; ctx.fill();
          ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        }

        // Draw debris particles
        for (const dp of debris) {
          if (!dp.active) continue;
          dp.x += dp.vx; dp.y += dp.vy;
          dp.vy += 0.01; // gravity
          dp.alpha -= dp.decay;
          if (dp.alpha <= 0) { dp.active = false; continue; }
          ctx.beginPath(); ctx.arc(dp.x, dp.y, dp.size, 0, Math.PI * 2);
          ctx.fillStyle = `${starColors[dp.colorIdx === 0 ? 0 : dp.colorIdx === 1 ? 2 : 3]}${dp.alpha.toFixed(3)})`;
          ctx.fill();
        }

        /* ═══ LAYER 8: ORBITING SATELLITES ═══ */
        for (const sat of satsRef.current) {
          sat.angle += sat.speed;
          const parent = stars.find(s => s.id === sat.parentId);
          if (!parent) continue;
          const sx = parent.x + Math.cos(sat.angle) * sat.orbitRadius;
          const sy = parent.y + Math.sin(sat.angle) * sat.orbitRadius;

          // Faint orbit ring
          ctx.beginPath(); ctx.arc(parent.x, parent.y, sat.orbitRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `${C.satTrail}0.06)`; ctx.lineWidth = 0.4; ctx.stroke();

          // Extended trail arc
          const arcLen = Math.abs(sat.speed) * 14;
          const arcStart = sat.angle - (sat.speed > 0 ? arcLen : 0);
          const arcEnd = sat.angle + (sat.speed > 0 ? 0 : arcLen);
          ctx.beginPath(); ctx.arc(parent.x, parent.y, sat.orbitRadius, arcStart, arcEnd);
          ctx.strokeStyle = `${C.satTrail}0.22)`; ctx.lineWidth = 0.9; ctx.stroke();

          // Satellite body
          ctx.beginPath(); ctx.arc(sx, sy, sat.size, 0, Math.PI * 2);
          ctx.fillStyle = C.satellite;
          ctx.shadowColor = C.satellite; ctx.shadowBlur = 7;
          ctx.fill(); ctx.shadowBlur = 0;
        }

        /* ═══ LAYER 9: RIPPLES ═══ */
        for (const r of ripplesRef.current) {
          if (!r.active) continue;
          r.radius += 2.5; r.alpha *= 0.975;
          if (r.radius > r.maxRadius || r.alpha < 0.01) { r.active = false; continue; }
          ctx.beginPath(); ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
          ctx.strokeStyle = `${C.ripple}${(r.alpha * 0.35).toFixed(3)})`; ctx.lineWidth = 1.0; ctx.stroke();
        }

        /* ═══ LAYER 10: CONSTELLATION STARS ═══ */
        for (const s of stars) {
          const pulse = 0.85 + 0.15 * Math.sin(t * 0.04 + s.phase);
          const alpha = (s.brightness * pulse * s.depth + s.activity * 0.3) * breathe;

          // 4-pointed cross-flare for CORE
          if (s.tier === 'CORE') {
            const fLen = 10 + Math.sin(t * 0.025 + s.phase) * 4 + s.activity * 8;
            const fAlpha = (0.22 + s.activity * 0.18) * s.depth;
            ctx.strokeStyle = `${C.flare}${fAlpha.toFixed(3)})`;
            ctx.lineWidth = 0.5;
            // Horizontal
            ctx.beginPath(); ctx.moveTo(s.x - fLen, s.y); ctx.lineTo(s.x + fLen, s.y); ctx.stroke();
            // Vertical
            ctx.beginPath(); ctx.moveTo(s.x, s.y - fLen); ctx.lineTo(s.x, s.y + fLen); ctx.stroke();
            // Diagonals (shorter)
            const dLen = fLen * 0.55;
            ctx.lineWidth = 0.35;
            ctx.beginPath(); ctx.moveTo(s.x - dLen, s.y - dLen); ctx.lineTo(s.x + dLen, s.y + dLen); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(s.x + dLen, s.y - dLen); ctx.lineTo(s.x - dLen, s.y + dLen); ctx.stroke();
          }

          // Halo rings
          if (s.tier === 'CORE') {
            const hr = s.radius + 5.5 + Math.sin(t * 0.025 + s.phase) * 2;
            ctx.beginPath(); ctx.arc(s.x, s.y, hr, 0, Math.PI * 2);
            ctx.strokeStyle = `${starColors[3]}${(0.16 + s.activity * 0.16).toFixed(3)})`; ctx.lineWidth = 0.6; ctx.stroke();
          }
          if (s.tier === 'HUB') {
            const hr = s.radius + 3.8 + Math.sin(t * 0.03 + s.phase) * 1.5;
            ctx.beginPath(); ctx.arc(s.x, s.y, hr, 0, Math.PI * 2);
            ctx.strokeStyle = `${starColors[2]}${(0.11 + s.activity * 0.13).toFixed(3)})`; ctx.lineWidth = 0.5; ctx.stroke();
          }

          // Star body
          const r = s.radius + s.activity * 1.0;
          const color = starColors[s.colorIdx];
          const dotAlpha = s.tier === 'CORE' ? 0.80 + s.activity * 0.20 : s.tier === 'HUB' ? 0.60 + s.activity * 0.25 : 0.35 + s.activity * 0.20;

          ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
          ctx.fillStyle = `${color}${(dotAlpha * alpha / (s.brightness || 1)).toFixed(3)})`;
          if (s.tier === 'CORE' || s.tier === 'HUB') { ctx.shadowColor = `${color}0.5)`; ctx.shadowBlur = s.tier === 'CORE' ? 12 : 7; }
          ctx.fill(); ctx.shadowBlur = 0;

          // Bright inner core
          if (s.tier === 'CORE') {
            ctx.beginPath(); ctx.arc(s.x, s.y, 1.3, 0, Math.PI * 2);
            ctx.fillStyle = `${starColors[0]}${(0.92 * s.depth).toFixed(3)})`; ctx.fill();
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
      <canvas ref={canvasRef} className={className}
        style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 0 }}
      />
    );
  },
);

InteractiveGravityMesh.displayName = 'InteractiveGravityMesh';
