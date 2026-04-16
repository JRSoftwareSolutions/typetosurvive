export function flowGaugeAddForStreak({
  streak,
  softCap,
  baseAdd,
  multAdd,
}) {
  const s = Math.max(1, Math.min(softCap, Math.trunc(Number(streak) || 1)));
  return baseAdd + s * multAdd;
}

export function deriveActiveEffects({ effects, myPlayerId, now }) {
  const list = Array.isArray(effects) ? effects : [];
  const myId = myPlayerId;
  const t = typeof now === "number" ? now : Date.now();

  return list.filter((e) => {
    if (!e || typeof e.expiresAt !== "number" || e.expiresAt <= t) return false;
    if (e.targets === "others") return e.sourcePlayerId !== myId;
    if (Array.isArray(e.targets)) return e.targets.includes(myId);
    return false;
  });
}

