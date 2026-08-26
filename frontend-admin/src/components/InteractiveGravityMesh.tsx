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
}

interface NetworkConnection {
  source: number;
  target: number;
  dist: number;
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
  maxPackets: number;
  trunkOpacity: number;
  branchOpacity: number;
  feederOpacity: number;
  speedMultiplier: number;
}> = {
  premium: {
    coreCount: 4,
    hubCount: 8,
    relayCount: 18,
    edgeCount: 30,
    maxDistance: 160,
    maxPackets: 8,
    trunkOpacity: 0.65,
    branchOpacity: 0.42,
    feederOpacity: 0.24,
    speedMultiplier: 1.0,
  },
  admin: {
    coreCount: 5,
    hubCount: 10,
    relayCount: 22,
    edgeCount: 34,
    maxDistance: 170,
    maxPackets: 10,
    trunkOpacity: 0.75,
    branchOpacity: 0.48,
    feederOpacity: 0.28,
    speedMultiplier: 1.1,
  },
  client: {
    coreCount: 4,
    hubCount: 7,
    relayCount: 16,
    edgeCount: 26,
    maxDistance: 155,
    maxPackets: 7,
    trunkOpacity: 0.6,
    branchOpacity: 0.38,
    feederOpacity: 0.22,
    speedMultiplier: 0.95,
  },
  login: {
    coreCount: 4,
    hubCount: 8,
    relayCount: 16,
    edgeCount: 28,
    maxDistance: 160,
    maxPackets: 8,
    trunkOpacity: 0.65,
    branchOpacity: 0.4,
    feederOpacity: 0.24,
    speedMultiplier: 1.0,
  },
  analytics: {
    coreCount: 6,
    hubCount: 12,
    relayCount: 26,
    edgeCount: 38,
    maxDistance: 180,
    maxPackets: 12,
    trunkOpacity: 0.8,
    branchOpacity: 0.52,
    feederOpacity: 0.32,
    speedMultiplier: 1.2,
  },
  minimal: {
    coreCount: 2,
    hubCount: 4,
    relayCount: 10,
    edgeCount: 16,
    maxDistance: 140,
    maxPackets: 4,
    trunkOpacity: 0.45,
    branchOpacity: 0.28,
    feederOpacity: 0.16,
    speedMultiplier: 0.8,
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
    const mouseRef = useRef({
      x: -3000,
      y: -3000,
      targetX: -3000,
      targetY: -3000,
      isActive: false,
    });

    // Imperative Trigger Handlers
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
        const pColor = isDark ? '#34D399' : '#059669';

        if (available) {
          available.active = true;
          available.source = src;
          available.target = tgt;
          available.progress = 0;
          available.speed = 0.035;
          available.color = pColor;
          available.headRadius = 3.4;
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
          available.maxRadius = 240;
          available.intensity = 1.0;
          available.speed = 4.5;
        } else if (waves.length < 6) {
          waves.push({
            active: true,
            x,
            y,
            radius: 10,
            maxRadius: 240,
            intensity: 1.0,
            speed: 4.5,
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

      // Paleta Tecnológica Zaza Click
      const darkPalette = {
        core: '#10B981',           // Emerald Core
        coreInner: '#FFFFFF',      // Pure White Center
        hub: '#06B6D4',            // Electric Cyan Hub
        relay: '#14B8A6',          // Teal Router
        edge: '#34D399',           // Mint Satellite
        coreHalo: 'rgba(16, 185, 129, 0.4)',
        hubHalo: 'rgba(6, 182, 212, 0.25)',
        relayHalo: 'rgba(20, 184, 166, 0.18)',
        trunkLine: 'rgba(16, 185, 129, ',
        branchLine: 'rgba(6, 182, 212, ',
        feederLine: 'rgba(20, 184, 166, ',
        mouseLine: 'rgba(103, 232, 249, ',
        packetColor: '#A7F3D0',
        waveColor: 'rgba(52, 211, 153, ',
      };

      const lightPalette = {
        core: '#047857',           // Deep Emerald Core
        coreInner: '#F0FDF4',      // Soft Mint
        hub: '#0E7490',            // Deep Cyan Hub
        relay: '#0F766E',          // Deep Teal Router
        edge: '#059669',           // Vibrant Emerald Satellite
        coreHalo: 'rgba(4, 120, 87, 0.3)',
        hubHalo: 'rgba(14, 116, 144, 0.2)',
        relayHalo: 'rgba(15, 118, 110, 0.15)',
        trunkLine: 'rgba(4, 120, 87, ',
        branchLine: 'rgba(14, 116, 144, ',
        feederLine: 'rgba(15, 118, 110, ',
        mouseLine: 'rgba(14, 116, 144, ',
        packetColor: '#047857',
        waveColor: 'rgba(4, 120, 87, ',
      };

      const theme = isDark ? darkPalette : lightPalette;

      // Inicialización de Topología Dinámica
      const initNodes = () => {
        const isMobile = width < 640;
        const isTablet = width >= 640 && width < 1024;

        const coreCount = isMobile ? 3 : preset.coreCount;
        const hubCount = isMobile ? 5 : isTablet ? 7 : preset.hubCount;
        const relayCount = isMobile ? 10 : isTablet ? 14 : preset.relayCount;
        const edgeCount = isMobile ? 14 : isTablet ? 20 : preset.edgeCount;

        const nodes: NetworkNode[] = [];
        let idCounter = 0;

        const totalCount = coreCount + hubCount + relayCount + edgeCount;

        for (let i = 0; i < totalCount; i++) {
          let tier: HierarchyTier = 'EDGE';
          let radius = isDark ? 2.2 : 2.0;
          let color = theme.edge;
          let glowColor = theme.relayHalo;

          if (i < coreCount) {
            tier = 'CORE';
            radius = isDark ? 6.0 : 5.2;
            color = theme.core;
            glowColor = theme.coreHalo;
          } else if (i < coreCount + hubCount) {
            tier = 'HUB';
            radius = isDark ? 4.2 : 3.8;
            color = theme.hub;
            glowColor = theme.hubHalo;
          } else if (i < coreCount + hubCount + relayCount) {
            tier = 'RELAY';
            radius = isDark ? 3.0 : 2.6;
            color = theme.relay;
            glowColor = theme.relayHalo;
          }

          // Distribución en la pantalla
          const x = Math.random() * (width - 40) + 20;
          const y = Math.random() * (height - 40) + 20;

          // Velocidad continua y visible (Floating Drift)
          const angle = Math.random() * Math.PI * 2;
          const speed = (Math.random() * 0.4 + 0.3) * preset.speedMultiplier * (tier === 'CORE' ? 0.6 : 1.0);
          const baseVx = Math.cos(angle) * speed;
          const baseVy = Math.sin(angle) * speed;

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
          });
        }

        nodesRef.current = nodes;

        // Inicializar paquetes de datos listos
        const initialPackets: DataPacket[] = [];
        for (let p = 0; p < preset.maxPackets; p++) {
          initialPackets.push({
            active: false,
            source: 0,
            target: 0,
            progress: 0,
            speed: Math.random() * 0.015 + 0.02,
            color: isDark ? '#A7F3D0' : '#047857',
            headRadius: isDark ? 3.4 : 3.0,
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
        initNodes();
      };

      handleResize();

      // Listeners de Ratón
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
          available.maxRadius = 240;
          available.intensity = 1.0;
          available.speed = 4.5;
        } else if (waves.length < 6) {
          waves.push({
            active: true,
            x: e.clientX,
            y: e.clientY,
            radius: 10,
            maxRadius: 240,
            intensity: 1.0,
            speed: 4.5,
          });
        }
      };

      window.addEventListener('resize', handleResize);
      window.addEventListener('mousemove', handleMouseMove, { passive: true });
      window.addEventListener('mouseleave', handleMouseLeave);
      window.addEventListener('click', handleClick, { passive: true });

      let time = 0;
      const maxDistSq = maxDistance * maxDistance;

      // Loop de Animación 60 FPS
      const render = () => {
        time += 0.02;

        const mouse = mouseRef.current;
        mouse.x += (mouse.targetX - mouse.x) * 0.18;
        mouse.y += (mouse.targetY - mouse.y) * 0.18;

        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);

        const nodes = nodesRef.current;
        const nodeCount = nodes.length;

        // 1. ACTUALIZAR POSICIÓN Y FÍSICA DE NODOS
        for (let i = 0; i < nodeCount; i++) {
          const n = nodes[i];

          // Movimiento orgánico continuo
          n.x += n.vx;
          n.y += n.vy;

          // Rebote suave en los bordes
          if (n.x < 15) { n.x = 15; n.vx = Math.abs(n.vx); n.baseVx = Math.abs(n.baseVx); }
          if (n.x > width - 15) { n.x = width - 15; n.vx = -Math.abs(n.vx); n.baseVx = -Math.abs(n.baseVx); }
          if (n.y < 15) { n.y = 15; n.vy = Math.abs(n.vy); n.baseVy = Math.abs(n.baseVy); }
          if (n.y > height - 15) { n.y = height - 15; n.vy = -Math.abs(n.vy); n.baseVy = -Math.abs(n.baseVy); }

          // Retorno suave a la velocidad base
          n.vx = n.vx * 0.98 + n.baseVx * 0.02;
          n.vy = n.vy * 0.98 + n.baseVy * 0.02;

          // Decaimiento de actividad
          if (n.activity > 0) n.activity = Math.max(0, n.activity - 0.015);
          if (n.haloPulse > 0) n.haloPulse = Math.max(0, n.haloPulse - 0.012);

          // Atracción Gravitatoria del Ratón (Campo Magnético Visible)
          if (mouse.isActive && enableMouseInteraction) {
            const dx = mouse.x - n.x;
            const dy = mouse.y - n.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 220 && dist > 1) {
              const pull = (1 - dist / 220) * 1.5;
              n.vx += (dx / dist) * pull * 0.4;
              n.vy += (dy / dist) * pull * 0.4;
              n.activity = Math.max(n.activity, pull * 0.8);
            }
          }

          // Ondas de Choque (Click Ripples)
          const waves = wavesRef.current;
          for (let w = 0; w < waves.length; w++) {
            const wave = waves[w];
            if (!wave.active) continue;

            const wdx = n.x - wave.x;
            const wdy = n.y - wave.y;
            const wDist = Math.sqrt(wdx * wdx + wdy * wdy);
            const band = Math.abs(wDist - wave.radius);

            if (band < 30) {
              const force = (1 - band / 30) * wave.intensity * 2.5;
              const angle = Math.atan2(wdy, wdx);
              n.vx += Math.cos(angle) * force * 0.3;
              n.vy += Math.sin(angle) * force * 0.3;
              n.activity = Math.max(n.activity, wave.intensity * 0.9);
            }
          }
        }

        // 2. CONSTRUIR CONEXIONES
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

              connections.push({
                source: i,
                target: j,
                dist,
                tier,
              });

              connCounts[i]++;
              connCounts[j]++;
              if (connCounts[i] >= maxConnsPerNode) break;
            }
          }
        }

        connectionsRef.current = connections;

        // 3. DIBUJAR LÍNEAS DE RED
        for (let c = 0; c < connections.length; c++) {
          const conn = connections[c];
          const p1 = nodes[conn.source];
          const p2 = nodes[conn.target];

          const distRatio = 1 - conn.dist / maxDistance;
          const boost = Math.max(p1.activity, p2.activity) * 0.4;

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);

          if (conn.tier === 'TRUNK') {
            const alpha = Math.min(1.0, distRatio * preset.trunkOpacity + boost).toFixed(3);
            ctx.strokeStyle = `${theme.trunkLine}${alpha})`;
            ctx.lineWidth = isDark ? 1.8 : 1.5;
          } else if (conn.tier === 'BRANCH') {
            const alpha = Math.min(1.0, distRatio * preset.branchOpacity + boost).toFixed(3);
            ctx.strokeStyle = `${theme.branchLine}${alpha})`;
            ctx.lineWidth = isDark ? 1.2 : 1.0;
          } else {
            const alpha = Math.min(1.0, distRatio * preset.feederOpacity + boost).toFixed(3);
            ctx.strokeStyle = `${theme.feederLine}${alpha})`;
            ctx.lineWidth = isDark ? 0.9 : 0.75;
          }
          ctx.stroke();
        }

        // 4. LÍNEAS MAGNÉTICAS HACIA EL RATÓN
        if (mouse.isActive && enableMouseInteraction) {
          for (let i = 0; i < nodeCount; i++) {
            const n = nodes[i];
            const mdx = mouse.x - n.x;
            const mdy = mouse.y - n.y;
            const mDist = Math.sqrt(mdx * mdx + mdy * mdy);

            if (mDist < 200) {
              const alpha = ((1 - mDist / 200) * (isDark ? 0.55 : 0.4)).toFixed(3);
              ctx.beginPath();
              ctx.moveTo(mouse.x, mouse.y);
              ctx.lineTo(n.x, n.y);
              ctx.strokeStyle = `${theme.mouseLine}${alpha})`;
              ctx.lineWidth = 1.4;
              ctx.stroke();
            }
          }
        }

        // 5. PAQUETES DE DATOS EN TIEMPO REAL (COMETAS LUMINOSOS)
        if (enablePulses && connections.length > 0) {
          const packets = packetsRef.current;

          for (let p = 0; p < packets.length; p++) {
            const pkt = packets[p];

            // Re-lanzar paquete si está inactivo
            if (!pkt.active) {
              const randConn = connections[Math.floor(Math.random() * connections.length)];
              pkt.active = true;
              pkt.source = randConn.source;
              pkt.target = randConn.target;
              pkt.progress = 0;
              pkt.speed = Math.random() * 0.015 + 0.02;
              pkt.color = isDark ? '#34D399' : '#059669';
            }

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
            if (!src || !tgt) continue;

            const headX = src.x + (tgt.x - src.x) * pkt.progress;
            const headY = src.y + (tgt.y - src.y) * pkt.progress;
            const tailProgress = Math.max(0, pkt.progress - 0.25);
            const tailX = src.x + (tgt.x - src.x) * tailProgress;
            const tailY = src.y + (tgt.y - src.y) * tailProgress;

            const visibility = Math.sin(pkt.progress * Math.PI);

            // Cola de Cometa
            const grad = ctx.createLinearGradient(tailX, tailY, headX, headY);
            grad.addColorStop(0, 'rgba(16, 185, 129, 0)');
            grad.addColorStop(0.7, `${theme.trunkLine}${(visibility * (isDark ? 0.7 : 0.5)).toFixed(3)})`);
            grad.addColorStop(1, pkt.color);

            ctx.beginPath();
            ctx.moveTo(tailX, tailY);
            ctx.lineTo(headX, headY);
            ctx.strokeStyle = grad;
            ctx.lineWidth = isDark ? 2.8 : 2.2;
            ctx.stroke();

            // Cabeza Brillante
            ctx.beginPath();
            ctx.arc(headX, headY, pkt.headRadius, 0, Math.PI * 2);
            ctx.fillStyle = pkt.color;
            ctx.shadowColor = pkt.color;
            ctx.shadowBlur = isDark ? 12 : 6;
            ctx.globalAlpha = visibility;
            ctx.fill();
            ctx.globalAlpha = 1.0;
            ctx.shadowBlur = 0;
          }
        }

        // 6. ONDAS DE CLIC
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
            ctx.strokeStyle = `${theme.waveColor}${(wave.intensity * 0.6).toFixed(3)})`;
            ctx.lineWidth = 2.0;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(wave.x, wave.y, Math.max(1, wave.radius - 15), 0, Math.PI * 2);
            ctx.strokeStyle = `${theme.waveColor}${(wave.intensity * 0.3).toFixed(3)})`;
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }
        }

        // 7. DIBUJAR NODOS
        for (let i = 0; i < nodeCount; i++) {
          const n = nodes[i];
          const nodeAlpha = (0.85 + n.activity * 0.15) * n.depth;

          // CORE: Halo y Anillo Orbital
          if (n.tier === 'CORE') {
            const haloSize = 34 + Math.sin(time * 2.5 + n.phase) * 8 + (n.activity * 20);
            const haloGrad = ctx.createRadialGradient(n.x, n.y, 2, n.x, n.y, haloSize);
            haloGrad.addColorStop(0, isDark ? 'rgba(16, 185, 129, 0.45)' : 'rgba(4, 120, 87, 0.35)');
            haloGrad.addColorStop(0.5, isDark ? 'rgba(6, 182, 212, 0.2)' : 'rgba(14, 116, 144, 0.15)');
            haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

            ctx.beginPath();
            ctx.arc(n.x, n.y, haloSize, 0, Math.PI * 2);
            ctx.fillStyle = haloGrad;
            ctx.fill();

            // Anillo Orbital
            const orbitRadius = n.radius + 6.0 + Math.sin(time * 2.0 + n.phase) * 1.5;
            ctx.beginPath();
            ctx.arc(n.x, n.y, orbitRadius, 0, Math.PI * 2);
            ctx.strokeStyle = `${theme.trunkLine}${(0.45 + n.activity * 0.4).toFixed(3)})`;
            ctx.lineWidth = 1.3;
            ctx.stroke();
          }

          // HUB: Anillo concéntrico
          if (n.tier === 'HUB') {
            const hubRingRadius = n.radius + 4.5 + Math.sin(time * 3.0 + n.phase) * 1.2;
            ctx.beginPath();
            ctx.arc(n.x, n.y, hubRingRadius, 0, Math.PI * 2);
            ctx.strokeStyle = `${theme.branchLine}${(0.35 + n.activity * 0.4).toFixed(3)})`;
            ctx.lineWidth = 1.1;
            ctx.stroke();
          }

          // Cuerpo Principal
          const currentRadius = n.radius + (n.activity * 1.2);
          ctx.beginPath();
          ctx.arc(n.x, n.y, currentRadius, 0, Math.PI * 2);
          ctx.fillStyle = n.color;
          ctx.shadowColor = n.color;
          ctx.shadowBlur = isDark ? (n.tier === 'CORE' ? 18 : n.tier === 'HUB' ? 12 : 7) : 4;
          ctx.globalAlpha = nodeAlpha;
          ctx.fill();
          ctx.globalAlpha = 1.0;
          ctx.shadowBlur = 0;

          // Núcleo Blanco / Brillante
          if (n.tier === 'CORE' || n.tier === 'HUB') {
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.tier === 'CORE' ? 2.4 : 1.6, 0, Math.PI * 2);
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
