export type FlowGaugeAddArgs = {
  streak: number;
  softCap: number;
  baseAdd: number;
  multAdd: number;
};

export function flowGaugeAddForStreak({
  streak,
  softCap,
  baseAdd,
  multAdd,
}: FlowGaugeAddArgs) {
  const s = Math.max(1, Math.min(softCap, Math.trunc(Number(streak) || 1)));
  return baseAdd + s * multAdd;
}

export type EffectDto = {
  expiresAt?: number;
  targets?: "others" | string[] | unknown;
  sourcePlayerId?: string;
};

export type DeriveActiveEffectsArgs = {
  effects: unknown;
  myPlayerId: string | null;
  now: number;
};

export function deriveActiveEffects({ effects, myPlayerId, now }: DeriveActiveEffectsArgs) {
  const list = Array.isArray(effects) ? (effects as EffectDto[]) : [];
  const myId = myPlayerId;
  const t = typeof now === "number" ? now : Date.now();

  return list.filter((e) => {
    if (!e || typeof e.expiresAt !== "number" || e.expiresAt <= t) return false;
    if (e.targets === "others") return e.sourcePlayerId !== myId;
    if (Array.isArray(e.targets)) return Boolean(myId) && (e.targets as string[]).includes(myId);
    return false;
  });
}

