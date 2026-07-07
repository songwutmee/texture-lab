"""Watch a folder and auto-build a texture set from every PNG dropped in.

Drop height.png into the watch folder and get height / normal / AO /
packed RGBA in the output folder a second later.

    python watch_export.py --watch ./raw/ --output ./processed/
"""
import time
from pathlib import Path

import click
import numpy as np
from PIL import Image, ImageFilter
from rich.console import Console
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

console = Console()


def wait_until_stable(path, tries=20):
    """A file may still be copying when the event fires."""
    last = -1
    for _ in range(tries):
        size = path.stat().st_size
        if size == last and size > 0:
            return True
        last = size
        time.sleep(0.2)
    return False


def normal_map(height, strength):
    gy, gx = np.gradient(height * strength)
    nz = np.ones_like(height)
    length = np.sqrt(gx * gx + gy * gy + nz * nz)
    n = np.dstack(((-gx / length + 1), (-gy / length + 1), (nz / length + 1))) * 127.5
    return n.astype(np.uint8)


def ambient_occlusion(img, power):
    blurred = np.asarray(img.filter(ImageFilter.GaussianBlur(6)), float) / 255
    height = np.asarray(img, float) / 255
    ao = 1 - np.clip((blurred - height) * 3 * power, 0, 1)
    return (ao * 255).astype(np.uint8)


def process(path, out_dir, size, strength, ao_power):
    img = Image.open(path).convert("L")
    if size:
        img = img.resize((size, size), Image.LANCZOS)
    height = np.asarray(img, float) / 255

    name = path.stem
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)

    img.save(out / f"{name}_height.png")
    Image.fromarray(normal_map(height, strength), "RGB").save(out / f"{name}_normal.png")
    ao = ambient_occlusion(img, ao_power)
    Image.fromarray(ao, "L").save(out / f"{name}_ao.png")

    # packed: R height, G ao, B roughness (inverted height), one sample = three masks
    rough = ((1 - height * 0.6) * 255).astype(np.uint8)
    packed = np.dstack((np.asarray(img), ao, rough))
    Image.fromarray(packed, "RGB").save(out / f"{name}_packed.png")

    console.print(f"[green]done[/] {name} -> height, normal, ao, packed")


class Handler(FileSystemEventHandler):
    def __init__(self, out_dir, size, strength, ao_power):
        self.args = (out_dir, size, strength, ao_power)

    def on_created(self, event):
        path = Path(event.src_path)
        if event.is_directory or path.suffix.lower() != ".png":
            return
        console.print(f"[cyan]new[/] {path.name}")
        if wait_until_stable(path):
            try:
                process(path, *self.args)
            except Exception as e:  # keep watching even if one file is broken
                console.print(f"[red]failed[/] {path.name}: {e}")
        else:
            console.print(f"[yellow]skipped[/] {path.name}: never stopped growing")


@click.command()
@click.option("--watch", "watch_dir", required=True, type=click.Path(exists=True), help="folder to watch")
@click.option("--output", default="./processed", help="output folder")
@click.option("--size", default=0, help="resize input to this px (0 = keep)")
@click.option("--strength", default=4.0, help="normal map strength")
@click.option("--ao-power", default=1.0, help="ambient occlusion strength")
def main(watch_dir, output, size, strength, ao_power):
    observer = Observer()
    observer.schedule(Handler(output, size, strength, ao_power), watch_dir)
    observer.start()
    console.print(f"[bold]watching[/] {Path(watch_dir).resolve()} - drop PNG heightmaps here, Ctrl+C to stop")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()


if __name__ == "__main__":
    main()
