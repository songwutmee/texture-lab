"""Pack up to four grayscale masks into one RGBA texture.

One sample in the shader then gives four independent masks.

    python channel_pack.py --r smoke.png --g fire.png --b dissolve.png --output packed.png
"""
from pathlib import Path

import click
import numpy as np
from PIL import Image
from rich.console import Console
from rich.table import Table

console = Console()


@click.command()
@click.option("--r", "r_path", type=click.Path(exists=True), help="red channel PNG")
@click.option("--g", "g_path", type=click.Path(exists=True), help="green channel PNG")
@click.option("--b", "b_path", type=click.Path(exists=True), help="blue channel PNG")
@click.option("--a", "a_path", type=click.Path(exists=True), help="alpha channel PNG")
@click.option("--fill", default=0, help="value 0-255 for missing channels")
@click.option("--output", required=True, help="output RGBA PNG")
def main(r_path, g_path, b_path, a_path, fill, output):
    paths = {"R": r_path, "G": g_path, "B": b_path, "A": a_path}
    if not any(paths.values()):
        raise click.UsageError("give at least one of --r --g --b --a")

    # first given image decides the resolution; the rest get resized to match
    first = next(p for p in paths.values() if p)
    size = Image.open(first).size

    table = Table(title="channel pack")
    table.add_column("channel")
    table.add_column("source")

    channels = []
    for name, path in paths.items():
        if path:
            img = Image.open(path).convert("L").resize(size, Image.LANCZOS)
            channels.append(np.asarray(img))
            table.add_row(name, Path(path).name)
        else:
            channels.append(np.full(size[::-1], fill if name != "A" else 255, np.uint8))
            table.add_row(name, f"[dim]fill {fill if name != 'A' else 255}[/]")

    Image.fromarray(np.dstack(channels), "RGBA").save(output)
    console.print(table)
    console.print(f"[bold]saved[/] {output}  {size[0]}x{size[1]}")


if __name__ == "__main__":
    main()
