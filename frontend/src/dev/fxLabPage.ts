/** FX Lab entry: avoid importing gameplay modules in production so `dom/els` never binds to a torn-down DOM. */
if (!import.meta.env.DEV) {
  const panel = document.getElementById("fx-lab-panel");
  if (panel) {
    panel.innerHTML =
      "<h2>FX LAB</h2><p>This page is only available in development (<code>npm run dev</code>).</p>";
  }
} else {
  void import("./fxLabRuntime").then((m) => m.bootFxLab());
}
