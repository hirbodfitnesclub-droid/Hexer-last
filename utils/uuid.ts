export function newId(): string {
  const c = (typeof globalThis !== 'undefined' ? globalThis.crypto : undefined) as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  if (!c || typeof c.getRandomValues !== 'function') {
    throw new Error('[uuid] Secure crypto API unavailable; cannot generate a safe id.');
  }
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10xx
  const h = Array.from(b, x => x.toString(16).padStart(2, '0'));
  return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`;
}
