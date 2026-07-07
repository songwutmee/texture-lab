// Trigger a PNG download for any canvas.
export function downloadCanvas(cv: HTMLCanvasElement, filename: string) {
  const a = document.createElement('a');
  a.download = filename;
  a.href = cv.toDataURL('image/png');
  a.click();
}
