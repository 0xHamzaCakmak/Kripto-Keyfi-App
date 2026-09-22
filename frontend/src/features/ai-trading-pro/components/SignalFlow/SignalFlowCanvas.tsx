import React, { useEffect, useRef } from 'react';
import { SignalDecision } from '../../types';

export type SignalBurst = { id: string; symbol: string; decision: SignalDecision };

interface SignalFlowCanvasProps {
  nodeCount: number;
  nodeSymbols: string[];
  nodeDecisions: SignalDecision[];
  nodeBeamMultipliers: number[];
  signalBursts: SignalBurst[];
  ambientSpawnInterval: number;
  targetCoordinates: { x: number; y: number }[];
  sourceCoordinate: { x: number; y: number };
  width: number;
  height: number;
}

interface Particle {
  id: number;
  targetIndex: number;
  t: number; // 0 to 1 along curve
  speed: number;
  size: number;
  color: string;
  glowColor: string;
  isSurge: boolean;
  opacity: number;
  tailLength: number;
}

interface ImpactRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  opacity: number;
}

const DECISION_COLORS = {
  LONG: {
    primary: '#02c076',
    glow: 'rgba(2, 192, 118, 0.8)',
    head: '#5df5b5',
    rgb: [2, 192, 118],
  },
  SHORT: {
    primary: '#f84960',
    glow: 'rgba(248, 73, 96, 0.8)',
    head: '#ffa2b0',
    rgb: [248, 73, 96],
  },
  HOLD: {
    primary: '#f0b90b',
    glow: 'rgba(240, 185, 11, 0.8)',
    head: '#fce072',
    rgb: [240, 185, 11],
  },
};

export const SignalFlowCanvas: React.FC<SignalFlowCanvasProps> = ({
  nodeCount,
  nodeSymbols,
  nodeDecisions,
  nodeBeamMultipliers,
  signalBursts,
  ambientSpawnInterval,
  targetCoordinates,
  sourceCoordinate,
  width,
  height,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const impactRingsRef = useRef<ImpactRing[]>([]);
  const nextParticleIdRef = useRef(1);
  const animationFrameRef = useRef<number | null>(null);
  const lastSpawnRef = useRef<number>(0);
  const processedBurstIdsRef = useRef<string[]>([]);

  // Bezier evaluation helper
  const getCubicBezierPoint = (
    p0: { x: number; y: number },
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    p3: { x: number; y: number },
    t: number
  ) => {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;

    return {
      x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
      y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
    };
  };

  // Convert each unseen backend decision into an immediate particle surge.
  useEffect(() => {
    for (const event of signalBursts) {
      if (processedBurstIdsRef.current.includes(event.id)) continue;
      const targetIndex = nodeSymbols.indexOf(event.symbol);
      if (targetIndex !== -1 && targetIndex < targetCoordinates.length) {
        processedBurstIdsRef.current.push(event.id);
        if (processedBurstIdsRef.current.length > 200) processedBurstIdsRef.current.shift();
        const col = DECISION_COLORS[event.decision] || DECISION_COLORS.LONG;
        
        // Spawn a burst of 2-3 bright surge particles
        for (let i = 0; i < 2; i++) {
          particlesRef.current.push({
            id: nextParticleIdRef.current++,
            targetIndex,
            t: -i * 0.08,
            speed: 0.014 + Math.random() * 0.006,
            size: 3.5 + Math.random() * 1.5,
            color: col.head,
            glowColor: col.glow,
            isSurge: true,
            opacity: 1,
            tailLength: 12 + Math.random() * 8,
          });
        }
      }
    }
  }, [nodeSymbols, signalBursts, targetCoordinates]);

  // Main canvas animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let isDestroyed = false;

    const render = (time: number) => {
      if (isDestroyed) return;

      const dpr = window.devicePixelRatio || 1;
      const w = width;
      const h = height;

      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      if (targetCoordinates.length === 0 || sourceCoordinate.x === 0) {
        ctx.restore();
        animationFrameRef.current = requestAnimationFrame(render);
        return;
      }

      const p0 = sourceCoordinate;

      // 1. Draw glowing curved neon pathways
      for (let i = 0; i < targetCoordinates.length; i++) {
        const p3 = targetCoordinates[i];
        if (!p3) continue;

        const dx = p3.x - p0.x;
        const p1 = { x: p0.x + dx * 0.42, y: p0.y };
        const p2 = { x: p3.x - dx * 0.38, y: p3.y };

        const decision = nodeDecisions[i] || 'LONG';
        const colorConfig = DECISION_COLORS[decision] || DECISION_COLORS.LONG;
        const beamMultiplier = nodeBeamMultipliers[i] ?? 1;

        // Path gradient from cyan source to signal target color
        const gradient = ctx.createLinearGradient(p0.x, p0.y, p3.x, p3.y);
        gradient.addColorStop(0, 'rgba(0, 210, 255, 0.4)');
        gradient.addColorStop(0.3, 'rgba(0, 210, 255, 0.25)');
        gradient.addColorStop(0.7, colorConfig.glow.replace('0.8', '0.35'));
        gradient.addColorStop(1, colorConfig.primary);

        // Ambient track line (base faint neon line)
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
        ctx.strokeStyle = 'rgba(43, 49, 57, 0.5)';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Glowing colored beam overlay
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1.6 * beamMultiplier;
        ctx.shadowColor = colorConfig.glow;
        ctx.shadowBlur = 8 * beamMultiplier;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // 2. Spawn ambient continuous particles
      if (time - lastSpawnRef.current > ambientSpawnInterval) {
        lastSpawnRef.current = time;
        // Pick 1-2 random targets to send ambient particles
        for (let k = 0; k < 2; k++) {
          const targetIndex = Math.floor(Math.random() * targetCoordinates.length);
          const decision = nodeDecisions[targetIndex] || 'LONG';
          const col = DECISION_COLORS[decision] || DECISION_COLORS.LONG;

          particlesRef.current.push({
            id: nextParticleIdRef.current++,
            targetIndex,
            t: 0,
            speed: 0.006 + Math.random() * 0.005,
            size: 2.2 + Math.random() * 1.2,
            color: col.head,
            glowColor: col.glow,
            isSurge: false,
            opacity: 0.75 + Math.random() * 0.25,
            tailLength: 6 + Math.random() * 6,
          });
        }
      }

      // 3. Update and render active particles
      const remainingParticles: Particle[] = [];

      for (let i = 0; i < particlesRef.current.length; i++) {
        const p = particlesRef.current[i];
        p.t += p.speed;

        // Skip if not started yet (for staggered bursts)
        if (p.t < 0) {
          remainingParticles.push(p);
          continue;
        }

        if (p.t >= 1) {
          // Particle arrived! Spawn impact ring
          const target = targetCoordinates[p.targetIndex];
          if (target) {
            impactRingsRef.current.push({
              x: target.x,
              y: target.y,
              radius: 2,
              maxRadius: p.isSurge ? 18 : 10,
              color: p.glowColor,
              opacity: 1,
            });
          }
          continue; // done, remove particle
        }

        const target = targetCoordinates[p.targetIndex];
        if (!target) continue;

        const dx = target.x - p0.x;
        const p1 = { x: p0.x + dx * 0.42, y: p0.y };
        const p2 = { x: target.x - dx * 0.38, y: target.y };

        const currentPos = getCubicBezierPoint(p0, p1, p2, target, p.t);

        // Draw particle tail / motion blur
        const tailSegments = Math.floor(p.tailLength);
        for (let s = 1; s <= tailSegments; s++) {
          const prevT = Math.max(0, p.t - s * 0.008);
          const prevPos = getCubicBezierPoint(p0, p1, p2, target, prevT);
          const tailAlpha = p.opacity * (1 - s / tailSegments) * (p.isSurge ? 0.7 : 0.4);

          ctx.beginPath();
          ctx.arc(prevPos.x, prevPos.y, p.size * (1 - (s / tailSegments) * 0.6), 0, Math.PI * 2);
          ctx.fillStyle = p.glowColor.replace(/[\d.]+\)$/, `${tailAlpha})`);
          ctx.fill();
        }

        // Draw particle core
        ctx.save();
        ctx.beginPath();
        ctx.arc(currentPos.x, currentPos.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.glowColor;
        ctx.shadowBlur = p.isSurge ? 14 : 8;
        ctx.fill();
        ctx.restore();

        remainingParticles.push(p);
      }

      particlesRef.current = remainingParticles;

      // 4. Update and render impact ripple rings
      const remainingRings: ImpactRing[] = [];
      for (let r = 0; r < impactRingsRef.current.length; r++) {
        const ring = impactRingsRef.current[r];
        ring.radius += 0.7;
        ring.opacity -= 0.04;

        if (ring.opacity > 0 && ring.radius < ring.maxRadius) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
          ctx.strokeStyle = ring.color.replace(/[\d.]+\)$/, `${ring.opacity})`);
          ctx.lineWidth = 1.5;
          ctx.shadowColor = ring.color;
          ctx.shadowBlur = 6;
          ctx.stroke();
          ctx.restore();
          remainingRings.push(ring);
        }
      }
      impactRingsRef.current = remainingRings;

      // 5. Render central USDT glowing node visual effects on the canvas
      const pulseFactor = 1 + Math.sin(time * 0.004) * 0.06;
      ctx.save();
      // Outer subtle aura
      const auraGradient = ctx.createRadialGradient(p0.x, p0.y, 10, p0.x, p0.y, 48 * pulseFactor);
      auraGradient.addColorStop(0, 'rgba(0, 210, 255, 0.45)');
      auraGradient.addColorStop(0.5, 'rgba(0, 210, 255, 0.15)');
      auraGradient.addColorStop(1, 'rgba(0, 210, 255, 0)');
      ctx.fillStyle = auraGradient;
      ctx.beginPath();
      ctx.arc(p0.x, p0.y, 48 * pulseFactor, 0, Math.PI * 2);
      ctx.fill();

      // Rotating dashed ring
      ctx.beginPath();
      ctx.arc(p0.x, p0.y, 28, 0, Math.PI * 2);
      ctx.setLineDash([4, 6]);
      ctx.lineDashOffset = -time * 0.03;
      ctx.strokeStyle = 'rgba(0, 210, 255, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      ctx.restore();
      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      isDestroyed = true;
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [width, height, nodeCount, nodeDecisions, nodeBeamMultipliers, targetCoordinates, sourceCoordinate, ambientSpawnInterval]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-10"
      style={{ width: `${width}px`, height: `${height}px` }}
    />
  );
};
