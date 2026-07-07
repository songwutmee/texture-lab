export type PBRMap = 'Base' | 'Normal' | 'Rough' | 'Height' | 'AO';

export const PBR_MAPS: PBRMap[] = ['Base', 'Normal', 'Rough', 'Height', 'AO'];

// wrap-around index so derivation tiles seamlessly
const idx = (x: number, y: number, s: number) => ((y + s) % s) * s + ((x + s) % s);

// Build one RGBA buffer for the requested PBR map from a height field (values 0..1).
export function derive(map: PBRMap, h: Float32Array, size: number): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(size * size * 4);
  const set = (i: number, r: number, g: number, b: number) => {
    const o = i * 4; out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      if (map === 'Normal') {
        const l = h[idx(x - 1, y, size)], r = h[idx(x + 1, y, size)];
        const d = h[idx(x, y - 1, size)], u = h[idx(x, y + 1, size)];
        const nx = (l - r) * 3, ny = (d - u) * 3, nz = 1;
        const len = Math.hypot(nx, ny, nz);
        set(i, (nx / len * 0.5 + 0.5) * 255, (ny / len * 0.5 + 0.5) * 255, (nz / len * 0.5 + 0.5) * 255);
      } else if (map === 'Rough') {
        const v = (1 - h[i] * 0.6) * 255; set(i, v, v, v);
      } else if (map === 'AO') {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sum += h[idx(x + dx, y + dy, size)];
        const ao = Math.min(1, 0.5 + (h[i] - sum / 9) * 4 + 0.5) * 255; set(i, ao, ao, ao);
      } else {
        const v = h[i] * 255; set(i, v, v, v); // Base + Height are the raw field
      }
    }
  }
  return out;
}
