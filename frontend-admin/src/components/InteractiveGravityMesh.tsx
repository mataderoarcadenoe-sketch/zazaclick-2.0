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

/* ───────────────────────────────────────────────────────────
   MINIMAL PREMIUM MESH — Inspired by Stripe / Linear / Vercel
   ─────────────────────────────────────────────────────────── */

interface MeshNode {
  id: number;
  anchorX: number;
  anchorY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  tier: HierarchyTier;
  phase: number;
  driftRadius: number;
  driftSpeedX: number;
  driftSpeedY: number;
  depth: number; // parallax-like layering 0.5–1.0
  activity: number;
}

interface MeshConnection {
  i: number;
  j: number;
  dist: number;
}

interface DataPulse {
  active: boolean;
  srcIdx: number;
  tgtIdx: number;
  progress: number;
  speed: number;
  ctrlOffsetX: number;
  ctrlOffsetY: number;
}

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

    const nodesRef = useRef<MeshNode[]>([]);
    const connectionsRef = useRef<MeshConnection[]>([]);
    const pulsesRef = useRef<DataPulse[]>([]);
    const ripplesRef = useRef<Ripple[]>([]);
    const mouseRef = useRef({ x: -9999, y: -9999, active: false });

    /* ── Imperative API ── */
    const fireBurst = (nodeId?: number) => {
      const nodes = nodesRef.current;
      const conns = connectionsRef.current;
      const pulses = pulsesRef.current;
      if (!nodes.length || !conns.length) return;
      const id = nodeId ?? nodes.find(n => n.tier === 'CORE')?.id ?? 0;
      conns
        .filter(c => c.i === id || c.j === id)
        .forEach(c => {
          const p = pulses.find(pp => !pp.active);
          if (p) {
            p.active = true;
            p.srcIdx = c.i === id ? c.i : c.j;
            p.tgtIdx = c.i === id ? c.j : c.i;
            p.progress = 0;
            p.speed = 0.025 + Math.random() * 0.015;
            p.ctrlOffsetX = (Math.random() - 0.5) * 30;
            p.ctrlOffsetY = (Math.random() - 0.5) * 30;
          }
        });
      const n = nodes.find(nn => nn.id === id);
      if (n) n.activity = 1;
    };

    useImperativeHandle(ref, () => ({
      triggerPulse: () => {
        const conns = connectionsRef.current;
        if (!conns.length) return;
        const c = conns[Math.floor(Math.random() * conns.length)];
        const p = pulsesRef.current.find(pp => !pp.active);
        if (p) {
          p.active = true;
          p.srcIdx = c.i;
          p.tgtIdx = c.j;
          p.progress = 0;
          p.speed = 0.02 + Math.random() * 0.012;
          p.ctrlOffsetX = (Math.random() - 0.5) * 30;
          p.ctrlOffsetY = (Math.random() - 0.5) * 30;
        }
      },
      triggerRipple: (x: number, y: number) => {
        const r = ripplesRef.current.find(rr => !rr.active);
        if (r) {
          r.active = true; r.x = x; r.y = y; r.radius = 0; r.maxRadius = 200; r.alpha = 0.6;
        }
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
      let W = 0;
      let H = 0;
      let dpr = 1;
      let maxDist = 260;

      /* ── Palette ── */
      const dark = {
        nodePrimary: 'rgba(52, 211, 153, ',     // emerald-400
        nodeSecondary: 'rgba(6, 182, 212, ',     // cyan-500
        nodeEdge: 'rgba(148, 163, 184, ',        // slate-400
        line: 'rgba(52, 211, 153, ',
        lineFaint: 'rgba(148, 163, 184, ',
        pulse: '#67E8F9',
        pulseTrail: 'rgba(103, 232, 249, ',
        ripple: 'rgba(52, 211, 153, ',
        mouseLine: 'rgba(103, 232, 249, ',
        mouseRing: 'rgba(103, 232, 249, 0.3)',
      };
      const light = {
        nodePrimary: 'rgba(16, 185, 129, ',      // emerald-500
        nodeSecondary: 'rgba(14, 116, 144, ',     // cyan-700
        nodeEdge: 'rgba(148, 163, 184, ',         // slate-400
        line: 'rgba(16, 185, 129, ',
        lineFaint: 'rgba(148, 163, 184, ',
        pulse: '#0891B2',
        pulseTrail: 'rgba(8, 145, 178, ',
        ripple: 'rgba(16, 185, 129, ',
        mouseLine: 'rgba(14, 116, 144, ',
        mouseRing: 'rgba(14, 116, 144, 0.2)',
      };
      const pal = isDark ? dark : light;

      /* ── Topology ── */
      const build = () => {
        const isMobile = W < 640;
        const cols = isMobile ? 5 : variant === 'minimal' ? 6 : 9;
        const rows = isMobile ? 6 : variant === 'minimal' ? 4 : 6;
        const cellW = W / cols;
        const cellH = H / rows;
        maxDist = Math.hypot(cellW, cellH) * 1.15;

        const nodes: MeshNode[] = [];
        let id = 0;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const odd = r % 2 === 1 ? cellW * 0.5 : 0;
            const bx = c * cellW + cellW * 0.5 + odd;
            const by = r * cellH + cellH * 0.5;
            if (bx < 15 || bx > W - 15 || by < 15 || by > H - 15) continue;
            const jx = (Math.random() - 0.5) * cellW * 0.55;
            const jy = (Math.random() - 0.5) * cellH * 0.55;
            const ax = bx + jx;
            const ay = by + jy;

            let tier: HierarchyTier = 'EDGE';
            let radius = 1.8;
            const isCorePos =
              (r === Math.floor(rows * 0.3) && c === Math.floor(cols * 0.3)) ||
              (r === Math.floor(rows * 0.5) && c === Math.floor(cols * 0.5)) ||
              (r === Math.floor(rows * 0.7) && c === Math.floor(cols * 0.7));
            const isHubPos = (r + c) % 3 === 0 && !isCorePos;

            if (isCorePos) { tier = 'CORE'; radius = 3.2; }
            else if (isHubPos) { tier = 'HUB'; radius = 2.4; }
            else if (Math.random() < 0.3) { tier = 'RELAY'; radius = 2.0; }

            nodes.push({
              id: id++, anchorX: ax, anchorY: ay,
              x: ax, y: ay, vx: 0, vy: 0,
              radius: isDark ? radius : radius * 0.9,
              tier, phase: Math.random() * Math.PI * 2,
              driftRadius: 8 + Math.random() * 12,
              driftSpeedX: (0.003 + Math.random() * 0.004) * (Math.random() > 0.5 ? 1 : -1),
              driftSpeedY: (0.003 + Math.random() * 0.004) * (Math.random() > 0.5 ? 1 : -1),
              depth: 0.55 + Math.random() * 0.45,
              activity: 0,
            });
          }
        }
        nodesRef.current = nodes;

        const pulses: DataPulse[] = [];
        const pCount = variant === 'minimal' ? 3 : isMobile ? 4 : 6;
        for (let i = 0; i < pCount; i++) {
          pulses.push({ active: false, srcIdx: 0, tgtIdx: 0, progress: 0, speed: 0.02, ctrlOffsetX: 0, ctrlOffsetY: 0 });
        }
        pulsesRef.current = pulses;

        const ripples: Ripple[] = [];
        for (let i = 0; i < 4; i++) ripples.push({ active: false, x: 0, y: 0, radius: 0, maxRadius: 200, alpha: 0 });
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

      /* ── Input ── */
      const onMove = (e: MouseEvent) => {
        if (!enableMouseInteraction) return;
        mouseRef.current.x = e.clientX;
        mouseRef.current.y = e.clientY;
        mouseRef.current.active = true;
      };
      const onLeave = () => { mouseRef.current.active = false; mouseRef.current.x = -9999; };
      const onClick = (e: MouseEvent) => {
        const nodes = nodesRef.current;
        for (const n of nodes) {
          if (Math.hypot(e.clientX - n.x, e.clientY - n.y) < 30) {
            fireBurst(n.id);
            return;
          }
        }
        if (enableRipples) {
          const r = ripplesRef.current.find(rr => !rr.active);
          if (r) { r.active = true; r.x = e.clientX; r.y = e.clientY; r.radius = 0; r.maxRadius = 200; r.alpha = 0.5; }
        }
      };

      window.addEventListener('resize', resize);
      window.addEventListener('mousemove', onMove, { passive: true });
      window.addEventListener('mouseleave', onLeave);
      window.addEventListener('click', onClick, { passive: true });

      let t = 0;

      const frame = () => {
        t += 1;
        const nodes = nodesRef.current;
        const N = nodes.length;
        const mouse = mouseRef.current;

        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, W, H);

        /* ── 1. Physics: gentle Lissajous drift + soft repulsion ── */
        for (let i = 0; i < N; i++) {
          const n = nodes[i];
          const tx = n.anchorX + Math.cos(t * n.driftSpeedX + n.phase) * n.driftRadius;
          const ty = n.anchorY + Math.sin(t * n.driftSpeedY + n.phase * 1.3) * n.driftRadius;
          n.vx += (tx - n.x) * 0.025;
          n.vy += (ty - n.y) * 0.025;

          // soft repulsion
          for (let j = i + 1; j < N; j++) {
            const o = nodes[j];
            const dx = n.x - o.x;
            const dy = n.y - o.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < 2500 && d2 > 0.01) {
              const d = Math.sqrt(d2);
              const f = (1 - d / 50) * 0.4;
              const ux = dx / d * f;
              const uy = dy / d * f;
              n.vx += ux; n.vy += uy;
              o.vx -= ux; o.vy -= uy;
            }
          }

          // mouse attraction
          if (mouse.active && enableMouseInteraction) {
            const dx = mouse.x - n.x;
            const dy = mouse.y - n.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < 200 && d > 1) {
              const pull = (1 - d / 200) * 0.8;
              n.vx += (dx / d) * pull * 0.15;
              n.vy += (dy / d) * pull * 0.15;
              n.activity = Math.max(n.activity, pull * 0.4);
            }
          }

          // ripple influence
          for (const rp of ripplesRef.current) {
            if (!rp.active) continue;
            const dx = n.x - rp.x;
            const dy = n.y - rp.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            const band = Math.abs(d - rp.radius);
            if (band < 25) {
              const f = (1 - band / 25) * rp.alpha * 1.5;
              n.vx += (dx / Math.max(d, 1)) * f * 0.2;
              n.vy += (dy / Math.max(d, 1)) * f * 0.2;
              n.activity = Math.max(n.activity, rp.alpha * 0.5);
            }
          }

          n.vx *= 0.92;
          n.vy *= 0.92;
          n.x += n.vx;
          n.y += n.vy;
          if (n.activity > 0) n.activity = Math.max(0, n.activity - 0.008);
        }

        /* ── 2. Connections: build fresh each frame ── */
        const conns: MeshConnection[] = [];
        const maxPerNode = 3;
        const counts = new Uint8Array(N);
        const maxD2 = maxDist * maxDist;

        for (let i = 0; i < N; i++) {
          if (counts[i] >= maxPerNode) continue;
          for (let j = i + 1; j < N; j++) {
            if (counts[j] >= maxPerNode) continue;
            const dx = nodes[i].x - nodes[j].x;
            const dy = nodes[i].y - nodes[j].y;
            const d2 = dx * dx + dy * dy;
            if (d2 < maxD2 && d2 > 900) {
              conns.push({ i, j, dist: Math.sqrt(d2) });
              counts[i]++;
              counts[j]++;
              if (counts[i] >= maxPerNode) break;
            }
          }
        }
        connectionsRef.current = conns;

        /* ── 3. Draw connections: ultra-thin elegant lines ── */
        for (const c of conns) {
          const a = nodes[c.i];
          const b = nodes[c.j];
          const ratio = 1 - c.dist / maxDist;
          const boost = Math.max(a.activity, b.activity);

          // base opacity: very subtle
          const baseAlpha = ratio * (isDark ? 0.12 : 0.10) + boost * 0.15;
          const isTrunk = (a.tier === 'CORE' || a.tier === 'HUB') && (b.tier === 'CORE' || b.tier === 'HUB');

          if (isTrunk) {
            ctx.strokeStyle = `${pal.line}${Math.min(0.35, baseAlpha + 0.08).toFixed(3)})`;
            ctx.lineWidth = 0.8;
          } else {
            ctx.strokeStyle = `${pal.lineFaint}${Math.min(0.25, baseAlpha).toFixed(3)})`;
            ctx.lineWidth = 0.5;
          }

          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }

        /* ── 4. Mouse interaction lines ── */
        if (mouse.active && enableMouseInteraction) {
          // soft ring
          ctx.beginPath();
          ctx.arc(mouse.x, mouse.y, 14 + Math.sin(t * 0.06) * 2, 0, Math.PI * 2);
          ctx.strokeStyle = pal.mouseRing;
          ctx.lineWidth = 0.8;
          ctx.stroke();

          for (let i = 0; i < N; i++) {
            const n = nodes[i];
            const d = Math.hypot(mouse.x - n.x, mouse.y - n.y);
            if (d < 160) {
              const a = (1 - d / 160) * (isDark ? 0.20 : 0.14);
              ctx.beginPath();
              ctx.moveTo(mouse.x, mouse.y);
              ctx.lineTo(n.x, n.y);
              ctx.strokeStyle = `${pal.mouseLine}${a.toFixed(3)})`;
              ctx.lineWidth = 0.6;
              ctx.stroke();
            }
          }
        }

        /* ── 5. Data pulses: elegant traveling dots ── */
        if (enablePulses && conns.length > 0) {
          const pulses = pulsesRef.current;
          for (const p of pulses) {
            if (!p.active) {
              // spawn with delay — only ~40% chance per frame to avoid constant streams
              if (Math.random() > 0.005) continue;
              const c = conns[Math.floor(Math.random() * conns.length)];
              p.active = true;
              p.srcIdx = c.i;
              p.tgtIdx = c.j;
              p.progress = 0;
              p.speed = 0.008 + Math.random() * 0.008;
              p.ctrlOffsetX = (Math.random() - 0.5) * 20;
              p.ctrlOffsetY = (Math.random() - 0.5) * 20;
            }

            p.progress += p.speed;
            if (p.progress >= 1) {
              p.active = false;
              const tn = nodes[p.tgtIdx];
              if (tn) tn.activity = Math.min(1, tn.activity + 0.5);
              continue;
            }

            const s = nodes[p.srcIdx];
            const e = nodes[p.tgtIdx];
            if (!s || !e) continue;

            const mx = (s.x + e.x) * 0.5 + p.ctrlOffsetX;
            const my = (s.y + e.y) * 0.5 + p.ctrlOffsetY;
            const tt = p.progress;
            const u = 1 - tt;

            const hx = u * u * s.x + 2 * u * tt * mx + tt * tt * e.x;
            const hy = u * u * s.y + 2 * u * tt * my + tt * tt * e.y;

            // trail
            const tt2 = Math.max(0, tt - 0.15);
            const u2 = 1 - tt2;
            const tx = u2 * u2 * s.x + 2 * u2 * tt2 * mx + tt2 * tt2 * e.x;
            const ty = u2 * u2 * s.y + 2 * u2 * tt2 * my + tt2 * tt2 * e.y;

            const vis = Math.sin(p.progress * Math.PI);

            const grad = ctx.createLinearGradient(tx, ty, hx, hy);
            grad.addColorStop(0, `${pal.pulseTrail}0)`);
            grad.addColorStop(1, `${pal.pulseTrail}${(vis * 0.7).toFixed(3)})`);
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(hx, hy);
            ctx.strokeStyle = grad;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // head dot
            ctx.beginPath();
            ctx.arc(hx, hy, 2.2, 0, Math.PI * 2);
            ctx.fillStyle = pal.pulse;
            ctx.shadowColor = pal.pulse;
            ctx.shadowBlur = isDark ? 8 : 4;
            ctx.globalAlpha = vis;
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
          }
        }

        /* ── 6. Ripples ── */
        if (enableRipples) {
          for (const r of ripplesRef.current) {
            if (!r.active) continue;
            r.radius += 3;
            r.alpha *= 0.97;
            if (r.radius > r.maxRadius || r.alpha < 0.01) { r.active = false; continue; }

            ctx.beginPath();
            ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
            ctx.strokeStyle = `${pal.ripple}${(r.alpha * 0.4).toFixed(3)})`;
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }
        }

        /* ── 7. Nodes: minimalist dots with subtle glow ── */
        for (let i = 0; i < N; i++) {
          const n = nodes[i];
          const a = (0.5 + n.activity * 0.5) * n.depth;

          // Core/Hub: faint halo ring
          if (n.tier === 'CORE') {
            const haloR = n.radius + 6 + Math.sin(t * 0.03 + n.phase) * 2;
            ctx.beginPath();
            ctx.arc(n.x, n.y, haloR, 0, Math.PI * 2);
            ctx.strokeStyle = `${pal.nodePrimary}${(0.12 + n.activity * 0.15).toFixed(3)})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }

          if (n.tier === 'HUB') {
            const haloR = n.radius + 4 + Math.sin(t * 0.04 + n.phase) * 1.5;
            ctx.beginPath();
            ctx.arc(n.x, n.y, haloR, 0, Math.PI * 2);
            ctx.strokeStyle = `${pal.nodeSecondary}${(0.10 + n.activity * 0.12).toFixed(3)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }

          // node dot
          const r = n.radius + n.activity * 0.8;
          const color =
            n.tier === 'CORE' ? pal.nodePrimary :
            n.tier === 'HUB' ? pal.nodeSecondary :
            pal.nodeEdge;

          const dotAlpha = n.tier === 'CORE' ? 0.75 + n.activity * 0.25 :
                          n.tier === 'HUB' ? 0.55 + n.activity * 0.25 :
                          0.30 + n.activity * 0.20;

          ctx.beginPath();
          ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
          ctx.fillStyle = `${color}${(dotAlpha * a).toFixed(3)})`;

          if (n.tier === 'CORE' || n.tier === 'HUB') {
            ctx.shadowColor = `${color}0.4)`;
            ctx.shadowBlur = isDark ? 6 : 3;
          }

          ctx.fill();
          ctx.shadowBlur = 0;

          // inner bright dot for CORE
          if (n.tier === 'CORE') {
            ctx.beginPath();
            ctx.arc(n.x, n.y, 1.2, 0, Math.PI * 2);
            ctx.fillStyle = isDark ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.7)';
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
