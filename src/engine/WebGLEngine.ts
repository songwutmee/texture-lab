import common from '../shaders/common.glsl?raw';
import noiseBody from '../shaders/noise.glsl?raw';

// shaders share the math library in common.glsl, spliced in at build time
export const NOISE_FRAG = common + noiseBody;

export type GL = WebGLRenderingContext;

export interface Settings {
  type: string;
  seed: number;
  scale: number; oct: number; lac: number; per: number;
  ws: number; wf: number;
  cont: number; bri: number; lo: number; hi: number;
  inv: boolean; seamless: boolean;
  tx: number; ty: number;
  out: number;
}

export interface Pan { x: number; y: number; }

export interface Program {
  p: WebGLProgram;
  buf: WebGLBuffer;
  loc: number;
}

const VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';

export function getGL(canvas: HTMLCanvasElement, opts?: WebGLContextAttributes): GL {
  const gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
  if (!gl) throw new Error('WebGL is not available');
  return gl as GL;
}

function compile(gl: GL, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(s));
  return s;
}

export function createProgram(gl: GL, frag: string): Program {
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(p);
  const buf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  return { p, buf, loc: gl.getAttribLocation(p, 'a') };
}

// fullscreen quad with a bag of uniforms; u_res is set from w/h
export function drawQuad(gl: GL, prog: Program, w: number, h: number,
                         floats: Record<string, number>, ints: Record<string, number>) {
  gl.useProgram(prog.p);
  gl.bindBuffer(gl.ARRAY_BUFFER, prog.buf);
  gl.enableVertexAttribArray(prog.loc);
  gl.vertexAttribPointer(prog.loc, 2, gl.FLOAT, false, 0, 0);

  for (const n in floats) {
    const l = gl.getUniformLocation(prog.p, n);
    if (l) gl.uniform1f(l, floats[n]);
  }
  for (const n in ints) {
    const l = gl.getUniformLocation(prog.p, n);
    if (l) gl.uniform1i(l, ints[n]);
  }
  gl.uniform2f(gl.getUniformLocation(prog.p, 'u_res'), w, h);
  gl.viewport(0, 0, w, h);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

export function drawNoise(gl: GL, prog: Program, w: number, h: number,
                          s: Settings, pan: Pan, typeIndex: number) {
  drawQuad(gl, prog, w, h, {
    u_scale: s.scale, u_oct: s.oct, u_lac: s.lac, u_per: s.per,
    u_seed: s.seed, u_ws: s.ws, u_wf: s.wf,
    u_cont: s.cont, u_bri: s.bri, u_lo: s.lo, u_hi: s.hi,
    u_inv: s.inv ? 1 : 0, u_seamless: s.seamless ? 1 : 0,
    u_tx: s.tx, u_ty: s.ty,
    u_panx: pan.x, u_pany: pan.y,
  }, {
    u_type: typeIndex, u_out: s.out,
  });
}

// copy the current GL framebuffer into a fresh 2D canvas, flipping Y to screen orientation
export function glToCanvas(gl: GL, size: number): HTMLCanvasElement {
  const px = new Uint8Array(size * size * 4);
  gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const row = size * 4;
  for (let y = 0; y < size; y++) {
    const src = (size - 1 - y) * row;
    img.data.set(px.subarray(src, src + row), y * row);
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}
