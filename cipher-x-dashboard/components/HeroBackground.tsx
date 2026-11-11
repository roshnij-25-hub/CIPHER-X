"use client";

import { useEffect, useRef } from "react";

export default function HeroBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animFrame: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Stars
    const stars = Array.from({ length: 160 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.4 + 0.2,
      alpha: Math.random() * 0.7 + 0.3,
      phase: Math.random() * Math.PI * 2,
    }));

    // Grid lines
    const GRID = 48;

    // Satellite scan points
    const scanPoints = Array.from({ length: 6 }, (_, i) => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      life: Math.random() * 60,
      maxLife: 80 + Math.random() * 40,
    }));

    let t = 0;

    function draw() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Deep space gradient background
      const grad = ctx.createRadialGradient(
        canvas.width * 0.5, canvas.height * 0.3, 0,
        canvas.width * 0.5, canvas.height * 0.5, canvas.height
      );
      grad.addColorStop(0, "rgba(30,10,60,0.15)");
      grad.addColorStop(0.5, "rgba(6,12,30,0.1)");
      grad.addColorStop(1, "rgba(7,11,20,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid
      ctx.beginPath();
      ctx.strokeStyle = "rgba(34,211,238,0.04)";
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += GRID) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
      }
      for (let y = 0; y < canvas.height; y += GRID) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
      }
      ctx.stroke();

      // Twinkling stars
      t += 0.012;
      for (const star of stars) {
        const a = star.alpha * (0.6 + 0.4 * Math.sin(t * 0.8 + star.phase));
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,220,255,${a})`;
        ctx.fill();
      }

      // Scan lines moving down
      const scanY = (t * 60) % canvas.height;
      const scanGrad = ctx.createLinearGradient(0, scanY - 40, 0, scanY + 6);
      scanGrad.addColorStop(0, "rgba(34,211,238,0)");
      scanGrad.addColorStop(0.8, "rgba(34,211,238,0.05)");
      scanGrad.addColorStop(1, "rgba(34,211,238,0.08)");
      ctx.fillStyle = scanGrad;
      ctx.fillRect(0, scanY - 40, canvas.width, 46);

      // Scanning AOI pulse rings
      for (const pt of scanPoints) {
        pt.life += 0.5;
        if (pt.life > pt.maxLife) {
          pt.x = Math.random() * canvas.width;
          pt.y = Math.random() * canvas.height;
          pt.life = 0;
        }
        const progress = pt.life / pt.maxLife;
        const radius = progress * 80;
        const alpha = (1 - progress) * 0.35;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(34,211,238,${alpha})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        if (radius < 20) {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(34,211,238,${alpha * 3})`;
          ctx.fill();
        }
      }

      // Horizontal data stream lines
      for (let i = 0; i < 3; i++) {
        const lineY = ((t * 30 * (i + 1) * 0.4) % canvas.height);
        const lGrad = ctx.createLinearGradient(0, 0, canvas.width, 0);
        lGrad.addColorStop(0, "rgba(168,85,247,0)");
        lGrad.addColorStop(0.3 + i * 0.15, "rgba(168,85,247,0.06)");
        lGrad.addColorStop(1, "rgba(168,85,247,0)");
        ctx.beginPath();
        ctx.strokeStyle = lGrad;
        ctx.lineWidth = 1;
        ctx.moveTo(0, lineY);
        ctx.lineTo(canvas.width, lineY);
        ctx.stroke();
      }

      animFrame = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      aria-hidden="true"
    />
  );
}
