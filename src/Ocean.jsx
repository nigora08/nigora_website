import { useEffect, useRef } from "react";
import { SECTIONS } from "./sections.js";

export default function Ocean({ theme, sectionId }) {
  const canvasRef = useRef(null);
  const themeRef = useRef(theme);
  const sectionRef = useRef(sectionId);

  themeRef.current = theme;
  sectionRef.current = sectionId;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { alpha: true });
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let running = true;

    const specks = Array.from({ length: 36 }, (_, i) => ({
      x: fract(Math.sin(i * 12.9898) * 43758.5453),
      y: fract(Math.sin(i * 78.233) * 127.1),
      s: 0.6 + fract(Math.sin(i * 4.2) * 90) * 1.3,
      v: 0.008 + (i % 5) * 0.003,
      drift: 0.4 + (i % 4) * 0.15,
    }));

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw(time) {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const dark = themeRef.current === "dark";
      const sectionIndex = Math.max(
        0,
        SECTIONS.findIndex((section) => section.id === sectionRef.current),
      );
      const lean = ((sectionIndex % 7) - 3) * 0.012;
      ctx.clearRect(0, 0, width, height);

      const sunX = width * (0.28 + Math.sin(time * 0.00007) * 0.06 + lean);
      const sunY = height * (0.38 + Math.cos(time * 0.00005) * 0.05);
      const sun = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, Math.max(width, height) * 0.62);
      if (dark) {
        sun.addColorStop(0, "rgba(255,255,255,0.075)");
        sun.addColorStop(0.42, "rgba(255,255,255,0.02)");
        sun.addColorStop(1, "rgba(255,255,255,0)");
      } else {
        sun.addColorStop(0, "rgba(255,255,255,0.92)");
        sun.addColorStop(0.28, "rgba(214, 234, 231, 0.48)");
        sun.addColorStop(0.62, "rgba(176, 210, 206, 0.16)");
        sun.addColorStop(1, "rgba(176, 210, 206, 0)");
      }
      ctx.fillStyle = sun;
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i < 3; i += 1) {
        const sway = Math.sin(time * 0.00011 + i * 1.7) * 0.05;
        drawShaft(ctx, {
          x: width * (0.12 + i * 0.22) + lean * width,
          width: width * (0.07 + i * 0.012),
          height,
          angle: -0.16 + sway + lean,
          dark,
          alpha: dark ? 0.055 - i * 0.01 : 0.22 - i * 0.04,
        });
      }

      ctx.lineWidth = 1.15;
      for (let i = 0; i < 6; i += 1) {
        const base = height * (0.12 + i * 0.13);
        const amp = 8 + i * 3.2;
        const speed = time * (0.00018 + i * 0.00003);
        ctx.beginPath();
        for (let x = 0; x <= width; x += 10) {
          const y =
            base +
            Math.sin(x * 0.0075 + speed + i * 1.3) * amp +
            Math.sin(x * 0.021 - speed * 1.6 + lean * 20) * amp * 0.38;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        const alpha = dark ? 0.05 + i * 0.016 : 0.09 + i * 0.03;
        ctx.strokeStyle = dark
          ? `rgba(255,255,255,${alpha})`
          : `rgba(14, 96, 106, ${alpha})`;
        ctx.lineWidth = 1.35;
        ctx.stroke();
      }

      for (const speck of specks) {
        const y = (speck.y * height - time * speck.v * 18) % (height + 30);
        const py = y < 0 ? y + height + 30 : y;
        const px = speck.x * width + Math.sin(time * 0.00035 + speck.x * 12) * 16 * speck.drift;
        ctx.beginPath();
        ctx.fillStyle = dark
          ? `rgba(255,255,255,${0.12 + speck.s * 0.08})`
          : `rgba(12, 78, 88, ${0.12 + speck.s * 0.08})`;
        ctx.arc(px, py, speck.s, 0, Math.PI * 2);
        ctx.fill();
      }

      if (running && !motion.matches) frame = requestAnimationFrame(draw);
    }

    resize();
    draw(performance.now());
    if (!motion.matches) frame = requestAnimationFrame(draw);

    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    return () => {
      running = false;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="ocean" aria-hidden="true" />;
}

function drawShaft(ctx, { x, width, height, angle, dark, alpha }) {
  ctx.save();
  ctx.translate(x, -20);
  ctx.rotate(angle);
  const gradient = ctx.createLinearGradient(0, 0, 0, height * 1.15);
  const head = dark ? `rgba(255,255,255,${alpha})` : `rgba(232, 248, 246, ${alpha + 0.2})`;
  const mid = dark ? "rgba(255,255,255,0.02)" : "rgba(120, 186, 182, 0.2)";
  gradient.addColorStop(0, head);
  gradient.addColorStop(0.42, mid);
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(width, 0);
  ctx.lineTo(width * 2.1, height * 1.2);
  ctx.lineTo(-width * 0.35, height * 1.2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function fract(value) {
  return value - Math.floor(value);
}
