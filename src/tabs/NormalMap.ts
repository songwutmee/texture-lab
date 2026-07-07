import { captureGenOutput } from './TextureGen';
import { downloadCanvas } from '../export';
import { $, gf, gc, setVal } from '../ui/controls';
import { toast } from '../ui/toast';

type SlotKey = 'src' | 'nrm' | 'dsp' | 'ao';

let source: ImageData | null = null;
const canvases: Record<SlotKey, HTMLCanvasElement> = {} as Record<SlotKey, HTMLCanvasElement>;
let switchTab: (id: string) => void = () => {};

function readImage(file: File) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const oc = document.createElement('canvas');
    oc.width = img.width; oc.height = img.height;
    const ctx = oc.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    source = ctx.getImageData(0, 0, img.width, img.height);
    URL.revokeObjectURL(url);
    setup(img.width, img.height);
    canvases.src.getContext('2d')!.putImageData(source, 0, 0);
    $('nm-info').innerHTML = `<b>${file.name}</b> · ${img.width}×${img.height}`;
    process();
  };
  img.src = url;
}

// pull the current generator output straight into the normal-map tool
function useGenAsSource() {
  const size = 512;
  source = captureGenOutput(size);
  setup(size, size);
  canvases.src.getContext('2d')!.putImageData(source, 0, 0);
  $('nm-info').innerHTML = `<b>generator output</b> · ${size}×${size}`;
  switchTab('nm');
  process();
}

function setup(w: number, h: number) {
  (['src', 'nrm', 'dsp', 'ao'] as SlotKey[]).forEach(k => {
    const wrap = $('nm-' + k);
    wrap.innerHTML = '';
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    wrap.appendChild(cv);
    canvases[k] = cv;
  });
}

let queued = false;
function process() {
  if (!source || queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; compute(); });
}

function compute() {
  if (!source) return;
  const t0 = performance.now();
  const { width: w, height: h, data: src } = source;
  const str = gf('nm-str'), lvl = parseInt(($('nm-lvl') as HTMLInputElement).value), blurAmt = gf('nm-blur');
  const filter = ($('nm-filter') as HTMLSelectElement).value, z = gf('nm-z');
  const ir = gc('nm-ir'), ig = gc('nm-ig'), ih = gc('nm-ih');
  const aoP = gf('nm-aop'), dc = gf('nm-dc');

  let gray: Float32Array<ArrayBuffer> = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const lum = 0.299 * src[i * 4] / 255 + 0.587 * src[i * 4 + 1] / 255 + 0.114 * src[i * 4 + 2] / 255;
    gray[i] = ih ? 1 - lum : lum;
  }
  if (blurAmt !== 0) gray = blur(gray, w, h, blurAmt);

  const nrm = new Uint8ClampedArray(w * h * 4);
  const dsp = new Uint8ClampedArray(w * h * 4);
  const ao = new Uint8ClampedArray(w * h * 4);
  const ix = (x: number, y: number) => ((y + h) % h) * w + ((x + w) % w);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = gray[ix(x - lvl, y - lvl)], tr = gray[ix(x + lvl, y - lvl)];
      const bl = gray[ix(x - lvl, y + lvl)], br = gray[ix(x + lvl, y + lvl)];
      const l = gray[ix(x - lvl, y)], r = gray[ix(x + lvl, y)];
      const d = gray[ix(x, y - lvl)], u = gray[ix(x, y + lvl)];

      let dX: number, dY: number;
      if (filter === 'sobel') {
        dX = (tr + 2 * r + br) - (tl + 2 * l + bl);
        dY = (bl + 2 * d + br) - (tl + 2 * u + tr);
      } else {
        dX = (3 * tr + 10 * r + 3 * br) - (3 * tl + 10 * l + 3 * bl);
        dY = (3 * bl + 10 * d + 3 * br) - (3 * tl + 10 * u + 3 * tr);
      }
      dX *= str; dY *= str;

      let nx = -dX, ny = -dY, nz = z;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx /= len; ny /= len; nz /= len;
      if (ir) nx = -nx;
      if (ig) ny = -ny;

      const o = (y * w + x) * 4;
      nrm[o] = (nx * 0.5 + 0.5) * 255;
      nrm[o + 1] = (ny * 0.5 + 0.5) * 255;
      nrm[o + 2] = (nz * 0.5 + 0.5) * 255;
      nrm[o + 3] = 255;

      const hv = Math.min(1, Math.pow(gray[y * w + x], 1 / Math.max(dc, 0.01)) * dc) * 255;
      dsp[o] = dsp[o + 1] = dsp[o + 2] = hv; dsp[o + 3] = 255;

      let sum = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) sum += gray[ix(x + dx, y + dy)];
      const avg = sum / 25;
      let aoV = 1 - Math.max(0, avg - gray[y * w + x]) * aoP * 3;
      aoV = Math.min(1, Math.max(0, aoV)) * 255;
      ao[o] = ao[o + 1] = ao[o + 2] = aoV; ao[o + 3] = 255;
    }
  }

  canvases.nrm.getContext('2d')!.putImageData(new ImageData(nrm, w, h), 0, 0);
  canvases.dsp.getContext('2d')!.putImageData(new ImageData(dsp, w, h), 0, 0);
  canvases.ao.getContext('2d')!.putImageData(new ImageData(ao, w, h), 0, 0);
  $('nm-info').innerHTML = `processed in <b>${(performance.now() - t0).toFixed(0)}ms</b> · ${w}×${h}`;
}

function blur(gray: Float32Array, w: number, h: number, amt: number): Float32Array<ArrayBuffer> {
  const out = new Float32Array(gray.length);
  const r = Math.max(1, Math.round(Math.abs(amt)));
  const ix = (x: number, y: number) => ((y + h) % h) * w + ((x + w) % w);
  if (amt > 0) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let sum = 0, cnt = 0;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { sum += gray[ix(x + dx, y + dy)]; cnt++; }
      out[y * w + x] = sum / cnt;
    }
  } else {
    const bl = blur(gray, w, h, -amt); // negative = sharpen (unsharp mask)
    for (let i = 0; i < gray.length; i++)
      out[i] = Math.min(1, Math.max(0, gray[i] + (gray[i] - bl[i]) * Math.abs(amt)));
  }
  return out;
}

function download(which: SlotKey) {
  const cv = canvases[which];
  if (!cv) { toast('Load an image first'); return; }
  const names: Record<SlotKey, string> = { src: 'height', nrm: 'normal', dsp: 'displacement', ao: 'ao' };
  downloadCanvas(cv, names[which] + '_map.png');
}

function downloadAll() {
  if (!canvases.nrm) { toast('Load an image first'); return; }
  (['nrm', 'dsp', 'ao'] as SlotKey[]).forEach((k, i) => setTimeout(() => download(k), i * 250));
  toast('Downloading all maps');
}

function reset() {
  const d: Record<string, number> = { 'nm-str': 4, 'nm-lvl': 1, 'nm-blur': 0, 'nm-z': 1, 'nm-aop': 1, 'nm-dc': 1 };
  for (const id in d) { const el = $(id) as HTMLInputElement; el.value = String(d[id]); setVal(el); }
  ['nm-ir', 'nm-ig', 'nm-ih'].forEach(id => (($(id) as HTMLInputElement).checked = false));
  process();
}

function wireEvents() {
  const page = $('page-nm');

  page.addEventListener('input', e => {
    const t = e.target as HTMLInputElement;
    if (t.type === 'range') { setVal(t); process(); }
  });
  page.addEventListener('change', e => {
    const t = e.target as HTMLElement;
    if (t.tagName === 'SELECT' || (t as HTMLInputElement).type === 'checkbox') process();
  });
  page.addEventListener('click', e => {
    const el = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
    if (!el) return;
    const a = el.dataset.action!;
    if (a === 'use-gen') useGenAsSource();
    else if (a === 'download') download(el.dataset.map as SlotKey);
    else if (a === 'download-all') downloadAll();
    else if (a === 'nm-reset') reset();
  });

  const drop = $('drop');
  drop.addEventListener('click', () => ($('nm-file') as HTMLInputElement).click());
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', e => {
    e.preventDefault();
    drop.classList.remove('over');
    const f = e.dataTransfer?.files[0];
    if (f && f.type.startsWith('image/')) readImage(f);
  });
  ($('nm-file') as HTMLInputElement).addEventListener('change', e => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) readImage(f);
  });
}

export function initNormalMap(onSwitchTab: (id: string) => void) {
  switchTab = onSwitchTab;
  wireEvents();
}
