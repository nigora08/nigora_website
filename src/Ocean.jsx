import { useEffect, useRef } from "react";
import { SECTIONS } from "./sections.js";

export default function Ocean({ theme, sectionId }) {
  const canvasRef = useRef(null);
  const lifeRef = useRef(null);
  const themeRef = useRef(theme);
  const sectionRef = useRef(sectionId);

  themeRef.current = theme;
  sectionRef.current = sectionId;

  useEffect(() => {
    const canvas = canvasRef.current;
    const life = lifeRef.current;
    const ctx = canvas.getContext("2d", { alpha: true });
    const lifeCtx = life.getContext("2d", { alpha: true });
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
      life.width = canvas.width;
      life.height = canvas.height;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lifeCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

      lifeCtx.clearRect(0, 0, width, height);
      drawLife(lifeCtx, width, height, time, dark, lean, aim.y);

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

  return (
    <>
      <canvas ref={canvasRef} className="ocean" aria-hidden="true" />
      <canvas ref={lifeRef} className="life" aria-hidden="true" />
    </>
  );
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

function drawLife(ctx, width, height, time, dark, lean, aimY) {
  const scale = Math.max(0.72, Math.min(width, height) / 820);
  const drift = lean * height * 0.35 + (aimY - 0.5) * 16;
  if (dark) drawDeepSea(ctx, width, height, time, scale, drift);
  else drawShallows(ctx, width, height, time, scale, drift);
}

function drawShallows(ctx, width, height, time, scale, drift) {
  const school = [
    [0.02, 0.34, 1, 0.000034],
    [0.08, 0.31, 0.82, 0.000034],
    [0.14, 0.37, 1.1, 0.000034],
    [0.2, 0.33, 0.74, 0.000034],
    [0.27, 0.39, 0.96, 0.000034],
    [0.33, 0.3, 0.7, 0.000034],
    [0.4, 0.36, 1.05, 0.000034],
    [0.47, 0.32, 0.84, 0.000034],
    [0.54, 0.4, 0.9, 0.000034],
    [0.61, 0.34, 0.76, 0.000034],
    [0.68, 0.37, 1.12, 0.000034],
    [0.76, 0.31, 0.88, 0.000034],
    [0.15, 0.58, 0.62, -0.000027],
    [0.28, 0.62, 0.7, -0.000027],
    [0.41, 0.56, 0.55, -0.000027],
    [0.55, 0.61, 0.66, -0.000027],
    [0.69, 0.57, 0.58, -0.000027],
    [0.82, 0.63, 0.72, -0.000027],
  ];

  for (const [phase, band, size, speed] of school) {
    const x = swim(phase, speed, time, width);
    const y = height * band + Math.sin(time * 0.0009 + phase * 12) * 16 + drift;
    const angle = Math.sin(time * 0.0014 + phase * 9) * 0.22 + (speed < 0 ? Math.PI : 0);
    drawFish(ctx, x, y, 30 * scale * size, angle, "rgba(16, 86, 96, 0.78)", "rgba(244, 252, 250, 0.9)");
  }

  drawFish(
    ctx,
    swim(0.22, 0.000018, time, width),
    height * 0.46 + Math.sin(time * 0.0005) * 20 + drift,
    78 * scale,
    Math.sin(time * 0.0007) * 0.12,
    "rgba(10, 62, 72, 0.82)",
    "rgba(255, 255, 255, 0.82)",
  );

  drawJelly(ctx, {
    x: width * (0.22 + Math.sin(time * 0.00011) * 0.04),
    y: height * 0.28 + Math.cos(time * 0.00018) * 18 + drift * 0.4,
    radius: 26 * scale,
    time,
    bell: "rgba(226, 246, 244, 0.72)",
    tentacle: "rgba(18, 96, 106, 0.45)",
    glow: false,
  });
  drawJelly(ctx, {
    x: width * (0.72 + Math.cos(time * 0.00009) * 0.05),
    y: height * 0.5 + Math.sin(time * 0.00015) * 22 + drift * 0.3,
    radius: 18 * scale,
    time: time + 4000,
    bell: "rgba(186, 220, 216, 0.55)",
    tentacle: "rgba(14, 78, 88, 0.35)",
    glow: false,
  });
}

function drawDeepSea(ctx, width, height, time, scale, drift) {
  drawSiphonophore(ctx, width * 0.18, height * 0.12, height * 0.62, time, scale);
  drawAngler(ctx, swim(0.48, 0.000012, time, width), height * 0.46 + drift, 120 * scale, time);
  drawDragonfish(ctx, swim(0.7, -0.000016, time, width), height * 0.68 + Math.sin(time * 0.0004) * 12, 150 * scale, time);

  const lights = [
    [0.08, 0.42, 0.7],
    [0.16, 0.5, 0.45],
    [0.24, 0.36, 0.55],
    [0.33, 0.58, 0.4],
    [0.44, 0.33, 0.6],
    [0.57, 0.6, 0.35],
    [0.66, 0.4, 0.5],
    [0.78, 0.52, 0.42],
    [0.88, 0.34, 0.62],
  ];
  for (const [phase, band, size] of lights) {
    const x = swim(phase, -0.00002, time, width);
    const y = height * band + Math.sin(time * 0.0008 + phase * 8) * 14 + drift * 0.5;
    drawFish(ctx, x, y, 22 * scale * size, Math.PI + Math.sin(time * 0.001 + phase) * 0.2, "rgba(6, 14, 18, 0.2)", "rgba(150, 230, 224, 0.15)");
    glowDot(ctx, x, y + 4 * scale, 2.2 * scale, "rgba(150, 236, 226, 0.95)", 10 * scale);
  }

  drawJelly(ctx, {
    x: width * (0.62 + Math.sin(time * 0.00008) * 0.06),
    y: height * 0.24 + Math.cos(time * 0.00012) * 16,
    radius: 34 * scale,
    time,
    bell: "rgba(150, 230, 224, 0.28)",
    tentacle: "rgba(150, 230, 224, 0.45)",
    glow: true,
  });
  drawJelly(ctx, {
    x: width * (0.38 + Math.cos(time * 0.0001) * 0.04),
    y: height * 0.58 + Math.sin(time * 0.00014) * 18 + drift * 0.2,
    radius: 20 * scale,
    time: time + 8000,
    bell: "rgba(186, 170, 255, 0.22)",
    tentacle: "rgba(190, 180, 255, 0.4)",
    glow: true,
  });
}

function swim(phase, speed, time, width) {
  const span = width + 220;
  const travel = phase + time * Math.abs(speed);
  const wrapped = (travel % 1 + 1) % 1;
  return speed < 0 ? span - 110 - wrapped * span : wrapped * span - 110;
}

function drawFish(ctx, x, y, length, angle, body, belly) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.ellipse(0, 0, length * 0.48, length * 0.16, 0, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(length * 0.05, length * 0.04, length * 0.32, length * 0.07, 0, 0, Math.PI * 2);
  ctx.fillStyle = belly;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-length * 0.36, 0);
  ctx.lineTo(-length * 0.68, -length * 0.16);
  ctx.lineTo(-length * 0.58, 0);
  ctx.lineTo(-length * 0.68, length * 0.16);
  ctx.closePath();
  ctx.fillStyle = body;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(length * 0.02, -length * 0.12);
  ctx.quadraticCurveTo(length * 0.08, -length * 0.28, -length * 0.08, -length * 0.14);
  ctx.fill();
  ctx.restore();
}

function drawJelly(ctx, { x, y, radius, time, bell, tentacle, glow }) {
  ctx.save();
  ctx.translate(x, y);
  if (glow) {
    const halo = ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius * 2.4);
    halo.addColorStop(0, bell);
    halo.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, radius, Math.PI, 0);
  ctx.quadraticCurveTo(radius * 0.55, radius * 0.45, radius * 0.2, radius * 0.18);
  ctx.quadraticCurveTo(0, radius * 0.5, -radius * 0.2, radius * 0.18);
  ctx.quadraticCurveTo(-radius * 0.55, radius * 0.45, -radius, 0);
  ctx.fillStyle = bell;
  ctx.fill();
  ctx.strokeStyle = tentacle;
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i += 1) {
    const root = -radius * 0.7 + i * radius * 0.28;
    ctx.beginPath();
    ctx.moveTo(root, radius * 0.12);
    ctx.bezierCurveTo(
      root + Math.sin(time * 0.001 + i) * 8,
      radius * 1.1,
      root - Math.sin(time * 0.0013 + i) * 10,
      radius * 2.1,
      root + Math.sin(time * 0.0008 + i * 1.7) * 12,
      radius * 3.1,
    );
    ctx.stroke();
  }
  ctx.restore();
}

function drawAngler(ctx, x, y, length, time) {
  const pulse = 0.65 + Math.sin(time * 0.003) * 0.35;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(time * 0.0005) * 0.08);
  ctx.beginPath();
  ctx.ellipse(0, 0, length * 0.42, length * 0.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(4, 8, 12, 0.72)";
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = "rgba(170, 230, 224, 0.45)";
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(length * 0.34, length * 0.02, length * 0.12, length * 0.16, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(length * 0.08, -length * 0.16);
  ctx.quadraticCurveTo(length * 0.28, -length * 0.46, length * 0.46, -length * 0.34);
  ctx.strokeStyle = "rgba(180, 236, 228, 0.7)";
  ctx.stroke();
  glowDot(ctx, length * 0.46, -length * 0.34, 4.5, `rgba(190, 255, 244, ${0.55 + pulse * 0.45})`, 28 * pulse);
  for (let i = 0; i < 5; i += 1) {
    glowDot(ctx, -length * 0.22 + i * length * 0.1, length * 0.1, 1.6, "rgba(140, 220, 255, 0.9)", 7);
  }
  ctx.restore();
}

function drawDragonfish(ctx, x, y, length, time) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI + Math.sin(time * 0.0006) * 0.06);
  ctx.beginPath();
  ctx.ellipse(0, 0, length * 0.48, length * 0.055, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(8, 16, 22, 0.55)";
  ctx.fill();
  ctx.strokeStyle = "rgba(160, 220, 230, 0.35)";
  ctx.stroke();
  for (let i = 0; i < 8; i += 1) {
    glowDot(ctx, -length * 0.32 + i * length * 0.08, length * 0.02, 1.5, "rgba(170, 245, 236, 0.95)", 6);
  }
  ctx.restore();
}

function drawSiphonophore(ctx, x, y, reach, time, scale) {
  ctx.save();
  ctx.translate(x + Math.sin(time * 0.0002) * 16, y);
  ctx.beginPath();
  const nodes = 11;
  for (let i = 0; i < nodes; i += 1) {
    const py = (reach / nodes) * i;
    const px = Math.sin(time * 0.00035 + i * 0.55) * 18;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = "rgba(160, 220, 230, 0.25)";
  ctx.lineWidth = 1;
  ctx.stroke();
  for (let i = 0; i < nodes; i += 1) {
    const py = (reach / nodes) * i;
    const px = Math.sin(time * 0.00035 + i * 0.55) * 18;
    glowDot(ctx, px, py, (i % 3 === 0 ? 3.4 : 2) * scale, "rgba(186, 250, 242, 0.9)", 14 * scale);
  }
  ctx.restore();
}

function glowDot(ctx, x, y, radius, color, halo) {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, halo);
  glow.addColorStop(0, color);
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, halo, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function fract(value) {
  return value - Math.floor(value);
}
