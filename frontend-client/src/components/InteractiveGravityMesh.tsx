import React, { useEffect, useRef } from 'react';

interface InteractiveGravityMeshProps {
  particleCount?: number;
  maxDistance?: number;
  gravityRadius?: number;
  isDark?: boolean;
  className?: string;
}

interface Particle {
  x: number;
  y: number;
  originX: number;
  originY: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  phase: number;
  speed: number;
}

export const InteractiveGravityMesh: React.FC<InteractiveGravityMeshProps> = ({
  particleCount = 65,
  maxDistance = 135,
  gravityRadius = 160,
  isDark = true,
  className = 'absolute inset-0 pointer-events-auto',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const mouse = {
      x: -1000,
      y: -1000,
      targetX: -1000,
      targetY: -1000,
      isActive: false,
    };

    const handleResize = () => {
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
      initParticles();
    };

    let particles: Particle[] = [];

    const colorsDark = ['#10B981', '#14B8A6', '#06B6D4', '#34D399', '#2DD4BF'];
    const colorsLight = ['#059669', '#0D9488', '#0891B2', '#10B981', '#14B8A6'];

    const initParticles = () => {
      particles = [];
      const count = window.innerWidth < 768 ? Math.floor(particleCount * 0.45) : particleCount;
      const colors = isDark ? colorsDark : colorsLight;

      for (let i = 0; i < count; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        particles.push({
          x,
          y,
          originX: x,
          originY: y,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          radius: Math.random() * 2 + 1.5,
          color: colors[Math.floor(Math.random() * colors.length)],
          phase: Math.random() * Math.PI * 2,
          speed: Math.random() * 0.02 + 0.01,
        });
      }
    };

    handleResize();

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.targetX = e.clientX - rect.left;
      mouse.targetY = e.clientY - rect.top;
      mouse.isActive = true;
    };

    const handleMouseLeave = () => {
      mouse.isActive = false;
      mouse.targetX = -1000;
      mouse.targetY = -1000;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const rect = canvas.getBoundingClientRect();
        mouse.targetX = e.touches[0].clientX - rect.left;
        mouse.targetY = e.touches[0].clientY - rect.top;
        mouse.isActive = true;
      }
    };

    const handleTouchEnd = () => {
      mouse.isActive = false;
      mouse.targetX = -1000;
      mouse.targetY = -1000;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);

    let time = 0;

    const render = () => {
      time += 0.015;

      mouse.x += (mouse.targetX - mouse.x) * 0.15;
      mouse.y += (mouse.targetY - mouse.y) * 0.15;

      ctx.clearRect(0, 0, width, height);

      const maxDistSq = maxDistance * maxDistance;
      const gravRadSq = gravityRadius * gravityRadius;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        p.phase += p.speed;
        const waveOffset = Math.sin(p.phase + time) * 0.6;

        if (mouse.isActive) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < gravRadSq && distSq > 0) {
            const dist = Math.sqrt(distSq);
            const force = (1 - dist / gravityRadius) * 28;
            const angle = Math.atan2(dy, dx);
            p.vx -= Math.cos(angle) * force * 0.12;
            p.vy -= Math.sin(angle) * force * 0.12;
          }
        }

        const springX = (p.originX - p.x) * 0.025;
        const springY = (p.originY + waveOffset - p.y) * 0.025;

        p.vx = (p.vx + springX) * 0.88;
        p.vy = (p.vy + springY) * 0.88;

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;
      }

      const baseLineAlpha = isDark ? 0.22 : 0.15;

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const p1 = particles[i];
          const p2 = particles[j];

          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < maxDistSq) {
            const dist = Math.sqrt(distSq);
            const alpha = (1 - dist / maxDistance) * baseLineAlpha;

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = isDark
              ? `rgba(16, 185, 129, ${alpha})`
              : `rgba(5, 150, 105, ${alpha * 0.9})`;
            ctx.lineWidth = 0.9;
            ctx.stroke();
          }
        }

        if (mouse.isActive) {
          const mdx = mouse.x - particles[i].x;
          const mdy = mouse.y - particles[i].y;
          const mDistSq = mdx * mdx + mdy * mdy;

          if (mDistSq < gravRadSq) {
            const mDist = Math.sqrt(mDistSq);
            const mAlpha = (1 - mDist / gravityRadius) * (isDark ? 0.35 : 0.25);

            ctx.beginPath();
            ctx.moveTo(mouse.x, mouse.y);
            ctx.lineTo(particles[i].x, particles[i].y);
            ctx.strokeStyle = isDark
              ? `rgba(6, 182, 212, ${mAlpha})`
              : `rgba(13, 148, 136, ${mAlpha})`;
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }
        }
      }

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = isDark ? 8 : 4;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [particleCount, maxDistance, gravityRadius, isDark]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: 'block' }}
    />
  );
};
