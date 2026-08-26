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

type NodeType = 'HUB' | 'RELAY' | 'EDGE';

interface Node {
  x: number;
  y: number;
  originX: number;
  originY: number;
  vx: number;
  vy: number;
  radius: number;
  type: NodeType;
  color: string;
  glowColor: string;
  phase: number;
  driftSpeed: number;
  depth: number;
  activity: number;
}

interface Connection {
  source: number;
  target: number;
  distSq: number;
  dist: number;
}

interface DataPulse {
  active: boolean;
  source: number;
  target: number;
  progress: number;
  speed: number;
  color: string;
}

interface Ripple {
  active: boolean;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  intensity: number;
  speed: number;
}

// Preset visual configurations
const PRESETS: Record<MeshVariant, {
  particleCount: number;
  maxDistance: number;
  gravityRadius: number;
  gravityStrength: number;
  springStrength: number;
  damping: number;
  pulseFrequency: number; // probability per frame
  maxPulses: number;
  lineAlphaMultiplier: number;
}> = {
  premium: {
    particleCount: 65,
    maxDistance: 140,
    gravityRadius: 170,
    gravityStrength: 24,
    springStrength: 0.028,
    damping: 0.88,
    pulseFrequency: 0.02,
    maxPulses: 5,
    lineAlphaMultiplier: 1.0,
  },
  admin: {
    particleCount: 72,
    maxDistance: 145,
    gravityRadius: 180,
    gravityStrength: 26,
    springStrength: 0.03,
    damping: 0.89,
    pulseFrequency: 0.025,
    maxPulses: 6,
    lineAlphaMultiplier: 1.1,
  },
  client: {
    particleCount: 60,
    maxDistance: 135,
    gravityRadius: 160,
    gravityStrength: 22,
    springStrength: 0.026,
    damping: 0.88,
    pulseFrequency: 0.018,
    maxPulses: 4,
    lineAlphaMultiplier: 0.95,
  },
  login: {
    particleCount: 50,
    maxDistance: 130,
    gravityRadius: 160,
    gravityStrength: 20,
    springStrength: 0.025,
    damping: 0.87,
    pulseFrequency: 0.012,
    maxPulses: 3,
    lineAlphaMultiplier: 0.85,
  },
  analytics: {
    particleCount: 75,
    maxDistance: 150,
    gravityRadius: 190,
    gravityStrength: 28,
    springStrength: 0.032,
    damping: 0.9,
    pulseFrequency: 0.04,
    maxPulses: 8,
    lineAlphaMultiplier: 1.2,
  },
  minimal: {
    particleCount: 35,
    maxDistance: 110,
    gravityRadius: 130,
    gravityStrength: 15,
    springStrength: 0.022,
    damping: 0.85,
    pulseFrequency: 0.005,
    maxPulses: 2,
    lineAlphaMultiplier: 0.7,
  },
};

export const InteractiveGravityMesh = forwardRef<InteractiveGravityMeshRef, InteractiveGravityMeshProps>(
  (
    {
      variant = 'premium',
      particleCount: propParticleCount,
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

    // Resolved configuration parameters
    const particleCount = propParticleCount ?? preset.particleCount;
    const maxDistance = propMaxDistance ?? preset.maxDistance;
    const gravityRadius = propGravityRadius ?? preset.gravityRadius;
    const gravityStrength = propGravityStrength ?? preset.gravityStrength;
    const springStrength = propSpringStrength ?? preset.springStrength;
    const damping = propDamping ?? preset.damping;

    // References to mutable simulation state for max 60FPS loop performance
    const nodesRef = useRef<Node[]>([]);
    const connectionsRef = useRef<Connection[]>([]);
    const pulsesRef = useRef<DataPulse[]>([]);
    const ripplesRef = useRef<Ripple[]>([]);
    const mouseRef = useRef({
      x: -2000,
      y: -2000,
      targetX: -2000,
      targetY: -2000,
      isActive: false,
    });

    // Expose Imperative Event API
    useImperativeHandle(ref, () => ({
      triggerPulse: (sourceIdx, targetIdx) => {
        const nodes = nodesRef.current;
        const conns = connectionsRef.current;
        if (nodes.length < 2 || conns.length === 0) return;

        let src = sourceIdx ?? -1;
        let tgt = targetIdx ?? -1;

        if (src === -1 || tgt === -1) {
          const randConn = conns[Math.floor(Math.random() * conns.length)];
          src = randConn.source;
          tgt = randConn.target;
        }

        const pulses = pulsesRef.current;
        const available = pulses.find(p => !p.active);
        const pulseColor = isDark ? '#67E8F9' : '#0D9488';

        if (available) {
          available.active = true;
          available.source = src;
          available.target = tgt;
          available.progress = 0;
          available.speed = Math.random() * 0.02 + 0.025;
          available.color = pulseColor;
        } else if (pulses.length < preset.maxPulses * 2) {
          pulses.push({
            active: true,
            source: src,
            target: tgt,
            progress: 0,
            speed: Math.random() * 0.02 + 0.025,
            color: pulseColor,
          });
        }
      },
      triggerRipple: (x, y) => {
        const ripples = ripplesRef.current;
        const available = ripples.find(r => !r.active);
        if (available) {
          available.active = true;
          available.x = x;
          available.y = y;
          available.radius = 5;
          available.maxRadius = 160;
          available.intensity = 1.0;
          available.speed = 3.5;
        } else if (ripples.length < 6) {
          ripples.push({
            active: true,
            x,
            y,
            radius: 5,
            maxRadius: 160,
            intensity: 1.0,
            speed: 3.5,
          });
        }
      },
      emitEvent: (event) => {
        // Boost activity on random hub nodes when meaningful events occur
        const nodes = nodesRef.current;
        const hubs = nodes.filter(n => n.type === 'HUB');
        if (hubs.length > 0) {
          const randomHub = hubs[Math.floor(Math.random() * hubs.length)];
          randomHub.activity = 1.0;
          randomHub.vx += (Math.random() - 0.5) * 2;
          randomHub.vy += (Math.random() - 0.5) * 2;
        }
        if (event.type === 'message_sent' || event.type === 'api_request') {
          // Trigger swift data packet
          const conns = connectionsRef.current;
          if (conns.length > 0) {
            const randConn = conns[Math.floor(Math.random() * conns.length)];
            const pulses = pulsesRef.current;
            const available = pulses.find(p => !p.active);
            if (available) {
              available.active = true;
              available.source = randConn.source;
              available.target = randConn.target;
              available.progress = 0;
              available.speed = 0.04;
              available.color = isDark ? '#A7F3D0' : '#059669';
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

      // Check reduced motion accessibility
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // Color Palette for Living API Network
      const darkPalette = {
        hub: '#10B981',        // Authority Emerald Gateway
        relay: '#14B8A6',      // Teal Router Node
        edge: '#06B6D4',       // Cyan Endpoint Node
        hubGlow: 'rgba(16, 185, 129, 0.4)',
        relayGlow: 'rgba(20, 184, 166, 0.25)',
        edgeGlow: 'rgba(6, 182, 212, 0.2)',
        lineBase: 'rgba(16, 185, 129, ',
        lineHub: 'rgba(6, 182, 212, ',
        mouseLine: 'rgba(52, 211, 153, ',
        ripple: 'rgba(16, 185, 129, ',
      };

      const lightPalette = {
        hub: '#059669',
        relay: '#0D9488',
        edge: '#0284C7',
        hubGlow: 'rgba(5, 150, 105, 0.25)',
        relayGlow: 'rgba(13, 148, 136, 0.15)',
        edgeGlow: 'rgba(2, 132, 199, 0.15)',
        lineBase: 'rgba(5, 150, 105, ',
        lineHub: 'rgba(13, 148, 136, ',
        mouseLine: 'rgba(13, 148, 136, ',
        ripple: 'rgba(5, 150, 105, ',
      };

      const theme = isDark ? darkPalette : lightPalette;

      // Initialize Pseudo-Organic Node Hierarchy
      const initNodes = () => {
        let count = particleCount;
        if (width < 640) {
          count = Math.max(18, Math.floor(particleCount * 0.35));
        } else if (width < 1024) {
          count = Math.max(30, Math.floor(particleCount * 0.65));
        }

        const nodes: Node[] = [];
        const hubCount = Math.max(2, Math.floor(count * 0.14));
        const relayCount = Math.max(4, Math.floor(count * 0.36));

        // Spatial Cluster Distribution (simulating regional datacenter clusters)
        const clusterCenters = [
          { x: width * 0.22, y: height * 0.35 },
          { x: width * 0.78, y: height * 0.4 },
          { x: width * 0.5, y: height * 0.75 },
          { x: width * 0.82, y: height * 0.8 },
          { x: width * 0.18, y: height * 0.82 },
        ];

        for (let i = 0; i < count; i++) {
          const type: NodeType = i < hubCount ? 'HUB' : i < hubCount + relayCount ? 'RELAY' : 'EDGE';
          const cluster = clusterCenters[i % clusterCenters.length];
          const clusterRadius = Math.min(width, height) * 0.26;

          // Clustered organic positioning
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.pow(Math.random(), 0.75) * clusterRadius;
          const x = Math.max(20, Math.min(width - 20, cluster.x + Math.cos(angle) * dist + (Math.random() - 0.5) * 80));
          const y = Math.max(20, Math.min(height - 20, cluster.y + Math.sin(angle) * dist + (Math.random() - 0.5) * 80));

          let radius = 1.6;
          let color = theme.edge;
          let glowColor = theme.edgeGlow;
          let depth = Math.random() * 0.5 + 0.5;

          if (type === 'HUB') {
            radius = isDark ? 3.6 : 3.2;
            color = theme.hub;
            glowColor = theme.hubGlow;
            depth = 1.0;
          } else if (type === 'RELAY') {
            radius = isDark ? 2.4 : 2.2;
            color = theme.relay;
            glowColor = theme.relayGlow;
            depth = 0.85;
          }

          nodes.push({
            x,
            y,
            originX: x,
            originY: y,
            vx: 0,
            vy: 0,
            radius,
            type,
            color,
            glowColor,
            phase: Math.random() * Math.PI * 2,
            driftSpeed: Math.random() * 0.015 + 0.008,
            depth,
            activity: 0,
          });
        }

        nodesRef.current = nodes;
        pulsesRef.current = [];
        ripplesRef.current = [];
      };

      // High-DPI Canvas Buffer scaling (Capped at DPR 2 for optimal battery and performance)
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
        initNodes();
      };

      handleResize();

      // Window Event Listeners for global seamless interactivity
      const handleMouseMove = (e: MouseEvent) => {
        if (!enableMouseInteraction) return;
        const rect = canvas.getBoundingClientRect();
        mouseRef.current.targetX = e.clientX - rect.left;
        mouseRef.current.targetY = e.clientY - rect.top;
        mouseRef.current.isActive = true;
      };

      const handleMouseLeave = () => {
        mouseRef.current.isActive = false;
        mouseRef.current.targetX = -2000;
        mouseRef.current.targetY = -2000;
      };

      const handleClick = (e: MouseEvent) => {
        if (!enableRipples || prefersReducedMotion) return;
        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        const ripples = ripplesRef.current;
        const available = ripples.find(r => !r.active);
        if (available) {
          available.active = true;
          available.x = clickX;
          available.y = clickY;
          available.radius = 5;
          available.maxRadius = 150;
          available.intensity = 0.9;
          available.speed = 3.2;
        } else if (ripples.length < 6) {
          ripples.push({
            active: true,
            x: clickX,
            y: clickY,
            radius: 5,
            maxRadius: 150,
            intensity: 0.9,
            speed: 3.2,
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
        mouseRef.current.targetX = -2000;
        mouseRef.current.targetY = -2000;
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

      // Master 60FPS Render & Physics Loop
      const render = () => {
        if (!isPaused) {
          time += 0.015;

          const mouse = mouseRef.current;
          mouse.x += (mouse.targetX - mouse.x) * 0.18;
          mouse.y += (mouse.targetY - mouse.y) * 0.18;

          ctx.clearRect(0, 0, width, height);

          const nodes = nodesRef.current;
          const nodeCount = nodes.length;

          // 1. UPDATE NODES PHYSICS
          for (let i = 0; i < nodeCount; i++) {
            const n = nodes[i];

            // Harmonic gentle idle oscillation
            n.phase += n.driftSpeed;
            const idleX = prefersReducedMotion ? 0 : Math.cos(n.phase * 0.7 + time * 0.8) * 0.4 * n.depth;
            const idleY = prefersReducedMotion ? 0 : Math.sin(n.phase + time) * 0.6 * n.depth;

            // Decay temporary activity
            if (n.activity > 0) {
              n.activity = Math.max(0, n.activity - 0.015);
            }

            // Mouse Gravitational / Elastic Interaction
            if (mouse.isActive && !prefersReducedMotion) {
              const dx = mouse.x - n.x;
              const dy = mouse.y - n.y;
              const distSq = dx * dx + dy * dy;

              if (distSq < gravRadSq && distSq > 0) {
                const dist = Math.sqrt(distSq);
                const proximityRatio = 1 - dist / gravityRadius;
                const force = proximityRatio * proximityRatio * gravityStrength * (n.type === 'HUB' ? 0.6 : 1.0);
                const angle = Math.atan2(dy, dx);

                // Subtle repulsion with damping
                n.vx -= Math.cos(angle) * force * 0.08;
                n.vy -= Math.sin(angle) * force * 0.08;
                n.activity = Math.max(n.activity, proximityRatio * 0.8);
              }
            }

            // Ripples Signal Propagation
            const ripples = ripplesRef.current;
            for (let r = 0; r < ripples.length; r++) {
              const rip = ripples[r];
              if (!rip.active) continue;

              const rdx = n.x - rip.x;
              const rdy = n.y - rip.y;
              const rDist = Math.sqrt(rdx * rdx + rdy * rdy);
              const waveDist = Math.abs(rDist - rip.radius);

              if (waveDist < 25) {
                const waveForce = (1 - waveDist / 25) * rip.intensity * 2.2;
                const waveAngle = Math.atan2(rdy, rdx);
                n.vx += Math.cos(waveAngle) * waveForce * 0.15;
                n.vy += Math.sin(waveAngle) * waveForce * 0.15;
                n.activity = Math.max(n.activity, rip.intensity * 0.7);
              }
            }

            // Spring + Damping Return Force
            const springX = (n.originX + idleX - n.x) * springStrength;
            const springY = (n.originY + idleY - n.y) * springStrength;

            n.vx = (n.vx + springX) * damping;
            n.vy = (n.vy + springY) * damping;

            n.x += n.vx;
            n.y += n.vy;
          }

          // 2. COMPUTE CONNECTIONS GRAPH
          const validConnections: Connection[] = [];
          const maxConnectionsPerNode = 4;
          const nodeConnectionCounts = new Uint8Array(nodeCount);

          for (let i = 0; i < nodeCount; i++) {
            if (nodeConnectionCounts[i] >= maxConnectionsPerNode) continue;

            for (let j = i + 1; j < nodeCount; j++) {
              if (nodeConnectionCounts[j] >= maxConnectionsPerNode) continue;

              const n1 = nodes[i];
              const n2 = nodes[j];
              const dx = n1.x - n2.x;
              const dy = n1.y - n2.y;
              const distSq = dx * dx + dy * dy;

              if (distSq < maxDistSq) {
                const dist = Math.sqrt(distSq);
                validConnections.push({
                  source: i,
                  target: j,
                  distSq,
                  dist,
                });
                nodeConnectionCounts[i]++;
                nodeConnectionCounts[j]++;
                if (nodeConnectionCounts[i] >= maxConnectionsPerNode) break;
              }
            }
          }

          connectionsRef.current = validConnections;

          // 3. DRAW CONNECTIONS
          const baseAlpha = (isDark ? 0.18 : 0.12) * preset.lineAlphaMultiplier;

          for (let c = 0; c < validConnections.length; c++) {
            const conn = validConnections[c];
            const p1 = nodes[conn.source];
            const p2 = nodes[conn.target];

            const distanceFactor = 1 - conn.dist / maxDistance;
            const activityBoost = Math.max(p1.activity, p2.activity) * 0.35;
            const alpha = (distanceFactor * baseAlpha + activityBoost).toFixed(3);

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);

            if (p1.type === 'HUB' || p2.type === 'HUB') {
              ctx.strokeStyle = `${theme.lineHub}${alpha})`;
              ctx.lineWidth = isDark ? 0.95 : 0.85;
            } else {
              ctx.strokeStyle = `${theme.lineBase}${alpha})`;
              ctx.lineWidth = isDark ? 0.75 : 0.65;
            }
            ctx.stroke();
          }

          // 4. DRAW MOUSE INTERACTION FILAMENTS
          if (mouse.isActive && !prefersReducedMotion) {
            for (let i = 0; i < nodeCount; i++) {
              const n = nodes[i];
              const mdx = mouse.x - n.x;
              const mdy = mouse.y - n.y;
              const mDistSq = mdx * mdx + mdy * mdy;

              if (mDistSq < gravRadSq) {
                const mDist = Math.sqrt(mDistSq);
                const mAlpha = ((1 - mDist / gravityRadius) * (isDark ? 0.32 : 0.22)).toFixed(3);

                ctx.beginPath();
                ctx.moveTo(mouse.x, mouse.y);
                ctx.lineTo(n.x, n.y);
                ctx.strokeStyle = `${theme.mouseLine}${mAlpha})`;
                ctx.lineWidth = 1.1;
                ctx.stroke();
              }
            }
          }

          // 5. UPDATE & DRAW DATA PULSES (LIVING API TRAFFIC)
          if (enablePulses && !prefersReducedMotion && validConnections.length > 0) {
            const pulses = pulsesRef.current;

            // Occasional discrete autonomous pulse generation
            if (Math.random() < preset.pulseFrequency && pulses.filter(p => p.active).length < preset.maxPulses) {
              const randConn = validConnections[Math.floor(Math.random() * validConnections.length)];
              const available = pulses.find(p => !p.active);
              const pulseColor = isDark ? '#A7F3D0' : '#0D9488';

              if (available) {
                available.active = true;
                available.source = randConn.source;
                available.target = randConn.target;
                available.progress = 0;
                available.speed = Math.random() * 0.02 + 0.022;
                available.color = pulseColor;
              } else if (pulses.length < preset.maxPulses) {
                pulses.push({
                  active: true,
                  source: randConn.source,
                  target: randConn.target,
                  progress: 0,
                  speed: Math.random() * 0.02 + 0.022,
                  color: pulseColor,
                });
              }
            }

            for (let p = 0; p < pulses.length; p++) {
              const pulse = pulses[p];
              if (!pulse.active) continue;

              pulse.progress += pulse.speed;
              if (pulse.progress >= 1.0) {
                pulse.active = false;
                continue;
              }

              const src = nodes[pulse.source];
              const tgt = nodes[pulse.target];
              if (!src || !tgt) {
                pulse.active = false;
                continue;
              }

              const currX = src.x + (tgt.x - src.x) * pulse.progress;
              const currY = src.y + (tgt.y - src.y) * pulse.progress;
              const pulseAlpha = Math.sin(pulse.progress * Math.PI);

              // Draw Data Packet Glow Node
              ctx.beginPath();
              ctx.arc(currX, currY, isDark ? 2.2 : 1.8, 0, Math.PI * 2);
              ctx.fillStyle = pulse.color;
              ctx.shadowColor = pulse.color;
              ctx.shadowBlur = isDark ? 6 : 3;
              ctx.globalAlpha = pulseAlpha * (isDark ? 0.9 : 0.7);
              ctx.fill();
              ctx.globalAlpha = 1.0;
              ctx.shadowBlur = 0;
            }
          }

          // 6. UPDATE & DRAW RIPPLES (SIGNAL PROPAGATION)
          if (enableRipples && !prefersReducedMotion) {
            const ripples = ripplesRef.current;
            for (let r = 0; r < ripples.length; r++) {
              const rip = ripples[r];
              if (!rip.active) continue;

              rip.radius += rip.speed;
              rip.intensity *= 0.96;

              if (rip.radius >= rip.maxRadius || rip.intensity <= 0.03) {
                rip.active = false;
                continue;
              }

              ctx.beginPath();
              ctx.arc(rip.x, rip.y, rip.radius, 0, Math.PI * 2);
              ctx.strokeStyle = `${theme.ripple}${rip.intensity * 0.4})`;
              ctx.lineWidth = 1.2;
              ctx.stroke();
            }
          }

          // 7. DRAW NODES (HIERARCHY WITH GLOW & SUBTLE HALO)
          for (let i = 0; i < nodeCount; i++) {
            const n = nodes[i];
            const nodeAlpha = (0.7 + n.activity * 0.3) * n.depth;

            // Hub Pulsing Ring
            if (n.type === 'HUB' && !prefersReducedMotion) {
              const ringRadius = n.radius + 3 + Math.sin(time * 2 + n.phase) * 1.5;
              ctx.beginPath();
              ctx.arc(n.x, n.y, ringRadius, 0, Math.PI * 2);
              ctx.strokeStyle = `${theme.lineHub}${0.18 + n.activity * 0.3})`;
              ctx.lineWidth = 0.8;
              ctx.stroke();
            }

            // Node Core
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.radius + (n.activity * 0.8), 0, Math.PI * 2);
            ctx.fillStyle = n.color;
            ctx.shadowColor = n.glowColor;
            ctx.shadowBlur = isDark ? (n.type === 'HUB' ? 10 : 5) : 3;
            ctx.globalAlpha = nodeAlpha;
            ctx.fill();
            ctx.globalAlpha = 1.0;
            ctx.shadowBlur = 0;
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
      particleCount,
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
