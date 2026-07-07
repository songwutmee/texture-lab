import { getGL, createProgram, drawQuad, glToCanvas, SHAPE_FRAG, GL, Program } from '../engine/WebGLEngine';
import { downloadCanvas } from '../export';
import { $, gf, gc, setVal } from '../ui/controls';
import { toast } from '../ui/toast';

export interface ShapeSettings {
  shape: number;
  p1: number; p2: number; p3: number; p4: number;
  rot: number; glow: number;
  ntype: number; blend: number; nmix: number;
  nscale: number; noct: number; ndist: number; nseed: number; npolar: boolean;
  cont: number; bri: number; inv: boolean;
  out: number;
}

interface ParamDef { l: string; min: number; max: number; step: number; v: number; }

interface ShapeDef { name: string; params: (ParamDef | null)[]; hint: string; }

const SHAPES: ShapeDef[] = [
  { name: 'Ring', params: [
      { l: 'Radius',    min: 0.05, max: 0.9,  step: 0.01,  v: 0.4 },
      { l: 'Thickness', min: 0.01, max: 0.5,  step: 0.01,  v: 0.15 },
      { l: 'Softness',  min: 0.005, max: 0.4, step: 0.005, v: 0.06 },
      null],
    hint: '<b>Ring</b>: shockwave, impact ring, portal edge. Add Perlin with Distort for a broken outline.' },
  { name: 'Spiral', params: [
      { l: 'Turns',    min: 0.5,  max: 10,  step: 0.1,   v: 3 },
      { l: 'Width',    min: 0.05, max: 0.95, step: 0.01, v: 0.5 },
      { l: 'Softness', min: 0.005, max: 0.3, step: 0.005, v: 0.05 },
      null],
    hint: '<b>Spiral</b>: portal, vortex, drill charge. Polar Ridge noise turns it into a churning portal.' },
  { name: 'Spider Web', params: [
      { l: 'Spokes', min: 3, max: 24, step: 1, v: 10 },
      { l: 'Rings',  min: 2, max: 12, step: 1, v: 5 },
      { l: 'Line W', min: 0.002, max: 0.05, step: 0.001, v: 0.012 },
      { l: 'Sag',    min: 0, max: 0.5, step: 0.01, v: 0.15 }],
    hint: '<b>Spider Web</b>: cracked glass, web, shatter decal. Sag bends the threads between spokes.' },
  { name: 'Blob', params: [
      { l: 'Radius',  min: 0.1,  max: 0.9, step: 0.01, v: 0.5 },
      { l: 'Falloff', min: 0.02, max: 0.8, step: 0.01, v: 0.3 },
      null, null],
    hint: '<b>Blob</b>: smoke puff, soft glow, cloud mask. Add Curl noise and Distort for organic smoke.' },
  { name: 'Streak', params: [
      { l: 'Length', min: 0.1,  max: 1.5, step: 0.01, v: 0.8 },
      { l: 'Width',  min: 0.01, max: 0.4, step: 0.01, v: 0.08 },
      { l: 'Count',  min: 1, max: 8, step: 1, v: 1 },
      null],
    hint: '<b>Streak</b>: lens flare, muzzle flash, hit sparks. Count spreads copies around the center.' },
  { name: 'Radial Grad', params: [
      { l: 'Power',  min: 0.2, max: 6,   step: 0.05, v: 2 },
      { l: 'Offset', min: -0.5, max: 0.5, step: 0.01, v: 0 },
      null, null],
    hint: '<b>Radial Gradient</b>: aura, light burst, glow base. The falloff every additive particle starts from.' },
  { name: 'Arc / Slash', params: [
      { l: 'Radius',    min: 0.1, max: 0.9,  step: 0.01,  v: 0.55 },
      { l: 'Thickness', min: 0.02, max: 0.5, step: 0.01,  v: 0.2 },
      { l: 'Softness',  min: 0.005, max: 0.3, step: 0.005, v: 0.06 },
      { l: 'Sweep',     min: 0.05, max: 1,   step: 0.01,  v: 0.45 }],
    hint: '<b>Arc</b>: sword slash, crescent trail. Sweep sets how far it wraps, the tips taper on their own. Use Rotation to aim it.' },
  { name: 'Rays', params: [
      { l: 'Count', min: 2, max: 24, step: 1, v: 12 },
      { l: 'Width', min: 0.05, max: 1, step: 0.01, v: 0.35 },
      { l: 'Softness', min: 0.005, max: 0.5, step: 0.005, v: 0.15 },
      { l: 'Hole', min: 0, max: 0.8, step: 0.01, v: 0 }],
    hint: '<b>Rays</b>: sunburst, holy light, anime impact frame. Hole opens the center to leave a ring of rays.' },
  { name: 'Lightning', params: [
      { l: 'Jag',    min: 0.05, max: 1,   step: 0.01, v: 0.35 },
      { l: 'Width',  min: 0.005, max: 0.15, step: 0.005, v: 0.03 },
      { l: 'Detail', min: 1, max: 12, step: 0.5, v: 5 },
      { l: 'Halo',   min: 0, max: 1, step: 0.01, v: 0.4 }],
    hint: '<b>Lightning</b>: bolt, electric arc, tesla coil. Change the Seed for a new strike, Detail adds kinks.' },
  { name: 'Hex Grid', params: [
      { l: 'Cells',  min: 2, max: 20, step: 0.5, v: 6 },
      { l: 'Line W', min: 0.005, max: 0.15, step: 0.005, v: 0.04 },
      { l: 'Softness', min: 0.002, max: 0.1, step: 0.002, v: 0.02 },
      { l: 'Rim',    min: 0, max: 1, step: 0.01, v: 0.5 }],
    hint: '<b>Hex Grid</b>: sci-fi shield, energy barrier. Rim brightens the outer edge like a fresnel.' },
];

const DEFAULTS: ShapeSettings = {
  shape: 0, p1: 0.4, p2: 0.15, p3: 0.06, p4: 0,
  rot: 0, glow: 0,
  ntype: 0, blend: 0, nmix: 0, nscale: 4, noct: 4, ndist: 0, nseed: 7, npolar: false,
  cont: 1, bri: 0, inv: false, out: 1,
};

// composition recipes: shape x noise
const PRESETS: { name: string; s: Partial<ShapeSettings> }[] = [
  { name: 'Shockwave',   s: { shape: 0, p1: 0.45, p2: 0.18, p3: 0.1, ndist: 0.25, nmix: 0.55, ntype: 0, blend: 0, nscale: 4, glow: 0.15 } },
  { name: 'Portal Swirl', s: { shape: 1, p1: 3.5, p2: 0.5, p3: 0.06, nmix: 0.5, ntype: 1, blend: 0, nscale: 3, npolar: true, glow: 0.25 } },
  { name: 'Muzzle Flash', s: { shape: 4, p1: 0.9, p2: 0.07, p3: 4, glow: 0.7, nmix: 0.25, ntype: 4, blend: 0 } },
  { name: 'Magic Circle', s: { shape: 2, p1: 12, p2: 5, p3: 0.012, p4: 0.12, glow: 0.2 } },
  { name: 'Smoke Puff',  s: { shape: 3, p1: 0.5, p2: 0.35, ndist: 0.3, nmix: 0.65, ntype: 3, blend: 0, nscale: 3 } },
  { name: 'Lens Flare',  s: { shape: 4, p1: 1.2, p2: 0.045, p3: 1, glow: 0.55, nmix: 0.15, ntype: 4, blend: 0 } },
  { name: 'Expl. Crown', s: { shape: 3, p1: 0.45, p2: 0.2, ndist: 0.45, nmix: 0.6, ntype: 0, blend: 0, nscale: 5, npolar: true } },
  { name: 'Impact Sparks', s: { shape: 4, p1: 0.7, p2: 0.015, p3: 7, glow: 0.3, nmix: 0.5, ntype: 4, blend: 0 } },
  { name: 'Sword Slash', s: { shape: 6, p1: 0.55, p2: 0.2, p3: 0.06, p4: 0.45, rot: 45, ndist: 0.12, nmix: 0.35, ntype: 0, blend: 0, nscale: 4 } },
  { name: 'Sun Rays',    s: { shape: 7, p1: 12, p2: 0.35, p3: 0.2, p4: 0, glow: 0.35 } },
  { name: 'Lightning',   s: { shape: 8, p1: 0.35, p2: 0.025, p3: 5, p4: 0.45, cont: 1.2 } },
  { name: 'Hex Shield',  s: { shape: 9, p1: 6, p2: 0.05, p3: 0.02, p4: 0.7 } },
];

// ---- module state ----
let curShape = 0;
let canvas: HTMLCanvasElement, gl: GL, prog: Program;
let offCanvas: HTMLCanvasElement | null = null;
let offGL: GL, offProg: Program;

function drawShape(g: GL, p: Program, w: number, h: number, s: ShapeSettings) {
  drawQuad(g, p, w, h, {
    u_rot: s.rot, u_glow: s.glow,
    u_p1: s.p1, u_p2: s.p2, u_p3: s.p3, u_p4: s.p4,
    u_nmix: s.nmix, u_nscale: s.nscale, u_noct: s.noct,
    u_ndist: s.ndist, u_nseed: s.nseed, u_npolar: s.npolar ? 1 : 0,
    u_cont: s.cont, u_bri: s.bri, u_inv: s.inv ? 1 : 0,
  }, {
    u_shape: s.shape, u_ntype: s.ntype, u_blend: s.blend, u_out: s.out,
  });
}

function readShape(): ShapeSettings {
  return {
    shape: curShape,
    p1: gf('s-p1'), p2: gf('s-p2'), p3: gf('s-p3'), p4: gf('s-p4'),
    rot: gf('s-rot'), glow: gf('s-glow'),
    ntype: parseInt(($('s-ntype') as HTMLSelectElement).value),
    blend: parseInt(($('s-blend') as HTMLSelectElement).value),
    nmix: gf('s-nmix'), nscale: gf('s-nscale'), noct: gf('s-noct'),
    ndist: gf('s-ndist'), nseed: gf('s-seed'), npolar: gc('s-npolar'),
    cont: gf('s-cont'), bri: gf('s-bri'), inv: gc('s-inv'),
    out: parseInt(($('s-out') as HTMLSelectElement).value),
  };
}

function writeShape(s: Partial<ShapeSettings>) {
  if (s.shape !== undefined) selectShape(s.shape, false);
  const sliders: Record<string, string> = {
    p1: 's-p1', p2: 's-p2', p3: 's-p3', p4: 's-p4', rot: 's-rot', glow: 's-glow',
    nmix: 's-nmix', nscale: 's-nscale', noct: 's-noct', ndist: 's-ndist',
    nseed: 's-seed', cont: 's-cont', bri: 's-bri',
  };
  for (const k in sliders) {
    const v = (s as Record<string, unknown>)[k];
    if (v !== undefined) { const el = $(sliders[k]) as HTMLInputElement; el.value = String(v); setVal(el); }
  }
  if (s.ntype !== undefined) ($('s-ntype') as HTMLSelectElement).value = String(s.ntype);
  if (s.blend !== undefined) ($('s-blend') as HTMLSelectElement).value = String(s.blend);
  if (s.out !== undefined) ($('s-out') as HTMLSelectElement).value = String(s.out);
  if (s.npolar !== undefined) ($('s-npolar') as HTMLInputElement).checked = s.npolar;
  if (s.inv !== undefined) ($('s-inv') as HTMLInputElement).checked = s.inv;
}

// ---- rendering ----
function render() {
  const t0 = performance.now();
  drawShape(gl, prog, canvas.width, canvas.height, readShape());
  $('s-ms').textContent = (performance.now() - t0).toFixed(1) + 'ms';
}

let queued = false;
function renderQueued() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; render(); });
}

function ensureOff(size: number) {
  if (!offCanvas) {
    offCanvas = document.createElement('canvas');
    offGL = getGL(offCanvas, { premultipliedAlpha: false });
    offProg = createProgram(offGL, SHAPE_FRAG);
  }
  if (offCanvas.width !== size) offCanvas.width = offCanvas.height = size;
}

function renderOff(size: number, s: ShapeSettings) {
  ensureOff(size);
  drawShape(offGL, offProg, size, size, s);
}

// current settings for the shareable URL hash
export function getShapeState(): Partial<ShapeSettings> {
  return readShape();
}

export function applyShapeState(s: Partial<ShapeSettings>) {
  writeShape({ ...DEFAULTS, ...s });
  renderQueued();
}

// ---- shape selection ----
function selectShape(idx: number, record: boolean) {
  curShape = idx;
  document.querySelectorAll('#shape-list .type').forEach((b, i) => b.classList.toggle('active', i === idx));
  const def = SHAPES[idx];
  $('s-name').textContent = def.name;
  $('s-hint').innerHTML = def.hint;

  def.params.forEach((p, i) => {
    const row = $('s-p' + (i + 1)).parentElement as HTMLElement;
    row.style.display = p ? 'flex' : 'none';
    if (!p) return;
    const el = $('s-p' + (i + 1)) as HTMLInputElement;
    (row.querySelector('label') as HTMLElement).textContent = p.l;
    el.min = String(p.min); el.max = String(p.max); el.step = String(p.step);
    el.value = String(p.v);
    setVal(el);
  });
  if (record) renderQueued();
}

function buildShapeList() {
  const list = $('shape-list');
  SHAPES.forEach((def, i) => {
    const b = document.createElement('button');
    b.className = 'type' + (i === 0 ? ' active' : '');
    b.innerHTML = `<span class="num">${i + 1}</span>${def.name}`;
    b.onclick = () => selectShape(i, true);
    list.appendChild(b);
  });
}

function buildPresets() {
  const grid = $('shape-preset-grid');
  PRESETS.forEach(preset => {
    const cell = document.createElement('div');
    cell.className = 'preset';
    cell.title = preset.name;
    const cv = document.createElement('canvas');
    cv.width = cv.height = 72;
    cell.appendChild(cv);
    const name = document.createElement('div');
    name.className = 'pname';
    name.textContent = preset.name;
    cell.appendChild(name);
    grid.appendChild(cell);

    renderOff(72, { ...DEFAULTS, ...preset.s, out: 0 });
    cv.getContext('2d')!.drawImage(glToCanvas(offGL, 72), 0, 0);

    cell.onclick = () => {
      writeShape({ ...DEFAULTS, ...preset.s });
      renderQueued();
      toast('Preset: ' + preset.name);
    };
  });
}

// ---- export ----
function exportShape(size: number) {
  const s = readShape();
  renderOff(size, s);
  const name = SHAPES[s.shape].name.toLowerCase().replace(/[^a-z]+/g, '');
  downloadCanvas(glToCanvas(offGL, size), `${name}_${size}.png`);
  toast(`Saved ${size}px PNG`);
}

function reset() {
  writeShape(DEFAULTS);
  selectShape(0, false);
  renderQueued();
  toast('Reset');
}

function wireEvents() {
  const page = $('page-shape');
  page.addEventListener('input', e => {
    const t = e.target as HTMLInputElement;
    if (t.type === 'range' || t.type === 'number') { setVal(t); renderQueued(); }
  });
  page.addEventListener('change', e => {
    const t = e.target as HTMLElement;
    if (t.tagName === 'SELECT' || (t as HTMLInputElement).type === 'checkbox') renderQueued();
  });
  page.addEventListener('click', e => {
    const btn = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
    if (!btn) return;
    const a = btn.dataset.action!;
    if (a === 'export') exportShape(parseInt(btn.dataset.size!));
    else if (a === 'shape-reset') reset();
  });
}

export function initShapeVFX() {
  canvas = $('shape-canvas') as HTMLCanvasElement;
  // straight alpha, so White + Alpha output previews correctly over the checkerboard
  gl = getGL(canvas, { premultipliedAlpha: false });
  prog = createProgram(gl, SHAPE_FRAG);

  buildShapeList();
  buildPresets();
  wireEvents();
  selectShape(0, false);
  render();
}
