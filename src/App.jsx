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
      <Ocean theme={theme} sectionId={active} />
      <div className="surface" aria-hidden="true" />
      <div className={turning ? "flash on" : "flash"} aria-hidden="true" />
      <div className="shell">
        <main className="stage">
          <h1>
            <span>My name is</span>
            <span>Nigora</span>
          </h1>
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
