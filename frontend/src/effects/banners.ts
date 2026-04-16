export function ensureEffectBanner() {
  const existing = document.getElementById("effect-banner");
  if (existing) return existing;
  const banner = document.createElement("div");
  banner.id = "effect-banner";
  banner.style.position = "absolute";
  banner.style.left = "50%";
  banner.style.top = "120px";
  banner.style.transform = "translateX(-50%)";
  banner.style.padding = "10px 18px";
  banner.style.border = "3px solid var(--neon-pink)";
  banner.style.borderRadius = "10px";
  banner.style.background = "rgba(0,0,0,0.8)";
  banner.style.color = "#ff00aa";
  banner.style.fontWeight = "800";
  banner.style.letterSpacing = "2px";
  banner.style.textShadow = "0 0 12px #ff00aa";
  banner.style.zIndex = "60";
  banner.style.display = "none";
  banner.textContent = "JAMMED!";
  document.body.appendChild(banner);
  return banner;
}

export function ensureSecondWindBanner() {
  const existing = document.getElementById("second-wind-banner");
  if (existing) return existing;
  const banner = document.createElement("div");
  banner.id = "second-wind-banner";
  banner.style.position = "absolute";
  banner.style.left = "50%";
  banner.style.top = "160px";
  banner.style.transform = "translateX(-50%)";
  banner.style.padding = "12px 20px";
  banner.style.border = "3px solid #00ff88";
  banner.style.borderRadius = "10px";
  banner.style.background = "rgba(0,0,0,0.82)";
  banner.style.color = "#00ff88";
  banner.style.fontWeight = "900";
  banner.style.letterSpacing = "2px";
  banner.style.textShadow = "0 0 14px rgba(0,255,136,0.7)";
  banner.style.zIndex = "60";
  banner.style.display = "none";
  banner.textContent = "SECOND WIND!";
  document.body.appendChild(banner);
  return banner;
}

