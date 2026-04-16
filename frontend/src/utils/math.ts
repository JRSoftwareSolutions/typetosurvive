export function lerp(a: number, b: number, t: number) {
  const tt = Math.max(0, Math.min(1, t));
  return a + (b - a) * tt;
}

