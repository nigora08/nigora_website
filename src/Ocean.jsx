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
    const aim = { x: 0.32, y: 0.42, tx: 0.32, ty: 0.42 };
    let lean = 0;
    let frame = 0;
    let running = true;

    const bubbles = Array.from({ length: 18 }, (_, i) => ({
      x: fract(Math.sin(i * 12.9898) * 43758.5453),
      y: fract(Math.sin(i * 78.233) * 127.1),
      r: 1.6 + fract(Math.sin(i * 4.2) * 90) * 5.5,
      v: 0.012 + (i % 6) * 0.004,
      wobble: 0.6 + (i % 4) * 0.25,
    }));

    const motes = Array.from({ length: 42 }, (_, i) => ({
      x: fract(Math.sin(i * 19.19) * 23421.7),
      y: fract(Math.sin(i * 45.2) * 9123.4),
      s: 0.4 + fract(Math.sin(i * 3.1) * 40) * 1.4,
      v: 0.004 + (i % 5) * 0.002,
    }));

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function onPointer(event) {
      aim.tx = event.clientX / Math.max(window.innerWidth, 1);
      aim.ty = event.clientY / Math.max(window.innerHeight, 1);
    }

    function draw(time) {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const dark = themeRef.current === "dark";
      const sectionIndex = SECTIONS.findIndex((section) => section.id === sectionRef.current);
      const targetLean = sectionIndex < 0 ? 0 : ((sectionIndex % 7) - 3) * 0.05;
      lean += (targetLean - lean) * 0.025;
      aim.x += (aim.tx - aim.x) * 0.045;
      aim.y += (aim.ty - aim.y) * 0.045;

      ctx.clearRect(0, 0, width, height);

      const sunX = width * (0.18 + aim.x * 0.28 + Math.sin(time * 0.00006) * 0.03 + lean);
      const sunY = height * (0.16 + aim.y * 0.12 + Math.cos(time * 0.00005) * 0.03);
      const sun = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, Math.max(width, height) * 0.72);
      if (dark) {
        sun.addColorStop(0, "rgba(255,255,255,0.16)");
        sun.addColorStop(0.28, "rgba(255,255,255,0.05)");
        sun.addColorStop(1, "rgba(255,255,255,0)");
      } else {
        sun.addColorStop(0, "rgba(255,255,255,0.95)");
        sun.addColorStop(0.22, "rgba(226, 244, 241, 0.55)");
        sun.addColorStop(0.55, "rgba(168, 210, 206, 0.16)");
        sun.addColorStop(1, "rgba(168, 210, 206, 0)");
      }
      ctx.fillStyle = sun;
      ctx.fillRect(0, 0, width, height);

      if (!dark) {
        for (let i = 0; i < 5; i += 1) {
          const sway = Math.sin(time * 0.00013 + i * 1.35) * 0.07;
          const breathe = 0.72 + Math.sin(time * 0.0004 + i) * 0.28;
          drawShaft(ctx, {
            x: width * (0.08 + i * 0.17) + (aim.x - 0.5) * 40 + lean * width,
            width: width * (0.045 + (i % 3) * 0.018),
            height,
            angle: -0.22 + sway + lean + (aim.x - 0.5) * 0.08,
            dark,
            alpha: 0.2 * breathe * (1 - i * 0.08),
          });
        }
      }

      drawSurface(ctx, width, height, time, lean, aim.x, dark);
      drawCaustics(ctx, width, height, time, lean, aim.x, dark);
      drawBubbles(ctx, bubbles, width, height, time, dark);
      drawMotes(ctx, motes, width, height, time, dark);

      if (running && !motion.matches) frame = requestAnimationFrame(draw);
    }

    resize();
    if (!motion.matches) window.addEventListener("pointermove", onPointer, { passive: true });
    draw(motion.matches ? 12000 : performance.now());

    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    return () => {
      running = false;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointer);
    };
  }, []);

  return <canvas ref={canvasRef} className="ocean" aria-hidden="true" />;
}

function drawSurface(ctx, width, height, time, lean, aimX, dark) {
  const horizon = height * (0.16 + (aimX - 0.5) * 0.02);
  for (let i = 0; i < 5; i += 1) {
    const base = horizon + i * (10 + i);
    const amp = 4 + i * 2.6;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 8) {
      const y =
        base +
        Math.sin(x * 0.0072 + time * 0.00024 + i * 0.9) * amp +
        Math.sin(x * 0.018 - time * 0.00016 + lean * 24) * amp * 0.42;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    const alpha = dark ? 0.05 + i * 0.028 : 0.1 + i * 0.04;
    ctx.strokeStyle = dark ? `rgba(255,255,255,${alpha})` : `rgba(10, 78, 88, ${alpha})`;
    ctx.lineWidth = 1 + i * 0.28;
    ctx.stroke();
  }
}

function drawCaustics(ctx, width, height, time, lean, aimX, dark) {
  for (let i = 0; i < 9; i += 1) {
    const y0 = height * (0.36 + i * 0.07);
    ctx.beginPath();
    for (let x = 0; x <= width; x += 14) {
      const y =
        y0 +
        Math.sin(x * 0.011 + time * 0.00033 + i * 0.8) * (12 + (i % 3) * 6) +
        Math.sin(x * 0.0032 - time * 0.00019 + lean * 16 + aimX) * 28;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    const alpha = dark ? 0.028 + (i % 3) * 0.012 : 0.05 + (i % 4) * 0.028;
    ctx.strokeStyle = dark
      ? `rgba(255,255,255,${alpha})`
      : `rgba(236, 252, 249, ${alpha + 0.08})`;
    ctx.lineWidth = i % 2 === 0 ? 1.7 : 0.65;
    ctx.stroke();
  }
}

function drawBubbles(ctx, bubbles, width, height, time, dark) {
  for (const bubble of bubbles) {
    const travel = (bubble.y * height - time * bubble.v * 22) % (height + 40);
    const py = travel < 0 ? travel + height + 40 : travel;
    const px =
      bubble.x * width +
      Math.sin(time * 0.00045 + bubble.x * 14) * 22 * bubble.wobble;
    const alpha = dark ? 0.28 : 0.34;
    ctx.beginPath();
    ctx.strokeStyle = dark ? `rgba(255,255,255,${alpha})` : `rgba(14, 96, 106, ${alpha * 0.7})`;
    ctx.lineWidth = 1;
    ctx.arc(px, py, bubble.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.strokeStyle = `rgba(255,255,255,${dark ? 0.45 : 0.75})`;
    ctx.arc(px - bubble.r * 0.28, py - bubble.r * 0.28, bubble.r * 0.42, Math.PI * 1.05, Math.PI * 1.75);
    ctx.stroke();
  }
}

function drawMotes(ctx, motes, width, height, time, dark) {
  for (const mote of motes) {
    const y = (mote.y * height - time * mote.v * 16) % (height + 20);
    const py = y < 0 ? y + height + 20 : y;
    const px = mote.x * width + Math.sin(time * 0.0003 + mote.x * 10) * 12;
    ctx.beginPath();
    ctx.fillStyle = dark
      ? `rgba(255,255,255,${0.08 + mote.s * 0.06})`
      : `rgba(12, 78, 88, ${0.1 + mote.s * 0.07})`;
    ctx.arc(px, py, mote.s, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawShaft(ctx, { x, width, height, angle, dark, alpha }) {
  ctx.save();
  ctx.translate(x, -30);
  ctx.rotate(angle);
  const gradient = ctx.createLinearGradient(0, 0, 0, height * 1.2);
  const head = dark ? `rgba(255,255,255,${alpha})` : `rgba(244, 252, 250, ${Math.min(alpha + 0.28, 0.72)})`;
  const mid = dark ? "rgba(255,255,255,0.025)" : "rgba(150, 206, 200, 0.16)";
  gradient.addColorStop(0, head);
  gradient.addColorStop(0.38, mid);
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(width * 0.15, 0);
  ctx.lineTo(width * 0.85, 0);
  ctx.quadraticCurveTo(width * 1.7, height * 0.55, width * 2.3, height * 1.2);
  ctx.lineTo(-width * 0.55, height * 1.2);
  ctx.quadraticCurveTo(width * 0.15, height * 0.5, width * 0.15, 0);
  ctx.fill();
  ctx.restore();
}

function fract(value) {
  return value - Math.floor(value);
}
