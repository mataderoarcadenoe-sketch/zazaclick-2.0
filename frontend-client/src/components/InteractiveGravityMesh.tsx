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
  anchorX: number;
  anchorY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  tier: HierarchyTier;
  color: string;
  coreColor: string;
  glowColor: string;
  phase: number;
  driftRadius: number;
  driftSpeedX: number;
  driftSpeedY: number;
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
  routerAngle: number;
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
  cols: number;
  rows: number;
  dustCount: number;
  maxPackets: number;
  trunkOpacity: number;
  branchOpacity: number;
  feederOpacity: number;
  enableTriangles: boolean;
}> = {
  premium: {
    cols: 7,
    rows: 5,
    dustCount: 50,
    maxPackets: 10,
    trunkOpacity: 0.85,
    branchOpacity: 0.55,
    feederOpacity: 0.32,
    enableTriangles: true,
  },
  admin: {
    cols: 8,
    rows: 5,
    dustCount: 55,
    maxPackets: 12,
    trunkOpacity: 0.88,
    branchOpacity: 0.58,
    feederOpacity: 0.35,
    enableTriangles: true,
  },
  client: {
    cols: 7,
    rows: 4,
    dustCount: 45,
    maxPackets: 9,
    trunkOpacity: 0.82,
    branchOpacity: 0.52,
    feederOpacity: 0.30,
    enableTriangles: true,
  },
  login: {
    cols: 7,
    rows: 5,
    dustCount: 50,
    maxPackets: 10,
    trunkOpacity: 0.85,
    branchOpacity: 0.55,
    feederOpacity: 0.32,
    enableTriangles: true,
  },
  analytics: {
    cols: 8,
    rows: 6,
    dustCount: 60,
    maxPackets: 14,
    trunkOpacity: 0.90,
    branchOpacity: 0.60,
    feederOpacity: 0.38,
    enableTriangles: true,
  },
  minimal: {
    cols: 5,
    rows: 3,
    dustCount: 25,
    maxPackets: 5,
    trunkOpacity: 0.60,
    branchOpacity: 0.35,
    feederOpacity: 0.20,
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
      enableRadarSweep = true,
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const preset = PRESETS[variant] || PRESETS.premium;

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

    const triggerBurstAtNode = (nodeId?: number) => {
      const nodes = nodesRef.current;
      const conns = connectionsRef.current;
      const packets = packetsRef.current;
      if (nodes.length === 0 || conns.length === 0) return;

      const targetNodeId = nodeId ?? (nodes.find(n => n.tier === 'CORE')?.id ?? 0);
      const relevantConns = conns.filter(c => c.source === targetNodeId || c.target === targetNodeId);

      relevantConns.forEach((c) => {
        const available = packets.find(p => !p.active);
        if (available) {
          available.active = true;
          available.source = c.source === targetNodeId ? c.source : c.target;
          available.target = c.source === targetNodeId ? c.target : c.source;
          available.progress = 0;
          available.speed = 0.045;
          available.color = isDark ? '#67E8F9' : '#0284C7';
          available.headRadius = 4.4;
          available.ctrlX = c.ctrlX;
          available.ctrlY = c.ctrlY;
          available.sparkCooldown = 0;
        }
      });

      const nodeObj = nodes.find(n => n.id === targetNodeId);
      if (nodeObj) {
        nodeObj.activity = 1.0;
        nodeObj.haloPulse = 1.0;
      }
    };

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
          available.speed = 0.038;
          available.color = pColor;
          available.headRadius = 4.2;
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
      triggerBurst: (nodeId) => {
        triggerBurstAtNode(nodeId);
      },
      emitEvent: () => {
        const nodes = nodesRef.current;
        const cores = nodes.filter(n => n.tier === 'CORE' || n.tier === 'HUB');
        if (cores.length > 0) {
          const randNode = cores[Math.floor(Math.random() * cores.length)];
          triggerBurstAtNode(randNode.id);
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
        coreHalo: 'rgba(16, 185, 129, 0.55)',
        hubHalo: 'rgba(6, 182, 212, 0.38)',
        relayHalo: 'rgba(20, 184, 166, 0.28)',
        trunkLine: 'rgba(16, 185, 129, ',
        branchLine: 'rgba(6, 182, 212, ',
        feederLine: 'rgba(20, 184, 166, ',
        mouseLine: 'rgba(103, 232, 249, ',
        triangleFill: 'rgba(16, 185, 129, 0.045)',
        triangleStroke: 'rgba(6, 182, 212, 0.16)',
        dustColor: 'rgba(167, 243, 208, ',
        packetColor: '#A7F3D0',
        waveColor: 'rgba(52, 211, 153, ',
        radarSweep: 'rgba(16, 185, 129, 0.08)',
      };

      const lightPalette = {
        core: '#047857',
        coreInner: '#F0FDF4',
        hub: '#0E7490',
        relay: '#0F766E',
        edge: '#059669',
        coreHalo: 'rgba(4, 120, 87, 0.40)',
        hubHalo: 'rgba(14, 116, 144, 0.28)',
        relayHalo: 'rgba(15, 118, 110, 0.20)',
        trunkLine: 'rgba(4, 120, 87, ',
        branchLine: 'rgba(14, 116, 144, ',
        feederLine: 'rgba(15, 118, 110, ',
        mouseLine: 'rgba(14, 116, 144, ',
        triangleFill: 'rgba(4, 120, 87, 0.035)',
        triangleStroke: 'rgba(14, 116, 144, 0.12)',
        dustColor: 'rgba(15, 118, 110, ',
        packetColor: '#047857',
        waveColor: 'rgba(4, 120, 87, ',
        radarSweep: 'rgba(4, 120, 87, 0.05)',
      };

      const theme = isDark ? darkPalette : lightPalette;

      let calculatedMaxDist = 320;

      const initTopology = () => {
        const isMobile = width < 640;
        const isTablet = width >= 640 && width < 1024;

        const cols = isMobile ? 4 : isTablet ? 6 : preset.cols;
        const rows = isMobile ? 5 : isTablet ? 5 : preset.rows;

        const cellW = width / cols;
        const cellH = height / rows;

        calculatedMaxDist = propMaxDistance ?? Math.hypot(cellW, cellH) * 1.35;

        const nodes: NetworkNode[] = [];
        let idCounter = 0;

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const offsetX = (r % 2 === 1) ? cellW * 0.5 : 0;
            const baseX = c * cellW + cellW * 0.5 + offsetX;
            const baseY = r * cellH + cellH * 0.5;

            if (baseX < 20 || baseX > width - 20 || baseY < 20 || baseY > height - 20) continue;

            const jitterX = (Math.random() - 0.5) * (cellW * 0.4);
            const jitterY = (Math.random() - 0.5) * (cellH * 0.4);

            const anchorX = baseX + jitterX;
            const anchorY = baseY + jitterY;

            let tier: HierarchyTier = 'EDGE';
            let radius = isDark ? 3.0 : 2.6;
            let color = theme.edge;
            let glowColor = theme.relayHalo;

            const isGatewayPos = (r === 1 && c === 2) || (r === 2 && c === Math.floor(cols / 2)) || (r === rows - 2 && c === cols - 3);
            const isHubPos = (r % 2 === 1 && c % 2 === 1) && !isGatewayPos;

            if (isGatewayPos) {
              tier = 'CORE';
              radius = isDark ? 7.8 : 6.8;
              color = theme.core;
              glowColor = theme.coreHalo;
            } else if (isHubPos) {
              tier = 'HUB';
              radius = isDark ? 5.4 : 4.8;
              color = theme.hub;
              glowColor = theme.hubHalo;
            } else if (Math.random() < 0.45) {
              tier = 'RELAY';
              radius = isDark ? 4.0 : 3.4;
              color = theme.relay;
              glowColor = theme.relayHalo;
            }

            const satellites: Satellite[] = [];
            if (tier === 'CORE' || tier === 'HUB') {
              const satCount = tier === 'CORE' ? 2 : 1;
              for (let s = 0; s < satCount; s++) {
                satellites.push({
                  angle: Math.random() * Math.PI * 2,
                  speed: (Math.random() * 0.02 + 0.018) * (s % 2 === 0 ? 1 : -1),
                  radius: radius + 18 + s * 11,
                  size: isDark ? 3.0 : 2.5,
                });
              }
            }

            nodes.push({
              id: idCounter++,
              anchorX,
              anchorY,
              x: anchorX,
              y: anchorY,
              vx: 0,
              vy: 0,
              radius,
              tier,
              color,
              coreColor: theme.coreInner,
              glowColor,
              phase: Math.random() * Math.PI * 2,
              driftRadius: Math.random() * 20 + 14,
              driftSpeedX: (Math.random() * 0.008 + 0.006) * (Math.random() > 0.5 ? 1 : -1),
              driftSpeedY: (Math.random() * 0.008 + 0.006) * (Math.random() > 0.5 ? 1 : -1),
              depth: Math.random() * 0.3 + 0.7,
              activity: 0,
              haloPulse: 0,
              satellites,
              sonarRadius: Math.random() * 55,
            });
          }
        }

        nodesRef.current = nodes;

        const dustCount = isMobile ? 25 : preset.dustCount;
        const dust: Stardust[] = [];
        for (let d = 0; d < dustCount; d++) {
          dust.push({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * 0.18,
            vy: (Math.random() - 0.5) * 0.18,
            size: Math.random() * 1.8 + 1.2,
            alpha: Math.random() * 0.45 + 0.3,
            twinkleSpeed: Math.random() * 0.03 + 0.02,
            twinklePhase: Math.random() * Math.PI * 2,
          });
        }
        dustRef.current = dust;

        const sparks: Spark[] = [];
        for (let sp = 0; sp < 60; sp++) {
          sparks.push({
            active: false,
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            alpha: 0,
            decay: 0.025,
            color: '#67E8F9',
            size: 2.5,
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
            speed: Math.random() * 0.012 + 0.016,
            color: isDark ? '#67E8F9' : '#0284C7',
            headRadius: isDark ? 4.2 : 3.6,
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
        initTopology();
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
        const nodes = nodesRef.current;
        let clickedNodeId: number | null = null;
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          const dist = Math.hypot(e.clientX - n.x, e.clientY - n.y);
          if (dist < 36) {
            clickedNodeId = n.id;
            break;
          }
        }

        if (clickedNodeId !== null) {
          triggerBurstAtNode(clickedNodeId);
        } else if (enableRipples) {
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
        }
      };

      window.addEventListener('resize', handleResize);
      window.addEventListener('mousemove', handleMouseMove, { passive: true });
      window.addEventListener('mouseleave', handleMouseLeave);
      window.addEventListener('click', handleClick);

      let time = 0;
      let radarX = 0;

      const render = () => {
        time += 1.0;

        const mouse = mouseRef.current;
        mouse.x += (mouse.targetX - mouse.x) * 0.18;
        mouse.y += (mouse.targetY - mouse.y) * 0.18;

        if (enableRadarSweep) {
          radarX += 3.5;
          if (radarX > width + 200) radarX = -200;
        }

        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);

        // 1. HAZ DE RADAR CUÁNTICO
        if (enableRadarSweep && radarX > -100 && radarX < width + 100) {
          const radarGrad = ctx.createLinearGradient(radarX - 140, 0, radarX, 0);
          radarGrad.addColorStop(0, 'rgba(16, 185, 129, 0)');
          radarGrad.addColorStop(0.8, theme.radarSweep);
          radarGrad.addColorStop(1, isDark ? 'rgba(103, 232, 249, 0.18)' : 'rgba(14, 116, 144, 0.12)');

          ctx.fillStyle = radarGrad;
          ctx.fillRect(radarX - 140, 0, 140, height);

          ctx.beginPath();
          ctx.moveTo(radarX, 0);
          ctx.lineTo(radarX, height);
          ctx.strokeStyle = isDark ? 'rgba(103, 232, 249, 0.35)' : 'rgba(14, 116, 144, 0.25)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }

        // 2. POLVO CÓSMICO DE FONDO
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
          ctx.shadowColor = isDark ? '#A7F3D0' : '#047857';
          ctx.shadowBlur = 4;
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        const nodes = nodesRef.current;
        const nodeCount = nodes.length;

        // 3. FÍSICA ARMÓNICA CON ANCLAJE ESPACIAL Y REPULSIÓN
        for (let i = 0; i < nodeCount; i++) {
          const n = nodes[i];

          const targetX = n.anchorX + Math.cos(time * n.driftSpeedX + n.phase) * n.driftRadius;
          const targetY = n.anchorY + Math.sin(time * n.driftSpeedY + n.phase * 1.3) * n.driftRadius;

          const springK = 0.04;
          n.vx += (targetX - n.x) * springK;
          n.vy += (targetY - n.y) * springK;

          for (let j = i + 1; j < nodeCount; j++) {
            const other = nodes[j];
            const dx = n.x - other.x;
            const dy = n.y - other.y;
            const dSq = dx * dx + dy * dy;

            if (dSq < 4900 && dSq > 0.1) {
              const d = Math.sqrt(dSq);
              const repelForce = (1 - d / 70) * 0.9;
              const nx = dx / d;
              const ny = dy / d;

              n.vx += nx * repelForce;
              n.vy += ny * repelForce;
              other.vx -= nx * repelForce;
              other.vy -= ny * repelForce;
            }
          }

          n.vx *= 0.88;
          n.vy *= 0.88;

          n.x += n.vx;
          n.y += n.vy;

          if (n.activity > 0) n.activity = Math.max(0, n.activity - 0.015);
          if (n.haloPulse > 0) n.haloPulse = Math.max(0, n.haloPulse - 0.012);

          if (n.tier === 'CORE') {
            n.sonarRadius += 0.55;
            if (n.sonarRadius > 70) n.sonarRadius = n.radius + 8;
          }

          for (let s = 0; s < n.satellites.length; s++) {
            n.satellites[s].angle += n.satellites[s].speed;
          }

          if (enableRadarSweep && Math.abs(n.x - radarX) < 20) {
            n.activity = Math.max(n.activity, 0.75);
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

        // 4. CONSTRUCCIÓN DE CONEXIONES DINÁMICAS
        const connections: NetworkConnection[] = [];
        const maxConnsPerNode = 4;
        const connCounts = new Uint8Array(nodeCount);
        const maxDistSq = calculatedMaxDist * calculatedMaxDist;
        const minDistSq = 40 * 40;

        for (let i = 0; i < nodeCount; i++) {
          if (connCounts[i] >= maxConnsPerNode) continue;

          for (let j = i + 1; j < nodeCount; j++) {
            if (connCounts[j] >= maxConnsPerNode) continue;

            const n1 = nodes[i];
            const n2 = nodes[j];
            const dx = n1.x - n2.x;
            const dy = n1.y - n2.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < maxDistSq && distSq > minDistSq) {
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
                  const warp = (1 - mDist / 180) * 24;
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
                routerAngle: (i + j) * 0.4,
              });

              connCounts[i]++;
              connCounts[j]++;
              if (connCounts[i] >= maxConnsPerNode) break;
            }
          }
        }

        connectionsRef.current = connections;

        // 5. FACETAS GEOMÉTRICAS TRIANGULARES
        if (preset.enableTriangles && connections.length >= 3) {
          ctx.fillStyle = theme.triangleFill;
          ctx.strokeStyle = theme.triangleStroke;
          ctx.lineWidth = 0.6;

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

                if (maxSide < calculatedMaxDist * 0.85) {
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

        // 6. FILAMENTOS DE FIBRA ÓPTICA LUMINOSA
        for (let c = 0; c < connections.length; c++) {
          const conn = connections[c];
          const p1 = nodes[conn.source];
          const p2 = nodes[conn.target];

          const distRatio = 1 - conn.dist / calculatedMaxDist;
          const boost = Math.max(p1.activity, p2.activity) * 0.45;

          const lineGrad = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
          if (conn.tier === 'TRUNK') {
            const alpha = Math.min(1.0, distRatio * preset.trunkOpacity + boost).toFixed(3);
            lineGrad.addColorStop(0, `${theme.trunkLine}${alpha})`);
            lineGrad.addColorStop(0.5, isDark ? `rgba(6, 182, 212, ${alpha})` : `rgba(14, 116, 144, ${alpha})`);
            lineGrad.addColorStop(1, `${theme.trunkLine}${alpha})`);
            ctx.strokeStyle = lineGrad;
            ctx.lineWidth = isDark ? 2.4 : 1.9;
          } else if (conn.tier === 'BRANCH') {
            const alpha = Math.min(1.0, distRatio * preset.branchOpacity + boost).toFixed(3);
            lineGrad.addColorStop(0, `${theme.branchLine}${alpha})`);
            lineGrad.addColorStop(1, `${theme.feederLine}${alpha})`);
            ctx.strokeStyle = lineGrad;
            ctx.lineWidth = isDark ? 1.5 : 1.2;
          } else {
            const alpha = Math.min(1.0, distRatio * preset.feederOpacity + boost).toFixed(3);
            ctx.strokeStyle = `${theme.feederLine}${alpha})`;
            ctx.lineWidth = isDark ? 1.1 : 0.9;
          }

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.quadraticCurveTo(conn.ctrlX, conn.ctrlY, p2.x, p2.y);
          ctx.stroke();

          if (conn.tier === 'TRUNK' && distRatio > 0.35) {
            ctx.save();
            ctx.translate(conn.ctrlX, conn.ctrlY);
            ctx.rotate(time * 0.025 + conn.routerAngle);
            ctx.strokeStyle = isDark ? 'rgba(103, 232, 249, 0.6)' : 'rgba(14, 116, 144, 0.45)';
            ctx.lineWidth = 1.2;
            ctx.strokeRect(-3, -3, 6, 6);
            ctx.restore();
          }
        }

        // 7. RETÍCULA Y FILAMENTOS MAGNÉTICOS DEL RATÓN
        if (mouse.isActive && enableMouseInteraction) {
          const focusRing = 22 + Math.sin(time * 0.08) * 3;
          ctx.beginPath();
          ctx.arc(mouse.x, mouse.y, focusRing, 0, Math.PI * 2);
          ctx.strokeStyle = isDark ? 'rgba(103, 232, 249, 0.6)' : 'rgba(14, 116, 144, 0.45)';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);

          for (let i = 0; i < nodeCount; i++) {
            const n = nodes[i];
            const mdx = mouse.x - n.x;
            const mdy = mouse.y - n.y;
            const mDist = Math.sqrt(mdx * mdx + mdy * mdy);

            if (mDist < 240) {
              const alpha = ((1 - mDist / 240) * (isDark ? 0.65 : 0.45)).toFixed(3);
              ctx.beginPath();
              ctx.moveTo(mouse.x, mouse.y);
              ctx.lineTo(n.x, n.y);
              ctx.strokeStyle = `${theme.mouseLine}${alpha})`;
              ctx.lineWidth = 1.5;
              ctx.stroke();
            }
          }
        }

        // 8. PAQUETES DE DATOS CUÁNTICOS
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
              pkt.speed = Math.random() * 0.012 + 0.016;
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
            if (pkt.sparkCooldown >= 2) {
              pkt.sparkCooldown = 0;
              const sparkAvail = sparks.find(s => !s.active);
              if (sparkAvail) {
                sparkAvail.active = true;
                sparkAvail.x = headX + (Math.random() - 0.5) * 6;
                sparkAvail.y = headY + (Math.random() - 0.5) * 6;
                sparkAvail.vx = (Math.random() - 0.5) * 0.8;
                sparkAvail.vy = (Math.random() - 0.5) * 0.8;
                sparkAvail.alpha = 1.0;
                sparkAvail.decay = 0.03;
                sparkAvail.color = isDark ? '#67E8F9' : '#0284C7';
                sparkAvail.size = Math.random() * 2.0 + 1.5;
              }
            }

            const tTail = Math.max(0, t - 0.30);
            const oneMinusTTail = 1 - tTail;
            const tailX = oneMinusTTail * oneMinusTTail * src.x + 2 * oneMinusTTail * tTail * pkt.ctrlX + tTail * tTail * tgt.x;
            const tailY = oneMinusTTail * oneMinusTTail * src.y + 2 * oneMinusTTail * tTail * pkt.ctrlY + tTail * tTail * tgt.y;

            const visibility = Math.sin(pkt.progress * Math.PI);

            const grad = ctx.createLinearGradient(tailX, tailY, headX, headY);
            grad.addColorStop(0, 'rgba(6, 182, 212, 0)');
            grad.addColorStop(0.6, `${theme.branchLine}${(visibility * (isDark ? 0.9 : 0.75)).toFixed(3)})`);
            grad.addColorStop(1, pkt.color);

            ctx.beginPath();
            ctx.moveTo(tailX, tailY);
            ctx.lineTo(headX, headY);
            ctx.strokeStyle = grad;
            ctx.lineWidth = isDark ? 3.4 : 2.6;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(headX, headY, pkt.headRadius, 0, Math.PI * 2);
            ctx.fillStyle = pkt.color;
            ctx.shadowColor = pkt.color;
            ctx.shadowBlur = isDark ? 16 : 8;
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
            ctx.shadowColor = spark.color;
            ctx.shadowBlur = 6;
            ctx.globalAlpha = spark.alpha;
            ctx.fill();
            ctx.globalAlpha = 1.0;
            ctx.shadowBlur = 0;
          }
        }

        // 9. ONDAS DE CHOQUE
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
            ctx.strokeStyle = `${theme.waveColor}${(wave.intensity * 0.7).toFixed(3)})`;
            ctx.lineWidth = 2.4;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(wave.x, wave.y, Math.max(1, wave.radius - 18), 0, Math.PI * 2);
            ctx.strokeStyle = `${theme.waveColor}${(wave.intensity * 0.4).toFixed(3)})`;
            ctx.lineWidth = 1.4;
            ctx.stroke();
          }
        }

        // 10. DIBUJAR NODOS, HALOS Y MICRO-SATÉLITES
        for (let i = 0; i < nodeCount; i++) {
          const n = nodes[i];
          const nodeAlpha = (0.88 + n.activity * 0.12) * n.depth;

          if (n.tier === 'CORE') {
            const haloSize = 46 + Math.sin(time * 0.05 + n.phase) * 10 + (n.activity * 25);
            const haloGrad = ctx.createRadialGradient(n.x, n.y, 2, n.x, n.y, haloSize);
            haloGrad.addColorStop(0, isDark ? 'rgba(16, 185, 129, 0.60)' : 'rgba(4, 120, 87, 0.45)');
            haloGrad.addColorStop(0.5, isDark ? 'rgba(6, 182, 212, 0.30)' : 'rgba(14, 116, 144, 0.22)');
            haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

            ctx.beginPath();
            ctx.arc(n.x, n.y, haloSize, 0, Math.PI * 2);
            ctx.fillStyle = haloGrad;
            ctx.fill();

            const sonarAlpha = (1 - n.sonarRadius / 70) * 0.55;
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.sonarRadius, 0, Math.PI * 2);
            ctx.strokeStyle = `${theme.trunkLine}${sonarAlpha.toFixed(3)})`;
            ctx.lineWidth = 1.3;
            ctx.stroke();

            const orbitRadius = n.radius + 9.0 + Math.sin(time * 0.04 + n.phase) * 1.8;
            ctx.beginPath();
            ctx.arc(n.x, n.y, orbitRadius, 0, Math.PI * 2);
            ctx.strokeStyle = `${theme.trunkLine}${(0.55 + n.activity * 0.45).toFixed(3)})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }

          if (n.tier === 'HUB') {
            const hubRingRadius = n.radius + 6.0 + Math.sin(time * 0.06 + n.phase) * 1.4;
            ctx.beginPath();
            ctx.arc(n.x, n.y, hubRingRadius, 0, Math.PI * 2);
            ctx.strokeStyle = `${theme.branchLine}${(0.45 + n.activity * 0.4).toFixed(3)})`;
            ctx.lineWidth = 1.3;
            ctx.stroke();
          }

          for (let s = 0; s < n.satellites.length; s++) {
            const sat = n.satellites[s];

            ctx.beginPath();
            ctx.arc(n.x, n.y, sat.radius, 0, Math.PI * 2);
            ctx.strokeStyle = isDark ? 'rgba(103, 232, 249, 0.20)' : 'rgba(14, 116, 144, 0.15)';
            ctx.lineWidth = 0.8;
            ctx.setLineDash([3, 4]);
            ctx.stroke();
            ctx.setLineDash([]);

            const satX = n.x + Math.cos(sat.angle) * sat.radius;
            const satY = n.y + Math.sin(sat.angle) * sat.radius;

            ctx.beginPath();
            ctx.arc(satX, satY, sat.size, 0, Math.PI * 2);
            ctx.fillStyle = isDark ? '#67E8F9' : '#0E7490';
            ctx.shadowColor = isDark ? '#67E8F9' : '#0E7490';
            ctx.shadowBlur = 8;
            ctx.fill();
            ctx.shadowBlur = 0;
          }

          const currentRadius = n.radius + (n.activity * 1.5);
          ctx.beginPath();
          ctx.arc(n.x, n.y, currentRadius, 0, Math.PI * 2);
          ctx.fillStyle = n.color;
          ctx.shadowColor = n.color;
          ctx.shadowBlur = isDark ? (n.tier === 'CORE' ? 24 : n.tier === 'HUB' ? 16 : 9) : 6;
          ctx.globalAlpha = nodeAlpha;
          ctx.fill();
          ctx.globalAlpha = 1.0;
          ctx.shadowBlur = 0;

          if (n.tier === 'CORE' || n.tier === 'HUB') {
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.tier === 'CORE' ? 2.8 : 2.0, 0, Math.PI * 2);
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
    }, [propMaxDistance, isDark, enablePulses, enableRipples, enableMouseInteraction, enableRadarSweep, variant]);

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
