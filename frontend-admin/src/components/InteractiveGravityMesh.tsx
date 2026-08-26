import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

export type MeshVariant = 'admin' | 'client' | 'login' | 'minimal' | 'analytics' | 'premium';

export interface InteractiveGravityMeshProps {
  variant?: MeshVariant;
  particleCount?: number;
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

// Preset visual configurations for Living API Network
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
    coreCount: 3,
    hubCount: 7,
    relayCount: 16,
    edgeCount: 28,
    maxDistance: 160,
    gravityRadius: 200,
    gravityStrength: 32,
    springStrength: 0.032,
    damping: 0.88,
    pulseFrequency: 0.035,
    maxPackets: 6,
    trunkOpacity: 0.55,
    branchOpacity: 0.35,
    feederOpacity: 0.2,
  },
  admin: {
    coreCount: 4,
    hubCount: 8,
    relayCount: 20,
    edgeCount: 32,
    maxDistance: 170,
    gravityRadius: 220,
    gravityStrength: 36,
    springStrength: 0.035,
    damping: 0.89,
    pulseFrequency: 0.045,
    maxPackets: 8,
    trunkOpacity: 0.65,
    branchOpacity: 0.42,
    feederOpacity: 0.24,
  },
  client: {
    coreCount: 3,
    hubCount: 6,
    relayCount: 14,
    edgeCount: 24,
    maxDistance: 155,
    gravityRadius: 190,
    gravityStrength: 28,
    springStrength: 0.03,
    damping: 0.88,
    pulseFrequency: 0.03,
    maxPackets: 5,
    trunkOpacity: 0.5,
    branchOpacity: 0.32,
    feederOpacity: 0.18,
  },
  login: {
    coreCount: 3,
    hubCount: 6,
    relayCount: 12,
    edgeCount: 22,
    maxDistance: 150,
    gravityRadius: 180,
    gravityStrength: 25,
    springStrength: 0.028,
    damping: 0.87,
    pulseFrequency: 0.025,
    maxPackets: 4,
    trunkOpacity: 0.45,
    branchOpacity: 0.28,
    feederOpacity: 0.16,
  },
  analytics: {
    coreCount: 5,
    hubCount: 10,
    relayCount: 24,
    edgeCount: 36,
    maxDistance: 180,
    gravityRadius: 230,
    gravityStrength: 38,
    springStrength: 0.038,
    damping: 0.9,
    pulseFrequency: 0.06,
    maxPackets: 10,
    trunkOpacity: 0.7,
    branchOpacity: 0.48,
    feederOpacity: 0.28,
  },
  minimal: {
    coreCount: 2,
    hubCount: 4,
    relayCount: 8,
    edgeCount: 14,
    maxDistance: 130,
    gravityRadius: 150,
    gravityStrength: 20,
    springStrength: 0.024,
    damping: 0.86,
    pulseFrequency: 0.015,
    maxPackets: 3,
    trunkOpacity: 0.35,
    branchOpacity: 0.2,
    feederOpacity: 0.12,
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

    // Imperative Event API
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
      let width = (canvas.width = window.innerWidth);
      let height = (canvas.height = window.innerHeight);

      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // Master Color Palettes (Living API Network Identity)
      const darkPalette = {
        core: '#10B981',           // Emerald Core
        coreInner: '#FFFFFF',      // White Core Center
        hub: '#06B6D4',            // Electric Cyan Gateway
        relay: '#14B8A6',          // Teal Microservice
        edge: '#34D399',           // Mint Satellite
        coreHalo: 'rgba(16, 185, 129, 0.35)',
        hubHalo: 'rgba(6, 182, 212, 0.25)',
        relayHalo: 'rgba(20, 184, 166, 0.18)',
        edgeHalo: 'rgba(52, 211, 153, 0.12)',
        trunkLine: 'rgba(16, 185, 129, ',
        branchLine: 'rgba(6, 182, 212, ',
        feederLine: 'rgba(20, 184, 166, ',
        mouseFilament: 'rgba(103, 232, 249, ',
        packetColor: '#A7F3D0',
        waveColor: 'rgba(52, 211, 153, ',
      };

      const lightPalette = {
        core: '#047857',           // Deep Emerald Core
        coreInner: '#ECFDF5',      // Soft Mint Center
        hub: '#0E7490',            // Deep Cyan Gateway
        relay: '#0F766E',          // Deep Teal Router
        edge: '#059669',           // Vibrant Emerald Satellite
        coreHalo: 'rgba(4, 120, 87, 0.2)',
        hubHalo: 'rgba(14, 116, 144, 0.15)',
        relayHalo: 'rgba(15, 118, 110, 0.12)',
        edgeHalo: 'rgba(5, 150, 105, 0.08)',
        trunkLine: 'rgba(4, 120, 87, ',
        branchLine: 'rgba(14, 116, 144, ',
        feederLine: 'rgba(15, 118, 110, ',
        mouseFilament: 'rgba(14, 116, 144, ',
        packetColor: '#047857',
        waveColor: 'rgba(4, 120, 87, ',
      };

      const theme = isDark ? darkPalette : lightPalette;

      // Topological Network Generation (Intentional Visual Architecture)
      const initNetworkTopology = () => {
        const isMobile = width < 640;
        const isTablet = width >= 640 && width < 1024;

        const coreCount = isMobile ? 2 : preset.coreCount;
        const hubCount = isMobile ? 4 : isTablet ? 5 : preset.hubCount;
        const relayCount = isMobile ? 8 : isTablet ? 12 : preset.relayCount;
        const edgeCount = isMobile ? 12 : isTablet ? 18 : preset.edgeCount;

        const nodes: NetworkNode[] = [];
        let idCounter = 0;

        // 1. ANCHOR CORES (Strategic Topological Anchors across the screen)
        const corePositions = [
          { x: width * 0.20, y: height * 0.32 }, // Hero Showcase Focus
          { x: width * 0.82, y: height * 0.38 }, // Right Header Gateway
          { x: width * 0.52, y: height * 0.76 }, // Center Lower Cluster
          { x: width * 0.15, y: height * 0.80 }, // Lower Left Hub
          { x: width * 0.88, y: height * 0.82 }, // Lower Right Hub
        ];

        for (let i = 0; i < coreCount; i++) {
          const pos = corePositions[i % corePositions.length];
          const x = pos.x + (Math.random() - 0.5) * 40;
          const y = pos.y + (Math.random() - 0.5) * 40;

          nodes.push({
            id: idCounter++,
            x,
            y,
            originX: x,
            originY: y,
            vx: 0,
            vy: 0,
            radius: isDark ? 5.2 : 4.6,
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

        // 2. HUBS (Surrounding each Core)
        for (let i = 0; i < hubCount; i++) {
          const parentCore = nodes[i % coreCount];
          const angle = (i * 1.3) + Math.random() * 0.8;
          const dist = 110 + Math.random() * 90;
          const x = Math.max(30, Math.min(width - 30, parentCore.originX + Math.cos(angle) * dist));
          const y = Math.max(30, Math.min(height - 30, parentCore.originY + Math.sin(angle) * dist));

          nodes.push({
            id: idCounter++,
            x,
            y,
            originX: x,
            originY: y,
            vx: 0,
            vy: 0,
            radius: isDark ? 3.8 : 3.4,
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

        // 3. RELAYS (Intermediate Routing Links)
        const hubsAndCores = nodes.filter(n => n.tier === 'CORE' || n.tier === 'HUB');
        for (let i = 0; i < relayCount; i++) {
          const parent = hubsAndCores[i % hubsAndCores.length];
          const angle = Math.random() * Math.PI * 2;
          const dist = 80 + Math.random() * 80;
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
            radius: isDark ? 2.8 : 2.5,
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

        // 4. EDGES (Satellite Client Endpoints)
        const allUpperNodes = nodes.filter(n => n.tier !== 'EDGE');
        for (let i = 0; i < edgeCount; i++) {
          const parent = allUpperNodes[i % allUpperNodes.length];
          const angle = Math.random() * Math.PI * 2;
          const dist = 60 + Math.random() * 95;
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
            radius: isDark ? 1.9 : 1.7,
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

      // DPR Scaler
      const handleResize = () => {
        if (!canvas) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.scale(dpr, dpr);
        initNetworkTopology();
      };

      handleResize();

      // Mouse & Pointer Listeners
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

      // Master 60FPS Render Loop
      const render = () => {
        if (!isPaused) {
          time += 0.015;

          const mouse = mouseRef.current;
          mouse.x += (mouse.targetX - mouse.x) * 0.16;
          mouse.y += (mouse.targetY - mouse.y) * 0.16;

          ctx.clearRect(0, 0, width, height);

          const nodes = nodesRef.current;
          const nodeCount = nodes.length;

          // 1. UPDATE NODES WITH SPRING PHYSICS
          for (let i = 0; i < nodeCount; i++) {
            const n = nodes[i];

            n.phase += n.driftSpeed;
            const idleAmp = n.tier === 'CORE' ? 0.3 : n.tier === 'HUB' ? 0.5 : 0.8;
            const idleX = prefersReducedMotion ? 0 : Math.cos(n.phase * 0.8 + time * 0.7) * idleAmp * n.depth;
            const idleY = prefersReducedMotion ? 0 : Math.sin(n.phase + time) * idleAmp * 1.2 * n.depth;

            // Decay activity and halo pulses
            if (n.activity > 0) n.activity = Math.max(0, n.activity - 0.018);
            if (n.haloPulse > 0) n.haloPulse = Math.max(0, n.haloPulse - 0.014);

            // Mouse Gravitational Elastic Interaction (Magnetic Lens Effect)
            if (mouse.isActive && !prefersReducedMotion) {
              const dx = mouse.x - n.x;
              const dy = mouse.y - n.y;
              const distSq = dx * dx + dy * dy;

              if (distSq < gravRadSq && distSq > 0) {
                const dist = Math.sqrt(distSq);
                const proximityRatio = 1 - dist / gravityRadius;
                // Smooth Cosine easing for organic magnetic deformation
                const easeFactor = Math.cos((dist / gravityRadius) * (Math.PI / 2));
                const massFactor = n.tier === 'CORE' ? 0.4 : n.tier === 'HUB' ? 0.7 : 1.0;
                const force = easeFactor * gravityStrength * massFactor;
                const angle = Math.atan2(dy, dx);

                n.vx -= Math.cos(angle) * force * 0.09;
                n.vy -= Math.sin(angle) * force * 0.09;
                n.activity = Math.max(n.activity, proximityRatio * 0.85);
              }
            }

            // Signal Waves (Click Ripple Perturbation)
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

            // Spring Return Force
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

              // Filter max allowed distance by tier
              let allowedDistSq = maxDistSq;
              if (n1.tier === 'CORE' && n2.tier === 'CORE') allowedDistSq *= 1.4;
              else if (n1.tier === 'CORE' || n2.tier === 'CORE') allowedDistSq *= 1.25;

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

          // 3. DRAW CONNECTION CHANNELS (TRUNKS, BRANCHES, FEEDERS)
          for (let c = 0; c < connections.length; c++) {
            const conn = connections[c];
            const p1 = nodes[conn.source];
            const p2 = nodes[conn.target];

            const distFactor = 1 - conn.dist / (maxDistance * 1.25);
            const actBoost = Math.max(p1.activity, p2.activity) * 0.45;

            if (conn.tier === 'TRUNK') {
              const alpha = Math.min(1.0, distFactor * preset.trunkOpacity + actBoost).toFixed(3);
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.strokeStyle = `${theme.trunkLine}${alpha})`;
              ctx.lineWidth = isDark ? 1.6 : 1.4;
              ctx.stroke();
            } else if (conn.tier === 'BRANCH') {
              const alpha = Math.min(1.0, distFactor * preset.branchOpacity + actBoost).toFixed(3);
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.strokeStyle = `${theme.branchLine}${alpha})`;
              ctx.lineWidth = isDark ? 1.1 : 0.95;
              ctx.stroke();
            } else {
              const alpha = Math.min(1.0, distFactor * preset.feederOpacity + actBoost).toFixed(3);
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.strokeStyle = `${theme.feederLine}${alpha})`;
              ctx.lineWidth = isDark ? 0.8 : 0.7;
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
                const mAlpha = ((1 - mDist / gravityRadius) * (isDark ? 0.45 : 0.3)).toFixed(3);

                ctx.beginPath();
                ctx.moveTo(mouse.x, mouse.y);
                ctx.lineTo(n.x, n.y);
                ctx.strokeStyle = `${theme.mouseFilament}${mAlpha})`;
                ctx.lineWidth = 1.3;
                ctx.stroke();
              }
            }
          }

          // 5. UPDATE & DRAW DATA COMET PACKETS (LIVE API TRAFFIC)
          if (enablePulses && !prefersReducedMotion && connections.length > 0) {
            const packets = packetsRef.current;

            // Spawn autonomous data packets on active trunks and branches
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
                available.headRadius = isDark ? 3.2 : 2.8;
                available.length = 0.22;
              } else if (packets.length < preset.maxPackets) {
                packets.push({
                  active: true,
                  source: chosenConn.source,
                  target: chosenConn.target,
                  progress: 0,
                  speed: Math.random() * 0.018 + 0.024,
                  color: pColor,
                  headRadius: isDark ? 3.2 : 2.8,
                  length: 0.22,
                });
              }
            }

            for (let p = 0; p < packets.length; p++) {
              const pkt = packets[p];
              if (!pkt.active) continue;

              pkt.progress += pkt.speed;
              if (pkt.progress >= 1.0) {
                pkt.active = false;
                // Excite arrival target node
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

              // 5.1 Draw Packet Comet Tail Stream
              const grad = ctx.createLinearGradient(tailX, tailY, headX, headY);
              grad.addColorStop(0, 'rgba(16, 185, 129, 0)');
              grad.addColorStop(0.7, `${theme.trunkLine}${(packetVisibility * (isDark ? 0.6 : 0.4)).toFixed(3)})`);
              grad.addColorStop(1, pkt.color);

              ctx.beginPath();
              ctx.moveTo(tailX, tailY);
              ctx.lineTo(headX, headY);
              ctx.strokeStyle = grad;
              ctx.lineWidth = isDark ? 2.4 : 2.0;
              ctx.stroke();

              // 5.2 Draw Packet Radiant Head
              ctx.beginPath();
              ctx.arc(headX, headY, pkt.headRadius, 0, Math.PI * 2);
              ctx.fillStyle = pkt.color;
              ctx.shadowColor = pkt.color;
              ctx.shadowBlur = isDark ? 10 : 5;
              ctx.globalAlpha = packetVisibility;
              ctx.fill();
              ctx.globalAlpha = 1.0;
              ctx.shadowBlur = 0;
            }
          }

          // 6. UPDATE & DRAW SIGNAL WAVES (CLICK RIPPLE)
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

              // Double concentric wave ring
              ctx.beginPath();
              ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
              ctx.strokeStyle = `${theme.waveColor}${(wave.intensity * 0.5).toFixed(3)})`;
              ctx.lineWidth = 1.6;
              ctx.stroke();

              ctx.beginPath();
              ctx.arc(wave.x, wave.y, Math.max(1, wave.radius - 12), 0, Math.PI * 2);
              ctx.strokeStyle = `${theme.waveColor}${(wave.intensity * 0.25).toFixed(3)})`;
              ctx.lineWidth = 0.9;
              ctx.stroke();
            }
          }

          // 7. DRAW NODES (HIERARCHY WITH RADIANT HALOS & CORES)
          for (let i = 0; i < nodeCount; i++) {
            const n = nodes[i];
            const nodeAlpha = (0.75 + n.activity * 0.25) * n.depth;

            // 7.1 CORE NODES: Atmospheric Breathing Halo & Orbit Ring
            if (n.tier === 'CORE' && !prefersReducedMotion) {
              const haloSize = 28 + Math.sin(time * 2.2 + n.phase) * 6 + (n.activity * 16) + (n.haloPulse * 20);
              const haloGrad = ctx.createRadialGradient(n.x, n.y, 2, n.x, n.y, haloSize);
              haloGrad.addColorStop(0, isDark ? 'rgba(16, 185, 129, 0.35)' : 'rgba(4, 120, 87, 0.25)');
              haloGrad.addColorStop(0.5, isDark ? 'rgba(6, 182, 212, 0.15)' : 'rgba(14, 116, 144, 0.1)');
              haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

              ctx.beginPath();
              ctx.arc(n.x, n.y, haloSize, 0, Math.PI * 2);
              ctx.fillStyle = haloGrad;
              ctx.fill();

              // Orbit tech ring
              const orbitRadius = n.radius + 5.5 + Math.sin(time * 1.8 + n.phase) * 1.5;
              ctx.beginPath();
              ctx.arc(n.x, n.y, orbitRadius, 0, Math.PI * 2);
              ctx.strokeStyle = `${theme.trunkLine}${(0.35 + n.activity * 0.45).toFixed(3)})`;
              ctx.lineWidth = 1.1;
              ctx.stroke();
            }

            // 7.2 HUB NODES: Concentric Ring
            if (n.tier === 'HUB' && !prefersReducedMotion) {
              const hubRingRadius = n.radius + 3.8 + Math.sin(time * 2.5 + n.phase) * 1.0;
              ctx.beginPath();
              ctx.arc(n.x, n.y, hubRingRadius, 0, Math.PI * 2);
              ctx.strokeStyle = `${theme.branchLine}${(0.25 + n.activity * 0.4).toFixed(3)})`;
              ctx.lineWidth = 0.9;
              ctx.stroke();
            }

            // 7.3 MAIN NODE BODY
            const currentRadius = n.radius + (n.activity * 1.0);
            ctx.beginPath();
            ctx.arc(n.x, n.y, currentRadius, 0, Math.PI * 2);
            ctx.fillStyle = n.color;
            ctx.shadowColor = n.color;
            ctx.shadowBlur = isDark ? (n.tier === 'CORE' ? 14 : n.tier === 'HUB' ? 9 : 5) : 3;
            ctx.globalAlpha = nodeAlpha;
            ctx.fill();
            ctx.globalAlpha = 1.0;
            ctx.shadowBlur = 0;

            // 7.4 LUMINOUS CORE CENTER DOT FOR CORE AND HUB NODES
            if (n.tier === 'CORE' || n.tier === 'HUB') {
              ctx.beginPath();
              ctx.arc(n.x, n.y, n.tier === 'CORE' ? 2.0 : 1.4, 0, Math.PI * 2);
              ctx.fillStyle = n.coreColor;
              ctx.fill();
            }
          }
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
        style={{ display: 'block' }}
      />
    );
  }
);

InteractiveGravityMesh.displayName = 'InteractiveGravityMesh';
