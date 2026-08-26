import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

export type MeshVariant = 'admin' | 'client' | 'login' | 'minimal' | 'analytics' | 'premium';

export interface InteractiveGravityMeshProps {
  variant?: MeshVariant;
  maxDistance?: number;
  gravityRadius?: number;
  gravityStrength?: number;
  springStrength?: number;
  damping?: number;
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

interface NetworkNode {
  id: number;
  x: number;
  y: number;
  originX: number;
  originY: number;
  vx: number;
  vy: number;
  radius: number;
  tier: HierarchyTier;
  color: string;
  coreColor: string;
  glowColor: string;
  phase: number;
  driftSpeed: number;
  depth: number;
  activity: number;
  haloPulse: number;
}

interface NetworkConnection {
  source: number;
  target: number;
  dist: number;
  distSq: number;
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
  length: number;
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
  maxDistance: number;
  gravityRadius: number;
  gravityStrength: number;
  springStrength: number;
  damping: number;
  pulseFrequency: number;
  maxPackets: number;
  trunkOpacity: number;
  branchOpacity: number;
  feederOpacity: number;
}> = {
  premium: {
    coreCount: 4,
    hubCount: 8,
    relayCount: 18,
    edgeCount: 30,
    maxDistance: 165,
    gravityRadius: 200,
    gravityStrength: 32,
    springStrength: 0.032,
    damping: 0.88,
    pulseFrequency: 0.04,
    maxPackets: 7,
    trunkOpacity: 0.6,
    branchOpacity: 0.4,
    feederOpacity: 0.22,
  },
  admin: {
    coreCount: 5,
    hubCount: 10,
    relayCount: 22,
    edgeCount: 34,
    maxDistance: 175,
    gravityRadius: 220,
    gravityStrength: 36,
    springStrength: 0.035,
    damping: 0.89,
    pulseFrequency: 0.05,
    maxPackets: 8,
    trunkOpacity: 0.7,
    branchOpacity: 0.45,
    feederOpacity: 0.26,
  },
  client: {
    coreCount: 4,
    hubCount: 7,
    relayCount: 16,
    edgeCount: 26,
    maxDistance: 160,
    gravityRadius: 190,
    gravityStrength: 30,
    springStrength: 0.03,
    damping: 0.88,
    pulseFrequency: 0.035,
    maxPackets: 6,
    trunkOpacity: 0.55,
    branchOpacity: 0.35,
    feederOpacity: 0.2,
  },
  login: {
    coreCount: 3,
    hubCount: 6,
    relayCount: 14,
    edgeCount: 24,
    maxDistance: 155,
    gravityRadius: 185,
    gravityStrength: 28,
    springStrength: 0.028,
    damping: 0.87,
    pulseFrequency: 0.03,
    maxPackets: 5,
    trunkOpacity: 0.5,
    branchOpacity: 0.32,
    feederOpacity: 0.18,
  },
  analytics: {
    coreCount: 5,
    hubCount: 12,
    relayCount: 26,
    edgeCount: 38,
    maxDistance: 185,
    gravityRadius: 240,
    gravityStrength: 40,
    springStrength: 0.038,
    damping: 0.9,
    pulseFrequency: 0.065,
    maxPackets: 10,
    trunkOpacity: 0.75,
    branchOpacity: 0.5,
    feederOpacity: 0.3,
  },
  minimal: {
    coreCount: 2,
    hubCount: 4,
    relayCount: 10,
    edgeCount: 16,
    maxDistance: 135,
    gravityRadius: 150,
    gravityStrength: 22,
    springStrength: 0.025,
    damping: 0.86,
    pulseFrequency: 0.02,
    maxPackets: 3,
    trunkOpacity: 0.4,
    branchOpacity: 0.25,
    feederOpacity: 0.14,
  },
};

export const InteractiveGravityMesh = forwardRef<InteractiveGravityMeshRef, InteractiveGravityMeshProps>(
  (
    {
      variant = 'premium',
      maxDistance: propMaxDistance,
      gravityRadius: propGravityRadius,
      gravityStrength: propGravityStrength,
      springStrength: propSpringStrength,
      damping: propDamping,
      isDark = true,
      className = 'absolute inset-0 pointer-events-none',
      enablePulses = true,
      enableRipples = true,
      enableMouseInteraction = true,
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const preset = PRESETS[variant] || PRESETS.premium;

    const maxDistance = propMaxDistance ?? preset.maxDistance;
    const gravityRadius = propGravityRadius ?? preset.gravityRadius;
    const gravityStrength = propGravityStrength ?? preset.gravityStrength;
    const springStrength = propSpringStrength ?? preset.springStrength;
    const damping = propDamping ?? preset.damping;

    const nodesRef = useRef<NetworkNode[]>([]);
    const connectionsRef = useRef<NetworkConnection[]>([]);
    const packetsRef = useRef<DataPacket[]>([]);
    const wavesRef = useRef<SignalWave[]>([]);
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
        const pColor = isDark ? '#A7F3D0' : '#047857';

        if (available) {
          available.active = true;
          available.source = src;
          available.target = tgt;
          available.progress = 0;
          available.speed = 0.035;
          available.color = pColor;
          available.headRadius = 3.2;
          available.length = 0.22;
        } else if (packets.length < preset.maxPackets * 2) {
          packets.push({
            active: true,
            source: src,
            target: tgt,
            progress: 0,
            speed: 0.035,
            color: pColor,
            headRadius: 3.2,
            length: 0.22,
          });
        }
      },
      triggerRipple: (x, y) => {
        const waves = wavesRef.current;
        const available = waves.find(w => !w.active);
        if (available) {
          available.active = true;
          available.x = x;
          available.y = y;
          available.radius = 8;
          available.maxRadius = 220;
          available.intensity = 1.0;
          available.speed = 4.2;
        } else if (waves.length < 6) {
          waves.push({
            active: true,
            x,
            y,
            radius: 8,
            maxRadius: 220,
            intensity: 1.0,
            speed: 4.2,
          });
        }
      },
      emitEvent: (event) => {
        const nodes = nodesRef.current;
        const cores = nodes.filter(n => n.tier === 'CORE' || n.tier === 'HUB');
        if (cores.length > 0) {
          const randNode = cores[Math.floor(Math.random() * cores.length)];
          randNode.activity = 1.0;
          randNode.haloPulse = 1.0;
        }
        if (event.type === 'message_sent' || event.type === 'api_request') {
          const conns = connectionsRef.current;
          if (conns.length > 0) {
            const randConn = conns[Math.floor(Math.random() * conns.length)];
            const packets = packetsRef.current;
            const available = packets.find(p => !p.active);
            if (available) {
              available.active = true;
              available.source = randConn.source;
              available.target = randConn.target;
              available.progress = 0;
              available.speed = 0.045;
              available.color = isDark ? '#67E8F9' : '#0284C7';
              available.headRadius = 3.6;
              available.length = 0.25;
            }
          }
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

      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // Master Color Palettes
      const darkPalette = {
        core: '#10B981',
        coreInner: '#FFFFFF',
        hub: '#06B6D4',
        relay: '#14B8A6',
        edge: '#34D399',
        coreHalo: 'rgba(16, 185, 129, 0.45)',
        hubHalo: 'rgba(6, 182, 212, 0.3)',
        relayHalo: 'rgba(20, 184, 166, 0.22)',
        edgeHalo: 'rgba(52, 211, 153, 0.15)',
        trunkLine: 'rgba(16, 185, 129, ',
        branchLine: 'rgba(6, 182, 212, ',
        feederLine: 'rgba(20, 184, 166, ',
        mouseFilament: 'rgba(103, 232, 249, ',
        packetColor: '#A7F3D0',
        waveColor: 'rgba(52, 211, 153, ',
      };

      const lightPalette = {
        core: '#047857',
        coreInner: '#ECFDF5',
        hub: '#0E7490',
        relay: '#0F766E',
        edge: '#059669',
        coreHalo: 'rgba(4, 120, 87, 0.3)',
        hubHalo: 'rgba(14, 116, 144, 0.2)',
        relayHalo: 'rgba(15, 118, 110, 0.16)',
        edgeHalo: 'rgba(5, 150, 105, 0.12)',
        trunkLine: 'rgba(4, 120, 87, ',
        branchLine: 'rgba(14, 116, 144, ',
        feederLine: 'rgba(15, 118, 110, ',
        mouseFilament: 'rgba(14, 116, 144, ',
        packetColor: '#047857',
        waveColor: 'rgba(4, 120, 87, ',
      };

      const theme = isDark ? darkPalette : lightPalette;

      const initNetworkTopology = () => {
        const isMobile = width < 640;
        const isTablet = width >= 640 && width < 1024;

        const coreCount = isMobile ? 2 : preset.coreCount;
        const hubCount = isMobile ? 4 : isTablet ? 6 : preset.hubCount;
        const relayCount = isMobile ? 8 : isTablet ? 14 : preset.relayCount;
        const edgeCount = isMobile ? 12 : isTablet ? 20 : preset.edgeCount;

        const nodes: NetworkNode[] = [];
        let idCounter = 0;

        // Strategic Regional Centers spanning the whole screen
        const corePositions = [
          { x: width * 0.18, y: height * 0.28 },
          { x: width * 0.82, y: height * 0.25 },
          { x: width * 0.50, y: height * 0.72 },
          { x: width * 0.12, y: height * 0.78 },
          { x: width * 0.88, y: height * 0.78 },
        ];

        // 1. CORE NODES
        for (let i = 0; i < coreCount; i++) {
          const pos = corePositions[i % corePositions.length];
          const x = Math.max(30, Math.min(width - 30, pos.x + (Math.random() - 0.5) * 60));
          const y = Math.max(30, Math.min(height - 30, pos.y + (Math.random() - 0.5) * 60));

          nodes.push({
            id: idCounter++,
            x,
            y,
            originX: x,
            originY: y,
            vx: 0,
            vy: 0,
            radius: isDark ? 5.5 : 4.8,
            tier: 'CORE',
            color: theme.core,
            coreColor: theme.coreInner,
            glowColor: theme.coreHalo,
            phase: Math.random() * Math.PI * 2,
            driftSpeed: 0.008,
            depth: 1.0,
            activity: 0,
            haloPulse: 0,
          });
        }

        // 2. HUB NODES
        for (let i = 0; i < hubCount; i++) {
          const parentCore = nodes[i % coreCount];
          const angle = (i * 1.35) + Math.random() * 0.6;
          const dist = 110 + Math.random() * 110;
          const x = Math.max(25, Math.min(width - 25, parentCore.originX + Math.cos(angle) * dist));
          const y = Math.max(25, Math.min(height - 25, parentCore.originY + Math.sin(angle) * dist));

          nodes.push({
            id: idCounter++,
            x,
            y,
            originX: x,
            originY: y,
            vx: 0,
            vy: 0,
            radius: isDark ? 4.0 : 3.5,
            tier: 'HUB',
            color: theme.hub,
            coreColor: theme.coreInner,
            glowColor: theme.hubHalo,
            phase: Math.random() * Math.PI * 2,
            driftSpeed: 0.012,
            depth: 0.9,
            activity: 0,
            haloPulse: 0,
          });
        }

        // 3. RELAYS
        const hubsAndCores = nodes.filter(n => n.tier === 'CORE' || n.tier === 'HUB');
        for (let i = 0; i < relayCount; i++) {
          const parent = hubsAndCores[i % hubsAndCores.length];
          const angle = Math.random() * Math.PI * 2;
          const dist = 75 + Math.random() * 95;
          const x = Math.max(20, Math.min(width - 20, parent.originX + Math.cos(angle) * dist));
          const y = Math.max(20, Math.min(height - 20, parent.originY + Math.sin(angle) * dist));

          nodes.push({
            id: idCounter++,
            x,
            y,
            originX: x,
            originY: y,
            vx: 0,
            vy: 0,
            radius: isDark ? 3.0 : 2.6,
            tier: 'RELAY',
            color: theme.relay,
            coreColor: theme.relay,
            glowColor: theme.relayHalo,
            phase: Math.random() * Math.PI * 2,
            driftSpeed: 0.016,
            depth: 0.75,
            activity: 0,
            haloPulse: 0,
          });
        }

        // 4. EDGES
        const allUpperNodes = nodes.filter(n => n.tier !== 'EDGE');
        for (let i = 0; i < edgeCount; i++) {
          const parent = allUpperNodes[i % allUpperNodes.length];
          const angle = Math.random() * Math.PI * 2;
          const dist = 55 + Math.random() * 110;
          const x = Math.max(15, Math.min(width - 15, parent.originX + Math.cos(angle) * dist));
          const y = Math.max(15, Math.min(height - 15, parent.originY + Math.sin(angle) * dist));

          nodes.push({
            id: idCounter++,
            x,
            y,
            originX: x,
            originY: y,
            vx: 0,
            vy: 0,
            radius: isDark ? 2.0 : 1.8,
            tier: 'EDGE',
            color: theme.edge,
            coreColor: theme.edge,
            glowColor: theme.edgeHalo,
            phase: Math.random() * Math.PI * 2,
            driftSpeed: 0.02,
            depth: 0.6,
            activity: 0,
            haloPulse: 0,
          });
        }

        nodesRef.current = nodes;
        packetsRef.current = [];
        wavesRef.current = [];
      };

      const handleResize = () => {
        if (!canvas) return;
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        initNetworkTopology();
      };

      handleResize();

      const handleMouseMove = (e: MouseEvent) => {
        if (!enableMouseInteraction) return;
        const rect = canvas.getBoundingClientRect();
        mouseRef.current.targetX = e.clientX - rect.left;
        mouseRef.current.targetY = e.clientY - rect.top;
        mouseRef.current.isActive = true;
      };

      const handleMouseLeave = () => {
        mouseRef.current.isActive = false;
        mouseRef.current.targetX = -3000;
        mouseRef.current.targetY = -3000;
      };

      const handleClick = (e: MouseEvent) => {
        if (!enableRipples || prefersReducedMotion) return;
        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        const waves = wavesRef.current;
        const available = waves.find(w => !w.active);
        if (available) {
          available.active = true;
          available.x = clickX;
          available.y = clickY;
          available.radius = 8;
          available.maxRadius = 220;
          available.intensity = 1.0;
          available.speed = 4.2;
        } else if (waves.length < 6) {
          waves.push({
            active: true,
            x: clickX,
            y: clickY,
            radius: 8,
            maxRadius: 220,
            intensity: 1.0,
            speed: 4.2,
          });
        }
      };

      const handleTouchMove = (e: TouchEvent) => {
        if (!enableMouseInteraction || e.touches.length === 0) return;
        const rect = canvas.getBoundingClientRect();
        mouseRef.current.targetX = e.touches[0].clientX - rect.left;
        mouseRef.current.targetY = e.touches[0].clientY - rect.top;
        mouseRef.current.isActive = true;
      };

      const handleTouchEnd = () => {
        mouseRef.current.isActive = false;
        mouseRef.current.targetX = -3000;
        mouseRef.current.targetY = -3000;
      };

      window.addEventListener('resize', handleResize);
      window.addEventListener('mousemove', handleMouseMove, { passive: true });
      window.addEventListener('mouseleave', handleMouseLeave);
      window.addEventListener('click', handleClick, { passive: true });
      window.addEventListener('touchmove', handleTouchMove, { passive: true });
      window.addEventListener('touchend', handleTouchEnd);

      let isPaused = false;
      const handleVisibilityChange = () => {
        isPaused = document.hidden;
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      let time = 0;
      const maxDistSq = maxDistance * maxDistance;
      const gravRadSq = gravityRadius * gravityRadius;

      const render = () => {
        if (!isPaused) {
          time += 0.015;

          const mouse = mouseRef.current;
          mouse.x += (mouse.targetX - mouse.x) * 0.16;
          mouse.y += (mouse.targetY - mouse.y) * 0.16;

          // Bulletproof DPR scale & transform management
          ctx.save();
          ctx.scale(dpr, dpr);
          ctx.clearRect(0, 0, width, height);

          const nodes = nodesRef.current;
          const nodeCount = nodes.length;

          // 1. UPDATE NODES WITH SPRING PHYSICS
          for (let i = 0; i < nodeCount; i++) {
            const n = nodes[i];

            n.phase += n.driftSpeed;
            const idleAmp = n.tier === 'CORE' ? 0.35 : n.tier === 'HUB' ? 0.55 : 0.85;
            const idleX = prefersReducedMotion ? 0 : Math.cos(n.phase * 0.8 + time * 0.7) * idleAmp * n.depth;
            const idleY = prefersReducedMotion ? 0 : Math.sin(n.phase + time) * idleAmp * 1.2 * n.depth;

            if (n.activity > 0) n.activity = Math.max(0, n.activity - 0.018);
            if (n.haloPulse > 0) n.haloPulse = Math.max(0, n.haloPulse - 0.014);

            if (mouse.isActive && !prefersReducedMotion) {
              const dx = mouse.x - n.x;
              const dy = mouse.y - n.y;
              const distSq = dx * dx + dy * dy;

              if (distSq < gravRadSq && distSq > 0) {
                const dist = Math.sqrt(distSq);
                const proximityRatio = 1 - dist / gravityRadius;
                const easeFactor = Math.cos((dist / gravityRadius) * (Math.PI / 2));
                const massFactor = n.tier === 'CORE' ? 0.4 : n.tier === 'HUB' ? 0.7 : 1.0;
                const force = easeFactor * gravityStrength * massFactor;
                const angle = Math.atan2(dy, dx);

                n.vx -= Math.cos(angle) * force * 0.09;
                n.vy -= Math.sin(angle) * force * 0.09;
                n.activity = Math.max(n.activity, proximityRatio * 0.85);
              }
            }

            const waves = wavesRef.current;
            for (let w = 0; w < waves.length; w++) {
              const wave = waves[w];
              if (!wave.active) continue;

              const wdx = n.x - wave.x;
              const wdy = n.y - wave.y;
              const wDist = Math.sqrt(wdx * wdx + wdy * wdy);
              const waveBand = Math.abs(wDist - wave.radius);

              if (waveBand < 30) {
                const waveForce = (1 - waveBand / 30) * wave.intensity * 2.8;
                const waveAngle = Math.atan2(wdy, wdx);
                n.vx += Math.cos(waveAngle) * waveForce * 0.16;
                n.vy += Math.sin(waveAngle) * waveForce * 0.16;
                n.activity = Math.max(n.activity, wave.intensity * 0.9);
                n.haloPulse = Math.max(n.haloPulse, wave.intensity * 0.8);
              }
            }

            const springX = (n.originX + idleX - n.x) * springStrength;
            const springY = (n.originY + idleY - n.y) * springStrength;

            n.vx = (n.vx + springX) * damping;
            n.vy = (n.vy + springY) * damping;

            n.x += n.vx;
            n.y += n.vy;
          }

          // 2. COMPUTE TOPOLOGICAL GRAPH CONNECTIONS
          const connections: NetworkConnection[] = [];
          const maxConnectionsPerNode = 4;
          const nodeConnCount = new Uint8Array(nodeCount);

          for (let i = 0; i < nodeCount; i++) {
            if (nodeConnCount[i] >= maxConnectionsPerNode) continue;

            for (let j = i + 1; j < nodeCount; j++) {
              if (nodeConnCount[j] >= maxConnectionsPerNode) continue;

              const n1 = nodes[i];
              const n2 = nodes[j];

              let allowedDistSq = maxDistSq;
              if (n1.tier === 'CORE' && n2.tier === 'CORE') allowedDistSq *= 1.45;
              else if (n1.tier === 'CORE' || n2.tier === 'CORE') allowedDistSq *= 1.3;

              const dx = n1.x - n2.x;
              const dy = n1.y - n2.y;
              const distSq = dx * dx + dy * dy;

              if (distSq < allowedDistSq) {
                const dist = Math.sqrt(distSq);
                let connTier: 'TRUNK' | 'BRANCH' | 'FEEDER' = 'FEEDER';

                if ((n1.tier === 'CORE' || n1.tier === 'HUB') && (n2.tier === 'CORE' || n2.tier === 'HUB')) {
                  connTier = 'TRUNK';
                } else if (n1.tier === 'RELAY' || n2.tier === 'RELAY' || n1.tier === 'HUB' || n2.tier === 'HUB') {
                  connTier = 'BRANCH';
                }

                connections.push({
                  source: i,
                  target: j,
                  dist,
                  distSq,
                  tier: connTier,
                });
                nodeConnCount[i]++;
                nodeConnCount[j]++;
                if (nodeConnCount[i] >= maxConnectionsPerNode) break;
              }
            }
          }

          connectionsRef.current = connections;

          // 3. DRAW CONNECTION CHANNELS
          for (let c = 0; c < connections.length; c++) {
            const conn = connections[c];
            const p1 = nodes[conn.source];
            const p2 = nodes[conn.target];

            const distFactor = 1 - conn.dist / (maxDistance * 1.3);
            const actBoost = Math.max(p1.activity, p2.activity) * 0.45;

            if (conn.tier === 'TRUNK') {
              const alpha = Math.min(1.0, distFactor * preset.trunkOpacity + actBoost).toFixed(3);
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.strokeStyle = `${theme.trunkLine}${alpha})`;
              ctx.lineWidth = isDark ? 1.8 : 1.5;
              ctx.stroke();
            } else if (conn.tier === 'BRANCH') {
              const alpha = Math.min(1.0, distFactor * preset.branchOpacity + actBoost).toFixed(3);
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.strokeStyle = `${theme.branchLine}${alpha})`;
              ctx.lineWidth = isDark ? 1.2 : 1.0;
              ctx.stroke();
            } else {
              const alpha = Math.min(1.0, distFactor * preset.feederOpacity + actBoost).toFixed(3);
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.strokeStyle = `${theme.feederLine}${alpha})`;
              ctx.lineWidth = isDark ? 0.9 : 0.75;
              ctx.stroke();
            }
          }

          // 4. DRAW MOUSE MAGNETIC LENS FILAMENTS
          if (mouse.isActive && !prefersReducedMotion) {
            for (let i = 0; i < nodeCount; i++) {
              const n = nodes[i];
              const mdx = mouse.x - n.x;
              const mdy = mouse.y - n.y;
              const mDistSq = mdx * mdx + mdy * mdy;

              if (mDistSq < gravRadSq) {
                const mDist = Math.sqrt(mDistSq);
                const mAlpha = ((1 - mDist / gravityRadius) * (isDark ? 0.5 : 0.35)).toFixed(3);

                ctx.beginPath();
                ctx.moveTo(mouse.x, mouse.y);
                ctx.lineTo(n.x, n.y);
                ctx.strokeStyle = `${theme.mouseFilament}${mAlpha})`;
                ctx.lineWidth = 1.4;
                ctx.stroke();
              }
            }
          }

          // 5. UPDATE & DRAW DATA COMET PACKETS
          if (enablePulses && !prefersReducedMotion && connections.length > 0) {
            const packets = packetsRef.current;

            if (Math.random() < preset.pulseFrequency && packets.filter(p => p.active).length < preset.maxPackets) {
              const trunkAndBranches = connections.filter(c => c.tier === 'TRUNK' || c.tier === 'BRANCH');
              const chosenConn = (trunkAndBranches.length > 0 ? trunkAndBranches : connections)[
                Math.floor(Math.random() * (trunkAndBranches.length > 0 ? trunkAndBranches.length : connections.length))
              ];

              const available = packets.find(p => !p.active);
              const pColor = isDark ? '#A7F3D0' : '#047857';

              if (available) {
                available.active = true;
                available.source = chosenConn.source;
                available.target = chosenConn.target;
                available.progress = 0;
                available.speed = Math.random() * 0.018 + 0.024;
                available.color = pColor;
                available.headRadius = isDark ? 3.4 : 3.0;
                available.length = 0.24;
              } else if (packets.length < preset.maxPackets) {
                packets.push({
                  active: true,
                  source: chosenConn.source,
                  target: chosenConn.target,
                  progress: 0,
                  speed: Math.random() * 0.018 + 0.024,
                  color: pColor,
                  headRadius: isDark ? 3.4 : 3.0,
                  length: 0.24,
                });
              }
            }

            for (let p = 0; p < packets.length; p++) {
              const pkt = packets[p];
              if (!pkt.active) continue;

              pkt.progress += pkt.speed;
              if (pkt.progress >= 1.0) {
                pkt.active = false;
                if (nodes[pkt.target]) {
                  nodes[pkt.target].activity = 1.0;
                }
                continue;
              }

              const src = nodes[pkt.source];
              const tgt = nodes[pkt.target];
              if (!src || !tgt) {
                pkt.active = false;
                continue;
              }

              const headX = src.x + (tgt.x - src.x) * pkt.progress;
              const headY = src.y + (tgt.y - src.y) * pkt.progress;
              const tailProgress = Math.max(0, pkt.progress - pkt.length);
              const tailX = src.x + (tgt.x - src.x) * tailProgress;
              const tailY = src.y + (tgt.y - src.y) * tailProgress;

              const packetVisibility = Math.sin(pkt.progress * Math.PI);

              const grad = ctx.createLinearGradient(tailX, tailY, headX, headY);
              grad.addColorStop(0, 'rgba(16, 185, 129, 0)');
              grad.addColorStop(0.7, `${theme.trunkLine}${(packetVisibility * (isDark ? 0.7 : 0.5)).toFixed(3)})`);
              grad.addColorStop(1, pkt.color);

              ctx.beginPath();
              ctx.moveTo(tailX, tailY);
              ctx.lineTo(headX, headY);
              ctx.strokeStyle = grad;
              ctx.lineWidth = isDark ? 2.6 : 2.2;
              ctx.stroke();

              ctx.beginPath();
              ctx.arc(headX, headY, pkt.headRadius, 0, Math.PI * 2);
              ctx.fillStyle = pkt.color;
              ctx.shadowColor = pkt.color;
              ctx.shadowBlur = isDark ? 12 : 6;
              ctx.globalAlpha = packetVisibility;
              ctx.fill();
              ctx.globalAlpha = 1.0;
              ctx.shadowBlur = 0;
            }
          }

          // 6. UPDATE & DRAW SIGNAL WAVES
          if (enableRipples && !prefersReducedMotion) {
            const waves = wavesRef.current;
            for (let w = 0; w < waves.length; w++) {
              const wave = waves[w];
              if (!wave.active) continue;

              wave.radius += wave.speed;
              wave.intensity *= 0.965;

              if (wave.radius >= wave.maxRadius || wave.intensity <= 0.02) {
                wave.active = false;
                continue;
              }

              ctx.beginPath();
              ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
              ctx.strokeStyle = `${theme.waveColor}${(wave.intensity * 0.55).toFixed(3)})`;
              ctx.lineWidth = 1.8;
              ctx.stroke();

              ctx.beginPath();
              ctx.arc(wave.x, wave.y, Math.max(1, wave.radius - 12), 0, Math.PI * 2);
              ctx.strokeStyle = `${theme.waveColor}${(wave.intensity * 0.3).toFixed(3)})`;
              ctx.lineWidth = 1.0;
              ctx.stroke();
            }
          }

          // 7. DRAW NODES
          for (let i = 0; i < nodeCount; i++) {
            const n = nodes[i];
            const nodeAlpha = (0.8 + n.activity * 0.2) * n.depth;

            // CORE NODES
            if (n.tier === 'CORE' && !prefersReducedMotion) {
              const haloSize = 32 + Math.sin(time * 2.2 + n.phase) * 7 + (n.activity * 18) + (n.haloPulse * 22);
              const haloGrad = ctx.createRadialGradient(n.x, n.y, 2, n.x, n.y, haloSize);
              haloGrad.addColorStop(0, isDark ? 'rgba(16, 185, 129, 0.4)' : 'rgba(4, 120, 87, 0.3)');
              haloGrad.addColorStop(0.5, isDark ? 'rgba(6, 182, 212, 0.18)' : 'rgba(14, 116, 144, 0.12)');
              haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

              ctx.beginPath();
              ctx.arc(n.x, n.y, haloSize, 0, Math.PI * 2);
              ctx.fillStyle = haloGrad;
              ctx.fill();

              const orbitRadius = n.radius + 6.0 + Math.sin(time * 1.8 + n.phase) * 1.5;
              ctx.beginPath();
              ctx.arc(n.x, n.y, orbitRadius, 0, Math.PI * 2);
              ctx.strokeStyle = `${theme.trunkLine}${(0.4 + n.activity * 0.45).toFixed(3)})`;
              ctx.lineWidth = 1.2;
              ctx.stroke();
            }

            // HUB NODES
            if (n.tier === 'HUB' && !prefersReducedMotion) {
              const hubRingRadius = n.radius + 4.2 + Math.sin(time * 2.5 + n.phase) * 1.2;
              ctx.beginPath();
              ctx.arc(n.x, n.y, hubRingRadius, 0, Math.PI * 2);
              ctx.strokeStyle = `${theme.branchLine}${(0.3 + n.activity * 0.4).toFixed(3)})`;
              ctx.lineWidth = 1.0;
              ctx.stroke();
            }

            // MAIN NODE BODY
            const currentRadius = n.radius + (n.activity * 1.2);
            ctx.beginPath();
            ctx.arc(n.x, n.y, currentRadius, 0, Math.PI * 2);
            ctx.fillStyle = n.color;
            ctx.shadowColor = n.color;
            ctx.shadowBlur = isDark ? (n.tier === 'CORE' ? 16 : n.tier === 'HUB' ? 10 : 6) : 4;
            ctx.globalAlpha = nodeAlpha;
            ctx.fill();
            ctx.globalAlpha = 1.0;
            ctx.shadowBlur = 0;

            // CORE CENTER DOT
            if (n.tier === 'CORE' || n.tier === 'HUB') {
              ctx.beginPath();
              ctx.arc(n.x, n.y, n.tier === 'CORE' ? 2.2 : 1.5, 0, Math.PI * 2);
              ctx.fillStyle = n.coreColor;
              ctx.fill();
            }
          }

          ctx.restore();
        }

        animationFrameId = requestAnimationFrame(render);
      };

      render();

      return () => {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseleave', handleMouseLeave);
        window.removeEventListener('click', handleClick);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }, [
      maxDistance,
      gravityRadius,
      gravityStrength,
      springStrength,
      damping,
      isDark,
      enablePulses,
      enableRipples,
      enableMouseInteraction,
      variant,
    ]);

    return (
      <canvas
        ref={canvasRef}
        className={className}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    );
  }
);

InteractiveGravityMesh.displayName = 'InteractiveGravityMesh';
