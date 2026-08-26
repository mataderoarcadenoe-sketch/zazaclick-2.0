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
}

export interface InteractiveGravityMeshRef {
  triggerPulse: (sourceIdx?: number, targetIdx?: number) => void;
  triggerRipple: (x: number, y: number) => void;
  emitEvent: (event: { type: string; payload?: any }) => void;
}

export type HierarchyTier = 'CORE' | 'HUB' | 'RELAY' | 'EDGE';

interface Satellite {
  angle: number;
  speed: number;
  radius: number;
  size: number;
}

interface Stardust {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
}

interface Spark {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  decay: number;
  color: string;
  size: number;
}

interface NetworkNode {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseVx: number;
  baseVy: number;
  radius: number;
  tier: HierarchyTier;
  color: string;
  coreColor: string;
  glowColor: string;
  phase: number;
  depth: number;
  activity: number;
  haloPulse: number;
  satellites: Satellite[];
  sonarRadius: number;
}

interface NetworkConnection {
  source: number;
  target: number;
  dist: number;
  ctrlX: number;
  ctrlY: number;
  tier: 'TRUNK' | 'BRANCH' | 'FEEDER';
}

interface DataPacket {
  active: boolean;
  source: number;
  target: number;
  progress: number;
  speed: number;
  color: string;
  headRadius: number;
  ctrlX: number;
  ctrlY: number;
  sparkCooldown: number;
}

interface SignalWave {
  active: boolean;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  intensity: number;
  speed: number;
}

const PRESETS: Record<MeshVariant, {
  coreCount: number;
  hubCount: number;
  relayCount: number;
  edgeCount: number;
  dustCount: number;
  maxDistance: number;
  maxPackets: number;
  trunkOpacity: number;
  branchOpacity: number;
  feederOpacity: number;
  speedMultiplier: number;
  enableTriangles: boolean;
}> = {
  premium: {
    coreCount: 4,
    hubCount: 8,
    relayCount: 18,
    edgeCount: 28,
    dustCount: 45,
    maxDistance: 165,
    maxPackets: 9,
    trunkOpacity: 0.72,
    branchOpacity: 0.46,
    feederOpacity: 0.26,
    speedMultiplier: 0.95,
    enableTriangles: true,
  },
  admin: {
    coreCount: 5,
    hubCount: 10,
    relayCount: 22,
    edgeCount: 32,
    dustCount: 50,
    maxDistance: 175,
    maxPackets: 10,
    trunkOpacity: 0.8,
    branchOpacity: 0.5,
    feederOpacity: 0.28,
    speedMultiplier: 1.0,
    enableTriangles: true,
  },
  client: {
    coreCount: 4,
    hubCount: 7,
    relayCount: 16,
    edgeCount: 24,
    dustCount: 40,
    maxDistance: 160,
    maxPackets: 8,
    trunkOpacity: 0.68,
    branchOpacity: 0.42,
    feederOpacity: 0.24,
    speedMultiplier: 0.9,
    enableTriangles: true,
  },
  login: {
    coreCount: 4,
    hubCount: 8,
    relayCount: 16,
    edgeCount: 26,
    dustCount: 45,
    maxDistance: 165,
    maxPackets: 9,
    trunkOpacity: 0.72,
    branchOpacity: 0.46,
    feederOpacity: 0.26,
    speedMultiplier: 0.95,
    enableTriangles: true,
  },
  analytics: {
    coreCount: 6,
    hubCount: 12,
    relayCount: 26,
    edgeCount: 36,
    dustCount: 60,
    maxDistance: 185,
    maxPackets: 12,
    trunkOpacity: 0.85,
    branchOpacity: 0.55,
    feederOpacity: 0.32,
    speedMultiplier: 1.15,
    enableTriangles: true,
  },
  minimal: {
    coreCount: 2,
    hubCount: 4,
    relayCount: 10,
    edgeCount: 16,
    dustCount: 25,
    maxDistance: 140,
    maxPackets: 4,
    trunkOpacity: 0.45,
    branchOpacity: 0.28,
    feederOpacity: 0.16,
    speedMultiplier: 0.8,
    enableTriangles: false,
  },
};

export const InteractiveGravityMesh = forwardRef<InteractiveGravityMeshRef, InteractiveGravityMeshProps>(
  (
    {
      variant = 'premium',
      maxDistance: propMaxDistance,
      isDark = true,
      className = 'fixed inset-0 pointer-events-none z-0',
      enablePulses = true,
      enableRipples = true,
      enableMouseInteraction = true,
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const preset = PRESETS[variant] || PRESETS.premium;
    const maxDistance = propMaxDistance ?? preset.maxDistance;

    const nodesRef = useRef<NetworkNode[]>([]);
    const connectionsRef = useRef<NetworkConnection[]>([]);
    const packetsRef = useRef<DataPacket[]>([]);
    const wavesRef = useRef<SignalWave[]>([]);
    const dustRef = useRef<Stardust[]>([]);
    const sparksRef = useRef<Spark[]>([]);
    const mouseRef = useRef({
      x: -3000,
      y: -3000,
      targetX: -3000,
      targetY: -3000,
      isActive: false,
    });

    useImperativeHandle(ref, () => ({
      triggerPulse: (sourceIdx, targetIdx) => {
        const conns = connectionsRef.current;
        if (conns.length === 0) return;

        let src = sourceIdx ?? -1;
        let tgt = targetIdx ?? -1;

        if (src === -1 || tgt === -1) {
          const randConn = conns[Math.floor(Math.random() * conns.length)];
          src = randConn.source;
          tgt = randConn.target;
        }

        const packets = packetsRef.current;
        const available = packets.find(p => !p.active);
        const pColor = isDark ? '#67E8F9' : '#0284C7';

        if (available) {
          const conn = conns.find(c => (c.source === src && c.target === tgt) || (c.source === tgt && c.target === src)) || conns[0];
          available.active = true;
          available.source = src;
          available.target = tgt;
          available.progress = 0;
          available.speed = 0.035;
          available.color = pColor;
          available.headRadius = 3.6;
          available.ctrlX = conn.ctrlX;
          available.ctrlY = conn.ctrlY;
          available.sparkCooldown = 0;
        }
      },
      triggerRipple: (x, y) => {
        const waves = wavesRef.current;
        const available = waves.find(w => !w.active);
        if (available) {
          available.active = true;
          available.x = x;
          available.y = y;
          available.radius = 10;
          available.maxRadius = 280;
          available.intensity = 1.0;
          available.speed = 5.0;
        } else if (waves.length < 6) {
          waves.push({
            active: true,
            x,
            y,
            radius: 10,
            maxRadius: 280,
            intensity: 1.0,
            speed: 5.0,
          });
        }
      },
      emitEvent: () => {
        const nodes = nodesRef.current;
        const cores = nodes.filter(n => n.tier === 'CORE' || n.tier === 'HUB');
        if (cores.length > 0) {
          const randNode = cores[Math.floor(Math.random() * cores.length)];
          randNode.activity = 1.0;
          randNode.haloPulse = 1.0;
        }
      },
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) return;

      let animationFrameId: number;
      let width = window.innerWidth;
      let height = window.innerHeight;
      let dpr = Math.min(window.devicePixelRatio || 1, 2);

      const darkPalette = {
        core: '#10B981',
        coreInner: '#FFFFFF',
        hub: '#06B6D4',
        relay: '#14B8A6',
        edge: '#34D399',
        coreHalo: 'rgba(16, 185, 129, 0.48)',
        hubHalo: 'rgba(6, 182, 212, 0.32)',
        relayHalo: 'rgba(20, 184, 166, 0.22)',
        trunkLine: 'rgba(16, 185, 129, ',
        branchLine: 'rgba(6, 182, 212, ',
        feederLine: 'rgba(20, 184, 166, ',
        mouseLine: 'rgba(103, 232, 249, ',
        triangleFill: 'rgba(16, 185, 129, 0.04)',
        triangleStroke: 'rgba(6, 182, 212, 0.14)',
        dustColor: 'rgba(167, 243, 208, ',
        packetColor: '#A7F3D0',
        waveColor: 'rgba(52, 211, 153, ',
      };

      const lightPalette = {
        core: '#047857',
        coreInner: '#F0FDF4',
        hub: '#0E7490',
        relay: '#0F766E',
        edge: '#059669',
        coreHalo: 'rgba(4, 120, 87, 0.35)',
        hubHalo: 'rgba(14, 116, 144, 0.24)',
        relayHalo: 'rgba(15, 118, 110, 0.18)',
        trunkLine: 'rgba(4, 120, 87, ',
        branchLine: 'rgba(14, 116, 144, ',
        feederLine: 'rgba(15, 118, 110, ',
        mouseLine: 'rgba(14, 116, 144, ',
        triangleFill: 'rgba(4, 120, 87, 0.028)',
        triangleStroke: 'rgba(14, 116, 144, 0.1)',
        dustColor: 'rgba(15, 118, 110, ',
        packetColor: '#047857',
        waveColor: 'rgba(4, 120, 87, ',
      };

      const theme = isDark ? darkPalette : lightPalette;

      const initNodesAndCosmos = () => {
        const isMobile = width < 640;
        const isTablet = width >= 640 && width < 1024;

        const coreCount = isMobile ? 3 : preset.coreCount;
        const hubCount = isMobile ? 5 : isTablet ? 7 : preset.hubCount;
        const relayCount = isMobile ? 10 : isTablet ? 14 : preset.relayCount;
        const edgeCount = isMobile ? 14 : isTablet ? 20 : preset.edgeCount;
        const dustCount = isMobile ? 20 : preset.dustCount;

        const nodes: NetworkNode[] = [];
        let idCounter = 0;

        const totalCount = coreCount + hubCount + relayCount + edgeCount;

        for (let i = 0; i < totalCount; i++) {
          let tier: HierarchyTier = 'EDGE';
          let radius = isDark ? 2.4 : 2.1;
          let color = theme.edge;
          let glowColor = theme.relayHalo;

          if (i < coreCount) {
            tier = 'CORE';
            radius = isDark ? 6.8 : 5.8;
            color = theme.core;
            glowColor = theme.coreHalo;
          } else if (i < coreCount + hubCount) {
            tier = 'HUB';
            radius = isDark ? 4.6 : 4.0;
            color = theme.hub;
            glowColor = theme.hubHalo;
          } else if (i < coreCount + hubCount + relayCount) {
            tier = 'RELAY';
            radius = isDark ? 3.3 : 2.9;
            color = theme.relay;
            glowColor = theme.relayHalo;
          }

          const x = Math.random() * (width - 60) + 30;
          const y = Math.random() * (height - 60) + 30;

          const angle = Math.random() * Math.PI * 2;
          const speed = (Math.random() * 0.4 + 0.3) * preset.speedMultiplier * (tier === 'CORE' ? 0.55 : 1.0);
          const baseVx = Math.cos(angle) * speed;
          const baseVy = Math.sin(angle) * speed;

          const satellites: Satellite[] = [];
          if (tier === 'CORE' || tier === 'HUB') {
            const satCount = tier === 'CORE' ? 2 : 1;
            for (let s = 0; s < satCount; s++) {
              satellites.push({
                angle: Math.random() * Math.PI * 2,
                speed: (Math.random() * 0.025 + 0.02) * (s % 2 === 0 ? 1 : -1),
                radius: radius + 13 + s * 8,
                size: isDark ? 1.9 : 1.6,
              });
            }
          }

          nodes.push({
            id: idCounter++,
            x,
            y,
            vx: baseVx,
            vy: baseVy,
            baseVx,
            baseVy,
            radius,
            tier,
            color,
            coreColor: theme.coreInner,
            glowColor,
            phase: Math.random() * Math.PI * 2,
            depth: Math.random() * 0.4 + 0.6,
            activity: 0,
            haloPulse: 0,
            satellites,
            sonarRadius: Math.random() * 50,
          });
        }

        nodesRef.current = nodes;

        const dust: Stardust[] = [];
        for (let d = 0; d < dustCount; d++) {
          dust.push({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * 0.15,
            vy: (Math.random() - 0.5) * 0.15,
            size: Math.random() * 1.2 + 0.6,
            alpha: Math.random() * 0.35 + 0.1,
            twinkleSpeed: Math.random() * 0.03 + 0.015,
            twinklePhase: Math.random() * Math.PI * 2,
          });
        }
        dustRef.current = dust;

        const sparks: Spark[] = [];
        for (let sp = 0; sp < 40; sp++) {
          sparks.push({
            active: false,
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            alpha: 0,
            decay: 0.05,
            color: '#67E8F9',
            size: 1.5,
          });
        }
        sparksRef.current = sparks;

        const initialPackets: DataPacket[] = [];
        for (let p = 0; p < preset.maxPackets; p++) {
          initialPackets.push({
            active: false,
            source: 0,
            target: 0,
            progress: 0,
            speed: Math.random() * 0.015 + 0.022,
            color: isDark ? '#67E8F9' : '#0284C7',
            headRadius: isDark ? 3.6 : 3.0,
            ctrlX: 0,
            ctrlY: 0,
            sparkCooldown: 0,
          });
        }
        packetsRef.current = initialPackets;
      };

      const handleResize = () => {
        if (!canvas) return;
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        initNodesAndCosmos();
      };

      handleResize();

      const handleMouseMove = (e: MouseEvent) => {
        if (!enableMouseInteraction) return;
        mouseRef.current.targetX = e.clientX;
        mouseRef.current.targetY = e.clientY;
        mouseRef.current.isActive = true;
      };

      const handleMouseLeave = () => {
        mouseRef.current.isActive = false;
        mouseRef.current.targetX = -3000;
        mouseRef.current.targetY = -3000;
      };

      const handleClick = (e: MouseEvent) => {
        if (!enableRipples) return;
        const waves = wavesRef.current;
        const available = waves.find(w => !w.active);
        if (available) {
          available.active = true;
          available.x = e.clientX;
          available.y = e.clientY;
          available.radius = 10;
          available.maxRadius = 280;
          available.intensity = 1.0;
          available.speed = 5.0;
        } else if (waves.length < 6) {
          waves.push({
            active: true,
            x: e.clientX,
            y: e.clientY,
            radius: 10,
            maxRadius: 280,
            intensity: 1.0,
            speed: 5.0,
          });
        }
      };

      window.addEventListener('resize', handleResize);
      window.addEventListener('mousemove', handleMouseMove, { passive: true });
      window.addEventListener('mouseleave', handleMouseLeave);
      window.addEventListener('click', handleClick, { passive: true });

      let time = 0;
      const maxDistSq = maxDistance * maxDistance;

      const render = () => {
        time += 0.02;

        const mouse = mouseRef.current;
        mouse.x += (mouse.targetX - mouse.x) * 0.18;
        mouse.y += (mouse.targetY - mouse.y) * 0.18;

        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);

        // 1. POLVO CÓSMICO DE FONDO
        const dust = dustRef.current;
        for (let d = 0; d < dust.length; d++) {
          const p = dust[d];
          p.x += p.vx;
          p.y += p.vy;

          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;

          p.twinklePhase += p.twinkleSpeed;
          const currentAlpha = p.alpha * (0.6 + 0.4 * Math.sin(p.twinklePhase));

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `${theme.dustColor}${currentAlpha.toFixed(3)})`;
          ctx.fill();
        }

        const nodes = nodesRef.current;
        const nodeCount = nodes.length;

        // 2. FÍSICA Y CAMPO DE FLUJO CURL
        for (let i = 0; i < nodeCount; i++) {
          const n = nodes[i];

          const flowAngle = Math.sin(n.x * 0.0018 + time * 0.5) * Math.cos(n.y * 0.0018 + time * 0.4) * Math.PI * 2;
          const flowForce = 0.08 * preset.speedMultiplier;
          n.vx += Math.cos(flowAngle) * flowForce;
          n.vy += Math.sin(flowAngle) * flowForce;

          n.x += n.vx;
          n.y += n.vy;

          if (n.x < 20) { n.x = 20; n.vx = Math.abs(n.vx) * 0.8; n.baseVx = Math.abs(n.baseVx); }
          if (n.x > width - 20) { n.x = width - 20; n.vx = -Math.abs(n.vx) * 0.8; n.baseVx = -Math.abs(n.baseVx); }
          if (n.y < 20) { n.y = 20; n.vy = Math.abs(n.vy) * 0.8; n.baseVy = Math.abs(n.baseVy); }
          if (n.y > height - 20) { n.y = height - 20; n.vy = -Math.abs(n.vy) * 0.8; n.baseVy = -Math.abs(n.baseVy); }

          n.vx = n.vx * 0.97 + n.baseVx * 0.03;
          n.vy = n.vy * 0.97 + n.baseVy * 0.03;

          if (n.activity > 0) n.activity = Math.max(0, n.activity - 0.015);
          if (n.haloPulse > 0) n.haloPulse = Math.max(0, n.haloPulse - 0.012);

          if (n.tier === 'CORE') {
            n.sonarRadius += 0.45;
            if (n.sonarRadius > 60) n.sonarRadius = n.radius + 6;
          }

          for (let s = 0; s < n.satellites.length; s++) {
            n.satellites[s].angle += n.satellites[s].speed;
          }

          if (mouse.isActive && enableMouseInteraction) {
            const dx = mouse.x - n.x;
            const dy = mouse.y - n.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 240 && dist > 1) {
              const pull = (1 - dist / 240) * 1.8;
              n.vx += (dx / dist) * pull * 0.35;
              n.vy += (dy / dist) * pull * 0.35;
              n.activity = Math.max(n.activity, pull * 0.85);
            }
          }

          const waves = wavesRef.current;
          for (let w = 0; w < waves.length; w++) {
            const wave = waves[w];
            if (!wave.active) continue;

            const wdx = n.x - wave.x;
            const wdy = n.y - wave.y;
            const wDist = Math.sqrt(wdx * wdx + wdy * wdy);
            const band = Math.abs(wDist - wave.radius);

            if (band < 35) {
              const force = (1 - band / 35) * wave.intensity * 2.8;
              const angle = Math.atan2(wdy, wdx);
              n.vx += Math.cos(angle) * force * 0.35;
              n.vy += Math.sin(angle) * force * 0.35;
              n.activity = Math.max(n.activity, wave.intensity * 0.95);
            }
          }
        }

        // 3. CONSTRUIR CONEXIONES
        const connections: NetworkConnection[] = [];
        const maxConnsPerNode = 4;
        const connCounts = new Uint8Array(nodeCount);

        for (let i = 0; i < nodeCount; i++) {
          if (connCounts[i] >= maxConnsPerNode) continue;

          for (let j = i + 1; j < nodeCount; j++) {
            if (connCounts[j] >= maxConnsPerNode) continue;

            const n1 = nodes[i];
            const n2 = nodes[j];
            const dx = n1.x - n2.x;
            const dy = n1.y - n2.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < maxDistSq) {
              const dist = Math.sqrt(distSq);
              let tier: 'TRUNK' | 'BRANCH' | 'FEEDER' = 'FEEDER';

              if ((n1.tier === 'CORE' || n1.tier === 'HUB') && (n2.tier === 'CORE' || n2.tier === 'HUB')) {
                tier = 'TRUNK';
              } else if (n1.tier === 'RELAY' || n2.tier === 'RELAY' || n1.tier === 'HUB' || n2.tier === 'HUB') {
                tier = 'BRANCH';
              }

              let midX = (n1.x + n2.x) * 0.5;
              let midY = (n1.y + n2.y) * 0.5;

              if (mouse.isActive && enableMouseInteraction) {
                const mdx = mouse.x - midX;
                const mdy = mouse.y - midY;
                const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
                if (mDist < 180 && mDist > 1) {
                  const warp = (1 - mDist / 180) * 22;
                  midX += (mdx / mDist) * warp;
                  midY += (mdy / mDist) * warp;
                }
              }

              connections.push({
                source: i,
                target: j,
                dist,
                ctrlX: midX,
                ctrlY: midY,
                tier,
              });

              connCounts[i]++;
              connCounts[j]++;
              if (connCounts[i] >= maxConnsPerNode) break;
            }
          }
        }

        connectionsRef.current = connections;

        // 4. FACETAS GEOMÉTRICAS HOLOGRÁFICAS
        if (preset.enableTriangles && connections.length >= 3) {
          ctx.fillStyle = theme.triangleFill;
          ctx.strokeStyle = theme.triangleStroke;
          ctx.lineWidth = 0.5;

          for (let c1 = 0; c1 < Math.min(connections.length, 35); c1++) {
            const conn1 = connections[c1];
            for (let c2 = c1 + 1; c2 < Math.min(connections.length, 35); c2++) {
              const conn2 = connections[c2];

              if (conn1.source === conn2.source || conn1.source === conn2.target || conn1.target === conn2.source || conn1.target === conn2.target) {
                const p1 = nodes[conn1.source];
                const p2 = nodes[conn1.target];
                const p3 = nodes[conn2.source === conn1.source || conn2.source === conn1.target ? conn2.target : conn2.source];

                const maxSide = Math.max(
                  Math.hypot(p1.x - p2.x, p1.y - p2.y),
                  Math.hypot(p2.x - p3.x, p2.y - p3.y),
                  Math.hypot(p3.x - p1.x, p3.y - p1.y)
                );

                if (maxSide < maxDistance * 0.9) {
                  ctx.beginPath();
                  ctx.moveTo(p1.x, p1.y);
                  ctx.lineTo(p2.x, p2.y);
                  ctx.lineTo(p3.x, p3.y);
                  ctx.closePath();
                  ctx.fill();
                  ctx.stroke();
                }
              }
            }
          }
        }

        // 5. FILAMENTOS DE FIBRA ÓPTICA LUMINOSA (GRADIENT BÉZIER FILAMENTS)
        for (let c = 0; c < connections.length; c++) {
          const conn = connections[c];
          const p1 = nodes[conn.source];
          const p2 = nodes[conn.target];

          const distRatio = 1 - conn.dist / maxDistance;
          const boost = Math.max(p1.activity, p2.activity) * 0.45;

          const lineGrad = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
          if (conn.tier === 'TRUNK') {
            const alpha = Math.min(1.0, distRatio * preset.trunkOpacity + boost).toFixed(3);
            lineGrad.addColorStop(0, `${theme.trunkLine}${alpha})`);
            lineGrad.addColorStop(0.5, isDark ? `rgba(6, 182, 212, ${alpha})` : `rgba(14, 116, 144, ${alpha})`);
            lineGrad.addColorStop(1, `${theme.trunkLine}${alpha})`);
            ctx.strokeStyle = lineGrad;
            ctx.lineWidth = isDark ? 2.0 : 1.6;
          } else if (conn.tier === 'BRANCH') {
            const alpha = Math.min(1.0, distRatio * preset.branchOpacity + boost).toFixed(3);
            lineGrad.addColorStop(0, `${theme.branchLine}${alpha})`);
            lineGrad.addColorStop(1, `${theme.feederLine}${alpha})`);
            ctx.strokeStyle = lineGrad;
            ctx.lineWidth = isDark ? 1.3 : 1.05;
          } else {
            const alpha = Math.min(1.0, distRatio * preset.feederOpacity + boost).toFixed(3);
            ctx.strokeStyle = `${theme.feederLine}${alpha})`;
            ctx.lineWidth = isDark ? 0.95 : 0.8;
          }

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.quadraticCurveTo(conn.ctrlX, conn.ctrlY, p2.x, p2.y);
          ctx.stroke();
        }

        // 6. RETÍCULA Y FILAMENTOS MAGNÉTICOS DEL RATÓN
        if (mouse.isActive && enableMouseInteraction) {
          const focusRing = 20 + Math.sin(time * 4.0) * 3;
          ctx.beginPath();
          ctx.arc(mouse.x, mouse.y, focusRing, 0, Math.PI * 2);
          ctx.strokeStyle = isDark ? 'rgba(103, 232, 249, 0.5)' : 'rgba(14, 116, 144, 0.4)';
          ctx.lineWidth = 1.0;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);

          for (let i = 0; i < nodeCount; i++) {
            const n = nodes[i];
            const mdx = mouse.x - n.x;
            const mdy = mouse.y - n.y;
            const mDist = Math.sqrt(mdx * mdx + mdy * mdy);

            if (mDist < 220) {
              const alpha = ((1 - mDist / 220) * (isDark ? 0.6 : 0.42)).toFixed(3);
              ctx.beginPath();
              ctx.moveTo(mouse.x, mouse.y);
              ctx.lineTo(n.x, n.y);
              ctx.strokeStyle = `${theme.mouseLine}${alpha})`;
              ctx.lineWidth = 1.4;
              ctx.stroke();
            }
          }
        }

        // 7. PAQUETES DE DATOS CUÁNTICOS CON EMISIÓN DE CHISPAS
        if (enablePulses && connections.length > 0) {
          const packets = packetsRef.current;
          const sparks = sparksRef.current;

          for (let p = 0; p < packets.length; p++) {
            const pkt = packets[p];

            if (!pkt.active) {
              const chosenConn = connections[Math.floor(Math.random() * connections.length)];
              pkt.active = true;
              pkt.source = chosenConn.source;
              pkt.target = chosenConn.target;
              pkt.progress = 0;
              pkt.speed = Math.random() * 0.015 + 0.022;
              pkt.color = isDark ? '#67E8F9' : '#0284C7';
              pkt.ctrlX = chosenConn.ctrlX;
              pkt.ctrlY = chosenConn.ctrlY;
              pkt.sparkCooldown = 0;
            }

            pkt.progress += pkt.speed;

            if (pkt.progress >= 1.0) {
              pkt.active = false;
              if (nodes[pkt.target]) {
                nodes[pkt.target].activity = 1.0;
                nodes[pkt.target].haloPulse = 1.0;
              }
              continue;
            }

            const src = nodes[pkt.source];
            const tgt = nodes[pkt.target];
            if (!src || !tgt) continue;

            const t = pkt.progress;
            const oneMinusT = 1 - t;
            const headX = oneMinusT * oneMinusT * src.x + 2 * oneMinusT * t * pkt.ctrlX + t * t * tgt.x;
            const headY = oneMinusT * oneMinusT * src.y + 2 * oneMinusT * t * pkt.ctrlY + t * t * tgt.y;

            pkt.sparkCooldown++;
            if (pkt.sparkCooldown >= 3) {
              pkt.sparkCooldown = 0;
              const sparkAvail = sparks.find(s => !s.active);
              if (sparkAvail) {
                sparkAvail.active = true;
                sparkAvail.x = headX + (Math.random() - 0.5) * 4;
                sparkAvail.y = headY + (Math.random() - 0.5) * 4;
                sparkAvail.vx = (Math.random() - 0.5) * 0.6;
                sparkAvail.vy = (Math.random() - 0.5) * 0.6;
                sparkAvail.alpha = 0.8;
                sparkAvail.decay = 0.05;
                sparkAvail.color = isDark ? '#67E8F9' : '#0284C7';
                sparkAvail.size = Math.random() * 1.5 + 0.8;
              }
            }

            const tTail = Math.max(0, t - 0.28);
            const oneMinusTTail = 1 - tTail;
            const tailX = oneMinusTTail * oneMinusTTail * src.x + 2 * oneMinusTTail * tTail * pkt.ctrlX + tTail * tTail * tgt.x;
            const tailY = oneMinusTTail * oneMinusTTail * src.y + 2 * oneMinusTTail * tTail * pkt.ctrlY + tTail * tTail * tgt.y;

            const visibility = Math.sin(pkt.progress * Math.PI);

            const grad = ctx.createLinearGradient(tailX, tailY, headX, headY);
            grad.addColorStop(0, 'rgba(6, 182, 212, 0)');
            grad.addColorStop(0.7, `${theme.branchLine}${(visibility * (isDark ? 0.85 : 0.65)).toFixed(3)})`);
            grad.addColorStop(1, pkt.color);

            ctx.beginPath();
            ctx.moveTo(tailX, tailY);
            ctx.lineTo(headX, headY);
            ctx.strokeStyle = grad;
            ctx.lineWidth = isDark ? 3.0 : 2.4;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(headX, headY, pkt.headRadius, 0, Math.PI * 2);
            ctx.fillStyle = pkt.color;
            ctx.shadowColor = pkt.color;
            ctx.shadowBlur = isDark ? 14 : 7;
            ctx.globalAlpha = visibility;
            ctx.fill();
            ctx.globalAlpha = 1.0;
            ctx.shadowBlur = 0;
          }

          for (let sp = 0; sp < sparks.length; sp++) {
            const spark = sparks[sp];
            if (!spark.active) continue;

            spark.x += spark.vx;
            spark.y += spark.vy;
            spark.alpha -= spark.decay;

            if (spark.alpha <= 0) {
              spark.active = false;
              continue;
            }

            ctx.beginPath();
            ctx.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
            ctx.fillStyle = spark.color;
            ctx.globalAlpha = spark.alpha;
            ctx.fill();
            ctx.globalAlpha = 1.0;
          }
        }

        // 8. ONDAS DE CHOQUE
        if (enableRipples) {
          const waves = wavesRef.current;
          for (let w = 0; w < waves.length; w++) {
            const wave = waves[w];
            if (!wave.active) continue;

            wave.radius += wave.speed;
            wave.intensity *= 0.96;

            if (wave.radius >= wave.maxRadius || wave.intensity <= 0.02) {
              wave.active = false;
              continue;
            }

            ctx.beginPath();
            ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
            ctx.strokeStyle = `${theme.waveColor}${(wave.intensity * 0.65).toFixed(3)})`;
            ctx.lineWidth = 2.2;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(wave.x, wave.y, Math.max(1, wave.radius - 16), 0, Math.PI * 2);
            ctx.strokeStyle = `${theme.waveColor}${(wave.intensity * 0.35).toFixed(3)})`;
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }
        }

        // 9. DIBUJAR NODOS, SONAR RINGS Y MICRO-SATÉLITES
        for (let i = 0; i < nodeCount; i++) {
          const n = nodes[i];
          const nodeAlpha = (0.85 + n.activity * 0.15) * n.depth;

          if (n.tier === 'CORE') {
            const haloSize = 40 + Math.sin(time * 2.5 + n.phase) * 10 + (n.activity * 24);
            const haloGrad = ctx.createRadialGradient(n.x, n.y, 2, n.x, n.y, haloSize);
            haloGrad.addColorStop(0, isDark ? 'rgba(16, 185, 129, 0.52)' : 'rgba(4, 120, 87, 0.4)');
            haloGrad.addColorStop(0.5, isDark ? 'rgba(6, 182, 212, 0.24)' : 'rgba(14, 116, 144, 0.18)');
            haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

            ctx.beginPath();
            ctx.arc(n.x, n.y, haloSize, 0, Math.PI * 2);
            ctx.fillStyle = haloGrad;
            ctx.fill();

            const sonarAlpha = (1 - n.sonarRadius / 60) * 0.45;
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.sonarRadius, 0, Math.PI * 2);
            ctx.strokeStyle = `${theme.trunkLine}${sonarAlpha.toFixed(3)})`;
            ctx.lineWidth = 1.0;
            ctx.stroke();

            const orbitRadius = n.radius + 7.5 + Math.sin(time * 2.0 + n.phase) * 1.8;
            ctx.beginPath();
            ctx.arc(n.x, n.y, orbitRadius, 0, Math.PI * 2);
            ctx.strokeStyle = `${theme.trunkLine}${(0.52 + n.activity * 0.45).toFixed(3)})`;
            ctx.lineWidth = 1.4;
            ctx.stroke();
          }

          if (n.tier === 'HUB') {
            const hubRingRadius = n.radius + 5.2 + Math.sin(time * 3.0 + n.phase) * 1.4;
            ctx.beginPath();
            ctx.arc(n.x, n.y, hubRingRadius, 0, Math.PI * 2);
            ctx.strokeStyle = `${theme.branchLine}${(0.42 + n.activity * 0.4).toFixed(3)})`;
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }

          for (let s = 0; s < n.satellites.length; s++) {
            const sat = n.satellites[s];
            const satX = n.x + Math.cos(sat.angle) * sat.radius;
            const satY = n.y + Math.sin(sat.angle) * sat.radius;

            ctx.beginPath();
            ctx.arc(satX, satY, sat.size, 0, Math.PI * 2);
            ctx.fillStyle = isDark ? '#67E8F9' : '#0E7490';
            ctx.shadowColor = isDark ? '#67E8F9' : '#0E7490';
            ctx.shadowBlur = 6;
            ctx.fill();
            ctx.shadowBlur = 0;
          }

          const currentRadius = n.radius + (n.activity * 1.4);
          ctx.beginPath();
          ctx.arc(n.x, n.y, currentRadius, 0, Math.PI * 2);
          ctx.fillStyle = n.color;
          ctx.shadowColor = n.color;
          ctx.shadowBlur = isDark ? (n.tier === 'CORE' ? 22 : n.tier === 'HUB' ? 15 : 8) : 5;
          ctx.globalAlpha = nodeAlpha;
          ctx.fill();
          ctx.globalAlpha = 1.0;
          ctx.shadowBlur = 0;

          if (n.tier === 'CORE' || n.tier === 'HUB') {
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.tier === 'CORE' ? 2.6 : 1.8, 0, Math.PI * 2);
            ctx.fillStyle = n.coreColor;
            ctx.fill();
          }
        }

        ctx.restore();
        animationFrameId = requestAnimationFrame(render);
      };

      render();

      return () => {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseleave', handleMouseLeave);
        window.removeEventListener('click', handleClick);
      };
    }, [maxDistance, isDark, enablePulses, enableRipples, enableMouseInteraction, variant]);

    return (
      <canvas
        ref={canvasRef}
        className={className}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
    );
  }
);

InteractiveGravityMesh.displayName = 'InteractiveGravityMesh';
