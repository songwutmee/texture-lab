"""Small numpy noise kit shared by the CLI tools."""
import numpy as np


def value_noise(size, freq, rng):
    freq = max(int(freq), 1)
    g = rng.random((freq + 1, freq + 1))
    g[-1, :] = g[0, :]  # wrap edges so the result tiles
    g[:, -1] = g[:, 0]
    x = np.linspace(0, freq, size, endpoint=False)
    i = x.astype(int)
    f = x - i
    f = f * f * (3 - 2 * f)
    fx, fy = np.meshgrid(f, f)
    ix, iy = np.meshgrid(i, i)
    a, b = g[iy, ix], g[iy, ix + 1]
    c, d = g[iy + 1, ix], g[iy + 1, ix + 1]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def fbm(size, scale, octaves, rng):
    out = np.zeros((size, size))
    amp, total = 1.0, 0.0
    for o in range(max(octaves, 1)):
        out += amp * value_noise(size, scale * 2 ** o, rng)
        total += amp
        amp *= 0.5
    return out / total


def voronoi(size, scale, rng):
    cells = max(int(scale), 2)
    pts = rng.random((cells, cells, 2))
    ys, xs = np.mgrid[0:size, 0:size] / size * cells
    cx, cy = xs.astype(int), ys.astype(int)
    best = np.full((size, size), 9.0)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            nx, ny = (cx + dx) % cells, (cy + dy) % cells
            px = pts[ny, nx, 0] + cx + dx
            py = pts[ny, nx, 1] + cy + dy
            best = np.minimum(best, np.hypot(xs - px, ys - py))
    return np.clip(best, 0, 1)


def render(spec, size, rng):
    """Build one grayscale texture (0..1) from a config entry."""
    kind = spec.get("type", "perlin")
    scale = spec.get("scale", 4)
    octaves = spec.get("octaves", 5)

    if kind == "voronoi":
        img = voronoi(size, scale, rng)
    elif kind == "ridge":
        img = 1 - np.abs(fbm(size, scale, octaves, rng) * 2 - 1)
    elif kind == "warp":
        base = fbm(size, scale, octaves, rng)
        shift = fbm(size, scale, octaves, rng) * spec.get("warp_str", 2)
        cols = (np.arange(size)[None, :] + (shift * size / scale).astype(int)) % size
        img = base[np.arange(size)[:, None], cols]
    elif kind == "white":
        img = rng.random((size, size))
    else:  # perlin
        img = fbm(size, scale, octaves, rng)

    img = (img - img.min()) / max(np.ptp(img), 1e-6)
    img = np.clip((img - 0.5) * spec.get("contrast", 1) + 0.5, 0, 1)
    if spec.get("invert"):
        img = 1 - img
    return img


def to_image(img):
    from PIL import Image
    return Image.fromarray((img * 255).astype(np.uint8), "L")
