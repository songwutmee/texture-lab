"""Generate a whole texture pack from one JSON config.

    python batch_export.py --config vfx_pack.json --size 512 --output ./textures/
"""
import json
from pathlib import Path

import click
import numpy as np
from rich.console import Console
from rich.progress import track

from noiselib import render, to_image

console = Console()


@click.command()
@click.option("--config", required=True, type=click.Path(exists=True), help="JSON config file")
@click.option("--size", default=512, help="output resolution")
@click.option("--output", default="./textures", help="output folder")
def main(config, size, output):
    out = Path(output)
    out.mkdir(parents=True, exist_ok=True)
    entries = json.loads(Path(config).read_text())["textures"]

    for spec in track(entries, description="baking", console=console):
        rng = np.random.default_rng(spec.get("seed", 0))
        img = to_image(render(spec, size, rng))
        img.save(out / f"{spec['name']}.png")
        console.print(f"  [green]ok[/] {spec['name']}.png  {img.size[0]}x{img.size[1]}")

    console.print(f"[bold]{len(entries)} textures[/] -> {out.resolve()}")


if __name__ == "__main__":
    main()
