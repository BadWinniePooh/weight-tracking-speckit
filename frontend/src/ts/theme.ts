export function initTheme(): void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

  const mq = window.matchMedia("(prefers-color-scheme: dark)");

  function applyTheme(dark: boolean): void {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }

  applyTheme(mq.matches);
  mq.addEventListener("change", (e) => applyTheme(e.matches));
}

// Apply immediately on module load to prevent flash of wrong theme
initTheme();
