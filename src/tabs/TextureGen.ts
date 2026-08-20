import { getGL, createProgram, drawNoise, glToCanvas, NOISE_FRAG, GL, Program, Settings, Pan } from '../engine/WebGLEngine';
import { derive, PBRMap, PBR_MAPS } from '../engine/PBRDeriver';
import { History } from '../history';
import { downloadCanvas, downloadBlob, canvasToPNGBytes } from '../export';
import { makeZip } from '../zip';
import { $, gf, gc, setVal } from '../ui/controls';
import { toast } from '../ui/toast';

interface TypeDef { id: string; name: string; fbm: boolean; hint: string; }

const TYPES: TypeDef[] = [
  { id: 'perlin',  name: 'Perlin FBM',   fbm: true,
    hint: '<b>Perlin FBM</b> stacks noise octaves into organic cloud-like detail. The all-rounder for smoke, dissolve masks, terrain height, and clouds.' },
  { id: 'voronoi', name: 'Voronoi',      fbm: false,
    hint: '<b>Voronoi</b> shades by distance to the nearest scattered point. Use it for cracked ground, scales, stained glass, and cell-shaded edges.' },
  { id: 'worley',  name: 'Worley F2-F1', fbm: false,
    hint: '<b>Worley F2-F1</b> lights up the borders between cells. Great for soap foam, bubbles, wet rock, and magic-circle edges.' },
  { id: 'ridge',   name: 'Ridge',        fbm: true,
    hint: '<b>Ridge</b> flips each octave to carve sharp ridges. Reach for it on lightning, veins, mountain silhouettes, and energy bolts.' },
  { id: 'warp',    name: 'Domain Warp',  fbm: true,
    hint: '<b>Domain Warp</b> drags the sample point around with more noise. This is how you get lava, marble veins, and deep turbulent cloud.' },
  { id: 'curl',    name: 'Curl',         fbm: false,
    hint: '<b>Curl</b> builds a swirling, divergence-free flow from the noise gradient. Use it as a flow map for smoke, fluid, and portal swirls.' },
  { id: 'erosion', name: 'Erosion',      fbm: true,
    hint: '<b>Erosion</b> pushes the sample along its own slope to fake hydraulic wear. Good for weathered rock, dried mud, and worn metal.' },
  { id: 'spots',   name: 'Spots',        fbm: false,
    hint: '<b>Spots</b> scatters soft round blobs across the surface. Handy for dirt, rust, rain droplets, moss, and emissive spark points.' },
  { id: 'value',   name: 'Value Noise',  fbm: true,
    hint: '<b>Value Noise</b> interpolates random grid values. Softer and rounder than Perlin, nice for broad masks and gentle gradients.' },
  { id: 'white',   name: 'White Noise',  fbm: false,
    hint: '<b>White Noise</b> is raw per-pixel randomness. Use it for film grain, sparkle, TV static, and dithering inside shaders.' },
];

const TYPE_IDX: Record<string, number> = {};
TYPES.forEach((t, i) => (TYPE_IDX[t.id] = i));
export const typeIndexOf = (id: string) => TYPE_IDX[id] ?? 0;

const DEFAULTS: Settings = {
  type: 'perlin', seed: 42, scale: 4, oct: 5, lac: 2, per: 0.5, ws: 1.5, wf: 1,
  cont: 1, bri: 0, lo: 0, hi: 1, inv: false, seamless: false, tx: 1, ty: 1, out: 0,
};

// preset = partial settings snapshot merged over DEFAULTS
const PRESETS: { name: string; s: Partial<Settings> }[] = [
  { name: 'Fire',     s: { type: 'warp',    scale: 5,   oct: 5, lac: 2.2, per: 0.5,  ws: 3,   wf: 1.5, cont: 2.5, bri: 0.1,  lo: 0.1, hi: 0.9,  inv: false } },
  { name: 'Smoke',    s: { type: 'perlin',  scale: 3,   oct: 6, lac: 2,   per: 0.5,  ws: 0,   wf: 1,   cont: 1.4, bri: 0,    lo: 0,   hi: 0.85, inv: false } },
  { name: 'Dissolve', s: { type: 'perlin',  scale: 6,   oct: 4, lac: 1.8, per: 0.6,  ws: 0,   wf: 1,   cont: 3,   bri: 0,    lo: 0.2, hi: 0.8,  inv: false } },
  { name: 'Water',    s: { type: 'perlin',  scale: 8,   oct: 5, lac: 2,   per: 0.4,  ws: 0.3, wf: 1,   cont: 1.2, bri: 0.05, lo: 0.3, hi: 0.7,  inv: false } },
  { name: 'Crack',    s: { type: 'voronoi', scale: 5,   oct: 1, lac: 2,   per: 0.5,  ws: 0,   wf: 1,   cont: 3,   bri: -0.1, lo: 0,   hi: 1,    inv: true  } },
  { name: 'Marble',   s: { type: 'warp',    scale: 4,   oct: 6, lac: 2,   per: 0.5,  ws: 2,   wf: 2,   cont: 1.8, bri: 0,    lo: 0,   hi: 1,    inv: false } },
  { name: 'Cloud',    s: { type: 'perlin',  scale: 2.5, oct: 7, lac: 2,   per: 0.55, ws: 0,   wf: 1,   cont: 1.3, bri: 0.05, lo: 0.3, hi: 0.95, inv: false } },
  { name: 'Lava',     s: { type: 'warp',    scale: 4,   oct: 5, lac: 2,   per: 0.5,  ws: 3.5, wf: 1.5, cont: 2,   bri: 0,    lo: 0,   hi: 1,    inv: false } },
  { name: 'Bolt',     s: { type: 'ridge',   scale: 8,   oct: 7, lac: 2.5, per: 0.4,  ws: 0,   wf: 1,   cont: 5,   bri: 0,    lo: 0.5, hi: 1,    inv: false } },
  { name: 'Foam',     s: { type: 'worley',  scale: 7,   oct: 1, lac: 2,   per: 0.5,  ws: 0,   wf: 1,   cont: 3,   bri: 0,    lo: 0,   hi: 1,    inv: true  } },
  { name: 'Rust',     s: { type: 'spots',   scale: 6,   oct: 3, lac: 2,   per: 0.5,  ws: 0,   wf: 1,   cont: 2,   bri: 0,    lo: 0,   hi: 1,    inv: false } },
  { name: 'Rock',     s: { type: 'erosion', scale: 5,   oct: 6, lac: 2,   per: 0.5,  ws: 1.2, wf: 1,   cont: 1.8, bri: 0,    lo: 0,   hi: 1,    inv: false } },
];

// ---- module state ----
let curType = 'perlin';
let pan: Pan = { x: 0, y: 0 };

let texCanvas: HTMLCanvasElement, glMain: GL, mainProg: Program;
let history: History<Partial<Settings>>;
const pbrCanvases: Record<PBRMap, HTMLCanvasElement> = {} as Record<PBRMap, HTMLCanvasElement>;

// shared offscreen context reused for thumbnails, exports, and PBR readback
let offCanvas: HTMLCanvasElement | null = null;
let offGL: GL, offProg: Program;

export const readSettings = (): Settings => ({
  type: curType,
  seed: gf('g-seed'),
  scale: gf('g-scale'), oct: gf('g-oct'), lac: gf('g-lac'), per: gf('g-per'),
  ws: gf('g-ws'), wf: gf('g-wf'),
  cont: gf('g-cont'), bri: gf('g-bri'), lo: gf('g-lo'), hi: gf('g-hi'),
  inv: gc('g-inv'), seamless: gc('g-seamless'),
  tx: gf('g-tx'), ty: gf('g-ty'),
  out: parseInt(($('g-out') as HTMLSelectElement).value),
});

function writeSettings(s: Partial<Settings>) {
  if (s.type) selectType(s.type, false);
  const map: Record<string, string> = {
    seed: 'g-seed', scale: 'g-scale', oct: 'g-oct', lac: 'g-lac', per: 'g-per',
    ws: 'g-ws', wf: 'g-wf', cont: 'g-cont', bri: 'g-bri', lo: 'g-lo', hi: 'g-hi',
    tx: 'g-tx', ty: 'g-ty',
  };
  for (const k in map) {
    const v = (s as Record<string, unknown>)[k];
    if (v !== undefined) { const el = $(map[k]) as HTMLInputElement; el.value = String(v); setVal(el); }
  }
  if (s.inv !== undefined) ($('g-inv') as HTMLInputElement).checked = s.inv;
  if (s.seamless !== undefined) ($('g-seamless') as HTMLInputElement).checked = s.seamless;
  if (s.out !== undefined) ($('g-out') as HTMLSelectElement).value = String(s.out);
}

// ---- rendering ----
function drawMain() {
  const s = readSettings();
  const t0 = performance.now();
  drawNoise(glMain, mainProg, texCanvas.width, texCanvas.height, s, pan, typeIndexOf(s.type));
  $('m-time').textContent = (performance.now() - t0).toFixed(1) + 'ms';
  updatePBR();
}

let queued = false;
function renderGen() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; drawMain(); });
}

function onSlide(el: HTMLInputElement) { setVal(el); renderGen(); }

function ensureOff(size: number) {
  if (!offCanvas) {
    offCanvas = document.createElement('canvas');
    offGL = getGL(offCanvas);
    offProg = createProgram(offGL, NOISE_FRAG);
  }
  if (offCanvas.width !== size) offCanvas.width = offCanvas.height = size;
}

function renderOff(size: number, s: Settings) {
  ensureOff(size);
  drawNoise(offGL, offProg, size, size, s, pan, typeIndexOf(s.type));
}

// grayscale height field (0..1) at a given resolution, used by the PBR derivations
function renderHeight(size: number): Float32Array {
  const s = readSettings();
  s.out = 0;
  renderOff(size, s);
  const px = new Uint8Array(size * size * 4);
  offGL.readPixels(0, 0, size, size, offGL.RGBA, offGL.UNSIGNED_BYTE, px);
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const src = ((size - 1 - y) * size + x) * 4;
    out[y * size + x] = px[src] / 255;
  }
  return out;
}

// grayscale generator output as ImageData, for the Normal Map tab's "use output" bridge
export function captureGenOutput(size: number): ImageData {
  const s = readSettings();
  s.out = 0;
  renderOff(size, s);
  return glToCanvas(offGL, size).getContext('2d')!.getImageData(0, 0, size, size);
}

// current settings for the shareable URL hash
export function getGenState(): Partial<Settings> {
  return readSettings();
}

export function applyGenState(s: Partial<Settings>) {
  writeSettings(s);
  history.push();
  renderGen();
}

// ---- workflow ----
const rand = (min: number, max: number) => min + Math.random() * (max - min);

function randomizeAll() {
  const t = TYPES[Math.floor(Math.random() * TYPES.length)];
  selectType(t.id, false);
  ($('g-seed') as HTMLInputElement).value = String(Math.floor(rand(0, 9999)));
  const set = (id: string, v: string) => { ($(id) as HTMLInputElement).value = v; };
  set('g-scale', rand(2, 10).toFixed(1));
  set('g-oct', String(Math.floor(rand(3, 8))));
  set('g-lac', rand(1.8, 2.6).toFixed(2));
  set('g-per', rand(0.4, 0.6).toFixed(2));
  set('g-ws', (t.id === 'warp' ? rand(1, 3.5) : rand(0, 1)).toFixed(2));
  set('g-cont', rand(1, 3).toFixed(2));
  set('g-bri', rand(-0.1, 0.1).toFixed(2));
  ['g-scale', 'g-oct', 'g-lac', 'g-per', 'g-ws', 'g-cont', 'g-bri'].forEach(id => setVal($(id) as HTMLInputElement));
  history.push();
  renderGen();
  toast('Randomized');
}

function randomSeed() {
  ($('g-seed') as HTMLInputElement).value = String(Math.floor(Math.random() * 9999));
  history.push();
  renderGen();
}

function copySettings() {
  navigator.clipboard.writeText(JSON.stringify(readSettings()))
    .then(() => toast('Settings copied'))
    .catch(() => toast('Copy failed'));
}

function pasteSettings() {
  navigator.clipboard.readText().then(txt => {
    try {
      writeSettings(JSON.parse(txt));
      history.push();
      renderGen();
      toast('Settings pasted');
    } catch { toast('Clipboard is not valid settings'); }
  }).catch(() => toast('Paste failed'));
}

function resetAll() {
  writeSettings(DEFAULTS);
  pan = { x: 0, y: 0 };
  history.push();
  renderGen();
  toast('Reset to defaults');
}

// ---- type + preset UI ----
function selectType(id: string, record: boolean) {
  curType = id;
  document.querySelectorAll('.type').forEach(b => b.classList.toggle('active', (b as HTMLElement).dataset.type === id));
  const t = TYPES[typeIndexOf(id)];
  $('m-type').textContent = t.name;
  $('g-hint').innerHTML = t.hint;
  ($('warp-group')).style.display = id === 'warp' ? 'block' : 'none';
  document.querySelectorAll('[data-fbm]').forEach(el => ((el as HTMLElement).style.display = t.fbm ? 'flex' : 'none'));
  if (record) { history.push(); renderGen(); }
}

function buildTypeList() {
  const list = $('type-list');
  TYPES.forEach((t, i) => {
    const b = document.createElement('button');
    b.className = 'type' + (t.id === 'perlin' ? ' active' : '');
    b.dataset.type = t.id;
    b.innerHTML = `<span class="num">${i + 1}</span>${t.name}`;
    b.onclick = () => selectType(t.id, true);
    list.appendChild(b);
  });
}

function buildPresets() {
  const grid = $('preset-grid');
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

    renderOff(72, { ...DEFAULTS, ...preset.s });
    cv.getContext('2d')!.drawImage(glToCanvas(offGL, 72), 0, 0);

    cell.onclick = () => {
      writeSettings(preset.s);
      history.push();
      renderGen();
      toast('Preset: ' + preset.name);
    };
  });
}

// ---- PBR maps ----
function buildPBRGrid() {
  const grid = $('pbr-grid');
  PBR_MAPS.forEach(name => {
    const cell = document.createElement('div');
    cell.className = 'pbr-cell';
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    cv.title = 'Download ' + name;
    cv.onclick = () => downloadPBRMap(name, 512);
    const lbl = document.createElement('div');
    lbl.className = 'pbr-name';
    lbl.textContent = name;
    cell.appendChild(cv);
    cell.appendChild(lbl);
    grid.appendChild(cell);
    pbrCanvases[name] = cv;
  });
}

function updatePBR() {
  const size = 64;
  const h = renderHeight(size);
  PBR_MAPS.forEach(name => {
    const buf = derive(name, h, size);
    pbrCanvases[name].getContext('2d')!.putImageData(new ImageData(buf, size, size), 0, 0);
  });
}

function downloadPBRMap(name: PBRMap, size: number) {
  const h = renderHeight(size);
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  cv.getContext('2d')!.putImageData(new ImageData(derive(name, h, size), size, size), 0, 0);
  downloadCanvas(cv, `${name.toLowerCase()}_${size}.png`);
}

async function exportPBRZip() {
  const size = 512;
  toast('Zipping PBR maps…');
  const entries = await Promise.all(PBR_MAPS.map(async name => {
    const h = renderHeight(size);
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    cv.getContext('2d')!.putImageData(new ImageData(derive(name, h, size), size, size), 0, 0);
    const data = await canvasToPNGBytes(cv);
    return { name: `${curType}_${name.toLowerCase()}_${size}.png`, data };
  }));
  downloadBlob(makeZip(entries), `${curType}_pbr_maps.zip`);
  toast('Downloaded PBR maps.zip');
}

// ---- PNG + HLSL export ----
function exportTex(size: number) {
  renderOff(size, readSettings());
  downloadCanvas(glToCanvas(offGL, size), `${curType}_${size}.png`);
  toast(`Saved ${size}px PNG`);
}

function copyHLSL() {
  const s = readSettings();
  const snippets: Record<string, string> = {
    perlin:  `// ${TYPES[0].name} as dissolve / alpha mask\nfloat n = tex2D(_NoiseTex, i.uv * ${s.scale.toFixed(1)}).r;\nn = pow(n, ${s.cont.toFixed(2)});\nclip(n - _Cutoff);  // _Cutoff animates the dissolve`,
    voronoi: `// Voronoi cracks / cell edges\nfloat cell = tex2D(_VoroTex, i.uv).r;\nfloat edge = 1 - smoothstep(0, _EdgeWidth, cell);\ncol.rgb += edge * _EdgeColor;`,
    worley:  `// Worley foam / bubble borders\nfloat border = tex2D(_WorleyTex, i.uv).r;\ncol.rgb = lerp(col.rgb, _FoamColor, border);`,
    ridge:   `// Ridge lightning / energy veins\nfloat r = tex2D(_RidgeTex, i.uv).r;\nfloat bolt = pow(r, _Sharpness);\ncol.rgb += bolt * _EmissiveColor * _Intensity;`,
    warp:    `// Domain-warped lava / marble flow\nfloat2 flow = i.uv + _Time.y * _Speed;\nfloat n = tex2D(_WarpTex, flow).r;\ncol.rgb = lerp(_DarkColor, _HotColor, n);`,
    curl:    `// Curl flow map: distort UV over time\nfloat2 flow = tex2D(_FlowTex, i.uv).rg * 2 - 1;\nfloat2 uv = i.uv + flow * _DistortStrength * _Time.y;\ncol = tex2D(_MainTex, uv);`,
    erosion: `// Eroded surface detail\nfloat h = tex2D(_HeightTex, i.uv).r;\nfloat3 N = UnpackNormal(tex2D(_NormalTex, i.uv));\ncol.rgb *= lerp(0.6, 1.0, h);  // valleys darker`,
    spots:   `// Scattered dirt / rust spots\nfloat spot = tex2D(_SpotTex, i.uv).r;\ncol.rgb = lerp(col.rgb, _RustColor, spot * _RustAmount);`,
    value:   `// Soft value-noise mask\nfloat m = tex2D(_MaskTex, i.uv * ${s.scale.toFixed(1)}).r;\ncol.a *= m;`,
    white:   `// White-noise grain / sparkle\nfloat g = tex2D(_GrainTex, i.uv * _GrainScale + _Time.y).r;\ncol.rgb += (g - 0.5) * _GrainAmount;`,
  };
  navigator.clipboard.writeText(snippets[s.type] || snippets.perlin)
    .then(() => toast('HLSL snippet copied'))
    .catch(() => toast('Copy failed'));
}

// ---- pan (drag the canvas) ----
function initPan() {
  let dragging = false, lastX = 0, lastY = 0;
  texCanvas.addEventListener('mousedown', e => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    pan.x -= (e.clientX - lastX) / texCanvas.width;
    pan.y += (e.clientY - lastY) / texCanvas.height;
    lastX = e.clientX; lastY = e.clientY;
    renderGen();
  });
  window.addEventListener('mouseup', () => (dragging = false));
}

function updateHistButtons() {
  ($('btn-undo') as HTMLButtonElement).disabled = !history.canUndo;
  ($('btn-redo') as HTMLButtonElement).disabled = !history.canRedo;
}

const ACTIONS: Record<string, (btn: HTMLElement) => void> = {
  undo,
  redo,
  randomize: () => randomizeAll(),
  copy: () => copySettings(),
  paste: () => pasteSettings(),
  reset: () => resetAll(),
  seed: () => randomSeed(),
  'pbr-all': () => exportPBRZip(),
  hlsl: () => copyHLSL(),
  export: btn => exportTex(parseInt(btn.dataset.size!)),
};

// commit history a short moment after a slider settles
let commitTimer: number | undefined;
function scheduleHistory() {
  clearTimeout(commitTimer);
  commitTimer = window.setTimeout(() => history.push(), 400);
}

// undo/redo must not wait on the debounce, or a quick drag-then-Ctrl+Z looks like a no-op
function flushHistory() {
  clearTimeout(commitTimer);
  history.push();
}

function undo() { flushHistory(); history.undo(); }
function redo() { flushHistory(); history.redo(); }

function wireEvents() {
  const page = $('page-gen');

  page.addEventListener('input', e => {
    const t = e.target as HTMLInputElement;
    if (t.type === 'range') { onSlide(t); scheduleHistory(); }
    else if (t.id === 'g-seed') { renderGen(); scheduleHistory(); }
  });

  page.addEventListener('change', e => {
    const t = e.target as HTMLElement;
    if (t.tagName === 'SELECT' || (t as HTMLInputElement).type === 'checkbox') { history.push(); renderGen(); }
  });

  page.addEventListener('click', e => {
    const btn = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
    if (btn) ACTIONS[btn.dataset.action!]?.(btn);
  });
}

export interface GenHandlers {
  undo(): void;
  redo(): void;
  copy(): void;
  randomize(): void;
  exportPNG(size: number): void;
  selectByIndex(i: number): void;
}

export function initTextureGen(): GenHandlers {
  texCanvas = $('tex-canvas') as HTMLCanvasElement;
  glMain = getGL(texCanvas);
  mainProg = createProgram(glMain, NOISE_FRAG);
  history = new History<Partial<Settings>>(readSettings, writeSettings, () => { updateHistButtons(); renderGen(); });

  buildTypeList();
  buildPresets();
  buildPBRGrid();
  initPan();
  wireEvents();

  selectType('perlin', false);
  renderGen();
  history.push();
  updateHistButtons();

  return {
    undo,
    redo,
    copy: copySettings,
    randomize: randomizeAll,
    exportPNG: exportTex,
    selectByIndex: i => { if (TYPES[i]) selectType(TYPES[i].id, true); },
  };
}
