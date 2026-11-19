import { useEffect, useState } from "react";
import Ocean from "./Ocean.jsx";
import { SECTIONS, sectionFromHash } from "./sections.js";

export default function App() {
  const [theme, setTheme] = useState(initialTheme);
  const [active, setActive] = useState(() => sectionFromHash(window.location.hash));
  const [turning, setTurning] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("nigora-theme", theme);
    } catch {
      /* private mode */
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#0c0d0f" : "#f3f6f5");
  }, [theme]);

  useEffect(() => {
    const section = SECTIONS.find((item) => item.id === active);
    document.title = section ? `${section.label} · Nigora` : "Nigora";
  }, [active]);

  useEffect(() => {
    function onPop() {
      setActive(sectionFromHash(window.location.hash));
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    function onKey(event) {
      if (event.key !== "Escape" || !active) return;
      openSection(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches) return undefined;
    const root = document.documentElement;
    let tx = 0;
    let ty = 0;
    let x = 0;
    let y = 0;
    let frame = 0;
    let running = true;

    function onMove(event) {
      tx = event.clientX / Math.max(window.innerWidth, 1) - 0.5;
      ty = event.clientY / Math.max(window.innerHeight, 1) - 0.5;
    }

    function tick() {
      if (!running) return;
      x += (tx - x) * 0.06;
      y += (ty - y) * 0.06;
      root.style.setProperty("--current-x", x.toFixed(4));
      root.style.setProperty("--current-y", y.toFixed(4));
      frame = requestAnimationFrame(tick);
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    frame = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  function openSection(id) {
    const next = active === id ? null : id;
    const url = next ? `#${next}` : `${window.location.pathname}${window.location.search}`;
    window.history.pushState(null, "", url);
    setActive(next);
    setTurning(true);
    window.setTimeout(() => setTurning(false), 900);
  }

  const current = SECTIONS.find((section) => section.id === active);

  return (
    <>
      <div className="field" aria-hidden="true">
        <img className="for-light" src="/images/surface-pale.jpg" alt="" />
        <img className="for-dark" src="/images/ink-night.jpg" alt="" />
      </div>
      <Ocean theme={theme} sectionId={active} />
      <div className="surface" aria-hidden="true" />
      <div className={turning ? "flash on" : "flash"} aria-hidden="true" />
      <div className="shell">
        <main className="stage" data-open={current ? "true" : "false"}>
          <div className="prints">
            <div className="drift">
              <figure className="print print-shafts">
                <img src="/images/shafts-teal.jpg" alt="" />
              </figure>
              <figure className="print print-surface">
                <img className="for-light" src="/images/surface-pale.jpg" alt="" />
                <img className="for-dark" src="/images/ink-night.jpg" alt="" />
              </figure>
              <figure className="print print-caustic">
                <img src="/images/caustic-sand.jpg" alt="" />
              </figure>
            </div>
          </div>
          <div className={turning ? "waterline surge" : "waterline"} aria-hidden="true">
            <svg viewBox="0 0 200 40" preserveAspectRatio="none">
              <path d="M0 16 Q 25 4 50 16 T 100 16 T 150 16 T 200 16" />
              <path d="M0 26 Q 25 16 50 26 T 100 26 T 150 26 T 200 26" />
            </svg>
          </div>
          <div className="name">
            <h1>
              <span>My name is</span>
              <span>Nigora</span>
            </h1>
          </div>
          <section aria-label={current ? current.label : undefined} hidden={!current}>
            {current ? <h2 className="sr-only">{current.label}</h2> : null}
          </section>
        </main>
        <aside className="rail">
          <nav aria-label="Sections">
            <ul>
              {SECTIONS.map((section) => {
                const on = section.id === active;
                return (
                  <li key={section.id}>
                    <button
                      type="button"
                      aria-current={on ? "page" : undefined}
                      onClick={() => openSection(section.id)}
                    >
                      {section.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
          <button
            type="button"
            className="theme"
            aria-pressed={theme === "dark"}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </aside>
      </div>
    </>
  );
}

function initialTheme() {
  if (document.documentElement.dataset.theme === "dark") return "dark";
  try {
    return localStorage.getItem("nigora-theme") === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
